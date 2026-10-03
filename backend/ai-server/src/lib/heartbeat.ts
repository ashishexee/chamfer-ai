import type { Response } from 'express';

/**
 * Keeps an SSE connection alive while the model thinks silently.
 *
 * Emits SSE comments (`: ping`) on an interval. Comment lines are ignored by
 * standard SSE parsers (including the frontend's, which only acts on lines
 * starting `event:` / `data:`), so they are pure liveness traffic that keeps
 * proxy idle timers (nginx `proxy_read_timeout`) and the browser from seeing
 * the stream as dead during long reasoning phases with no streamed output.
 *
 * The timer self-clears on `res` 'close' (client disconnect) and 'finish'
 * (res.end), so it cannot leak even if an early return or an uncaught throw
 * happens between `res.writeHead` and the surrounding try/catch.
 */
export function startHeartbeat(res: Response, intervalMs: number): () => void {
  const timer = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) {
      res.write(': ping\n\n');
    }
  }, intervalMs);
  // Don't keep the event loop alive just for the heartbeat.
  timer.unref?.();

  const stop = () => clearInterval(timer);
  res.on('close', stop);
  res.on('finish', stop);
  return stop;
}
