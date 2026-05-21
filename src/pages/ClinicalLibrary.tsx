/**
 * Clinical Library — /games
 *
 * Read-only index of every exercise grouped by clinical axis, showing each
 * game's clinical significance: axis, purpose, runtime-engine status, and the
 * one-line evidence-basis rationale (when published). Data-driven off
 * CLINICAL_LADDER_REGISTRY — adding a new `xxxLevels.ts` module + registry
 * entry auto-upgrades the matching card.
 *
 * Honesty rules (Clinical Safety + Decision-Based Design):
 *   - Status badges are differentiated (full / structural / design-only /
 *     generic). They describe *runtime enforcement*, not clinical merit.
 *   - The L1–L8 ladder table is expanded ONLY for `full` entries. Structural
 *     and design-only games surface their evidence rationale but not the
 *     per-level table (those banks are pre-clinician-review).
 *   - No celebration language. Calm clinical framing. Readiness flags
 *     (ready/thin/aspirational) carry honesty inside `full` tables.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AXIS_LABEL,
  entriesByAxis,
  type ClinicalLadderEntry,
  type LadderStatus,
  type MasteryTrack,
} from '@/lib/clinicalLadderRegistry';
import { getCanonicalExercise } from '@/data/canonicalExerciseRegistry';

const STATUS_BADGE: Record<LadderStatus, { label: string; className: string; help: string }> = {
  full: {
    label: 'Full L1–L8 ladder',
    className: 'bg-primary/15 text-primary border-primary/30',
    help: 'Real per-level spec drives runtime adaptation. L1–L8 table below.',
  },
  structural: {
    label: 'Structural ladder',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    help: 'Engine runs against an L1–L8 spec; top tiers may be thin. Table withheld pending clinician review of content banks.',
  },
  'design-only': {
    label: 'Design-of-record',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
    help: 'Clinical L1–L8 design is published; runtime still uses the generic 1–10 engine until per-level enforcement lands.',
  },
  'telemetry-only': {
    label: 'Telemetry-only',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    help: 'Tier-A trial telemetry is migrated; no ladder spec yet.',
  },
  generic: {
    label: 'Generic engine',
    className: 'bg-muted text-muted-foreground border-border',
    help: 'No clinical ladder by design. Rides the universal 1–10 adaptation engine.',
  },
};

const TRACK_BADGE: Record<MasteryTrack, { label: string; className: string }> = {
  expressive: {
    label: 'Expressive',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  receptive: {
    label: 'Receptive',
    className: 'bg-muted text-muted-foreground border-border',
  },
  'non-linguistic': {
    label: 'Non-linguistic',
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

/**
 * Patient-safe progression view for `structural` and `design-only` games.
 *
 * Collapses the 8 internal clinical rungs into 4 patient-readable stages.
 * We surface the spec-authored `description` (it's the cleanest clinical
 * sentence we have) but DELIBERATELY OMIT:
 *   - target support level (clinician language)
 *   - mastery attempts / accuracy thresholds
 *   - readiness flags (thin / aspirational)
 *   - per-tier integrity detail
 *
 * Rationale: patients interpret ladders emotionally. Showing a trajectory
 * is motivating; surfacing "thin"/"aspirational" reads as "unfinished".
 * Clinician mode (future) can surface the full table for these games.
 */
const STAGE_BUCKETS: { label: string; range: [number, number] }[] = [
  { label: 'Early recovery', range: [1, 2] },
  { label: 'Functional', range: [3, 4] },
  { label: 'Complex', range: [5, 6] },
  { label: 'Advanced integration', range: [7, 8] },
];

