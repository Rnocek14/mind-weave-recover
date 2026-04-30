/**
 * Perseveration detection — derived from ordered trial sequence.
 *
 * Clinical definition: the patient repeatedly produces the same wrong answer
 * across distinct targets (recurrent perseveration) — a sign of executive /
 * inhibitory control breakdown often seen in non-fluent aphasia.
 *
 * Heuristic: a trial is flagged perseverative when its (incorrect) transcript
 * matches the transcript of an earlier incorrect trial within the same session
 * AND the two trials had different target words.
 */

export interface PerseverationInput {
  attempt_id: string;
  target_word: string | null | undefined;
  transcript: string | null | undefined;
  is_correct: boolean | null | undefined;
}

export interface PerseverationResult {
  perseverativeAttemptIds: Set<string>;
  perseverationCount: number;
  /** Most-frequent perseverative response, if any */
  topPerseverativeResponse: string | null;
  topPerseverativeResponseCount: number;
}

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/[^a-z\s]/g, "").trim();

export function derivePerseveration(
  trials: PerseverationInput[]
): PerseverationResult {
  const seen = new Map<string, { target: string; attemptId: string }[]>();
  const flagged = new Set<string>();
  const responseCounts = new Map<string, number>();

  for (const t of trials) {
    if (t.is_correct) continue;
    const tx = norm(t.transcript);
    const tg = norm(t.target_word);
    if (!tx || tx.length < 2) continue;
    // Skip non-attempts
    if (/^(no response|nothing|i don'?t know)$/.test(tx)) continue;

    const prior = seen.get(tx) || [];
    // Perseverative if same wrong response was produced earlier for a different target
    const earlierDifferentTarget = prior.find((p) => p.target && p.target !== tg);
    if (earlierDifferentTarget) {
      flagged.add(t.attempt_id);
      flagged.add(earlierDifferentTarget.attemptId);
      responseCounts.set(tx, (responseCounts.get(tx) || 0) + 1);
    }
    prior.push({ target: tg, attemptId: t.attempt_id });
    seen.set(tx, prior);
  }

  let topResponse: string | null = null;
  let topCount = 0;
  for (const [resp, count] of responseCounts.entries()) {
    if (count > topCount) {
      topCount = count;
      topResponse = resp;
    }
  }

  return {
    perseverativeAttemptIds: flagged,
    perseverationCount: flagged.size,
    topPerseverativeResponse: topResponse,
    topPerseverativeResponseCount: topCount,
  };
}
