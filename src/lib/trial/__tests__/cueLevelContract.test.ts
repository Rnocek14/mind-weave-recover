/**
 * Cross-game `cue_level` contract guard.
 *
 * `cue_level` is the clinician/system-issued cue intensity dimension only:
 *   0 = independent, 1 = semantic, 2 = phonemic, 3 = full word/model.
 *
 * Mastery (`computeMastery.ts`) consumes it as `(1 - cue_level/3)` on correct
 * trials for cue independence. `compute-adaptation-profile` reads the same
 * field for support-intensity trend. If a game starts folding a *different*
 * support dimension (e.g. listen-again replay) into `cue_level`, those
 * cross-game analyses silently skew. This test grep-locks the current
 * emission rules so that change has to happen on purpose.
 *
 * See: docs/unified-trial-contract.md → "Cross-game cue_level contract".
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe("cue_level cross-game contract", () => {
  it("FixSentenceExercise emits cueLevel: 0 in submitTrial", () => {
    const src = read('src/pages/FixSentenceExercise.tsx');
    // Exact literal — if a game starts emitting derived cueLevel here it
    // must update the contract doc and this test together.
    expect(src).toMatch(/cueLevel:\s*0\b/);
    // And must NOT derive cueLevel from any per-trial support signal.
    expect(src).not.toMatch(/cueLevel:\s*[a-zA-Z_$][\w$.?]*\s*[?>]/);
  });

  it("MinimalPairsExercise emits cueLevel: 0 — replay is support, not cue", () => {
    const src = read('src/pages/MinimalPairsExercise.tsx');
    expect(src).toMatch(/cueLevel:\s*0\b/);
    // Explicit guard against the previous "replay-as-cue" mapping.
    expect(src).not.toMatch(/cueLevel:\s*trialData\.audioReplayCount/);
    expect(src).not.toMatch(/cueLevel:\s*[^0\s,]+\.audioReplayCount/);
  });

  it("PhotoNamingExercise routes cueLevel from the in-game cue ladder", () => {
    const src = read('src/pages/PhotoNamingExercise.tsx');
    // PhotoNaming is the one game allowed to emit non-zero — it sources
    // cueLevel from the result payload produced by the cue ladder.
    expect(src).toMatch(/cueLevel:\s*result\.cueLevel\s*\?\?\s*0/);
  });

  it("mastery layer still interprets cue_level on a 0..3 scale", () => {
    // If anyone changes the divisor, the cross-game emission rules above
    // need to be re-validated. Lock the constant.
    const src = read('src/lib/mastery/computeMastery.ts');
    expect(src).toMatch(/cue_level\s*\?\?\s*0\)\s*\)\s*\/\s*3/);
  });
});
