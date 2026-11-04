/**
 * Conversation Partner report math.
 * These are practice-session WORD and response-count measures, not clinical
 * fluency, speech-duration, or language recovery metrics.
 */
export interface ConversationPartnerMetrics {
  totalUserWords: number;
  totalAIWords: number;
  avgLatencyMs: number;
  turnsCompleted: number;
  nudgesGiven: number;
  completionRate: number; // % turns with at least two recognized words
}

export function countConversationWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Must be calculated in the same processing callback as the final turn.
 * Reading React state immediately after setState misses that last turn.
 */
export function afterPartnerPatientTurn(
  prior: ConversationPartnerMetrics,
  input: {
    words: number;
    turnNumber: number;
    measuredLatencies: readonly number[];
    repliesWithTwoWords: number;
  },
): ConversationPartnerMetrics {
  const average = input.measuredLatencies.length
    ? input.measuredLatencies.reduce((sum, n) => sum + n, 0) / input.measuredLatencies.length
    : 0;
  return {
    ...prior,
    totalUserWords: prior.totalUserWords + input.words,
    turnsCompleted: input.turnNumber,
    avgLatencyMs: average,
    completionRate: (input.repliesWithTwoWords / Math.max(input.turnNumber, 1)) * 100,
  };
}

/**
 * Include the last response from Maya, which has already been spoken to the
 * patient but is not yet reflected in the render-closure's metrics state.
 * The word ratio is NOT talk time.
 */
export function completedPartnerSessionMetrics(
  patientTurnMetrics: ConversationPartnerMetrics,
  finalAIText: string,
) {
  const totalAIWords = patientTurnMetrics.totalAIWords + countConversationWords(finalAIText);
  return {
    turnsCompleted: patientTurnMetrics.turnsCompleted,
    avgLatencyMs: patientTurnMetrics.avgLatencyMs,
    completionRate: patientTurnMetrics.completionRate,
    userAIRatio: totalAIWords > 0
      ? (patientTurnMetrics.totalUserWords / totalAIWords) * 100
      : 0,
  };
}
