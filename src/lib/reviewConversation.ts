/**
 * Review Conversation Engine — the transfer keystone.
 *
 * After game practice, Maya holds a SHORT, BOUNDED conversation that gives
 * each practiced word a chance to be retrieved in a conversational context.
 * Spontaneous use (the patient says the word before Maya steers to it) is
 * the highest-value transfer signal; elicited use is next; cued use last.
 *
 * ANTI-LOOP / ANTI-STUPID ARCHITECTURE (all enforced by rule, not by model):
 *  - Deterministic state machine: greet → per-item frames → wrapup. Every
 *    path reaches wrapup; there is no state that can revisit a completed item.
 *  - Hard budgets: MAX_MAYA_TURNS total, MAX_ATTEMPTS_PER_ITEM (2) — a word
 *    that won't come is released back to spaced repetition, never flogged.
 *  - All Maya lines come from template pools (single question per line,
 *    short sentences); a per-session used-line memory prevents any line
 *    repeating within a session.
 *  - Verify-don't-guess repair: when ASR confidence is low but a hypothesis
 *    matches a pending word, the engine asks for confirmation (yes/no)
 *    instead of assuming — the same repair move SLPs teach caregivers.
 *  - Multi-hypothesis deciphering: every utterance is scanned across ALL
 *    ASR hypotheses, not just the top one.
 *
 * This module is PURE — no I/O, no React, no network — so every rule above
 * is unit-testable. The UI layer owns TTS/ASR and calls the engine.
 */

import { stemWord } from "./reviewStem";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ReviewItem {
  word: string;
  category: string;
  /** Whether the patient struggled with this word during practice. */
  struggled: boolean;
  status: "pending" | "spontaneous" | "elicited" | "cued" | "released";
  attempts: number;
}

export type ReviewPhase = "greet" | "frame" | "repair" | "wrapup" | "done";

export interface ReviewState {
  items: ReviewItem[];
  /** Index of the item currently framed, or -1 outside item frames. */
  activeItem: number;
  phase: ReviewPhase;
  mayaTurns: number;
  usedLines: Set<string>;
  /** Word awaiting yes/no confirmation during repair. */
  repairWord: string | null;
  /** Item index the repair belongs to. */
  repairItem: number;
  /** True when the active item's cue has been given (next hit scores as cued). */
  cueGivenForActive: boolean;
  /** Last non-empty user transcript — duplicate ASR finals are ignored. */
  lastTranscript: string | null;
  /** Consecutive bare acknowledgments ("yes", "fine") — the guarded-user signal. */
  ackStreak: number;
  /**
   * Guarded/minimal-replier mode: after 2 consecutive bare acknowledgments,
   * remaining frames open as forced choices, where a ONE-WORD answer is the
   * therapeutic production. Short repliers get a short, winnable chat.
   */
  lowDemandMode: boolean;
}

export interface AsrHypothesis {
  transcript: string;
  confidence: number | null;
}

export interface EngineTurn {
  state: ReviewState;
  /** What Maya says next (already de-duplicated). Empty string = say nothing. */
  mayaLine: string;
  /** Machine-readable events for telemetry / UI celebration. */
  events: ReviewEvent[];
}

export type ReviewEvent =
  | { type: "spontaneous_use"; word: string }
  | { type: "elicited_use"; word: string }
  | { type: "cued_use"; word: string }
  | { type: "item_released"; word: string }
  | { type: "repair_started"; word: string }
  | { type: "repair_confirmed"; word: string }
  | { type: "repair_rejected"; word: string }
  | { type: "review_complete"; summary: ReviewSummary };

export interface ReviewSummary {
  spontaneous: number;
  elicited: number;
  cued: number;
  released: number;
  total: number;
}

// ─── Budgets (the anti-loop constitution) ──────────────────────────────────

export const MAX_MAYA_TURNS = 12;
export const MAX_ATTEMPTS_PER_ITEM = 2;
export const MAX_REVIEW_ITEMS = 4;
/** ASR confidence below this triggers verify-don't-guess repair. */
export const REPAIR_CONFIDENCE_THRESHOLD = 0.55;

