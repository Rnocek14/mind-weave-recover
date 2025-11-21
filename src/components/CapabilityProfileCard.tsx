import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Eye, Hand, Focus, RefreshCw, AlertTriangle } from "lucide-react";
import { useCapabilityProgression } from "@/hooks/useCapabilityProgression";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignificantDrops, suggestInteractionMode, type CaregiverObservations } from "@/lib/capabilityScoreSmoothing";

interface CapabilityProfileCardProps {
  userId: string | undefined;
  currentAssessment?: any;
  previousAssessment?: any;
  onStartAssessment: () => void;
}

export const CapabilityProfileCard = ({ 
  userId, 
  currentAssessment,
  previousAssessment,
  onStartAssessment 
}: CapabilityProfileCardProps) => {
  const { progression, loading, getTrend, hasMultipleAssessments } = useCapabilityProgression(userId);
  
  // Detect significant score drops
  const drops = getSignificantDrops(currentAssessment, previousAssessment);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!currentAssessment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capability Assessment</CardTitle>
          <CardDescription>
            Let's discover your current abilities with a quick, guided assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={onStartAssessment} 
            className="w-full min-h-[44px] md:min-h-[40px]" 
            size="lg"
            aria-label="Start capability assessment"
          >
            Start Capability Assessment
          </Button>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            This takes 5-7 minutes and requires no speaking or reading
          </p>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const visionScore = currentAssessment.vision_score || 0;
  const motorScore = currentAssessment.motor_score || 0;
  const attentionScore = currentAssessment.attention_score || 0;

  const assessmentDate = new Date(currentAssessment.assessed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const daysAgo = Math.round(
    (Date.now() - new Date(currentAssessment.assessed_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Capability Profile</CardTitle>
            <CardDescription>
              Last checked {assessmentDate}
              {daysAgo <= 3 && ` (${daysAgo} day${daysAgo === 1 ? '' : 's'} ago)`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onStartAssessment}
            className="min-h-[44px] min-w-[44px] md:min-h-[40px] md:min-w-[40px]"
            aria-label="Reassess capabilities"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vision Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <span className="font-medium">Vision</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{visionScore}/10</span>
              {hasMultipleAssessments && TrendIcon(getTrend('vision'))}
            </div>
          </div>
          <Progress value={visionScore * 10} className="h-2" />
        </div>

        {/* Motor Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hand className="h-5 w-5 text-primary" />
              <span className="font-medium">Motor Control</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{motorScore}/10</span>
              {hasMultipleAssessments && TrendIcon(getTrend('motor'))}
            </div>
          </div>
          <Progress value={motorScore * 10} className="h-2" />
        </div>

        {/* Attention Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Focus className="h-5 w-5 text-primary" />
              <span className="font-medium">Attention</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{attentionScore}/10</span>
              {hasMultipleAssessments && TrendIcon(getTrend('attention'))}
            </div>
          </div>
          <Progress value={attentionScore * 10} className="h-2" />
        </div>

        {/* Score drop warning */}
        {drops.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1.5">
                <p className="font-medium">We noticed some changes since your last check</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {drops.map((d) => (
                    <li key={d.domain}>
                      {d.domain.charAt(0).toUpperCase() + d.domain.slice(1)} changed from {d.from}/10 to {d.to}/10
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground">
                  This can be due to fatigue, mood, or screen environment. If this doesn't match what you see day to day,
                  it may help to repeat the check when feeling rested.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Caregiver observations */}
        {(() => {
          const caregiverObs = currentAssessment?.clinical_snapshot?.caregiver_observations as CaregiverObservations | undefined;
          const suggestedMode = suggestInteractionMode(caregiverObs);
          
          if (!caregiverObs) return null;

          return (
            <div className="rounded-md bg-muted/40 p-3 space-y-2">
              <div className="font-medium text-sm">Caregiver observations (last check)</div>
              <ul className="space-y-1 text-xs">
                {caregiverObs.lookingAtScreen && (
                  <li>• Looking at the screen but not tapping</li>
                )}
                {caregiverObs.seemsConfused && (
                  <li>• Seemed confused about what to do</li>
                )}
                {caregiverObs.tooTired && (
                  <li>• Too tired / falling asleep</li>
                )}
                {caregiverObs.motorLimitation && (
                  <li>• Arm/hand couldn't reach or press</li>
                )}
                {caregiverObs.notes && (
                  <li className="mt-1 text-muted-foreground italic">
                    "{caregiverObs.notes}"
                  </li>
                )}
              </ul>

              {suggestedMode && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-xs font-medium">Suggested mode:</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    suggestedMode === 'assisted'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                      : suggestedMode === 'passive'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  }`}>
                    {suggestedMode === 'independent' && 'Independent'}
                    {suggestedMode === 'assisted' && 'Caregiver-assisted'}
                    {suggestedMode === 'passive' && 'Passive / very light'}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {currentAssessment.confidence_score && (
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Assessment confidence: {Math.round(currentAssessment.confidence_score * 100)}%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
