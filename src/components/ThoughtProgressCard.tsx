/**
 * Thought Progress Card
 * 
 * Shows trend-based progress for connected speech practice.
 * No per-attempt grading - only weekly comparisons and encouragement.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Clock, 
  Lightbulb,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useThoughtProgressTrends } from '@/hooks/useThoughtProgressTrends';
import { useNavigate } from 'react-router-dom';

interface ThoughtProgressCardProps {
  compact?: boolean;
}

export function ThoughtProgressCard({ compact = false }: ThoughtProgressCardProps) {
  const { trends, loading } = useThoughtProgressTrends();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-12" />
        </CardContent>
      </Card>
    );
  }

  if (!trends || trends.thoughtsAttempted === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Connected Speech
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm mb-4">
            Practice finishing thoughts at your own pace. There are no wrong answers.
          </p>
          <Button 
            onClick={() => navigate('/exercise/thought-continuation')}
            className="w-full"
          >
            Try Finish the Thought
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const completionRate = trends.thoughtsAttempted > 0 
    ? Math.round((trends.thoughtsCompleted / trends.thoughtsAttempted) * 100)
    : 0;

  const lastWeekRate = trends.lastWeekAttempted > 0
    ? Math.round((trends.lastWeekCompleted / trends.lastWeekAttempted) * 100)
    : null;

  const TrendIcon = ({ trend }: { trend: 'improving' | 'stable' | 'declining' | null }) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-amber-600" />;
    if (trend === 'stable') return <Minus className="h-4 w-4 text-muted-foreground" />;
    return null;
  };

  const formatLatency = (ms: number | null) => {
    if (!ms) return '--';
    if (ms < 1000) return '<1s';
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTheme = (theme: string) => {
    return theme
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Connected Speech
          </CardTitle>
          {trends.completionTrend === 'improving' && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
              <Sparkles className="h-3 w-3 mr-1" />
              Improving
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main metrics */}
        <div className={compact ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 sm:grid-cols-4 gap-3"}>
          {/* Thoughts Completed */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Completed</span>
              <TrendIcon trend={trends.completionTrend} />
            </div>
            <p className="text-2xl font-bold text-primary">
              {trends.thoughtsCompleted}/{trends.thoughtsAttempted}
            </p>
            {lastWeekRate !== null && (
              <p className="text-xs text-muted-foreground">
                vs {trends.lastWeekCompleted}/{trends.lastWeekAttempted} last week
              </p>
            )}
          </div>

          {/* Time to Start */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Time to Start</span>
              <TrendIcon trend={trends.latencyTrend} />
            </div>
            <p className="text-2xl font-bold">
              {formatLatency(trends.avgLatencyMs)}
            </p>
            {trends.lastWeekAvgLatency && (
              <p className="text-xs text-muted-foreground">
                vs {formatLatency(trends.lastWeekAvgLatency)} last week
              </p>
            )}
          </div>

          {!compact && (
            <>
              {/* Hints Needed */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1 mb-1">
                  <Lightbulb className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Hints Avg</span>
                </div>
                <p className="text-2xl font-bold">
                  {trends.avgNarrowingLevel.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">per thought</p>
              </div>

              {/* Trailing Off */}
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Trailing Off</span>
                <p className="text-2xl font-bold mt-1">
                  {Math.round(trends.trailingOffRate * 100)}%
                </p>
                {trends.lastWeekTrailingOffRate > 0 && (
                  <p className="text-xs text-muted-foreground">
                    vs {Math.round(trends.lastWeekTrailingOffRate * 100)}% last week
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Best themes */}
        {!compact && trends.bestThemes.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Topics that work well for you</p>
            <div className="flex flex-wrap gap-2">
              {trends.bestThemes.map(theme => (
                <Badge key={theme} variant="outline" className="text-xs">
                  {formatTheme(theme)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Encouragement */}
        {completionRate >= 70 && (
          <p className="text-sm text-green-700 dark:text-green-400 text-center">
            You're finishing most of your thoughts — great momentum!
          </p>
        )}

        {/* CTA */}
        <Button 
          variant="outline"
          onClick={() => navigate('/exercise/thought-continuation')}
          className="w-full"
        >
          Practice Now
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
