import { handleProxyRequest } from "@/lib/proxy/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transparent reverse-proxy endpoint.
 * Clients call /api/v1/<anything> with their master API key and the gateway
 * forwards the request to the matching provider — swapping only the auth
 * header — and streams the raw response back.
 *
 * Supports: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
 */
async function handler(req: Request) {
  // Quick reject for OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
        "access-control-allow-headers": "authorization, content-type, x-api-key, accept",
        "access-control-max-age": "86400",
      },
    });
  }

  try {
    const res = await handleProxyRequest(req);
    // Ensure CORS is allowed for API clients
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

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
};
