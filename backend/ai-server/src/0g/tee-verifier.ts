import { ethers } from 'ethers';
import { createHash } from 'node:crypto';

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
 * On top of the SDK verdict, this module captures a SIGNATURE RECEIPT: the raw signature
 * bytes the SDK verifies internally but discards. The receipt is what makes a "TEE
 * Verified" claim independently checkable by anyone:
 *   recover = ethers.verifyMessage(signedText, signature)  → must equal the provider's
 *   on-chain teeSignerAddress; sha256(signedText) must match the receipt.
 *
 * It also adds a content-integrity check the SDK does not perform: when the provider
 * signs the PLAIN response text, the signed text is compared against the content we
 * received (docs' manual step 4) — a mismatch is 'failed'. NOTE: current 0G providers
 * instead sign a "<request-hash>:<response-hash>" digest pair, which is recognized and
 * reported as signedTextFormat 'digest-pair' with no plaintext comparison possible.
 *
 * The `chatId` comes from the `ZG-Res-Key` HTTP response header when available, falling
 * back to the completion id. (openai-node's streaming `Stream` exposes no raw response
 * headers, so in practice the completion id is the working source.)
 *
 * Status semantics — 'failed' is reserved for cryptographic mismatch ONLY (SDK verdict
 * false, or a comparable plain signed-text mismatch). A missing or unfetchable receipt
 * never downgrades a proven verdict ('verified' stands), and never escalates to 'failed'
 * (absence of evidence ≠ evidence of tampering).
 */

/** Raw evidence that a TEE-signed response was independently verified. */
export interface TeeSignatureReceipt {
  /** EIP-191 personal_sign signature bytes: 0x + 130 hex chars (65-byte r,s,v) */
  signature: string;
  /** address recovered from the signature — compare against the provider's on-chain TEE signer */
  recoveredSigner?: string;
  /** sha256 of the exact signed text (unique evidence tie-breaker, even when not comparable) */
  signedTextSha256: string;
  /**
   * What the provider signed: 'plain' = the raw response text (comparable against
   * received content); 'digest-pair' = "<request-hash>:<response-hash>" — the current
   * 0G provider format. The content binding happens provider-side and cannot be
   * recomputed from outside, so no plaintext comparison is possible.
   */
  signedTextFormat: 'plain' | 'digest-pair';
  /**
   * true = signed text equals received content · false = signed plain text DIFFERS from
   * received content (integrity violation) · undefined = digest-pair format, not comparable
   */
  contentMatched?: boolean;
  /** the model id that served the request */
  model?: string;
  /** provider proxy endpoint (service.url + '/v1/proxy') — lets anyone re-fetch the signature */
  providerEndpoint?: string;
}

export type TeeStatus =
  | 'verified'       // signature cryptographically verified (independent)
  | 'unverified'     // could not verify (router claim only, error, or timeout)
  | 'failed'         // signature present but INVALID (or signed text ≠ received content) — treat response as untrusted
  | 'not-verifiable' // provider has no verifiable TEE service / missing inputs

export interface TeeVerificationResult {
  /** true = verified, false = signature check FAILED, null = could not determine */
  verified: boolean | null;
  status: TeeStatus;
  chatId?: string;
  providerAddress?: string;
  detail?: string;
  /** captured when the provider's signature endpoint responded and the bytes parse */
  receipt?: TeeSignatureReceipt;
}

export interface VerifyTeeOptions {
  /** model id that served the request — appended to the signature endpoint query */
  model?: string;
  /** the exact content we received from the Router; enables the signed-text match check */
  expectedContent?: string;
  timeoutMs?: number;
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
 * The Router's completion id is 'chatcmpl-<uuid>' but providers key signatures by the
 * bare uuid (the ZG-Res-Key value). openai-node's streaming Stream object exposes no
 * `.response` in the installed version, so the header is usually unavailable and the
 * fallback id must be normalized before use.
 */
export function normalizeChatId(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const stripped = raw.startsWith('chatcmpl-') ? raw.slice('chatcmpl-'.length) : raw;
  return stripped || undefined;
}

/**
 * Pulls the chat id needed for verification out of raw response headers.
 * Accepts a fetch `Headers` instance or a plain header record; falls back to the
 * streaming chunk's completion id (normalized) when the Router omits the header.
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
  return normalizeChatId(headerValue || fallbackChunkId);
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

/** EIP-191 personal_sign signatures are 65 bytes: r(32) + s(32) + v(1). */
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;

/**
 * Providers sign a hash-pair instead of the raw response text (the docs' "confirm
 * signed text matches response content" step is outdated for these providers). Base
 * format: "<sha256(request)>:<sha256(response)>". TeeML brokers that proxy to a
 * centralized upstream append further segments, e.g.
 * "<req-hash>:<res-hash>:centralized:aliyun:<hash>". The hashes cover broker-internal
 * serializations, so they cannot be recomputed client-side — we only recognize that
 * the text is NOT comparable plaintext.
 */
const DIGEST_PAIR_RE = /^[0-9a-fA-F]{64}:[0-9a-fA-F]{64}(?::|$)/;

/**
 * Pure: validate a provider signature-endpoint payload `{text, signature}` and build a
 * receipt. Returns null for anything that is not a well-formed, recoverable signature —
 * a malformed payload must never surface as evidence.
 *
 * contentMatched semantics (the only path to 'failed' besides the SDK verdict):
 *   plain text + equals expectedContent      → true
 *   plain text + differs from expectedContent → false  (integrity violation)
 *   digest-pair format                        → undefined (not comparable — never fails)
 */
export function parseSignatureReceipt(
  payload: unknown,
  expectedContent?: string,
): TeeSignatureReceipt | null {
  if (!payload || typeof payload !== 'object') return null;
  const { text, signature } = payload as { text?: unknown; signature?: unknown };
  if (typeof text !== 'string' || typeof signature !== 'string') return null;
  if (!SIGNATURE_RE.test(signature)) return null;

  let recoveredSigner: string;
  try {
    recoveredSigner = ethers.verifyMessage(text, signature);
  } catch {
    return null; // right shape, invalid ECDSA bytes — not evidence
  }

  const isDigestPair = DIGEST_PAIR_RE.test(text);
  const receipt: TeeSignatureReceipt = {
    signature,
    recoveredSigner,
    signedTextSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    signedTextFormat: isDigestPair ? 'digest-pair' : 'plain',
  };
  if (expectedContent !== undefined && !isDigestPair) {
    receipt.contentMatched = text === expectedContent;
  }
  return receipt;
}

/**
 * Pure: map the SDK verdict + receipt availability onto a TeeStatus.
 * 'failed' is reachable only through cryptographic mismatch (processResponse false, or
 * signed text ≠ expected content). Everything else degrades, never escalates.
 */
export function mapTeeOutcome(
  processResult: boolean | null,
  receipt: TeeSignatureReceipt | null,
  opts: { receiptFetchFailed?: boolean; missingInputs?: boolean } = {},
): { status: TeeStatus; detail: string } {
  if (processResult === true) {
    if (receipt && receipt.contentMatched === false) {
      return {
        status: 'failed',
        detail: 'Signed text does not match the received content — response integrity cannot be trusted',
      };
    }
    if (receipt) {
      return { status: 'verified', detail: 'TEE signature verified independently; signature receipt captured' };
    }
    if (opts.receiptFetchFailed) {
      return {
        status: 'verified',
        detail: 'TEE signature verified independently, but the signature receipt could not be fetched',
      };
    }
    return { status: 'verified', detail: 'TEE signature verified independently' };
  }
  if (processResult === false) {
    return {
      status: 'failed',
      detail: 'TEE signature present but did not verify — treat this response as untrusted',
    };
  }
  if (opts.missingInputs) {
    return { status: 'not-verifiable', detail: 'Missing provider address or chat id — nothing to verify' };
  }
  return { status: 'not-verifiable', detail: 'Provider has no verifiable TEE service for this response' };
}

/**
 * Fetch the raw signature receipt from the provider's public endpoint.
 * Returns null on ANY failure (404/purged signature, timeout, bad payload) — callers
 * treat null as "no evidence available", never as a verification failure.
 */
async function fetchSignatureReceipt(
  providerAddress: string,
  chatId: string,
  model: string | undefined,
  expectedContent: string | undefined,
  timeoutMs: number,
): Promise<TeeSignatureReceipt | null> {
  const broker = await getBroker();
  // Endpoint resolution only — omit the model so single/multi-model providers both resolve.
  const { endpoint } = await withTimeout(
    broker.inference.getServiceMetadata(providerAddress),
    timeoutMs,
    'Provider metadata',
  );
  // endpoint is the proxy base (service.url + '/v1/proxy', per SDK request.js) —
  // the signature route hangs directly off it, NOT another '/v1/proxy' segment.
  const url = `${endpoint.replace(/\/+$/, '')}/signature/${encodeURIComponent(chatId)}` +
    (model ? `?model=${encodeURIComponent(model)}` : '');
  const res = await withTimeout(fetch(url), timeoutMs, 'Signature receipt fetch');
  if (!res.ok) return null;
  const payload: unknown = await res.json().catch(() => null);
  const receipt = parseSignatureReceipt(payload, expectedContent);
  if (receipt) receipt.providerEndpoint = endpoint;
  return receipt;
}

/**
 * Independently verifies a 0G Compute response's TEE signature and captures the
 * signature receipt. Maps the SDK's tri-state result onto TeeStatus:
 *   true  → 'verified' (+'failed' if signed text ≠ expectedContent)
 *   false → 'failed'            null → 'not-verifiable'
 * Network/timeout errors map to 'unverified' (we simply could not confirm).
 */
export async function verifyTEEResponse(
  providerAddress: string | undefined,
  chatId: string | undefined,
  opts: VerifyTeeOptions = {},
): Promise<TeeVerificationResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const normalizedChatId = normalizeChatId(chatId);

  if (!providerAddress || !normalizedChatId) {
    const outcome = mapTeeOutcome(null, null, { missingInputs: true });
    return {
      verified: null,
      status: outcome.status,
      chatId: normalizedChatId,
      providerAddress,
      detail: outcome.detail,
    };
  }

  try {
    const broker = await withTimeout(getBroker(), timeoutMs, 'Broker init');
    const result = await withTimeout(
      broker.inference.processResponse(providerAddress, normalizedChatId),
      timeoutMs,
      'TEE verification',
    );

    let receipt: TeeSignatureReceipt | null = null;
    let receiptFetchFailed = false;
    if (result === true) {
      try {
        receipt = await fetchSignatureReceipt(providerAddress, normalizedChatId, opts.model, opts.expectedContent, timeoutMs);
        receiptFetchFailed = receipt === null;
      } catch (err) {
        console.warn(`[TEE] Signature receipt fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        receipt = null;
        receiptFetchFailed = true;
      }
    }

    const outcome = mapTeeOutcome(result, receipt, { receiptFetchFailed });

    if (outcome.status === 'verified') {
      console.log(`[TEE] Independently verified: provider=${providerAddress} chatId=${normalizedChatId}` +
        (receipt ? ` signer=${receipt.recoveredSigner} receipt=ok` : ' (no receipt)'));
    } else if (outcome.status === 'failed') {
      console.warn(`[TEE] VERIFICATION FAILED: provider=${providerAddress} chatId=${normalizedChatId} — ${outcome.detail}`);
    } else {
      console.log(`[TEE] Provider ${providerAddress} has no verifiable TEE service — skipped`);
    }

    return {
      verified: outcome.status === 'verified' ? true : outcome.status === 'failed' ? false : null,
      status: outcome.status,
      chatId: normalizedChatId,
      providerAddress,
      detail: outcome.detail,
      ...(receipt ? { receipt: { ...receipt, model: opts.model } } : {}),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TEE] Independent verification could not run: ${msg}`);
    return {
      verified: null,
      status: 'unverified',
      chatId: normalizedChatId,
      providerAddress,
      detail: `Independent verification could not run: ${msg}`,
    };
  }
}
