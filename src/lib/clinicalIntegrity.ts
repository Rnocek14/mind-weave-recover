/**
 * Clinical Integrity Layer (PR7, Phase 2.5)
 *
 * Single source of truth for the rules that keep clinician-facing surfaces
 * honest:
 *
 *   - BANNED_PHRASES — words/phrases we never use to describe progression
 *     outcomes unless the system has actual evidence to back them. Scanned
 *     by `bannedClinicalLanguage.test.ts`.
 *   - ALLOWED_HEDGED — exact phrasings that contain a banned word but are
 *     legitimate (e.g. "generalization probe attempt").
 *   - KNOWN_CAVEATS — per-(slug, level) caveats that demote an otherwise
 *     `implemented` tier to `partially-implemented`, with a short clinician-
 *     readable explanation that surfaces in /games and dev tools.
 *   - deriveTierStatusFromSpec — the ONE helper used by the registry, the
 *     Clinical Library UI, and the dev page so the rule never drifts.
 *
 * `implemented` is defined as: ships differentiated content WITHOUT known
 * integrity caveats that would affect interpretation. A bare fallback that
 * is invisible to the clinician is not enough to demote a tier; a known
 * caveat that changes how the result should be read IS.
 *
 * Global heuristic disclosure (shown once on the Clinical Library page):
 * progression thresholds and support weighting are heuristic clinical
 * scaffolds and are NOT diagnostic measures.
 *
 * Pure module — no I/O, no React. Safe to import anywhere.
 */

export const HEURISTIC_DISCLOSURE =
  'Progression thresholds and support weighting are heuristic clinical scaffolds and are not diagnostic measures.';

/**
 * Phrases that imply a clinical claim we have not earned. The banned-language
 * test rejects them unless the surrounding window matches one of the
 * ALLOWED_HEDGED phrases below.
 *
 * Keep ASCII-lowercase; the scanner matches case-insensitively against
 * whitespace-normalized text.
 */
export const BANNED_PHRASES: readonly string[] = [
  'mastered',
  'mastery achieved',
  'generalized',
  'generalization achieved',
  'transfer proven',
  'clinically proven',
  'evidence-based weight',
  'proven cue order',
  'cured',
  'recovered',
  'validated',
  'clinically validated',
  // Added post-PR7 review (Claude analysis): bare "achieved" reads as a
  // clinical milestone claim on patient/caregiver surfaces, and
  // "normalized" implies recovery to pre-morbid baseline. Both stay safe
  // outside the scanned clinical surfaces (e.g. FunctionalGoalsWidget),
  // which the scanner does not include.
  'achieved',
  'normalized',
];

/**
 * Exact phrasings that contain a banned word but ARE allowed. The scanner
 * checks each banned-phrase hit against this allow-list using a small text
 * window around the hit; if any allowed phrase covers the hit, it passes.
 */
export const ALLOWED_HEDGED: readonly string[] = [
  // Note: "generalization probe attempt" was the PR4 wording for L8 photo
  // naming. After post-PR7 review the L8 tier was relabeled "advanced
  // retrieval review" because PROBE_WORDS overlaps the training bank. The
  // hedged phrasings below remain allowed so /docs and KNOWN_CAVEATS can
  // still describe the prior framing without tripping the scanner.
  'generalization probe',
  'generalization probe attempt',
  'untrained probe',
  'untrained probe performance',
  'mastery confidence',
  'mastery confidence gate',
  'mastery signal',
  'mastery layer',
  'mastery shadow',
  'clinically motivated',
  'clinically motivated calibration',
  // Negation / honesty contexts — explicitly stating something is NOT
  // validated is the point of those docs.
  'not validated',
  'not yet validated',
  'literature-validated',
  'rehab-validated',
  'was not validated',
  'is not a literature-validated',
  'has been validated in head-to-head',
  'not a literature-proven cue order',
  'literature-proven cue order',
  // "normalized" is banned as a clinical claim but is also a common
  // engineering term. Whitelist the technical phrasing the scanner is
  // likely to encounter inside scanned modules.
  'whitespace-normalized',
  'normalized text',
  'min-max normalized',
];

