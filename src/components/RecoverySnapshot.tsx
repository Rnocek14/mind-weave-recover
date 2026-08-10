/**
 * Recovery Snapshot - Primary Intelligence View
 * 
 * Answers the 5 key user questions in one screen:
 * 1. Am I improving? → Recovery trend verdict
 * 2. What's hard for me? → Current challenges
 * 3. What's helping? → Effective strategies
 * 4. What should I focus on? → Today's recommendation
 * 5. Is anything wrong? → Alerts (only if needed)
 */

import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RecoveryMotivationCards } from '@/components/RecoveryMotivationCards';
import { CaregiverCoachingCard } from '@/components/CaregiverCoachingCard';
import { PhonemePracticeCard } from '@/components/PhonemePracticeCard';
import { SoundTrendsInsight } from '@/components/SoundTrendsInsight';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Lightbulb, 
  Target, 
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Brain,
  Zap,
  Activity,
  ChevronDown,
  Play
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLearningRate, findSpeechLearningRate } from '@/hooks/useLearningRate';
import { useWeeklyTrends } from '@/hooks/useWeeklyTrends';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { useCapabilitySpeechCorrelation } from '@/hooks/useCapabilitySpeechCorrelation';
import { useRedFlagDetection } from '@/hooks/useRedFlagDetection';
import { useProfile } from '@/hooks/useProfile';
import { useUiMode } from '@/hooks/useUiMode';
import { InsightEvidenceBadge, calculateConfidence } from '@/components/InsightEvidenceBadge';
import { getCueLabel } from '@/lib/insightLanguageMap';
import { 
  narrateRecoveryTrend, 
  narrateChallenges, 
  narrateStrategies, 
  narrateFocus,
  getVerdictEmoji,
  getVerdictColor,
  getSeverityVariant,
  type TrendVerdict
} from '@/lib/insightNarrator';

// Helper to get trend icon for KPI
const getTrendIcon = (verdict: TrendVerdict) => {
  switch (verdict) {
    case 'improving':
      return { icon: '↑', className: 'text-success' };
    case 'declining':
      return { icon: '↓', className: 'text-warning' };
    case 'steady':
      return { icon: '→', className: 'text-primary' };
    default:
      return { icon: '—', className: 'text-muted-foreground' };
  }
};

interface RecoverySnapshotProps {
  userId: string;
}

const TrendIcon = ({ verdict }: { verdict: TrendVerdict }) => {
  switch (verdict) {
    case 'improving':
      return <TrendingUp className="h-8 w-8 text-success" />;
    case 'declining':
      return <TrendingDown className="h-8 w-8 text-warning" />;
    case 'steady':
      return <Minus className="h-8 w-8 text-primary" />;
    default:
      return <Sparkles className="h-8 w-8 text-muted-foreground" />;
  }
};

