import { memo, useState, useEffect } from "react";
import { MessageSquare, Activity, TrendingUp, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WeeklyRecoverySnapshot } from "@/components/WeeklyRecoverySnapshot";
import { TodaysActivityCard } from "@/components/TodaysActivityCard";
import { ActivityTrendChart } from "@/components/ActivityTrendChart";
import { TodaysSessionStats } from "@/components/TodaysSessionStats";
import { WeeklyTrendsChart } from "@/components/WeeklyTrendsChart";
import { ExerciseStatsTile } from "@/components/ExerciseStatsTile";
import { RecoverySnapshot } from "@/components/RecoverySnapshot";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { useUiMode } from "@/hooks/useUiMode";
import {
  ProgressCardSkeleton,
  ExerciseStatsTileSkeleton,
} from "./DashboardSkeletons";

export const ProgressTab = memo(function ProgressTab() {
  const { userId } = useDashboardContext();
  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
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
