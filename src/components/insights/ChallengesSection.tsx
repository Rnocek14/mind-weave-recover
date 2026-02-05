/**
 * Insights Section: "What's Hard For Me?"
 * 
 * Shows error clusters, problem phonemes/words, difficulty plateaus
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Volume2, AlertCircle, Play } from 'lucide-react';
import { useStrugglingWords } from '@/hooks/useStrugglingWords';
import { useStrugglingPhonemes, formatPhonemeDisplay, getPhonemeAccuracyLabel } from '@/hooks/useStrugglingPhonemes';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { getErrorLabel } from '@/lib/insightLanguageMap';
import { useNavigate, useLocation } from 'react-router-dom';
import { currentRoute, withReturnTo } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface ChallengesSectionProps {
  userId: string;
}

export function ChallengesSection({ userId }: ChallengesSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = currentRoute(location);
  const { strugglingWords, focusWords, loading: wordsLoading } = useStrugglingWords({ userId });
  const { strugglingPhonemes, targetWords, loading: phonemesLoading } = useStrugglingPhonemes(userId);
  const { analytics: errorAnalytics, isLoading: errorLoading } = useErrorPatternAnalytics(userId, { weeksBack: 4 });

  const isLoading = wordsLoading || phonemesLoading || errorLoading;

  // Get top error patterns - properly type the breakdown
  const errorBreakdown = (errorAnalytics?.errorBreakdown || {}) as Record<string, number>;
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

  const hasData = strugglingWords.length > 0 || strugglingPhonemes.length > 0 || topErrors.length > 0;

  return (
    <Card id="challenges">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Target className="w-5 h-5" />
          What's Hard For Me?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasData ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Complete more sessions to identify challenge areas</p>
          </div>
        ) : (
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
                    onClick={() => navigate(withReturnTo(`/exercise/photo-naming?targets=${focusWords.join(',')}`, returnPath))}
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
                      onClick={() => navigate(withReturnTo(`/exercise/photo-naming?targets=${targetWords.slice(0, 5).join(',')}`, returnPath))}
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
      </CardContent>
    </Card>
  );
}
