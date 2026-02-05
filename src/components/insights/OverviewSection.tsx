/**
 * Overview Section - At-a-glance intelligence
 * 
 * Answers in ~5 seconds:
 * - Am I improving overall?
 * - What's hardest right now?
 * - Is the system helping me?
 * - Is anything concerning?
 * 
 * Each card links to deep dive sections on this page.
 */

import { memo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2,
  Brain,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnalyticsSnapshotCard } from "@/components/dashboard/AnalyticsSnapshotCard";
import { useAnalyticsSnapshot } from "@/components/dashboard/useAnalyticsSnapshot";
import { AnalyticsCardSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { formatPhonemeDisplay } from "@/hooks/useStrugglingPhonemes";

interface OverviewSectionProps {
  userId: string;
  profileId?: string; // Reserved for future use
}

export const OverviewSection = memo(function OverviewSection({ userId, profileId }: OverviewSectionProps) {
  // Note: profileId will be used when useAnalyticsSnapshot supports it
  const snapshot = useAnalyticsSnapshot(userId);

  if (snapshot.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <AnalyticsCardSkeleton delay={0} />
        <AnalyticsCardSkeleton delay={100} />
        <AnalyticsCardSkeleton delay={200} />
        <AnalyticsCardSkeleton delay={300} />
      </div>
    );
  }

  // Determine recovery status for icon/color
  const recoveryStatus = snapshot.recovery.verdict === 'improving' ? 'positive' :
                         snapshot.recovery.verdict === 'declining' ? 'warning' :
                         snapshot.recovery.verdict === 'insufficient_data' ? 'muted' : 'neutral';
  
  const RecoveryIcon = snapshot.recovery.verdict === 'improving' ? TrendingUp :
                       snapshot.recovery.verdict === 'declining' ? TrendingDown : Minus;

  // Challenges status
  const hasHighChallenges = snapshot.challenges.some(c => c.severity === 'high');
  const challengeStatus = hasHighChallenges ? 'warning' : 
                          snapshot.challenges.length > 0 ? 'neutral' : 'positive';

  // Strategy status
  const strategyStatus = snapshot.bestStrategy && snapshot.bestStrategy.effectiveness > 0.6 
    ? 'positive' 
    : snapshot.bestStrategy 
      ? 'neutral' 
      : 'muted';

  // Alerts status
  const alertStatus = snapshot.alertCount > 0 ? 'warning' : 'positive';

  return (
    <div className="space-y-6">
      {/* Alerts Banner (if any) */}
      {snapshot.alertCount > 0 && (
        <Alert variant="destructive" className="animate-fade-in">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {snapshot.alertCount} concern{snapshot.alertCount > 1 ? 's' : ''} detected: {snapshot.alertSummary}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Snapshot Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Q1: Am I improving? */}
        <AnalyticsSnapshotCard
          icon={<RecoveryIcon className="w-5 h-5" />}
          title="Progress"
          status={recoveryStatus}
          headline={snapshot.recovery.headline}
          detail={snapshot.recovery.detail}
          linkTo="/insights?tab=progress"
          linkLabel="View trends"
        />

        {/* Q2: What's hard for me? */}
        <AnalyticsSnapshotCard
          icon={<Target className="w-5 h-5" />}
          title="What's Hard"
          status={challengeStatus}
          headline={
            snapshot.hardestWords.length > 0 
              ? `${snapshot.hardestWords.length} words need practice`
              : snapshot.challenges.length > 0
                ? snapshot.challenges[0].challenge
                : 'No major challenges'
          }
          detail={
            snapshot.hardestWords.length > 0
              ? `Top: "${snapshot.hardestWords[0]?.word}" (${Math.round(snapshot.hardestWords[0]?.errorRate * 100)}% error rate)`
              : snapshot.challenges[0]?.context
          }
          linkTo="/insights?tab=challenges"
          linkLabel="See all challenges"
        >
          {/* Struggling phonemes preview */}
          {snapshot.strugglingPhonemes.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-1 flex-wrap">
                {snapshot.strugglingPhonemes.map(p => (
                  <Badge key={p.phoneme} variant="secondary" className="text-xs">
                    /{formatPhonemeDisplay(p.phoneme)}/ ({Math.round(p.accuracy)}%)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </AnalyticsSnapshotCard>

        {/* Q3: What's helping? */}
        <AnalyticsSnapshotCard
          icon={<Lightbulb className="w-5 h-5" />}
          title="What Helps"
          status={strategyStatus}
          headline={
            snapshot.bestStrategy 
              ? snapshot.bestStrategy.strategy
              : 'Building your profile'
          }
          detail={
            snapshot.bestStrategy
              ? snapshot.bestStrategy.context
              : 'Complete more sessions to discover what works best for you'
          }
          linkTo="/insights?tab=strategies"
          linkLabel="View all cue data"
        />

        {/* Q4: Anything concerning? */}
        <AnalyticsSnapshotCard
          icon={
            snapshot.alertCount > 0 
              ? <AlertTriangle className="w-5 h-5" />
              : <CheckCircle2 className="w-5 h-5" />
          }
          title="Health Check"
          status={alertStatus}
          headline={
            snapshot.alertCount > 0
              ? `${snapshot.alertCount} item${snapshot.alertCount > 1 ? 's' : ''} to review`
              : 'No concerns detected'
          }
          detail={
            snapshot.alertCount > 0
              ? 'Review flagged items for clinical attention'
              : 'Your therapy data looks healthy'
          }
          linkTo="/insights?tab=alerts"
          linkLabel="View details"
        />
      </div>

      {/* Quick Actions - Today's Focus */}
      {snapshot.focusWords.length > 0 && (
        <div className="p-4 rounded-lg bg-muted/50 border border-border animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Today's Focus</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Based on your patterns, practice these words:
          </p>
          <div className="flex flex-wrap gap-2">
            {snapshot.focusWords.slice(0, 5).map(word => (
              <Badge key={word} variant="outline" className="text-sm">
                {word}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Data confidence indicator */}
      {!snapshot.hasEnoughData && (
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>
            {snapshot.totalTrials} trials completed. 
            Complete more sessions for personalized insights.
          </p>
        </div>
      )}
    </div>
  );
});
