import { describe, it, expect } from 'vitest';
import { Wallet } from 'ethers';
import { createHash } from 'node:crypto';
import { extractChatId, normalizeChatId, parseSignatureReceipt, mapTeeOutcome } from '../src/0g/tee-verifier';
import type { TeeSignatureReceipt } from '../src/0g/tee-verifier';

// Fixed key → deterministic signature across runs
const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const SIGNED_TEXT = '{"code":"result = box(10, 10, 10)","parameters":{}}';
let sig: string;

function makeReceipt(overrides: Partial<TeeSignatureReceipt> = {}): TeeSignatureReceipt {
  return {
    signature: sig,
    recoveredSigner: wallet.address,
    signedTextSha256: createHash('sha256').update(SIGNED_TEXT, 'utf8').digest('hex'),
    signedTextFormat: 'plain',
    contentMatched: true,
    ...overrides,
  };
}

beforeAll(async () => {
  sig = await wallet.signMessage(SIGNED_TEXT);
});

describe('extractChatId', () => {
  it('reads zg-res-key from a Headers-like object', () => {
    const headersLike = { get: (k: string) => (k === 'zg-res-key' ? 'chat-123' : null) };
    expect(extractChatId(headersLike)).toBe('chat-123');
  });

  it('reads from a plain record (lowercase and canonical case)', () => {
    expect(extractChatId({ 'zg-res-key': 'chat-abc' })).toBe('chat-abc');
    expect(extractChatId({ 'ZG-Res-Key': 'chat-xyz' })).toBe('chat-xyz');
  });

  it('takes the first value from array headers', () => {
    expect(extractChatId({ 'zg-res-key': ['first', 'second'] })).toBe('first');
  });

  it('falls back to the streaming chunk completion id', () => {
    expect(extractChatId({}, 'chunk-id')).toBe('chunk-id');
    expect(extractChatId(null, 'chunk-id')).toBe('chunk-id');
  });

  it('returns undefined when nothing is available', () => {
    expect(extractChatId({}, undefined)).toBeUndefined();
  });

  it('normalizes the chatcmpl- fallback to the provider chat id', () => {
    expect(extractChatId({}, 'chatcmpl-77c9e0e0-485b')).toBe('77c9e0e0-485b');
  });
});

describe('normalizeChatId', () => {
  it('strips the chatcmpl- prefix (providers key signatures by the bare uuid)', () => {
    expect(normalizeChatId('chatcmpl-77c9e0e0-485b-434d-b3ac-d7fa844fb0c4')).toBe('77c9e0e0-485b-434d-b3ac-d7fa844fb0c4');
  });

  it('leaves bare ids untouched', () => {
    expect(normalizeChatId('77c9e0e0-485b-434d-b3ac-d7fa844fb0c4')).toBe('77c9e0e0-485b-434d-b3ac-d7fa844fb0c4');
  });

  it('maps empty-ish input to undefined', () => {
    expect(normalizeChatId(undefined)).toBeUndefined();
    expect(normalizeChatId(null)).toBeUndefined();
    expect(normalizeChatId('')).toBeUndefined();
    expect(normalizeChatId('chatcmpl-')).toBeUndefined();
  });
});

