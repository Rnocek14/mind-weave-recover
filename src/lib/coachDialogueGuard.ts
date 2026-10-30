/**
 * A small, deterministic last-mile guard for AI-generated conversation turns.
 * The language model can vary its wording; it cannot make a patient answer
 * the same question indefinitely. This is coaching UX protection, NOT a
 * clinical scoring or speech-recognition decision.
 *
 * Only pass conversational AI replies here, never content in a scored game.
 */
export interface CoachDialogueGuardResult {
  text: string;
  reason: "ok" | "empty" | "multiple_questions" | "repeated_question";
}

const SUPPORT_LINES = [
  "Let's try a different way. One word is enough, or you can skip.",
  "We can change the topic or take a break. You decide.",
  "We'll leave that question for now. It's okay to stop.",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^(okay|ok|great|well|sure|thanks|right|so|now|hmm|yes)[,.!\s]+/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One question from a single Maya turn, ignoring preceding acknowledgments. */
function questionOf(text: string): string | null {
  const questions = text.match(/[^?]*\?/g);
  if (!questions?.length) return null;
  const last = questions[questions.length - 1];
  const sentence = last.split(/[.!]/).pop() || last;
  return normalize(sentence);
}

function questionIsRepeated(question: string, prior: string): boolean {
  const other = questionOf(prior);
  if (!other) return false;
  if (question === other) return true;

  // Tight token overlap catches "Tell me about your day" versus
  // "So, tell me about your day" without treating merely related
  // follow-ups as the same question.
  const a = new Set(question.split(" ").filter(Boolean));
  const b = new Set(other.split(" ").filter(Boolean));
  if (a.size < 4 || b.size < 4) return false;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(a.size, b.size) >= 0.85;
}

function supportLine(recent: string[]): string {
  const recentSupports = recent.filter((line) => SUPPORT_LINES.includes(line as typeof SUPPORT_LINES[number])).length;
  return SUPPORT_LINES[Math.min(recentSupports, SUPPORT_LINES.length - 1)];
}

export function guardCoachDialogue(
  candidate: string,
  recentMayaLines: string[],
  patientSaid: string,
): CoachDialogueGuardResult {
  const text = candidate.trim();
  const recent = recentMayaLines.slice(-6);

  if (!text) return { text: supportLine(recent), reason: "empty" };

  // Asking for a repeat is a patient-initiated accommodation. Do not reject
  // one intentional repetition just because the preceding question matches.
  const requestedRepeat = /\b(repeat|say that again|didn['\u2019]t hear|can['\u2019]t hear)\b/i.test(patientSaid);
  const question = questionOf(text);
  if (question && !requestedRepeat && recent.some((line) => questionIsRepeated(question, line))) {
    return { text: supportLine(recent), reason: "repeated_question" };
  }

  if ((text.match(/\?/g) ?? []).length > 1) {
    // A single short accommodation beats choosing arbitrarily between two
    // questions and unintentionally penalizing someone who answers only one.
    return { text: supportLine(recent), reason: "multiple_questions" };
  }

  return { text, reason: "ok" };
}
