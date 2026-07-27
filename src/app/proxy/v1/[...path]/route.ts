import { proxyHandler } from "@/lib/proxy/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Transparent reverse-proxy — alternative mount point: /proxy/v1/*
 *
 * Use this when the Vercel deployment platform intercepts /v1/* paths
 * (e.g. v0.dev deployments route /v1/* to their own backend).
 * Clients can set base_url = https://YOUR_DOMAIN/proxy/v1
 *
 *   POST /proxy/v1/chat/completions
 *   POST /proxy/v1/chats
 *   POST /proxy/v1/images/generations
 *   GET  /proxy/v1/models
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
