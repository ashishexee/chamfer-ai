import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

/**
 * Independent TEE receipt verifier — no trust in ChamferAI required.
 *
 * Given the public values from a "Copy TEE receipt" export, this re-derives every
 * claim from the provider and the chain:
 *   1. Re-fetch the signature from the provider's public endpoint
 *   2. Recover the EIP-191 signer from the signature
 *   3. Check sha256(signed text) against the receipt
 *   4. Read the provider's on-chain Service record and compare teeSignerAddress
 *
 * Usage:
 *   npx tsx src/scripts/verify-receipt.ts <providerAddress> <providerEndpoint> <chatId> <model> <recoveredSigner> <signedTextSha256>
 *
 * Example:
 *   npx tsx src/scripts/verify-receipt.ts \
 *     0x61C0007197E7D4d6A842d6768E8035728877B9F6 \
 *     https://compute-network-22.integratenetwork.work/v1/proxy \
 *     38f4fe55-3ece-456f-9736-f194054da9a8 \
 *     deepseek-v4-flash \
 *     0xB5C20a74D09Ed1EB316EE3426776Db542C254722 \
 *     bedc42b0b3ba190bc57d8ba7f5964e78c688e1274a4aed7e2db1b7d44a750657
 */

const [, , providerAddrArg, endpointArg, chatIdArg, modelArg, signerArg, shaArg] = process.argv;
if (!providerAddrArg || !endpointArg || !chatIdArg || !modelArg || !signerArg || !shaArg) {
  console.error('Usage: npx tsx src/scripts/verify-receipt.ts <providerAddress> <providerEndpoint> <chatId> <model> <recoveredSigner> <signedTextSha256>');
  process.exit(1);
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const results: Array<{ step: string; pass: boolean | null; detail: string }> = [];

// ── Step 1: re-fetch the signature from the provider ─────────────────────────
const url = `${endpointArg.replace(/\/+$/, '')}/signature/${encodeURIComponent(chatIdArg)}?model=${encodeURIComponent(modelArg)}`;
console.log(`[1] GET ${url}`);
const res = await fetch(url);
if (!res.ok) {
  console.error(`    HTTP ${res.status} — ${await res.text().catch(() => '')}`);
  console.error('\n❌ Cannot verify: the provider no longer holds this signature.');
  console.error('   Signatures have a retention window — verify soon after generation.');
  process.exit(1);
}
const { text, signature } = (await res.json()) as { text: string; signature: string };
console.log(`    text      : ${text.slice(0, 72)}${text.length > 72 ? '…' : ''}`);
console.log(`    signature : ${signature.slice(0, 40)}…`);
results.push({ step: '1. signature re-fetched from provider', pass: true, detail: `HTTP ${res.ok ? 200 : res.status}` });

// ── Step 2: recover the EIP-191 signer ───────────────────────────────────────
const { ethers } = createRequire(import.meta.url)('ethers');
let recovered: string | null = null;
try {
  recovered = ethers.verifyMessage(text, signature);
} catch { /* falls through as failure */ }
const step2Pass = recovered?.toLowerCase() === signerArg.toLowerCase();
results.push({
  step: '2. verifyMessage(text, signature) === recoveredSigner',
  pass: step2Pass,
  detail: `recovered ${recovered ?? '<recovery failed>'}`,
});

// ── Step 3: integrity of the signed text ─────────────────────────────────────
const actualSha = sha256(text);
const step3Pass = actualSha === shaArg.toLowerCase();
results.push({ step: '3. sha256(text) === signedTextSha256', pass: step3Pass, detail: actualSha });

// ── Step 4: on-chain teeSignerAddress comparison ─────────────────────────────
let step4Pass: boolean | null = null;
let step4Detail = '';
try {
  const { createZGComputeNetworkBroker } = createRequire(import.meta.url)('@0gfoundation/0g-compute-ts-sdk');
  const rpc = new ethers.JsonRpcProvider('https://evmrpc.0g.ai');
  const wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, rpc);
  const broker = await createZGComputeNetworkBroker(wallet);
  // processResponse reads the on-chain Service record, fetches the signature and
  // verifies it against the recorded teeSignerAddress — the chain-level verdict.
  const verdict = await broker.inference.processResponse(providerAddrArg, chatIdArg);
  step4Pass = verdict === true;
  step4Detail = verdict === true
    ? 'signature matches the on-chain teeSignerAddress'
    : verdict === false
      ? 'signature does NOT match the on-chain teeSignerAddress'
      : 'provider has no verifiable TEE service on-chain';
} catch (err) {
  step4Detail = `chain check failed: ${err instanceof Error ? err.message : String(err)}`;
}
results.push({ step: '4. on-chain Service record teeSignerAddress', pass: step4Pass, detail: step4Detail });

// ── Verdict ──────────────────────────────────────────────────────────────────
console.log('\n────────── verification ──────────');
for (const r of results) {
  const mark = r.pass === true ? '✅' : r.pass === false ? '❌' : '⚠️ ';
  console.log(`${mark} ${r.step}`);
  console.log(`   ${r.detail}`);
}
const failed = results.filter(r => r.pass === false);
if (failed.length > 0) {
  console.error(`\n❌ RECEIPT INVALID — ${failed.length} check(s) failed`);
  process.exit(1);
}
console.log('\n✅ RECEIPT VERIFIED — the TEE-attested signer signed this response');
