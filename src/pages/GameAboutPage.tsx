/**
 * Game About Page — "How this game supports recovery"
 *
 * Read-only educational + motivational surface. One canonical route per
 * game: /games/:slug/about. Designed to be linked from exercise cards,
 * the Patient Hub, level-up screens, caregiver and clinician views.
 *
 * Spec-only data sources (no engine coupling):
 *   - clinicalDimensions.ts (shared vocabulary)
 *   - clinicalRungs.ts (per-game rungs + dominant axis + telemetry)
 */

import { useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Info, Target, Eye, LifeBuoy, Trophy, Compass } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  getGameClinicalProfile,
  type ClinicalRung,
  type RungReadiness,
} from '@/lib/leveling/clinicalRungs';
import { CLINICAL_DIMENSIONS, type ClinicalDimensionId } from '@/lib/leveling/clinicalDimensions';
import { CLINICAL_LADDER_REGISTRY } from '@/lib/clinicalLadderRegistry';

function readinessBadge(r: RungReadiness) {
  const map: Record<RungReadiness, { label: string; className: string }> = {
    ready: { label: 'Ready', className: 'bg-primary/15 text-primary border-primary/30' },
    thin: { label: 'Thin content', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    aspirational: { label: 'Aspirational', className: 'bg-muted text-muted-foreground border-border' },
  };
  const m = map[r];
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
}

function DimensionChip({ id }: { id: ClinicalDimensionId }) {
  const d = CLINICAL_DIMENSIONS[id];
  return (
    <span
      title={`${d.clinicalLabel} — ${d.description}`}
      className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-foreground"
    >
      {d.patientLabel}
    </span>
  );
}

function RungCard({ rung, index, total }: { rung: ClinicalRung; index: number; total: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rung {index + 1} of {total} · Level {rung.levelRange[0]}–{rung.levelRange[1]}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{rung.name}</h3>
        </div>
        {readinessBadge(rung.readiness)}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{rung.description}</p>

      <div className="mt-3">
        <div className="text-xs font-medium text-muted-foreground">What this rung stresses</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {rung.stresses.map(d => <DimensionChip key={d} id={d} />)}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-muted/40 p-3">
        <div className="text-xs font-medium text-muted-foreground">Mastery</div>
        <p className="mt-0.5 text-sm text-foreground">{rung.masteryCriterion}</p>
      </div>
    </div>
  );
}

export default function GameAboutPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const profile = useMemo(() => getGameClinicalProfile(slug ?? ''), [slug]);

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-10 text-center">
            <h1 className="text-xl font-semibold">Game not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't find a recovery overview for "{slug}".
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const sectionTitle = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      {icon}
      <span>{title}</span>
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          How this game supports recovery
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{profile.title}</h1>
        <p className="mt-2 text-base text-muted-foreground">{profile.patientSummary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Compass className="h-3 w-3" /> Dominant axis: {profile.dominantAxis}
          </Badge>
          <Button asChild size="sm" variant="outline">
            <Link to={`/exercise/${profile.urlSlug}`}>
              Start practicing <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-primary" /> What this game trains
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-foreground">{profile.clinicalSummary}</p>
          <Separator />
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Things the coach can adjust independently of your level
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.modifiers.map(d => <DimensionChip key={d} id={d} />)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              These are <em>modifiers</em>: they can soften or harden a single trial without changing your long-term level.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          {sectionTitle(<Target className="h-4 w-4 text-primary" />, 'Clinical rungs')}
          <span className="text-xs text-muted-foreground">Easiest → hardest</span>
        </div>
        <div className="space-y-3">
          {profile.rungs.map((r, i) => (
            <RungCard key={r.name} rung={r} index={i} total={profile.rungs.length} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <strong>Readiness</strong> shows whether we have enough curated content for that rung today.
          "Thin" or "Aspirational" rungs are still being built out — your level may temporarily cap until more content lands.
        </p>
      </section>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" /> What the coach watches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-1.5 text-sm text-foreground sm:grid-cols-2">
            {profile.telemetryWatched.map(t => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-4 w-4 text-primary" /> Why support may increase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{profile.whySupportMayIncrease}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Real-time adaptation (cues, pacing, simplification) is separate from your long-term progression.
            One hard session never costs you a rung.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" /> What comes next
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{profile.whatComesNext}</p>
          <div className="mt-4">
            <Button asChild>
              <Link to={`/exercise/${profile.urlSlug}`}>
                Start {profile.title} <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
