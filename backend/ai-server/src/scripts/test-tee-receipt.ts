import 'dotenv/config';
import { config } from '../config';
import { verifyTEEResponse } from '../0g/tee-verifier';

/**
 * Live smoke test for TEE signature receipt capture.
 *
 * Makes ONE small mainnet Router call with `verify_tee: true`, independently verifies
 * the response via the on-chain TEE signer, and asserts the signature receipt is
 * captured with real EIP-191 bytes whose recovered signer and content match.
 *
 * Usage: npx tsx src/scripts/test-tee-receipt.ts
 * Requires: OG_API_KEY in .env (mainnet Router key)
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;

async function main() {
  const provider = config.providers['0g'];
  if (!provider?.apiKey) {
    console.error('❌ OG_API_KEY missing in .env — cannot reach the 0G Router');
    process.exit(1);
  }

  console.log(`[smoke] Router: ${provider.baseUrl}, model: ${provider.model}`);
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      verify_tee: true,
    }),
  });

  if (!res.ok) {
    console.error(`❌ Router call failed: HTTP ${res.status} — ${await res.text().catch(() => '')}`);
    process.exit(1);
  }

  const chatId = res.headers.get('zg-res-key') || undefined;
  const data: any = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  const providerAddress: string | undefined = data.x_0g_trace?.provider;
  const requestId: string | undefined = data.x_0g_trace?.request_id;

  console.log(`[smoke] chatId (ZG-Res-Key): ${chatId || '(absent — falling back to completion id)'}`);
  console.log(`[smoke] provider: ${providerAddress}, request: ${requestId}`);
  console.log(`[smoke] content (${content.length} chars): ${content.slice(0, 120)}`);

  const tee = await verifyTEEResponse(providerAddress, chatId || data.id, {
    model: provider.model,
    expectedContent: content,
  });

  console.log('\n────────── result ──────────');
  console.log(`status:        ${tee.status}`);
  console.log(`detail:        ${tee.detail}`);
  if (tee.receipt) {
    console.log(`signature:     ${tee.receipt.signature.slice(0, 24)}... (${tee.receipt.signature.length} chars)`);
    console.log(`recoveredSigner: ${tee.receipt.recoveredSigner}`);
    console.log(`signedTextSha256:${tee.receipt.signedTextSha256}`);
    console.log(`signedTextFormat: ${tee.receipt.signedTextFormat}`);
    console.log(`contentMatched: ${tee.receipt.contentMatched}`);
    console.log(`model:         ${tee.receipt.model}`);
  } else {
    console.log('receipt:       (none captured)');
  }

  const failures: string[] = [];
  if (tee.status !== 'verified') failures.push(`expected status 'verified', got '${tee.status}'`);
  if (!tee.receipt) failures.push('expected a signature receipt');
  if (tee.receipt && !SIGNATURE_RE.test(tee.receipt.signature)) failures.push('receipt signature is not 0x + 130 hex');
  if (tee.receipt?.recoveredSigner && !ADDRESS_RE.test(tee.receipt.recoveredSigner)) failures.push('recoveredSigner is not a valid address');
  // digest-pair providers (current 0G mainnet) sign "<req-hash>:<res-hash>" — content
  // comparison is impossible client-side, so contentMatched is only asserted for 'plain'
  if (tee.receipt?.signedTextFormat === 'plain' && tee.receipt.contentMatched !== true) {
    failures.push(`plain signed text did not match received content (contentMatched=${tee.receipt.contentMatched})`);
  }

  if (failures.length > 0) {
    console.error('\n❌ SMOKE FAILED:');
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log('\n✅ SMOKE PASSED — receipt captured, signature recovers' +
    (tee.receipt?.signedTextFormat === 'plain' ? ', content matches' : ' (digest-pair format — content binding is provider-side)'));
}

main().catch(err => {
  console.error('❌ SMOKE ERROR:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
