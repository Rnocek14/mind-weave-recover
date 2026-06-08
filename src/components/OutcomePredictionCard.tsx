import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOutcomePrediction } from '@/hooks/useOutcomePrediction';
import { 
  Brain, TrendingUp, Target, AlertCircle, 
  CheckCircle2, Clock, Sparkles, Loader2 
} from 'lucide-react';
interface OutcomePredictionCardProps {
  userId: string;
  clinicalProfile: any;
  currentGoals: any[];
}

export const OutcomePredictionCard = ({ 
  userId, 
  clinicalProfile, 
  currentGoals 
}: OutcomePredictionCardProps) => {
  const { prediction, loading, generatePrediction } = useOutcomePrediction();
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    await generatePrediction(userId, clinicalProfile, currentGoals);
    setExpanded(true);
  };

  const getConfidenceColor = (confidence: string) => {
    if (confidence === 'high') return 'bg-green-500';
    if (confidence === 'medium') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 0.75) return 'text-green-600';
    if (prob >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Qualitative milestones (no fabricated numeric scores)
  const milestones = prediction?.recoveryTrajectory.milestones ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Outcome Prediction
            </CardTitle>
            <CardDescription>
              ML-powered forecast of goal achievement and recovery trajectory
            </CardDescription>
          </div>
          {!prediction && (
            <Button 
              onClick={handleGenerate} 
              disabled={loading || currentGoals.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Prediction
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!prediction && !loading && currentGoals.length === 0 && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Create functional goals to generate outcome predictions
            </AlertDescription>
          </Alert>
        )}

        {!prediction && !loading && currentGoals.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click "Generate Prediction" to analyze your recovery potential</p>
            <p className="text-xs mt-1">
              AI will analyze your clinical profile, learning rates, and cluster data
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              Analyzing clinical data and cluster patterns...
            </p>
          </div>
        )}

        {prediction && (
          <>
            {/* Overall Prognosis */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Overall Prognosis
              </h4>
              <p className="text-sm">{prediction.recoveryTrajectory.overallPrognosis}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Expected improvement rate: {prediction.recoveryTrajectory.expectedImprovementRate}
              </p>
            </div>

            {/* Goal Predictions */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                Goal Achievement Predictions
              </h4>
              
              {prediction.goalPredictions.map((gp, idx) => (
                <Card key={idx} className="border-2">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium flex-1">{gp.goalText}</p>
                        <Badge variant="outline" className={getConfidenceColor(gp.confidence)}>
                          {gp.confidence} confidence
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Achievement Probability</p>
                          <p className={`text-2xl font-bold ${getProbabilityColor(gp.achievementProbability)}`}>
                            {(gp.achievementProbability * 100).toFixed(0)}%
                          </p>
                          <Progress value={gp.achievementProbability * 100} className="h-2 mt-1" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expected Timeline</p>
                          <p className="text-2xl font-bold flex items-center gap-1">
                            <Clock className="w-5 h-5" />
                            {gp.expectedWeeks}w
                          </p>
                        </div>
                      </div>

                      {expanded && (
                        <>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Key Factors
                            </p>
                            <ul className="space-y-1">
                              {gp.keyFactors.map((factor, i) => (
                                <li key={i} className="text-xs flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                                  {factor}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Recommendations
                            </p>
                            <ul className="space-y-1">
                              {gp.recommendations.map((rec, i) => (
                                <li key={i} className="text-xs flex items-start gap-2">
                                  <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recovery Timeline — qualitative milestones, no fabricated scores */}
            {expanded && milestones.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Expected Recovery Milestones</h4>
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {milestones.map((m, i) => (
                    <li key={i} className="ml-4">
                      <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary" />
                      <p className="text-xs font-medium text-muted-foreground">Week {m.week}</p>
                      <p className="text-sm">{m.expectedStatus}</p>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">
                  Qualitative AI estimate based on clinical profile and goals — not a measured outcome.
                </p>
              </div>
            )}


            {/* Strengths & Risks */}
            {expanded && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Strengths
                  </h4>
                  <ul className="space-y-1">
                    {prediction.recoveryTrajectory.strengths.map((strength, i) => (
                      <li key={i} className="text-xs">{strength}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    Risk Factors
                  </h4>
                  <ul className="space-y-1">
                    {prediction.recoveryTrajectory.riskFactors.map((risk, i) => (
                      <li key={i} className="text-xs">{risk}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Toggle Details */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show Less' : 'Show More Details'}
              </Button>
            </div>

            {/* Regenerate */}
            <div className="flex justify-center pt-4 border-t">
              <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                Regenerate Prediction
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
