/**
 * PR7 — banned clinical-language scanner.
 *
 * Walks a fixed set of clinician-facing surfaces and fails if any of them
 * introduce phrasing that implies a clinical claim we have not earned
 * ("mastered", "generalized", "validated", etc.) outside an allowed
 * hedged context ("generalization probe attempt", "mastery confidence",
 * "clinically motivated calibration", ...).
 *
 * Scope is deliberate — we scan the surfaces a clinician would screenshare,
 * not the entire repo. Architecture docs and engine-internal modules can
 * still use precise technical terms.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scanForBannedPhrases } from '@/lib/clinicalIntegrity';

const ROOT = resolve(__dirname, '../../..');

const SCAN_FILES = [
  'src/lib/clinicalLadderRegistry.ts',
  // NOTE: src/lib/clinicalIntegrity.ts intentionally excluded — it defines
  // BANNED_PHRASES as data and would self-flag.
  'src/lib/progression/photoNamingLevels.ts',
  'src/lib/progression/fixSentenceLevels.ts',
  'src/lib/progression/minimalPairsLevels.ts',
  'src/lib/progression/photoNamingContentSelector.ts',
  'src/lib/progression/fixSentenceContentSelector.ts',
  'src/lib/progression/minimalPairsContentSelector.ts',
  'src/pages/ClinicalLibrary.tsx',
  'src/pages/GameAboutPage.tsx',
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    // Exclude raw research-evidence subdirectories — these are reference
    // literature reviews, not clinician-facing copy. They legitimately quote
    // and discuss banned terms in linguistic/scientific context.
    if (name === 'ladders-research') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (p.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const EVIDENCE_DOCS = (() => {
  try {
    return walk(join(ROOT, 'docs/clinical-evidence'));
  } catch {
    return [];
  }
})();

describe('banned clinical language', () => {
  it.each([...SCAN_FILES.map((f) => join(ROOT, f)), ...EVIDENCE_DOCS])(
    'is absent from %s',
    (path) => {
      const text = readFileSync(path, 'utf8');
      const hits = scanForBannedPhrases(text);
      if (hits.length > 0) {
        const formatted = hits
          .map((h) => `  - "${h.phrase}" near: …${h.window}…`)
          .join('\n');
        throw new Error(
          `Banned clinical-language hits in ${path}:\n${formatted}\n` +
            `If the use is legitimate, add an entry to ALLOWED_HEDGED in src/lib/clinicalIntegrity.ts.`,
        );
      }
      expect(hits).toEqual([]);
    },
  );
});
