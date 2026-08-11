/**
 * Protocol translation between OpenAI, Anthropic, and Google Gemini.
 *
 * Supports:
 *  - OpenAI ↔ Anthropic Messages API (including tool calling)
 *  - OpenAI ↔ Google Gemini generateContent API
 *  - Streaming translation for both Anthropic and Gemini SSE
 *
 * For protocol = "transparent" (default) nothing is transformed.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

interface OpenAIMessage {
  role: string;
  content?: unknown;
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
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
  tools?: unknown[];
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
  tools?: unknown[];
  tool_choice?: unknown;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
//  OpenAI ↔ Anthropic
// ═══════════════════════════════════════════════════════════════════════════

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
    if (m.role === "system" || m.role === "developer") {
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

  // Convert messages
  for (const m of chatMessages) {
    if (m.role === "tool" && m.tool_call_id) {
      // Tool result: OpenAI sends {role:"tool", tool_call_id, content}
      // Anthropic wants {role:"user", content:[{type:"tool_result", tool_use_id, content}]}
      out.messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: m.tool_call_id,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }],
      });
      continue;
    }

    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      // Assistant with tool_calls: convert to Anthropic content blocks
      const contentBlocks: unknown[] = [];
      if (typeof m.content === "string" && m.content) {
        contentBlocks.push({ type: "text", text: m.content });
      }
      for (const tc of m.tool_calls) {
        const call = tc as Record<string, unknown>;
        const fn = call.function as Record<string, unknown> | undefined;
        if (fn) {
          contentBlocks.push({
            type: "tool_use",
            id: call.id || `toolu_${Date.now()}`,
            name: fn.name,
            input: typeof fn.arguments === "string" ? safeJsonParse(fn.arguments) : fn.arguments,
          });
        }
      }
      out.messages.push({ role: "assistant", content: contentBlocks });
      continue;
    }

    const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user";
    out.messages.push({ role, content: m.content ?? "" });
  }

  // Map optional fields
  if (typeof src.temperature === "number") out.temperature = src.temperature;
  if (typeof src.top_p === "number") out.top_p = src.top_p;
  if (typeof src.stream === "boolean") out.stream = src.stream;
  if (typeof src.stop === "string") out.stop_sequences = [src.stop];
  else if (Array.isArray(src.stop)) out.stop_sequences = src.stop;

  // Translate tools
  if (Array.isArray(src.tools) && src.tools.length > 0) {
    out.tools = translateToolsToAnthropic(src.tools);
  }
  if (src.tool_choice !== undefined) {
    out.tool_choice = translateToolChoiceToAnthropic(src.tool_choice);
  }

  // Pass through unknown fields (except already-handled ones)
  const handled = new Set(["model", "messages", "system", "max_tokens", "temperature",
    "top_p", "stream", "stop", "tools", "tool_choice"]);
  for (const [k, v] of Object.entries(src)) {
    if (!handled.has(k)) out[k] = v;
  }

  // Convert thinking.type = "enabled" → "adaptive" for v0 compatibility
  if (out.thinking && typeof out.thinking === "object") {
    const tObj = out.thinking as Record<string, unknown>;
    if (tObj.type === "enabled") {
      tObj.type = "adaptive";
      delete tObj.budget_tokens;
    }
  }

  return out;
}

/** Convert OpenAI tool definitions to Anthropic format. */
function translateToolsToAnthropic(tools: unknown[]): unknown[] {
  return tools.map((t) => {
    const tool = t as Record<string, unknown>;
    if (tool.type === "function") {
      const fn = tool.function as Record<string, unknown>;
      return {
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters ?? { type: "object", properties: {} },
      };
    }
    return tool; // pass through if not a function tool
  });
}

/** Convert OpenAI tool_choice to Anthropic format. */
function translateToolChoiceToAnthropic(choice: unknown): unknown {
  if (choice === "none") return { type: "none" };
  if (choice === "auto") return { type: "auto" };
  if (choice === "required") return { type: "any" };
  if (choice && typeof choice === "object") {
    const c = choice as Record<string, unknown>;
    if (c.type === "function" && c.function) {
      const fn = c.function as Record<string, unknown>;
      return { type: "tool", name: fn.name };
    }
  }
  return { type: "auto" };
}

/** Convert an Anthropic Messages API response to OpenAI chat completion format. */
export function anthropicToOpenAIResponse(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as Record<string, unknown>;

  // Already OpenAI-shaped → leave alone
  if (Array.isArray(src.choices)) return body;

  const content = src.content;
  let text = "";
  const toolCalls: unknown[] = [];

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    for (const c of content) {
      if (typeof c === "string") {
        text += c;
      } else if (c && typeof c === "object") {
        const block = c as Record<string, unknown>;
        if (block.type === "text" && typeof block.text === "string") {
          text += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {}),
            },
          });
        }
      }
    }
  }

  const usage = src.usage as Record<string, unknown> | undefined;
  const message: Record<string, unknown> = { role: "assistant", content: text || null };
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    id: src.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: src.model ?? "unknown",
    choices: [{
      index: 0,
      message,
      finish_reason: mapAnthropicFinishReason(src.stop_reason),
    }],
    usage: {
      prompt_tokens: usage?.input_tokens ?? 0,
      completion_tokens: usage?.output_tokens ?? 0,
      total_tokens: (Number(usage?.input_tokens) || 0) + (Number(usage?.output_tokens) || 0),
    },
  };
}

