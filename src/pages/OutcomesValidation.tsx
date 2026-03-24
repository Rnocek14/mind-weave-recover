/**
 * Outcomes Validation Panel — Admin-only internal tool
 * 
 * Runs all 4 outcome hooks on the current user and displays:
 * - Current values + trend badges
 * - Raw supporting data tables
 * - Confidence tiers
 * 
 * Purpose: Validate that metrics look clinically believable before building the Recovery Progress page.
 */

import { useAuth } from '@/hooks/useAuth';
import { useWordMastery } from '@/hooks/useWordMastery';
import { useCueIndependence } from '@/hooks/useCueIndependence';
import { useErrorQualityScore } from '@/hooks/useErrorQualityScore';
import { useSessionEndurance } from '@/hooks/useSessionEndurance';
import { useLearningRate } from '@/hooks/useLearningRate';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { useState } from 'react';

function TrendBadge({ trend }: { trend: string }) {
  const config: Record<string, { icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    improving: { icon: <TrendingUp className="h-3 w-3" />, variant: 'default', label: 'Improving' },
    stable: { icon: <Minus className="h-3 w-3" />, variant: 'secondary', label: 'Stable' },
    declining: { icon: <TrendingDown className="h-3 w-3" />, variant: 'destructive', label: 'Declining' },
    insufficient: { icon: <HelpCircle className="h-3 w-3" />, variant: 'outline', label: 'Insufficient Data' },
  };
  const c = config[trend] || config.insufficient;
  return (
    <Badge variant={c.variant} className="gap-1">
      {c.icon} {c.label}
    </Badge>
  );
}

