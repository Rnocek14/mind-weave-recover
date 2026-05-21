/**
 * Clinical Library — /games
 *
 * Read-only index of every exercise grouped by clinical axis, showing each
 * game's current per-level ladder (when one exists) or an honest status badge
 * when it does not. Data-driven off CLINICAL_LADDER_REGISTRY — adding a new
 * `xxxLevels.ts` module + registry entry auto-upgrades the matching card.
 *
 * Honesty rules (Clinical Safety + Decision-Based Design):
 *   - Never fake an L1–L8 table for a game without a real spec.
 *   - Always label readiness when the spec provides it (ready / thin /
 *     aspirational), per the Minimal Pairs convention.
 *   - No celebration language. Calm clinical framing.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AXIS_LABEL,
  entriesByAxis,
  type ClinicalLadderEntry,
  type LadderStatus,
} from '@/lib/clinicalLadderRegistry';
import { getCanonicalExercise } from '@/data/canonicalExerciseRegistry';

// NOTE: `structural` and `design-only` ladders exist in the registry but are
// intentionally rendered as the neutral generic engine in patient/clinician-
// facing UI until their content banks and rubrics are clinician-reviewed. Do
// NOT surface differentiated badges or expanded ladder tables for them here.
const STATUS_BADGE: Record<LadderStatus, { label: string; className: string }> = {
  full: {
    label: 'Full L1–L8 ladder',
    className: 'bg-primary/15 text-primary border-primary/30',
  },
  structural: {
    label: 'Generic 1–10 engine',
    className: 'bg-muted text-muted-foreground border-border',
  },
  'design-only': {
    label: 'Generic 1–10 engine',
    className: 'bg-muted text-muted-foreground border-border',
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

function formatSupport(support: string): string {
  return support.replace(/_/g, ' ');
}

function LadderTable({ entry }: { entry: ClinicalLadderEntry }) {
  if (!entry.rows?.length) return null;
  const showMastery = entry.rows.some(
    (r) => r.minOnTargetAttempts !== undefined && r.minOnTargetAccuracy !== undefined,
  );
  const showReadiness = entry.rows.some((r) => r.readiness);
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">L</th>
            <th className="px-3 py-2 font-medium">Clinical description</th>
            <th className="px-3 py-2 font-medium">Target support</th>
            {showMastery && <th className="px-3 py-2 font-medium text-right">Attempts</th>}
            {showMastery && <th className="px-3 py-2 font-medium text-right">Accuracy</th>}
            {showReadiness && <th className="px-3 py-2 font-medium">Readiness</th>}
          </tr>
        </thead>
        <tbody>
          {entry.rows.map((row) => (
            <tr key={row.level} className="border-t border-border">
              <td className="px-3 py-2 font-semibold tabular-nums text-foreground">
                {row.level}
              </td>
              <td className="px-3 py-2 text-foreground">{row.description}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatSupport(row.targetSupport)}
              </td>
              {showMastery && (
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.minOnTargetAttempts !== undefined ? `≥ ${row.minOnTargetAttempts}` : '—'}
                </td>
              )}
              {showMastery && (
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.minOnTargetAccuracy !== undefined
                    ? `${Math.round(row.minOnTargetAccuracy * 100)}%`
                    : '—'}
                </td>
              )}
              {showReadiness && (
                <td className="px-3 py-2">
                  {row.readiness && (
                    <Badge
                      variant="outline"
                      className={READINESS_BADGE[row.readiness].className}
                    >
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

function GameCard({ entry }: { entry: ClinicalLadderEntry }) {
  const canonical = getCanonicalExercise(entry.slug);
  const title = canonical?.title ?? entry.slug;
  const [open, setOpen] = useState(entry.status === 'full');
  const badge = STATUS_BADGE[entry.status];
  // Only `full` ladders surface a live L1–L8 table to users. Structural and
  // design-only entries remain registry-only until clinician review.
  const hasLadder = entry.status === 'full' && (entry.rows?.length ?? 0) > 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{entry.purpose}</p>
          </div>
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {entry.status === 'telemetry-only' && entry.telemetryNote && (
          <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Support mapping:</span>{' '}
              {entry.telemetryNote}
            </span>
          </div>
        )}
        {(entry.status === 'generic' ||
          entry.status === 'structural' ||
          entry.status === 'design-only') && (
          <p className="text-xs text-muted-foreground">
            No per-level clinical ladder yet. Difficulty is driven by the generic
            1–10 adaptation engine until a <code className="text-foreground">{entry.slug}Levels.ts</code> spec is shipped and clinician-reviewed.
          </p>
        )}

        {hasLadder && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
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
  const groups = entriesByAxis();

  const countByStatus = (status: LadderStatus): number =>
    Object.values(groups).reduce(
      (n, g) => n + g.entries.filter((e) => e.status === status).length,
      0,
    );
  const totalFull = countByStatus('full');
  const totalStructural = countByStatus('structural');
  const totalDesign = countByStatus('design-only');
  const totalTelemetry = countByStatus('telemetry-only');
  const totalGeneric = countByStatus('generic');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-3 -ml-2"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Clinical Library
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every exercise grouped by clinical axis, with the per-level ladder
          that defines what each level trains and what evidence graduates it.
          Games without a published ladder are flagged honestly.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className={STATUS_BADGE.full.className}>
            {totalFull} full ladder
          </Badge>
          <Badge variant="outline" className={STATUS_BADGE['telemetry-only'].className}>
            {totalTelemetry} telemetry-only
          </Badge>
          <Badge variant="outline" className={STATUS_BADGE.generic.className}>
            {totalGeneric + totalStructural + totalDesign} generic engine
          </Badge>
        </div>
      </header>

      <div className="space-y-8">
        {groups.map(({ axis, entries }) => (
          <section key={axis}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {AXIS_LABEL[axis]}
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {entries.length} {entries.length === 1 ? 'game' : 'games'}
              </span>
            </div>
            <Separator className="mb-3" />
            <div className="grid gap-3">
              {entries.map((entry) => (
                <GameCard key={entry.slug} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
