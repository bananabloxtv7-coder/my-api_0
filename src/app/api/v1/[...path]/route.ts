import { proxyHandler } from "@/lib/proxy/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Transparent reverse-proxy — legacy mount point: /api/v1/*
 * (the OpenAI-compatible /v1/* mount point lives in src/app/v1/[...path])
 */
export {
  proxyHandler as GET,
  proxyHandler as POST,
  proxyHandler as PUT,
  proxyHandler as PATCH,
  proxyHandler as DELETE,
  proxyHandler as HEAD,
};