function RecoveryRoadmap({
  entry,
  variant,
}: {
  entry: ClinicalLadderEntry;
  variant: 'structural' | 'design-only';
}) {
  if (!entry.rows?.length) return null;
  const buckets = STAGE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    rows: entry.rows!.filter(
      (r) => r.level >= bucket.range[0] && r.level <= bucket.range[1],
    ),
  })).filter((b) => b.rows.length > 0);

  const heading =
    variant === 'structural' ? 'Recovery roadmap' : 'Planned progression focus';
  const note =
    variant === 'structural'
      ? 'Simplified stages. The engine adapts per level internally; the detailed L1–L8 table is reserved for clinician review.'
      : 'Conceptual progression. Clinical design-of-record; runtime adaptation still rides the generic 1–10 engine.';

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{heading}</h4>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {buckets.length} stages
        </span>
      </div>
      <ol className="space-y-2">
        {buckets.map((bucket, i) => (
          <li key={bucket.label} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold tabular-nums text-primary">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {bucket.label}
              </div>
              <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                {bucket.rows.map((r) => (
                  <li key={r.level}>{r.description}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] italic text-muted-foreground">{note}</p>
    </div>
  );
}

function GameCard({ entry }: { entry: ClinicalLadderEntry }) {
  const canonical = getCanonicalExercise(entry.slug);
  const title = canonical?.title ?? entry.slug;
  // Review mode: surface the full L1–L8 table for any game that has rows,
  // regardless of clinician-review status, so the team can audit every
  // ladder side-by-side. Re-gate later if we ship this to patients.
  const hasFullLadder = (entry.rows?.length ?? 0) > 0;
  const hasRoadmap = false;
  const [open, setOpen] = useState(hasFullLadder);
  const badge = STATUS_BADGE[entry.status];
  const trackBadge = TRACK_BADGE[entry.track];

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{entry.purpose}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={trackBadge.className} title="Mastery track">
              {trackBadge.label}
            </Badge>
            <Badge variant="outline" className={badge.className} title={badge.help}>
              {badge.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {entry.evidenceBasis?.tldr && (
          <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Evidence basis:</span>{' '}
              {entry.evidenceBasis.tldr}
            </span>
          </div>
        )}

        {entry.telemetryNote && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Scope:</span>{' '}
              {entry.telemetryNote}
            </span>
          </div>
        )}

        {entry.status === 'generic' && !entry.evidenceBasis && (
          <p className="text-xs text-muted-foreground">
            No per-level clinical ladder by design. Difficulty is driven by the
            generic 1–10 adaptation engine.
          </p>
        )}

        {(hasFullLadder || hasRoadmap) && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {hasFullLadder
              ? open ? 'Hide L1–L8 ladder' : 'Show L1–L8 ladder'
              : entry.status === 'structural'
                ? open ? 'Hide recovery roadmap' : 'Show recovery roadmap'
                : open ? 'Hide progression focus' : 'Show planned progression focus'}
          </button>
        )}
        {hasFullLadder && open && <LadderTable entry={entry} />}
        {hasRoadmap && open && (
          <RecoveryRoadmap
            entry={entry}
            variant={entry.status as 'structural' | 'design-only'}
          />
        )}

        <div className="mt-3">
          <Link
            to={`/games/${entry.slug}/about`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Open full "About" page →
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
    groups.reduce(
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
          Every exercise grouped by clinical axis, with the per-game evidence
          basis and the maturity of its per-level ladder. Badges describe
          runtime enforcement, not clinical merit.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {totalFull > 0 && (
            <Badge variant="outline" className={STATUS_BADGE.full.className}>
              {totalFull} full ladder
            </Badge>
          )}
          {totalStructural > 0 && (
            <Badge variant="outline" className={STATUS_BADGE.structural.className}>
              {totalStructural} structural
            </Badge>
          )}
          {totalDesign > 0 && (
            <Badge variant="outline" className={STATUS_BADGE['design-only'].className}>
              {totalDesign} design-of-record
            </Badge>
          )}
          {totalTelemetry > 0 && (
            <Badge variant="outline" className={STATUS_BADGE['telemetry-only'].className}>
              {totalTelemetry} telemetry-only
            </Badge>
          )}
          {totalGeneric > 0 && (
            <Badge variant="outline" className={STATUS_BADGE.generic.className}>
              {totalGeneric} generic
            </Badge>
          )}
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
