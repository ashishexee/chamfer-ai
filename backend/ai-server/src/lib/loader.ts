import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', 'skills', 'chamfer-cad');

// ─── File Readers ──────────────────────────────────────────────

function readSkillFile(filename: string): string {
  try {
    return fs.readFileSync(path.join(SKILLS_DIR, filename), 'utf-8');
  } catch (e) {
    console.error(`[SKILL] Failed to read ${filename}`);
    return '';
  }
}

function readLibFile(filename: string): string {
  try {
    return fs.readFileSync(path.join(__dirname, filename), 'utf-8');
  } catch (e) {
    console.error(`[LIB] Failed to read ${filename}`);
    return '';
  }
}

// ─── Available Files Catalog ────────────────────────────────────

export const ALL_REFERENCES = [
  'references/cadquery-api.md',
  'references/selectors.md',
  'references/holes-cuts.md',
  'references/transformations.md',
  'references/export-patterns.md',
  'references/error-recovery.md',
  'references/assembly-patterns.md',
  'references/free-function-api.md',
  'references/sketch-api.md',
  'references/parameter-system.md',
];

export const ALL_EXAMPLES = [
  'examples/basic-shapes.md',
  'examples/mechanical-parts.md',
  'examples/organic-shapes.md',
  'examples/assemblies.md',
];

// ─── Progressive Loading Functions ──────────────────────────────

/**
 * Phase 1: SKILL.md only — always loaded first.
 * The AI reads the routing catalog and decides what it needs.
 */
export function buildInitialPrompt(): string {
  return readSkillFile('SKILL.md');
}

/**
 * Phase 2+: Build prompt with loaded references.
 * Used after the AI requests specific files via context_needed.
 */
export function buildPromptWithRefs(loadedFiles: string[]): string {
  const skill = readSkillFile('SKILL.md');
  const refs = loadedFiles.map(f => readSkillFile(f)).filter(Boolean);
  
  if (refs.length === 0) return skill;
  
  return [
    skill,
    '\n\n--- LOADED REFERENCES ---\n\n',
    refs.join('\n\n---\n\n'),
  ].join('');
}

/**
 * Validate that requested files exist in the catalog.
 * Returns only valid files.
 */
export function validateRequestedFiles(files: string[]): string[] {
  return files.filter(f => {
    const valid = ALL_REFERENCES.includes(f) || ALL_EXAMPLES.includes(f);
    if (!valid) console.warn(`[SKILL] Invalid file request: ${f}`);
    return valid;
  });
}

// ─── Legacy Exports (backward compatibility) ────────────────────

/**
 * @deprecated Use buildInitialPrompt() for progressive loading.
 * Kept for backward compatibility with existing imports.
 */
export const FINAL_SYSTEM_PROMPT = buildInitialPrompt();

/**
 * Retry template for error corrections.
 */
export const RETRY_TEMPLATE = readLibFile('retry-user-message.txt');

/**
 * Clarifier prompt for ambiguous requests.
 */
export const CLARIFIER_PROMPT = readLibFile('clarifier-prompt.txt');
