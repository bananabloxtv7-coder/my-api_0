/**
 * Protocol translation between OpenAI Chat Completions and OpenAI Responses API.
 *
 * Some models (e.g. gpt-5.6-sol on CometAPI) only work with the Responses API
 * (/v1/responses with "input" field) and don't support Chat Completions
 * (/v1/chat/completions with "messages" field).
 *
 * When a provider is set to protocol = "responses", the gateway:
 * 1. Converts the client's Chat Completions request (messages) to a Responses
 *    request (input) before forwarding.
 * 2. Converts the upstream Responses output back to Chat Completions format
 *    so the client (which uses the OpenAI Chat SDK) gets a familiar response.
 *
 * This lets you use gpt-5.6-sol in ANY tool that supports OpenAI Chat —
 * Cursor, Cline, ChatBox, LibreChat, etc.
 */

interface ChatMessage {
  role: string;
  content?: unknown;
}

interface ChatRequestBody {
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  [key: string]: unknown;
}

interface ResponsesRequestBody {
  model?: string;
  input: unknown;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

/**
 * Convert a Chat Completions request body to a Responses API request body.
 *
 * The Responses API "input" field can be:
 *   - A string (simple prompt)
 *   - An array of message objects [{role, content}]
 *
 * We use the array form to preserve conversation history and roles.
 */
export function chatToResponsesRequest(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as ChatRequestBody;

  // Convert messages to Responses input format
  let input: unknown = "";
  if (src.messages && Array.isArray(src.messages)) {
    // Responses API input items: each has role + content
    input = src.messages.map((m) => {
      // Responses API expects content as a string or array of content parts.
      // Pass through as-is; string content works directly.
      const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "developer" : "user";
      return { role, content: m.content ?? "" };
    });
  }

  const out: ResponsesRequestBody = {
    model: src.model,
    input,
  };

  // Map optional fields
  if (typeof src.temperature === "number") out.temperature = src.temperature;
  if (typeof src.top_p === "number") out.top_p = src.top_p;
  if (typeof src.max_tokens === "number") out.max_output_tokens = src.max_tokens;
  if (typeof src.stream === "boolean") out.stream = src.stream;

  // Pass through any other unknown fields (tools, tool_choice, etc.)
  for (const [k, v] of Object.entries(src)) {
    if (
      !["model", "messages", "temperature", "top_p", "max_tokens", "stream", "stop"].includes(k)
    ) {
      out[k] = v;
    }
  }

  return out;
}

/**
 * Convert a Responses API response body to Chat Completions format.
 */
export function responsesToChatResponse(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as Record<string, unknown>;

  // Already Chat Completions shaped → leave alone
  if (Array.isArray(src.choices)) return body;

  // Extract text from the Responses output array
  let text = "";
  const output = src.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item && typeof item === "object") {
        const content = (item as Record<string, unknown>).content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part && typeof part === "object" && "text" in part) {
              text += String((part as Record<string, unknown>).text);
            }
          }
        }
      }
    }
  }

  const usage = src.usage as Record<string, unknown> | undefined;

  return {
    id: src.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: typeof src.created_at === "number" ? src.created_at : Math.floor(Date.now() / 1000),
    model: src.model ?? "unknown",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: src.status === "incomplete" ? "length" : "stop",
      },
    ],
    usage: {
      prompt_tokens: usage?.input_tokens ?? 0,
      completion_tokens: usage?.output_tokens ?? 0,
      total_tokens:
        (Number(usage?.input_tokens) || 0) + (Number(usage?.output_tokens) || 0),
    },
  };
}
