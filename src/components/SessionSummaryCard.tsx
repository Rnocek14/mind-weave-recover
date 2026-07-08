import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, TrendingDown, Clock, Target, 
  Lightbulb, BarChart3, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { useSessionSummary } from '@/hooks/useSessionSummary';

interface SessionSummaryCardProps {
  sessionId: string | null;
}

export const SessionSummaryCard = ({ sessionId }: SessionSummaryCardProps) => {
  const { summary, loading, error } = useSessionSummary(sessionId);

  if (loading) {
    return (
      <Card className="p-6 mb-6">
        <Skeleton className="h-6 w-2/3 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card className="p-6 mb-6 border-destructive">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">Unable to load session summary</p>
        </div>
      </Card>
    );
  }

  const difficultyChange = summary.endDifficulty - summary.startDifficulty;
  // accuracy can be null/NaN when the session had no ASR-verifiable trials.
  // Rendering that as 0% + "Keep practicing!" is false discouragement — show a
  // neutral "not enough data" state instead.
  const hasAccuracy =
    summary.accuracy != null && Number.isFinite(summary.accuracy as number);
  const accuracyPercent = hasAccuracy ? Math.round((summary.accuracy as number) * 100) : null;
  const avgRtSeconds = (summary.avgRtMs / 1000).toFixed(1);

  return (
    <Card className="p-6 mb-6 shadow-glow">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Session Performance</h3>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Accuracy */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Target className={`w-5 h-5 ${accuracyPercent == null ? 'text-muted-foreground' : accuracyPercent >= 80 ? 'text-success' : 'text-warning'}`} />
          </div>
          <div className="text-2xl font-bold">{accuracyPercent == null ? '—' : `${accuracyPercent}%`}</div>
          <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
        </div>

        {/* Average Response Time */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold">{avgRtSeconds}s</div>
          <div className="text-xs text-muted-foreground mt-1">Avg Response</div>
        </div>

        {/* Difficulty Progress */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            {difficultyChange > 0 ? (
              <TrendingUp className="w-5 h-5 text-success" />
            ) : difficultyChange < 0 ? (
              <TrendingDown className="w-5 h-5 text-warning" />
            ) : (
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="text-2xl font-bold">
            {summary.startDifficulty} → {summary.endDifficulty}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Difficulty {difficultyChange > 0 ? 'Up' : difficultyChange < 0 ? 'Down' : 'Stable'}
          </div>
        </div>

        {/* Cue Usage */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Lightbulb className={`w-5 h-5 ${summary.avgCueLevel < 1 ? 'text-success' : 'text-accent'}`} />
          </div>
          <div className="text-2xl font-bold">{summary.avgCueLevel.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground mt-1">Avg Cues/Trial</div>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        {/* Independence Progress */}
        {summary.cueReduction > 0.5 && (
          <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
            <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-success">Great Progress!</p>
              <p className="text-xs text-muted-foreground mt-1">
                You needed fewer hints toward the end of the session - showing improved independence
              </p>
            </div>
          </div>
        )}

        {/* Difficulty Adaptation */}
        {difficultyChange > 0 && (
          <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">Challenge Increased</p>
              <p className="text-xs text-muted-foreground mt-1">
                The system increased difficulty by {difficultyChange} level{difficultyChange > 1 ? 's' : ''} as you improved
              </p>
            </div>
          </div>
        )}

        {/* Error Pattern Insight */}
        {summary.errorBreakdown.semantic_related > summary.errorBreakdown.unrelated && hasAccuracy && (summary.accuracy as number) < 0.9 && (
          <div className="flex items-start gap-3 p-3 bg-accent/10 rounded-lg border border-accent/20">
            <AlertCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-accent">Semantic Processing</p>
              <p className="text-xs text-muted-foreground mt-1">
                Most errors were close semantic matches - shows you&apos;re getting closer to target words
              </p>
            </div>
          </div>
        )}

        {/* Timeout Alert */}
        {summary.timeoutCount > 2 && (
          <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
            <Clock className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">Time Pressure</p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.timeoutCount} timeouts - consider practicing without time limits to build confidence
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Note */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Session completed: {summary.totalTrials} trials
          {accuracyPercent == null
            ? ''
            : accuracyPercent >= 85
            ? ' • Excellent performance!'
            : accuracyPercent >= 70
            ? ' • Good progress!'
            : ' • Keep practicing!'}
        </p>
      </div>
    </Card>
  );
};
