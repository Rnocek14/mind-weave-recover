import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Flame, TrendingUp, Calendar, CheckCircle, Heart,
  ChevronDown, BookOpen, ArrowRight, Target, Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useWeeklyRecoverySnapshot } from "@/hooks/useWeeklyRecoverySnapshot";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { useWordMastery } from "@/hooks/useWordMastery";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useErrorPatternAnalytics } from "@/hooks/useErrorPatternAnalytics";
import { getCueLabel } from "@/lib/insightLanguageMap";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";
import { SessionHistoryList } from "@/components/patient/SessionHistoryList";
import { AchievementBadges } from "@/components/patient/AchievementBadges";
import { useAchievements } from "@/hooks/useAchievements";
import { useMayaInsight } from "@/hooks/useMayaInsight";
import { MayaInterpretationCard } from "@/components/patient/MayaInterpretationCard";
import { MilestoneToast } from "@/components/patient/MilestoneToast";

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
 * Unified "My Progress" view for patient mode.
 * 
 * VISIBILITY TIERS:
 * 1. ALWAYS VISIBLE: Hero headline, core metrics, Getting Better At, Focus Next, What Helps You
 * 2. CONDITIONAL: Concerns card (only if red flags exist)
 * 3. COLLAPSIBLE: Session History, Achievements, Detailed Scores
 * 4. DRILL-DOWN: Link to /recovery-progress for advanced charts
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
  const { mastered, emerging, loading: masteryLoading } = useWordMastery(userId);
  const { flags: redFlags } = useRedFlagDetection(userId);
  const { analytics } = useErrorPatternAnalytics(userId, { weeksBack: 4 });
  const { achievements, newAchievements } = useAchievements(userId, profileId);
  const { insight: mayaInsight } = useMayaInsight({ userId, profileId });

  const weekStats = useMemo(() => {
    const activeDays = timeline.filter((d) => d.hasAnySignal).length;
    return { activeDays };
  }, [timeline]);

  const recentSessionCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return sessions.filter(
      (s) => new Date(s.startedAt).getTime() > weekAgo
    ).length;
  }, [sessions]);

  // Domains sorted by score
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

  // Split into improving vs needs-practice
  const gettingBetterAt = domainStates.filter((d) => d.score >= 0.5).slice(0, 3);
  const focusNext = domainStates.filter((d) => d.score < 0.5).slice(0, 2);

  // Best cue strategies
  const cueStrategies = useMemo(() => {
    const cueEfficacy = analytics?.cueEfficacy || [];
    return [...cueEfficacy]
      .filter((c) => c.totalGiven >= 3 && c.efficacyRate >= 0.5)
      .sort((a, b) => b.efficacyRate - a.efficacyRate)
      .slice(0, 2)
      .map((c) => ({
        label: getCueLabel(c.cueType),
        rate: Math.round(c.efficacyRate * 100),
      }));
  }, [analytics]);

  // Hero headline
  const heroText = useMemo(() => {
    if (gettingBetterAt.length > 0) {
      return `You're improving at ${gettingBetterAt[0].label.toLowerCase()}`;
    }
    if (mastered > 0) {
      return `You've mastered ${mastered} word${mastered !== 1 ? "s" : ""}`;
    }
    if (recentSessionCount > 0) {
      return "You're making progress — keep going!";
    }
    return "Let's see how you're doing";
  }, [gettingBetterAt, mastered, recentSessionCount]);

  // Patient-safe concerns
  const patientConcerns = useMemo(() => {
    return redFlags
      .filter((f) => f.severity === "red" || f.severity === "orange")
      .slice(0, 2);
  }, [redFlags]);

  const isFirstTime = sessions.length === 0 && mastered === 0 && streak === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ════════════════════════════════════════════
          TIER 0: FIRST-TIME EMPTY STATE
          ════════════════════════════════════════════ */}
      {isFirstTime && (
        <Card className="p-6 border-2 border-primary/20 bg-primary/5 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Your progress story starts here</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            After your first session, you'll see:
          </p>
          <div className="text-left max-w-xs mx-auto space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
              What you're getting better at
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Target className="w-4 h-4 text-amber-500 shrink-0" />
              What to focus on next
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Lightbulb className="w-4 h-4 text-primary shrink-0" />
              What helps you most
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Go to the Home tab and start your first session! 💛
          </p>
        </Card>
      )}

      {/* ════════════════════════════════════════════
          TIER 1: ALWAYS VISIBLE
          ════════════════════════════════════════════ */}

      {/* Hero Headline */}
      {!isFirstTime && (
        <div className="text-center space-y-2 py-4">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            My Progress
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            {heroText}
          </h2>
        </div>
      )}

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 text-center border-2">
          <Flame className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <div className="text-3xl md:text-4xl font-bold text-foreground">{streak}</div>
          <div className="text-sm text-muted-foreground mt-1">Day streak</div>
        </Card>
        <Card className="p-5 text-center border-2">
          <Calendar className="w-8 h-8 text-primary mx-auto mb-2" />
          <div className="text-3xl md:text-4xl font-bold text-foreground">{weekStats.activeDays}</div>
          <div className="text-sm text-muted-foreground mt-1">Days this week</div>
        </Card>
      </div>

      {/* Sessions + Words Mastered row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 border-2">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-success shrink-0" />
            <span className="text-sm font-medium text-muted-foreground">Sessions</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{recentSessionCount}</div>
          <div className="text-xs text-muted-foreground">this week</div>
        </Card>
        {!masteryLoading && (
          <Card className="p-4 border-2">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-muted-foreground">Words</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{mastered}</div>
            <div className="text-xs text-muted-foreground">
              mastered{emerging > 0 ? ` · ${emerging} growing` : ""}
            </div>
          </Card>
        )}
      </div>

      {/* ── Getting Better At (always visible) ── */}
      {gettingBetterAt.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground px-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            Getting Better At
          </h3>
          {gettingBetterAt.map((d) => (
            <Card key={d.slug} className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-foreground">{d.label}</span>
                <span className={`text-sm font-semibold ${d.state.className}`}>
                  {d.state.text}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Focus Next (always visible) ── */}
      {focusNext.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground px-1 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" />
            Focus Next
          </h3>
          {focusNext.map((d) => (
            <Card key={d.slug} className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-foreground">{d.label}</span>
                <span className="text-sm font-semibold text-warning">
                  Let's keep practicing
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── What Helps You (always visible) ── */}
      {cueStrategies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground px-1 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            What Helps You
          </h3>
          {cueStrategies.map((s, i) => (
            <Card key={i} className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-foreground">{s.label}</span>
                <span className="text-sm font-semibold text-success">
                  Helps {s.rate}% of the time
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════
          TIER 2: CONDITIONAL (only if concerns exist)
          ════════════════════════════════════════════ */}

      {patientConcerns.length > 0 && (
        <Card className="p-5 border-2 border-amber-500/20 bg-amber-500/5">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Things to Know
          </h3>
          <div className="space-y-2">
            {patientConcerns.map((flag, i) => (
              <p key={i} className="text-sm text-foreground">{flag.message}</p>
            ))}
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
            </div>
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════
          TIER 3: COLLAPSIBLE
          ════════════════════════════════════════════ */}

      {/* Session History */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors w-full py-3 min-h-[48px]">
          <span>Recent Sessions</span>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SessionHistoryList userId={userId} />
        </CollapsibleContent>
      </Collapsible>

      {/* Achievements */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors w-full py-3 min-h-[48px]">
          <span>Achievements</span>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <AchievementBadges achievements={achievements} newAchievements={newAchievements} />
        </CollapsibleContent>
      </Collapsible>

      {/* Detailed Scores */}
      {domainStates.length > 0 && (
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
                    <span className="text-sm font-medium text-foreground">{d.label}</span>
                    <span className="text-sm font-semibold text-foreground">{pct}%</span>
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
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ════════════════════════════════════════════
          TIER 4: DRILL-DOWN LINK
          ════════════════════════════════════════════ */}
      <div className="text-center pb-4">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
          <Link to="/recovery-progress">
            See detailed recovery charts <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
});
