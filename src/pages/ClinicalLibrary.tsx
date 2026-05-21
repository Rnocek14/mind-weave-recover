/**
 * Clinical Library — /games
 *
 * Read-only index of every exercise grouped by clinical axis. PR7 expansion:
 *
 *   - Each `full` card shows live per-profile progression (current level,
 *     progress %, support baseline, last played) joined from
 *     `clinical_progression_state`. Telemetry-only / generic cards never
 *     fake a level.
 *   - The L1–L8 ladder table now carries a per-row Tier-status column
 *     ("Implemented" / "Partially implemented" / "Planned — selector skips
 *     honestly") sourced from `clinicalIntegrity.deriveTierStatusFromSpec`.
 *   - Each full card surfaces its evidence-basis link + a one-line tldr,
 *     so a clinician can audit the clinical claim directly.
 *   - A single global heuristic disclosure is shown at page top so the
 *     overall progression system is not over-interpreted as diagnostic.
 *
 * Honesty rules (Clinical Safety + Decision-Based Design):
 *   - Never fake an L1–L8 table for a game without a real spec.
 *   - Always label readiness when the spec provides it.
 *   - No celebration language. Calm clinical framing.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AXIS_LABEL,
  entriesByAxis,
  type ClinicalLadderEntry,
  type LadderRow,
  type LadderStatus,
} from '@/lib/clinicalLadderRegistry';
import {
  HEURISTIC_DISCLOSURE,
  TIER_STATUS_PRESENTATION,
} from '@/lib/clinicalIntegrity';
import { getCanonicalExercise } from '@/data/canonicalExerciseRegistry';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toProgressionSlug } from '@/lib/exerciseSlugNormalizer';

const STATUS_BADGE: Record<LadderStatus, { label: string; className: string }> = {
  full: {
    label: 'Full L1–L8 ladder',
    className: 'bg-primary/15 text-primary border-primary/30',
  },
  'telemetry-only': {
    label: 'Tier-A telemetry · ladder pending',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  generic: {
    label: 'Generic 1–10 engine',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

const READINESS_BADGE = {
  ready: { label: 'Ready', className: 'bg-primary/15 text-primary' },
  thin: { label: 'Thin', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  aspirational: { label: 'Aspirational', className: 'bg-muted text-muted-foreground' },
} as const;

interface StateRow {
  exercise_slug: string;
  current_level: number;
  stable_level: number;
  progress_pct: number;
  support_baseline: number;
  last_updated_at: string;
}

function formatSupport(support: string): string {
  return support.replace(/_/g, ' ');
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return new Date(iso).toLocaleDateString();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function TierStatusChip({ row }: { row: LadderRow }) {
  const p = TIER_STATUS_PRESENTATION[row.tierStatus];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`${p.chipClass} cursor-help`}>
          {row.tierStatus === 'partially-implemented' && <ShieldAlert className="mr-1 h-3 w-3" />}
          {p.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {row.tierStatusDetail}
      </TooltipContent>
    </Tooltip>
  );
}

function LadderTable({ entry }: { entry: ClinicalLadderEntry }) {
  if (!entry.rows?.length) return null;
  const showReadiness = entry.rows.some((r) => r.readiness);
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">L</th>
            <th className="px-3 py-2 font-medium">Clinical description</th>
            <th className="px-3 py-2 font-medium">Target support</th>
            <th className="px-3 py-2 font-medium text-right">Attempts</th>
            <th className="px-3 py-2 font-medium text-right">Accuracy</th>
            <th className="px-3 py-2 font-medium">Tier status</th>
            {showReadiness && <th className="px-3 py-2 font-medium">Readiness</th>}
          </tr>
        </thead>
        <tbody>
          {entry.rows.map((row) => (
            <tr key={row.level} className="border-t border-border align-top">
              <td className="px-3 py-2 font-semibold tabular-nums text-foreground">{row.level}</td>
              <td className="px-3 py-2 text-foreground">
                {row.description}
                {row.contentTierLabel && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{row.contentTierLabel}</div>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{formatSupport(row.targetSupport)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">≥ {row.minOnTargetAttempts}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {Math.round(row.minOnTargetAccuracy * 100)}%
              </td>
              <td className="px-3 py-2"><TierStatusChip row={row} /></td>
              {showReadiness && (
                <td className="px-3 py-2">
                  {row.readiness && (
                    <Badge variant="outline" className={READINESS_BADGE[row.readiness].className}>
                      {READINESS_BADGE[row.readiness].label}
                    </Badge>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveProgressStrip({ row }: { row: StateRow | undefined }) {
  if (!row) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        No play recorded for the active profile yet.
      </div>
    );
  }
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs sm:grid-cols-4">
      <div>
        <div className="text-muted-foreground">Current level</div>
        <div className="font-mono text-foreground">L{row.current_level} / 8 <span className="text-muted-foreground">(stable L{row.stable_level})</span></div>
      </div>
      <div>
        <div className="text-muted-foreground">Progress</div>
        <div className="flex items-center gap-2">
          <Progress value={Number(row.progress_pct)} className="h-1.5 flex-1" />
          <span className="tabular-nums">{Math.round(Number(row.progress_pct))}%</span>
        </div>
      </div>
      <div>
        <div className="text-muted-foreground">Support baseline</div>
        <div className="font-mono text-foreground">+{row.support_baseline}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Last played</div>
        <div className="text-foreground">{formatRelative(row.last_updated_at)}</div>
      </div>
    </div>
  );
}

function GameCard({
  entry,
  stateRow,
}: {
  entry: ClinicalLadderEntry;
  stateRow: StateRow | undefined;
}) {
  const canonical = getCanonicalExercise(entry.slug);
  const title = canonical?.title ?? entry.slug;
  const [open, setOpen] = useState(entry.status === 'full');
  const badge = STATUS_BADGE[entry.status];
  const hasLadder = entry.status === 'full' && (entry.rows?.length ?? 0) > 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{entry.purpose}</p>
          </div>
          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {entry.status === 'full' && <LiveProgressStrip row={stateRow} />}

        {entry.status === 'telemetry-only' && entry.telemetryNote && (
          <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Support mapping:</span> {entry.telemetryNote}
            </span>
          </div>
        )}
        {entry.status === 'generic' && (
          <p className="text-xs text-muted-foreground">
            No per-level clinical ladder yet. Difficulty is driven by the generic
            1–10 adaptation engine until a <code className="text-foreground">{entry.slug}Levels.ts</code> spec is shipped.
          </p>
        )}

        {entry.evidenceBasis && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <span className="font-medium text-foreground">Evidence basis: </span>
              <span className="text-muted-foreground">{entry.evidenceBasis.tldr}</span>
              <div className="mt-0.5">
                <code className="text-[10px] text-muted-foreground">{entry.evidenceBasis.docPath}</code>
              </div>
            </div>
          </div>
        )}

        {hasLadder && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {open ? 'Hide L1–L8 ladder' : 'Show L1–L8 ladder'}
          </button>
        )}
        {hasLadder && open && <LadderTable entry={entry} />}

        <div className="mt-3">
          <Link
            to={`/games/${entry.slug}/about`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Open full “About” page →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClinicalLibrary() {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const groups = entriesByAxis();
  const [stateRows, setStateRows] = useState<StateRow[]>([]);

  useEffect(() => {
    if (!activeProfile?.id) {
      setStateRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('clinical_progression_state')
        .select('exercise_slug,current_level,stable_level,progress_pct,support_baseline,last_updated_at')
        .eq('profile_id', activeProfile.id);
      if (!cancelled) setStateRows((data ?? []) as StateRow[]);
    })();
    return () => { cancelled = true; };
  }, [activeProfile?.id]);

  const stateBySlug = useMemo(() => {
    const m = new Map<string, StateRow>();
    for (const r of stateRows) m.set(toProgressionSlug(r.exercise_slug), r);
    return m;
  }, [stateRows]);

  const totalFull = Object.values(groups).reduce(
    (n, g) => n + g.entries.filter((e) => e.status === 'full').length, 0,
  );
  const totalTelemetry = Object.values(groups).reduce(
    (n, g) => n + g.entries.filter((e) => e.status === 'telemetry-only').length, 0,
  );
  const totalGeneric = Object.values(groups).reduce(
    (n, g) => n + g.entries.filter((e) => e.status === 'generic').length, 0,
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clinical Library</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every exercise grouped by clinical axis, with the per-level ladder
            that defines what each level trains and what evidence graduates it.
            Games without a published ladder are flagged honestly.
          </p>

          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{HEURISTIC_DISCLOSURE}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className={STATUS_BADGE.full.className}>{totalFull} full ladder</Badge>
            <Badge variant="outline" className={STATUS_BADGE['telemetry-only'].className}>{totalTelemetry} telemetry-only</Badge>
            <Badge variant="outline" className={STATUS_BADGE.generic.className}>{totalGeneric} generic engine</Badge>
          </div>
        </header>

        <div className="space-y-8">
          {groups.map(({ axis, entries }) => (
            <section key={axis}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-foreground">{AXIS_LABEL[axis]}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {entries.length} {entries.length === 1 ? 'game' : 'games'}
                </span>
              </div>
              <Separator className="mb-3" />
              <div className="grid gap-3">
                {entries.map((entry) => (
                  <GameCard
                    key={entry.slug}
                    entry={entry}
                    stateRow={stateBySlug.get(toProgressionSlug(entry.slug))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
