/**
 * Transfer Ledger — longitudinal memory for the transfer pipeline.
 *
 * Records every word-level event across days:
 *   practice   — produced in a drill (photo naming etc.)
 *   spontaneous / elicited / cued — produced in the review conversation
 *   released   — offered in conversation but didn't come
 *
 * From this history it derives the two things that didn't exist before:
 *
 *  1. CARRYOVER STATUS per word — is a practiced word actually surviving
 *     into conversation, or fading from use? (the per-word forgetting curve
 *     for real-world language, measured passively)
 *
 *  2. CLOSED-LOOP SCHEDULING — fading words are fed back into the next
 *     review conversation even when they weren't practiced today. The
 *     re-practice signal is real-world usage decay, not quiz scores.
 *
 * Device-local (localStorage) by design: this is the validation substrate
 * for the transfer metric. Promotion to server telemetry comes after the
 * metric earns trust (and, for minors, after the consent architecture).
 * All computation is pure with injectable dates for testability.
 */

export type TransferTier = "spontaneous" | "elicited" | "cued" | "released" | "practice";

export interface TransferEvent {
  /** Local day YYYY-MM-DD. */
  day: string;
  tier: TransferTier;
}

export interface WordLedger {
  word: string;
  category: string;
  events: TransferEvent[];
}

export type CarryoverStatus =
  | "new"      // practiced, but no conversational data yet
  | "strong"   // used in conversation (spontaneous/elicited) recently
  | "fading"   // conversational use is going stale relative to practice
  | "lost";    // repeatedly offered in conversation without production

export interface WordCarryover {
  word: string;
  category: string;
  status: CarryoverStatus;
  lastPracticeDay: string | null;
  lastConversationalUseDay: string | null;
  spontaneousCount: number;
  releasedCount: number;
}

export interface TransferTrendPoint {
  day: string;
  spontaneous: number;
  elicited: number;
  cued: number;
  released: number;
}

// ─── Tunables (calibration defaults, not validated constants) ──────────────

/** Conversational use within this many days of "now" counts as current. */
export const STRONG_WINDOW_DAYS = 7;
/** Practiced words with no conversational production for this long are fading. */
export const FADING_AFTER_DAYS = 5;
/** This many consecutive releases with no production = lost (needs re-drill). */
export const LOST_AFTER_RELEASES = 2;

// ─── Pure date helpers ─────────────────────────────────────────────────────

export function dayString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / 86400000);
}

// ─── Pure carryover computation ────────────────────────────────────────────

export function computeCarryover(ledger: WordLedger, today: string): WordCarryover {
  let lastPracticeDay: string | null = null;
  let lastConversationalUseDay: string | null = null;
  let spontaneousCount = 0;
  let trailingReleases = 0;

  for (const e of ledger.events) {
    if (e.tier === "practice") {
      if (!lastPracticeDay || e.day > lastPracticeDay) lastPracticeDay = e.day;
    } else if (e.tier === "released") {
      trailingReleases += 1;
    } else {
      // spontaneous / elicited / cued — real conversational production
      if (!lastConversationalUseDay || e.day > lastConversationalUseDay) {
        lastConversationalUseDay = e.day;
      }
      if (e.tier === "spontaneous") spontaneousCount += 1;
      trailingReleases = 0;
    }
  }

  let status: CarryoverStatus;
  if (trailingReleases >= LOST_AFTER_RELEASES) {
    status = "lost";
  } else if (
    lastConversationalUseDay &&
    daysBetween(lastConversationalUseDay, today) <= STRONG_WINDOW_DAYS
  ) {
    status = "strong";
  } else if (lastConversationalUseDay) {
    // Used in conversation once, but not recently.
    status = "fading";
  } else if (lastPracticeDay && daysBetween(lastPracticeDay, today) >= FADING_AFTER_DAYS) {
    // Practiced a while ago, never surfaced in conversation.
    status = "fading";
  } else {
    status = "new";
  }

  return {
    word: ledger.word,
    category: ledger.category,
    status,
    lastPracticeDay,
    lastConversationalUseDay,
    spontaneousCount,
    releasedCount: trailingReleases,
  };
}

