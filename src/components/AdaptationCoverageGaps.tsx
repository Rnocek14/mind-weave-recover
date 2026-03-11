/**
 * Adaptation Coverage Gaps
 * 
 * Auto-detects games with low telemetry, missing phonemes, fixed difficulty,
 * or no cue recommendations and surfaces actionable warnings.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { type AdaptationProofSummary, type GameAdaptationRow } from '@/hooks/useAdaptationProof';
import { cn } from '@/lib/utils';

interface CoverageGap {
  exerciseSlug: string;
  severity: 'warning' | 'critical';
  category: string;
  message: string;
}

function detectGaps(summary: AdaptationProofSummary): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  for (const row of summary.rows) {
    if (row.totalTrials < 3) continue; // skip games with too few trials

    // Low telemetry coverage
    if (row.telemetryCoverage < 0.5) {
      gaps.push({
        exerciseSlug: row.exerciseSlug,
        severity: 'critical',
        category: 'Telemetry',
        message: `Only ${Math.round(row.telemetryCoverage * 100)}% telemetry coverage (${row.trialsWithTelemetry}/${row.totalTrials} trials)`,
      });
    } else if (row.telemetryCoverage < 0.8) {
      gaps.push({
        exerciseSlug: row.exerciseSlug,
        severity: 'warning',
        category: 'Telemetry',
        message: `${Math.round(row.telemetryCoverage * 100)}% telemetry coverage — below 80% target`,
      });
    }

    // No phoneme targeting observed
    if (row.focusPhonemesUsed.length === 0 && row.trialsWithTelemetry >= 5) {
      gaps.push({
        exerciseSlug: row.exerciseSlug,
        severity: 'warning',
        category: 'Phonemes',
        message: 'No phoneme targeting observed across all trials',
      });
    }

    // Difficulty never changed
    const diffKeys = Object.keys(row.difficultyLevels);
    if (diffKeys.length <= 1 && row.trialsWithTelemetry >= 10) {
      const level = diffKeys[0] || '1';
      gaps.push({
        exerciseSlug: row.exerciseSlug,
        severity: 'warning',
        category: 'Difficulty',
        message: `Difficulty stuck at tier ${level} across ${row.trialsWithTelemetry} trials`,
      });
    }

    // No cue recommendations
    const cueKeys = Object.keys(row.cueTypesRecommended).filter(k => k !== 'none');
    if (cueKeys.length === 0 && row.trialsWithTelemetry >= 5) {
      gaps.push({
        exerciseSlug: row.exerciseSlug,
        severity: 'warning',
        category: 'Cues',
        message: 'No cue personalization recommendations produced',
      });
    }

    // Zero adaptation rate
    if (row.adaptationRate === 0 && row.trialsWithTelemetry >= 10) {
      gaps.push({
        exerciseSlug: row.exerciseSlug,
        severity: 'critical',
        category: 'Adaptation',
        message: `0% adaptation rate despite ${row.trialsWithTelemetry} telemetered trials`,
      });
    }
  }

  return gaps.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return a.exerciseSlug.localeCompare(b.exerciseSlug);
  });
}

function formatSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface AdaptationCoverageGapsProps {
  summary: AdaptationProofSummary;
}

export const AdaptationCoverageGaps = ({ summary }: AdaptationCoverageGapsProps) => {
  const gaps = detectGaps(summary);
  const criticalCount = gaps.filter(g => g.severity === 'critical').length;

  if (gaps.length === 0) {
    return (
      <Alert className="bg-primary/5 border-primary/20">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          All games are participating in the adaptation system with adequate telemetry coverage.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Coverage Gaps
          <Badge variant={criticalCount > 0 ? 'destructive' : 'secondary'} className="ml-1">
            {gaps.length} issue{gaps.length > 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {gaps.map((gap, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border text-sm',
              gap.severity === 'critical'
                ? 'bg-destructive/5 border-destructive/20'
                : 'bg-muted/30 border-border/50'
            )}
          >
            <AlertTriangle className={cn(
              'w-4 h-4 mt-0.5 flex-shrink-0',
              gap.severity === 'critical' ? 'text-destructive' : 'text-muted-foreground'
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium">{formatSlug(gap.exerciseSlug)}</span>
                <Badge variant="outline" className="text-[10px]">{gap.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{gap.message}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