function ConfidenceBadge({ trials }: { trials: number }) {
  if (trials >= 30) return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> High ({trials} trials)</Badge>;
  if (trials >= 10) return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Moderate ({trials} trials)</Badge>;
  return <Badge variant="outline" className="gap-1"><HelpCircle className="h-3 w-3" /> Low ({trials} trials)</Badge>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number | null)[][] }) {
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {headers.map(h => <th key={h} className="text-left p-1 font-medium text-muted-foreground">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/50">
              {row.map((cell, j) => <td key={j} className="p-1 font-mono">{cell ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs mt-1">{description}</CardDescription>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function OutcomesValidation() {
  const { user } = useAuth();
  const userId = user?.id;

  const wordMastery = useWordMastery(userId, { lookbackDays: 90 });
  const cueIndependence = useCueIndependence(userId, { lookbackDays: 90 });
  const errorQuality = useErrorQualityScore(userId, { lookbackDays: 90 });
  const endurance = useSessionEndurance(userId, { lookbackDays: 90 });
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId, { enabled: !!userId });

  const anyLoading = wordMastery.loading || cueIndependence.loading || errorQuality.loading || endurance.loading || lrLoading;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Outcomes Validation Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admin-only. Validates recovery metrics on your data before building the Recovery Progress page.
        </p>
        {anyLoading && <p className="text-xs text-muted-foreground mt-2 animate-pulse">Loading metrics...</p>}
      </div>

      {/* 1. Naming Accuracy Trajectory (from learning_rates) */}
      <MetricSection
        title="1. Naming Accuracy Trajectory"
        description="Core word retrieval trend from learning_rates table. Clinically meaningful: ≥5% sustained over 14+ days."
      >
        <div className="grid grid-cols-3 gap-4">
          {learningRates.map((lr, i) => (
            <div key={i} className="bg-muted/50 rounded p-3">
              <div className="text-xs text-muted-foreground">{lr.domain} ({lr.window}d)</div>
              <div className="text-lg font-bold font-mono">
                {lr.accuracySlope > 0 ? '+' : ''}{(lr.accuracySlope * 100).toFixed(2)}%/day
              </div>
              <div className="flex gap-2 mt-1">
                <TrendBadge trend={lr.trend} />
                <ConfidenceBadge trials={lr.trialCount} />
              </div>
            </div>
          ))}
          {learningRates.length === 0 && !lrLoading && (
            <p className="text-sm text-muted-foreground col-span-3">No learning rate data available.</p>
          )}
        </div>
      </MetricSection>

      {/* 2. Cue Independence */}
      <MetricSection
        title="2. Cue Independence Index"
        description="1 - (weighted_avg_cue / max_cue). Correct trials weighted 2×. Meaningful: ≥0.5 cue level reduction over 14+ days."
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-muted/50 rounded p-3">
            <div className="text-xs text-muted-foreground">Current Score</div>
            <div className="text-2xl font-bold font-mono">
              {cueIndependence.currentScore !== null ? (cueIndependence.currentScore * 100).toFixed(1) + '%' : '—'}
            </div>
          </div>
          <TrendBadge trend={cueIndependence.trend} />
          <ConfidenceBadge trials={cueIndependence.dataPoints.reduce((s, d) => s + d.trialCount, 0)} />
        </div>
        <DataTable
          headers={['Date', 'Independence', 'Avg Cue', 'Trials', 'Correct w/o Cue', 'Total Correct']}
          rows={cueIndependence.dataPoints.slice(-20).map(d => [
            d.date,
            (d.independenceScore * 100).toFixed(1) + '%',
            d.avgCueLevel.toFixed(2),
            d.trialCount,
            d.correctWithNoCue,
            d.totalCorrect,
          ])}
        />
      </MetricSection>

      {/* 3. Word Mastery */}
      <MetricSection
        title="3. Word Mastery Count"
        description="Mastered: ≥80% acc + recent correct + cue≤1. Emerging: 40-79%. Struggling: <40%. Min 3 attempts."
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-muted/50 rounded p-3 text-center">
            <div className="text-xs text-muted-foreground">Mastered</div>
            <div className="text-2xl font-bold text-primary font-mono">{wordMastery.mastered}</div>
          </div>
          <div className="bg-muted/50 rounded p-3 text-center">
            <div className="text-xs text-muted-foreground">Emerging</div>
            <div className="text-2xl font-bold text-accent-foreground font-mono">{wordMastery.emerging}</div>
          </div>
          <div className="bg-muted/50 rounded p-3 text-center">
            <div className="text-xs text-muted-foreground">Struggling</div>
            <div className="text-2xl font-bold text-destructive font-mono">{wordMastery.struggling}</div>
          </div>
          <ConfidenceBadge trials={wordMastery.words.reduce((s, w) => s + w.attempts, 0)} />
        </div>
        <DataTable
          headers={['Word', 'Level', 'Accuracy', 'Attempts', 'Best Cue', 'Recent ✓', 'Last Seen']}
          rows={wordMastery.words.slice(0, 30).map(w => [
            w.word,
            w.level,
            (w.accuracy * 100).toFixed(0) + '%',
            w.attempts,
            w.bestCueLevel,
            w.recentCorrect ? '✓' : '✗',
            w.lastAttempted.slice(0, 10),
          ])}
        />
      </MetricSection>

      {/* 4. Error Quality Score */}
      <MetricSection
        title="4. Error Pattern Evolution"
        description="Severity-weighted quality score (0→1). no_response=0, neologism=1, semantic=3, phonemic=4, correct=6. Meaningful: ≥0.15 over 30d."
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-muted/50 rounded p-3">
            <div className="text-xs text-muted-foreground">Current Quality</div>
            <div className="text-2xl font-bold font-mono">
              {errorQuality.currentScore !== null ? (errorQuality.currentScore * 100).toFixed(1) + '%' : '—'}
            </div>
          </div>
          <TrendBadge trend={errorQuality.trend} />
          <ConfidenceBadge trials={errorQuality.dataPoints.reduce((s, d) => s + d.trialCount, 0)} />
        </div>
        <DataTable
          headers={['Date', 'Quality', 'Trials', 'Correct', 'Semantic', 'Phonemic', 'No Response', 'Other']}
          rows={errorQuality.dataPoints.slice(-20).map(d => [
            d.date,
            (d.qualityScore * 100).toFixed(1) + '%',
            d.trialCount,
            d.errorCounts['correct'] || 0,
            (d.errorCounts['semantic_paraphasia'] || 0) + (d.errorCounts['semantic_related'] || 0),
            (d.errorCounts['phonemic_paraphasia'] || 0) + (d.errorCounts['phonemic'] || 0),
            d.errorCounts['no_response'] || 0,
            d.trialCount - (d.errorCounts['correct'] || 0) -
              ((d.errorCounts['semantic_paraphasia'] || 0) + (d.errorCounts['semantic_related'] || 0)) -
              ((d.errorCounts['phonemic_paraphasia'] || 0) + (d.errorCounts['phonemic'] || 0)) -
              (d.errorCounts['no_response'] || 0),
          ])}
        />
      </MetricSection>

      {/* 5. Session Endurance */}
      <MetricSection
        title="5. Session Tolerance (Endurance)"
        description="2nd-half accuracy / 1st-half accuracy. 1.0 = no decay. Meaningful: rising from <0.7 to >0.9."
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-muted/50 rounded p-3">
            <div className="text-xs text-muted-foreground">Current Ratio</div>
            <div className="text-2xl font-bold font-mono">
              {endurance.currentRatio !== null ? endurance.currentRatio.toFixed(2) : '—'}
            </div>
          </div>
          <TrendBadge trend={endurance.trend} />
          <ConfidenceBadge trials={endurance.dataPoints.reduce((s, d) => s + d.totalTrials, 0)} />
        </div>
        <DataTable
          headers={['Date', 'Endurance', '1st Half Acc', '2nd Half Acc', 'Trials']}
          rows={endurance.dataPoints.slice(-20).map(d => [
            d.date,
            d.enduranceRatio.toFixed(2),
            (d.firstHalfAccuracy * 100).toFixed(0) + '%',
            (d.secondHalfAccuracy * 100).toFixed(0) + '%',
            d.totalTrials,
          ])}
        />
      </MetricSection>
    </div>
  );
}