export type TierStatus = 'implemented' | 'partially-implemented' | 'planned';

export interface TierStatusResult {
  tierStatus: TierStatus;
  /** One short clinician-readable sentence explaining the status. */
  tierStatusDetail: string;
}

/**
 * Per-(slug, level) caveats. Centralised so disclaimers do not drift into
 * scattered UI strings. Surface in /games as amber chips on the relevant row.
 */
export const KNOWN_CAVEATS: Record<string, Record<number, string>> = {
  'photo-naming': {
    8: 'L8 uses PROBE_WORDS as advanced retrieval review. The probe pool currently overlaps PHOTO_BANK 1:1, so this is NOT untrained-probe evidence. Tracked in pr4-probe-bank-cleanup.',
    7: 'Carrier-phrase mode ships, but the underlying frequency band cannot be enforced when bank metadata is missing.',
  },
};

/** Pure helper used by tests so the registry and the UI agree. */
export function deriveTierStatusFromSpec(
  slug: string,
  level: number,
  spec: { contentSelector?: { implemented?: boolean; description?: string } } | undefined,
): TierStatusResult {
  const implementedFlag = spec?.contentSelector?.implemented;
  const caveat = KNOWN_CAVEATS[slug]?.[level];

  // Specs that explicitly say `implemented: false` are planned.
  if (implementedFlag === false) {
    return {
      tierStatus: 'planned',
      tierStatusDetail:
        spec?.contentSelector?.description ??
        'Tier not yet implemented; selector skips honestly.',
    };
  }

  // Implemented flag missing OR true: a known caveat downgrades to partial.
  if (caveat) {
    return {
      tierStatus: 'partially-implemented',
      tierStatusDetail: caveat,
    };
  }

  return {
    tierStatus: 'implemented',
    tierStatusDetail:
      spec?.contentSelector?.description ??
      'Ships differentiated content for this level with no known integrity caveats.',
  };
}

/**
 * Tier-status badge presentation tokens. UI components consume this rather
 * than hard-coding colors so the labeling stays consistent across surfaces.
 *
 * Colors are intentionally semantic Tailwind tokens — palette swaps inherit.
 */
export const TIER_STATUS_PRESENTATION: Record<
  TierStatus,
  { label: string; chipClass: string }
> = {
  implemented: {
    label: 'Implemented',
    chipClass: 'bg-primary/15 text-primary border-primary/30',
  },
  'partially-implemented': {
    label: 'Partially implemented',
    chipClass:
      'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  planned: {
    label: 'Planned — selector skips honestly',
    chipClass: 'bg-muted text-muted-foreground border-border',
  },
};

/**
 * Scanner used by the banned-language test. Exported so other tools (e.g.
 * a future pre-commit hook) can reuse the same rules.
 */
export interface BannedHit {
  phrase: string;
  index: number;
  window: string;
}

const WINDOW_RADIUS = 32;

export function scanForBannedPhrases(text: string): BannedHit[] {
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  const hits: BannedHit[] = [];
  for (const phrase of BANNED_PHRASES) {
    let from = 0;
    while (true) {
      // Use word-boundary-aware match for short single words so we do not
      // false-positive on substrings (e.g. "valid" inside "validity").
      const needle = phrase.toLowerCase();
      const pattern = /^[a-z]+$/.test(needle)
        ? new RegExp(`\\b${needle}\\b`, 'g')
        : null;
      let idx = -1;
      if (pattern) {
        pattern.lastIndex = from;
        const m = pattern.exec(lower);
        idx = m ? m.index : -1;
      } else {
        idx = lower.indexOf(needle, from);
      }
      if (idx < 0) break;
      const start = Math.max(0, idx - WINDOW_RADIUS);
      const end = Math.min(lower.length, idx + needle.length + WINDOW_RADIUS);
      const window = lower.slice(start, end);
      const hedged = ALLOWED_HEDGED.some((h) => window.includes(h));
      if (!hedged) {
        hits.push({ phrase, index: idx, window });
      }
      from = idx + needle.length;
    }
  }
  return hits;
}
