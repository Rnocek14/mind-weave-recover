/**
 * Recovery Insight Language — Safety Constitution (PR-B1)
 *
 * Single authority for any patient/caregiver-facing wording emitted by the
 * Phase B "What changed today" layer (and any future longitudinal digest).
 *
 * Rules enforced here:
 *   1. Whitelist of allowed phrase frames per signal kind.
 *   2. Blacklist of banned terms — generator THROWS if any leaks through.
 *   3. Mastery-first ordering in the composer.
 *   4. Empty output is valid — composer may return [].
 *   5. No raw metric leaks (numbers with decimals, %-of-change, engine internals).
 *
 * IMPORTANT: This module is spec + pure functions only. It does not read the
 * database, does not import the adaptation engine, does not render UI.
 * The digest reader (PR-B2) and UI (PR-B4) consume from here.
 */

// ---------------------------------------------------------------------------
// Signal contract (matches the closed enum specified in PR-B2 plan).
// Duplicated here intentionally so PR-B1 can land standalone; PR-B2 will
// re-export this type from the digest reader and we'll consolidate then.
// ---------------------------------------------------------------------------

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'insufficient';

export type DigestSignal =
  | {
      kind: 'cue_support_changed';
      direction: 'less' | 'more' | 'same';
      dimension: 'cue_dependency';
      slug: string;
      trials: number;
      confidence: ConfidenceTier;
    }
  | {
      kind: 'pacing_changed';
      direction: 'eased' | 'tightened' | 'same';
      dimension: 'processing_speed';
      slug: string;
      trials: number;
      confidence: ConfidenceTier;
    }
  | {
      kind: 'distractor_load_changed';
      direction: 'fewer' | 'more' | 'same';
      dimension: 'distractor_load';
      slug: string;
      trials: number;
      confidence: ConfidenceTier;
    }
  | {
      kind: 'task_complexity_changed';
      direction: 'simpler' | 'harder' | 'same';
      dimension: 'linguistic_complexity' | 'working_memory_load';
      slug: string;
      trials: number;
      confidence: ConfidenceTier;
    }
  | {
      kind: 'accuracy_held_steady';
      band: 'warmup' | 'core' | 'stretch' | 'consolidation';
      slug: string;
      trials: number;
      confidence: ConfidenceTier;
    }
  | {
      kind: 'fatigue_support_activated';
      slug: string;
      trials: number;
      confidence: ConfidenceTier;
    }
  | {
      kind: 'independence_gain';
      dimension: 'independence' | 'cue_dependency';
      slug: string;
      trials: number;
      confidence: ConfidenceTier;
    };

export type InsightCategory = 'mastery' | 'support' | 'steady';

export interface ComposedInsight {
  /** Patient-facing line. Always passes the safety check. */
  text: string;
  /** Used for mastery-first ordering. */
  category: InsightCategory;
  /** Source signal kind, for telemetry / debugging. */
  source: DigestSignal['kind'];
  /** Confidence tier carried through from the signal. */
  confidence: ConfidenceTier;
}

// ---------------------------------------------------------------------------
// 1. WHITELIST — allowed phrase frames per signal kind.
//
// Each frame is a fully-formed sentence. No interpolation of raw metrics,
// percentages, or engine terms. Frames are categorised so the composer can
// enforce mastery-first ordering.
// ---------------------------------------------------------------------------

interface PhraseFrame {
  text: string;
  category: InsightCategory;
}

type FrameKey = string; // `${kind}:${direction|band|''}`

