import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { usePronunciationScoreAnalytics } from '@/hooks/usePronunciationScoreAnalytics';
import { TrendingUp, TrendingDown, Minus, Volume2, Target, Zap, Music, ChevronDown, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { AudioPlayback } from './AudioPlayback';
import { format } from 'date-fns';

interface PronunciationScoreCardProps {
  userId?: string;
  daysBack?: number;
}

export function PronunciationScoreCard({ userId, daysBack = 7 }: PronunciationScoreCardProps) {
  const { analytics, loading, error } = usePronunciationScoreAnalytics(userId, daysBack);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Pronunciation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.sampleCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Pronunciation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No pronunciation data yet. Complete speech exercises to see detailed analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Insufficient data check: need at least 5 samples for reliable analysis
  if (analytics.sampleCount < 5) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Pronunciation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4">
          <p className="text-sm font-medium text-muted-foreground">Not enough data yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Need at least 5 pronunciation samples for reliable analysis ({analytics.sampleCount} so far)
          </p>
        </CardContent>
      </Card>
    );
  }

  const { 
    overallScore, accuracyScore, fluencyScore, completenessScore, prosodyScore,
    sampleCount, hardestPhonemes, strongestPhonemes, needsPracticeWords, bestWords,
    weeklyTrend, weekOverWeekChange 
  } = analytics;

  const TrendIcon = weekOverWeekChange === null ? Minus : 
    weekOverWeekChange > 0 ? TrendingUp : 
    weekOverWeekChange < 0 ? TrendingDown : Minus;

  const trendColor = weekOverWeekChange === null ? 'text-muted-foreground' :
    weekOverWeekChange > 0 ? 'text-green-600' :
    weekOverWeekChange < 0 ? 'text-red-500' : 'text-muted-foreground';

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Pronunciation Analysis
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Last {daysBack} days • N={sampleCount}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Overall Score with Trend */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}%
              </span>
              <span className="text-sm text-muted-foreground">overall</span>
              {weekOverWeekChange !== null && (
                <span className={`flex items-center gap-1 text-sm ${trendColor}`}>
                  <TrendIcon className="h-3 w-3" />
                  {weekOverWeekChange > 0 ? '+' : ''}{weekOverWeekChange}%
                </span>
              )}
            </div>
            <Progress value={overallScore} className="h-2 mt-2" />
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreItem icon={Target} label="Accuracy" score={accuracyScore} />
          <ScoreItem icon={Zap} label="Fluency" score={fluencyScore} />
          <ScoreItem icon={Volume2} label="Completeness" score={completenessScore} />
          <ScoreItem icon={Music} label="Prosody" score={prosodyScore} />
        </div>

        {/* Trend Chart */}
        {weeklyTrend.length >= 2 && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Pronunciation trend</p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrend}>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded px-2 py-1 text-xs shadow-md">
                            <div className="font-medium">{data.date}</div>
                            <div className="text-muted-foreground">{data.avgScore}% ({data.count} trials)</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgScore" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Phoneme Analysis */}
        {hardestPhonemes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sounds to practice</p>
            <div className="flex flex-wrap gap-2">
              {hardestPhonemes.map(p => (
                <Badge 
                  key={p.phoneme} 
                  variant="outline"
                  className={`${p.avgAccuracy < 60 ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}
                  title={`Based on ${p.sampleCount} samples`}
                >
                  /{p.phoneme}/ {p.avgAccuracy}% <span className="text-[10px] opacity-70">n={p.sampleCount}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {strongestPhonemes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Your strongest sounds</p>
            <div className="flex flex-wrap gap-2">
              {strongestPhonemes.filter(p => p.avgAccuracy >= 80).slice(0, 4).map(p => (
                <Badge 
                  key={p.phoneme} 
                  variant="outline"
                  className="border-green-300 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  title={`Based on ${p.sampleCount} samples`}
                >
                  /{p.phoneme}/ {p.avgAccuracy}% <span className="text-[10px] opacity-70">n={p.sampleCount}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Word Performance */}
        {needsPracticeWords.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Words to practice</p>
            <div className="space-y-1">
              {needsPracticeWords.filter(w => w.avgScore < 75).slice(0, 3).map(w => (
                <ExpandableWordRow 
                  key={w.word} 
                  word={w} 
                  scoreColorFn={getScoreColor}
                  variant="practice"
                />
              ))}
            </div>
          </div>
        )}

        {bestWords.length > 0 && bestWords[0].avgScore >= 80 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Best words</p>
            <div className="space-y-1">
              {bestWords.filter(w => w.avgScore >= 80).slice(0, 3).map(w => (
                <ExpandableWordRow 
                  key={w.word} 
                  word={w} 
                  scoreColorFn={() => 'text-green-600'}
                  variant="best"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreItem({ icon: Icon, label, score }: { icon: React.ElementType; label: string; score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-amber-600';
    if (s > 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold ${getScoreColor(score)}`}>
          {score > 0 ? `${score}%` : '—'}
        </p>
      </div>
    </div>
  );
}

interface WordExample {
  score: number;
  audioPath: string;
  timestamp: string;
}

interface WordStats {
  word: string;
  avgScore: number;
  sampleCount: number;
  exampleAudioPath?: string;
  examples: WordExample[];
}

function ExpandableWordRow({ 
  word, 
  scoreColorFn, 
  variant 
}: { 
  word: WordStats; 
  scoreColorFn: (score: number) => string;
  variant: 'practice' | 'best';
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMultipleExamples = word.examples.length > 1;

  const getExampleScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <div 
        className={`flex items-center justify-between text-sm p-2 ${hasMultipleExamples ? 'cursor-pointer hover:bg-muted/50' : ''}`}
        onClick={() => hasMultipleExamples && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {hasMultipleExamples && (
            expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="font-medium capitalize">{word.word}</span>
          {word.exampleAudioPath && !hasMultipleExamples && (
            <AudioPlayback storagePath={word.exampleAudioPath} className="h-6 w-6" />
          )}
          {hasMultipleExamples && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {word.examples.length} clips
            </Badge>
          )}
        </div>
        <span className={scoreColorFn(word.avgScore)}>{word.avgScore}%</span>
      </div>
      
      {expanded && hasMultipleExamples && (
        <div className="border-t border-border/50 bg-muted/30 px-2 py-1.5 space-y-1">
          {word.examples.map((example, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AudioPlayback storagePath={example.audioPath} className="h-5 w-5" />
                <span className="text-muted-foreground">
                  {format(new Date(example.timestamp), 'MMM d, h:mm a')}
                </span>
              </div>
              <span className={getExampleScoreColor(example.score)}>{example.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
