/**
 * Fake SSE streaming: converts a complete (non-streaming) response into
 * OpenAI-compatible Server-Sent Events so the client gets incremental chunks
 * even when the upstream provider doesn't support streaming or when protocol
 * translation forces stream=false.
 *
 * Used by:
 *  - Responses protocol (currently forces stream=false)
 *  - Any provider that returns a full response when the client wants streaming
 */

interface FakeStreamOptions {
  /** Full text content to stream */
  text: string;
  /** Model name for the chunk metadata */
  model: string;
  /** Completion ID */
  id?: string;
  /** Finish reason for the last chunk */
  finishReason?: string;
  /** Usage data to include in the final chunk */
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/**
 * Create a ReadableStream that emits OpenAI-compatible SSE chunks from a
 * complete text response. Words are emitted individually to simulate streaming.
 */
export function createFakeStream(opts: FakeStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const id = opts.id || `chatcmpl-${Date.now()}`;
  const model = opts.model || "unknown";
  const created = Math.floor(Date.now() / 1000);

  // Split text into word-level tokens (preserving whitespace)
  const tokens = opts.text.match(/\S+\s*/g) || [opts.text || ""];

  return new ReadableStream({
    async start(controller) {
      // Opening chunk with role
      const openChunk = {
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openChunk)}\n\n`));

      // Content chunks (one per word)
      for (const token of tokens) {
        const chunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }

      // Final chunk with finish_reason
      const finalChunk = {
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: {}, finish_reason: opts.finishReason || "stop" }],
        ...(opts.usage ? { usage: opts.usage } : {}),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
}

/**
 * Build SSE response headers for a fake stream.
 */
export function fakeStreamHeaders(extra?: Headers): Headers {
  const h = extra ? new Headers(extra) : new Headers();
  h.set("content-type", "text/event-stream");
  h.set("cache-control", "no-cache, no-transform");
  h.set("connection", "keep-alive");
  h.set("x-accel-buffering", "no");
  h.delete("content-length");
  h.delete("content-encoding");
  h.delete("transfer-encoding");
  return h;
}
