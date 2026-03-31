/**
 * Deep Dive — Clinical-grade evidence layer
 * 
 * Collapsible section at the bottom of the Intelligence tab.
 * For clinicians, power users, and research/validation.
 * 
 * Sections:
 *  1. Overview Strip — clinical snapshot
 *  2. Adaptation Log — full event table
 *  3. Performance Dataset — per-exercise aggregates
 *  4. Cue Learning Dataset — cue type table + confidence
 *  5. Coverage Gaps — honest system gaps
 *  6. CSV Export
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChevronDown, ChevronRight, Database, Download, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, ShieldCheck, Activity,
} from 'lucide-react';
import { useAdaptationProof } from '@/hooks/useAdaptationProof';
import { useAdaptationTimeline, type AdaptationEvent } from '@/hooks/useAdaptationTimeline';
import { CuePreferenceLearner, type CueType } from '@/lib/cuePreferenceLearner';
import { buildAdaptationCSV, downloadCSV } from '@/lib/exportAdaptationEvidence';
import { useAdaptationOutcomes } from '@/hooks/useAdaptationOutcomes';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeepDiveSectionProps {
  userId: string;
  profileId?: string;
}

export function DeepDiveSection({ userId, profileId }: DeepDiveSectionProps) {
  const [open, setOpen] = useState(false);
  const { summary, isLoading: proofLoading } = useAdaptationProof(userId, 30);
  const { events, isLoading: timelineLoading } = useAdaptationTimeline(userId, 30, 200);
  const { outcomes, isLoading: outcomesLoading } = useAdaptationOutcomes(userId, 30);

  const isLoading = proofLoading || timelineLoading;

  // Cue data
  const learner = new CuePreferenceLearner(userId);
  const cueState = learner.getState();
  const cueRows = (['semantic', 'phonemic', 'sentence', 'visual'] as CueType[])
    .map(ct => ({
      type: ct,
      attempts: cueState.stats[ct].attempts,
      successes: cueState.stats[ct].successes,
      rate: cueState.stats[ct].attempts > 0
        ? Math.round((cueState.stats[ct].successes / cueState.stats[ct].attempts) * 100)
        : 0,
    }));
  const totalCueAttempts = cueRows.reduce((s, r) => s + r.attempts, 0);

  // Coverage gaps
  const gaps = useMemo(() => {
    if (!summary) return [];
    const g: { exercise: string; message: string; severity: 'warning' | 'critical' }[] = [];
    for (const row of summary.rows) {
      if (row.totalTrials < 3) continue;
      if (row.telemetryCoverage < 0.5) {
        g.push({ exercise: row.exerciseSlug, severity: 'critical', message: `Only ${Math.round(row.telemetryCoverage * 100)}% telemetry coverage` });
      }
      if (row.adaptationRate < 0.1 && row.totalTrials >= 5) {
        g.push({ exercise: row.exerciseSlug, severity: 'warning', message: 'No real-time adaptation detected' });
      }
    }
    // Low cue data
    for (const cr of cueRows) {
      if (cr.attempts > 0 && cr.attempts < 5) {
        g.push({ exercise: `${cr.type} cues`, severity: 'warning', message: `Only ${cr.attempts} trials — insufficient data` });
      }
    }
    return g;
  }, [summary, cueRows]);

  const handleExport = () => {
    if (!summary) return;
    const csv = buildAdaptationCSV(summary, outcomes);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `clinical-deep-dive-${date}.csv`);
    toast.success('Clinical data exported');
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-dashed border-muted-foreground/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Deep Dive
                </CardTitle>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  Clinical Data
                </Badge>
              </div>
              {open
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
            </div>
            {!open && (
              <CardDescription className="text-[11px]">
                Full adaptation log, raw metrics, coverage gaps, and CSV export
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {isLoading ? (
              <div className="h-32 bg-muted rounded animate-pulse" />
            ) : (
              <>
                {/* ─── 1. OVERVIEW STRIP ─── */}
                {summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-muted/40 rounded-lg">
                    <OverviewStat label="Sessions" value={summary.totalGames.toString()} />
                    <OverviewStat label="Total Trials" value={summary.totalTrials.toLocaleString()} />
                    <OverviewStat label="Adaptations" value={summary.totalAdapted.toString()} />
                    <OverviewStat label="Avg Accuracy" value={`${Math.round(summary.overallAdaptationRate * 100)}%`} />
                    <OverviewStat label="Telemetry" value={`${Math.round(summary.telemetryCoverage * 100)}%`} />
                  </div>
                )}

                <Separator />

                {/* ─── 2. ADAPTATION LOG ─── */}
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                    Adaptation Log
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{events.length}</Badge>
                  </h4>

                  {events.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">No adaptation events in the last 30 days.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead className="h-8 px-2">Time</TableHead>
                            <TableHead className="h-8 px-2">Exercise</TableHead>
                            <TableHead className="h-8 px-2">Change</TableHead>
                            <TableHead className="h-8 px-2 text-center">Dir</TableHead>
                            <TableHead className="h-8 px-2">Reason</TableHead>
                            <TableHead className="h-8 px-2 text-center">Conf</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {events.map(event => {
                            const isUp = event.adaptation_type?.includes('up') ||
                              (event.adaptation_type === 'difficulty_change' && (event.value_after as any) > (event.value_before as any));
                            const isDown = event.adaptation_type?.includes('down') || event.adaptation_type === 'frustration_stepdown';
                            const before = formatValue(event.value_before);
                            const after = formatValue(event.value_after);

                            return (
                              <TableRow key={event.id} className="text-[11px]">
                                <TableCell className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 capitalize whitespace-nowrap">
                                  {(event.exercise_slug || event.layer || '—').replace(/[-_]/g, ' ')}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 font-mono text-[10px] whitespace-nowrap">
                                  {before} → {after}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 text-center">
                                  {isUp ? <ArrowUpRight className="w-3.5 h-3.5 text-primary inline" /> :
                                   isDown ? <ArrowDownRight className="w-3.5 h-3.5 text-amber-500 inline" /> :
                                   <Minus className="w-3.5 h-3.5 text-muted-foreground inline" />}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 text-muted-foreground max-w-[200px] truncate">
                                  {formatTrigger(event)}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 text-center">
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[9px] px-1 py-0',
                                      event.confidence === 'HIGH' && 'border-primary/50 text-primary',
                                      event.confidence === 'LOW' && 'border-amber-500/50 text-amber-600',
                                    )}
                                  >
                                    {event.confidence}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ─── 3. PERFORMANCE DATASET ─── */}
                {summary && summary.rows.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      Performance Dataset
                    </h4>
                    <div className="grid gap-2">
                      {summary.rows.map(row => (
                        <div key={row.exerciseSlug} className="flex items-center justify-between p-2.5 rounded-lg border bg-card/50 text-xs">
                          <span className="font-medium capitalize">{row.exerciseSlug.replace(/[-_]/g, ' ')}</span>
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>Trials: <strong className="text-foreground">{row.totalTrials}</strong></span>
                            <span>Adapted: <strong className="text-foreground">{Math.round(row.adaptationRate * 100)}%</strong></span>
                            <span>Telemetry: <strong className="text-foreground">{Math.round(row.telemetryCoverage * 100)}%</strong></span>
                            <span>Difficulty: <strong className="text-foreground">
                              {Object.keys(row.difficultyLevels).length > 0
                                ? Object.keys(row.difficultyLevels).sort().join('–')
                                : '—'}
                            </strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* ─── 4. CUE LEARNING DATASET ─── */}
                {totalCueAttempts > 0 && (
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Database className="w-3.5 h-3.5 text-muted-foreground" />
                      Cue Learning Dataset
                    </h4>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead className="h-8 px-2">Cue Type</TableHead>
                            <TableHead className="h-8 px-2 text-center">Attempts</TableHead>
                            <TableHead className="h-8 px-2 text-center">Success Rate</TableHead>
                            <TableHead className="h-8 px-2 text-center">Confidence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cueRows.filter(r => r.attempts > 0).map(row => (
                            <TableRow key={row.type} className="text-[11px]">
                              <TableCell className="px-2 py-1.5 capitalize font-medium">{row.type}</TableCell>
                              <TableCell className="px-2 py-1.5 text-center">{row.attempts}</TableCell>
                              <TableCell className="px-2 py-1.5 text-center">
                                <span className={cn(
                                  'font-mono',
                                  row.rate >= 70 ? 'text-primary' : row.rate >= 40 ? 'text-amber-600' : 'text-destructive'
                                )}>
                                  {row.rate}%
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-center">
                                <Badge variant="outline" className={cn(
                                  'text-[9px] px-1 py-0',
                                  row.attempts >= 20 ? 'border-primary/50 text-primary' :
                                  row.attempts >= 10 ? 'border-muted-foreground/50' :
                                  'border-amber-500/50 text-amber-600'
                                )}>
                                  {row.attempts >= 20 ? 'HIGH' : row.attempts >= 10 ? 'MEDIUM' : 'LOW'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <Separator />

                {/* ─── 5. COVERAGE GAPS ─── */}
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                    Coverage Gaps
                  </h4>
                  {gaps.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      No significant coverage gaps detected.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {gaps.map((gap, i) => (
                        <Alert key={i} className={cn(
                          'py-2',
                          gap.severity === 'critical' ? 'border-destructive/40' : 'border-amber-500/40'
                        )}>
                          <AlertTriangle className={cn(
                            'h-3.5 w-3.5',
                            gap.severity === 'critical' ? 'text-destructive' : 'text-amber-500'
                          )} />
                          <AlertDescription className="text-[11px]">
                            <span className="font-medium capitalize">{gap.exercise.replace(/[-_]/g, ' ')}</span>
                            <span className="text-muted-foreground"> — {gap.message}</span>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* ─── 6. EXPORT ─── */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Export Clinical Data</p>
                    <p className="text-[11px] text-muted-foreground">
                      Download all adaptation evidence, trial metrics, and outcomes as CSV.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={!summary}
                    className="gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ─── Helpers ─── */

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-base font-bold font-mono">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toString();
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const obj = v as Record<string, any>;
    if ('level' in obj) return `Lv ${obj.level}`;
    if ('difficulty_level' in obj) return `Lv ${obj.difficulty_level}`;
    if ('target_value' in obj) return `${obj.target_value}min`;
    if ('cue_level' in obj) return `Cue ${obj.cue_level}`;
    return JSON.stringify(v).slice(0, 30);
  }
  return String(v);
}

function formatTrigger(event: AdaptationEvent): string {
  const evidence = event.evidence as Record<string, any> || {};
  if (evidence.successRate) return `Success rate: ${Math.round(evidence.successRate * 100)}%`;
  if (evidence.consecutiveErrors) return `${evidence.consecutiveErrors} consecutive errors`;
  if (evidence.reason) return evidence.reason;
  if (event.trigger_condition) return event.trigger_condition;
  return event.trigger_type?.replace(/_/g, ' ') || '—';
}
