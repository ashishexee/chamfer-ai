import { Agent } from 'undici';
import { config } from '../config';

let providerDispatcher: Agent | undefined;

/**
 * Shared undici dispatcher with raised idle ceilings.
 *
 * Node's global fetch (undici) defaults to a 300s bodyTimeout, which silently
 * cuts connections to providers that think for longer (e.g. Muse Spark keeps
 * its reasoning server-side and streams nothing while it works). The ceiling
 * stays finite — heartbeats keep the browser attached, so an infinite timeout
 * would let a genuinely dead provider hang the request forever.
 */
export function getProviderDispatcher(): Agent {
  if (!providerDispatcher) {
    providerDispatcher = new Agent({
      headersTimeout: config.providerHeadersTimeoutMs,
      bodyTimeout: config.providerBodyTimeoutMs,
    });
  }
  return providerDispatcher;
}

/**
 * First-byte watchdog for streaming calls: aborts if the provider sends no
 * response at all within the window. Distinguishes "wedged endpoint" from
 * "slow but alive" — disarm it as soon as the first chunk arrives.
 */
export function startFirstByteWatchdog(timeoutMs: number) {
  const controller = new AbortController();
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    controller.abort();
  }, timeoutMs);
  timer.unref?.();
  return {
    signal: controller.signal,
    fired: () => fired,
    disarm: () => clearTimeout(timer),
  };
}

export function isAbortError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'APIUserAbortError' || name === 'AbortError' || name === 'TimeoutError';
}

export function isProviderTimeout(err: unknown): boolean {
  const codes = ['UND_ERR_BODY_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'];
  const e = err as { code?: string; cause?: { code?: string }; name?: string } | null;
  return (
    codes.includes(e?.code ?? '') ||
    codes.includes(e?.cause?.code ?? '') ||
    e?.name === 'BodyTimeoutError' ||
    e?.name === 'HeadersTimeoutError'
  );
}