export const RecoverySnapshot = memo(({ userId }: RecoverySnapshotProps) => {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const { uiMode, isAtLeast } = useUiMode();
  const { learningRates, isLoading: learningLoading } = useLearningRate(userId);
  const { trends, loading: trendsLoading } = useWeeklyTrends();
  const { analytics: errorAnalytics, isLoading: errorLoading } = useErrorPatternAnalytics(userId, { weeksBack: 4 });
  const { analytics: crossDomain, isLoading: crossLoading } = useCapabilitySpeechCorrelation(userId, { profileId: activeProfile?.id });
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(userId);
  
  // Phase 2: Role-based content density
  const showDetailedSections = isAtLeast('caregiver');
  const showClinicianEvidence = isAtLeast('clinician');
  const isPatientMode = uiMode === 'patient';
  const showSessionCTA = !isAtLeast('clinician'); // Patient/caregiver only
  
  // Progressive disclosure state for patient mode
  const [patientDetailsOpen, setPatientDetailsOpen] = useState(false);

  const isLoading = learningLoading || trendsLoading || errorLoading || crossLoading || flagsLoading;

  if (isLoading) {
    return <RecoverySnapshotSkeleton />;
  }

  // Define consistent reporting window (last 7 days)
  const WINDOW_DAYS = 7;
  const windowLabel = "Last 7 days";
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  
  // Filter trends to exact window
  const windowTrends = trends.filter(t => new Date(t.date) >= windowStart);
  const totalTrials = windowTrends.reduce((sum, t) => sum + t.totalTrials, 0);
  const totalSessions = windowTrends.filter(t => t.totalTrials > 0).length;
  
  // Generate narratives using window-filtered data
  const recoveryNarrative = narrateRecoveryTrend(learningRates, windowTrends);

  const challenges = narrateChallenges(
    errorAnalytics?.challengingTargets || [],
    errorAnalytics?.fluencyMetrics || null,
    errorAnalytics?.errorBreakdown || null
  );

  const strategy = narrateStrategies(
    errorAnalytics?.cueEfficacy || null,
    crossDomain?.optimalConditions?.bestCueType || null
  );

  const focuses = narrateFocus(
    crossDomain?.recommendations || [],
    challenges,
    learningRates
  );

  // Filter critical alerts (red = high severity)
  const criticalFlags = redFlags.filter(f => f.severity === 'red');

  // Build evidence points with full context (clinician-grade)
  const recoveryEvidencePoints: string[] = [];
  recoveryEvidencePoints.push(`${totalTrials} trials across ${totalSessions} practice days`);
  
  if (learningRates.length > 0) {
    const namingRate = findSpeechLearningRate(learningRates);
    if (namingRate?.accuracySlope) {
      recoveryEvidencePoints.push(`Naming trend: ${namingRate.accuracySlope > 0 ? '+' : ''}${(namingRate.accuracySlope * 100).toFixed(1)}%/week (${namingRate.trialCount} samples)`);
    }
  }
  
  if (windowTrends.length >= 3) {
    const recentAccuracy = windowTrends.slice(-3).reduce((s, t) => s + t.accuracy, 0) / 3;
    recoveryEvidencePoints.push(`Recent 3-day avg: ${Math.round(recentAccuracy)}%`);
  }

  // Determine best strategy from cue efficacy
  const getBestStrategy = () => {
    const validCues = errorAnalytics?.cueEfficacy?.filter(c => c.effectiveCount >= 3) || [];
    if (validCues.length === 0) {
      return { label: 'Building baseline', sublabel: 'More sessions needed', rate: null };
    }
    const best = validCues.reduce((a, b) => a.efficacyRate > b.efficacyRate ? a : b);
    return {
      label: getCueLabel(best.cueType),
      sublabel: `${Math.round(best.efficacyRate * 100)}% effective`,
      rate: best.efficacyRate,
    };
  };

  const bestStrategy = getBestStrategy();
  const trendInfo = getTrendIcon(recoveryNarrative.verdict);
  const accuracy7d = totalTrials > 0 
    ? Math.round((windowTrends.reduce((sum, t) => sum + t.accuracy * t.totalTrials, 0) / totalTrials))
    : 0;

  // Generate encouraging headline based on trend
  const getEncouragingHeadline = () => {
    switch (recoveryNarrative.verdict) {
      case 'improving':
        return { text: "You're improving week over week.", emoji: "🎉" };
      case 'steady':
        return { text: "You're building consistency — keep going.", emoji: "💪" };
      case 'declining':
        return { text: "This week was harder — that happens. Let's focus on one small win today.", emoji: "🌱" };
      default:
        return { text: "Complete a few more sessions to see your progress.", emoji: "✨" };
    }
  };

  const headline = getEncouragingHeadline();

  return (
    <div className="space-y-6">
      {/* KPI Row - 10-second read */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Accuracy */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Accuracy</span>
          </div>
          <div className="text-2xl font-bold">{accuracy7d}%</div>
          <div className="text-xs text-muted-foreground">n={totalTrials} trials</div>
        </Card>

        {/* Trials */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Trials</span>
          </div>
          <div className="text-2xl font-bold">{totalTrials}</div>
          <div className="text-xs text-muted-foreground">last 7 days</div>
        </Card>

        {/* Trend */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Trend</span>
          </div>
          <div className={`text-2xl font-bold ${trendInfo.className}`}>{trendInfo.icon}</div>
          <div className="text-xs text-muted-foreground capitalize">{recoveryNarrative.verdict.replace('_', ' ')}</div>
        </Card>

        {/* Best Strategy */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Best Strategy</span>
          </div>
          <div className="text-lg font-bold truncate">{bestStrategy.label}</div>
          <div className="text-xs text-muted-foreground">{bestStrategy.sublabel}</div>
        </Card>
      </div>

      {/* Encouraging headline - the "10-second story" */}
      <div className="text-center py-2">
        <p className="text-lg font-medium text-foreground">
          {headline.emoji} {headline.text}
        </p>
      </div>

      {/* Session CTA - converts insight to action (patient/caregiver only) */}
      {showSessionCTA && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="font-medium">Ready to practice?</p>
              <p className="text-sm text-muted-foreground">Small daily sessions improve your trends.</p>
            </div>
            <Button 
              onClick={() => navigate('/lesson')} 
              className="gap-2 shrink-0"
            >
              <Play className="h-4 w-4" />
              Start a 5-minute session
            </Button>
          </div>
        </Card>
      )}

      {/* Phoneme Practice - "Practice these sounds" (patient-friendly targeted practice) */}
      <PhonemePracticeCard userId={userId} profileId={activeProfile?.id} />

      {/* Sound Trends - Recent changes in accuracy by sound */}
      <SoundTrendsInsight userId={userId} profileId={activeProfile?.id} />

      {/* Section 1: Recovery Trend - "Am I improving?" */}
      <RecoveryMotivationCards userId={userId} />
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardDescription className="text-xs uppercase tracking-wide">Your Recovery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 rounded-full bg-muted">
              <TrendIcon verdict={recoveryNarrative.verdict} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`text-2xl font-bold ${getVerdictColor(recoveryNarrative.verdict)}`}>
                {recoveryNarrative.headline}
              </h2>
              <p className="text-muted-foreground mt-1">
                {recoveryNarrative.detail}
              </p>
              {recoveryNarrative.confidence === 'high' && (
                <Badge variant="outline" className="mt-2 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  High confidence
                </Badge>
              )}
              
              {/* Clinician evidence badge - only shown to clinician+ */}
              {showClinicianEvidence && (
                <InsightEvidenceBadge
                  windowLabel="Last 7 days"
                  n={totalTrials}
                  confidence={calculateConfidence(totalTrials, { low: 10, medium: 30 })}
                  evidencePoints={recoveryEvidencePoints}
                  minNForHighConfidence={50}
                  patientFriendlyMessage={totalTrials < 10 ? "Building your baseline—complete a few more sessions" : undefined}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient Mode: Progressive disclosure for curious patients */}
      {isPatientMode && (challenges.length > 0 || focuses.length > 0) && (
        <Collapsible open={patientDetailsOpen} onOpenChange={setPatientDetailsOpen}>
          <CollapsibleTrigger className="w-full">
            <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {patientDetailsOpen ? 'Hide details' : 'More details'}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${patientDetailsOpen ? 'rotate-180' : ''}`} />
              </div>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Simplified challenges for patient */}
            {challenges.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    What to practice
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {challenges.slice(0, 2).map((challenge, i) => (
                    <p key={i} className="text-sm">{challenge.challenge}</p>
                  ))}
                </CardContent>
              </Card>
            )}
            
            {/* Simplified focus for patient */}
            {focuses.length > 0 && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Today's tip
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{focuses[0]?.recommendation}</p>
                </CardContent>
              </Card>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Section 2: Current Challenges - "What's hard for me?" (caregiver+) */}
      {showDetailedSections && challenges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Current Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {challenges.map((challenge, i) => (
              <div 
                key={i} 
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <Badge variant={getSeverityVariant(challenge.severity)} className="mt-0.5">
                  {challenge.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{challenge.challenge}</p>
                  {challenge.context && (
                    <p className="text-sm text-muted-foreground mt-0.5">{challenge.context}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 3: What's Working - "What's helping?" (caregiver+) */}
      {showDetailedSections && strategy && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-success" />
              What's Working
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-lg font-semibold text-success">{strategy.strategy}</p>
                <p className="text-sm text-muted-foreground">{strategy.context}</p>
                
                {/* Cue efficacy evidence badge - clinician+ only */}
                {showClinicianEvidence && (
                  <InsightEvidenceBadge
                    windowLabel="Last 4 weeks"
                    n={strategy.totalGiven}
                    confidence={calculateConfidence(strategy.totalGiven, { low: 3, medium: 10 })}
                    evidencePoints={
                      errorAnalytics?.cueEfficacy
                        ?.filter(c => c.totalGiven >= 3)
                        .map(c => `${c.cueType}: ${Math.round(c.efficacyRate * 100)}% effective (n=${c.totalGiven})`) || []
                    }
                    minNForHighConfidence={20}
                    patientFriendlyMessage={undefined}
                  />
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-success">
                  {Math.round(strategy.effectiveness * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">effective</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caregiver Coaching Card - actionable advice based on cue data */}
      <CaregiverCoachingCard cueEfficacy={errorAnalytics?.cueEfficacy} />

      {/* Section 4: Today's Focus - "What should I do next?" (caregiver+) */}
      {showDetailedSections && focuses.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Today's Focus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {focuses.map((focus, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`p-1.5 rounded-full ${focus.priority === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <ArrowRight className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <p className={focus.priority === 'primary' ? 'font-medium' : 'text-muted-foreground'}>
                    {focus.recommendation}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{focus.reason}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 5: Alerts - "Is anything wrong?" (only if needed) */}
      {criticalFlags.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attention Needed</AlertTitle>
          <AlertDescription>
            {criticalFlags[0].message}
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state when no data */}
      {challenges.length === 0 && !strategy && focuses.length === 0 && recoveryNarrative.verdict === 'insufficient_data' && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Your insights are building</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Complete a few therapy sessions and the AI will start learning what works best for you.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

RecoverySnapshot.displayName = 'RecoverySnapshot';

const RecoverySnapshotSkeleton = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </CardContent>
    </Card>
    <Card>
      <CardContent className="py-6">
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  </div>
);

export default RecoverySnapshot;
