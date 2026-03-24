/**
 * Progress Tab — Light summary answering:
 * Patient/Caregiver: "Am I improving? How far along am I?"
 * Clinician: "What's the short-term performance picture?"
 * 
 * Deep longitudinal data lives on /recovery-progress.
 * Pattern analysis lives on /insights.
 */

import { memo, useMemo } from "react";
import { CheckCircle, Heart, BookOpen, ArrowRight, Activity, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { WeeklyRecoverySnapshot } from "@/components/WeeklyRecoverySnapshot";
import { TodaysActivityCard } from "@/components/TodaysActivityCard";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { useUiMode } from "@/hooks/useUiMode";
import { useProfile } from "@/hooks/useProfile";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useWordMastery } from "@/hooks/useWordMastery";

export const ProgressTab = memo(function ProgressTab() {
  const { userId } = useDashboardContext();
  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const { activeProfile } = useProfile();

  const { timeline } = useWeeklyRecoverySnapshot(activeProfile?.id, 14);
  const { todayCheckin } = useDailyReadiness(activeProfile?.id);
  const { mastered, emerging, loading: masteryLoading } = useWordMastery(userId);

  // Adherence: days with signal in last 7
  const adherenceStats = useMemo(() => {
    const last7 = timeline.slice(-7);
    const activeDays = last7.filter((d) => d.hasAnySignal).length;
    return { activeDays, total: last7.length };
  }, [timeline]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quick Status Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Adherence (7d)
          </div>
          <div className="text-lg font-bold tabular-nums">
            {adherenceStats.activeDays}/{adherenceStats.total}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {adherenceStats.activeDays >= 5
              ? "Strong"
              : adherenceStats.activeDays >= 3
              ? "Moderate"
              : "Low"}{" "}
            engagement
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Heart className="w-3 h-3" /> Today's Fatigue
          </div>
          <div className="text-lg font-bold tabular-nums">
            {todayCheckin ? `${todayCheckin.fatigue_rating}/5` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {todayCheckin
              ? todayCheckin.fatigue_rating >= 4
                ? "High — shorter sessions recommended"
                : todayCheckin.fatigue_rating >= 3
                ? "Moderate"
                : "Good readiness"
              : "No check-in today"}
          </div>
        </Card>
        {todayCheckin?.mood_rating != null && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Mood</div>
            <div className="text-lg font-bold tabular-nums">
              {todayCheckin.mood_rating}/5
            </div>
          </Card>
        )}
        {todayCheckin?.sleep_quality != null && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Sleep</div>
            <div className="text-lg font-bold tabular-nums">
              {todayCheckin.sleep_quality}/5
            </div>
          </Card>
        )}
      </div>

      {/* Words Mastered — the most tangible proof signal */}
      {!masteryLoading && (mastered > 0 || emerging > 0) && (
        <Card className="p-5 border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-lg font-semibold text-foreground">
                {mastered} word{mastered !== 1 ? "s" : ""} mastered
              </div>
              <div className="text-sm text-muted-foreground">
                {emerging > 0 && `${emerging} more getting stronger · `}
                {isClinician
                  ? "Reliably retrieved without cueing support"
                  : "Words you can say on your own"}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="mt-2 w-full text-primary hover:text-primary"
          >
            <Link to="/recovery-progress">
              See full recovery progress <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </Card>
      )}

      {/* Weekly Activity Snapshot — short-term view */}
      <section>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          This Week
        </h3>
        <div className="space-y-4">
          <WeeklyRecoverySnapshot />
          <TodaysActivityCard />
        </div>
      </section>

      {/* Recovery Progress CTA — link to the proof layer */}
      <Card className="p-4 border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {isClinician ? "Longitudinal Outcomes" : "Your Recovery Journey"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isClinician
                ? "View accuracy trajectory, cue independence, error quality, and word mastery trends"
                : "See how far you've come over time"}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/recovery-progress">
              View <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
});
