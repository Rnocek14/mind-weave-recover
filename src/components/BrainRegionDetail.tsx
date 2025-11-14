import { BrainRegion } from '@/lib/brainRegionMapper';
import { RegionFunctionalScore } from '@/lib/functionalScoreCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Activity, Target, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BrainRegionDetailProps {
  region: BrainRegion;
  score: RegionFunctionalScore;
}

export const BrainRegionDetail = ({ region, score }: BrainRegionDetailProps) => {
  const navigate = useNavigate();

  const getTrendLabel = (trend: string) => {
    if (trend === 'improving') return 'Getting Stronger';
    if (trend === 'declining') return 'Needs Extra Support';
    return 'Holding Steady';
  };

  const getScoreColor = (value: number) => {
    if (value >= 70) return 'text-green-600';
    if (value >= 50) return 'text-yellow-600';
    if (value >= 30) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{region.displayName}</CardTitle>
            <CardDescription className="mt-1">
              {region.hemisphere === 'bilateral' ? 'Both hemispheres' : `${region.hemisphere} hemisphere`}
            </CardDescription>
          </div>
          <p className="text-sm text-blue-600 font-medium">{getTrendLabel(score.trend)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Functional Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Estimated Functional Level</p>
            <Badge variant={score.confidence === 'high' ? 'default' : score.confidence === 'medium' ? 'secondary' : 'outline'}>
              {score.confidence === 'high' ? 'High confidence' : score.confidence === 'medium' ? 'Medium confidence' : 'Collecting data'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={score.currentScore} className="flex-1" />
            <span className={`text-2xl font-bold ${getScoreColor(score.currentScore)}`}>{Math.round(score.currentScore)}%</span>
          </div>
          {score.confidence === 'low' && (
            <p className="text-xs text-muted-foreground mt-2">Keep doing exercises that use this area to improve accuracy</p>
          )}
        </div>

        {/* Affected Deficits */}
        {score.affectedDeficits.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Functions Likely Affected
            </h4>
            <div className="flex flex-wrap gap-2">
              {score.affectedDeficits.map((deficit, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {deficit}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {score.contributingMetrics.trialCount > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Accuracy</div>
                <div className="text-lg font-semibold">
                  {(score.contributingMetrics.accuracy * 100).toFixed(0)}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Avg Response
                </div>
                <div className="text-lg font-semibold">
                  {(score.contributingMetrics.reactionTime / 1000).toFixed(1)}s
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Cue Level
                </div>
                <div className="text-lg font-semibold">
                  {score.contributingMetrics.cueLevel.toFixed(1)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Total Trials</div>
                <div className="text-lg font-semibold">
                  {score.contributingMetrics.trialCount}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Targeted Exercises */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Targeted Exercises</h4>
          <div className="space-y-2">
            {region.exerciseSlugs.map((slug) => (
              <Button
                key={slug}
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate(`/exercise/${slug}`)}
              >
                <span className="capitalize">{slug.replace('-', ' ')}</span>
                <span className="text-xs text-muted-foreground">Start →</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Data Note */}
        {score.contributingMetrics.trialCount < 20 && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note:</strong> Complete more exercises targeting this area for more accurate scoring.
            At least 20 trials recommended.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
