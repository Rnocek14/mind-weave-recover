/**
 * Insights Section: "Am I Improving?"
 * 
 * Shows learning rates, accuracy trends, confidence trends, week-over-week deltas
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { useLearningRate } from '@/hooks/useLearningRate';
import { useWeeklyTrends } from '@/hooks/useWeeklyTrends';
import { narrateRecoveryTrend, getVerdictColor, getVerdictEmoji } from '@/lib/insightNarrator';
import { cn } from '@/lib/utils';

interface ProgressSectionProps {
  userId: string;
}

export function ProgressSection({ userId }: ProgressSectionProps) {
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId);
  const { trends: weeklyTrends, loading: trendsLoading } = useWeeklyTrends();

  const isLoading = lrLoading || trendsLoading;
  const recovery = narrateRecoveryTrend(learningRates, weeklyTrends);

  // Calculate week-over-week accuracy delta
  const recentDays = weeklyTrends.slice(-3);
  const earlierDays = weeklyTrends.slice(0, 4);
  const recentAccuracy = recentDays.length > 0 
    ? recentDays.reduce((sum, d) => sum + d.accuracy, 0) / recentDays.length 
    : 0;
  const earlierAccuracy = earlierDays.length > 0
    ? earlierDays.reduce((sum, d) => sum + d.accuracy, 0) / earlierDays.length
    : 0;
  const weekDelta = recentAccuracy - earlierAccuracy;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="progress">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span>{getVerdictEmoji(recovery.verdict)}</span>
          Am I Improving?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main verdict */}
        <div className={cn('p-4 rounded-lg bg-muted/50', getVerdictColor(recovery.verdict))}>
          <h3 className="text-lg font-semibold mb-1">{recovery.headline}</h3>
          <p className="text-sm text-muted-foreground">{recovery.detail}</p>
          <Badge variant="outline" className="mt-2">
            {recovery.confidence} confidence
          </Badge>
        </div>

        {/* Week-over-week delta */}
        {weeklyTrends.length >= 4 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className={cn(
              'p-2 rounded-full',
              weekDelta > 0 ? 'bg-success/10 text-success' : 
              weekDelta < 0 ? 'bg-warning/10 text-warning' : 'bg-muted'
            )}>
              {weekDelta > 0 ? <TrendingUp className="w-4 h-4" /> : 
               weekDelta < 0 ? <TrendingDown className="w-4 h-4" /> : 
               <Minus className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-medium">
                {weekDelta > 0 ? '+' : ''}{Math.round(weekDelta)}% this week
              </div>
              <div className="text-sm text-muted-foreground">
                Accuracy trend vs previous week
              </div>
            </div>
          </div>
        )}

        {/* Learning rates by domain */}
        {learningRates.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Progress by Domain</h4>
            {learningRates.map(lr => {
              const trend = (lr.accuracySlope || 0) > 0.01 ? 'improving' : 
                           (lr.accuracySlope || 0) < -0.01 ? 'declining' : 'plateau';
              const TrendIcon = trend === 'improving' ? TrendingUp : 
                               trend === 'declining' ? TrendingDown : Minus;
              return (
                <div key={lr.domain} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span className="font-medium capitalize">{lr.domain}</span>
                  <div className="flex items-center gap-2">
                    <TrendIcon className={cn(
                      'w-4 h-4',
                      trend === 'improving' ? 'text-success' : 
                      trend === 'declining' ? 'text-warning' : 'text-muted-foreground'
                    )} />
                    <span className="text-sm">
                      {(lr.accuracySlope || 0) > 0 ? '+' : ''}
                      {((lr.accuracySlope || 0) * 100).toFixed(1)}%/week
                    </span>
                    <Badge variant="outline" className="text-xs">
                      n={lr.trialCount}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
