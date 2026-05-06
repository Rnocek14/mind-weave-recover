/**
 * useMasteryWriter — Shadow-mode mastery layer writer.
 *
 * Called at session end. For each skill node touched by trials in this
 * session, recomputes mastery from the last 14 days of valid trials and
 * upserts user_skill_mastery + (if a new week) skill_mastery_history.
 *
 * Read-only with respect to gameplay: never mutates the in-session engine,
 * never blocks UI, and swallows errors silently (logs only).
 *
 * Trial source priority (best-available):
 *   1. adaptation_trial_logs (clean, has cue + correctness)
 *   2. exercise_events fallback (only if adaptation_trial_logs missing)
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  computeMastery,
  mapTrialToSkills,
  MASTERY_MODEL_VERSION,
  type MasteryRow,
  type MasteryTrial,
} from '@/lib/mastery';

interface FlushArgs {
  sessionId: string;
  userId: string;
  profileId: string;
}

function weekStart(d: Date = new Date()): string {
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day + 6) % 7; // back to Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

export function useMasteryWriter() {
  const flush = useCallback(async ({ sessionId, userId, profileId }: FlushArgs) => {
    try {
      // 1. Pull this session's trials to discover affected skills + targets.
      const { data: sessionLogs, error: logsErr } = await supabase
        .from('adaptation_trial_logs')
        .select('exercise_slug, correct, cue_level, created_at, id')
        .eq('session_id', sessionId);

      if (logsErr) {
        console.warn('[Mastery] session logs query failed', logsErr);
        return;
      }
      if (!sessionLogs || sessionLogs.length === 0) return;

      // We don't have stimulus inputs in adaptation_trial_logs; use a default
      // mapping by exerciseSlug only. Skill mapping fns gracefully default.
      const affectedSkills = new Set<string>();
      for (const log of sessionLogs) {
        for (const s of mapTrialToSkills({ exerciseSlug: log.exercise_slug, inputs: null })) {
          affectedSkills.add(s);
        }
      }
      if (affectedSkills.size === 0) return;

      const sinceIso = new Date(Date.now() - 14 * 86400_000).toISOString();

      // 2. Pull last 14d of trials for this profile across the affected exercises.
      const exerciseSlugs = Array.from(
        new Set(sessionLogs.map(l => l.exercise_slug).filter(Boolean)),
      );

      const { data: recentLogs, error: recErr } = await supabase
        .from('adaptation_trial_logs')
        .select('exercise_slug, correct, cue_level, created_at, session_id')
        .eq('user_id', userId)
        .in('exercise_slug', exerciseSlugs as string[])
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true });

      if (recErr) {
        console.warn('[Mastery] recent logs query failed', recErr);
        return;
      }

      // 3. Group by skill.
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

      // 4. Load existing mastery rows for these skills.
      const skillList = Object.keys(bySkill);
      const { data: existing } = await supabase
        .from('user_skill_mastery')
        .select('skill_slug, mastery_score, confidence, cue_independence, last_practiced_at, plateau_flag')
        .eq('profile_id', profileId)
        .in('skill_slug', skillList);

      const existingMap = new Map<string, Partial<MasteryRow>>();
      for (const row of existing ?? []) {
        existingMap.set(row.skill_slug, row as any);
      }

      const wk = weekStart();

      // 5. Compute + upsert each skill.
      for (const skill of skillList) {
        const prev = (existingMap.get(skill) as MasteryRow | undefined) ?? null;
        const next = computeMastery(bySkill[skill], prev);

        const upsertRow = {
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
        };

        await supabase
          .from('user_skill_mastery')
          .upsert(upsertRow as any, { onConflict: 'profile_id,skill_slug' });

        // Weekly snapshot (idempotent via unique constraint)
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
  }, []);

  return { flush };
}
