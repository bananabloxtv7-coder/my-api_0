import { proxyHandler } from "@/lib/proxy/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transparent reverse-proxy — v0-safe mount point: /gw/v1/*
 *
 * This mount point bypasses Vercel's v0 platform intercepts that affect
 * /v1/* and /proxy/v1/* paths. Use this as the primary base_url on Vercel
 * deployments created via v0.dev:
 *
 *   base_url = https://YOUR_DOMAIN/gw/v1
 *
 *   POST /gw/v1/chat/completions
 *   POST /gw/v1/chats
 *   POST /gw/v1/img/generate
 *   POST /gw/v1/images/generations
 *   GET  /gw/v1/models
 *   ...
 */
export {
  proxyHandler as GET,
  proxyHandler as POST,
  proxyHandler as PUT,
  proxyHandler as PATCH,
  proxyHandler as DELETE,
  proxyHandler as HEAD,
};