/** Trendline: per-day conversational production counts over the last N days. */
export function computeTrend(ledgers: WordLedger[], today: string, days = 14): TransferTrendPoint[] {
  const byDay = new Map<string, TransferTrendPoint>();
  for (const ledger of ledgers) {
    for (const e of ledger.events) {
      if (e.tier === "practice") continue;
      const age = daysBetween(e.day, today);
      if (age < 0 || age >= days) continue;
      const point = byDay.get(e.day) ?? { day: e.day, spontaneous: 0, elicited: 0, cued: 0, released: 0 };
      point[e.tier] += 1;
      byDay.set(e.day, point);
    }
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

/**
 * Closed loop: which words should the NEXT review conversation include even
 * if they weren't practiced today? Fading words first (use decaying), then
 * lost words (need the conversational retry before re-drilling).
 */
export function selectCarryoverPriorities(
  ledgers: WordLedger[],
  today: string,
  limit: number,
): WordCarryover[] {
  const rank: Record<CarryoverStatus, number> = { fading: 0, lost: 1, new: 2, strong: 3 };
  return ledgers
    .map((l) => computeCarryover(l, today))
    .filter((c) => c.status === "fading" || c.status === "lost")
    .sort((a, b) => rank[a.status] - rank[b.status])
    .slice(0, limit);
}

// ─── Storage (thin, guarded, versioned) ────────────────────────────────────

import { scopedKey } from "./deviceStore";

const LEDGER_KEY = "transferLedger_v1";
const MAX_WORDS = 200;
const MAX_EVENTS_PER_WORD = 60;

function loadAll(): WordLedger[] {
  try {
    const raw = localStorage.getItem(scopedKey(LEDGER_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.word === "string" && Array.isArray(l.events))
      : [];
  } catch {
    return [];
  }
}

function saveAll(ledgers: WordLedger[]): void {
  try {
    const trimmed = ledgers.slice(-MAX_WORDS).map((l) => ({
      ...l,
      events: l.events.slice(-MAX_EVENTS_PER_WORD),
    }));
    localStorage.setItem(scopedKey(LEDGER_KEY), JSON.stringify(trimmed));
  } catch {
    /* storage unavailable */
  }
}

export function recordTransferEvent(
  word: string,
  category: string,
  tier: TransferTier,
  now: Date = new Date(),
): void {
  const w = word.trim().toLowerCase();
  if (!w) return;
  const ledgers = loadAll();
  let ledger = ledgers.find((l) => l.word === w);
  if (!ledger) {
    ledger = { word: w, category, events: [] };
    ledgers.push(ledger);
  }
  const day = dayString(now);
  // Practice events are deduped per day: drilling a word 20 times in one
  // session must not push its CONVERSATIONAL history out of the event cap
  // (which would silently corrupt the carryover status of the most-drilled
  // words). One practice event per word per day carries the same signal.
  if (tier === "practice" && ledger.events.some((e) => e.day === day && e.tier === "practice")) {
    return;
  }
  ledger.events.push({ day, tier });
  saveAll(ledgers);
}

export function getAllLedgers(): WordLedger[] {
  return loadAll();
}

export function getCarryoverReport(now: Date = new Date()): WordCarryover[] {
  return loadAll().map((l) => computeCarryover(l, dayString(now)));
}

export function getTransferTrend(now: Date = new Date(), days = 14): TransferTrendPoint[] {
  return computeTrend(loadAll(), dayString(now), days);
}

export function getCarryoverPriorityWords(limit = 2, now: Date = new Date()): WordCarryover[] {
  return selectCarryoverPriorities(loadAll(), dayString(now), limit);
}