const PHRASE_WHITELIST: Record<FrameKey, PhraseFrame> = {
  // independence_gain
  'independence_gain:independence': {
    text: 'More independent today — needed less prompting to keep going.',
    category: 'mastery',
  },
  'independence_gain:cue_dependency': {
    text: 'Needed less prompting today.',
    category: 'mastery',
  },

  // cue_support_changed
  'cue_support_changed:less': {
    text: 'Less support was needed today.',
    category: 'mastery',
  },
  'cue_support_changed:more': {
    text: 'Support stepped in to keep practice productive.',
    category: 'support',
  },
  'cue_support_changed:same': {
    text: 'Support stayed available throughout.',
    category: 'steady',
  },

  // pacing_changed
  'pacing_changed:eased': {
    text: 'Pacing eased to match today’s effort.',
    category: 'support',
  },
  'pacing_changed:tightened': {
    text: 'Ready for a stretch next time — pacing picked up.',
    category: 'mastery',
  },
  'pacing_changed:same': {
    text: 'Pacing stayed consistent.',
    category: 'steady',
  },

  // distractor_load_changed
  'distractor_load_changed:fewer': {
    text: 'Fewer distractions today to keep focus clear.',
    category: 'support',
  },
  'distractor_load_changed:more': {
    text: 'Handled more on-screen choices today.',
    category: 'mastery',
  },
  'distractor_load_changed:same': {
    text: 'Filtering load held steady.',
    category: 'steady',
  },

  // task_complexity_changed
  'task_complexity_changed:simpler': {
    text: 'The task simplified to keep practice productive.',
    category: 'support',
  },
  'task_complexity_changed:harder': {
    text: 'Took on a harder version of the task today.',
    category: 'mastery',
  },
  'task_complexity_changed:same': {
    text: 'Task complexity held steady.',
    category: 'steady',
  },

  // accuracy_held_steady (band-keyed)
  'accuracy_held_steady:warmup': {
    text: 'Warm-up stayed strong and consistent.',
    category: 'steady',
  },
  'accuracy_held_steady:core': {
    text: 'Core practice held steady today.',
    category: 'steady',
  },
  'accuracy_held_steady:stretch': {
    text: 'Stretched the limit and held steady.',
    category: 'mastery',
  },
  'accuracy_held_steady:consolidation': {
    text: 'Consolidation work stayed consistent.',
    category: 'steady',
  },

  // fatigue_support_activated
  'fatigue_support_activated:': {
    text: 'Support stepped in to keep practice productive when effort rose.',
    category: 'support',
  },
};

// ---------------------------------------------------------------------------
// 2. BLACKLIST — banned terms. Composer throws if any leaks through, even
// from a whitelisted frame (defence in depth — protects against future edits).
// ---------------------------------------------------------------------------

/** Word-boundary banned terms (case-insensitive). */
const BANNED_WORDS: readonly string[] = [
  // Punitive / negative-trajectory verbs
  'decreased',
  'declined',
  'dropped',
  'worsened',
  'regressed',
  'regression',
  'fell',
  'weaker',
  'failed',
  'struggled',
  'struggling',
  'poor',
  'bad',
  // Engine internals
  'cue dependency',
  'fatigue score',
  'z-score',
  'zscore',
  'delta',
  'threshold',
  'difficulty decreased',
  'difficulty increased',
  'difficulty dropped',
  'difficulty rose',
  'rung dropped',
  'level dropped',
  'demoted',
  'promoted',
];

/**
 * Regex patterns that catch raw metric leaks regardless of surrounding words.
 *  - Two-decimal numbers ("0.42", "12.34").
 *  - %-of-change phrases ("12%", "down 5%").
 */
const BANNED_PATTERNS: readonly RegExp[] = [
  /\b\d+\.\d{2,}\b/, // 0.42, 1.234, etc.
  /\b\d+\s?%/, // 12%, 12 %
];

export class InsightSafetyError extends Error {
  constructor(
    message: string,
    public readonly offendingText: string,
    public readonly rule: string,
  ) {
    super(`[InsightSafety] ${message} | text="${offendingText}" | rule=${rule}`);
    this.name = 'InsightSafetyError';
  }
}

/**
 * Throws InsightSafetyError if `text` violates any blacklist rule.
 * Pure function. Used by composeInsights as defence in depth, and exported
 * for tests + future scoring/calibration tooling.
 */
