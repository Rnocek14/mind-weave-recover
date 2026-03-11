/**
 * Sentence Layer Metrics
 * 
 * Evidence panel component showing:
 * 1. Sentence trial source breakdown (graded vs standard)
 * 2. Fix Sentence phoneme-match rate
 * 
 * Reads from exercise_events.task_parameters for sentence-level exercises.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Layers, Target, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SentenceTrialEvent {
  exercise_slug: string;
  task_parameters: Record<string, any> | null;
  score: number | null;
}

interface SentenceLayerMetricsProps {
  /** Raw exercise events — pass from parent hook to avoid duplicate queries */
  events: SentenceTrialEvent[];
}

interface SourceBreakdown {
  graded: number;
  standard: number;
  gradedAccuracy: number;
  standardAccuracy: number;
}

interface PhonemeMatchBreakdown {
  matched: number;
  unmatched: number;
  matchedAccuracy: number;
  unmatchedAccuracy: number;
}

export function SentenceLayerMetrics({ events }: SentenceLayerMetricsProps) {
  const { sourceBreakdown, phonemeMatch } = useMemo(() => {
    // Sentence Construction: trial_source breakdown
    const scEvents = events.filter(e => 
      e.exercise_slug === 'sentence-construction' && 
      e.task_parameters?.trial_source
    );

    let gradedCorrect = 0, gradedTotal = 0;
    let standardCorrect = 0, standardTotal = 0;

    for (const e of scEvents) {
      const params = e.task_parameters!;
      const correct = (e.score ?? 0) > 0;
      if (params.trial_source === 'graded_sentence_bank') {
        gradedTotal++;
        if (correct) gradedCorrect++;
      } else {
        standardTotal++;
        if (correct) standardCorrect++;
      }
    }

    const sourceBreakdown: SourceBreakdown = {
      graded: gradedTotal,
      standard: standardTotal,
      gradedAccuracy: gradedTotal > 0 ? gradedCorrect / gradedTotal : 0,
      standardAccuracy: standardTotal > 0 ? standardCorrect / standardTotal : 0,
    };

    // Fix Sentence: phoneme_matched breakdown
    const fsEvents = events.filter(e =>
      e.exercise_slug === 'fix-sentence' && 
      e.task_parameters?.trial_source === 'fix_sentence_bank'
    );

    let matchedCorrect = 0, matchedTotal = 0;
    let unmatchedCorrect = 0, unmatchedTotal = 0;

    for (const e of fsEvents) {
      const params = e.task_parameters!;
      const correct = (e.score ?? 0) > 0;
      if (params.phoneme_matched) {
        matchedTotal++;
        if (correct) matchedCorrect++;
      } else {
        unmatchedTotal++;
        if (correct) unmatchedCorrect++;
      }
    }

    const phonemeMatch: PhonemeMatchBreakdown = {
      matched: matchedTotal,
      unmatched: unmatchedTotal,
      matchedAccuracy: matchedTotal > 0 ? matchedCorrect / matchedTotal : 0,
      unmatchedAccuracy: unmatchedTotal > 0 ? unmatchedCorrect / unmatchedTotal : 0,
    };

    return { sourceBreakdown, phonemeMatch };
  }, [events]);

  const totalSC = sourceBreakdown.graded + sourceBreakdown.standard;
  const totalFS = phonemeMatch.matched + phonemeMatch.unmatched;

  if (totalSC === 0 && totalFS === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Sentence Layer Evidence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sentence Construction: Trial Source Breakdown */}
        {totalSC > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Sentence Construction — Trial Source
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <SourceCard
                label="Graded Sentences"
                count={sourceBreakdown.graded}
                total={totalSC}
                accuracy={sourceBreakdown.gradedAccuracy}
                variant="primary"
              />
              <SourceCard
                label="Standard Bank"
                count={sourceBreakdown.standard}
                total={totalSC}
                accuracy={sourceBreakdown.standardAccuracy}
                variant="secondary"
              />
            </div>
            {sourceBreakdown.graded > 0 && sourceBreakdown.standard > 0 && (
              <LiftIndicator
                label="Graded vs Standard"
                a={sourceBreakdown.gradedAccuracy}
                b={sourceBreakdown.standardAccuracy}
              />
            )}
          </div>
        )}

        {/* Fix Sentence: Phoneme Match Rate */}
        {totalFS > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              Fix Sentence — Phoneme Match Rate
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <SourceCard
                label="Phoneme Matched"
                count={phonemeMatch.matched}
                total={totalFS}
                accuracy={phonemeMatch.matchedAccuracy}
                variant="primary"
              />
              <SourceCard
                label="Unmatched"
                count={phonemeMatch.unmatched}
                total={totalFS}
                accuracy={phonemeMatch.unmatchedAccuracy}
                variant="secondary"
              />
            </div>
            {phonemeMatch.matched > 0 && phonemeMatch.unmatched > 0 && (
              <LiftIndicator
                label="Matched vs Unmatched"
                a={phonemeMatch.matchedAccuracy}
                b={phonemeMatch.unmatchedAccuracy}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceCard({ label, count, total, accuracy, variant }: {
  label: string;
  count: number;
  total: number;
  accuracy: number;
  variant: 'primary' | 'secondary';
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="p-3 rounded-lg border bg-card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <Badge variant={variant === 'primary' ? 'default' : 'secondary'} className="text-xs">
          {pct}%
        </Badge>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{count} trials</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {Math.round(accuracy * 100)}% acc
        </span>
      </div>
    </div>
  );
}

function LiftIndicator({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = a - b;
  const diffPct = Math.round(Math.abs(diff) * 100);
  const positive = diff > 0;
  
  if (diffPct === 0) return null;

  return (
    <div className={cn(
      'px-3 py-2 rounded-md text-xs flex items-center gap-2',
      positive ? 'bg-primary/5 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'
    )}>
      <span className="font-medium">
        {positive ? '↑' : '↓'} {diffPct}pp
      </span>
      <span>{label}</span>
    </div>
  );
}
