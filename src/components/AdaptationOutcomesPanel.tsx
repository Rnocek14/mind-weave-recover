/**
 * Adaptation Outcomes Panel
 * 
 * Shows adapted vs non-adapted accuracy comparisons
 * to prove adaptation is improving performance.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Minus, BarChart3, Info } from 'lucide-react';
import { useAdaptationOutcomes, type OutcomeComparison } from '@/hooks/useAdaptationOutcomes';
import { cn } from '@/lib/utils';

interface AdaptationOutcomesPanelProps {
  userId: string;
  daysBack?: number;
}

export const AdaptationOutcomesPanel = ({ userId, daysBack = 14 }: AdaptationOutcomesPanelProps) => {
  const { outcomes, isLoading } = useAdaptationOutcomes(userId, daysBack);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!outcomes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Adaptation Outcomes
          </CardTitle>
          <CardDescription>No trial data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Play some exercises to see outcome comparisons here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Lift Card */}
      <Card className={cn(
        'border-2',
        outcomes.overallLift > 0 ? 'border-primary/30' : 'border-border'
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Overall Adaptation Lift</p>
              <p className={cn(
                'text-3xl font-bold mt-1',
                outcomes.overallLift > 0 ? 'text-primary' : 
                outcomes.overallLift < 0 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {outcomes.overallLift > 0 ? '+' : ''}{outcomes.overallLift.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Adapted: {Math.round(outcomes.adaptedAccuracy * 100)}% ({outcomes.adaptedTrials} trials)
                {' · '}
                Non-adapted: {Math.round(outcomes.nonAdaptedAccuracy * 100)}% ({outcomes.nonAdaptedTrials} trials)
              </p>
            </div>
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center',
              outcomes.overallLift > 0 ? 'bg-primary/10' : 'bg-muted'
            )}>
              {outcomes.overallLift > 0 ? (
                <TrendingUp className="w-7 h-7 text-primary" />
              ) : outcomes.overallLift < 0 ? (
                <TrendingDown className="w-7 h-7 text-destructive" />
              ) : (
                <Minus className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!outcomes.hasEnoughData && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Limited data: need ≥10 adapted and ≥10 non-adapted trials for reliable comparisons. Results are preliminary.
          </AlertDescription>
        </Alert>
      )}

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {outcomes.comparisons.map(comp => (
          <ComparisonCard key={comp.label} comparison={comp} />
        ))}
      </div>
    </div>
  );
};

const ComparisonCard = ({ comparison }: { comparison: OutcomeComparison }) => {
  const { groupA, groupB, lift, significant } = comparison;
  const positive = lift > 0;
  const hasData = groupA.trials > 0 && groupB.trials > 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">{comparison.label}</p>
        {!significant && hasData && (
          <Badge variant="outline" className="text-[10px]">Low n</Badge>
        )}
      </div>

      {!hasData ? (
        <p className="text-xs text-muted-foreground">No data for this comparison</p>
      ) : (
        <>
          <div className="space-y-2">
            <AccuracyBar
              label={groupA.name}
              accuracy={groupA.accuracy}
              trials={groupA.trials}
              highlight={positive}
            />
            <AccuracyBar
              label={groupB.name}
              accuracy={groupB.accuracy}
              trials={groupB.trials}
              highlight={!positive}
            />
          </div>

          <div className="mt-3 pt-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Lift</span>
            <span className={cn(
              'text-sm font-bold',
              positive ? 'text-primary' : lift < 0 ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {lift > 0 ? '+' : ''}{lift.toFixed(1)}pp
            </span>
          </div>
        </>
      )}
    </Card>
  );
};

const AccuracyBar = ({
  label,
  accuracy,
  trials,
  highlight,
}: {
  label: string;
  accuracy: number;
  trials: number;
  highlight: boolean;
}) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', highlight ? 'text-foreground' : 'text-muted-foreground')}>
        {Math.round(accuracy * 100)}% <span className="text-muted-foreground font-normal">(n={trials})</span>
      </span>
    </div>
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          highlight ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
        style={{ width: `${Math.round(accuracy * 100)}%` }}
      />
    </div>
  </div>
);