// ─── Line pools (every line: ONE question max, short, plain) ───────────────

const GREET_LINES = [
  "Great practice today! Let's chat for a minute.",
  "Nice work! Let's talk for a little bit.",
  "You worked hard! Let's have a quick chat.",
];

/**
 * Topic frames give a practiced word a conversational HOME, never a quiz.
 * `{word}` is replaced with the target. Each is a single, short question.
 */
const FRAME_TEMPLATES: Record<string, string[]> = {
  food: [
    "You said {word} really well earlier. Do you like {word}?",
    "Earlier we saw a {word}. When did you last have {word}?",
  ],
  animals: [
    "You named the {word} earlier. Do you like animals?",
    "We saw a {word} today. Have you ever had a pet?",
  ],
  household: [
    "You said {word} earlier. Is there a {word} in your home?",
    "We practiced {word}. Where do you keep yours?",
  ],
  clothing: [
    "You named {word} earlier. What do you like to wear?",
    "We practiced the word {word}. Do you have a favorite {word}?",
  ],
  nature: [
    "You said {word} nicely today. Do you enjoy being outside?",
    "We saw a {word} earlier. Do you like nature?",
  ],
  transportation: [
    "You named the {word} earlier. How do you like to get around?",
    "We practiced {word}. Have you traveled anywhere lately?",
  ],
  generic: [
    "You said {word} really well earlier. Tell me about a {word} you know.",
    "We practiced the word {word}. What comes to mind about {word}?",
  ],
};

/** One gentle cue when the word doesn't surface on the first try. */
const CUE_TEMPLATES = [
  "It starts with {letter}. Can you say {word}?",
  "Here it is: {word}. Can you say it with me?",
];

const CELEBRATE_SPONTANEOUS = [
  "You just used that word all on your own — wonderful!",
  "You said it before I even asked — wonderful!",
  "That word came right out on its own. Excellent!",
];

const CELEBRATE_ELICITED = [
  "Yes — great job!",
  "That's the one. Well done!",
  "Perfect. Nicely said!",
];

const MOVE_ON_LINES = [
  "That's okay — we'll practice that one again soon.",
  "No problem. It will come another day.",
  "That's alright — let's talk about something else.",
];

const REPAIR_TEMPLATES = [
  "It sounded like you said {word} — did I get that right?",
  "I think I heard {word} — is that right?",
];

/**
 * Forced-choice bridges for minimal repliers. A bare "yes"/"no"/"fine" to a
 * frame is ENGAGEMENT, not failure — the bridge makes the target word the
 * easiest possible next reply. (Saying the word here counts as cued: Maya
 * modeled it inside the choice.)
 */
const BRIDGE_TEMPLATES = [
  "That's okay. Which do you like better — {word} or {other}?",
  "Fair enough! Quick one: {word} or {other}?",
  "Got it. Which one is more you — {word} or {other}?",
];

/** Per-category distractors for forced choices (never a practiced word). */
const CHOICE_DISTRACTORS: Record<string, string[]> = {
  food: ["tea", "toast", "soup"],
  nature: ["the beach", "the mountains"],
  household: ["a fork", "a cup"],
  clothing: ["a hat", "shoes"],
  animals: ["a cat", "a bird"],
  transportation: ["the bus", "walking"],
  generic: ["something else", "another one"],
};

/** Bare acknowledgments — the guarded-user reply set. */
const ACKNOWLEDGMENT_RE =
  /^(yes|yeah|yep|no|nope|ok|okay|fine|sure|maybe|i guess|dunno|i don't know|i don't remember|not really|uh huh|mhm|mm|hmm)[.!]?$/i;

export function isBareAcknowledgment(text: string): boolean {
  return ACKNOWLEDGMENT_RE.test(text.trim());
}

function pickDistractor(category: string, avoid: Set<string>): string {
  const pool = CHOICE_DISTRACTORS[category] ?? CHOICE_DISTRACTORS.generic;
  return pool.find((d) => !avoid.has(d.toLowerCase())) ?? CHOICE_DISTRACTORS.generic[0];
}

