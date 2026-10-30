/**
 * Experimental, IN-APP functional phrase probe.
 *
 * This does not score aphasia severity, speech production, everyday carryover,
 * or clinical readiness. An exact/semantic-pattern match to a browser transcript
 * is only an unvalidated CANDIDATE. Patient confirmation verifies what the
 * browser heard, not whether the intended message actually landed.
 *
 * A fixed two-context exchange is deliberately separate from the word-review
 * queue, clinical progression, and the free-form Maya coach. Prompts never
 * show the trained phrase unless the patient requests a modeled cue.
 */

export const FUNCTIONAL_SCRIPT_IDS = ["need_help", "im_thirsty", "need_more_time"] as const;
export type FunctionalScriptId = (typeof FUNCTIONAL_SCRIPT_IDS)[number];

export interface FunctionalContext {
  partner: string;
  prompt: string;
}

export interface FunctionalScript {
  title: string;
  trainedPhrase: string;
  contexts: readonly [FunctionalContext, FunctionalContext];
  hints: readonly [string, string];
}

export const FUNCTIONAL_SCRIPTS: Record<FunctionalScriptId, FunctionalScript> = {
  need_help: {
    title: "Asking for help",
    trainedPhrase: "I need help",
    contexts: [
      { partner: "Friend", prompt: "You're carrying a heavy box. A friend is nearby. What could you say?" },
      { partner: "Neighbor", prompt: "A jar won't open. Your neighbor is with you. What would you say?" },
    ],
    hints: [
      "You can ask the other person to do something for you.",
      "If useful, try saying: I need help.",
    ],
  },
  im_thirsty: {
    title: "Asking for a drink",
    trainedPhrase: "I'm thirsty",
    contexts: [
      { partner: "Friend", prompt: "You're sitting with a friend and want something to drink. What would you say?" },
      { partner: "Server", prompt: "You're at a cafe and want something to sip. What could you say?" },
    ],
    hints: [
      "You can tell the person what you would like to have.",
      "If useful, try saying: I'm thirsty.",
    ],
  },
  need_more_time: {
    title: "Asking for more time",
    trainedPhrase: "I need a little more time",
    contexts: [
      { partner: "Friend", prompt: "A friend asks a question before you're ready to answer. What could you say?" },
      { partner: "Neighbor", prompt: "Someone expects an answer right away, but you're still thinking. What would you say?" },
    ],
    hints: [
      "You can ask the other person to pause for you.",
      "If useful, try saying: I need a little more time.",
    ],
  },
};

export function isFunctionalScriptId(value: unknown): value is FunctionalScriptId {
  return typeof value === "string" &&
    (FUNCTIONAL_SCRIPT_IDS as readonly string[]).includes(value);
}

export type ProbePhase = "asking" | "confirm_heard" | "done";
export type ProbeObservation =
  | "intent_candidate" // lexical cue suggests intent; NOT independently validated
  | "needs_review"     // patient confirmed transcript, but rubric cannot classify
  | "recognition_rejected"
  | "unverified_attempt"
  | "skipped";

export interface ProbeEvidence {
  contextIndex: number;
  observation: ProbeObservation;
  supportLevel: 0 | 1 | 2;
  /** Browser-confidence is descriptive, never a clinical reliability threshold. */
  asrConfidence: number | null;
  confirmedHeard: boolean;
}

export interface FunctionalProbeState {
  scriptId: FunctionalScriptId;
  contextIndex: number;
  phase: ProbePhase;
  supportLevel: 0 | 1 | 2;
  recognitionRejections: number;
  pendingTranscript: string | null;
  pendingConfidence: number | null;
  evidence: ProbeEvidence[];
}

