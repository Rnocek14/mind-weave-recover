/**
 * Observed speech practice, NOT a clinical recovery diagnosis. Every point is
 * read from the opened patient's owned sessions and scored evidence, rather
 * than from the clinician/viewer's own account. No observed answer => gap.
 */
import { Card } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDailyPracticeAccuracy, localDateKey, summarizeRecentPracticeAccuracy,
  formatPracticePercent, type DailyPracticeAccuracy, type PracticeObservation,
} from "@/lib/clinical/metricsPresentation";

interface Props {
  userId: string;
  profileId?: string;
  // Kept for existing callers; this card deliberately does not mix summary
  // slopes or volume windows into its independently sourced accuracy chart.
  accuracySlope?: number | null;
  recentTrials?: number;
  priorTrials?: number;
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 64;

function chartDateKeys() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 28 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (27 - i));
    return localDateKey(date);
  });
}

function chartSegments(days: readonly DailyPracticeAccuracy[]): string[] {
  const step = CHART_WIDTH / 27;
  const segments: string[] = [];
  let current = "";
  days.forEach((day, index) => {
    if (day.accuracy === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    const x = index * step;
    const y = CHART_HEIGHT - (day.accuracy / 100) * CHART_HEIGHT;
    current += (current ? " L " : "M ") + x.toFixed(2) + " " + y.toFixed(2);
  });
  if (current) segments.push(current);
  return segments;
}

export function ClinicianProgressCard({ userId, profileId }: Props) {
  const [points, setPoints] = useState<DailyPracticeAccuracy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setPoints([]);
    setError(false);
    if (!userId || !profileId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    const run = async () => {
      const dates = chartDateKeys();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 27);
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("profile_id", profileId)
        .gte("started_at", start.toISOString())
        .limit(1000);
      if (sessionsError) throw sessionsError;
      if (!sessions || sessions.length >= 1000) throw new Error("Session sample exceeds verified bounds");
      if (sessions.length === 0) return buildDailyPracticeAccuracy([], dates);

      const ids = sessions.map(session => session.id);
      const { data, error: attemptsError } = await supabase
        .from("utterance_analyses")
        .select("created_at, is_correct, validity_label, counts_toward_score, clinician_validity_override")
        .eq("user_id", userId)
        .in("session_id", ids)
        .gte("created_at", start.toISOString())
        .limit(1000);
      if (attemptsError || !data || data.length >= 1000) {
        throw attemptsError ?? new Error("Attempt sample exceeds verified bounds");
      }
      return buildDailyPracticeAccuracy(data as PracticeObservation[], dates);
    };
    void run().then(days => {
      if (active) {
        setPoints(days);
        setLoading(false);
      }
    }).catch(() => {
      if (active) {
        setPoints([]);
        setError(true);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [userId, profileId]);

  const last7 = useMemo(() => summarizeRecentPracticeAccuracy(points.slice(-7)), [points]);
  const prior7 = useMemo(() => summarizeRecentPracticeAccuracy(points.slice(-14, -7)), [points]);
  const delta = last7.accuracyPct !== null && prior7.accuracyPct !== null
    ? last7.accuracyPct - prior7.accuracyPct : null;
  const hasObservations = points.some(point => point.count > 0);
  const paths = useMemo(() => chartSegments(points), [points]);

  return (
    <Card className="p-4 sm:p-5 min-w-0" aria-label="Recent practice accuracy">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Speech practice · last 7 days</p>
          <p className="text-3xl font-semibold tabular-nums text-foreground mt-1">
            {loading ? "…" : formatPracticePercent(last7.accuracyPct)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading measured responses" : error
              ? "Could not read practice data"
              : last7.eligible === 0
                ? "No eligible scored answers this week"
                : String(last7.eligible) + " scored answers across " + last7.activeDays + (last7.activeDays === 1 ? " active day" : " active days")}
          </p>
        </div>
        <BarChart3 aria-hidden="true" className="w-5 h-5 shrink-0 mt-1 text-muted-foreground" />
      </div>

      {!loading && !error && (
        <p className="mt-2 text-xs text-muted-foreground">
          {delta === null
            ? "Previous 7-day comparison unavailable"
            : (delta > 0 ? "+" : "") + delta + " percentage points vs previous 7 days"}
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="h-16 rounded bg-muted/40 animate-pulse" role="status" aria-label="Loading practice trend" />
        ) : error ? (
          <p role="alert" className="text-sm text-muted-foreground py-4">Practice trend could not be loaded. No estimate is shown.</p>
        ) : !hasObservations ? (
          <p className="text-sm text-muted-foreground py-4">No scored speech attempts in the last 28 days.</p>
        ) : (
          <svg
            role="img"
            aria-label="Observed practice accuracy across 28 days. Breaks in the line mean no scored answers, not zero accuracy."
            viewBox={"0 0 " + CHART_WIDTH + " " + CHART_HEIGHT}
            preserveAspectRatio="none"
            className="w-full h-16 overflow-visible"
          >
            <path
              d={"M 0 " + CHART_HEIGHT + " L " + CHART_WIDTH + " " + CHART_HEIGHT}
              stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="2 4"
              fill="none"
            />
            {paths.map((path, i) => (
              <path key={i} d={path} stroke="hsl(var(--primary))"
                strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {points.map((point, index) => point.accuracy === null ? null : (
              <circle
                key={point.date}
                cx={index * CHART_WIDTH / 27}
                cy={CHART_HEIGHT - (point.accuracy / 100) * CHART_HEIGHT}
                r="2.7" fill="hsl(var(--primary))"
              />
            ))}
          </svg>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground mt-2">
        Last 28 calendar days · gaps mean no eligible answers. Percentages use app-scored attempts
        and do not establish clinical improvement or verify who spoke.
      </p>
    </Card>
  );
}
