/**
 * Insights Section: "Am I Improving?"
 * 
 * Shows clinically meaningful progress analysis:
 * - Overall recovery trajectory with confidence
 * - Domain-level progress (aggregated, not raw rows)
 * - Week-over-week comparison with context
 * - Clear interpretation for therapists and caregivers
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, Minus, Activity, 
  CheckCircle2, AlertCircle, Info 
} from 'lucide-react';
import { useLearningRate } from '@/hooks/useLearningRate';
import { useWeeklyTrends } from '@/hooks/useWeeklyTrends';
import { narrateRecoveryTrend, getVerdictColor, getVerdictEmoji } from '@/lib/insightNarrator';
import { cn } from '@/lib/utils';
import { HelpLabel } from '@/components/HelpTooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProgressSectionProps {
  userId: string;
  profileId?: string;
}

interface AggregatedDomain {
  domain: string;
  displayName: string;
  currentAccuracy: number;
  startAccuracy: number;
  slopePerWeek: number; // % change per week
  trend: 'improving' | 'plateau' | 'declining';
  trialCount: number;
  windowDays: number;
  interpretation: string;
  isSignificant: boolean;
}

export function ProgressSection({ userId, profileId }: ProgressSectionProps) {
  // Note: profileId will be used when useLearningRate supports it
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId);
  const { trends: weeklyTrends, loading: trendsLoading } = useWeeklyTrends();

  const isLoading = lrLoading || trendsLoading;
  const recovery = narrateRecoveryTrend(learningRates, weeklyTrends);

  // Aggregate learning rates: pick the best (most recent + most trials) per domain
  // Prefer 14-day window as most clinically relevant
  const aggregatedDomains = useMemo<AggregatedDomain[]>(() => {
    if (!learningRates.length) return [];

    // Group by domain
    const byDomain = new Map<string, typeof learningRates>();
    for (const lr of learningRates) {
      const existing = byDomain.get(lr.domain) || [];
      existing.push(lr);
      byDomain.set(lr.domain, existing);
    }

    // For each domain, pick the best representative entry
    const result: AggregatedDomain[] = [];
    
    byDomain.forEach((rates, domain) => {
      // Prefer 14-day window, then 7-day, then 30-day
      // Also prefer higher trial counts for confidence
      const sorted = [...rates].sort((a, b) => {
        // Priority: 14-day > 7-day > 30-day
        const windowPriority = (w: number) => w === 14 ? 0 : w === 7 ? 1 : 2;
        const wPrioDiff = windowPriority(a.window) - windowPriority(b.window);
        if (wPrioDiff !== 0) return wPrioDiff;
        
        // Then by trial count (more is better)
        return b.trialCount - a.trialCount;
      });

      const best = sorted[0];
      if (!best || best.trialCount < 5) return; // Skip if insufficient data

      // Calculate weekly slope from daily slope
      const slopePerWeek = best.accuracySlope * 7 * 100; // Convert to % per week

      // Determine significance (>2% per week is clinically meaningful)
      const isSignificant = Math.abs(slopePerWeek) > 2;

      // Generate interpretation
      // Convert 0-1 fractions to 0-100 percentages
      const endAccPct = Math.round(best.endAccuracy * 100);
      const startAccPct = Math.round(best.startAccuracy * 100);

      let interpretation: string;
      if (best.trend === 'improving') {
        if (isSignificant) {
          interpretation = `Strong progress: ${endAccPct}% accuracy, up from ${startAccPct}%`;
        } else {
          interpretation = `Gradual improvement in ${domain}`;
        }
      } else if (best.trend === 'declining') {
        if (isSignificant) {
          interpretation = `Accuracy dropped from ${startAccPct}% to ${endAccPct}% - may need attention`;
        } else {
          interpretation = `Slight dip - normal variation`;
        }
      } else {
        interpretation = `Holding steady at ${endAccPct}% accuracy`;
      }

      // Display name mapping
      const displayNames: Record<string, string> = {
        speech: 'Word Retrieval',
        naming: 'Naming',
        grammar: 'Sentence Building',
        language: 'Language Processing',
        motor: 'Motor Skills',
        phonological: 'Sound Patterns',
        semantic: 'Word Meaning'
      };

      result.push({
        domain,
        displayName: displayNames[domain] || domain.charAt(0).toUpperCase() + domain.slice(1),
        currentAccuracy: endAccPct,
        startAccuracy: startAccPct,
        slopePerWeek,
        trend: best.trend,
        trialCount: best.trialCount,
        windowDays: best.window,
        interpretation,
        isSignificant
      });
    });

    // Sort by significance and trial count
    return result.sort((a, b) => {
      // Show significant changes first
      if (a.isSignificant !== b.isSignificant) return a.isSignificant ? -1 : 1;
      // Then by trial count
      return b.trialCount - a.trialCount;
    });
  }, [learningRates]);

  // Calculate week-over-week accuracy delta
  const weekOverWeek = useMemo(() => {
    if (weeklyTrends.length < 4) return null;
    
    const recentDays = weeklyTrends.slice(-3);
    const earlierDays = weeklyTrends.slice(0, 4);
    
    const recentAccuracy = recentDays.reduce((sum, d) => sum + d.accuracy, 0) / recentDays.length;
    const earlierAccuracy = earlierDays.reduce((sum, d) => sum + d.accuracy, 0) / earlierDays.length;
    const recentTrials = recentDays.reduce((sum, d) => sum + d.totalTrials, 0);
    const earlierTrials = earlierDays.reduce((sum, d) => sum + d.totalTrials, 0);
    
    return {
      delta: recentAccuracy - earlierAccuracy,
      recentAccuracy,
      earlierAccuracy,
      recentTrials,
      earlierTrials
    };
  }, [weeklyTrends]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="progress">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span>{getVerdictEmoji(recovery.verdict)}</span>
          Am I Improving?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main verdict - the narrative summary */}
        <div className={cn('p-4 rounded-lg bg-muted/50 border-l-4', 
          recovery.verdict === 'improving' ? 'border-l-success' :
          recovery.verdict === 'declining' ? 'border-l-warning' :
          'border-l-primary'
        )}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold mb-1">{recovery.headline}</h3>
              <p className="text-sm text-muted-foreground">{recovery.detail}</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="shrink-0">
                    {recovery.confidence} confidence
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Confidence based on: {
                      recovery.confidence === 'high' ? '50+ trials, consistent patterns' :
                      recovery.confidence === 'medium' ? '20-50 trials' :
                      'Limited data (keep practicing!)'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Week-over-week comparison */}
        {weekOverWeek && (
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2.5 rounded-full shrink-0',
                weekOverWeek.delta > 3 ? 'bg-success/10 text-success' : 
                weekOverWeek.delta < -3 ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
              )}>
                {weekOverWeek.delta > 0 ? <TrendingUp className="w-5 h-5" /> : 
                 weekOverWeek.delta < 0 ? <TrendingDown className="w-5 h-5" /> : 
                 <Minus className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {weekOverWeek.delta > 0 ? '+' : ''}{Math.round(weekOverWeek.delta)}%
                  </span>
                  <span className="text-muted-foreground">vs last week</span>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {Math.round(weekOverWeek.recentAccuracy)}% accuracy this week 
                  ({weekOverWeek.recentTrials} trials) → 
                  {Math.round(weekOverWeek.earlierAccuracy)}% last week 
                  ({weekOverWeek.earlierTrials} trials)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Domain progress - aggregated and meaningful */}
        {aggregatedDomains.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                <HelpLabel term="Learning Rate">Progress by Skill Area</HelpLabel>
              </h4>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Based on the last 2 weeks of practice. Changes over ±2%/week are 
                      clinically meaningful.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="space-y-3">
              {aggregatedDomains.map(domain => (
                <DomainProgressCard key={domain.domain} domain={domain} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {aggregatedDomains.length === 0 && !weekOverWeek && (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Complete more practice sessions to see your progress trends.</p>
            <p className="text-sm mt-1">At least 5 trials per skill area needed.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DomainProgressCard({ domain }: { domain: AggregatedDomain }) {
  const TrendIcon = domain.trend === 'improving' ? TrendingUp : 
                   domain.trend === 'declining' ? TrendingDown : Minus;
  
  const trendColor = domain.trend === 'improving' ? 'text-success' : 
                    domain.trend === 'declining' ? 'text-warning' : 'text-muted-foreground';
  
  const accuracyDelta = domain.currentAccuracy - domain.startAccuracy;

  return (
    <div className="p-3 rounded-lg border bg-card/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendIcon className={cn('w-4 h-4', trendColor)} />
          <span className="font-medium">{domain.displayName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('font-semibold', trendColor)}>
            {domain.currentAccuracy >= 0 ? `${Math.round(domain.currentAccuracy)}%` : '—'}
          </span>
          {accuracyDelta !== 0 && domain.currentAccuracy >= 0 && (
            <span className={cn(
              'text-xs',
              accuracyDelta > 0 ? 'text-success' : 'text-warning'
            )}>
              ({accuracyDelta > 0 ? '+' : ''}{Math.round(accuracyDelta)}%)
            </span>
          )}
        </div>
      </div>
      
      {/* Progress bar showing current accuracy */}
      <Progress 
        value={Math.max(0, Math.min(100, domain.currentAccuracy))} 
        className="h-2"
      />
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{domain.interpretation}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                {domain.trialCount} trials
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Based on {domain.windowDays}-day window</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
