import { handleProxyRequest } from "./engine";
import { randomUUID } from "crypto";

/**
 * Shared proxy handler used by both mount points:
 *   /v1/[...path]        (OpenAI-compatible — base_url = https://domain/v1)
 *   /api/v1/[...path]    (legacy / explicit prefix)
 *
 * Both expose the same transparent reverse-proxy behaviour.
 */
export async function proxyHandler(req: Request): Promise<Response> {
  const requestId = randomUUID();

  // CORS preflight for API clients
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
        "access-control-allow-headers":
          "authorization, content-type, x-api-key, accept, anthropic-version, anthropic-beta, x-request-id, openai-organization, user-agent",
        "access-control-expose-headers":
          "x-request-id, x-gateway-provider, x-gateway-retries, openai-organization, openai-processing-ms",
        "access-control-max-age": "86400",
      },
    });
  }

  try {
    const res = await handleProxyRequest(req);
    // CORS + OpenAI-compatible response headers that tools like Roo Code,
    // Cline, and others expect.
    res.headers.set("access-control-allow-origin", "*");
    res.headers.set("access-control-expose-headers", "x-request-id, x-gateway-provider, x-gateway-retries");
    res.headers.set("x-request-id", requestId);
    // Some tools (Roo Code) check for this header to confirm the response
    // came from an OpenAI-compatible endpoint.
    if (!res.headers.has("openai-organization")) {
      res.headers.set("openai-organization", "gateway");
    }
    return res;
  } catch (err) {
    console.error("[proxy] fatal:", err);
    return Response.json(
      {
        error: {
          message: "Gateway internal error",
          type: "internal_error",
        },
      },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
          "access-control-allow-origin": "*",
        },
      }
    );
  }
}
