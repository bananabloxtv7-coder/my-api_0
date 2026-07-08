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
  { type: "chat", test: /\/chat\/completions$/ },
  { type: "chat", test: /\/messages$/ }, // anthropic-style
  { type: "chat", test: /\/(chat|conversation)(\/)?$/ },
  { type: "models", test: /\/models$/ },
  { type: "embeddings", test: /\/embeddings$/ },
  { type: "images", test: /\/images\/(generations|variations|edits)$/ },
  { type: "images", test: /\/images$/ },
  { type: "audio", test: /\/audio\// },
  { type: "responses", test: /\/responses$/ },
  { type: "rerank", test: /\/rerank$/ },
  { type: "moderation", test: /\/moderations$/ },
  { type: "fine_tuning", test: /\/fine_tuning\// },
];

/** Detect the logical endpoint type from the requested path. */
export function detectEndpointType(path: string): DetectedEndpoint {
  const normalized = path.replace(/^\/api\/v1/, "").replace(/^\/+/, "/");
  for (const rule of PATH_RULES) {
    if (rule.test.test(normalized)) {
      return { type: rule.type, path: normalized };
    }
  }
  return { type: "custom", path: normalized };
}

/**
 * Parse the requested model from a JSON body.
 * Returns null for endpoints that don't carry a model (e.g. /models).
 */
export function parseModel(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const model = obj.model;
  if (typeof model === "string" && model.length > 0) return model;
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
