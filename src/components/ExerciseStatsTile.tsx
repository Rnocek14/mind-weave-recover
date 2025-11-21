import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TrendingUp, Clock, Target, AlertCircle } from 'lucide-react';
import { useExerciseStats } from '@/hooks/useExerciseStats';

interface ExerciseStatsTileProps {
  userId: string | undefined;
  exerciseSlug: string;
  exerciseTitle: string;
}

export const ExerciseStatsTile = memo(({
  userId,
  exerciseSlug,
  exerciseTitle,
}: ExerciseStatsTileProps) => {
  const { stats, loading, error } = useExerciseStats(userId, exerciseSlug);

  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-3/4 mb-4" />
        <div className="space-y-3" role="status" aria-live="polite">
          <span className="sr-only">Loading exercise statistics...</span>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-destructive">
        <h3 className="font-semibold text-destructive mb-2">Error Loading Stats</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    );
  }

  const hasData = stats && stats.trialCount > 0;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" aria-hidden="true" />
        <h3 className="font-semibold">{exerciseTitle} - Last 7 Days</h3>
      </div>

      {!hasData ? (
        <EmptyState
          icon={AlertCircle}
          description="Complete sessions to track progress here. Start from the Overview tab."
          variant="info"
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Accuracy */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target className="w-4 h-4 text-success" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-success" aria-label={`${Math.round((stats.avgAccuracy || 0) * 100)} percent accuracy`}>
              {Math.round((stats.avgAccuracy || 0) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
          </div>

          {/* Median RT */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-primary" aria-label={`${stats.medianRt ? `${(stats.medianRt / 1000).toFixed(1)} seconds` : 'no data'} median time`}>
              {stats.medianRt ? `${(stats.medianRt / 1000).toFixed(1)}s` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Median Time</div>
          </div>

          {/* Trial Count */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-accent" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-accent" aria-label={`${stats.trialCount} trials completed`}>
              {stats.trialCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Trials</div>
          </div>
        </div>
      )}
    </Card>
  );
});

ExerciseStatsTile.displayName = 'ExerciseStatsTile';