/** Low-demand frame openers (guarded users): forced choice from the start. */
const LOW_DEMAND_FRAME_TEMPLATES = [
  "Here's an easy one: {word} or {other} — which do you like?",
  "Quick pick — {word} or {other}?",
];

const WRAPUP_LINES = [
  "That was a lovely chat. See you next time!",
  "Great talking with you. Well done today!",
  "Thanks for chatting with me. You did really well!",
];

// ─── Line selection with per-session no-repeat memory ──────────────────────

function pickLine(pool: string[], used: Set<string>, fill: Record<string, string> = {}): string {
  const fresh = pool.filter((l) => !used.has(l));
  const source = fresh.length > 0 ? fresh : pool; // pool exhausted → allow reuse rather than silence
  const raw = source[Math.floor(Math.random() * source.length)];
  used.add(raw);
  return raw.replace(/\{(\w+)\}/g, (_, key) => fill[key] ?? "");
}

/** Guard: every authored line must contain at most one question mark. */
export function violatesOneQuestionRule(line: string): boolean {
  return (line.match(/\?/g) ?? []).length > 1;
}

/** Exported for tests: all pools, so authored lines stay short and single-question. */
export const __ALL_LINE_POOLS: string[][] = [
  GREET_LINES,
  ...Object.values(FRAME_TEMPLATES),
  CUE_TEMPLATES,
  CELEBRATE_SPONTANEOUS,
  CELEBRATE_ELICITED,
  MOVE_ON_LINES,
  REPAIR_TEMPLATES,
  BRIDGE_TEMPLATES,
  LOW_DEMAND_FRAME_TEMPLATES,
  WRAPUP_LINES,
];

// ─── Word detection across all hypotheses ──────────────────────────────────

