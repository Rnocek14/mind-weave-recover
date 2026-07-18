/**
 * Review queue — device-local record of TODAY's practiced words, feeding the
 * post-practice review conversation. Games call recordPracticedWord() as
 * trials complete; the review page drains the queue.
 *
 * localStorage-only by design (no DB writes): the review conversation is a
 * practice surface, not a clinical record — its transfer telemetry can be
 * promoted to real telemetry once validated.
 */

export interface PracticedWord {
  word: string;
  category: string;
  struggled: boolean;
  /** Local YYYY-MM-DD the word was practiced. */
  day: string;
}

const QUEUE_KEY = "reviewQueue_practicedWords";
const MAX_QUEUE = 30;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function load(): PracticedWord[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.word === "string") : [];
  } catch {
    return [];
  }
}

function save(queue: PracticedWord[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    /* storage unavailable */
  }
}

/** Record one practiced word. Struggles overwrite successes for the same word. */
export function recordPracticedWord(word: string, category: string, struggled: boolean): void {
  const w = word.trim().toLowerCase();
  if (!w) return;
  const queue = load().filter((p) => p.day === today());
  const existing = queue.find((p) => p.word === w);
  if (existing) {
    existing.struggled = existing.struggled || struggled;
  } else {
    queue.push({ word: w, category, struggled, day: today() });
  }
  save(queue);
}

/** Today's practiced words, struggled-first. */
export function getTodaysPracticedWords(): PracticedWord[] {
  return load()
    .filter((p) => p.day === today())
    .sort((a, b) => Number(b.struggled) - Number(a.struggled));
}

/** Clear words consumed by a completed review. */
export function clearReviewedWords(words: string[]): void {
  const set = new Set(words.map((w) => w.toLowerCase()));
  save(load().filter((p) => !set.has(p.word)));
}