describe('parseSignatureReceipt', () => {
  it('builds a full receipt from a valid payload', () => {
    const receipt = parseSignatureReceipt({ text: SIGNED_TEXT, signature: sig });
    expect(receipt).not.toBeNull();
    expect(receipt!.signature).toBe(sig);
    expect(receipt!.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
    expect(receipt!.recoveredSigner).toBe(wallet.address);
    expect(receipt!.signedTextSha256).toBe(createHash('sha256').update(SIGNED_TEXT, 'utf8').digest('hex'));
    expect(receipt!.signedTextFormat).toBe('plain');
    expect(receipt!.contentMatched).toBeUndefined();
  });

  it('sets contentMatched true/false against expectedContent for plain signed text', () => {
    expect(parseSignatureReceipt({ text: SIGNED_TEXT, signature: sig }, SIGNED_TEXT)!.contentMatched).toBe(true);
    expect(parseSignatureReceipt({ text: SIGNED_TEXT, signature: sig }, 'different content')!.contentMatched).toBe(false);
  });

  it('recognizes the current 0G digest-pair format and skips comparison', async () => {
    const digestPair = `${'ab'.repeat(32)}:${'cd'.repeat(32)}`;
    const sigForPair = await wallet.signMessage(digestPair);
    const receipt = parseSignatureReceipt({ text: digestPair, signature: sigForPair }, SIGNED_TEXT);
    expect(receipt).not.toBeNull();
    expect(receipt!.signedTextFormat).toBe('digest-pair');
    expect(receipt!.contentMatched).toBeUndefined();
  });

  it('recognizes extended digest formats (TeeML broker proxying a centralized upstream)', async () => {
    const extended = `${'ab'.repeat(32)}:${'cd'.repeat(32)}:centralized:aliyun:${'ef'.repeat(32)}`;
    const sigForExtended = await wallet.signMessage(extended);
    const receipt = parseSignatureReceipt({ text: extended, signature: sigForExtended }, SIGNED_TEXT);
    expect(receipt).not.toBeNull();
    expect(receipt!.signedTextFormat).toBe('digest-pair');
    expect(receipt!.contentMatched).toBeUndefined();
  });

  it('rejects malformed payloads', () => {
    expect(parseSignatureReceipt(null)).toBeNull();
    expect(parseSignatureReceipt(undefined)).toBeNull();
    expect(parseSignatureReceipt('nope')).toBeNull();
    expect(parseSignatureReceipt({ text: 42, signature: sig })).toBeNull();
    expect(parseSignatureReceipt({ text: SIGNED_TEXT, signature: '0x1234' })).toBeNull();
    expect(parseSignatureReceipt({ text: SIGNED_TEXT, signature: 'not-hex' })).toBeNull();
  });

  it('rejects a well-shaped signature that fails ECDSA recovery', () => {
    const garbage = '0x' + 'ab'.repeat(65);
    expect(parseSignatureReceipt({ text: SIGNED_TEXT, signature: garbage })).toBeNull();
  });
});

describe('mapTeeOutcome — status matrix', () => {
  it('processResponse=true + receipt (content matched) → verified', () => {
    const out = mapTeeOutcome(true, makeReceipt());
    expect(out.status).toBe('verified');
  });

  it('processResponse=true + receipt without comparison → verified', () => {
    const out = mapTeeOutcome(true, makeReceipt({ contentMatched: undefined }));
    expect(out.status).toBe('verified');
  });

  it('processResponse=true + signed text ≠ received content → failed (integrity violation)', () => {
    const out = mapTeeOutcome(true, makeReceipt({ contentMatched: false }));
    expect(out.status).toBe('failed');
    expect(out.detail).toMatch(/does not match/i);
  });

  it('processResponse=true + receipt fetch failed → still verified, never failed', () => {
    const out = mapTeeOutcome(true, null, { receiptFetchFailed: true });
    expect(out.status).toBe('verified');
  });

  it('processResponse=true + no receipt attempt → verified', () => {
    const out = mapTeeOutcome(true, null);
    expect(out.status).toBe('verified');
  });

  it('processResponse=false → failed regardless of receipt', () => {
    expect(mapTeeOutcome(false, null).status).toBe('failed');
    expect(mapTeeOutcome(false, makeReceipt()).status).toBe('failed');
  });

  it('processResponse=null + missing inputs → not-verifiable', () => {
    const out = mapTeeOutcome(null, null, { missingInputs: true });
    expect(out.status).toBe('not-verifiable');
    expect(out.detail).toMatch(/missing provider address or chat id/i);
  });

  it('processResponse=null → not-verifiable (never failed)', () => {
    expect(mapTeeOutcome(null, null).status).toBe('not-verifiable');
  });
});
