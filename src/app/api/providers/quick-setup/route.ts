import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encrypt, preview } from "@/lib/crypto";
import { audit, getClientIp } from "@/lib/audit";
import { invalidateUserCache } from "@/lib/proxy/cache";

export const runtime = "nodejs";

// ─────────────────────────── Provider Templates ───────────────────────────
// Pre-configured templates for popular AI providers. Each template defines
// the baseUrl, authentication scheme, protocol translation mode, default
// endpoints, and (optionally) a curated list of known models.

interface ProviderTemplate {
  name: string;
  baseUrl: string;
  authHeader: string;
  authScheme: string;
  protocol: string;
  endpoints: Array<{ type: string; path: string; method: string }>;
  models: string[];
}

const TEMPLATES: Record<string, ProviderTemplate> = {
  cometapi: {
    name: "CometAPI",
    baseUrl: "https://api.cometapi.com",
    authHeader: "Authorization",
    authScheme: "bearer",
    protocol: "transparent",
    endpoints: [
      { type: "chat", path: "/v1/chat/completions", method: "POST" },
      { type: "models", path: "/v1/models", method: "GET" },
      { type: "embeddings", path: "/v1/embeddings", method: "POST" },
      { type: "images", path: "/v1/images/generations", method: "POST" },
      { type: "audio", path: "/v1/audio/speech", method: "POST" },
      { type: "moderation", path: "/v1/moderations", method: "POST" },
    ],
    // Wildcard: empty models list means accept any model name.
    // CometAPI supports hundreds of models — no need to enumerate them all.
    models: [],
  },

  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    authHeader: "Authorization",
    authScheme: "bearer",
    protocol: "transparent",
    endpoints: [
      { type: "chat", path: "/v1/chat/completions", method: "POST" },
      { type: "models", path: "/v1/models", method: "GET" },
      { type: "embeddings", path: "/v1/embeddings", method: "POST" },
      { type: "images", path: "/v1/images/generations", method: "POST" },
      { type: "audio", path: "/v1/audio/speech", method: "POST" },
      { type: "responses", path: "/v1/responses", method: "POST" },
      { type: "moderation", path: "/v1/moderations", method: "POST" },
    ],
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "o3",
      "o3-mini",
      "o4-mini",
    ],
  },

  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    authHeader: "x-api-key",
    authScheme: "x-api-key",
    protocol: "anthropic",
    endpoints: [
      { type: "chat", path: "/v1/messages", method: "POST" },
    ],
    models: [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-3-5-haiku-20241022",
    ],
  },

  glm: {
    name: "GLM (Zhipu AI)",
    baseUrl: "https://open.bigmodel.cn/api/paas",
    authHeader: "Authorization",
    authScheme: "bearer",
    protocol: "transparent",
    endpoints: [
      { type: "chat", path: "/v4/chat/completions", method: "POST" },
      { type: "models", path: "/v4/models", method: "GET" },
      { type: "embeddings", path: "/v4/embeddings", method: "POST" },
      { type: "images", path: "/v4/images/generations", method: "POST" },
    ],
    models: [
      "glm-4-plus",
      "glm-4-flash",
      "glm-4-air",
      "glm-4",
    ],
  },

  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    authHeader: "Authorization",
    authScheme: "bearer",
    protocol: "transparent",
    endpoints: [
      { type: "chat", path: "/chat/completions", method: "POST" },
      { type: "models", path: "/models", method: "GET" },
    ],
    models: [
      "deepseek-chat",
      "deepseek-reasoner",
    ],
  },

  google: {
    name: "Google Gemini (OpenAI-compatible)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    authHeader: "Authorization",
    authScheme: "bearer",
    protocol: "transparent",
    endpoints: [
      { type: "chat", path: "/chat/completions", method: "POST" },
      { type: "models", path: "/models", method: "GET" },
      { type: "embeddings", path: "/embeddings", method: "POST" },
    ],
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
    ],
  },

  // Generic custom provider — user provides everything
  custom: {
    name: "Custom Provider",
    baseUrl: "",
    authHeader: "Authorization",
    authScheme: "bearer",
    protocol: "transparent",
    endpoints: [
      { type: "chat", path: "/v1/chat/completions", method: "POST" },
      { type: "models", path: "/v1/models", method: "GET" },
    ],
    models: [],
  },
};

