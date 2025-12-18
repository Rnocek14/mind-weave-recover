/**
 * Phoneme Practice Card
 * 
 * Shows top 3 struggling phonemes with accuracy + sample count
 * Each has a "Start 10-trial set" button that launches targeted practice
 */

import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Play, Volume2, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStrugglingPhonemes, formatPhonemeDisplay, getPhonemeAccuracyLabel, formatTimeAgo } from '@/hooks/useStrugglingPhonemes';
import { InsightEvidenceBadge, calculateConfidence } from '@/components/InsightEvidenceBadge';
import { getWordsByPhonemeOverlap } from '@/lib/phonemeWordMap';
import { usePhonemeHistory } from '@/hooks/usePhonemeHistory';
import { PhonemeSparkline } from '@/components/PhonemeSparkline';

interface PhonemePracticeCardProps {
  userId: string;
  className?: string;
}

export const PhonemePracticeCard = memo(({ userId, className }: PhonemePracticeCardProps) => {
  const navigate = useNavigate();
  const { 
    strugglingPhonemes, 
    strongPhonemes,
    loading, 
    hasEnoughData,
    lastComputedAt,
    totalTrials: profileTotalTrials,
  } = useStrugglingPhonemes(userId, {
    accuracyThreshold: 70,
    minTrials: 3,
    maxPhonemes: 3,
  });

  // Fetch phoneme history for sparklines
  const { getTrendsForPhonemes, loading: historyLoading } = usePhonemeHistory(userId);
  const phonemeTrends = strugglingPhonemes.length > 0 
    ? getTrendsForPhonemes(strugglingPhonemes.map(p => p.phoneme))
    : {};

  const handlePracticePhoneme = (phoneme: string) => {
    // Get words containing this phoneme for targeted practice
    const wordMatches = getWordsByPhonemeOverlap([phoneme], 10);
    const targetWords = wordMatches.map(m => m.word);
    
    // Navigate to photo naming with focus phonemes
    navigate('/exercise/photo-naming', {
      state: {
        focusPhonemes: [phoneme],
        focusWords: targetWords,
        practice_source: 'phoneme_practice_card',
        is_targeted_practice: true,
      }
    });
  };

  const handlePracticeAll = () => {
    const phonemeList = strugglingPhonemes.map(p => p.phoneme);
    const wordMatches = getWordsByPhonemeOverlap(phonemeList, 10);
    const targetWords = wordMatches.map(m => m.word);
    
    navigate('/exercise/photo-naming', {
      state: {
        focusPhonemes: phonemeList,
        focusWords: targetWords,
        practice_source: 'phoneme_practice_card',
        is_targeted_practice: true,
      }
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasEnoughData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Sound Practice
          </CardTitle>
          <CardDescription>
            Practice specific sounds you're working on
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Complete more practice sessions to unlock personalized sound recommendations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (strugglingPhonemes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-success" />
            Sound Practice
          </CardTitle>
          <CardDescription>
            All sounds looking good!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-success" />
            <p className="text-sm text-muted-foreground">
              Your pronunciation is strong across all tracked sounds
            </p>
            {strongPhonemes.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center mt-3">
                {strongPhonemes.slice(0, 5).map(p => (
                  <Badge key={p.phoneme} variant="secondary" className="text-success">
                    {formatPhonemeDisplay(p.phoneme)} {Math.round(p.accuracy)}%
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalTrials = strugglingPhonemes.reduce((sum, p) => sum + p.trials, 0);
  const confidence = calculateConfidence(totalTrials);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-primary" />
              Today's Sound Focus
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Sounds that need more practice
              {lastComputedAt && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Updated {formatTimeAgo(lastComputedAt)}
                </span>
              )}
            </CardDescription>
          </div>
          <InsightEvidenceBadge
            windowLabel="Last 7 days"
            n={totalTrials}
            confidence={confidence}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phoneme list with progress bars */}
        <div className="space-y-3">
          {strugglingPhonemes.map((phoneme) => {
            const { label: accuracyLabel, color: accuracyColor } = getPhonemeAccuracyLabel(phoneme.accuracy);
            const trend = phonemeTrends[phoneme.phoneme];
            return (
              <div 
                key={phoneme.phoneme} 
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Phoneme display */}
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-mono text-lg font-bold text-primary">
                  {formatPhonemeDisplay(phoneme.phoneme)}
                </div>
                
                {/* Progress info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${accuracyColor}`}>{accuracyLabel}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(phoneme.accuracy)}% • n={phoneme.trials}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={phoneme.accuracy} 
                      className="h-2 flex-1"
                    />
                    {/* Sparkline trend */}
                    {trend && (
                      <PhonemeSparkline
                        points={trend.points}
                        delta={trend.delta}
                        width={64}
                        height={20}
                      />
                    )}
                  </div>
                </div>
                
                {/* Practice button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={() => handlePracticePhoneme(phoneme.phoneme)}
                >
                  <Play className="h-3 w-3" />
                  Practice
                </Button>
              </div>
            );
          })}
        </div>

        {/* Practice all button */}
        {strugglingPhonemes.length > 1 && (
          <Button 
            className="w-full gap-2" 
            onClick={handlePracticeAll}
          >
            <Play className="h-4 w-4" />
            Practice all focus sounds (5 min)
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

PhonemePracticeCard.displayName = 'PhonemePracticeCard';
