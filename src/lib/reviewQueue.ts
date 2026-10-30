/**
 * Device-local candidate words for optional post-lesson conversation.
 *
 * These records mean a target was *practiced/presented*, NOT that the patient
 * pronounced it, understood it, or used it independently. They are never
 * clinical accuracy or transfer evidence. The scored trial and adaptation
 * pathways remain completely separate.
 *
 * A lesson handoff reads only its session ID. Legacy direct /review-chat may
 * read today's queue (plus separately selected carryover); one completed
 * lesson must never drain a different lesson's words.
 */
import { scopedKey } from "./deviceStore";
import { recordTransferEvent } from "./transferLedger";

export type ReviewSourceGame = "photo_naming" | "two_clues" | "fix_sentence";
export type ReviewResponseMode = "speech" | "selection" | "text" | "unknown";

export interface PracticedWord {
  word: string;
  category: string;
  /** A prior difficulty/cue makes it worth revisiting; not a clinical score. */
  struggled: boolean;
  /** Local YYYY-MM-DD. */
  day: string;
  /** Set for new game evidence; absent on legacy data. */
  sessionId?: string;
  sourceGames?: ReviewSourceGame[];
  responseMode?: ReviewResponseMode;
}

export interface ReviewPracticeProvenance {
  sessionId?: string | null;
  sourceGame?: ReviewSourceGame;
  responseMode?: ReviewResponseMode;
}

const QUEUE_KEY = "reviewQueue_practicedWords";
const MAX_QUEUE = 30;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizedSessionId(value: string | null | undefined): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const id = value.trim();
  // This is local UI scoping, not authorization. Never accept arbitrary JSON
  // values or control characters as a practice session identity.
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id) ? id : undefined;
}

function load(): PracticedWord[] {
  try {
    const raw = localStorage.getItem(scopedKey(QUEUE_KEY));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is PracticedWord =>
      !!p && typeof p === "object" &&
      typeof p.word === "string" && typeof p.day === "string" &&
      typeof p.category === "string" && typeof p.struggled === "boolean"
    );
  } catch {
    return [];
  }
}

function save(queue: PracticedWord[]): boolean {
  try {
    localStorage.setItem(scopedKey(QUEUE_KEY), JSON.stringify(queue.slice(-MAX_QUEUE)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Queue an actual game target for later conversational practice.
 * Idempotent per session+word across repeated callbacks/blocks. Keep the
 * strongest "struggled" indicator for review prioritization, but NEVER
 * deduce speech production from a game's correctness or response mode.
 */
export function recordPracticedWord(
  word: string,
  category: string,
  struggled: boolean,
  provenance: ReviewPracticeProvenance = {},
): boolean {
  if (typeof word !== "string") return false;
  const w = word.trim().toLowerCase().replace(/\s+/g, " ");
  if (!w || w.length > 60 || typeof category !== "string") return false;
  const sessionId = normalizedSessionId(provenance.sessionId);
  // Reject a specified but malformed session ID: silently dropping scope
  // would mix data from unrelated lessons.
  if (provenance.sessionId && !sessionId) return false;

  const day = today();
  const queue = load().filter((p) => p.day === day);
  const existing = queue.find((p) => p.word === w && p.sessionId === sessionId);
  const game = provenance.sourceGame;
  const responseMode = provenance.responseMode ?? "unknown";
  if (existing) {
    existing.struggled = existing.struggled || struggled;
    if (game) {
      existing.sourceGames = [...new Set([...(existing.sourceGames ?? []), game])];
    }
    // Never upgrade a previous unknown/selected response to "speech"
    // without verified modality evidence. These are contextual hints only.
    if (!existing.responseMode) existing.responseMode = responseMode;
  } else {
    queue.push({
      word: w,
      category: category.trim() || "generic",
      struggled,
      day,
      ...(sessionId ? { sessionId } : {}),
      ...(game ? { sourceGames: [game] } : {}),
      responseMode,
    });
  }
  if (!save(queue)) return false;

  // This event means the item was PRACTICED, not confirmed spoken. Ledger
  // deduplicates practice per word/day and does not represent trial scores.
  recordTransferEvent(w, category, "practice");
  return true;
}

export function getTodaysPracticedWords(options: { sessionId?: string } = {}): PracticedWord[] {
  if (options.sessionId !== undefined && !normalizedSessionId(options.sessionId)) return [];
  return load()
    .filter((p) => p.day === today() &&
      (options.sessionId === undefined || p.sessionId === options.sessionId))
    .sort((a, b) => Number(b.struggled) - Number(a.struggled));
}

/** Consume only the items owned by the finished review session. */
export function clearReviewedWords(
  words: string[],
  options: { sessionId?: string } = {},
): void {
  if (options.sessionId !== undefined && !normalizedSessionId(options.sessionId)) return;
  const set = new Set(words.map((w) => w.trim().toLowerCase()));
  save(load().filter((p) =>
    !(set.has(p.word) && (options.sessionId === undefined || p.sessionId === options.sessionId))
  ));
}