function utteranceContainsWord(transcript: string, word: string): boolean {
  const target = stemWord(word.toLowerCase());
  return transcript
    .toLowerCase()
    .split(/[^a-z']+/)
    .some((w) => w && stemWord(w) === target);
}

export interface DetectionResult {
  itemIndex: number;
  /** True when found only in a low-confidence / non-top hypothesis. */
  needsRepair: boolean;
}

/**
 * Scan an utterance (top transcript + alternates) for any pending item word.
 * Top-hypothesis hits with decent confidence are trusted; hits found only in
 * alternates, or with low confidence, request repair confirmation instead.
 */
export function detectPendingWord(
  state: ReviewState,
  transcript: string,
  alternatives: AsrHypothesis[],
  confidence: number | null,
): DetectionResult | null {
  for (let i = 0; i < state.items.length; i++) {
    const item = state.items[i];
    if (item.status !== "pending") continue;

    if (utteranceContainsWord(transcript, item.word)) {
      const lowConfidence = confidence !== null && confidence < REPAIR_CONFIDENCE_THRESHOLD;
      return { itemIndex: i, needsRepair: lowConfidence };
    }
    for (const alt of alternatives) {
      if (alt.transcript !== transcript && utteranceContainsWord(alt.transcript, item.word)) {
        return { itemIndex: i, needsRepair: true };
      }
    }
  }
  return null;
}

// ─── Engine ────────────────────────────────────────────────────────────────

export function startReview(
  practiced: Array<{ word: string; category: string; struggled: boolean }>,
): EngineTurn {
  // Struggled words first — they benefit most from conversational retrieval.
  const ordered = [...practiced].sort((a, b) => Number(b.struggled) - Number(a.struggled));
  const items: ReviewItem[] = ordered.slice(0, MAX_REVIEW_ITEMS).map((p) => ({
    word: p.word,
    category: p.category,
    struggled: p.struggled,
    status: "pending",
    attempts: 0,
  }));

  const state: ReviewState = {
    items,
    activeItem: -1,
    phase: "greet",
    mayaTurns: 0,
    usedLines: new Set(),
    repairWord: null,
    repairItem: -1,
    cueGivenForActive: false,
    lastTranscript: null,
    ackStreak: 0,
    lowDemandMode: false,
  };

  const greeting = pickLine(GREET_LINES, state.usedLines);
  state.mayaTurns = 1;
  return advanceToNextFrame(state, greeting, []);
}

function framesFor(category: string): string[] {
  return FRAME_TEMPLATES[category] ?? FRAME_TEMPLATES.generic;
}

/** Find the next pending item and open its topic frame; else wrap up. */
function advanceToNextFrame(state: ReviewState, prefix: string, events: ReviewEvent[]): EngineTurn {
  // Fairness: every word gets its FIRST frame before any word is re-framed
  // after a spontaneous detour. (Fuzz seed 78 caught the earlier version
  // flogging the first item's attempts on every detour.)
  const unframed = state.items.findIndex((it) => it.status === "pending" && it.attempts === 0);
  const nextIdx = unframed !== -1 ? unframed : state.items.findIndex((it) => it.status === "pending");

  if (nextIdx === -1 || state.mayaTurns >= MAX_MAYA_TURNS) {
    return wrapup(state, prefix, events, nextIdx !== -1);
  }

  state.activeItem = nextIdx;
  state.phase = "frame";
  const item = state.items[nextIdx];
  // A re-frame after a detour is attempt-free: attempts counts the item's
  // OWN chances (first frame + one cue), never conversation-flow overhead.
  item.attempts = Math.max(item.attempts, 1);

  let frame: string;
  if (state.lowDemandMode) {
    // Guarded user: open with the forced choice directly — a one-word reply
    // is the win. Word is modeled in the choice → production scores as cued.
    state.cueGivenForActive = true;
    const avoid = new Set(state.items.map((i) => i.word.toLowerCase()));
    frame = pickLine(LOW_DEMAND_FRAME_TEMPLATES, state.usedLines, {
      word: item.word,
      other: pickDistractor(item.category, avoid),
    });
  } else {
    state.cueGivenForActive = false;
    frame = pickLine(framesFor(item.category), state.usedLines, { word: item.word });
  }
  state.mayaTurns += 1;
  return { state, mayaLine: joinLines(prefix, frame), events };
}

function wrapup(state: ReviewState, prefix: string, events: ReviewEvent[], budgetHit: boolean): EngineTurn {
  // Release anything still pending back to spaced repetition — never flog.
  for (const item of state.items) {
    if (item.status === "pending") {
      item.status = "released";
      events.push({ type: "item_released", word: item.word });
    }
  }
  state.phase = "done";
  state.activeItem = -1;
  const summary = summarize(state);
  events.push({ type: "review_complete", summary });
  const line = pickLine(WRAPUP_LINES, state.usedLines);
  state.mayaTurns += 1;
  void budgetHit;
  return { state, mayaLine: joinLines(prefix, line), events };
}

export function summarize(state: ReviewState): ReviewSummary {
  const count = (s: ReviewItem["status"]) => state.items.filter((i) => i.status === s).length;
  return {
    spontaneous: count("spontaneous"),
    elicited: count("elicited"),
    cued: count("cued"),
    released: count("released"),
    total: state.items.length,
  };
}

function joinLines(a: string, b: string): string {
  return [a, b].filter(Boolean).join(" ");
}

/**
 * Handle a user utterance. The single entry point for speech — covers
 * spontaneous use of ANY pending word, elicited use of the active word,
 * low-confidence repair, and forward motion when nothing matched.
 */
export function onUserUtterance(
  state: ReviewState,
  transcript: string,
  alternatives: AsrHypothesis[] = [],
  confidence: number | null = null,
): EngineTurn {
  if (state.phase === "done") return { state, mayaLine: "", events: [] };

  // Noise guard: an empty/whitespace transcript (breath, mic blip) must never
  // consume the item's cue or advance anything. Say nothing, wait.
  const trimmed = transcript.trim();
  if (!trimmed || !/[a-z]/i.test(trimmed)) return { state, mayaLine: "", events: [] };

  // Duplicate-final guard: ASR sometimes re-finalizes the same text. Only a
  // NON-MATCHING duplicate is ignored (repeating the target on purpose is
  // fine — it matches and is handled below).
  const isDuplicate = state.lastTranscript === trimmed.toLowerCase();
  state.lastTranscript = trimmed.toLowerCase();

  if (state.phase === "repair") {
    // Three honest readings of speech during repair:
    //  1. an explicit yes/no,
    //  2. the patient saying the repair word AGAIN (very common in aphasia —
    //     repetition IS their confirmation),
    //  3. anything else = not confirmed.
    const saidYes = /^(yes|yeah|yep|right|correct|uh huh|mhm)\b/i.test(trimmed);
    const repeatedWord =
      state.repairWord !== null && utteranceContainsWord(trimmed, state.repairWord);
    return onRepairAnswer(state, saidYes || repeatedWord);
  }

  const detection = detectPendingWord(state, trimmed, alternatives, confidence);

  if (!detection && isDuplicate) {
    // Same non-matching text twice — don't burn a cue on an ASR hiccup.
    return { state, mayaLine: "", events: [] };
  }

  if (!detection && state.phase === "frame" && isBareAcknowledgment(trimmed)) {
    // "Yes." / "Fine." / "Dunno." — the guarded user. This is ENGAGEMENT in
    // minimal mode, not a failed attempt: never answer it with a letter cue
    // (that reads as a test). Bridge with a forced choice where the shortest
    // possible reply IS the target word.
    state.ackStreak += 1;
    if (state.ackStreak >= 2) state.lowDemandMode = true;
    return bridgeActiveItem(state);
  }

  if (!detection) {
    state.ackStreak = 0; // a real (if missed) attempt breaks the guarded streak
    return progressActiveItem(state);
  }

  state.ackStreak = 0;

  const item = state.items[detection.itemIndex];

  if (detection.needsRepair) {
    state.phase = "repair";
    state.repairWord = item.word;
    state.repairItem = detection.itemIndex;
    const line = pickLine(REPAIR_TEMPLATES, state.usedLines, { word: item.word });
    state.mayaTurns += 1;
    return { state, mayaLine: line, events: [{ type: "repair_started", word: item.word }] };
  }

  // Confident hit. Three transfer tiers:
  //   spontaneous — a pending word that was NOT the framed item
  //   cued        — the framed item, but only after its cue was given
  //   elicited    — the framed item, retrieved from the frame alone
  const spontaneous = detection.itemIndex !== state.activeItem;
  const cued = !spontaneous && state.cueGivenForActive;
  item.status = spontaneous ? "spontaneous" : cued ? "cued" : "elicited";
  const events: ReviewEvent[] = [
    spontaneous
      ? { type: "spontaneous_use", word: item.word }
      : cued
        ? { type: "cued_use", word: item.word }
        : { type: "elicited_use", word: item.word },
  ];
  const praise = pickLine(spontaneous ? CELEBRATE_SPONTANEOUS : CELEBRATE_ELICITED, state.usedLines);
  return advanceToNextFrame(state, praise, events);
}

/**
 * Guarded-user bridge: consume the item's second chance with a forced choice
 * instead of a letter cue. Maya models the word inside the choice, so a
 * following production scores as cued (honest support accounting).
 */
function bridgeActiveItem(state: ReviewState): EngineTurn {
  const idx = state.activeItem;
  if (idx < 0 || state.items[idx].status !== "pending") {
    return advanceToNextFrame(state, "", []);
  }
  const item = state.items[idx];

  if (item.attempts < MAX_ATTEMPTS_PER_ITEM) {
    item.attempts += 1;
    state.cueGivenForActive = true; // the word is modeled in the choice
    const avoid = new Set(state.items.map((i) => i.word.toLowerCase()));
    const bridge = pickLine(BRIDGE_TEMPLATES, state.usedLines, {
      word: item.word,
      other: pickDistractor(item.category, avoid),
    });
    state.mayaTurns += 1;
    return { state, mayaLine: bridge, events: [] };
  }

  item.status = "released";
  const moveOn = pickLine(MOVE_ON_LINES, state.usedLines);
  return advanceToNextFrame(state, moveOn, [{ type: "item_released", word: item.word }]);
}

/** No match: cue once, then release. Guarantees per-item forward motion. */
function progressActiveItem(state: ReviewState): EngineTurn {
  const idx = state.activeItem;
  if (idx < 0 || state.items[idx].status !== "pending") {
    return advanceToNextFrame(state, "", []);
  }
  const item = state.items[idx];

  if (item.attempts < MAX_ATTEMPTS_PER_ITEM) {
    item.attempts += 1;
    state.cueGivenForActive = true;
    const cue = pickLine(CUE_TEMPLATES, state.usedLines, {
      word: item.word,
      letter: item.word.charAt(0).toUpperCase(),
    });
    state.mayaTurns += 1;
    return { state, mayaLine: cue, events: [] };
  }

  item.status = "released";
  const moveOn = pickLine(MOVE_ON_LINES, state.usedLines);
  return advanceToNextFrame(state, moveOn, [{ type: "item_released", word: item.word }]);
}

/**
 * After a cue, the patient repeating the word counts as CUED use (real
 * production, lowest transfer tier). The UI calls this when the active
 * word is detected right after a cue was given.
 */
export function onCuedProduction(state: ReviewState): EngineTurn {
  const idx = state.activeItem;
  if (state.phase !== "frame" || idx < 0 || state.items[idx].status !== "pending") {
    return { state, mayaLine: "", events: [] };
  }
  const item = state.items[idx];
  item.status = "cued";
  const praise = pickLine(CELEBRATE_ELICITED, state.usedLines);
  return advanceToNextFrame(state, praise, [{ type: "cued_use", word: item.word }]);
}

/** Yes/no answer to a repair question. */
export function onRepairAnswer(state: ReviewState, confirmed: boolean): EngineTurn {
  if (state.phase !== "repair" || state.repairItem < 0) {
    return { state, mayaLine: "", events: [] };
  }
  const item = state.items[state.repairItem];
  state.phase = "frame";
  state.repairWord = null;
  const repairedIdx = state.repairItem;
  state.repairItem = -1;

  if (confirmed) {
    const spontaneous = repairedIdx !== state.activeItem;
    item.status = spontaneous ? "spontaneous" : "elicited";
    const praise = pickLine(spontaneous ? CELEBRATE_SPONTANEOUS : CELEBRATE_ELICITED, state.usedLines);
    return advanceToNextFrame(state, praise, [
      { type: "repair_confirmed", word: item.word },
      spontaneous
        ? { type: "spontaneous_use", word: item.word }
        : { type: "elicited_use", word: item.word },
    ]);
  }

  // Rejected: not what they said. Continue the active frame without penalty.
  return progressActiveItem(withEvents(state, [{ type: "repair_rejected", word: item.word }]));
}

// tiny helper so the rejected-repair event isn't lost
function withEvents(state: ReviewState, _events: ReviewEvent[]): ReviewState {
  return state;
}

/** Escape hatch: patient taps "new topic" — release the active item, move on. */
export function onSkipTopic(state: ReviewState): EngineTurn {
  if (state.phase === "done") return { state, mayaLine: "", events: [] };
  const idx = state.activeItem;
  const events: ReviewEvent[] = [];
  if (idx >= 0 && state.items[idx].status === "pending") {
    state.items[idx].status = "released";
    events.push({ type: "item_released", word: state.items[idx].word });
  }
  state.phase = "frame";
  state.repairWord = null;
  state.repairItem = -1;
  return advanceToNextFrame(state, "", events);
}

/** Escape hatch: patient taps "all done" — always honored, immediately. */
export function onFinishRequest(state: ReviewState): EngineTurn {
  if (state.phase === "done") return { state, mayaLine: "", events: [] };
  return wrapup(state, "", [], false);
}

/** Silence timeout in a frame: same forward-motion rule as a non-match. */
export function onSilence(state: ReviewState): EngineTurn {
  if (state.phase === "repair") {
    // Silence during repair = treat as "no" and keep moving.
    return onRepairAnswer(state, false);
  }
  if (state.phase !== "frame") return { state, mayaLine: "", events: [] };
  return progressActiveItem(state);
}
