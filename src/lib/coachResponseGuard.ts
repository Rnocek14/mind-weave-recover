/**
 * Dialogue-only safety guard for generated Conversation Coach replies.
 *
 * Does not classify patient competence, alter clinical cues or progression,
 * or infer that a communication attempt succeeded. It only keeps one Maya
 * response from becoming a repetitive or overwhelming conversational prompt.
 */

export interface CoachResponseGuardInput {
  candidate: string;
  recentMayaLines: string[];
  lastPatientUtterance: string;
}

export interface CoachResponseGuardResult {
  text: string;
  changed: boolean;
  reason: "none" | "repeated_question" | "generic_loop" | "multiple_questions";
}

const REPEAT_REQUEST = /\b(repeat( that| it)?|say that again|say it again|one more time|what did you (just )?say|didn'?t hear)\b/i;
const GENERIC_PROBE = /\b(tell me more|anything else|what else|say more|what do you think|what about that)\b/i;
const SUPPORT_LINES = [
  "Let's try a shorter answer. One word is enough.",
  "We can make this easier. Would a yes-or-no question help?",
  "We can pause the questions here. Tap End Chat whenever you're ready.",
] as const;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’']/g, "'")
    .replace(/\b(can|could|would|please|maybe|okay|now|just)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function firstQuestion(line: string): string | null {
  const pos = line.indexOf("?");
  if (pos < 0) return null;
  const before = line.slice(0, pos + 1);
  const sentenceStart = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"));
  return before.slice(sentenceStart + 1).trim();
}

function similarQuestions(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const tokensA = new Set(left.split(" ").filter(Boolean));
  const tokensB = new Set(right.split(" ").filter(Boolean));
  if (Math.min(tokensA.size, tokensB.size) < 4) return false;
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union >= 0.75;
}

function supportLine(history: string[]): string {
  const recent = history.slice(-8).map(normalize);
  return SUPPORT_LINES.find((line) => !recent.includes(normalize(line)))
    ?? "It's okay to pause here. Tap End Chat when you're ready.";
}

function isMinimalPatientReply(reply: string): boolean {
  return /^(yes|yeah|no|nope|okay|ok|um+|uh+|hmm+|what|i don'?t know|not sure|pass|nothing|sorry)[.!? ]*$/i.test(reply.trim());
}

export function guardCoachResponse(input: CoachResponseGuardInput): CoachResponseGuardResult {
  const candidate = input.candidate.trim();
  if (!candidate) return { text: input.candidate, changed: false, reason: "none" };

  const recent = input.recentMayaLines.slice(-6);
  // Explicit requests to repeat are legitimate accessibility behavior.
  if (REPEAT_REQUEST.test(input.lastPatientUtterance)) {
    return { text: input.candidate, changed: false, reason: "none" };
  }

  const question = firstQuestion(candidate);
  const sameQuestion = question !== null && recent.some((line) => {
    const priorQuestion = firstQuestion(line);
    return priorQuestion !== null && similarQuestions(question, priorQuestion);
  });
  const repeatedStatement = question === null && recent
    .slice(-3).some((line) => normalize(line) === normalize(candidate));

  if (sameQuestion || repeatedStatement) {
    return { text: supportLine(recent), changed: true, reason: "repeated_question" };
  }

  const genericLoop = question !== null &&
    isMinimalPatientReply(input.lastPatientUtterance) &&
    GENERIC_PROBE.test(question) &&
    recent.slice(-3).filter((line) => GENERIC_PROBE.test(firstQuestion(line) ?? "")).length >= 2;
  if (genericLoop) {
    return { text: supportLine(recent), changed: true, reason: "generic_loop" };
  }

  // Generated prose can inadvertently ask a multi-part question. Return one
  // simple prompt rather than discard or misrepresent the patient's answer.
  if ((candidate.match(/\?/g) ?? []).length > 1) {
    return {
      text: "I asked too much at once. Would a shorter question help?",
      changed: true,
      reason: "multiple_questions",
    };
  }

  return { text: input.candidate, changed: false, reason: "none" };
}
