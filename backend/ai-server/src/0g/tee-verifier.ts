import { ethers } from 'ethers';

/**
 * TEE verification for 0G Compute responses.
 *
 * Two tiers exist per 0G docs (docs.0g.ai → Compute → Verifiable Execution):
 *
 *  1. Router-verified: sending `verify_tee: true` in the inference request makes the
 *     0G Router validate the provider's TEE signature and report `tee_verified` in the
 *     response's `x_0g_trace` block. Convenience only — the docs explicitly note you
 *     don't have to trust the Router's flag.
 *
 *  2. Independent (this module): `broker.inference.processResponse(providerAddress, chatId)`
 *     reads the provider's on-chain Service record (teeSignerAddress), fetches the response
 *     signature from `{provider}/v1/proxy/signature/{chatId}?model=...` and verifies it as
 *     EIP-191 personal_sign — no trust in the Router required. The call is read-only
 *     (chain read + provider HTTP endpoint), so an ephemeral random wallet is sufficient:
 *     no funds, no acknowledgeProviderSigner.
 *
 * The `chatId` comes from the `ZG-Res-Key` HTTP response header, falling back to the
 * completion id. With the OpenAI SDK in streaming mode the raw headers are reachable via
 * `stream.response.headers`.
 */

export type TeeStatus =
  | 'verified'       // signature cryptographically verified (independent)
  | 'unverified'     // could not verify (router claim only, error, or timeout)
  | 'failed'         // signature present but INVALID — treat response as untrusted
  | 'not-verifiable' // provider has no verifiable TEE service / missing inputs

export interface TeeVerificationResult {
  /** true = verified, false = signature check FAILED, null = could not determine */
  verified: boolean | null;
  status: TeeStatus;
  chatId?: string;
  providerAddress?: string;
  detail?: string;
}

type ComputeBroker = Awaited<ReturnType<typeof import('@0gfoundation/0g-compute-ts-sdk')['createZGComputeNetworkBroker']>>;

let brokerPromise: Promise<ComputeBroker> | null = null;

function getBroker(): Promise<ComputeBroker> {
  if (!brokerPromise) {
    brokerPromise = (async () => {
      // tsx's loader breaks the SDK's bundled ESM chunks (missing named exports), so the
      // SDK is loaded through Node's native CJS require, which handles it correctly.
      const { createRequire } = await import('node:module');
      const nodeRequire = createRequire(import.meta.url);
      const ethersMod = nodeRequire('ethers') as typeof ethers;
      const { createZGComputeNetworkBroker } = nodeRequire('@0gfoundation/0g-compute-ts-sdk') as {
        createZGComputeNetworkBroker: typeof import('@0gfoundation/0g-compute-ts-sdk')['createZGComputeNetworkBroker'];
      };
      const rpc = new ethersMod.JsonRpcProvider('https://evmrpc.0g.ai');
      // Ephemeral wallet: processResponse never transacts, it only reads chain state
      // and calls the provider's public signature endpoint.
      const wallet = new ethersMod.Wallet(ethersMod.Wallet.createRandom().privateKey, rpc);
      return createZGComputeNetworkBroker(wallet);
    })().catch(err => {
      brokerPromise = null; // allow retry on next call
      throw err;
    });
  }
  return brokerPromise;
}

/**
 * Pulls the chat id needed for verification out of raw response headers.
 * Accepts a fetch `Headers` instance or a plain header record; falls back to the
 * streaming chunk's completion id when the Router omits the header.
 */
export function extractChatId(rawHeaders: unknown, fallbackChunkId?: string): string | undefined {
  let headerValue: string | null | undefined;
  if (rawHeaders && typeof (rawHeaders as Headers).get === 'function') {
    headerValue = (rawHeaders as Headers).get('zg-res-key');
  } else if (rawHeaders && typeof rawHeaders === 'object') {
    const rec = rawHeaders as Record<string, string | string[] | undefined>;
    const found = rec['zg-res-key'] ?? rec['ZG-Res-Key'];
    headerValue = Array.isArray(found) ? found[0] : found;
  }
  return headerValue || fallbackChunkId || undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Independently verifies a 0G Compute response's TEE signature.
 * Maps the SDK's tri-state result onto TeeStatus:
 *   true  → 'verified'        false → 'failed'        null → 'not-verifiable'
 * Network/timeout errors map to 'unverified' (we simply could not confirm).
 */
export async function verifyTEEResponse(
  providerAddress: string | undefined,
  chatId: string | undefined,
  timeoutMs = 10_000,
): Promise<TeeVerificationResult> {
  if (!providerAddress || !chatId) {
    return {
      verified: null,
      status: 'not-verifiable',
      chatId,
      providerAddress,
      detail: 'Missing provider address or chat id — nothing to verify',
    };
  }

  try {
    const broker = await withTimeout(getBroker(), timeoutMs, 'Broker init');
    const result = await withTimeout(
      broker.inference.processResponse(providerAddress, chatId),
      timeoutMs,
      'TEE verification',
    );

    if (result === true) {
      console.log(`[TEE] Independently verified: provider=${providerAddress} chatId=${chatId}`);
      return { verified: true, status: 'verified', chatId, providerAddress };
    }
    if (result === false) {
      console.warn(`[TEE] VERIFICATION FAILED: provider=${providerAddress} chatId=${chatId}`);
      return {
        verified: false,
        status: 'failed',
        chatId,
        providerAddress,
        detail: 'TEE signature present but did not verify — treat this response as untrusted',
      };
    }
    console.log(`[TEE] Provider ${providerAddress} has no verifiable TEE service — skipped`);
    return {
      verified: null,
      status: 'not-verifiable',
      chatId,
      providerAddress,
      detail: 'Provider has no verifiable TEE service for this response',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TEE] Independent verification could not run: ${msg}`);
    return {
      verified: null,
      status: 'unverified',
      chatId,
      providerAddress,
      detail: `Independent verification could not run: ${msg}`,
    };
  }
}
