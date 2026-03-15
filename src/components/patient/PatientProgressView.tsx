import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Calendar, CheckCircle, Heart, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";
import { formatDistanceToNow } from "date-fns";

interface PatientProgressViewProps {
  userId: string;
  profileId: string;
  streak: number;
}

/** 
 * Simplified progress view for patient mode.
 * Shows encouraging summary, streak, sessions this week, and one simple trend.
 * Uses progressive disclosure for detail.
 */
export const PatientProgressView = memo(function PatientProgressView({
  userId,
  profileId,
  streak,
}: PatientProgressViewProps) {
  const { timeline } = useWeeklyRecoverySnapshot(profileId, 7);
  const { todayCheckin } = useDailyReadiness(profileId);
  const { sessions } = useSessionHistory(userId);
  const { snapshot } = useCognitiveState({ userId, profileId });

  const weekStats = useMemo(() => {
    const activeDays = timeline.filter((d) => d.hasAnySignal).length;
    return { activeDays };
  }, [timeline]);

  // Get top improving domain
  const topDomain = useMemo(() => {
    if (!snapshot?.domains?.length) return null;
    const scored = snapshot.domains
      .filter((d) => d.trialCount >= 3)
      .sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const d = scored[0];
    const meta = COGNITIVE_DOMAINS.find((cd) => cd.slug === d.domainSlug);
    return {
      label: meta?.patientLabel || meta?.label || d.domainSlug,
      score: Math.round(d.score * 100),
    };
  }, [snapshot]);

  // Recent sessions count
  const recentSessionCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return sessions.filter(
      (s) => new Date(s.startedAt).getTime() > weekAgo
    ).length;
  }, [sessions]);

  // Generate encouraging message
  const encouragement = useMemo(() => {
    if (streak >= 7) return "Amazing consistency! You're building great habits. 🌟";
    if (streak >= 3) return "You're on a roll! Keep it up. 🔥";
    if (weekStats.activeDays >= 3) return "Great week of practice! 💪";
    if (recentSessionCount > 0) return "Every session counts. You're making progress! ✨";
    return "Welcome back! Ready to keep going? 💛";
  }, [streak, weekStats.activeDays, recentSessionCount]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encouraging headline */}
      <div className="text-center space-y-2 py-4">
        <p className="text-xl md:text-2xl font-semibold text-foreground">
          {encouragement}
        </p>
      </div>

      {/* Big stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 text-center border-2">
          <Flame className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <div className="text-3xl md:text-4xl font-bold text-foreground">
            {streak}
          </div>
          <div className="text-sm text-muted-foreground mt-1">Day streak</div>
        </Card>
        <Card className="p-5 text-center border-2">
          <Calendar className="w-8 h-8 text-primary mx-auto mb-2" />
          <div className="text-3xl md:text-4xl font-bold text-foreground">
            {weekStats.activeDays}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Days this week
          </div>
        </Card>
      </div>

      {/* Sessions this week */}
      <Card className="p-5 border-2">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-success shrink-0" />
          <div>
            <div className="text-lg font-semibold text-foreground">
              {recentSessionCount} session{recentSessionCount !== 1 ? "s" : ""}{" "}
              this week
            </div>
            <div className="text-sm text-muted-foreground">
              {recentSessionCount >= 5
                ? "Excellent practice rate!"
                : recentSessionCount >= 3
                ? "Good work — keep it consistent"
                : "Try for a few more this week"}
            </div>
          </div>
        </div>
      </Card>

      {/* Top skill */}
      {topDomain && (
        <Card className="p-5 border-2">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-primary shrink-0" />
            <div>
              <div className="text-lg font-semibold text-foreground">
                Your strongest area: {topDomain.label}
              </div>
              <div className="text-sm text-muted-foreground">
                Keep building on this strength!
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Today's readiness */}
      {todayCheckin && (
        <Card className="p-5 border-2">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-pink-500 shrink-0" />
            <div>
              <div className="text-lg font-semibold text-foreground">
                {todayCheckin.fatigue_rating <= 2
                  ? "Feeling good today!"
                  : todayCheckin.fatigue_rating <= 3
                  ? "Taking it steady today"
                  : "Rest when you need to"}
              </div>
              <div className="text-sm text-muted-foreground">
                Fatigue: {todayCheckin.fatigue_rating}/5
                {todayCheckin.mood_rating
                  ? ` · Mood: ${todayCheckin.mood_rating}/5`
                  : ""}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Progressive disclosure: see more detail */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-3 min-h-[48px]">
          <span>See more detail</span>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {snapshot?.domains
            ?.filter((d) => d.trialCount >= 3)
            .map((d) => {
              const meta = COGNITIVE_DOMAINS.find(
                (cd) => cd.slug === d.domainSlug
              );
              const pct = Math.round(d.score * 100);
              return (
                <Card key={d.domainSlug} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {meta?.patientLabel || meta?.label || d.domainSlug}
                    </span>
                    <Badge
                      variant={pct >= 70 ? "default" : "secondary"}
                      className="text-sm"
                    >
                      {pct}%
                    </Badge>
                  </div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          {(!snapshot?.domains || snapshot.domains.filter(d => d.trialCount >= 3).length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Complete a few more sessions to see detailed progress
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});
