/**
 * Compact Sound Trends insight for RecoverySnapshot
 * Shows top 3 struggling phonemes with sparklines and deltas
 * Only renders when sufficient history exists
 */

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PhonemeSparkline } from '@/components/PhonemeSparkline';
import { usePhonemeHistory, type PhonemeTrend } from '@/hooks/usePhonemeHistory';
import { useStrugglingPhonemes, formatPhonemeDisplay } from '@/hooks/useStrugglingPhonemes';

interface SoundTrendsInsightProps {
  userId: string;
  className?: string;
}

const TrendRow = memo(({ trend, accuracy, trials }: { trend: PhonemeTrend; accuracy: number; trials: number }) => {
  const { delta, points, hasEnoughData } = trend;
  
  // Determine trend direction and color
  const getTrendIndicator = () => {
    if (delta === null) return { icon: Minus, color: 'text-muted-foreground', label: '—' };
    if (delta > 0) return { icon: TrendingUp, color: 'text-green-500', label: `+${delta}%` };
    if (delta < 0) return { icon: TrendingDown, color: 'text-red-500', label: `${delta}%` };
    return { icon: Minus, color: 'text-muted-foreground', label: '0%' };
  };
  
  const { icon: TrendIcon, color, label } = getTrendIndicator();
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-medium w-8">
          {formatPhonemeDisplay(trend.phoneme)}
        </span>
        <span className="text-xs text-muted-foreground">
          {accuracy}% <span className="opacity-70">n={trials} • {points.length} updates</span>
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        {hasEnoughData ? (
          <PhonemeSparkline 
            points={points} 
            width={48} 
            height={20} 
            showDelta={false}
          />
        ) : (
          <span className="text-xs text-muted-foreground italic">building...</span>
        )}
        
        <div className={`flex items-center gap-1 min-w-[48px] justify-end ${color}`}>
          <TrendIcon className="h-3 w-3" />
          <span className="text-xs font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
});

TrendRow.displayName = 'TrendRow';

export const SoundTrendsInsight = memo(({ userId, className }: SoundTrendsInsightProps) => {
  const { strugglingPhonemes, loading: phonemesLoading } = useStrugglingPhonemes(userId);
  const { loading: historyLoading, getTrendsForPhonemes } = usePhonemeHistory(userId);
  
  const isLoading = phonemesLoading || historyLoading;
  
  // Get top 3 struggling phonemes
  const topPhonemes = useMemo(() => strugglingPhonemes.slice(0, 3), [strugglingPhonemes]);
  
  // Memoize phoneme keys for stable reference
  const phonemeKeys = useMemo(() => topPhonemes.map(p => p.phoneme), [topPhonemes]);
  
  // Get trends for these phonemes (memoized)
  const trends = useMemo(
    () => (phonemeKeys.length > 0 ? getTrendsForPhonemes(phonemeKeys) : {}),
    [getTrendsForPhonemes, phonemeKeys]
  );
  
  // Don't render if no struggling phonemes
  if (!isLoading && topPhonemes.length === 0) {
    return null;
  }
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Sound Trends
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Recent changes in accuracy by sound
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between py-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div>
            {topPhonemes.map(({ phoneme, accuracy, trials }) => {
              const trend = trends[phoneme];
              if (!trend) return null;
              
              return (
                <TrendRow 
                  key={phoneme} 
                  trend={trend} 
                  accuracy={accuracy}
                  trials={trials}
                />
              );
            })}
            
            {topPhonemes.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/30">
                {!Object.values(trends).some(t => t.hasEnoughData) ? (
                  <p className="text-xs text-muted-foreground italic">
                    Trends will appear after a few more sessions
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Phoneme data from {topPhonemes.reduce((sum, p) => sum + p.trials, 0)} trials
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

SoundTrendsInsight.displayName = 'SoundTrendsInsight';
