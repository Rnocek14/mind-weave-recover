/**
 * TodaysPracticeInsights — PR-B4
 *
 * Minimal, post-session-only surface for the Phase B "What changed today"
 * recovery insight layer.
 *
 * Strict rules (per PR-B4 spec):
 *   - Post-session ONLY. Not Patient Hub. Not About pages. Not dashboard.
 *   - 0–2 lines maximum (delegated to composeInsights).
 *   - Empty output = render nothing (no placeholder card).
 *   - No charts, percentages, trend arrows, or badges. Pure language.
 *   - No "AI" / "system" framing. Calm, recovery-focused tone.
 *   - Header reads "Today's practice" — never "Insights" / "Performance".
 *
 * This component is read-only: it pulls adaptation_trial_logs for the given
 * session, hands them to digestSessionRows, and renders the safe lines.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  digestSessionRows,
  type AdaptationTrialRow,
} from '@/lib/insights/sessionAdaptationDigest';
import type { ComposedInsight } from '@/lib/insights/insightLanguage';

interface TodaysPracticeInsightsProps {
  sessionId: string | null;
}

export function TodaysPracticeInsights({ sessionId }: TodaysPracticeInsightsProps) {
  const [insights, setInsights] = useState<ComposedInsight[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setReady(true);
      setInsights([]);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('adaptation_trial_logs')
          .select(
            'exercise_slug, trial_index, difficulty, cue_level, cue_dependency, success_rate, correct, fatigue, difficulty_change_direction, difficulty_change_reason, escalation_blocked, escalation_block_reason',
          )
          .eq('session_id', sessionId)
          .order('trial_index', { ascending: true });

        if (cancelled) return;
        if (error || !data) {
          setInsights([]);
          setReady(true);
          return;
        }

        const result = digestSessionRows(data as AdaptationTrialRow[]);
        setInsights(result.insights);
        setReady(true);
      } catch {
        if (!cancelled) {
          setInsights([]);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Empty output is a first-class valid state — render absolutely nothing.
  if (!ready || insights.length === 0) return null;

  return (
    <section
      aria-label="Today's practice"
      className="rounded-xl bg-muted/30 px-5 py-4 text-left animate-fade-in"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        Today's practice
      </p>
      <ul className="space-y-1.5">
        {insights.map((line, i) => (
          <li
            key={`${line.source}-${i}`}
            className="text-sm leading-relaxed text-foreground/90"
          >
            {line.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
