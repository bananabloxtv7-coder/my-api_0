/**
 * Endpoint type detection & model parsing for the transparent proxy.
 *
 * The gateway exposes an OpenAI-compatible surface to clients and maps each
 * logical endpoint type to the provider's configured path.
 */

export type EndpointType =
  | "chat"
  | "models"
  | "embeddings"
  | "images"
  | "audio"
  | "responses"
  | "rerank"
  | "moderation"
  | "fine_tuning"
  | "custom";

export interface DetectedEndpoint {
  type: EndpointType;
  /** original path the client called (relative to /api/v1) */
  path: string;
}

const PATH_RULES: Array<{ type: EndpointType; test: RegExp }> = [
  // ── Chat ── supports any of these provider path shapes:
  //   /chat, /chats, /chat/completions, /chats/completions
  //   /ai/chat, /v1/ai/chat, /openai/v1/chat/completions
  //   /messages (Anthropic), /conversations, /conversation
  { type: "chat", test: /\/chats?\/(completions|messages)$/i },
  { type: "chat", test: /\/chats?$/i },
  { type: "chat", test: /\/completions$/i },
  { type: "chat", test: /\/messages$/i },
  { type: "chat", test: /\/conversations?$/i },
  { type: "chat", test: /\/ai\/chat/i },
  // ── Gemini ── generateContent / streamGenerateContent
  { type: "chat", test: /:generateContent$/i },
  { type: "chat", test: /:streamGenerateContent$/i },
  // ── Models ──
  { type: "models", test: /\/models$/i },
  // ── Embeddings ──
  { type: "embeddings", test: /\/embeddings$/i },
  // ── Images ──
  { type: "images", test: /\/images\/(generations|variations|edits)$/i },
  { type: "images", test: /\/images$/i },
  // ── Audio ──
  { type: "audio", test: /\/audio\//i },
  // ── Responses (OpenAI Responses API) ──
  { type: "responses", test: /\/responses$/i },
  // ── Rerank ──
  { type: "rerank", test: /\/reranks?$/i },
  // ── Moderation ──
  { type: "moderation", test: /\/moderations?$/i },
  // ── Fine tuning ──
  { type: "fine_tuning", test: /\/fine_tuning\//i },
];

/** Detect the logical endpoint type from the requested path. */
export function detectEndpointType(path: string): DetectedEndpoint {
  // Strip ALL known mount prefixes: /gw/v1, /proxy/v1, /api/v1, /v1
  // Order matters: longer prefixes first to avoid partial matches.
  const normalized = path
    .replace(/^\/gw\/v1/i, "")
    .replace(/^\/proxy\/v1/i, "")
    .replace(/^\/api\/v1/i, "")
    .replace(/^\/v1/i, "")
    .replace(/^\/+/, "/");
  for (const rule of PATH_RULES) {
    if (rule.test.test(normalized)) {
      return { type: rule.type, path: normalized };
    }
  }
  return { type: "custom", path: normalized };
}

/**
 * Parse the requested model from a JSON body.
 * Supports multiple provider body shapes so the gateway can do model
 * discovery regardless of which native format the client uses:
 *
 *   OpenAI:     { "model": "gpt-4o", "messages": [...] }
 *   v0:         { "message": "...", "modelConfiguration": { "modelId": "v0-max" } }
 *   Generic:    { "modelId": "..." }
 *
 * Returns null for endpoints that don't carry a model (e.g. /models).
 */
export function parseModel(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;

  // Standard OpenAI-style: { "model": "..." }
  if (typeof obj.model === "string" && obj.model.length > 0) return obj.model;

  // v0-style: { "modelConfiguration": { "modelId": "..." } }
  const mc = obj.modelConfiguration;
  if (mc && typeof mc === "object") {
    const modelId = (mc as Record<string, unknown>).modelId;
    if (typeof modelId === "string" && modelId.length > 0) return modelId;
  }

  // Generic alternative: { "modelId": "..." }
  if (typeof obj.modelId === "string" && obj.modelId.length > 0) return obj.modelId;

  return null;
}

/** Safely parse a JSON body, returning null on failure. */
export function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
