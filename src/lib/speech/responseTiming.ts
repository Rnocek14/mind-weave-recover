/**
 * Time from the trial's existing start marker until the app accepts an answer.
 * This includes local recognition/end detection. It is not speech-onset time,
 * audio duration, or the time spent waiting for an analysis service.
 */
export interface ResponseTiming {
  version: 1;
  basis: 'trial_start_to_answer_acceptance';
  elapsedMs: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A real zero is evidence; missing, negative, and non-finite values are not. */
export function measuredResponseTimeMs(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function makeResponseTiming(elapsedMs: unknown): ResponseTiming | null {
  const value = measuredResponseTimeMs(elapsedMs);
  return value === null ? null : {
    version: 1, basis: 'trial_start_to_answer_acceptance', elapsedMs: value,
  };
}

/** Require an explicit recognized definition, not just a plausible number. */
export function parseResponseTiming(value: unknown): ResponseTiming | null {
  if (!record(value) || value.version !== 1 || value.basis !== 'trial_start_to_answer_acceptance') return null;
  return makeResponseTiming(value.elapsedMs);
}

/** Never infer patient timing from the historical analysis-completion column. */
export function readUtteranceResponseTimeMs(audioMeta: unknown): number | null {
  return record(audioMeta) ? parseResponseTiming(audioMeta.responseTiming)?.elapsedMs ?? null : null;
}

/** Keep the raw mean so callers preserve their existing rounding/thresholds. */
export function averageResponseTimeMs(values: readonly unknown[]): number | null {
  const measured = values.map(measuredResponseTimeMs).filter((value): value is number => value !== null);
  return measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : null;
}
