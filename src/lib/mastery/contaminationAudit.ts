/**
 * contaminationAudit — read-only audit for mastery quarantine integrity.
 *
 * Two checks:
 *  1. LOG SCAN: any recent adaptation_trial_logs from MASTERY_EXCLUDED_EXERCISES
 *     that, if not quarantined, *would* map to non-empty skill nodes. These are
 *     candidates for future contamination if the quarantine is ever removed
 *     without replacing the scoring contract.
 *  2. ROW SCAN: any user_skill_mastery / skill_mastery_history rows for skill
 *     nodes that the legacy mapping (pre-quarantine) would have routed
 *     conversation-* into — currently `discourse.narrative`. We can't tell
 *     post-hoc which writer produced a row, so we report counts and let a
 *     human decide whether cleanup is needed.
 *
 * Read-only. Never deletes. Never mutates gameplay.
 */
import { supabase } from '@/integrations/supabase/client';
import { isExcludedFromMastery, mapTrialToSkills } from './skillMapping';

// Skill nodes the legacy mapping (before quarantine) would have routed
// conversation_partner / conversation_coach into.
const LEGACY_CONTAMINATION_SLUGS = ['discourse.narrative'] as const;

// Canonical underscore form — matches what useAdaptationTrialLogger writes.
const QUARANTINED_SLUGS = ['conversation_partner', 'conversation_coach'] as const;

export interface ContaminationAuditReport {
  windowDays: number;
  generatedAt: string;
  logScan: {
    quarantinedTrialCount: number;
    bySlug: Record<string, number>;
    wouldMapIfUnquarantined: Array<{
      exerciseSlug: string;
      sampleSkillSlugs: string[];
    }>;
  };
  rowScan: {
    userSkillMastery: Array<{ skill_slug: string; rows: number }>;
    skillMasteryHistory: Array<{ skill_slug: string; rows: number }>;
  };
  verdict: 'clean' | 'suspicious' | 'contaminated';
  recommendations: string[];
}

export async function runMasteryContaminationAudit(
  windowDays = 30
): Promise<ContaminationAuditReport> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // 1) LOG SCAN
  const { data: logs } = await supabase
    .from('adaptation_trial_logs')
    .select('exercise_slug')
    .in('exercise_slug', QUARANTINED_SLUGS as unknown as string[])
    .gte('created_at', since);

  const bySlug: Record<string, number> = {};
  (logs ?? []).forEach((r: any) => {
    bySlug[r.exercise_slug] = (bySlug[r.exercise_slug] ?? 0) + 1;
  });

  // Hypothetical mapping check — temporarily bypass quarantine to see what
  // these trials *would* map to. We do this by calling mapTrialToSkills under
  // a synthetic slug that mirrors the original semantics but isn't quarantined.
  const wouldMapIfUnquarantined: Array<{ exerciseSlug: string; sampleSkillSlugs: string[] }> = [];
  for (const slug of QUARANTINED_SLUGS) {
    if (!isExcludedFromMastery(slug)) continue; // sanity
    // Use narrative_retell as the closest structured analog for shape inference.
    const sample = mapTrialToSkills({ exerciseSlug: 'narrative_retell', inputs: null });
    if (sample.length > 0) {
      wouldMapIfUnquarantined.push({ exerciseSlug: slug, sampleSkillSlugs: sample });
    }
  }

  // 2) ROW SCAN — count rows in suspicious skill nodes.
  const userSkillMastery: Array<{ skill_slug: string; rows: number }> = [];
  const skillMasteryHistory: Array<{ skill_slug: string; rows: number }> = [];
  for (const slug of LEGACY_CONTAMINATION_SLUGS) {
    const { count: usmCount } = await supabase
      .from('user_skill_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('skill_slug', slug);
    userSkillMastery.push({ skill_slug: slug, rows: usmCount ?? 0 });

    const { count: smhCount } = await supabase
      .from('skill_mastery_history')
      .select('id', { count: 'exact', head: true })
      .eq('skill_slug', slug);
    skillMasteryHistory.push({ skill_slug: slug, rows: smhCount ?? 0 });
  }

  const totalSuspiciousRows =
    userSkillMastery.reduce((s, r) => s + r.rows, 0) +
    skillMasteryHistory.reduce((s, r) => s + r.rows, 0);
  const totalQuarantinedTrials = Object.values(bySlug).reduce((a, b) => a + b, 0);

  let verdict: ContaminationAuditReport['verdict'] = 'clean';
  const recommendations: string[] = [];

  if (totalSuspiciousRows === 0 && totalQuarantinedTrials === 0) {
    verdict = 'clean';
    recommendations.push('No quarantined trials logged and no suspicious mastery rows. No action needed.');
  } else if (totalSuspiciousRows > 0 && totalQuarantinedTrials === 0) {
    verdict = 'suspicious';
    recommendations.push(
      `Found ${totalSuspiciousRows} row(s) in legacy contamination skill nodes (${LEGACY_CONTAMINATION_SLUGS.join(', ')}).`,
      'These may be from legitimate narrative-retell trials OR from pre-quarantine conversation-partner mapping.',
      'Manual review recommended. To inspect:',
      "  SELECT user_id, skill_slug, mastery_score, trials_in_week, created_at FROM user_skill_mastery WHERE skill_slug IN ('discourse.narrative') ORDER BY created_at;",
      "  SELECT user_id, skill_slug, week_start, mastery_score, trials_in_week FROM skill_mastery_history WHERE skill_slug IN ('discourse.narrative') ORDER BY week_start;",
      'If any rows predate the quarantine commit AND the user has no narrative-retell trial history, delete them via a clinician-approved migration.'
    );
  } else if (totalQuarantinedTrials > 0) {
    verdict = 'contaminated';
    recommendations.push(
      `Quarantined exercises produced ${totalQuarantinedTrials} adaptation_trial_logs in the last ${windowDays} days.`,
      'mapTrialToSkills() correctly returns [] so mastery rows should NOT have been written, but verify the writer respects the quarantine.',
      'Audit flushMasteryShadow if any new mastery rows appeared in this window.'
    );
  }

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    logScan: {
      quarantinedTrialCount: totalQuarantinedTrials,
      bySlug,
      wouldMapIfUnquarantined,
    },
    rowScan: { userSkillMastery, skillMasteryHistory },
    verdict,
    recommendations,
  };
}
