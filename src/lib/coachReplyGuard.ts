/**
 * Final conversational-output guard for the ACTIVE Conversation Coach.
 * The LLM and orchestrator may both produce sensible individual turns while
 * still repeating the same question over several turns. This pure layer
 * catches observable repetition without changing scoring or exercise routing.
 *
 * It is deliberately conservative: only duplicate lines or very similar
 * question intent are rewritten. A prompt-model clinical evaluation is still
 * needed; these rules are not a semantic understanding model.
 */

export interface CoachReplyGuardInput {
  proposed: string;
  recentMaya: string[];
  /** A direct request to repeat is an accessibility accommodation, not a loop. */
  patientReply?: string;
}

export type CoachReplyGuardReason =
  | "duplicate_reply"
  | "repeated_question"
  | "multiple_questions"
  | "generic_loop"
  | null;

export interface CoachReplyGuardResult {
  text: string;
  reason: CoachReplyGuardReason;
}

const STOPWORDS = new Set([
  "what", "when", "where", "which", "why", "how", "who", "did", "does",
  "have", "has", "are", "were", "is", "the", "this", "that", "your",
  "you", "can", "could", "would", "will", "tell", "more", "about",
  "and", "for", "with", "please", "some", "then", "there", "from",
]);

function normalized(text: string): string {
  return text.toLowerCase()
    .replace(/\bwhat's\b/g, "what is")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lastQuestion(text: string): string | null {
  const questions = text.match(/[^.!?]*\?/g);
  return questions?.length ? normalized(questions[questions.length - 1]) : null;
}

function sameQuestion(a: string, b: string): boolean {
  if (a === b) return true;
  // An open question turning into a yes/no question can be intentional
  // scaffolding, not repetition. Preserve that change in communication demand.
  const questionType = (value: string) =>
    value.match(/^(what|when|where|which|why|how|who|do|did|does|is|are|can|could|would|will)\b/)?.[1] ?? "";
  if (questionType(a) !== questionType(b)) return false;
  const content = (value: string) =>
    new Set(value.split(" ").filter((word) => word.length > 2 && !STOPWORDS.has(word)));
  const left = content(a);
  const right = content(b);
  if (left.size < 2 || right.size < 2) return false;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / new Set([...left, ...right]).size >= 0.8;
}

const NON_LOOPING_REPAIRS = [
  "Let's try another way. You can answer with one word.",
  "We don't need to repeat that. Would a hint help?",
  "We can move on. You can choose another topic or take a break.",
  "Let's keep this simple. You can describe it instead of naming it.",
];

const GENERIC_PROMPT = /\b(tell me more|what else|anything else|say more|what do you think|what about that|what comes to mind|go on)\b/i;
const MINIMAL_REPLY = /^(yes|yeah|no|nope|okay|ok|um+|uh+|hmm+|i don'?t know|not sure|pass|nothing|sorry)[.!?\s]*$/i;

function chooseRepair(recentMaya: string[]): string {
  const recent = new Set(recentMaya.map(normalized));
  return NON_LOOPING_REPAIRS.find((line) => !recent.has(normalized(line)))
    ?? "We can stop this topic. Choose another activity or finish the chat.";
}

/** Call after Maya Speech Gate, before displaying, speaking, or logging text. */
export function guardCoachReply({ proposed, recentMaya, patientReply = "" }: CoachReplyGuardInput): CoachReplyGuardResult {
  const text = proposed.trim();
  if (!text) return { text, reason: null };

  // One question per turn keeps instructions manageable for aphasia.
  const firstQuestion = text.indexOf("?");
  const multipleQuestions = firstQuestion >= 0 && text.indexOf("?", firstQuestion + 1) >= 0;
  const candidate = multipleQuestions ? text.slice(0, firstQuestion + 1).trim() : text;
  const recent = recentMaya.slice(-4);
  const isDuplicate = recent.slice(-2).some((previous) => normalized(previous) === normalized(candidate));
  const question = lastQuestion(candidate);
  const wasAsked = Boolean(question && recent.some((previous) => {
    const earlier = lastQuestion(previous);
    return earlier !== null && sameQuestion(question, earlier);
  }));

  // Repeating a prompt because the patient ASKED to hear it again is allowed.
  const explicitRepeatRequest = /^(please\s+)?(repeat( (that|the question))?|say (that|it) again|what did you say|i (didn't|did not|can't) hear( you)?|pardon|what)[?.!\s]*$/i.test(patientReply.trim());
  if ((isDuplicate || wasAsked) && !explicitRepeatRequest) {
    return {
      text: chooseRepair(recent),
      reason: isDuplicate ? "duplicate_reply" : "repeated_question",
    };
  }

  // Several different generic follow-ups after repeated one-word replies
  // are still a loop, even when lexical similarity is low.
  const genericCount = recent.filter((line) => GENERIC_PROMPT.test(line)).length;
  if (!explicitRepeatRequest && GENERIC_PROMPT.test(candidate) &&
      MINIMAL_REPLY.test(patientReply.trim()) && genericCount >= 2) {
    return { text: chooseRepair(recent), reason: "generic_loop" };
  }

  return { text: candidate, reason: multipleQuestions ? "multiple_questions" : null };
}
