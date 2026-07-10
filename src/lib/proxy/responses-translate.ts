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
 * Convert a Chat Completions content part to a Responses API content part.
 *
 * Chat Completions uses: {type: "text", text: "..."}
 *                      {type: "image_url", image_url: {url: "..."}}
 * Responses API uses:  {type: "input_text", text: "..."}
 *                      {type: "input_image", image_url: "..."}
 */
function convertContentPart(part: unknown): unknown {
  if (typeof part === "string") return { type: "input_text", text: part };
  if (!part || typeof part !== "object") return part;
  const p = part as Record<string, unknown>;
  switch (p.type) {
    case "text":
      return { type: "input_text", text: p.text ?? "" };
    case "image_url":
      // Chat: {type:"image_url", image_url:{url:"..."}} → Responses: {type:"input_image", image_url:"..."}
      return {
        type: "input_image",
        image_url: typeof p.image_url === "string" ? p.image_url : (p.image_url as Record<string,unknown>)?.url ?? "",
      };
    case "input_text":
    case "input_image":
    case "output_text":
      return p; // already Responses format
    default:
      return p;
  }
}

/**
 * Convert a Chat Completions request body to a Responses API request body.
 *
 * The Responses API "input" field can be:
 *   - A string (simple prompt)
 *   - An array of message objects [{role, content}]
 *
 * We use the array form to preserve conversation history and roles.
 * Content parts are converted from Chat format (type:"text") to Responses
 * format (type:"input_text").
 */
export function chatToResponsesRequest(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as ChatRequestBody;

  // Convert messages to Responses input format
  let input: unknown = "";
  if (src.messages && Array.isArray(src.messages)) {
    input = src.messages.map((m) => {
      const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "developer" : "user";
      let content = m.content ?? "";
      // If content is an array of parts, convert each part to Responses format
      if (Array.isArray(content)) {
        content = content.map(convertContentPart);
      } else if (typeof content === "string") {
        // string content stays as string (Responses API accepts it)
      }
      return { role, content };
    });
  }

  const out: ResponsesRequestBody = {
    model: src.model,
    input,
  };

  if (typeof src.max_tokens === "number") out.max_output_tokens = src.max_tokens;
  if (typeof src.stream === "boolean") out.stream = src.stream;

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
