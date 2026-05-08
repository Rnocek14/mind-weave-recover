/**
 * RecoveryProfileSection — "Your recovery profile"
 *
 * Patient Hub (clinician/caregiver view) section that summarises, per
 * game the patient has practiced recently:
 *   - current rung (named clinical band)
 *   - dominant clinical axis
 *   - support trend (level moved up / steady / more support)
 *   - next target (the next rung's mastery criterion)
 *   - deep link to the canonical /games/:slug/about page
 *
 * Spec-only consumer of `clinicalRungs.ts`; never feeds the engine.
 * Skips games with no clinical profile yet.
 */
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Minus, Compass } from 'lucide-react';
import { useRecentExerciseLevels } from '@/hooks/useRecentExerciseLevels';
import { getGameClinicalProfile, rungForLevel } from '@/lib/leveling/clinicalRungs';
import { AboutGameLink } from './AboutGameLink';

interface Props {
  userId: string | undefined;
  /** Optional cap on how many games to render. Default: all available. */
  maxGames?: number;
  className?: string;
}

function trendBadge(trend: 1 | 0 | -1 | null) {
  if (trend === null) {
    return (
      <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground border-border">
        <Minus className="w-3 h-3" /> First session
      </Badge>
    );
  }
  if (trend === 1) {
    return (
      <Badge variant="outline" className="gap-1 text-[11px] bg-primary/10 text-primary border-primary/30">
        <TrendingUp className="w-3 h-3" /> Less support needed
      </Badge>
    );
  }
  if (trend === -1) {
    return (
      <Badge variant="outline" className="gap-1 text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400">
        <TrendingDown className="w-3 h-3" /> More support today
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground border-border">
      <Minus className="w-3 h-3" /> Holding steady
    </Badge>
  );
}

export function RecoveryProfileSection({ userId, maxGames, className }: Props) {
  const { levels, loading } = useRecentExerciseLevels(userId);

  const rows = useMemo(() => {
    const enriched = levels
      .map(l => {
        const profile = getGameClinicalProfile(l.slug);
        if (!profile) return null;
        const currentRung = rungForLevel(profile, l.level);
        const idx = profile.rungs.findIndex(r => r === currentRung);
        const nextRung = idx >= 0 && idx < profile.rungs.length - 1
          ? profile.rungs[idx + 1]
          : null;
        return { l, profile, currentRung, nextRung };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return typeof maxGames === 'number' ? enriched.slice(0, maxGames) : enriched;
  }, [levels, maxGames]);

  if (loading) {
    return (
      <Card className={`p-4 ${className ?? ''}`}>
        <p className="text-xs text-muted-foreground">Loading recovery profile…</p>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className={`p-4 ${className ?? ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <Compass className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Recovery profile</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Recovery rungs will appear here after the first practice session.
        </p>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <Compass className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Recovery profile</h3>
        <span className="text-[11px] text-muted-foreground">
          Where they're working today, per exercise
        </span>
      </div>
      <div className="space-y-2">
        {rows.map(({ l, profile, currentRung, nextRung }) => (
          <Card key={profile.slug} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {profile.title}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    Level {l.level}/10
                  </Badge>
                  {trendBadge(l.supportTrend)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-foreground font-medium">{currentRung.name}</span>
                  {' · '}
                  <span>Dominant axis: {profile.dominantAxis.toLowerCase()}</span>
                </p>
              </div>
              <AboutGameLink
                slug={profile.urlSlug}
                variant="pill"
                source="patient-hub-recovery-profile"
              />
            </div>

            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-md bg-muted/40 p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Mastery for this rung
                </div>
                <p className="text-xs text-foreground mt-0.5">{currentRung.masteryCriterion}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Next target
                </div>
                <p className="text-xs text-foreground mt-0.5">
                  {nextRung
                    ? <><span className="font-medium">{nextRung.name}</span> — {nextRung.masteryCriterion}</>
                    : profile.whatComesNext}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-2">
              Last session: {l.lastAccuracy}% accuracy across {l.lastTrialCount} {l.lastTrialCount === 1 ? 'trial' : 'trials'} · {l.sessionsObserved} recent {l.sessionsObserved === 1 ? 'session' : 'sessions'}
            </p>
          </Card>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        One hard session never costs a rung. Support may temporarily increase to keep practice productive.
      </p>
    </div>
  );
}

export default RecoveryProfileSection;
