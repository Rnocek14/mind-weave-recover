/**
 * The clause after "Recognition (tap) responses: n/m correct" in Session
 * Review. Pure so the wording can be tested against each evidence state.
 */
export interface RecognitionLineMetrics {
  /** Non-tap trials in the session, scored or not. */
  spokenTrials: number;
  /** Non-tap trials that count toward speech accuracy. */
  scoredSpokenTrials: number;
  /** Taps made after the microphone failed to score an attempted production. */
  scaffoldedTaps: number;
}

export function recognitionLineSuffix(m: RecognitionLineMetrics): string {
  if (m.scoredSpokenTrials > 0) return " — kept separate from speech accuracy above.";
  if (m.spokenTrials > 0) {
    const n = m.spokenTrials;
    return ` — ${n} spoken attempt${n === 1 ? "" : "s"} could not be scored (see excluded clips), so speech accuracy is not shown.`;
  }
  if (m.scaffoldedTaps > 0) {
    return " — the microphone did not pick up a scorable answer before these taps, so speech accuracy is not shown.";
  }
  return " — no spoken attempts this session, so speech accuracy is not shown.";
}
