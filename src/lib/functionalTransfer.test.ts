import { describe, expect, it } from "vitest";
import {
  FUNCTIONAL_SCRIPTS,
  containsFunctionalIntentCandidate,
  startFunctionalProbe,
  receiveProbeTranscript,
  requestProbeHint,
  confirmProbeHearing,
  skipFunctionalContext,
  reportUnverifiedProbeAttempt,
  summarizeFunctionalProbe,
} from "./functionalTransfer";

describe("experimental functional communication transfer (not a clinical score)", () => {
  it("uses existing functional scripts in TWO untrained situations without repeating the target phrase", () => {
    const s = FUNCTIONAL_SCRIPTS.need_help;
    expect(s.contexts).toHaveLength(2);
    expect(s.contexts[0].partner).not.toBe(s.contexts[1].partner);
    for (const context of s.contexts) {
      expect(context.prompt.toLowerCase()).not.toContain(s.trainedPhrase.toLowerCase());
    }
  });

  it.each([
    ["need_help", "Help me please"],
    ["need_help", "Need help"],
    ["need_help", "Could you please help"],
    ["need_help", "Can you carry this for me"],
    ["im_thirsty", "I'm thirsty"],
    ["im_thirsty", "Water"],
    ["im_thirsty", "Could I have a glass of water"],
    ["need_more_time", "Please give me a minute"],
    ["need_more_time", "Just a second"],
  ] as const)("flags %s spoken as %s only as a lexical candidate", (id, utterance) => {
    expect(containsFunctionalIntentCandidate(id, utterance)).toBe(true);
  });

  it.each([
    ["need_help", "I do not need help"],
    ["need_help", "The green table sings loudly"],
    ["im_thirsty", "I don't want water"],
    ["im_thirsty", "I feel cold"],
    ["need_more_time", "No need to wait"],
    ["need_more_time", "Those four blue elephants"],
  ] as const)("never treats %s / %s as an intent candidate", (id, utterance) => {
    expect(containsFunctionalIntentCandidate(id, utterance)).toBe(false);
  });

  it("requires patient recognition confirmation; no score from an ASR guess alone", () => {
    const initial = startFunctionalProbe("need_help");
    const heard = receiveProbeTranscript(initial, "Help me please", 0.33);
    expect(heard.phase).toBe("confirm_heard");
    expect(heard.evidence).toEqual([]);
    const confirmed = confirmProbeHearing(heard, true);
    expect(confirmed.phase).toBe("asking");
    expect(confirmed.contextIndex).toBe(1);
    expect(confirmed.evidence[0]).toMatchObject({
      contextIndex: 0, observation: "intent_candidate",
      confirmedHeard: true, supportLevel: 0, asrConfidence: 0.33,
    });
    const report = summarizeFunctionalProbe(confirmed);
    expect(report.unpromptedCandidates).toBe(1);
    expect(report.contextsTried).toBe(1);
  });

  it("does not label a clear spoken attempt as incorrect if the fixed phrase matcher misses its meaning", () => {
    const state = startFunctionalProbe("need_help");
    const heard = receiveProbeTranscript(state, "A little hand would be great", null);
    const next = confirmProbeHearing(heard, true);
    expect(next.evidence).toHaveLength(1);
    expect(next.evidence[0].observation).toBe("needs_review");
    expect(next.evidence[0].asrConfidence).toBeNull();
    expect(summarizeFunctionalProbe(next).unpromptedCandidates).toBe(0);
  });

  it("never counts a modeled response as independent, and no more than two hints exist", () => {
    const original = startFunctionalProbe("im_thirsty");
    const hint1 = requestProbeHint(original);
    const hint2 = requestProbeHint(hint1);
    expect(hint1.supportLevel).toBe(1);
    expect(hint2.supportLevel).toBe(2);
    expect(requestProbeHint(hint2)).toBe(hint2);
    const next = confirmProbeHearing(receiveProbeTranscript(hint2, "I'm thirsty", 0.91), true);
    expect(summarizeFunctionalProbe(next)).toMatchObject({
      unpromptedCandidates: 0, supportedCandidates: 1,
    });
    expect(next.contextIndex).toBe(1);
    expect(next.supportLevel).toBe(0);
  });

  it("bounds rejected ASR hypotheses and does not turn repeated recognition failures into language failure", () => {
    const original = startFunctionalProbe("need_more_time");
    const rejected = confirmProbeHearing(
      receiveProbeTranscript(original, "some unrelated guess", 0.8), false,
    );
    expect(rejected.phase).toBe("asking");
    expect(rejected.contextIndex).toBe(0);
    expect(rejected.recognitionRejections).toBe(1);
    expect(rejected.evidence).toHaveLength(0);
    const exhausted = confirmProbeHearing(
      receiveProbeTranscript(rejected, "another incorrect guess", 0.8), false,
    );
    expect(exhausted.contextIndex).toBe(1);
    expect(exhausted.evidence[0].observation).toBe("recognition_rejected");
    expect(summarizeFunctionalProbe(exhausted).unpromptedCandidates).toBe(0);
  });

  it("keeps unaudited/self-reported and skipped attempts outside independent results", () => {
    const first = reportUnverifiedProbeAttempt(startFunctionalProbe("need_help"));
    expect(first.evidence[0]).toMatchObject({
      observation: "unverified_attempt", confirmedHeard: false,
    });
    const ended = skipFunctionalContext(first);
    expect(ended.phase).toBe("done");
    expect(ended.evidence).toHaveLength(2);
    expect(ended.evidence[1].observation).toBe("skipped");
    expect(summarizeFunctionalProbe(ended)).toEqual({
      contextsTried: 2, unpromptedCandidates: 0, supportedCandidates: 0,
      needsReview: 0, unverifiedOrSkipped: 2,
    });
    expect(skipFunctionalContext(ended)).toBe(ended);
    expect(receiveProbeTranscript(ended, "I need help", 1)).toBe(ended);
  });

  it("blocks empty, duplicate-phase, and invalid-confidence acceptance", () => {
    const initial = startFunctionalProbe("need_help");
    expect(receiveProbeTranscript(initial, " ", 0.99)).toBe(initial);
    const heard = receiveProbeTranscript(initial, "help", 2.0);
    expect(heard.pendingConfidence).toBeNull();
    expect(receiveProbeTranscript(heard, "help", 0.99)).toBe(heard);
    expect(skipFunctionalContext(heard)).toBe(heard);
    const next = confirmProbeHearing(heard, true);
    expect(confirmProbeHearing(next, true)).toBe(next);
  });
});
