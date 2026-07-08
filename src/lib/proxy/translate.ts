/**
 * Protocol translation between OpenAI and Anthropic request/response shapes.
 *
 * This is an OPTIONAL, opt-in feature per provider. When a provider is set to
 * protocol = "anthropic", the gateway converts the client's OpenAI-style
 * request body into the Anthropic Messages API format before forwarding,
 * and converts the upstream Anthropic response back into OpenAI format so the
 * client can keep using the OpenAI SDK against a unified endpoint.
 *
 * For protocol = "transparent" (default) nothing is transformed — the gateway
 * is a pure pass-through reverse proxy.
 */

interface OpenAIMessage {
  role: string;
  content?: unknown;
  name?: string;
}

interface OpenAIRequestBody {
  model?: string;
  messages?: OpenAIMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: unknown;
  tool_choice?: unknown;
  [key: string]: unknown;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: unknown;
}

interface AnthropicRequestBody {
  model?: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop_sequences?: string[];
  [key: string]: unknown;
}

/** Convert an OpenAI-style request body to Anthropic Messages API format. */
export function openaiToAnthropicRequest(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as OpenAIRequestBody;

  const out: AnthropicRequestBody = {
    model: src.model,
    messages: [],
    max_tokens: src.max_tokens ?? 4096,
  };

  // Extract system message(s): OpenAI puts them as a message with role "system".
  // Anthropic wants a top-level "system" string.
  const systemParts: string[] = [];
  const chatMessages: OpenAIMessage[] = [];
  for (const m of src.messages ?? []) {
    if (m.role === "system") {
      if (typeof m.content === "string") systemParts.push(m.content);
      else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (typeof part === "string") systemParts.push(part);
          else if (part && typeof part === "object" && "text" in part) {
            systemParts.push(String((part as { text: unknown }).text));
          }
        }
      }
    } else {
      chatMessages.push(m);
    }
  }
  if (src.system) systemParts.push(src.system);
  if (systemParts.length > 0) out.system = systemParts.join("\n\n");

  // Convert messages: OpenAI role must be user/assistant for Anthropic.
  // (tool/function roles get dropped or mapped to user — kept simple here.)
  for (const m of chatMessages) {
    const role: "user" | "assistant" =
      m.role === "assistant" ? "assistant" : "user";
    // Anthropic content can be a string or array of content blocks.
    // Pass through as-is; if it's a string, that's valid for Anthropic too.
    out.messages.push({ role, content: m.content ?? "" });
  }

  // Map optional fields
  if (typeof src.temperature === "number") out.temperature = src.temperature;
  if (typeof src.top_p === "number") out.top_p = src.top_p;
  if (typeof src.stream === "boolean") out.stream = src.stream;
  if (typeof src.stop === "string") out.stop_sequences = [src.stop];
  else if (Array.isArray(src.stop)) out.stop_sequences = src.stop;

  // Pass through any other unknown fields (e.g. tools, metadata)
  for (const [k, v] of Object.entries(src)) {
    if (
      !["model", "messages", "system", "max_tokens", "temperature", "top_p", "stream", "stop"].includes(
        k
      )
    ) {
      out[k] = v;
    }
  }

  return out;
}

/** Convert an Anthropic Messages API response to OpenAI chat completion format. */
export function anthropicToOpenAIResponse(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as Record<string, unknown>;

  // Already OpenAI-shaped → leave alone
  if (Array.isArray(src.choices)) return body;

  const content = src.content; // Anthropic: array of { type, text }
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) return String((c as { text: unknown }).text);
        return "";
      })
      .join("");
  }

  const usage = src.usage as Record<string, unknown> | undefined;

  return {
    id: src.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: src.model ?? "unknown",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: mapFinishReason(src.stop_reason),
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

function mapFinishReason(reason: unknown): string {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    default:
      return "stop";
  }
}

/**
 * Convert an Anthropic streaming SSE event to OpenAI streaming chunks.
 * Returns an array of OpenAI-style chunk strings (with "data: " prefix),
 * or null if the event should be skipped.
 */
export function anthropicStreamToOpenAI(
  event: string,
  data: unknown,
  state: { model: string; started: boolean }
): string | null {
  const model = state.model;

  if (event === "message_start") {
    const chunk = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  if (event === "content_block_delta") {
    const d = data as { delta?: { text?: string } };
    const text = d?.delta?.text;
    if (!text) return null;
    const chunk = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  if (event === "message_delta") {
    const d = data as { delta?: { stop_reason?: string } };
    const finish = mapFinishReason(d?.delta?.stop_reason);
    const chunk = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: {}, finish_reason: finish }],
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  if (event === "message_stop") {
    return `data: [DONE]\n\n`;
  }

  return null;
}