interface QuickSetupBody {
  /** Template key: "cometapi" | "openai" | "anthropic" | "glm" | "deepseek" | "google" | "custom" */
  template: string;
  /** The provider's API key (plaintext — will be encrypted) */
  apiKey: string;
  /** Optional: override the template's name */
  name?: string;
  /** Optional: override the template's baseUrl (required for "custom") */
  baseUrl?: string;
  /** Optional: override priority (higher = preferred) */
  priority?: number;
  /** Optional: additional API keys (for multi-key rotation) */
  additionalKeys?: string[];
}

/**
 * POST /api/providers/quick-setup
 *
 * One-shot provider creation with pre-configured endpoints and models.
 * Pass a template name ("cometapi", "openai", etc.) + an API key, and
 * the gateway sets up everything automatically.
 *
 * Returns:
 *   - The created provider with endpoints, models, and key count
 *   - A list of available template names (for the UI to show a dropdown)
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: QuickSetupBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const templateKey = (body.template || "").toLowerCase().trim();
  const template = TEMPLATES[templateKey];
  if (!template) {
    return Response.json(
      {
        error: `Unknown template "${body.template}". Available: ${Object.keys(TEMPLATES).join(", ")}`,
        availableTemplates: Object.keys(TEMPLATES),
      },
      { status: 400 }
    );
  }

  const apiKeyRaw = body.apiKey?.trim();
  if (!apiKeyRaw) {
    return Response.json({ error: "apiKey is required" }, { status: 400 });
  }

  const providerName = body.name?.trim() || template.name;
  const baseUrl = (body.baseUrl?.trim() || template.baseUrl).replace(/\/+$/, "");

  if (!baseUrl) {
    return Response.json(
      { error: "baseUrl is required (template 'custom' has no default baseUrl)" },
      { status: 400 }
    );
  }

  try {
    new URL(baseUrl);
  } catch {
    return Response.json({ error: "baseUrl must be a valid URL" }, { status: 400 });
  }

  // Collect all API keys (primary + additional)
  const allKeys = [apiKeyRaw];
  if (body.additionalKeys && Array.isArray(body.additionalKeys)) {
    for (const k of body.additionalKeys) {
      const trimmed = k?.trim();
      if (trimmed && !allKeys.includes(trimmed)) allKeys.push(trimmed);
    }
  }

  // Create the provider with endpoints, models, and API keys in one transaction
  const provider = await db.provider.create({
    data: {
      userId: user.id,
      name: providerName,
      baseUrl,
      authHeader: template.authHeader,
      authScheme: template.authScheme,
      protocol: template.protocol,
      priority: body.priority ?? 0,
      timeoutMs: 120000,
      isActive: true,
      endpoints: {
        create: template.endpoints.map((e) => ({
          type: e.type,
          path: e.path,
          method: e.method,
        })),
      },
      models:
        template.models.length > 0
          ? { create: template.models.map((m) => ({ name: m })) }
          : undefined,
      apiKeys: {
        create: allKeys.map((key, i) => ({
          name: i === 0 ? "Primary Key" : `Key ${i + 1}`,
          encryptedKey: encrypt(key),
          keyPreview: preview(key),
          isActive: true,
          status: "active",
        })),
      },
    },
    include: {
      endpoints: true,
      models: true,
      _count: { select: { apiKeys: true } },
    },
  });

  await audit({
    userId: user.id,
    action: "quick_setup_provider",
    entity: "provider",
    entityId: provider.id,
    details: {
      template: templateKey,
      name: providerName,
      baseUrl,
      keysCount: allKeys.length,
      endpointsCount: template.endpoints.length,
      modelsCount: template.models.length,
    },
    ipAddress: getClientIp(req),
  });
  invalidateUserCache(user.id);

  return Response.json(
    {
      provider,
      message: `تم إعداد مزود "${providerName}" بنجاح مع ${template.endpoints.length} endpoint و ${allKeys.length} مفتاح.`,
    },
    { status: 201 }
  );
}

/**
 * GET /api/providers/quick-setup
 *
 * Returns the list of available provider templates so the UI can show
 * a dropdown or quick-setup wizard.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const templates = Object.entries(TEMPLATES).map(([key, t]) => ({
    key,
    name: t.name,
    baseUrl: t.baseUrl,
    protocol: t.protocol,
    endpointTypes: t.endpoints.map((e) => e.type),
    modelsCount: t.models.length,
    isWildcard: t.models.length === 0,
  }));

  return Response.json({ templates });
}
