import { memo, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp, TrendingDown, Minus, Info, Users } from "lucide-react";
import { LearningRate, ClusterComparison } from "@/hooks/useLearningRate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LearningRateCardProps {
  learningRates: LearningRate[];
  clusterComparisons: ClusterComparison[];
  timeWindow?: number; // Default to 14 days
}

export const LearningRateCard = memo(({ 
  learningRates, 
  clusterComparisons, 
  timeWindow = 14 
}: LearningRateCardProps) => {
  const filteredRates = useMemo(
    () => learningRates.filter(lr => lr.window === timeWindow),
    [learningRates, timeWindow]
  );
  
  if (filteredRates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" aria-hidden="true" />
            Learning Velocity
          </CardTitle>
          <CardDescription>
            Track your improvement rates across different skill domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={TrendingUp}
            title="Learning rates calculating..."
            description="Complete 3-5 practice sessions in each domain to generate personalized learning rate data. This helps track your progress velocity over time."
            variant="info"
          />
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'declining':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const formatSlope = (slope: number) => {
    const percentage = (slope * 100).toFixed(2);
    return `${slope >= 0 ? '+' : ''}${percentage}%/day`;
  };

  const getDomainLabel = (domain: string) => {
    const labels: Record<string, string> = {
      'phonological': 'Speech (Sounds)',
      'semantic': 'Speech (Meaning)',
      'grammar': 'Grammar',
      'motor': 'Motor Skills',
      'visuospatial': 'Visual Attention'
    };
    return labels[domain] || domain;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" aria-hidden="true" />
              Learning Velocity
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger aria-label="Information about learning velocity">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      How quickly you're improving in each area over the last {timeWindow} days. 
                      Positive numbers mean getting better, negative means needs attention.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Your progress rate over the last {timeWindow} days
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredRates.map((rate) => {
            const comparison = clusterComparisons.find(
              c => c.domain === rate.domain && c.window === timeWindow
            );

            return (
              <div 
                key={`${rate.domain}-${rate.window}`}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{getDomainLabel(rate.domain)}</h4>
                    <p className="text-sm text-muted-foreground">
                      {rate.trialCount} practice attempts
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(rate.trend)}
                    <Badge variant="outline" className={getTrendColor(rate.trend)}>
                      {formatSlope(rate.accuracySlope)}
                    </Badge>
                  </div>
                </div>

                {/* Accuracy progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Started: {Math.round(rate.startAccuracy * 100)}%</span>
                    <span>Now: {Math.round(rate.endAccuracy * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        rate.trend === 'improving' ? 'bg-green-500' : 
                        rate.trend === 'declining' ? 'bg-red-500' : 
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${rate.endAccuracy * 100}%` }}
                    />
                  </div>
                </div>

                {/* Cluster comparison */}
                {comparison && comparison.userCount >= 3 && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Users className="h-3 w-3" />
                      <span>Compared to similar patients:</span>
                    </div>
                    <div className="text-sm">
                      {comparison.percentile >= 75 ? (
                        <p className="text-green-600">
                          ✓ Above average (top {100 - comparison.percentile}%)
                        </p>
                      ) : comparison.percentile >= 50 ? (
                        <p className="text-blue-600">
                          → Typical progress (median: {formatSlope(comparison.clusterMedian)})
                        </p>
                      ) : comparison.percentile >= 25 ? (
                        <p className="text-yellow-600">
                          ~ Below median ({comparison.percentile}th percentile)
                        </p>
                      ) : (
                        <p className="text-orange-600">
                          ⚠ Progress slower than typical (consider adjusting approach)
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on {comparison.userCount} patients with similar profiles
                      </p>
                    </div>
                  </div>
                )}

                {/* Confidence indicator */}
                {rate.confidence < 0.5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ℹ️ Limited data - do a few more sessions for more accurate tracking
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

LearningRateCard.displayName = 'LearningRateCard';
