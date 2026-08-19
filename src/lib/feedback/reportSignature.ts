/**
 * reportSignature — collapse many reports of one bug into one row.
 *
 * WHY THIS IS THE WHOLE POINT: a report button is easy; a report INBOX is the
 * thing that fails. If forty people hit the same scoring bug, forty rows
 * arrive, the real signal is buried in duplicates, and within a month nobody
 * reads the table. Grouping by a stable signature turns that into one row
 * with a count of forty — which is also, usefully, a priority ranking.
 *
 * The signature deliberately keys on WHAT WENT WRONG, not on who reported it
 * or when: the exercise, the specific item, what the person said, and what
 * the app expected. Two people hitting "plumbing" on the jobs prompt produce
 * the same signature; the same person hitting two different words does not.
 *
 * Pure, deterministic, dependency-free — so it can be asserted in tests and
 * recomputed later over historical rows if the grouping ever needs changing.
 */

/** Everything the signature is derived from. */
export interface SignatureInput {
  exerciseSlug: string;
  stimulusId?: string | null;
  expected?: string | null;
  /** Prefer the raw recognizer text: it is what the matcher actually saw. */
  spoken?: string | null;
  isCorrect: boolean;
}

/**
 * Loose normalization so trivial differences don't split a group:
 * case, punctuation, and whitespace all vary between recognizers and none of
 * them change which bug this is.
 */
export function normalizeForSignature(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * FNV-1a, 32-bit. Not cryptographic and doesn't need to be — this is a
 * grouping key, and collisions between two genuinely different bugs are both
 * astronomically unlikely and harmless (they'd merge two rows in a triage
 * list, not corrupt anything).
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * A stable 8-character group key for one kind of failure.
 *
 * The scored outcome is part of the key on purpose: "marked wrong when it
 * should have counted" and "marked right when it shouldn't have" are
 * different bugs about the same word, and merging them would hide the
 * rarer, more alarming one.
 */
export function reportSignature(input: SignatureInput): string {
  const parts = [
    input.exerciseSlug.trim().toLowerCase(),
    normalizeForSignature(input.stimulusId),
    normalizeForSignature(input.expected),
    normalizeForSignature(input.spoken),
    input.isCorrect ? 'scored-correct' : 'scored-wrong',
  ];
  return fnv1a(parts.join('|'));
}

/**
 * A one-line human summary, stored alongside the signature so a triage list
 * is readable without joining anything.
 */
export function reportHeadline(input: SignatureInput): string {
  const said = normalizeForSignature(input.spoken) || '(nothing heard)';
  const wanted = normalizeForSignature(input.expected) || '(no expected answer)';
  const verdict = input.isCorrect ? 'accepted' : 'rejected';
  return `${input.exerciseSlug}: said "${said}", wanted "${wanted}" — ${verdict}`;
}
