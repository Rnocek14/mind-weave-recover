import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, Lightbulb, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Zap, Play } from 'lucide-react';
import { useCapabilitySpeechCorrelation } from '@/hooks/useCapabilitySpeechCorrelation';
import { useNavigate } from 'react-router-dom';
import { getRecommendedExerciseRoute } from '@/lib/recommendationRouter';

interface CrossDomainInsightsDashboardProps {
  userId: string;
  profileId?: string;
  hideRecommendations?: boolean; // PHASE 3: Allow hiding recommendations when shown at top level
}

export const CrossDomainInsightsDashboard = ({ userId, profileId, hideRecommendations = false }: CrossDomainInsightsDashboardProps) => {
  const navigate = useNavigate();
  const { analytics, isLoading, error } = useCapabilitySpeechCorrelation(userId, profileId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analytics) return null;

  const correlations = [
    analytics.attentionTimeoutCorrelation,
    analytics.visionAccuracyCorrelation,
    analytics.motorLatencyCorrelation,
  ].filter(Boolean);

  const handlePractice = (route: string) => {
    navigate(route);
  };

  return (
    <div className="space-y-6">
      {/* Smart Recommendations - conditionally hidden when elevated to top level */}
      {!hideRecommendations && analytics.recommendations.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Smart Recommendations
            </CardTitle>
            <CardDescription>Personalized insights based on your patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recommendations.map((rec, i) => {
                const exerciseRoute = getRecommendedExerciseRoute(rec);
                return (
                  <Alert key={i} className="border-primary/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <AlertDescription className="flex-1">{rec}</AlertDescription>
                      </div>
                      {exerciseRoute && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 gap-1.5"
                          onClick={() => handlePractice(exerciseRoute.route)}
                        >
                          <Play className="h-3 w-3" />
                          {exerciseRoute.label}
                        </Button>
                      )}
                    </div>
                  </Alert>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capability-Speech Correlations */}
      {correlations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Capability-Speech Correlations
            </CardTitle>
            <CardDescription>How cognitive abilities affect speech performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {correlations.map((correlation, i) => correlation && (
                <div key={i} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0">
                    {correlation.correlation === 'positive' ? (
                      <TrendingUp className="h-6 w-6 text-success" />
                    ) : correlation.correlation === 'negative' ? (
                      <TrendingDown className="h-6 w-6 text-destructive" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-muted" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{correlation.factor}</span>
                      <Badge 
                        variant={correlation.correlation === 'positive' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {Math.round(correlation.strength * 100)}% strength
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{correlation.description}</p>
                    {correlation.recommendation && (
                      <p className="text-sm text-primary mt-2 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {correlation.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fatigue Pattern */}
      {analytics.fatiguePattern && (
        <Card>
          <CardHeader>
            <CardTitle>Session Fatigue Analysis</CardTitle>
            <CardDescription>Performance comparison: first half vs second half of sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-success/10 rounded-lg">
                <div className="text-2xl font-bold text-success">
                  {Math.round(analytics.fatiguePattern.firstHalfAccuracy * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">First Half Accuracy</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">
                  {analytics.fatiguePattern.dropoff > 0 ? '−' : '+'}
                  {Math.abs(Math.round(analytics.fatiguePattern.dropoff * 100))}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.fatiguePattern.dropoff > 0 ? 'Dropoff' : 'Improvement'}
                </div>
              </div>
              <div className={`text-center p-4 rounded-lg ${analytics.fatiguePattern.dropoff > 0.15 ? 'bg-destructive/10' : 'bg-success/10'}`}>
                <div className={`text-2xl font-bold ${analytics.fatiguePattern.dropoff > 0.15 ? 'text-destructive' : 'text-success'}`}>
                  {Math.round(analytics.fatiguePattern.secondHalfAccuracy * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Second Half Accuracy</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              {analytics.fatiguePattern.recommendation}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Optimal Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Optimal Therapy Conditions</CardTitle>
          <CardDescription>Settings that work best for you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold">
                {analytics.optimalConditions.bestCueType 
                  ? analytics.optimalConditions.bestCueType.charAt(0).toUpperCase() + analytics.optimalConditions.bestCueType.slice(1)
                  : 'Not enough data'}
              </div>
              <div className="text-xs text-muted-foreground">Best Cue Type</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold">
                {analytics.optimalConditions.bestSessionLength 
                  ? `${analytics.optimalConditions.bestSessionLength} min`
                  : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Recommended Session Length</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold">
                {analytics.optimalConditions.bestTimeOfDay || 'Any time'}
              </div>
              <div className="text-xs text-muted-foreground">Best Time of Day</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
