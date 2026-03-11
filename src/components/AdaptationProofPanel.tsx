/**
 * Adaptation Proof Panel
 * 
 * Cross-game evidence table showing how the unified adaptation layer
 * is actually performing across all speech exercises.
 * 
 * Includes: provenance banner, telemetry coverage, data quality checks,
 * and per-game drill-down.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  CheckCircle2, 
  Minus, 
  Fingerprint, 
  BarChart3,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  ShieldCheck,
  Clock,
  Download,
  Copy,
} from 'lucide-react';
import { useAdaptationProof, type GameAdaptationRow, type RecentAdaptedTrial } from '@/hooks/useAdaptationProof';
import { useAdaptationOutcomes } from '@/hooks/useAdaptationOutcomes';
import { AdaptationOutcomesPanel } from '@/components/AdaptationOutcomesPanel';
import { AdaptationCoverageGaps } from '@/components/AdaptationCoverageGaps';
import { AdaptationExecutiveSummary } from '@/components/AdaptationExecutiveSummary';
import { buildAdaptationCSV, buildTextSummary, downloadCSV } from '@/lib/exportAdaptationEvidence';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface AdaptationProofPanelProps {
  userId: string;
  daysBack?: number;
}

const MODE_LABELS: Record<string, string> = {
  phoneme_targeting: 'Phoneme',
  cue_personalization: 'Cue',
  difficulty_only: 'Difficulty',
  profile_aware: 'Profile',
  none: 'None',
};

const MODE_COLORS: Record<string, string> = {
  phoneme_targeting: 'bg-primary/10 text-primary border-primary/20',
  cue_personalization: 'bg-accent/10 text-accent-foreground border-accent/20',
  difficulty_only: 'bg-secondary/50 text-secondary-foreground border-secondary',
  profile_aware: 'bg-muted text-muted-foreground border-muted',
  none: 'bg-muted/30 text-muted-foreground border-muted/50',
};

function formatSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getDominantMode(modes: Record<string, number>): string {
  const entries = Object.entries(modes).filter(([k]) => k !== 'none');
  if (entries.length === 0) return 'none';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export const AdaptationProofPanel = ({ userId, daysBack = 14 }: AdaptationProofPanelProps) => {
  const { summary, isLoading } = useAdaptationProof(userId, daysBack);
  const { outcomes, isLoading: outcomesLoading } = useAdaptationOutcomes(userId, daysBack);

  const handleExportCSV = () => {
    if (!summary) return;
    const csv = buildAdaptationCSV(summary, outcomes);
    downloadCSV(csv, `adaptation-evidence-${daysBack}d.csv`);
    toast.success('CSV exported');
  };

  const handleCopySummary = () => {
    if (!summary) return;
    const text = buildTextSummary(summary, outcomes, daysBack);
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard');
  };

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

  if (!summary || summary.totalTrials === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="w-4 h-4" />
            Adaptation Evidence
          </CardTitle>
          <CardDescription>No trial data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Play some exercises to see cross-game adaptation data here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Provenance Banner + Export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground flex-1">
          <Database className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Evidence window: last <strong className="text-foreground">{daysBack} days</strong></span>
          <span className="text-border">|</span>
          <span>Source: <code className="px-1 py-0.5 rounded bg-muted">exercise_events.task_parameters</code></span>
          <span className="text-border">|</span>
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>User-scoped</span>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleCopySummary} className="gap-1.5 text-xs">
            <Copy className="w-3.5 h-3.5" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Executive Summary Card */}
      <AdaptationExecutiveSummary userId={userId} daysBack={daysBack} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniKPI
          label="Telemetry Coverage"
          value={`${Math.round(summary.telemetryCoverage * 100)}%`}
          detail={`${summary.trialsWithTelemetry} / ${summary.totalTrials} trials`}
          highlight={summary.telemetryCoverage < 0.8}
        />
        <MiniKPI
          label="Adaptation Rate"
          value={`${Math.round(summary.overallAdaptationRate * 100)}%`}
          detail={`${summary.totalAdapted} adapted trials`}
        />
        <MiniKPI
          label="Games Adapted"
          value={`${summary.gamesWithAdaptation} / ${summary.totalGames}`}
          detail="with active adaptation"
        />
        <MiniKPI
          label="Dominant Mode"
          value={MODE_LABELS[summary.dominantMode] || summary.dominantMode}
          detail="most common strategy"
        />
        <MiniKPI
          label="Window"
          value={`${daysBack}d`}
          detail={`${summary.totalTrials} total trials`}
        />
      </div>

      {/* Adaptation vs Outcomes */}
      <AdaptationOutcomesPanel userId={userId} daysBack={daysBack} />

      {/* Data Quality Warnings */}
      {summary.globalDataQuality.length > 0 && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong className="text-sm">Data quality issues detected:</strong>
            <ul className="mt-1 space-y-0.5 text-xs">
              {summary.globalDataQuality.map((issue, i) => (
                <li key={i}>• {issue.description} ({issue.count} occurrence{issue.count > 1 ? 's' : ''})</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Cross-game table with drill-down */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Cross-Game Adaptation Evidence
          </CardTitle>
          <CardDescription>
            Click any row to inspect per-game adaptation details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Exercise</TableHead>
                <TableHead className="text-center">Trials</TableHead>
                <TableHead className="text-center">Coverage</TableHead>
                <TableHead className="text-center">Adapted</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Phonemes</TableHead>
                <TableHead>Cue</TableHead>
                <TableHead className="text-center">Difficulty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map(row => (
                <ExpandableGameRow key={row.exerciseSlug} row={row} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Coverage Gap Recommendations */}
      <AdaptationCoverageGaps summary={summary} />
    </div>
  );
};

const ExpandableGameRow = ({ row }: { row: GameAdaptationRow }) => {
  const [expanded, setExpanded] = useState(false);
  const dominantMode = getDominantMode(row.adaptationModes);
  const dominantCue = Object.entries(row.cueTypesRecommended)
    .filter(([k]) => k !== 'none')
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const diffLevels = Object.keys(row.difficultyLevels).map(Number).sort();
  const adapted = row.adaptedTrials > 0;
  const lowCoverage = row.telemetryCoverage < 0.8;

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50" 
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8 px-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium text-sm">
          <div className="flex items-center gap-2">
            {adapted ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
            {formatSlug(row.exerciseSlug)}
            {row.dataQualityIssues.length > 0 && (
              <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />
            )}
          </div>
        </TableCell>
        <TableCell className="text-center text-sm">{row.totalTrials}</TableCell>
        <TableCell className="text-center text-sm">
          <span className={cn(lowCoverage ? 'text-destructive font-medium' : 'text-muted-foreground')}>
            {Math.round(row.telemetryCoverage * 100)}%
          </span>
        </TableCell>
        <TableCell className="text-center text-sm">
          <span className={cn(adapted ? 'text-primary font-medium' : 'text-muted-foreground')}>
            {Math.round(row.adaptationRate * 100)}%
          </span>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn('text-xs', MODE_COLORS[dominantMode] || '')}>
            {MODE_LABELS[dominantMode] || dominantMode}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">
          {row.focusPhonemesUsed.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.focusPhonemesUsed.slice(0, 3).map(p => (
                <Badge key={p} variant="secondary" className="text-xs px-1.5 py-0">/{p}/</Badge>
              ))}
              {row.focusPhonemesUsed.length > 3 && (
                <span className="text-xs text-muted-foreground">+{row.focusPhonemesUsed.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-sm">
          {dominantCue ? (
            <Badge variant="outline" className="text-xs">{dominantCue}</Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-center text-sm">
          {diffLevels.length > 1 ? (
            <span className="flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              {diffLevels[0]}–{diffLevels[diffLevels.length - 1]}
            </span>
          ) : (
            <span className="text-muted-foreground">{diffLevels[0] ?? '—'}</span>
          )}
        </TableCell>
      </TableRow>

      {/* Drill-down detail row */}
      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/20 p-0">
            <GameDrillDown row={row} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const GameDrillDown = ({ row }: { row: GameAdaptationRow }) => {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Mode Distribution */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Mode Distribution</h4>
          <div className="space-y-1">
            {Object.entries(row.adaptationModes)
              .sort((a, b) => b[1] - a[1])
              .map(([mode, count]) => (
                <div key={mode} className="flex items-center justify-between text-sm">
                  <Badge variant="outline" className={cn('text-xs', MODE_COLORS[mode] || '')}>
                    {MODE_LABELS[mode] || mode}
                  </Badge>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Phonemes */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Focus Phonemes</h4>
          {row.focusPhonemesUsed.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.focusPhonemesUsed.map(p => (
                <Badge key={p} variant="secondary" className="text-xs">/{p}/</Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No phonemes targeted</p>
          )}
        </div>

        {/* Cue Distribution */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Cue Types</h4>
          <div className="space-y-1">
            {Object.entries(row.cueTypesRecommended)
              .sort((a, b) => b[1] - a[1])
              .map(([cue, count]) => (
                <div key={cue} className="flex items-center justify-between text-sm">
                  <span className="text-xs">{cue}</span>
                  <span className="text-muted-foreground text-xs">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Difficulty Levels</h4>
          <div className="space-y-1">
            {Object.entries(row.difficultyLevels)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([level, count]) => (
                <div key={level} className="flex items-center justify-between text-sm">
                  <span className="text-xs">Tier {level}</span>
                  <span className="text-muted-foreground text-xs">{count} trials</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Profile Confidence Distribution */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Profile Confidence</h4>
        <div className="flex gap-3">
          {Object.entries(row.profileConfidences)
            .sort((a, b) => b[1] - a[1])
            .map(([conf, count]) => (
              <Badge key={conf} variant="outline" className="text-xs">
                {conf}: {count}
              </Badge>
            ))}
        </div>
      </div>

      {/* Data Quality Issues */}
      {row.dataQualityIssues.length > 0 && (
        <div className="border-t pt-3">
          <h4 className="text-xs font-medium text-destructive uppercase mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Data Quality Issues
          </h4>
          <div className="space-y-1">
            {row.dataQualityIssues.map((issue, i) => (
              <p key={i} className="text-xs text-destructive/80">
                • {issue.description} ({issue.count}×)
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Recent Adapted Trials */}
      {row.recentTrials.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Clock className="w-3 h-3" />
            Recent trials ({row.recentTrials.length})
            <ChevronDown className="w-3 h-3" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1.5">
              {row.recentTrials.map((trial, i) => (
                <RecentTrialRow key={i} trial={trial} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

const RecentTrialRow = ({ trial }: { trial: RecentAdaptedTrial }) => (
  <div className="flex items-center gap-3 text-xs p-2 rounded bg-muted/30">
    <span className="text-muted-foreground w-20 flex-shrink-0">
      {formatDistanceToNow(new Date(trial.createdAt), { addSuffix: true })}
    </span>
    <Badge variant="outline" className={cn('text-[10px]', MODE_COLORS[trial.adaptationMode] || '')}>
      {MODE_LABELS[trial.adaptationMode] || trial.adaptationMode}
    </Badge>
    {trial.adaptationApplied ? (
      <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
    ) : (
      <Minus className="w-3 h-3 text-muted-foreground flex-shrink-0" />
    )}
    {trial.focusPhonemes && trial.focusPhonemes.length > 0 && (
      <span className="text-muted-foreground">
        /{trial.focusPhonemes.join(', ')}/
      </span>
    )}
    <span className="text-muted-foreground">cue: {trial.recommendedCueType}</span>
    <span className="text-muted-foreground">d{trial.difficultyLevel}</span>
    <Badge variant="outline" className="text-[10px]">{trial.profileConfidence}</Badge>
  </div>
);

const MiniKPI = ({ label, value, detail, highlight }: { label: string; value: string; detail: string; highlight?: boolean }) => (
  <Card className={cn('p-3', highlight && 'border-destructive/30')}>
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className={cn('text-xl font-bold mt-1', highlight && 'text-destructive')}>{value}</p>
    <p className="text-xs text-muted-foreground">{detail}</p>
  </Card>
);
