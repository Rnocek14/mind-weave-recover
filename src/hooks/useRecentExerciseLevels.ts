/**
 * useRecentExerciseLevels
 *
 * Fetches the latest difficulty level the user reached for each exercise
 * slug they've practiced recently. Powers the Recovery Profile section
 * in Patient Hub. Read-only; does not feed the adaptation engine.
 *
 * Strategy:
 *   - Pull the user's recent ended sessions (last 50).
 *   - Pull all exercise_events for those sessions.
 *   - Per slug: keep the most-recent event's difficulty + accuracy across
 *     that slug's last session, plus a small 2-session trend signal.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecentExerciseLevel {
  slug: string;
  /** 1–10 universal level from the most recent trial of this exercise. */
  level: number;
  /** Accuracy (0–100) across the most recent session that included this slug. */
  lastAccuracy: number;
  /** Trial count in the most recent session. */
  lastTrialCount: number;
  /** ISO date string of the most recent session that included this slug. */
  lastSessionAt: string;
  /**
   * Direction of difficulty between the previous and most-recent session:
   *  +1 = level went up, 0 = same, -1 = down (more support), null = no prior.
   */
  supportTrend: 1 | 0 | -1 | null;
  /** Number of sessions in the recent window that included this slug. */
  sessionsObserved: number;
}

interface State {
  levels: RecentExerciseLevel[];
  loading: boolean;
  error: string | null;
}

export function useRecentExerciseLevels(userId: string | undefined, sessionLookback = 50): State {
  const [state, setState] = useState<State>({ levels: [], loading: true, error: null });

  useEffect(() => {
    if (!userId) {
      setState({ levels: [], loading: false, error: null });
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const { data: sessions, error: sErr } = await supabase
          .from('sessions')
          .select('id, ended_at')
          .eq('user_id', userId)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(sessionLookback);
        if (sErr) throw sErr;
        if (!sessions || sessions.length === 0) {
          if (!cancelled) setState({ levels: [], loading: false, error: null });
          return;
        }

        const sessionIds = sessions.map(s => s.id);
        const sessionDateById = new Map(sessions.map(s => [s.id, s.ended_at]));

        const { data: events, error: eErr } = await supabase
          .from('exercise_events')
          .select('exercise_slug, score, task_parameters, inputs, created_at, session_id')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false });
        if (eErr) throw eErr;
        if (!events || events.length === 0) {
          if (!cancelled) setState({ levels: [], loading: false, error: null });
          return;
        }

        // Group events by slug → ordered list of session-level summaries
        const bySlug = new Map<string, Map<string, { trials: number; correct: number; lastLevel: number; sessionAt: string }>>();
        for (const ev of events) {
          if (!ev.exercise_slug || !ev.session_id) continue;
          const slug = ev.exercise_slug;
          const sessionAt = sessionDateById.get(ev.session_id) ?? ev.created_at;
          if (!sessionAt) continue;
          const taskParams = (ev.task_parameters ?? {}) as { difficulty?: number };
          const inputs = (ev.inputs ?? {}) as { difficulty?: number };
          const lvl = Number(taskParams.difficulty ?? inputs.difficulty ?? 1);

          let perSlug = bySlug.get(slug);
          if (!perSlug) { perSlug = new Map(); bySlug.set(slug, perSlug); }
          let entry = perSlug.get(ev.session_id);
          if (!entry) {
            entry = { trials: 0, correct: 0, lastLevel: lvl, sessionAt };
            perSlug.set(ev.session_id, entry);
          }
          entry.trials += 1;
          if (ev.score === 1) entry.correct += 1;
          // Events come back desc; the *first* one we see per session is the latest trial.
          // We initialised lastLevel from that first event — keep it.
        }

        const out: RecentExerciseLevel[] = [];
        for (const [slug, perSlug] of bySlug.entries()) {
          const orderedSessions = Array.from(perSlug.values()).sort(
            (a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime()
          );
          if (orderedSessions.length === 0) continue;
          const latest = orderedSessions[0];
          const prior = orderedSessions[1];
          let supportTrend: 1 | 0 | -1 | null = null;
          if (prior) {
            const diff = latest.lastLevel - prior.lastLevel;
            supportTrend = diff > 0 ? 1 : diff < 0 ? -1 : 0;
          }
          out.push({
            slug,
            level: Math.max(1, Math.min(10, Math.round(latest.lastLevel))),
            lastAccuracy: Math.round((latest.correct / Math.max(1, latest.trials)) * 100),
            lastTrialCount: latest.trials,
            lastSessionAt: latest.sessionAt,
            supportTrend,
            sessionsObserved: orderedSessions.length,
          });
        }

        out.sort((a, b) => new Date(b.lastSessionAt).getTime() - new Date(a.lastSessionAt).getTime());
        if (!cancelled) setState({ levels: out, loading: false, error: null });
      } catch (err: any) {
        console.error('[useRecentExerciseLevels]', err);
        if (!cancelled) setState({ levels: [], loading: false, error: err?.message ?? 'failed' });
      }
    })();

    return () => { cancelled = true; };
  }, [userId, sessionLookback]);

  return state;
}
