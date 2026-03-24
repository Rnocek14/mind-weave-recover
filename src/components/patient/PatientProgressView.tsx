import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Flame, TrendingUp, Calendar, CheckCircle, Heart, ChevronDown, BookOpen, ArrowRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { useWordMastery } from "@/hooks/useWordMastery";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";

interface PatientProgressViewProps {
  userId: string;
  profileId: string;
  streak: number;
}

/** Map a 0–1 score to plain-language state */
function scoreToPlainState(score: number): { text: string; className: string } {
  if (score >= 0.7) return { text: "Getting stronger", className: "text-success" };
  if (score >= 0.4) return { text: "Keeping steady", className: "text-primary" };
  return { text: "Let's keep practicing", className: "text-warning" };
}

/**
 * Simplified progress view for patient mode.
 * Shows encouraging summary, streak, sessions this week, and one simple trend.
 * Uses progressive disclosure — percentages only behind "See more detail."
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
      score: d.score,
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

  // Domains with plain-language states
  const domainStates = useMemo(() => {
    if (!snapshot?.domains?.length) return [];
    return snapshot.domains
      .filter((d) => d.trialCount >= 3)
      .sort((a, b) => b.score - a.score)
      .map((d) => {
        const meta = COGNITIVE_DOMAINS.find((cd) => cd.slug === d.domainSlug);
        return {
          slug: d.domainSlug,
          label: meta?.patientLabel || meta?.label || d.domainSlug,
          score: d.score,
          state: scoreToPlainState(d.score),
        };
      });
  }, [snapshot]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Orientation cue + encouraging headline */}
      <div className="text-center space-y-2 py-4">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">See how you're doing</p>
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

      {/* Top skill with plain-language state */}
      {topDomain && (
        <Card className="p-5 border-2">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-primary shrink-0" />
            <div>
              <div className="text-lg font-semibold text-foreground">
                Your strongest area: {topDomain.label}
              </div>
              <div className={`text-sm font-medium ${scoreToPlainState(topDomain.score).className}`}>
                {scoreToPlainState(topDomain.score).text}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Domain states — plain language, no percentages */}
      {domainStates.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground px-1">Your skills</h3>
          {domainStates.map((d) => (
            <Card key={d.slug} className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-foreground">
                  {d.label}
                </span>
                <span className={`text-sm font-semibold ${d.state.className}`}>
                  {d.state.text}
                </span>
              </div>
            </Card>
          ))}
        </div>
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
            </div>
          </div>
        </Card>
      )}

      {/* Progressive disclosure: detail with percentages */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-3 min-h-[48px]">
          <span>See detailed scores</span>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {domainStates.map((d) => {
            const pct = Math.round(d.score * 100);
            return (
              <Card key={d.slug} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {d.label}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {pct}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Card>
            );
          })}
          {domainStates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Complete a few more sessions to see detailed scores
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});
