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
  profile?: { clinical_profile?: any };
  affectedTerritories?: string[];
}

export const BrainRegionDetail = ({ region, score, profile, affectedTerritories = [] }: BrainRegionDetailProps) => {
  const navigate = useNavigate();

  // Find vascular territory for this region
  const getVascularSupply = () => {
    const zones = region.lesionZones;
    
    // Simple mapping based on common vascular territories
    if (zones.some(z => ['frontal', 'temporal', 'parietal', 'M1', 'premotor', 'Broca', 'Wernicke'].includes(z))) {
      const leftMCA = affectedTerritories.find(t => t.toLowerCase().includes('left') && t.toLowerCase().includes('middle cerebral'));
      const rightMCA = affectedTerritories.find(t => t.toLowerCase().includes('right') && t.toLowerCase().includes('middle cerebral'));
      
      if (region.hemisphere === 'left' && leftMCA) return leftMCA;
      if (region.hemisphere === 'right' && rightMCA) return rightMCA;
      if (region.hemisphere === 'bilateral' && (leftMCA || rightMCA)) {
        return [leftMCA, rightMCA].filter(Boolean).join(', ');
      }
    }
    
    if (zones.some(z => ['occipital', 'V1', 'visual_cortex'].includes(z))) {
      const leftPCA = affectedTerritories.find(t => t.toLowerCase().includes('left') && t.toLowerCase().includes('posterior cerebral'));
      const rightPCA = affectedTerritories.find(t => t.toLowerCase().includes('right') && t.toLowerCase().includes('posterior cerebral'));
      
      if (region.hemisphere === 'left' && leftPCA) return leftPCA;
      if (region.hemisphere === 'right' && rightPCA) return rightPCA;
      if (region.hemisphere === 'bilateral' && (leftPCA || rightPCA)) {
        return [leftPCA, rightPCA].filter(Boolean).join(', ');
      }
    }
    
    if (zones.some(z => ['cerebellum', 'cerebellar'].includes(z))) {
      return affectedTerritories.find(t => t.toLowerCase().includes('cerebell')) || null;
    }
    
    return null;
  };

  const vascularSupply = getVascularSupply();
  
  // Get clinical reasoning from inference notes
  const getRelevantInferenceNotes = () => {
    const inferenceNotes = profile?.clinical_profile?.inference_notes || [];
    const relevantDomains = region.functionalDomains;
    
    return inferenceNotes.filter((note: any) => {
      const noteText = `${note.impairment} ${note.reasoning}`.toLowerCase();
      return relevantDomains.some(domain => noteText.includes(domain));
    });
  };

  const inferenceNotes = getRelevantInferenceNotes();

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
            {vascularSupply && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  🩸 {vascularSupply}
                </Badge>
              </div>
            )}
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
              Predicted Impairments
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

        {/* Clinical Reasoning */}
        {inferenceNotes.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Clinical Reasoning
            </h4>
            {inferenceNotes.slice(0, 2).map((note: any, idx: number) => (
              <div key={idx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium">{note.impairment}</p>
                  <Badge 
                    variant={note.confidence === 'high' ? 'default' : note.confidence === 'medium' ? 'secondary' : 'outline'}
                    className="text-xs shrink-0"
                  >
                    {note.confidence}
                  </Badge>
                </div>
                {note.reasoning && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {note.reasoning}
                  </p>
                )}
              </div>
            ))}
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