export function startFunctionalProbe(scriptId: FunctionalScriptId): FunctionalProbeState {
  return {
    scriptId, contextIndex: 0, phase: "asking",
    supportLevel: 0, recognitionRejections: 0,
    pendingTranscript: null, pendingConfidence: null, evidence: [],
  };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Conservative lexical candidate detection, not a clinical semantic judge.
 * Non-matches are "needs review", NEVER evidence that a person failed.
 * No substring matching, no "3 words must be meaningful" fallback.
 */
export function containsFunctionalIntentCandidate(scriptId: FunctionalScriptId, transcript: string): boolean {
  const text = normalize(transcript);
  if (!text) return false;
  switch (scriptId) {
    case "need_help":
      if (/\b(don't|do not|no) (need|want) (any |your )?help\b/.test(text)) return false;
      return /\b(help me|help please|need help|some help|assistance|assist me|lend me a hand|give me a hand)\b/.test(text) ||
        /\b(can|could|would|will) you (please )?(help|open|carry|lift|hold|move|fix)\b/.test(text) ||
        /\b(open|carry|lift|hold|move|fix) (it|this|that) (for me|please)\b/.test(text) ||
        /^help$/.test(text);
    case "im_thirsty":
      if (/\b(not thirsty|don't want (any )?(water|a drink)|no water)\b/.test(text)) return false;
      return /^water$/.test(text) || /\b(thirsty|water please|drink please|something to drink|some water|a glass of water|a drink|a juice|water for me|could i have water|can i have water)\b/.test(text);
    case "need_more_time":
      if (/\b(don't wait|no need to wait|i have enough time)\b/.test(text)) return false;
      return /\b(more time|hold on|wait please|one moment|a moment please|give me a (second|minute|moment)|need (a|one) (second|minute|moment)|not yet|slow down|just a second|wait a minute)\b/.test(text);
  }
}

export function receiveProbeTranscript(
  state: FunctionalProbeState, transcript: string, confidence: number | null,
): FunctionalProbeState {
  if (state.phase !== "asking" || typeof transcript !== "string") return state;
  const captured = transcript.trim().slice(0, 250);
  if (!captured) return state;
  const safeConfidence = typeof confidence === "number" && Number.isFinite(confidence) &&
    confidence >= 0 && confidence <= 1 ? confidence : null;
  return {
    ...state, phase: "confirm_heard",
    pendingTranscript: captured, pendingConfidence: safeConfidence,
  };
}

function completeContext(
  state: FunctionalProbeState, observation: ProbeObservation, confirmedHeard: boolean,
): FunctionalProbeState {
  if (state.phase === "done") return state;
  const entry: ProbeEvidence = {
    contextIndex: state.contextIndex, observation,
    supportLevel: state.supportLevel, confirmedHeard,
    asrConfidence: state.pendingConfidence,
  };
  const next = state.contextIndex + 1;
  return {
    ...state, contextIndex: next, phase: next >= 2 ? "done" : "asking",
    supportLevel: 0, recognitionRejections: 0,
    pendingTranscript: null, pendingConfidence: null,
    evidence: [...state.evidence, entry],
  };
}

export function confirmProbeHearing(state: FunctionalProbeState, heardCorrectly: boolean): FunctionalProbeState {
  if (state.phase !== "confirm_heard" || !state.pendingTranscript) return state;
  if (!heardCorrectly) {
    // Two rejected recognition attempts maximum per context. Do not trap a
    // patient in repeated ASR failure and do not call it incorrect language.
    if (state.recognitionRejections >= 1) return completeContext(state, "recognition_rejected", false);
    return {
      ...state, phase: "asking", recognitionRejections: state.recognitionRejections + 1,
      pendingTranscript: null, pendingConfidence: null,
    };
  }
  return completeContext(
    state,
    containsFunctionalIntentCandidate(state.scriptId, state.pendingTranscript)
      ? "intent_candidate" : "needs_review",
    true,
  );
}

export function requestProbeHint(state: FunctionalProbeState): FunctionalProbeState {
  if (state.phase !== "asking" || state.supportLevel >= 2) return state;
  return { ...state, supportLevel: (state.supportLevel + 1) as 1 | 2 };
}

export function skipFunctionalContext(state: FunctionalProbeState): FunctionalProbeState {
  return state.phase === "asking" ? completeContext(state, "skipped", false) : state;
}

export function reportUnverifiedProbeAttempt(state: FunctionalProbeState): FunctionalProbeState {
  return state.phase === "asking" ? completeContext(state, "unverified_attempt", false) : state;
}

export function summarizeFunctionalProbe(state: FunctionalProbeState) {
  return {
    contextsTried: state.evidence.length,
    unpromptedCandidates: state.evidence.filter(
      e => e.observation === "intent_candidate" && e.supportLevel === 0 && e.confirmedHeard,
    ).length,
    supportedCandidates: state.evidence.filter(
      e => e.observation === "intent_candidate" && e.supportLevel > 0 && e.confirmedHeard,
    ).length,
    needsReview: state.evidence.filter(e => e.observation === "needs_review").length,
    unverifiedOrSkipped: state.evidence.filter(
      e => e.observation === "unverified_attempt" ||
        e.observation === "recognition_rejected" || e.observation === "skipped",
    ).length,
  };
}
