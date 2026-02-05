/**
 * Insights Section: "What's Hard For Me?"
 * 
 * Shows error clusters, problem phonemes/words, difficulty plateaus
 * Includes "building" state for phonemes approaching visibility threshold
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Target, Volume2, AlertCircle, Play, RefreshCw, 
  ChevronDown, ChevronUp, Info, Loader2 
} from 'lucide-react';
import { useStrugglingWords } from '@/hooks/useStrugglingWords';
import { 
  useStrugglingPhonemes, 
  formatPhonemeDisplay, 
  getPhonemeAccuracyLabel,
  formatTimeAgo 
} from '@/hooks/useStrugglingPhonemes';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { getErrorLabel } from '@/lib/insightLanguageMap';
import { useNavigate, useLocation } from 'react-router-dom';
import { currentRoute, withReturnTo } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useUiMode } from '@/hooks/useUiMode';
import { recomputeSpeechProfileNow } from '@/lib/recomputeSpeechProfile';
import { useToast } from '@/hooks/use-toast';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ChallengesSectionProps {
  userId: string;
  profileId?: string;
}

export function ChallengesSection({ userId, profileId }: ChallengesSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const { isAtLeast } = useUiMode();
  const returnPath = currentRoute(location);
  
  const [showDebug, setShowDebug] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [lastRecomputeTime, setLastRecomputeTime] = useState<number>(0);
  const [cooldownTick, setCooldownTick] = useState(0);
  
  // Dev warning for missing profileId
  if (import.meta.env.DEV && !profileId) {
    console.warn('[ChallengesSection] profileId missing, using most recent profile');
  }
  
  const { 
    strugglingWords, 
    focusWords, 
    loading: wordsLoading,
    refresh: refreshWords 
  } = useStrugglingWords({ userId });
  const { 
    strugglingPhonemes, 
    strongPhonemes,
    buildingPhonemes,
    targetWords, 
    loading: phonemesLoading,
    lastComputedAt,
    totalTrials,
    trialsWithGopData,
    trialsWithPhonemes,
    trialCountAtComputation,
    hasReadyPhonemes,
    readyCount,
    refresh: refreshPhonemeData,
  } = useStrugglingPhonemes(userId, { profileId });
  const { 
    analytics: errorAnalytics, 
    isLoading: errorLoading,
    refetch: refreshErrorAnalytics 
  } = useErrorPatternAnalytics(userId, { weeksBack: 4 });

  const isLoading = wordsLoading || phonemesLoading || errorLoading;
  const showClinicianDebug = isAtLeast('clinician');
  
  // Calculate trials since last recompute
  const trialsSinceRecompute = totalTrials - trialCountAtComputation;
  
  // Cooldown for recompute button (60 seconds)
  const RECOMPUTE_COOLDOWN_MS = 60_000;
  
  // Derive cooldown remaining using memo to properly re-render on tick
  const cooldownRemaining = useMemo(
    () => Math.max(0, RECOMPUTE_COOLDOWN_MS - (Date.now() - lastRecomputeTime)),
    [lastRecomputeTime, cooldownTick]
  );
  const isOnCooldown = cooldownRemaining > 0;
  
  // Timer to update cooldown display - no cooldownTick in deps to avoid re-creating interval
  useEffect(() => {
    if (!isOnCooldown) return;
    const interval = setInterval(() => setCooldownTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isOnCooldown]);

  // Handle manual recompute with explicit refresh of all displayed data
  const handleRecompute = async () => {
    if (isOnCooldown) {
      toast({
        title: "Please wait",
        description: `Recompute available in ${Math.ceil(cooldownRemaining / 1000)}s`,
      });
      return;
    }
    
    setIsRecomputing(true);
    try {
      const result = await recomputeSpeechProfileNow(userId, { force: true, profileId });
      
      // Explicitly refresh ALL data sources shown on this screen
      // Don't rely on "auto-refresh" - be explicit about what needs updating
      await Promise.all([
        refreshPhonemeData(),
        refreshWords(),
        refreshErrorAnalytics?.(),
      ]);
      
      // Reset cooldown state
      setCooldownTick(0);
      setLastRecomputeTime(Date.now());
      
      toast({
        title: "Profile Updated",
        description: result.skipped 
          ? `Skipped: ${result.reason}` 
          : `Processed ${result.analysesProcessed ?? 0} analyses.`,
      });
    } catch (error) {
      toast({
        title: "Recompute Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRecomputing(false);
    }
  };

  // Get top error patterns - properly type the breakdown
  const errorBreakdown = (errorAnalytics?.errorBreakdown ?? {}) as Record<string, number>;
  const topErrors = Object.entries(errorBreakdown)
    .filter(([type, count]) => type !== 'correct' && (count as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3) as [string, number][];

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Include strongPhonemes so "What's Hard" still has content even if user is doing well
  const hasReadyData = strugglingWords.length > 0 || strugglingPhonemes.length > 0 || strongPhonemes.length > 0 || topErrors.length > 0;
  const hasBuildingData = buildingPhonemes.length > 0;

  return (
    <Card id="challenges">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Target className="w-5 h-5" />
          What's Hard For Me?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* No data at all */}
        {!hasReadyData && !hasBuildingData && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Complete more sessions to identify challenge areas</p>
          </div>
        )}

        {/* Building Phonemes - always show if there are any, adjust title based on state */}
        {hasBuildingData && (
          <div className="p-4 rounded-lg border border-dashed bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-sm text-muted-foreground">
                {hasReadyPhonemes ? "More sounds building up…" : "Building Sound Data…"}
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {buildingPhonemes.map(p => {
                const label = getPhonemeAccuracyLabel(p.accuracy);
                return (
                  <div 
                    key={p.phoneme} 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm"
                  >
                    <span className="font-mono">/{formatPhonemeDisplay(p.phoneme)}/</span>
                    <span className={cn("font-medium", label.color)}>{Math.round(p.accuracy)}%</span>
                    <span className="text-muted-foreground text-xs">
                      · early signal · {p.neededTrials} more trial{p.neededTrials !== 1 ? 's' : ''} needed
                    </span>
                  </div>
                );
              })}
            </div>
            {!hasReadyPhonemes && (
              <p className="text-xs text-muted-foreground mt-3">
                Sound insights appear after 3+ trials per sound.
              </p>
            )}
          </div>
        )}

        {/* Ready Data Sections */}
        {hasReadyData && (
          <>
            {/* Struggling Words */}
            {strugglingWords.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    Words Needing Practice
                  </h4>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-1"
                    onClick={() => {
                      const targets = focusWords.map(w => encodeURIComponent(w)).join(',');
                      navigate(withReturnTo(`/exercise/photo-naming?targets=${targets}`, returnPath));
                    }}
                  >
                    <Play className="w-3 h-3" />
                    Practice Now
                  </Button>
                </div>
                <div className="space-y-2">
                  {strugglingWords.slice(0, 5).map(word => (
                    <div key={word.word} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div>
                        <span className="font-medium">{word.word}</span>
                        <div className="text-xs text-muted-foreground">
                          {getErrorLabel(word.primaryErrorType)} • {word.attempts} attempts
                        </div>
                      </div>
                      <Badge variant={word.errorRate > 0.6 ? 'destructive' : 'secondary'}>
                        {Math.round(word.errorRate * 100)}% errors
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Struggling Phonemes */}
            {strugglingPhonemes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-warning" />
                    Sounds to Focus On
                  </h4>
                  {targetWords.length > 0 && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={() => {
                        const targets = targetWords.slice(0, 5).map(w => encodeURIComponent(w)).join(',');
                        navigate(withReturnTo(`/exercise/photo-naming?targets=${targets}`, returnPath));
                      }}
                    >
                      <Play className="w-3 h-3" />
                      Practice These Sounds
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {strugglingPhonemes.map(p => {
                    const label = getPhonemeAccuracyLabel(p.accuracy);
                    return (
                      <div 
                        key={p.phoneme} 
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card"
                      >
                        <span className="font-mono text-lg">/{formatPhonemeDisplay(p.phoneme)}/</span>
                        <div className="text-right">
                          <div className={cn('text-sm font-medium', label.color)}>
                            {Math.round(p.accuracy)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.trials} trials
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error Pattern Distribution */}
            {topErrors.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Common Error Patterns</h4>
                <div className="space-y-2">
                  {topErrors.map(([type, count]) => {
                    const total = Object.values(errorBreakdown).reduce((a, b) => (a as number) + (b as number), 0) as number;
                    const percentage = total > 0 ? ((count as number) / total) * 100 : 0;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{getErrorLabel(type)}</span>
                            <span className="text-muted-foreground">{count as number} ({Math.round(percentage)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-warning rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Clinician Debug Panel */}
        {showClinicianDebug && (
          <Collapsible open={showDebug} onOpenChange={setShowDebug}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Speech Profile Debug
                </span>
                {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs space-y-2 font-mono">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Last computed:</span>
                    <span className="ml-2">{formatTimeAgo(lastComputedAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total trials:</span>
                    <span className="ml-2">{totalTrials}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trials at computation:</span>
                    <span className="ml-2">{trialCountAtComputation}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trials since recompute:</span>
                    <span className={cn("ml-2", trialsSinceRecompute >= 10 && "text-warning")}>
                      {trialsSinceRecompute}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">With GOP data:</span>
                    <span className="ml-2">{trialsWithGopData}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">With phonemes:</span>
                    <span className="ml-2">{trialsWithPhonemes}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phonemes ready:</span>
                    <span className="ml-2">{readyCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phonemes building:</span>
                    <span className="ml-2">{buildingPhonemes.length}</span>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-border space-y-2">
                  {/* Data freshness line */}
                  <div className="text-xs text-muted-foreground text-center">
                    Last computed: {formatTimeAgo(lastComputedAt)} · Trials since: {trialsSinceRecompute}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleRecompute}
                    disabled={isRecomputing || isOnCooldown}
                  >
                    {isRecomputing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Recomputing...
                      </>
                    ) : isOnCooldown ? (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Wait {Math.ceil(cooldownRemaining / 1000)}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Recompute Profile Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
