/**
 * Protocol translation between OpenAI Chat Completions and Vercel v0 API.
 */

interface ChatMessage {
  role: string;
  content?: unknown;
}

interface ChatRequestBody {
  model?: string;
  messages?: ChatMessage[];
  [key: string]: unknown;
}

interface V0RequestBody {
  message: string;
  modelConfiguration?: {
    modelId?: string;
  };
}

/**
 * Convert a Chat Completions request body to a v0 API request body.
 * Flattens the conversation history into a single string.
 */
export function chatToV0Request(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as ChatRequestBody;

  let messageText = "";
  if (src.messages && Array.isArray(src.messages)) {
    // Flatten messages into a single prompt for v0 since it doesn't support chat history natively in one shot
    for (const m of src.messages) {
      const role = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User";
      let content = m.content ?? "";
      if (Array.isArray(content)) {
        content = content
          .map((c: any) => (typeof c === "string" ? c : c.text ?? ""))
          .join("");
      } else if (typeof content !== "string") {
        content = JSON.stringify(content);
      }
      messageText += `[${role}]:\n${content}\n\n`;
    }
  }

  // Determine target v0 model based on requested model
  let targetModel = "v0-max"; // default
  if (src.model) {
    if (src.model.includes("opus")) {
      targetModel = "v0-pro";
    } else if (src.model.includes("fable") || src.model.includes("sonnet")) {
      targetModel = "v0-max";
    }
  }

  const out: V0RequestBody = {
    message: messageText.trim(),
    modelConfiguration: {
      modelId: targetModel
    }
  };

  return out;
}

/**
 * Convert a v0 API response body to Chat Completions format.
 */
export function v0ToChatResponse(body: unknown, model: string): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as Record<string, unknown>;

  // If already Chat Completions shape, leave alone
  if (Array.isArray(src.choices)) return body;

  let text = "";
  if (typeof src.text === "string") {
    text = src.text;
  } else if (Array.isArray(src.messages)) {
    // Try to extract text from the last assistant message
    const lastMsg = src.messages[src.messages.length - 1];
    if (lastMsg && typeof lastMsg === "object") {
      if (typeof lastMsg.content === "string") {
        text = lastMsg.content;
      } else if (typeof lastMsg.text === "string") {
        text = lastMsg.text;
      }
    }
  }

  return {
    id: src.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model ?? "unknown",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
          refusal: null,
        },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
    system_fingerprint: null,
  };
}