export function assertSafePhrase(text: string): void {
  const lower = text.toLowerCase();

  for (const word of BANNED_WORDS) {
    // Whole-word match for single tokens; substring for multi-word phrases.
    const isMultiWord = word.includes(' ') || word.includes('-');
    const found = isMultiWord
      ? lower.includes(word)
      : new RegExp(`\\b${word}\\b`, 'i').test(text);
    if (found) {
      throw new InsightSafetyError(
        `banned term "${word}" detected`,
        text,
        `BANNED_WORD:${word}`,
      );
    }
  }

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      throw new InsightSafetyError(
        `raw metric pattern matched ${pattern}`,
        text,
        `BANNED_PATTERN:${pattern}`,
      );
    }
  }

  // Tone cap: hard length limit — keeps lines protective and scannable.
  // Aligns with the calm, non-clinical voice used in RecoveryProfileSection.
  if (text.length > 140) {
    throw new InsightSafetyError(
      `phrase exceeds 140-char tone cap`,
      text,
      'TONE_LENGTH_CAP',
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Frame lookup
// ---------------------------------------------------------------------------

function frameKeyForSignal(signal: DigestSignal): FrameKey | null {
  switch (signal.kind) {
    case 'cue_support_changed':
    case 'pacing_changed':
    case 'distractor_load_changed':
    case 'task_complexity_changed':
      return `${signal.kind}:${signal.direction}`;
    case 'accuracy_held_steady':
      return `${signal.kind}:${signal.band}`;
    case 'fatigue_support_activated':
      return `${signal.kind}:`;
    case 'independence_gain':
      return `${signal.kind}:${signal.dimension}`;
    default: {
      // Exhaustiveness guard.
      const _never: never = signal;
      return _never;
    }
  }
}

/**
 * Resolve a single signal to a safe ComposedInsight, or null if no frame
 * exists / confidence is too low. Never throws for normal cases — only
 * throws InsightSafetyError if a whitelisted frame somehow violates the
 * blacklist (regression guard).
 */
export function resolveSignalToInsight(signal: DigestSignal): ComposedInsight | null {
  // Confidence gate: low + insufficient never get spoken in Phase B.
  if (signal.confidence === 'low' || signal.confidence === 'insufficient') {
    return null;
  }

  const key = frameKeyForSignal(signal);
  if (!key) return null;

  const frame = PHRASE_WHITELIST[key];
  if (!frame) return null;

  // Defence-in-depth: validate every emitted phrase.
  assertSafePhrase(frame.text);

  return {
    text: frame.text,
    category: frame.category,
    source: signal.kind,
    confidence: signal.confidence,
  };
}

// ---------------------------------------------------------------------------
// 4. composeInsights — mastery-first ordering, cap, dedupe, empty-valid.
// ---------------------------------------------------------------------------

export interface ComposeOptions {
  /** Hard cap on emitted lines. Phase B default = 2. */
  maxLines?: number;
}

const CATEGORY_PRIORITY: Record<InsightCategory, number> = {
  mastery: 0,
  steady: 1,
  support: 2,
};

const CONFIDENCE_PRIORITY: Record<ConfidenceTier, number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};

/**
 * Translate a list of digest signals into ordered, safe patient-facing lines.
 *
 * Guarantees:
 *  - Mastery-first ordering (mastery → steady → support).
 *  - High-confidence wins ties.
 *  - At most one support-category line is emitted (never piled on).
 *  - Output capped at `maxLines` (default 2).
 *  - Returns [] when no signal qualifies — empty is a valid output.
 *  - Every emitted line passes assertSafePhrase().
 *  - Never emits a support line in punitive position: if the only candidates
 *    are support-category, we still emit (one line) but it stays in the
 *    neutral framing baked into the whitelist.
 */
export function composeInsights(
  signals: readonly DigestSignal[],
  options: ComposeOptions = {},
): ComposedInsight[] {
  const maxLines = options.maxLines ?? 2;
  if (maxLines <= 0) return [];

  const resolved: ComposedInsight[] = [];
  for (const sig of signals) {
    const insight = resolveSignalToInsight(sig);
    if (insight) resolved.push(insight);
  }

  if (resolved.length === 0) return [];

  // Dedupe by exact text — different signals may resolve to the same frame.
  const seen = new Set<string>();
  const unique = resolved.filter((i) => {
    if (seen.has(i.text)) return false;
    seen.add(i.text);
    return true;
  });

  // Sort: mastery-first, then by confidence (high > medium).
  unique.sort((a, b) => {
    const cat = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (cat !== 0) return cat;
    return CONFIDENCE_PRIORITY[a.confidence] - CONFIDENCE_PRIORITY[b.confidence];
  });

  // Cap support lines at 1 — never pile on support framing.
  const out: ComposedInsight[] = [];
  let supportEmitted = 0;
  for (const i of unique) {
    if (out.length >= maxLines) break;
    if (i.category === 'support') {
      if (supportEmitted >= 1) continue;
      supportEmitted += 1;
    }
    // Final defence-in-depth check (catches any future bypass).
    assertSafePhrase(i.text);
    out.push(i);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Versioning — bump when whitelist/blacklist semantics change.
// ---------------------------------------------------------------------------

export const INSIGHT_LANGUAGE_VERSION = '1.0.0';