function mapAnthropicFinishReason(reason: unknown): string {
  switch (reason) {
    case "end_turn":
    case "stop_sequence": return "stop";
    case "max_tokens": return "length";
    case "tool_use": return "tool_calls";
    default: return "stop";
  }
}

/**
 * Convert Anthropic streaming SSE events to OpenAI streaming chunks.
 * Handles text content, tool_use blocks, and stop events.
 */
export function anthropicStreamToOpenAI(
  event: string,
  data: unknown,
  state: { model: string; started: boolean; toolIndex?: number }
): string | null {
  const model = state.model;
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  if (event === "message_start") {
    return `data: ${JSON.stringify({
      id, object: "chat.completion.chunk", created, model,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    })}\n\n`;
  }

  if (event === "content_block_start") {
    const d = data as { content_block?: { type?: string; id?: string; name?: string } };
    const block = d?.content_block;
    if (block?.type === "tool_use") {
      const idx = state.toolIndex = (state.toolIndex ?? -1) + 1;
      return `data: ${JSON.stringify({
        id, object: "chat.completion.chunk", created, model,
        choices: [{ index: 0, delta: {
          tool_calls: [{ index: idx, id: block.id, type: "function", function: { name: block.name, arguments: "" } }],
        }, finish_reason: null }],
      })}\n\n`;
    }
    return null;
  }

  if (event === "content_block_delta") {
    const d = data as { delta?: { type?: string; text?: string; partial_json?: string } };
    const delta = d?.delta;
    if (delta?.type === "text_delta" && delta.text) {
      return `data: ${JSON.stringify({
        id, object: "chat.completion.chunk", created, model,
        choices: [{ index: 0, delta: { content: delta.text }, finish_reason: null }],
      })}\n\n`;
    }
    if (delta?.type === "input_json_delta" && delta.partial_json !== undefined) {
      const idx = state.toolIndex ?? 0;
      return `data: ${JSON.stringify({
        id, object: "chat.completion.chunk", created, model,
        choices: [{ index: 0, delta: {
          tool_calls: [{ index: idx, function: { arguments: delta.partial_json } }],
        }, finish_reason: null }],
      })}\n\n`;
    }
    return null;
  }

  if (event === "message_delta") {
    const d = data as { delta?: { stop_reason?: string } };
    const finish = mapAnthropicFinishReason(d?.delta?.stop_reason);
    return `data: ${JSON.stringify({
      id, object: "chat.completion.chunk", created, model,
      choices: [{ index: 0, delta: {}, finish_reason: finish }],
    })}\n\n`;
  }

  if (event === "message_stop") {
    return `data: [DONE]\n\n`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  OpenAI ↔ Google Gemini
// ═══════════════════════════════════════════════════════════════════════════

/** Convert OpenAI Chat Completions request to Gemini generateContent format. */
export function openaiToGeminiRequest(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as OpenAIRequestBody;

  const out: Record<string, unknown> = {};

  // System instruction
  const systemParts: string[] = [];
  const chatMessages: OpenAIMessage[] = [];
  for (const m of src.messages ?? []) {
    if (m.role === "system" || m.role === "developer") {
      if (typeof m.content === "string") systemParts.push(m.content);
    } else {
      chatMessages.push(m);
    }
  }
  if (src.system) systemParts.push(src.system);
  if (systemParts.length > 0) {
    out.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };
  }

  // Convert messages → contents
  const contents: unknown[] = [];
  for (const m of chatMessages) {
    const role = m.role === "assistant" ? "model" : "user";
    const parts: unknown[] = [];

    if (m.role === "tool" && m.tool_call_id) {
      // Tool result → functionResponse
      parts.push({
        functionResponse: {
          name: m.name || m.tool_call_id,
          response: { result: typeof m.content === "string" ? m.content : JSON.stringify(m.content) },
        },
      });
      contents.push({ role: "function", parts });
      continue;
    }

    if (Array.isArray(m.tool_calls)) {
      // Assistant with tool calls → functionCall parts
      if (typeof m.content === "string" && m.content) {
        parts.push({ text: m.content });
      }
      for (const tc of m.tool_calls) {
        const call = tc as Record<string, unknown>;
        const fn = call.function as Record<string, unknown> | undefined;
        if (fn) {
          parts.push({
            functionCall: {
              name: fn.name,
              args: typeof fn.arguments === "string" ? safeJsonParse(fn.arguments) : fn.arguments,
            },
          });
        }
      }
      contents.push({ role: "model", parts });
      continue;
    }

    // Regular message
    if (typeof m.content === "string") {
      parts.push({ text: m.content || " " });
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (typeof p === "string") parts.push({ text: p });
        else if (p && typeof p === "object") {
          const part = p as Record<string, unknown>;
          if (part.type === "text") parts.push({ text: part.text ?? "" });
          else if (part.type === "image_url") {
            const url = typeof part.image_url === "string"
              ? part.image_url
              : (part.image_url as Record<string, unknown>)?.url;
            if (typeof url === "string" && url.startsWith("data:")) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
              }
            } else {
              parts.push({ text: `[Image: ${url}]` });
            }
          }
        }
      }
    }
    if (parts.length > 0) contents.push({ role, parts });
  }
  out.contents = contents;

  // Generation config
  const genConfig: Record<string, unknown> = {};
  if (typeof src.max_tokens === "number") genConfig.maxOutputTokens = src.max_tokens;
  if (typeof src.temperature === "number") genConfig.temperature = src.temperature;
  if (typeof src.top_p === "number") genConfig.topP = src.top_p;
  if (typeof src.stop === "string") genConfig.stopSequences = [src.stop];
  else if (Array.isArray(src.stop)) genConfig.stopSequences = src.stop;
  if (Object.keys(genConfig).length > 0) out.generationConfig = genConfig;

  // Tools
  if (Array.isArray(src.tools) && src.tools.length > 0) {
    const fns = src.tools
      .filter((t) => (t as Record<string, unknown>).type === "function")
      .map((t) => {
        const fn = (t as Record<string, unknown>).function as Record<string, unknown>;
        return { name: fn.name, description: fn.description, parameters: fn.parameters };
      });
    if (fns.length > 0) out.tools = [{ functionDeclarations: fns }];
  }

  return out;
}

