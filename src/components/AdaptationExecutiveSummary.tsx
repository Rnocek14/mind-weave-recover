/**
 * Adaptation Executive Summary
 * 
 * A screenshot-ready, condensed card that compresses the entire
 * adaptation validation stack into one legible artifact.
 * 
 * Designed for: investor updates, clinician demos, internal reviews,
 * progress screenshots, product decision meetings.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Radio,
  Layers,
  Crosshair,
  AlertTriangle,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAdaptationProof, type AdaptationProofSummary } from '@/hooks/useAdaptationProof';
import { useAdaptationOutcomes, type AdaptationOutcomesSummary } from '@/hooks/useAdaptationOutcomes';
import { cn } from '@/lib/utils';
import { HelpLabel } from '@/components/HelpTooltip';

interface AdaptationExecutiveSummaryProps {
  userId: string;
  daysBack?: number;
}

const MODE_LABELS: Record<string, string> = {
  phoneme_targeting: 'Phoneme Targeting',
  cue_personalization: 'Cue Personalization',
  difficulty_only: 'Difficulty Only',
  profile_aware: 'Profile Aware',
  none: 'None',
};

interface CoverageGapItem {
  exercise: string;
  message: string;
}

function getTopGaps(summary: AdaptationProofSummary, max = 3): CoverageGapItem[] {
  const gaps: CoverageGapItem[] = [];

  for (const row of summary.rows) {
    if (row.totalTrials < 3) continue;

    if (row.telemetryCoverage < 0.5) {
      gaps.push({
        exercise: formatSlug(row.exerciseSlug),
        message: `${Math.round(row.telemetryCoverage * 100)}% telemetry`,
      });
    } else if (row.adaptationRate === 0 && row.trialsWithTelemetry >= 10) {
      gaps.push({
        exercise: formatSlug(row.exerciseSlug),
        message: '0% adaptation rate',
      });
    } else if (row.telemetryCoverage < 0.8) {
      gaps.push({
        exercise: formatSlug(row.exerciseSlug),
        message: `${Math.round(row.telemetryCoverage * 100)}% telemetry`,
      });
    } else if (Object.keys(row.difficultyLevels).length <= 1 && row.trialsWithTelemetry >= 10) {
      gaps.push({
        exercise: formatSlug(row.exerciseSlug),
        message: 'Difficulty fixed',
      });
    }

    if (gaps.length >= max) break;
  }

  return gaps;
}

function formatSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export const AdaptationExecutiveSummary = ({ userId, daysBack = 14 }: AdaptationExecutiveSummaryProps) => {
  const { summary, isLoading: proofLoading } = useAdaptationProof(userId, daysBack);
  const { outcomes, isLoading: outcomesLoading } = useAdaptationOutcomes(userId, daysBack);

  const isLoading = proofLoading || outcomesLoading;

  if (isLoading) {
    return (
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-6 w-56" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.totalTrials === 0) {
    return null;
  }

  const topGaps = getTopGaps(summary);
  const hasLift = outcomes && outcomes.hasEnoughData;
  const liftValue = outcomes?.overallLift ?? 0;
  const liftPositive = liftValue > 0;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.03] overflow-hidden">
      <CardContent className="pt-6 pb-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Adaptation Executive Summary
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Last {daysBack} days · {summary.totalTrials.toLocaleString()} trials
              </p>
            </div>
          </div>
          {hasLift && (
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold',
              liftPositive
                ? 'bg-primary/10 text-primary'
                : liftValue < 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
            )}>
              {liftPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : liftValue < 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              {liftPositive ? '+' : ''}{liftValue.toFixed(1)}% lift
            </div>
          )}
        </div>

        {/* Primary KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryKPI
            icon={<Activity className="w-3.5 h-3.5" />}
            label="Adaptation Rate"
            helpTerm="Adaptation Rate"
            value={`${Math.round(summary.overallAdaptationRate * 100)}%`}
            subtext={`${summary.totalAdapted} adapted`}
            status={summary.overallAdaptationRate > 0.5 ? 'good' : summary.overallAdaptationRate > 0.2 ? 'neutral' : 'warn'}
          />
          <SummaryKPI
            icon={<Radio className="w-3.5 h-3.5" />}
            label="Telemetry Coverage"
            helpTerm="Telemetry Coverage"
            value={`${Math.round(summary.telemetryCoverage * 100)}%`}
            subtext={`${summary.trialsWithTelemetry} instrumented`}
            status={summary.telemetryCoverage >= 0.9 ? 'good' : summary.telemetryCoverage >= 0.7 ? 'neutral' : 'warn'}
          />
          <SummaryKPI
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Games Adapted"
            helpTerm="Games Adapted"
            value={`${summary.gamesWithAdaptation}/${summary.totalGames}`}
            subtext="with active adaptation"
            status={summary.gamesWithAdaptation === summary.totalGames ? 'good' : 'neutral'}
          />
          <SummaryKPI
            icon={<Crosshair className="w-3.5 h-3.5" />}
            label="Dominant Mode"
            helpTerm="Dominant Mode"
            value={MODE_LABELS[summary.dominantMode]?.split(' ')[0] || '—'}
            subtext={MODE_LABELS[summary.dominantMode] || summary.dominantMode}
            status="neutral"
          />
        </div>

        {/* Outcome Comparison Strip */}
        {hasLift && outcomes && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Outcome Comparison
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <OutcomeLine
                  label="Adapted accuracy"
                  value={`${Math.round(outcomes.adaptedAccuracy * 100)}%`}
                  trials={outcomes.adaptedTrials}
                  highlight
                />
                <OutcomeLine
                  label="Non-adapted accuracy"
                  value={`${Math.round(outcomes.nonAdaptedAccuracy * 100)}%`}
                  trials={outcomes.nonAdaptedTrials}
                />
                {outcomes.comparisons.slice(1).map(comp => (
                  comp.groupA.trials > 0 && comp.groupB.trials > 0 ? (
                    <OutcomeLine
                      key={comp.label}
                      label={comp.label.split(' vs ')[0]}
                      value={`${comp.lift > 0 ? '+' : ''}${comp.lift.toFixed(1)}pp`}
                      trials={comp.groupA.trials + comp.groupB.trials}
                      highlight={comp.lift > 0}
                      dim={!comp.significant}
                    />
                  ) : null
                ))}
              </div>
            </div>
          </>
        )}

        {/* Top Coverage Gaps */}
        {topGaps.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Top Coverage Gaps
              </p>
              <div className="flex flex-wrap gap-2">
                {topGaps.map((gap, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[11px] gap-1 bg-muted/30 text-muted-foreground"
                  >
                    {gap.exercise}: {gap.message}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Methodology Footer */}
        <div className="flex items-start gap-1.5 pt-1 text-[10px] text-muted-foreground/70">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Accuracy uses clinical progress semantics — partial success counts as progress (score {'>'} 0).
            Lift is descriptive, not causal. Minimum n≥10 per group for outcome reporting.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const SummaryKPI = ({
  icon,
  label,
  value,
  subtext,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  status: 'good' | 'neutral' | 'warn';
}) => (
  <div className={cn(
    'rounded-lg border p-3 space-y-1',
    status === 'good' && 'border-primary/20 bg-primary/[0.03]',
    status === 'warn' && 'border-destructive/20 bg-destructive/[0.03]',
    status === 'neutral' && 'border-border bg-card',
  )}>
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
    </div>
    <p className={cn(
      'text-xl font-bold',
      status === 'good' && 'text-primary',
      status === 'warn' && 'text-destructive',
      status === 'neutral' && 'text-foreground',
    )}>
      {value}
    </p>
    <p className="text-[11px] text-muted-foreground">{subtext}</p>
  </div>
);

const OutcomeLine = ({
  label,
  value,
  trials,
  highlight,
  dim,
}: {
  label: string;
  value: string;
  trials: number;
  highlight?: boolean;
  dim?: boolean;
}) => (
  <div className={cn('flex items-baseline justify-between text-xs', dim && 'opacity-60')}>
    <span className="text-muted-foreground">{label}</span>
    <span className="flex items-baseline gap-1.5">
      <span className={cn('font-semibold', highlight ? 'text-primary' : 'text-foreground')}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground/60">n={trials}</span>
    </span>
  </div>
);
