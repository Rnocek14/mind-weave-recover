/**
 * submitTrialReport — turn a one-tap report into a row worth acting on.
 *
 * The payload is built by a pure function so it can be asserted in tests, and
 * so the grouping key is computed identically for every reason code. The
 * insert is deliberately fire-and-forget from the caller's point of view: a
 * person who has just told us something is broken must never then be shown an
 * error they can do nothing about.
 */

import { supabase } from '@/integrations/supabase/client';
import type { LastTrial } from './lastTrial';
import { reportSignature, reportHeadline } from './reportSignature';

/**
 * What the person is telling us. Three codes, because they lead to three
 * different fixes — a matcher change, a scorer change, or a microphone /
 * recognition problem. Free text is optional and always secondary.
 */
export type ReportReason =
  /** Marked wrong; the person believes it was right. The common case. */
  | 'should_have_counted'
  /** Marked right; the person believes it wasn't. Rarer and more alarming. */
  | 'should_not_have_counted'
  /** Nothing was heard, or the wrong thing was heard. */
  | 'not_heard';

export interface TrialReportPayload {
  reason: ReportReason;
  signature: string;
  headline: string;
  exercise_slug: string;
  session_id: string | null;
  level: number;
  trial_index: number | null;
  stimulus_id: string | null;
  expected_response: string | null;
  user_response: string | null;
  browser_transcript: string | null;
  scored_correct: boolean;
  cue_level: number | null;
  note: string | null;
}

/** Pure: everything the row needs, derived from the trial plus the reason. */
export function buildTrialReport(
  trial: LastTrial,
  reason: ReportReason,
  note?: string | null
): TrialReportPayload {
  const sigInput = {
    exerciseSlug: trial.exerciseSlug,
    stimulusId: trial.stimulusId,
    expected: trial.expected,
    // The raw recognizer text is what the matcher actually saw, so it is the
    // honest basis for grouping. Fall back to the cleaned response.
    spoken: trial.browserTranscript ?? trial.userResponse,
    isCorrect: trial.isCorrect,
  };
  return {
    reason,
    // The reason is part of the group: the same word reported for two
    // different problems is two different bugs.
    signature: `${reason.slice(0, 3)}-${reportSignature(sigInput)}`,
    headline: reportHeadline(sigInput),
    exercise_slug: trial.exerciseSlug,
    session_id: trial.sessionId,
    level: trial.level,
    trial_index: trial.trialIndex,
    stimulus_id: trial.stimulusId,
    expected_response: trial.expected,
    user_response: trial.userResponse,
    browser_transcript: trial.browserTranscript,
    scored_correct: trial.isCorrect,
    cue_level: trial.cueLevel,
    note: note?.trim() ? note.trim().slice(0, 1000) : null,
  };
}

export interface SubmitResult {
  ok: boolean;
  id: string | null;
}

/**
 * Insert the report. Never throws — see the note above. A failure is logged
 * for us and invisible to the person, who has already done their part.
 */
export async function submitTrialReport(
  trial: LastTrial,
  reason: ReportReason,
  note?: string | null
): Promise<SubmitResult> {
  const payload = buildTrialReport(trial, reason, note);
  try {
    const { data, error } = await supabase
      .from('trial_reports' as never)
      .insert(payload as never)
      .select('id')
      .single();
    if (error) {
      console.warn('[trial_reports] insert failed', error.message);
      return { ok: false, id: null };
    }
    return { ok: true, id: (data as { id?: string } | null)?.id ?? null };
  } catch (err) {
    console.warn('[trial_reports] insert threw', err);
    return { ok: false, id: null };
  }
}

/** Attach a note to a report already sent. Same never-throw contract. */
export async function attachNote(reportId: string, note: string): Promise<boolean> {
  const trimmed = note.trim().slice(0, 1000);
  if (!trimmed) return false;
  try {
    const { error } = await supabase
      .from('trial_reports' as never)
      .update({ note: trimmed } as never)
      .eq('id', reportId);
    if (error) {
      console.warn('[trial_reports] note update failed', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
