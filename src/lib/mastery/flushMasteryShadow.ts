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
  MASTERY_RECENCY_WINDOW_DAYS,
  MASTERY_RETENTION_WINDOW_DAYS,
  type MasteryRow,
  type MasteryTrial,
} from '@/lib/mastery';
import { routeTrialMode, isAdoptedForTrialMode } from './masterySignalRouting';

/**
 * Ceiling on the retention-window fetch. Comfortably above what even a daily
 * user accumulates in 90 days on the handful of exercise slugs one session
 * touches, and low enough that the fire-and-forget flush stays cheap.
 */
const MASTERY_MAX_FETCH_ROWS = 3000;

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
  // One clock for the whole flush. The recency filter below and every
  // computeMastery call must agree on where "now" is, or a trial sitting on the
  // 14-day boundary can be inside the window for one and outside it for the
  // other — enough to have a skill's row scoped out and left unwritten.
  const now = new Date();
  try {
    const { data: sessionLogs } = await supabase
      .from('adaptation_trial_logs')
      .select('exercise_slug, correct, cue_level, created_at, session_id, difficulty, trial_mode, graded_score, score_vector, signal_granularity')
      .eq('session_id', sessionId);

    if (!sessionLogs || sessionLogs.length === 0) return;

    const exerciseSlugs = Array.from(
      new Set(sessionLogs.map(l => l.exercise_slug).filter(Boolean)),
    ) as string[];
    if (exerciseSlugs.length === 0) return;

    // Fetch the RETENTION window, not the recency window. computeMastery still
    // scores accuracy and the EWMA over the trailing 14 days; it needs the
    // longer history only to count how many separate sessions, across how many
    // days, the skill has actually been practised in. Fetching 14 days made
    // that count a measure of frequency, which permanently blocked level-up for
    // anyone practising a skill less than roughly weekly.
    const sinceIso = new Date(
      now.getTime() - MASTERY_RETENTION_WINDOW_DAYS * 86400_000,
    ).toISOString();
    // Unattributed rows stay bounded to the recency window. They are counted at
    // all because the logger deliberately inserts without a profile when the
    // active profile has not resolved yet — but on a login holding several
    // patient profiles that attribution is a guess, and the retention window is
    // 6.4x longer than the one that guess was judged safe over. Worse, it now
    // feeds the session count, where a single stale unattributed visit is a
    // whole practice occasion. Recent rows keep the benefit of the doubt; old
    // ones do not.
    const nullProfileSinceIso = new Date(
      now.getTime() - MASTERY_RECENCY_WINDOW_DAYS * 86400_000,
    ).toISOString();
    // Scope to the patient profile, not just the account. One login can hold
    // several patient profiles (a caregiver managing two survivors, a clinician
    // demo profile alongside a real one). Reading by user_id alone pooled every
    // profile's trials and then wrote the result onto THIS profile's
    // user_skill_mastery rows, so one patient's performance moved another
    // patient's mastery, confidence and cue-independence.
    const { data: recentLogsDesc } = await supabase
      .from('adaptation_trial_logs')
      .select('exercise_slug, correct, cue_level, created_at, session_id, difficulty, trial_mode, graded_score, score_vector, signal_granularity')
      .eq('user_id', userId)
      // Unattributed rows (profile_id null) are written on purpose when the
      // active profile has not resolved yet — the logger says so and inserts
      // anyway — so they are this user's own trials and must still count.
      // Excluding them would shrink the window and quietly move confidence.
      .or(
        `profile_id.eq.${profileId},` +
          `and(profile_id.is.null,created_at.gte.${nullProfileSinceIso})`,
      )
      .in('exercise_slug', exerciseSlugs)
      .gte('created_at', sinceIso)
      // Newest first with an explicit cap: PostgREST applies a server-side row
      // ceiling of its own, and an ascending query that hits it silently drops
      // the NEWEST rows — which is every row the recency window is made of.
      // Taking the newest N and reversing degrades toward a shorter retention
      // window instead, which is merely the behaviour we already had.
      .order('created_at', { ascending: false })
      .limit(MASTERY_MAX_FETCH_ROWS);

    const recentLogs = [...(recentLogsDesc ?? [])].reverse();

    const bySkill: Record<string, MasteryTrial[]> = {};
    const unknownByAdoptedSlug: Record<string, number> = {};
    for (const log of recentLogs) {
      const verdict = routeTrialMode(log.exercise_slug, log.trial_mode as any);
      // Allowlist: ONLY 'expressive' may flow into expressive mastery.
      // Any future verdict (receptive, assisted, exposure, etc.) is skipped
      // by default until it has explicit handling.
      if (verdict === 'skipped_unknown') {
        // Only count toward the warning aggregate when the slug is actually
        // adopted for trial-mode routing. Non-adopted slugs (Two Clues,
        // Describe Guess, etc.) legitimately produce skipped_unknown and
        // would otherwise drown the logs and mask Phase 2 failure signals.
        if (isAdoptedForTrialMode(log.exercise_slug)) {
          unknownByAdoptedSlug[log.exercise_slug] =
            (unknownByAdoptedSlug[log.exercise_slug] ?? 0) + 1;
        }
        continue;
      }
      if (verdict !== 'expressive') continue;
      const skills = mapTrialToSkills({
        exerciseSlug: log.exercise_slug,
        inputs: { difficulty: log.difficulty ?? null },
      });
      const trial: MasteryTrial = {
        is_correct: !!log.correct,
        cue_level: log.cue_level ?? 0,
        created_at: log.created_at,
        session_id: log.session_id ?? null,
        trialMode: (log.trial_mode as any) ?? null,
        signalGranularity: (log.signal_granularity as any) ?? null,
        gradedScore: (log as any).graded_score ?? null,
        scoreVector: (log as any).score_vector ?? null,
      };
      for (const s of skills) {
        if (!bySkill[s]) bySkill[s] = [];
        bySkill[s].push(trial);
      }
    }
    for (const [slug, n] of Object.entries(unknownByAdoptedSlug)) {
      console.warn(
        `[Mastery] ${n} trial(s) for adopted slug "${slug}" had null/missing ` +
          `trial_mode and were skipped from expressive mastery.`,
      );
    }
    // Write only the skills the patient actually practised in the RECENCY
    // window — exactly the set a 14-day fetch used to produce. The wider fetch
    // otherwise drags in skills whose trials are all older than a fortnight:
    // computeMastery finds an empty recency window for them and returns
    // confidence 'none' with null accuracy and null cue independence, and the
    // upsert would write that over a real row, blanking the very quality
    // signals the promotion classifier reads. Two buckets of one game
    // (mapTrialToSkills keys on difficulty) are enough to hit it.
    const recencyCutoffMs = now.getTime() - MASTERY_RECENCY_WINDOW_DAYS * 86400_000;
    const skillList = Object.keys(bySkill).filter((skill) =>
      bySkill[skill].some(
        (t) => new Date(t.created_at).getTime() >= recencyCutoffMs,
      ),
    );
    if (skillList.length === 0) {
      // Phase 2 visibility: surface the silent early-return so future
      // slug/routing regressions are immediately diagnosable in prod logs.
      console.info('[mastery] flush produced 0 skills — no rows written', {
        sessionId,
        sessionTrialCount: sessionLogs.length,
        recentTrialCount: recentLogs.length,
        unknownByAdoptedSlug,
      });
      return;
    }

    const { data: existing } = await supabase
      .from('user_skill_mastery')
      .select('skill_slug, mastery_score, confidence, cue_independence, last_practiced_at, plateau_flag')
      .eq('profile_id', profileId)
      .in('skill_slug', skillList);

    const existingMap = new Map<string, Partial<MasteryRow>>();
    for (const row of existing ?? []) existingMap.set(row.skill_slug, row as any);

    const wk = weekStart(now);

    for (const skill of skillList) {
      const prev = (existingMap.get(skill) as MasteryRow | undefined) ?? null;
      const next = computeMastery(bySkill[skill], prev, now);

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
    // Phase 2 visibility: success path is now logged so prod can verify
    // the mastery pipeline is alive. Counts are small and bounded.
    console.info('[mastery] flushed', { sessionId, skills: skillList.length });
  } catch (err) {
    // Phase 2: was a silent dev-only warn. Promoted to error so RLS / schema
    // regressions are visible in production logs.
    console.error('[mastery] flush failed', err);
  }
}
