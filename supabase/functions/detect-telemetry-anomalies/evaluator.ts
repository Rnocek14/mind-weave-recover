// Pure rule evaluators — no Deno or Supabase deps. Imported by index.ts and tests.
import { RULES, CHECKLIST_VERSION, ADOPTED_SLUGS, ARCHETYPE_AXIS_ALLOWED } from './rules.ts';

export interface TrialRow {
  id: string;
  session_id: string | null;
  user_id: string | null;
  exercise_slug: string | null;
  correct: boolean | null;
  response_text: string | null;
  trial_mode: string | null;
  graded_score: number | null;
  score_vector: Record<string, unknown> | null;
  signal_granularity: string | null;
  scaffold_level: number | null;
  dominant_axis: string | null;
  archetype: string | null;
  outputs: Record<string, unknown> | null;
  created_at: string;
}

export interface AnomalyInsert {
  rule_id: string;
  severity: string;
  scope: string;
  trial_log_id: string | null;
  session_id: string | null;
  user_id: string | null;
  exercise_slug: string | null;
  window_label: string | null;
  scope_ref_hash: string;
  observed: Record<string, unknown>;
  expected: Record<string, unknown>;
  checklist_version: string;
  detector_run_id: string;
}

function hash(parts: (string | null | undefined)[]): string {
  return parts.map((p) => p ?? '_').join('|');
}

export function evalTrial(t: TrialRow, runId: string): AnomalyInsert[] {
  const out: AnomalyInsert[] = [];
  const base = {
    trial_log_id: t.id,
    session_id: t.session_id,
    user_id: t.user_id,
    exercise_slug: t.exercise_slug,
    window_label: null,
    checklist_version: CHECKLIST_VERSION,
    detector_run_id: runId,
  };
  const push = (rid: keyof typeof RULES, observed: Record<string, unknown>, expected: Record<string, unknown>) => {
    const r = RULES[rid];
    out.push({ ...base, rule_id: r.id, severity: r.severity, scope: r.scope, scope_ref_hash: hash([r.id, t.id]), observed, expected });
  };

  if (t.signal_granularity === 'boolean' && (t.graded_score !== null || t.score_vector !== null)) {
    push('S6', { graded_score: t.graded_score, score_vector: t.score_vector }, { graded_score: null, score_vector: null });
  }
  if (t.signal_granularity === 'graded' && t.graded_score === null) {
    push('S7', { graded_score: null }, { graded_score: 'required' });
  }
  if (t.signal_granularity === 'multi-dimensional' && (t.score_vector === null || typeof t.score_vector !== 'object')) {
    push('S8', { score_vector: t.score_vector }, { score_vector: 'object required' });
  }
  const anyGranular = t.trial_mode || t.graded_score !== null || t.score_vector !== null || t.signal_granularity || t.scaffold_level !== null;
  if (anyGranular && (!t.archetype || !t.dominant_axis)) {
    push('S10', { archetype: t.archetype, dominant_axis: t.dominant_axis }, { archetype: 'required', dominant_axis: 'required' });
  }

  if (t.trial_mode === 'production' && t.correct === true && (!t.response_text || t.response_text.trim() === '')) {
    push('C1', { response_text: t.response_text }, { response_text: 'non-empty' });
  }
  if (t.trial_mode === 'scaffolded') {
    const hasSignal = (t.scaffold_level !== null && t.scaffold_level > 0) ||
      Boolean((t.outputs as { caregiver_rated?: unknown })?.caregiver_rated);
    if (!hasSignal) {
      push('C3', { scaffold_level: t.scaffold_level, outputs_keys: t.outputs ? Object.keys(t.outputs) : [] }, { scaffold_signal: 'required' });
    }
  }
  if (t.trial_mode === 'exposure' && t.correct !== null) {
    push('C4', { correct: t.correct }, { correct: null });
  }
  if (t.archetype && t.dominant_axis) {
    const allowed = ARCHETYPE_AXIS_ALLOWED[t.archetype];
    if (allowed && !allowed.includes(t.dominant_axis)) {
      const ruleId = t.archetype === 'performance-pressure' ? 'C7' : t.archetype === 'open-ended' ? null : 'C6';
      if (ruleId) push(ruleId as 'C6' | 'C7', { archetype: t.archetype, dominant_axis: t.dominant_axis }, { allowed_axes: allowed });
    }
  }
  if (t.archetype === 'open-ended' && t.signal_granularity === 'boolean') {
    push('C8', { signal_granularity: 'boolean' }, { signal_granularity: 'graded|multi-dimensional' });
  }
  return out;
}

export function evalSession(slug: string, sessionId: string, userId: string | null, trials: TrialRow[], runId: string): AnomalyInsert[] {
  const out: AnomalyInsert[] = [];
  const base = {
    trial_log_id: null,
    session_id: sessionId,
    user_id: userId,
    exercise_slug: slug,
    window_label: null,
    checklist_version: CHECKLIST_VERSION,
    detector_run_id: runId,
  };
  const push = (rid: keyof typeof RULES, observed: Record<string, unknown>, expected: Record<string, unknown>) => {
    const r = RULES[rid];
    out.push({ ...base, rule_id: r.id, severity: r.severity, scope: r.scope, scope_ref_hash: hash([r.id, sessionId, slug]), observed, expected });
  };

  const total = trials.length;
  if (total === 0) return out;
  const counts = { production: 0, recognition: 0, scaffolded: 0, exposure: 0, mixed: 0, untyped: 0 };
  let prodCorrect = 0;
  let prodTotal = 0;
  for (const t of trials) {
    const m = t.trial_mode ?? 'untyped';
    if (m in counts) (counts as Record<string, number>)[m]++;
    else counts.untyped++;
    if (t.trial_mode === 'production') { prodTotal++; if (t.correct) prodCorrect++; }
  }

  if (!ADOPTED_SLUGS.has(slug)) return out;

  const scoredTotal = total - counts.untyped;
  if (scoredTotal > 0) {
    const prodShare = counts.production / scoredTotal;
    const recogShare = counts.recognition / scoredTotal;
    const scafShare = counts.scaffolded / scoredTotal;
    if (prodShare < 0.3) push('D1', { production_share: prodShare, scored: scoredTotal }, { min: 0.3 });
    if (recogShare > 0.6) push('D2', { recognition_share: recogShare, scored: scoredTotal }, { max: 0.6 });
    if (scafShare > 0.4) push('D3', { scaffolded_share: scafShare, scored: scoredTotal }, { max: 0.4 });
  }
  if (counts.untyped > 0) {
    push('D4', { untyped: counts.untyped, total }, { untyped: 0 });
  }
  if (prodTotal >= 10 && prodCorrect === prodTotal) {
    push('D7', { production_trials: prodTotal, accuracy: 1.0 }, { suspect: 'mislabeling' });
  }
  return out;
}
