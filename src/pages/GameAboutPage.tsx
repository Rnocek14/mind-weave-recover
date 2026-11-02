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
import { getGameClinicalProfile } from '@/lib/leveling/clinicalRungs';
import { CLINICAL_DIMENSIONS, type ClinicalDimensionId } from '@/lib/leveling/clinicalDimensions';
import { CLINICAL_LADDER_REGISTRY } from '@/lib/clinicalLadderRegistry';
import { getCanonicalExercise } from '@/data/canonicalExerciseRegistry';



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


export default function GameAboutPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const profile = useMemo(() => getGameClinicalProfile(slug ?? ''), [slug]);
  const registered = CLINICAL_LADDER_REGISTRY[slug ?? ''];

  // Some catalog entries have newly authored eight-stage designs but no
  // legacy 1–10 GameClinicalProfile. Do not send patients to a "not found"
  // page or claim these stages are already working clinical levels.
  if (!profile && registered?.rows?.length) {
    const title = getCanonicalExercise(registered.slug)?.title ??
      (registered.slug === 'functional-scenes' ? 'Command Scenes' : registered.slug);
    const existingPlayableRoutes: Record<string, string> = {
      'reach-tap': '/exercise/reach-tap',
      'left-side-hunt': '/exercise/left-side-hunt',
      'pattern-match': '/exercise/pattern-match',
      'phrase-practice': '/exercise/word-practice',
      'functional-scenes': '/exercise/functional-scenes',
    };
    const practiceRoute = existingPlayableRoutes[registered.slug];
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/games')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to activities
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{registered.purpose}</p>
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">Eight proposed practice stages</p>
          <p className="mt-1 text-sm text-muted-foreground">
            These are a planned progression, not eight levels currently used to
            advance your clinical score. The game still uses its existing
            difficulty and assistance settings.
          </p>
        </div>
        <ol className="mt-4 space-y-2">
          {registered.rows.map(row => (
            <li key={row.level} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {row.level}
              </span>
              <div>
                <p className="text-sm text-foreground">{row.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stage {row.level} — proposed, not yet an independently tracked clinical level
                </p>
              </div>
            </li>
          ))}
        </ol>
        {practiceRoute ? (
          <Button asChild variant="outline" className="mt-5">
            <Link to={practiceRoute}>Open current practice</Link>
          </Button>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            This activity does not yet have a dedicated standalone game route.
            The eight-level design is published for development review only.
          </p>
        )}
      </main>
    );
  }

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

      {/* NOTE: status-specific banners for `structural` / `design-only` were
          intentionally removed pending clinician review of the underlying
          rungs. Do not re-add patient-facing surfacing of ladder status here. */}



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
          {sectionTitle(<Target className="h-4 w-4 text-primary" />,
            registered?.status === 'design-only' ? 'Eight proposed practice stages' : 'Eight clinical practice stages')}
          <span className="text-xs text-muted-foreground">Level 1–8</span>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {registered?.status === 'design-only'
            ? 'These are proposed goals, not eight levels currently used to update your clinical score.'
            : 'The game tracks its own clinical level. Later stages may still have limited content or be unavailable.'}
        </p>
        {registered?.rows?.length ? (
          <ol aria-label="Eight-stage practice ladder" className="space-y-2">
            {registered.rows.map(row => (
              <li key={row.level} data-testid="clinical-stage" className="flex gap-3 rounded-xl border border-border p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {row.level}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{row.description}</p>
                  {row.tierStatus === 'planned' ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Planned stage — not currently available as a separately scored level
                    </p>
                  ) : (row.tierStatus === 'partially-implemented' || row.readiness === 'thin') ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Limited content — practice level may need more examples
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            No game-specific eight-stage description is available.
          </p>
        )}
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