/** Convert Gemini generateContent response to OpenAI Chat Completions format. */
export function geminiToOpenAIResponse(body: unknown, model?: string): unknown {
  if (!body || typeof body !== "object") return body;
  const src = body as Record<string, unknown>;

  // Already OpenAI-shaped
  if (Array.isArray(src.choices)) return body;

  const candidates = src.candidates as Record<string, unknown>[] | undefined;
  const candidate = candidates?.[0];
  const content = candidate?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Record<string, unknown>[] | undefined;

  let text = "";
  const toolCalls: unknown[] = [];

  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (typeof part.text === "string") text += part.text;
      if (part.functionCall) {
        const fc = part.functionCall as Record<string, unknown>;
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: "function",
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args ?? {}),
          },
        });
      }
    }
  }

  const usageMeta = src.usageMetadata as Record<string, unknown> | undefined;
  const message: Record<string, unknown> = { role: "assistant", content: text || null };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  const finishReason = mapGeminiFinishReason(candidate?.finishReason);

  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model ?? src.modelVersion ?? "gemini",
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: {
      prompt_tokens: usageMeta?.promptTokenCount ?? 0,
      completion_tokens: usageMeta?.candidatesTokenCount ?? 0,
      total_tokens: usageMeta?.totalTokenCount ?? 0,
    },
  };
}

function mapGeminiFinishReason(reason: unknown): string {
  switch (reason) {
    case "STOP": return "stop";
    case "MAX_TOKENS": return "length";
    case "SAFETY": return "content_filter";
    case "RECITATION": return "content_filter";
    default: return "stop";
  }
}

/**
 * Convert a Gemini streaming SSE event to OpenAI streaming chunks.
 * Gemini streams by sending JSON objects separated by newlines, each
 * being a complete generateContent response for that chunk.
 */
export function geminiStreamToOpenAI(
  data: unknown,
  state: { model: string }
): string | null {
  if (!data || typeof data !== "object") return null;
  const src = data as Record<string, unknown>;

  const candidates = src.candidates as Record<string, unknown>[] | undefined;
  const candidate = candidates?.[0];
  const content = candidate?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Record<string, unknown>[] | undefined;

  if (!parts || parts.length === 0) return null;

  let text = "";
  for (const part of parts) {
    if (typeof part.text === "string") text += part.text;
  }

  const finishReason = candidate?.finishReason
    ? mapGeminiFinishReason(candidate.finishReason)
    : null;

  const chunk = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: state.model,
    choices: [{
      index: 0,
      delta: text ? { content: text } : {},
      finish_reason: finishReason,
    }],
  };

  return `data: ${JSON.stringify(chunk)}\n\n`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

/**
 * Build the Gemini API URL for a given model and streaming preference.
 * Gemini embeds the model name in the URL path.
 *
 * @param baseUrl Provider's base URL (e.g. https://generativelanguage.googleapis.com)
 * @param model   Model name (e.g. gemini-2.0-flash)
 * @param stream  Whether the client requested streaming
 * @returns Full URL string
 */
export function buildGeminiUrl(baseUrl: string, model: string, stream: boolean): string {
  const base = baseUrl.replace(/\/+$/, "");
  const method = stream ? "streamGenerateContent" : "generateContent";
  // If the model already includes a slash or "models/", don't double it
  const modelPath = model.includes("/") ? model : `models/${model}`;
  return `${base}/v1beta/${modelPath}:${method}`;
}
