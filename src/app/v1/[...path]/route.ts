import { proxyHandler } from "@/lib/proxy/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Transparent reverse-proxy — OpenAI-compatible mount point: /v1/*
 *
 * Clients can use base_url = https://YOUR_DOMAIN/v1 and call any of:
 *   POST /v1/chat/completions
 *   POST /v1/chats
 *   POST /v1/ai/chat
 *   POST /v1/messages
 *   GET  /v1/models
 *   POST /v1/embeddings
 *   ...
 *
 * The gateway authenticates via the master API key (Authorization: Bearer …
 * or x-api-key) and forwards to the matching provider transparently.
 */
export {
  proxyHandler as GET,
  proxyHandler as POST,
  proxyHandler as PUT,
  proxyHandler as PATCH,
  proxyHandler as DELETE,
  proxyHandler as HEAD,
};
