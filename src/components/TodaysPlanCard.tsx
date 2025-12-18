import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { 
  Calendar, 
  Clock, 
  Target, 
  Activity, 
  AlertCircle,
  Zap,
  Brain,
  Play,
  ChevronDown,
  Sparkles,
  BookOpen,
  RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";
import { useDailyLesson } from "@/hooks/useDailyLesson";
import { useStrugglingWords } from "@/hooks/useStrugglingWords";
import { useUiMode } from "@/hooks/useUiMode";
import { getConfidenceBadgeColor, getConfidenceDescription } from "@/lib/adaptiveDecisionEngine";
import { getAdaptiveSettings, setAdaptiveSettings, type AdaptiveEngineSettings } from "@/lib/adaptiveEngineConfig";
import { recomputeSpeechProfileNow } from "@/lib/recomputeSpeechProfile";
import { toast } from "sonner";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";

interface TodaysPlanCardProps {
  userId: string;
  clinicalProfile: ClinicalProfile | null;
  onStartAssessment?: () => void;
  onStartLesson?: () => void;
  doseCapReached?: boolean;
}

export const TodaysPlanCard: React.FC<TodaysPlanCardProps> = ({
  userId,
  clinicalProfile,
  onStartAssessment,
  onStartLesson,
  doseCapReached = false,
}) => {
  const [shadowPanelOpen, setShadowPanelOpen] = useState(false);
  const [adaptiveSettings, setLocalSettings] = useState<AdaptiveEngineSettings>(getAdaptiveSettings);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [lastRecomputeAt, setLastRecomputeAt] = useState<string | null>(null);
  const { isAtLeast } = useUiMode();
  
  // Listen for localStorage changes (e.g., from other tabs)
  useEffect(() => {
    const onStorage = () => setLocalSettings(getAdaptiveSettings());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  
  const { 
    lesson, 
    performanceSignals,
    todayFocus,
    loading, 
    error,
    needsReassessment,
    reassessmentReason 
  } = useDailyLesson(userId, undefined, clinicalProfile);
  
  // Struggling words tracker
  const { focusWords, loading: swLoading } = useStrugglingWords({ userId });

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Today's Plan
          </CardTitle>
          <CardDescription>Generating your personalized session...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Activity className="w-8 h-8 animate-pulse text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !lesson) {
    const friendlyMessage = error 
      ? 'We had trouble generating your plan. Please try again.'
      : 'We need a little more recent practice data to build your personalized plan. Try 1–2 exercises first.';
    
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Today's Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {friendlyMessage}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getEnergyColor = (energy: string) => {
    switch (energy) {
      case 'light': return 'text-blue-500';
      case 'moderate': return 'text-green-500';
      case 'challenging': return 'text-orange-500';
      default: return 'text-muted-foreground';
    }
  };

  const getEnergyLabel = (energy: string) => {
    switch (energy) {
      case 'light': return 'Light Session';
      case 'moderate': return 'Moderate Session';
      case 'challenging': return 'Full Session';
      default: return energy;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'warmup': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'primary': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'secondary': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'consolidation': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Today's Plan
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`${getEnergyColor(lesson.energyLevel)}`}
          >
            <Zap className="w-3 h-3 mr-1" />
            {getEnergyLabel(lesson.energyLevel)}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {lesson.totalDuration} minutes
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            {lesson.blocks.length} exercises
          </div>
        </div>

        {needsReassessment && reassessmentReason && (
          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-2">
              <span className="text-sm flex-1">{reassessmentReason}</span>
              {onStartAssessment && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onStartAssessment}
                >
                  Run Check
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Exercise blocks */}
        <div className="space-y-2">
          {lesson.blocks.map((block, idx) => (
            <div 
              key={idx}
              className="rounded-lg border bg-card/40 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getPriorityColor(block.priority)}`}
                  >
                    {getPriorityLabel(block.priority)}
                  </Badge>
                  <span className="font-medium text-sm capitalize">
                    {block.exerciseId.replace(/-/g, ' ')}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    {block.duration} min
                  </span>
                  {block.adaptations?.startDifficulty && (
                    <span className="text-[10px] text-muted-foreground">
                      Starts at Lv {block.adaptations.startDifficulty}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {block.reasoning}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Target domains */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Focus Areas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lesson.targetDomains.map((domain, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {domain.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>

        {/* Clinical reasoning */}
        {lesson.reasoning.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Why This Plan?
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                {lesson.reasoning.slice(0, 3).map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Performance context */}
        {performanceSignals && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">Recent Accuracy</div>
                <div className="font-medium">
                  {Math.round(performanceSignals.avgAccuracy * 100)}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Engagement</div>
                <div className="font-medium">
                  {performanceSignals.engagementScore}/10
                </div>
              </div>
            </div>
          </>
        )}

        {/* Adaptive Engine Shadow Panel (Clinician+ only) */}
        {isAtLeast('clinician') && todayFocus && (
          <>
            <Separator />
            <Collapsible open={shadowPanelOpen} onOpenChange={setShadowPanelOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="w-3 h-3" />
                  <span>Adaptive Engine (Shadow)</span>
                  <Badge 
                    variant="secondary" 
                    className={`text-[10px] ${getConfidenceBadgeColor(todayFocus.confidence)}`}
                  >
                    {todayFocus.confidence}
                  </Badge>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${shadowPanelOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <p className="text-[10px] text-muted-foreground">
                  {getConfidenceDescription(todayFocus.confidence)}
                </p>
                
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-medium">Data:</span> {todayFocus.inputSnapshot.trialCount} trials, {todayFocus.inputSnapshot.utteranceCount} utterances, assessment {todayFocus.inputSnapshot.assessmentAgeDays}d old
                </div>

                {todayFocus.rulesApplied.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-medium text-muted-foreground">Rules Fired:</div>
                    {todayFocus.rulesApplied.map((rule, idx) => (
                      <div key={idx} className="rounded border bg-muted/30 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium">{rule.ruleId}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{rule.condition}</p>
                        <p className="text-[10px] text-primary">→ {rule.adaptation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">No adaptive rules triggered</p>
                )}

                {Object.keys(todayFocus.adaptations).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">Proposed Adaptations:</div>
                    <div className="flex flex-wrap gap-1">
                      {todayFocus.adaptations.startDifficulty && (
                        <Badge variant="outline" className="text-[10px]">Start Lv {todayFocus.adaptations.startDifficulty}</Badge>
                      )}
                      {todayFocus.adaptations.timeoutMultiplier && (
                        <Badge variant="outline" className="text-[10px]">Timeout ×{todayFocus.adaptations.timeoutMultiplier}</Badge>
                      )}
                      {todayFocus.adaptations.sessionDurationCap && (
                        <Badge variant="outline" className="text-[10px]">Cap {todayFocus.adaptations.sessionDurationCap}m</Badge>
                      )}
                      {todayFocus.adaptations.preferredCueType && (
                        <Badge variant="outline" className="text-[10px]">Prefer {todayFocus.adaptations.preferredCueType} cues</Badge>
                      )}
                      {todayFocus.adaptations.slowerTTS && (
                        <Badge variant="outline" className="text-[10px]">Slower TTS</Badge>
                      )}
                      {todayFocus.adaptations.largeTargets && (
                        <Badge variant="outline" className="text-[10px]">Large Targets</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Phase A Toggle */}
                <Separator className="my-2" />
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-medium">Enable Adaptive Engine (Phase A)</div>
                    <div className="text-[9px] text-muted-foreground">
                      Safe adaptations: timeouts, session cap, large targets, start easier
                    </div>
                  </div>
                  <Switch
                    checked={adaptiveSettings.enabled}
                    onCheckedChange={(checked) => {
                      setAdaptiveSettings({ enabled: checked });
                      setLocalSettings(getAdaptiveSettings());
                    }}
                    className="scale-75"
                  />
                </div>

                {/* Recompute Speech Profile Button */}
                <Separator className="my-2" />
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-medium">Recompute Speech Profile</div>
                    <div className="text-[9px] text-muted-foreground">
                      Force update cue efficacy and error patterns
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastRecomputeAt && (
                      <Badge variant="secondary" className="text-[9px]">
                        {new Date(lastRecomputeAt).toLocaleTimeString()}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={recomputeLoading}
                      className="h-7 text-[10px]"
                      onClick={async () => {
                        setRecomputeLoading(true);
                        try {
                          const result = await recomputeSpeechProfileNow(userId, { force: true });
                          setLastRecomputeAt(new Date().toISOString());
                          if (result.skipped) {
                            toast.info(`Skipped: ${result.reason}`);
                          } else {
                            toast.success(`Speech profile recomputed (${result.analysesProcessed} utterances)`);
                          }
                        } catch (e: any) {
                          console.error('Recompute failed:', e);
                          toast.error(e?.message ?? 'Failed to recompute speech profile');
                        } finally {
                          setRecomputeLoading(false);
                        }
                      }}
                    >
                      {recomputeLoading ? (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          Recomputing…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Recompute
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                  {adaptiveSettings.enabled 
                    ? "Phase A enabled: Safe adaptations will be applied to exercises."
                    : "Shadow mode: These adaptations are computed but not yet applied."}
                </p>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* Focus Words Section (if available) */}
        {!swLoading && focusWords.length > 0 && (
          <>
            <Separator />
            <div className="pt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Today's Focus Words</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {focusWords.slice(0, 5).map((word) => (
                  <Badge key={word} variant="secondary" className="text-xs capitalize">
                    {word}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Words that need extra practice based on your recent performance
              </p>
            </div>
          </>
        )}

        {/* Start Lesson Button */}
        <div className="pt-4">
          <Button 
            size="lg" 
            className="w-full"
            onClick={onStartLesson}
            disabled={doseCapReached || needsReassessment}
          >
            <Play className="w-5 h-5 mr-2" />
            Start Today's Lesson ({lesson.totalDuration} min)
          </Button>
          {doseCapReached && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Daily practice cap reached
            </p>
          )}
          {needsReassessment && !doseCapReached && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Run capability check first
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
