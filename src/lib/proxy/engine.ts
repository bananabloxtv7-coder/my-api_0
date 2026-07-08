import { db } from "@/lib/db";
import { decrypt, sha256 } from "@/lib/crypto";
import { detectEndpointType, parseModel, safeParseJson, type EndpointType } from "./detect";
import { classifyResponse } from "./errors";
import {
  openaiToAnthropicRequest,
  anthropicToOpenAIResponse,
  anthropicStreamToOpenAI,
} from "./translate";

export interface ProxyResult {
  response: Response;
  meta: {
    providerId: string | null;
    providerKeyId: string | null;
    providerName: string | null;
    model: string | null;
    endpointType: EndpointType;
    retried: number;
    success: boolean;
  };
}

export interface ProxyError {
  status: number;
  message: string;
  meta: ProxyResult["meta"];
}

/** HTTP headers we never forward to the upstream provider. */
const STRIP_REQ_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-real-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "x-vercel-proxy-signed",
  "x-vercel-deployment-url",
  "x-vercel-id",
  "x-gateway-token", // our own
]);

/**
 * Main transparent proxy entrypoint.
 *
 * @param req the incoming client request
 * @returns a streamed Response, or throws ProxyError
 */
export async function handleProxyRequest(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname;

  // ── 1. Authenticate via master API key ────────────────────────────
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");
  let masterKeyRaw: string | null = null;
  if (authHeader && /bearer/i.test(authHeader)) {
    masterKeyRaw = authHeader.replace(/^bearer\s+/i, "").trim();
  } else if (authHeader) {
    masterKeyRaw = authHeader.trim();
  } else if (xApiKey) {
    masterKeyRaw = xApiKey.trim();
  }

  const meta: ProxyResult["meta"] = {
    providerId: null,
    providerKeyId: null,
    providerName: null,
    model: null,
    endpointType: "custom",
    retried: 0,
    success: false,
  };

  if (!masterKeyRaw) {
    return jsonError(401, "Missing API key. Send it via Authorization: Bearer <key> or x-api-key.", meta);
  }

  const masterKey = await db.masterApiKey.findUnique({
    where: { keyHash: sha256(masterKeyRaw) },
    include: { user: true },
  });
  if (!masterKey || !masterKey.isActive) {
    return jsonError(401, "Invalid or disabled API key.", meta);
  }

  const userId = masterKey.userId;

  // ── 2. Detect endpoint type ───────────────────────────────────────
  const detected = detectEndpointType(path);
  meta.endpointType = detected.type;

  // ── 3. Read & parse body (for model discovery) ────────────────────
  const bodyBuffer = method !== "GET" && method !== "HEAD" ? await req.arrayBuffer() : null;
  const bodyText = bodyBuffer ? new TextDecoder().decode(bodyBuffer) : "";
  const bodyJson = bodyText ? safeParseJson(bodyText) : null;
  const model = parseModel(bodyJson);
  meta.model = model;

  // ── 4. Discover candidate providers ───────────────────────────────
  const providers = await db.provider.findMany({
    where: {
      userId,
      isActive: true,
      endpoints: { some: { type: detected.type } },
      apiKeys: { some: { isActive: true } },
    },
    include: {
      endpoints: true,
      models: { where: { isActive: true } },
      apiKeys: {
        where: { isActive: true },
      },
    },
    orderBy: { priority: "desc" },
  });

  // Filter by model support: a provider matches if it has the model OR has no
  // models configured (wildcard provider).
  let candidates = providers;
  if (model) {
    candidates = providers.filter(
      (p) => p.models.length === 0 || p.models.some((m) => m.name === model)
    );
    // If no exact match, fall back to providers that explicitly list it OR wildcards
    // (already covered). If still empty, try all providers with this endpoint.
    if (candidates.length === 0) {
      candidates = providers;
    }
  }

  if (candidates.length === 0) {
    return jsonError(
      404,
      model
        ? `No provider available for model "${model}" on ${detected.type} endpoint.`
        : `No provider available for ${detected.type} endpoint.`,
      meta
    );
  }

  // ── 5. Iterate providers & keys (rotation + failover) ─────────────
  const now = Date.now();
  for (const provider of candidates) {
    const endpoint = provider.endpoints.find((e) => e.type === detected.type);
    if (!endpoint) continue;

    // Order keys: usable first (not in cooldown), least errors, oldest lastUsed
    const usableKeys = provider.apiKeys
      .filter(
        (k) =>
          k.isActive &&
          (k.status === "active" ||
            (k.cooldownUntil && k.cooldownUntil.getTime() < now))
      )
      .sort((a, b) => {
        const aErr = a.totalErrors;
        const bErr = b.totalErrors;
        if (aErr !== bErr) return aErr - bErr;
        const aUsed = a.lastUsedAt?.getTime() ?? 0;
        const bUsed = b.lastUsedAt?.getTime() ?? 0;
        return aUsed - bUsed; // least recently used first
      });

    if (usableKeys.length === 0) continue;

    for (const key of usableKeys) {
      meta.retried += 1;
      let decryptedKey: string;
      try {
        decryptedKey = decrypt(key.encryptedKey);
      } catch {
        await markKey(key, { action: "disable", reason: "decrypt_failed" });
        continue;
      }

      // Build target URL: provider baseUrl + endpoint path + original query
      const base = provider.baseUrl.replace(/\/+$/, "");
      const ep = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`;
      const target = new URL(base + ep);
      target.search = url.search;

      // Build forwarded headers (transparent, swap auth only)
      const fwdHeaders = new Headers();
      req.headers.forEach((value, name) => {
        if (!STRIP_REQ_HEADERS.has(name.toLowerCase())) {
          fwdHeaders.set(name, value);
        }
      });
      // Replace auth with the provider key
      fwdHeaders.delete("authorization");
      fwdHeaders.delete("x-api-key");
      if (provider.authScheme === "bearer" || provider.authScheme === "raw") {
        if (provider.authHeader.toLowerCase() === "authorization") {
          fwdHeaders.set(
            "Authorization",
            provider.authScheme === "bearer" ? `Bearer ${decryptedKey}` : decryptedKey
          );
        } else {
          fwdHeaders.set(provider.authHeader, decryptedKey);
        }
      } else if (provider.authScheme === "x-api-key") {
        fwdHeaders.set("x-api-key", decryptedKey);
      } else {
        fwdHeaders.set(provider.authHeader, decryptedKey);
      }

      const init: RequestInit = {
        method,
        headers: fwdHeaders,
        redirect: "follow",
      };

      // ── Protocol translation (optional) ──
      // If the provider speaks Anthropic Messages API, convert the client's
      // OpenAI-style body to Anthropic format before forwarding.
      const isAnthropicProvider = provider.protocol === "anthropic";
      if (bodyBuffer && method !== "GET" && method !== "HEAD") {
        if (isAnthropicProvider && bodyJson) {
          const translated = openaiToAnthropicRequest(bodyJson);
          init.body = JSON.stringify(translated);
          // Anthropic requires these headers
          if (!fwdHeaders.has("anthropic-version")) {
            fwdHeaders.set("anthropic-version", "2023-06-01");
          }
        } else {
          init.body = bodyBuffer;
        }
      }
      // Apply the provider's timeout so a hanging upstream doesn't block the
      // gateway forever (and so DNS failures fail fast instead of hanging).
      const timeoutMs = Math.min(Math.max(provider.timeoutMs || 120000, 5000), 300000);
      try {
        init.signal = AbortSignal.timeout(timeoutMs);
      } catch {
        // AbortSignal.timeout may be unavailable in very old runtimes; ignore.
      }

      let upstream: Response;
      try {
        upstream = await fetch(target.toString(), init);
      } catch (err) {
        // network error / timeout — provider down, try next key/provider
        const isTimeout =
          (err as Error).name === "TimeoutError" ||
          (err as Error).name === "AbortError";
        await markKey(key, {
          action: "error",
          reason: isTimeout
            ? `timeout_${timeoutMs}ms`
            : `network: ${(err as Error).message}`,
        });
        continue;
      }

      const status = upstream.status;

      // Success — stream the raw response back transparently
      if (status >= 200 && status < 300) {
        await markKey(key, { action: "ok", reason: "success" });
        meta.providerId = provider.id;
        meta.providerKeyId = key.id;
        meta.providerName = provider.name;
        meta.success = true;

        // Build a transparent passthrough response
        const respHeaders = new Headers(upstream.headers);
        respHeaders.delete("content-encoding"); // already decoded by fetch
        respHeaders.delete("content-length");
        respHeaders.delete("transfer-encoding");
        respHeaders.set("x-gateway-provider", provider.name);
        respHeaders.set("x-gateway-retries", String(meta.retried));

        await logRequest({
          userId,
          masterApiKeyId: masterKey.id,
          providerId: provider.id,
          providerKeyId: key.id,
          providerName: provider.name,
          model,
          endpointType: detected.type,
          method,
          path,
          statusCode: status,
          durationMs: Date.now() - startedAt,
          requestSize: bodyBuffer?.byteLength ?? 0,
          success: true,
          retried: meta.retried - 1,
        });
        await touchMasterKey(masterKey.id);

        // ── Protocol translation: convert Anthropic response → OpenAI ──
        if (isAnthropicProvider) {
          const isStream = /text\/event-stream/i.test(
            upstream.headers.get("content-type") || ""
          );
          if (isStream) {
            // Convert Anthropic SSE stream to OpenAI SSE stream
            const streamState = { model: model || "unknown", started: false };
            const transformed = translateAnthropicStream(upstream.body, streamState);
            respHeaders.set("content-type", "text/event-stream");
            respHeaders.set("cache-control", "no-cache");
            return new Response(transformed, {
              status,
              statusText: upstream.statusText,
              headers: respHeaders,
            });
          } else {
            // Non-streaming: translate JSON response
            const respText = await upstream.text();
            const respJson = safeParseJson(respText);
            const translated = anthropicToOpenAIResponse(respJson);
            return new Response(JSON.stringify(translated), {
              status,
              statusText: upstream.statusText,
              headers: respHeaders,
            });
          }
        }

        return new Response(upstream.body, {
          status,
          statusText: upstream.statusText,
          headers: respHeaders,
        });
      }

      // Error — read body for classification
      const errText = await upstream.text();
      const verdict = classifyResponse(status, errText);
      await markKey(key, { action: verdict.action, reason: verdict.reason, statusCode: status });

      // If it's a client error that isn't the key's fault, return it to the
      // client immediately (transparent behaviour — don't silently retry).
      if (verdict.action === "ignore") {
        meta.providerId = provider.id;
        meta.providerKeyId = key.id;
        meta.providerName = provider.name;
        await logRequest({
          userId,
          masterApiKeyId: masterKey.id,
          providerId: provider.id,
          providerKeyId: key.id,
          providerName: provider.name,
          model,
          endpointType: detected.type,
          method,
          path,
          statusCode: status,
          durationMs: Date.now() - startedAt,
          requestSize: bodyBuffer?.byteLength ?? 0,
          success: false,
          retried: meta.retried - 1,
          error: `client_${status}`,
        });
        await touchMasterKey(masterKey.id);
        return new Response(errText, {
          status,
          statusText: upstream.statusText,
          headers: cleanRespHeaders(upstream.headers),
        });
      }

      // Otherwise rotate to next key / provider
      continue;
    }
  }

  // ── 6. All keys/providers exhausted ───────────────────────────────
  await logRequest({
    userId,
    masterApiKeyId: masterKey.id,
    providerId: meta.providerId,
    providerKeyId: meta.providerKeyId,
    providerName: meta.providerName,
    model,
    endpointType: detected.type,
    method,
    path,
    statusCode: 502,
    durationMs: Date.now() - startedAt,
    requestSize: bodyBuffer?.byteLength ?? 0,
    success: false,
    retried: meta.retried,
    error: "all_keys_exhausted",
  });
  await touchMasterKey(masterKey.id);
  return jsonError(
    502,
    `All provider keys exhausted for ${detected.type}${model ? ` / ${model}` : ""}. ${meta.retried} attempt(s) made.`,
    meta
  );
}

// ───────────────────────── helpers ─────────────────────────

/**
 * Transform an Anthropic SSE stream into an OpenAI-compatible SSE stream.
 * Parses each `event:` / `data:` pair and re-emits OpenAI-style chunks.
 */
function translateAnthropicStream(
  body: ReadableStream<Uint8Array> | null,
  state: { model: string; started: boolean }
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      if (!body) {
        controller.close();
        return;
      }
      const reader = body.getReader();
      let buffer = "";
      let currentEvent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            let evt = "";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) evt = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
            }
            if (!evt && !dataStr) continue;
            let data: unknown = null;
            if (dataStr) {
              try {
                data = JSON.parse(dataStr);
              } catch {
                data = dataStr;
              }
            }
            const chunk = anthropicStreamToOpenAI(evt, data, state);
            if (chunk) {
              controller.enqueue(encoder.encode(chunk));
            }
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();
    },
  });
}

function jsonError(status: number, message: string, meta: ProxyResult["meta"]): Response {
  return Response.json(
    { error: { message, type: "gateway_error", meta } },
    { status }
  );
}

function cleanRespHeaders(h: Headers): Headers {
  const out = new Headers(h);
  out.delete("content-encoding");
  out.delete("content-length");
  out.delete("transfer-encoding");
  return out;
}

interface KeyRef {
  id: string;
}

/** Update a provider key's health state based on the classification action. */
async function markKey(
  key: KeyRef,
  opts: { action: string; reason: string; statusCode?: number }
): Promise<void> {
  const now = new Date();
  const data: Record<string, unknown> = {
    lastUsedAt: now,
    lastErrorAt: now,
  };

  switch (opts.action) {
    case "ok":
      data.status = "active";
      data.cooldownUntil = null;
      data.totalSuccess = { increment: 1 };
      data.totalRequests = { increment: 1 };
      data.lastError = null;
      break;
    case "disable":
      data.status = "disabled";
      data.isActive = false;
      data.totalErrors = { increment: 1 };
      data.totalRequests = { increment: 1 };
      data.lastError = opts.reason;
      break;
    case "cooldown":
      data.status = "rate_limited";
      data.cooldownUntil = new Date(
        now.getTime() +
          (opts.reason.includes("quota") ||
          opts.reason.includes("billing") ||
          opts.reason.includes("daily")
            ? 6 * 60 * 60 * 1000
            : 60 * 1000)
      );
      data.totalErrors = { increment: 1 };
      data.totalRequests = { increment: 1 };
      data.lastError = opts.reason;
      break;
    case "error":
      data.status = "error";
      data.totalErrors = { increment: 1 };
      data.totalRequests = { increment: 1 };
      data.lastError = opts.reason;
      data.cooldownUntil = new Date(now.getTime() + 5_000);
      break;
    default:
      data.totalRequests = { increment: 1 };
  }

  try {
    await db.providerApiKey.update({ where: { id: key.id }, data });
    await db.keyHealthLog.create({
      data: {
        providerKeyId: key.id,
        event: opts.action,
        statusCode: opts.statusCode ?? null,
        message: opts.reason,
      },
    });
  } catch {
    // best-effort
  }
}

/** Touch the master key's lastUsedAt. */
async function touchMasterKey(id: string): Promise<void> {
  try {
    await db.masterApiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // best-effort
  }
}

/** Persist a request log entry. Best-effort. */
async function logRequest(opts: {
  userId: string;
  masterApiKeyId: string;
  providerId: string | null;
  providerKeyId: string | null;
  providerName: string | null;
  model: string | null;
  endpointType: EndpointType;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number;
  requestSize: number;
  success: boolean;
  retried: number;
  error?: string;
}): Promise<void> {
  try {
    await db.requestLog.create({
      data: {
        userId: opts.userId,
        masterApiKeyId: opts.masterApiKeyId,
        providerId: opts.providerId,
        providerKeyId: opts.providerKeyId,
        providerName: opts.providerName,
        model: opts.model,
        endpointType: opts.endpointType,
        method: opts.method,
        path: opts.path,
        statusCode: opts.statusCode,
        durationMs: opts.durationMs,
        requestSize: opts.requestSize,
        success: opts.success,
        retried: opts.retried,
        error: opts.error ?? null,
      },
    });
  } catch {
    // best-effort
  }
}
