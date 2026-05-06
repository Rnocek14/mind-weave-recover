/**
 * flushMasteryShadow — fire-and-forget mastery layer recompute.
 *
 * Standalone function (not a hook) so it can be called from inside other
 * hooks' async callbacks (e.g. session lifecycle end). Shadow-mode only:
 * never throws, never affects gameplay.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  computeMastery,
  mapTrialToSkills,
  MASTERY_MODEL_VERSION,
  type MasteryRow,
  type MasteryTrial,
} from '@/lib/mastery';

function weekStart(d: Date = new Date()): string {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

export async function flushMasteryShadow(args: {
  sessionId: string;
  userId: string;
  profileId: string;
}): Promise<void> {
  const { sessionId, userId, profileId } = args;
  try {
    const { data: sessionLogs } = await supabase
      .from('adaptation_trial_logs')
      .select('exercise_slug, correct, cue_level, created_at, session_id, difficulty')
      .eq('session_id', sessionId);

    if (!sessionLogs || sessionLogs.length === 0) return;

    const exerciseSlugs = Array.from(
      new Set(sessionLogs.map(l => l.exercise_slug).filter(Boolean)),
    ) as string[];
    if (exerciseSlugs.length === 0) return;

    const sinceIso = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data: recentLogs } = await supabase
      .from('adaptation_trial_logs')
      .select('exercise_slug, correct, cue_level, created_at, session_id')
      .eq('user_id', userId)
      .in('exercise_slug', exerciseSlugs)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });

    const bySkill: Record<string, MasteryTrial[]> = {};
    for (const log of recentLogs ?? []) {
      const skills = mapTrialToSkills({ exerciseSlug: log.exercise_slug, inputs: null });
      const trial: MasteryTrial = {
        is_correct: !!log.correct,
        cue_level: log.cue_level ?? 0,
        created_at: log.created_at,
        session_id: log.session_id ?? null,
      };
      for (const s of skills) {
        if (!bySkill[s]) bySkill[s] = [];
        bySkill[s].push(trial);
      }
    }
    const skillList = Object.keys(bySkill);
    if (skillList.length === 0) return;

    const { data: existing } = await supabase
      .from('user_skill_mastery')
      .select('skill_slug, mastery_score, confidence, cue_independence, last_practiced_at, plateau_flag')
      .eq('profile_id', profileId)
      .in('skill_slug', skillList);

    const existingMap = new Map<string, Partial<MasteryRow>>();
    for (const row of existing ?? []) existingMap.set(row.skill_slug, row as any);

    const wk = weekStart();

    for (const skill of skillList) {
      const prev = (existingMap.get(skill) as MasteryRow | undefined) ?? null;
      const next = computeMastery(bySkill[skill], prev);

      await supabase.from('user_skill_mastery').upsert(
        {
          user_id: userId,
          profile_id: profileId,
          skill_slug: skill,
          mastery_score: next.mastery_score,
          confidence: next.confidence,
          trials_total: next.trials_total,
          trials_recent: next.trials_recent,
          accuracy_recent: next.accuracy_recent,
          cue_independence: next.cue_independence,
          velocity_per_week: next.velocity_per_week,
          plateau_flag: next.plateau_flag,
          fatigue_adjusted_score: next.fatigue_adjusted_score,
          support_dependency_trend: next.support_dependency_trend,
          last_practiced_at: next.last_practiced_at,
          model_version: MASTERY_MODEL_VERSION,
        } as any,
        { onConflict: 'profile_id,skill_slug' },
      );

      await supabase.from('skill_mastery_history').upsert(
        {
          user_id: userId,
          profile_id: profileId,
          skill_slug: skill,
          week_start: wk,
          mastery_score: next.mastery_score,
          confidence: next.confidence,
          trials_in_week: next.trials_recent,
          cue_independence: next.cue_independence,
          velocity_per_week: next.velocity_per_week,
          plateau_flag: next.plateau_flag,
          fatigue_adjusted_score: next.fatigue_adjusted_score,
          model_version: MASTERY_MODEL_VERSION,
        } as any,
        { onConflict: 'profile_id,skill_slug,week_start' },
      );
    }
  } catch (err) {
    console.warn('[Mastery] flush failed (silent)', err);
  }
}
