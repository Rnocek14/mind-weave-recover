/**
 * Adaptive Loop Debug Panel
 * 
 * Shows clinicians/developers the current state of the adaptive loop:
 * - Speech profile freshness
 * - Last utterance timestamp
 * - Active adaptation traits
 * - Whether today's lesson used fresh profile data
 * 
 * Only visible in development or for admin users.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { evaluateProfileFreshness, type ProfileFreshnessResult } from '@/lib/profileFreshness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Activity, Brain, Clock, ChevronDown, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdaptiveLoopDebugPanelProps {
  userId: string;
  profileId?: string;
  className?: string;
}

interface DebugState {
  loading: boolean;
  profileFreshness: ProfileFreshnessResult | null;
  lastUtteranceAt: string | null;
  lastProfileComputeAt: string | null;
  trialCountAtComputation: number | null;
  currentTrialCount: number | null;
  activeTraits: {
    focusPhonemes: string[];
    recommendedCueType: string | null;
    errorDistribution: Record<string, number> | null;
    challengingCategories: string[] | null;
  };
}

export function AdaptiveLoopDebugPanel({ userId, profileId, className }: AdaptiveLoopDebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [debug, setDebug] = useState<DebugState>({
    loading: true,
    profileFreshness: null,
    lastUtteranceAt: null,
    lastProfileComputeAt: null,
    trialCountAtComputation: null,
    currentTrialCount: null,
    activeTraits: {
      focusPhonemes: [],
      recommendedCueType: null,
      errorDistribution: null,
      challengingCategories: null,
    },
  });

  useEffect(() => {
    if (!userId) return;

    const fetchDebugState = async () => {
      // Parallel fetches
      const [profileResult, utteranceResult, trialCountResult] = await Promise.all([
        supabase
          .from('user_speech_profiles')
          .select('last_computed_at, trial_count_at_computation, phoneme_difficulty_map, cue_efficacy_by_type, error_type_distribution, most_challenging_categories')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('utterance_analyses')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('exercise_events')
          .select('id', { count: 'exact', head: true })
          .in('session_id', 
            // Get session IDs for this user
            supabase.from('sessions').select('id').eq('user_id', userId).then(r => 
              (r.data || []).map(s => s.id)
            ) as any
          ),
      ]);

      const profile = profileResult.data;
      const freshness = evaluateProfileFreshness(profile?.last_computed_at);

      // Extract focus phonemes from phoneme difficulty map
      const phonemeMap = profile?.phoneme_difficulty_map as Record<string, { accuracy: number; trials: number }> | null;
      const focusPhonemes = phonemeMap
        ? Object.entries(phonemeMap)
            .filter(([_, v]) => v.accuracy < 0.7 && v.trials >= 3)
            .sort((a, b) => a[1].accuracy - b[1].accuracy)
            .slice(0, 5)
            .map(([phoneme]) => phoneme)
        : [];

      // Determine recommended cue type
      const cueEfficacy = profile?.cue_efficacy_by_type as Record<string, { successRate: number; total: number }> | null;
      let recommendedCueType: string | null = null;
      if (cueEfficacy) {
        const entries = Object.entries(cueEfficacy).filter(([_, v]) => v.total >= 3);
        if (entries.length > 0) {
          recommendedCueType = entries.sort((a, b) => b[1].successRate - a[1].successRate)[0][0];
        }
      }

      setDebug({
        loading: false,
        profileFreshness: freshness,
        lastUtteranceAt: utteranceResult.data?.created_at || null,
        lastProfileComputeAt: profile?.last_computed_at || null,
        trialCountAtComputation: profile?.trial_count_at_computation || null,
        currentTrialCount: trialCountResult.count || null,
        activeTraits: {
          focusPhonemes,
          recommendedCueType,
          errorDistribution: profile?.error_type_distribution as Record<string, number> | null,
          challengingCategories: profile?.most_challenging_categories as string[] | null,
        },
      });
    };

    fetchDebugState();
  }, [userId]);

  const freshnessIcon = {
    fresh: <CheckCircle className="w-3.5 h-3.5 text-primary" />,
    aging: <Clock className="w-3.5 h-3.5 text-accent-foreground" />,
    stale: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
    missing: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
  };

  const freshnessColor = {
    fresh: 'bg-primary/10 text-primary border-primary/20',
    aging: 'bg-accent text-accent-foreground border-accent',
    stale: 'bg-destructive/10 text-destructive border-destructive/20',
    missing: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  if (debug.loading) return null;

  const freshness = debug.profileFreshness;
  const newTrialsSinceCompute = (debug.currentTrialCount && debug.trialCountAtComputation)
    ? Math.max(0, debug.currentTrialCount - debug.trialCountAtComputation)
    : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn('border-dashed border-muted-foreground/30', className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Adaptive Loop
                </CardTitle>
                {freshness && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', freshnessColor[freshness.status])}>
                    {freshnessIcon[freshness.status]}
                    <span className="ml-1">{freshness.status}</span>
                  </Badge>
                )}
              </div>
              <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-3 pb-3 pt-0 space-y-3">
            {/* Freshness Status */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" /> Profile Freshness
              </h4>
              {freshness?.warning && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                  {freshness.warning}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Last compute:</span>
                  <span className="ml-1 font-mono">
                    {debug.lastProfileComputeAt
                      ? `${freshness?.hoursSinceCompute}h ago`
                      : 'never'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last utterance:</span>
                  <span className="ml-1 font-mono">
                    {debug.lastUtteranceAt
                      ? `${Math.round((Date.now() - new Date(debug.lastUtteranceAt).getTime()) / (1000 * 60 * 60))}h ago`
                      : 'none'}
                  </span>
                </div>
                {newTrialsSinceCompute !== null && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">New trials since compute:</span>
                    <span className={cn('ml-1 font-mono', newTrialsSinceCompute > 20 && 'text-destructive font-semibold')}>
                      {newTrialsSinceCompute}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Active Adaptation Traits */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Brain className="w-3 h-3" /> Active Traits
              </h4>
              
              {/* Focus Phonemes */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] text-muted-foreground">Focus phonemes:</span>
                {debug.activeTraits.focusPhonemes.length > 0 ? (
                  debug.activeTraits.focusPhonemes.map(p => (
                    <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">/{p}/</Badge>
                  ))
                ) : (
                  <span className="text-[11px] text-muted-foreground italic">none identified</span>
                )}
              </div>

              {/* Recommended Cue */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Best cue type:</span>
                {debug.activeTraits.recommendedCueType ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {debug.activeTraits.recommendedCueType}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground italic">insufficient data</span>
                )}
              </div>

              {/* Challenging Categories */}
              {debug.activeTraits.challengingCategories && debug.activeTraits.challengingCategories.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">Challenging:</span>
                  {debug.activeTraits.challengingCategories.slice(0, 3).map(c => (
                    <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">{c}</Badge>
                  ))}
                </div>
              )}

              {/* Error Distribution */}
              {debug.activeTraits.errorDistribution && Object.keys(debug.activeTraits.errorDistribution).length > 0 && (
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Error distribution:</span>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(debug.activeTraits.errorDistribution)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 4)
                      .map(([type, rate]) => (
                        <span key={type} className="text-[10px] font-mono text-muted-foreground">
                          {type}: {Math.round((rate as number) * 100)}%
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info footer */}
            <div className="flex items-start gap-1 pt-1 border-t border-border/50">
              <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Profile auto-refreshes after each session. Traits above drive daily lesson content, difficulty, and cue selection.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
