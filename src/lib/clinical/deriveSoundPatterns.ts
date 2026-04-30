/**
 * Sound-pattern hypothesis generator — consonant-skeleton diff.
 *
 * NOT a true phoneme aligner. We compare the consonant skeleton of the target
 * word vs. what the patient said, and surface recurring patterns (final
 * consonant deletions, /r/-/l/ confusions, /s/-blend reductions).
 *
 * Output is labeled in the UI as "auto-detected, confirm clinically".
 *
 * Hidden when fewer than 5 incorrect trials with usable transcripts exist
 * (caller's responsibility to check `usableTrialCount`).
 */

const VOWELS = /[aeiouy]/g;

const skeleton = (s: string | null | undefined): string =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(VOWELS, "");

export interface SoundPatternInput {
  target_word: string | null | undefined;
  transcript: string | null | undefined;
  is_correct: boolean | null | undefined;
}

export interface SoundPattern {
  label: string;
  count: number;
  examples: string[]; // "target → said"
}

export interface SoundPatternsResult {
  patterns: SoundPattern[];
  usableTrialCount: number;
}

/**
 * Detect simple recurring categories from one trial pair.
 * Returns a list of (label, exampleString) tuples found in this pair.
 */
function detectInTrial(target: string, said: string): { label: string; example: string }[] {
  const out: { label: string; example: string }[] = [];
  const t = target.toLowerCase().replace(/[^a-z]/g, "");
  const s = said.toLowerCase().replace(/[^a-z]/g, "");
  if (!t || !s) return out;

  const example = `${t} → ${s}`;

  // 1. Final consonant deletion: target ends with consonant, said is shorter and missing it
  const lastT = t[t.length - 1];
  if (lastT && !"aeiouy".includes(lastT) && s.length < t.length && !s.endsWith(lastT)) {
    out.push({ label: `Final /${lastT}/ dropped`, example });
  }

  // 2. /r/ → /w/ substitution
  if (t.includes("r") && !s.includes("r") && s.includes("w")) {
    out.push({ label: "/r/ → /w/ substitution", example });
  }

  // 3. /l/ → /w/ substitution
  if (t.includes("l") && !s.includes("l") && s.includes("w")) {
    out.push({ label: "/l/ → /w/ substitution", example });
  }

  // 4. /r/ ↔ /l/ confusion
  if (t.includes("r") && !s.includes("r") && s.includes("l")) {
    out.push({ label: "/r/ → /l/ substitution", example });
  }
  if (t.includes("l") && !s.includes("l") && s.includes("r")) {
    out.push({ label: "/l/ → /r/ substitution", example });
  }

  // 5. /s/-blend reduction (sp, st, sk, sl, sn, sm, sw → drop the s)
  const sBlends = ["sp", "st", "sk", "sl", "sn", "sm", "sw"];
  for (const blend of sBlends) {
    if (t.includes(blend) && !s.includes(blend) && s.includes(blend[1])) {
      out.push({ label: `/s/-blend reduced (${blend})`, example });
      break;
    }
  }

  // 6. Voicing errors on common pairs
  const voicePairs: Array<[string, string]> = [
    ["b", "p"], ["d", "t"], ["g", "k"], ["v", "f"], ["z", "s"],
  ];
  for (const [voiced, voiceless] of voicePairs) {
    if (t.includes(voiced) && !s.includes(voiced) && s.includes(voiceless)) {
      out.push({ label: `/${voiced}/ → /${voiceless}/ (devoicing)`, example });
      break;
    }
  }

  return out;
}

export function deriveSoundPatterns(
  trials: SoundPatternInput[],
  topN: number = 3
): SoundPatternsResult {
  const usable = trials.filter(
    (t) => !t.is_correct && (t.target_word || "").length >= 2 && (t.transcript || "").length >= 1
  );

  const buckets = new Map<string, { count: number; examples: string[] }>();

  for (const t of usable) {
    const found = detectInTrial(t.target_word || "", t.transcript || "");
    for (const { label, example } of found) {
      const bucket = buckets.get(label) || { count: 0, examples: [] };
      bucket.count += 1;
      if (bucket.examples.length < 3 && !bucket.examples.includes(example)) {
        bucket.examples.push(example);
      }
      buckets.set(label, bucket);
    }
  }

  const patterns: SoundPattern[] = Array.from(buckets.entries())
    .map(([label, b]) => ({ label, count: b.count, examples: b.examples }))
    .filter((p) => p.count >= 2) // require recurrence
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return { patterns, usableTrialCount: usable.length };
}
