import { memo, useState, useEffect, useMemo } from "react";
import { MessageSquare, Activity, TrendingUp, Lightbulb, CheckCircle, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WeeklyRecoverySnapshot } from "@/components/WeeklyRecoverySnapshot";
import { TodaysActivityCard } from "@/components/TodaysActivityCard";
import { ActivityTrendChart } from "@/components/ActivityTrendChart";
import { TodaysSessionStats } from "@/components/TodaysSessionStats";
import { WeeklyTrendsChart } from "@/components/WeeklyTrendsChart";
import { ExerciseStatsTile } from "@/components/ExerciseStatsTile";
import { RecoverySnapshot } from "@/components/RecoverySnapshot";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { useUiMode } from "@/hooks/useUiMode";
import { useProfile } from "@/hooks/useProfile";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import {
  ProgressCardSkeleton,
  ExerciseStatsTileSkeleton,
} from "./DashboardSkeletons";

export const ProgressTab = memo(function ProgressTab() {
  const { userId } = useDashboardContext();
  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const { activeProfile } = useProfile();

  const { timeline } = useWeeklyRecoverySnapshot(activeProfile?.id, 14);
  const { todayCheckin } = useDailyReadiness(activeProfile?.id);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Adherence: days with signal in last 7
  const adherenceStats = useMemo(() => {
    const last7 = timeline.slice(-7);
    const activeDays = last7.filter((d) => d.hasAnySignal).length;
    return { activeDays, total: last7.length };
  }, [timeline]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Adherence & PRO strip */}
      <section>
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
      </section>

      {/* Weekly Recovery Snapshot — 14-day trend view */}
      <section>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Recovery & Activity
        </h3>
        <div className="space-y-4">
          <WeeklyRecoverySnapshot />
          <div className="grid md:grid-cols-2 gap-4">
            <TodaysActivityCard />
            <ActivityTrendChart />
          </div>
        </div>
      </section>

      {/* Performance Stats */}
      <section>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Performance
        </h3>
        {!ready ? (
          <ProgressCardSkeleton />
        ) : (
          <div className="space-y-4">
            <TodaysSessionStats />
            <WeeklyTrendsChart />
          </div>
        )}
      </section>

      {/* Language Progress */}
      <section>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Language Progress
        </h3>
        {!ready ? (
          <div className="grid md:grid-cols-3 gap-4">
            <ExerciseStatsTileSkeleton delay={0} />
            <ExerciseStatsTileSkeleton delay={100} />
            <ExerciseStatsTileSkeleton delay={200} />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <ExerciseStatsTile userId={userId} exerciseSlug="semantic-features" exerciseTitle="Semantic Features" />
            <ExerciseStatsTile userId={userId} exerciseSlug="phonological" exerciseTitle="Phonological" />
            <ExerciseStatsTile userId={userId} exerciseSlug="sentence-construction" exerciseTitle="Grammar" />
          </div>
        )}
      </section>

      {/* AI Recovery Insights — patient/caregiver only */}
      {!isClinician && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Recovery Insights
            <Badge variant="outline" className="text-xs">AI Summary</Badge>
          </h3>
          <RecoverySnapshot userId={userId} />
        </section>
      )}
    </div>
  );
});
