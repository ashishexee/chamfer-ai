/**
 * Throwaway probe: determine which `reasoning_effort` values each provider's
 * model actually accepts. Docs across providers disagree, so we ask the APIs.
 *
 * Usage:  npx tsx scripts/probe-reasoning.ts [providerId]
 */
import 'dotenv/config';
import { config } from '../src/config';

const LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'none', 'adaptive'];

interface ProbeResult {
  status: number;
  note: string;
}

async function probe(
  baseUrl: string,
  apiKey: string,
  model: string,
  level: string | null,
): Promise<ProbeResult> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 16,
  };
  if (level) body.reasoning_effort = level;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let note = '';
    if (!res.ok) {
      try {
        const j = JSON.parse(text);
        note = String(j?.error?.message ?? j?.message ?? text).slice(0, 170);
      } catch {
        note = text.slice(0, 170);
      }
    }
    return { status: res.status, note };
  } catch (e) {
    return { status: -1, note: (e as Error).message.slice(0, 170) };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function classify(r: ProbeResult): 'OK' | 'RATE' | 'FAIL' | 'ERR' {
  if (r.status === -1) return 'ERR';
  if (r.status >= 200 && r.status < 300) return 'OK';
  if (r.status === 429) return 'RATE';
  return 'FAIL';
}

async function main() {
  const only = process.argv[2];
  const entries = Object.entries(config.providers).filter(([id, p]) => {
    if (!p.apiKey) return false;
    if (only && id !== only) return false;
    return true;
  });

  console.log(`Probing ${entries.length} provider(s). Levels: ${LEVELS.join(', ')}\n`);

  const summary: Record<string, string[]> = {};
  const failures: Record<string, string> = {};

  for (const [id, p] of entries) {
    console.log(`\n=== ${id}  (${p.model})  ${p.baseUrl} ===`);

    const base = await probe(p.baseUrl, p.apiKey, p.model, null);
    console.log(`  baseline  ${classify(base)} ${base.status}${base.note ? ' — ' + base.note : ''}`);
    if (base.status === -1 || base.status === 429) {
      failures[id] = `baseline ${classify(base)} ${base.status}: ${base.note}`;
      summary[id] = [];
      console.log('  (baseline unusable — skipping level probes)');
      await sleep(500);
      continue;
    }
    await sleep(400);

    const accepted: string[] = [];
    for (const level of LEVELS) {
      const r = await probe(p.baseUrl, p.apiKey, p.model, level);
      const kind = classify(r);
      console.log(`  ${level.padEnd(9)} ${kind.padEnd(4)} ${r.status}${r.note ? ' — ' + r.note : ''}`);
      if (kind === 'OK') accepted.push(level);
      await sleep(500);
    }
    summary[id] = accepted;
  }

  console.log('\n\n========== SUMMARY: accepted levels ==========');
  for (const [id, levels] of Object.entries(summary)) {
    console.log(`${id.padEnd(28)} ${levels.length ? levels.join(', ') : '(none)'}`);
  }
  if (Object.keys(failures).length) {
    console.log('\n========== INCONCLUSIVE ==========');
    for (const [id, why] of Object.entries(failures)) console.log(`${id.padEnd(28)} ${why}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
