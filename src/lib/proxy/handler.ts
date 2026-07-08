import { handleProxyRequest } from "./engine";

/**
 * Shared proxy handler used by both mount points:
 *   /v1/[...path]        (OpenAI-compatible — base_url = https://domain/v1)
 *   /api/v1/[...path]    (legacy / explicit prefix)
 *
 * Both expose the same transparent reverse-proxy behaviour.
 */
export async function proxyHandler(req: Request): Promise<Response> {
  // CORS preflight for API clients
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
        "access-control-allow-headers":
          "authorization, content-type, x-api-key, accept",
        "access-control-max-age": "86400",
      },
    });
  }

  try {
    const res = await handleProxyRequest(req);
    res.headers.set("access-control-allow-origin", "*");
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
      { status: 500 }
    );
  }
}
