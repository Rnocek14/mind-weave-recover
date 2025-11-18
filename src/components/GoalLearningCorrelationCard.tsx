import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Target, Brain } from 'lucide-react';
import { useGoalLearningCorrelation } from '@/hooks/useGoalLearningCorrelation';

interface GoalLearningCorrelationCardProps {
  userId: string;
}

export const GoalLearningCorrelationCard = ({ userId }: GoalLearningCorrelationCardProps) => {
  const { correlations, loading } = useGoalLearningCorrelation(userId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Goal & Learning Correlation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (correlations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Goal & Learning Correlation
          </CardTitle>
          <CardDescription>
            See how exercise performance relates to functional goal progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Complete some exercises and rate your goals to see correlations.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCorrelationIcon = (correlation: string) => {
    switch (correlation) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCorrelationBadge = (correlation: string) => {
    switch (correlation) {
      case 'positive':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Strong Correlation
          </Badge>
        );
      case 'negative':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            Needs Attention
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Neutral
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Goal & Learning Correlation
        </CardTitle>
        <CardDescription>
          How exercise performance relates to functional goal progress
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {correlations.map((correlation) => (
          <div
            key={correlation.goalId}
            className="p-4 border border-border rounded-lg space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1">
                <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium">{correlation.goalText}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {correlation.domain.replace('_', ' ')}
                  </p>
                </div>
              </div>
              {getCorrelationBadge(correlation.correlation)}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" />
                  Goal Progress
                </div>
                <div className="flex items-center gap-2">
                  {getCorrelationIcon(
                    correlation.progressChange > 0 ? 'positive' : correlation.progressChange < 0 ? 'negative' : 'neutral'
                  )}
                  <span className="text-sm font-medium">
                    {correlation.progressChange > 0 ? '+' : ''}
                    {correlation.progressChange}%
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  Learning Rate
                </div>
                <div className="flex items-center gap-2">
                  {getCorrelationIcon(
                    correlation.learningRateChange > 0
                      ? 'positive'
                      : correlation.learningRateChange < 0
                      ? 'negative'
                      : 'neutral'
                  )}
                  <span className="text-sm font-medium">
                    {(correlation.learningRateChange * 100).toFixed(2)}%/day
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
              <span>Confidence: {correlation.confidence}%</span>
              <span>{correlation.timeWindow}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
