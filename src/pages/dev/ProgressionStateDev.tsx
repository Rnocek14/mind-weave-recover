/**
 * /dev/progression-state — Admin-only inspector for clinical_progression_state.
 *
 * PR2 of Phase 2.5. Read-only view that proves per-(profile × exercise)
 * progression is actually persisting. Lists every ladder in the registry
 * and joins the live DB row (if any). When a row is missing for an
 * exercise the user has played, that's the smoking gun for a wiring bug.
 *
 * Honesty: this page enforces nothing. It only renders what the DB shows.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { CLINICAL_LADDER_REGISTRY } from '@/lib/clinicalLadderRegistry';
import { toProgressionSlug } from '@/lib/exerciseSlugNormalizer';
import { readSelectorDiagnostics } from '@/lib/progression/photoNamingContentSelector';
import { readMinimalPairsSelectorDiagnostics } from '@/lib/progression/minimalPairsContentSelector';
import { readFixSentenceSelectorDiagnostics } from '@/lib/progression/fixSentenceContentSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface StateRow {
  exercise_slug: string;
  current_level: number;
  stable_level: number;
  progress_pct: number;
  support_baseline: number;
  consecutive_success_sessions: number;
  consecutive_struggle_sessions: number;
  last_session_id: string | null;
  last_updated_at: string;
}

interface RecentTrial {
  exercise_slug: string | null;
  created_at: string;
}

export default function ProgressionStateDev() {
  const { activeProfile } = useProfile();
  const [rows, setRows] = useState<StateRow[]>([]);
  const [recent, setRecent] = useState<RecentTrial[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeProfile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [stateRes, trialRes] = await Promise.all([
        (supabase as any)
          .from('clinical_progression_state')
          .select('exercise_slug,current_level,stable_level,progress_pct,support_baseline,consecutive_success_sessions,consecutive_struggle_sessions,last_session_id,last_updated_at')
          .eq('profile_id', activeProfile.id)
          .order('last_updated_at', { ascending: false }),
        supabase
          .from('adaptation_trial_logs')
          .select('exercise_slug, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);
      if (cancelled) return;
      setRows((stateRes.data ?? []) as StateRow[]);
      setRecent((trialRes.data ?? []) as RecentTrial[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeProfile?.id]);

  const trialCountsBySlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of recent) {
      const k = toProgressionSlug(t.exercise_slug ?? '');
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [recent]);

  const registry = Object.values(CLINICAL_LADDER_REGISTRY);
  const stateBySlug = new Map(rows.map((r) => [toProgressionSlug(r.exercise_slug), r]));

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Progression State</h1>
        <p className="text-sm text-muted-foreground">
          Live <code>clinical_progression_state</code> rows for the active profile,
          joined against the ladder registry. Missing rows for played games = wiring bug.
        </p>
      </div>

      {!activeProfile?.id && (
        <Card><CardContent className="py-6 text-sm">Select a profile first.</CardContent></Card>
      )}

      {activeProfile?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {loading ? 'Loading…' : `${rows.length} persisted row(s) · ${recent.length} recent trial(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead>Ladder</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="w-[180px]">Progress</TableHead>
                  <TableHead>Support</TableHead>
                  <TableHead>Streak (✓ / ✗)</TableHead>
                  <TableHead>Recent trials</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registry.map((entry) => {
                  const slug = toProgressionSlug(entry.slug);
                  const row = stateBySlug.get(slug);
                  const trials = trialCountsBySlug.get(slug) ?? 0;
                  const stale = !row && trials > 0;
                  return (
                    <TableRow key={entry.slug} className={stale ? 'bg-destructive/5' : undefined}>
                      <TableCell className="font-mono text-xs">{entry.slug}</TableCell>
                      <TableCell>
                        <Badge variant={entry.status === 'full' ? 'default' : 'secondary'}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row ? <span>L{row.current_level} <span className="text-muted-foreground">(stable L{row.stable_level})</span></span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {row ? (
                          <div className="flex items-center gap-2">
                            <Progress value={Number(row.progress_pct)} className="h-2" />
                            <span className="text-xs tabular-nums w-10">{Math.round(Number(row.progress_pct))}%</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{row ? `+${row.support_baseline}` : '—'}</TableCell>
                      <TableCell className="text-xs">
                        {row ? `${row.consecutive_success_sessions} / ${row.consecutive_struggle_sessions}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {trials > 0 ? trials : <span className="text-muted-foreground">0</span>}
                        {stale && (
                          <Badge variant="destructive" className="ml-2">no state</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row ? new Date(row.last_updated_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground">
              Recent-trials column is computed from <code>adaptation_trial_logs</code> using the
              progression-namespace slug (see <code>exerciseSlugNormalizer</code>). A row marked
              <Badge variant="destructive" className="mx-1">no state</Badge>
              means trials are flowing but the progression hook never flushed — fix the wiring before adding content tiers.
            </p>
          </CardContent>
        </Card>
      )}

      <SelectorDiagnosticsCard />
      <MinimalPairsSelectorDiagnosticsCard />
      <FixSentenceSelectorDiagnosticsCard />
    </div>
  );
}

function FixSentenceSelectorDiagnosticsCard() {
  const diag = readFixSentenceSelectorDiagnostics() as null | {
    at: string;
    clinicalLevel: number;
    tier: string;
    reason: string;
    fallback: null | { reason: string; detail: string; skipped: boolean };
    diagnostics: {
      totalCandidates: number;
      poolSize: number;
      errorTypeCounts: Record<string, number>;
      verbMatched?: number;
    };
    sampleSentences: string[];
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fix Sentence — last content-selector decision (PR6)</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {!diag && (
          <p className="text-muted-foreground">
            No selector decision recorded in this tab yet. Start a Fix Sentence session at L4+ to populate.
          </p>
        )}
        {diag && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge>{diag.tier}</Badge>
              <Badge variant="secondary">{diag.reason}</Badge>
              {typeof diag.diagnostics.verbMatched === 'number' && (
                <Badge variant="outline">verb-matched: {diag.diagnostics.verbMatched}</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                clinical L{diag.clinicalLevel} · {new Date(diag.at).toLocaleString()}
              </span>
            </div>
            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Pool size:</span><span className="font-mono">{diag.diagnostics.poolSize}</span>
              <span>Total candidates:</span><span className="font-mono">{diag.diagnostics.totalCandidates}</span>
            </div>
            {diag.diagnostics.errorTypeCounts && (
              <div className="text-xs text-muted-foreground">
                Error types: {Object.entries(diag.diagnostics.errorTypeCounts).map(([k, v]) => `${k}=${v}`).join(' · ')}
              </div>
            )}
            {diag.fallback && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <div className="font-medium">Fallback: {diag.fallback.reason}</div>
                <div className="text-muted-foreground">{diag.fallback.detail}</div>
                <div className="mt-1">
                  Skipped tier:{' '}
                  <Badge variant={diag.fallback.skipped ? 'destructive' : 'secondary'}>
                    {String(diag.fallback.skipped)}
                  </Badge>
                </div>
              </div>
            )}
            <div className="text-xs">
              <span className="text-muted-foreground">Sample sentences: </span>
              <span className="font-mono">{diag.sampleSentences.join(' | ') || '—'}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MinimalPairsSelectorDiagnosticsCard() {
  const diag = readMinimalPairsSelectorDiagnostics() as null | {
    at: string;
    clinicalLevel: number;
    tier: string;
    reason: string;
    fallback: null | { reason: string; detail: string; skipped: boolean };
    diagnostics: {
      totalCandidates: number;
      poolSize: number;
      contrastClass?: string;
      signalCondition: string;
      classCounts?: Record<string, number>;
    };
    samplePairs: string[];
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Minimal Pairs — last content-selector decision (PR5)</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {!diag && (
          <p className="text-muted-foreground">
            No selector decision recorded in this tab yet. Start a Minimal Pairs session at L4+ to populate.
          </p>
        )}
        {diag && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge>{diag.tier}</Badge>
              <Badge variant="secondary">{diag.reason}</Badge>
              {diag.diagnostics.contrastClass && (
                <Badge variant="outline">class: {diag.diagnostics.contrastClass}</Badge>
              )}
              <Badge variant="outline">signal: {diag.diagnostics.signalCondition}</Badge>
              <span className="text-xs text-muted-foreground">
                clinical L{diag.clinicalLevel} · {new Date(diag.at).toLocaleString()}
              </span>
            </div>
            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Pool size:</span><span className="font-mono">{diag.diagnostics.poolSize}</span>
              <span>Total candidates:</span><span className="font-mono">{diag.diagnostics.totalCandidates}</span>
            </div>
            {diag.diagnostics.classCounts && (
              <div className="text-xs text-muted-foreground">
                Class counts: {Object.entries(diag.diagnostics.classCounts).map(([k, v]) => `${k}=${v}`).join(' · ')}
              </div>
            )}
            {diag.fallback && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <div className="font-medium">Fallback: {diag.fallback.reason}</div>
                <div className="text-muted-foreground">{diag.fallback.detail}</div>
                <div className="mt-1">
                  Skipped tier:{' '}
                  <Badge variant={diag.fallback.skipped ? 'destructive' : 'secondary'}>
                    {String(diag.fallback.skipped)}
                  </Badge>
                </div>
              </div>
            )}
            <div className="text-xs">
              <span className="text-muted-foreground">Sample pairs: </span>
              <span className="font-mono">{diag.samplePairs.join(', ') || '—'}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SelectorDiagnosticsCard() {
  const diag = readSelectorDiagnostics() as null | {
    at: string;
    clinicalLevel: number;
    tier: string;
    reason: string;
    fallback: null | { reason: string; detail: string; skipped: boolean };
    diagnostics: { totalCandidates: number; poolSize: number; distinctCategories: number; frequencyBand?: [number, number] };
    sampleTargets: string[];
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Photo Naming — last content-selector decision (PR4)</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {!diag && (
          <p className="text-muted-foreground">
            No selector decision recorded in this tab yet. Start a Photo Naming session at L4+ to populate.
          </p>
        )}
        {diag && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge>{diag.tier}</Badge>
              <Badge variant="secondary">{diag.reason}</Badge>
              <span className="text-xs text-muted-foreground">
                clinical L{diag.clinicalLevel} · {new Date(diag.at).toLocaleString()}
              </span>
            </div>
            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Pool size:</span><span className="font-mono">{diag.diagnostics.poolSize}</span>
              <span>Distinct categories:</span><span className="font-mono">{diag.diagnostics.distinctCategories}</span>
              {diag.diagnostics.frequencyBand && (
                <>
                  <span>Frequency band:</span>
                  <span className="font-mono">
                    [{diag.diagnostics.frequencyBand[0]}, {diag.diagnostics.frequencyBand[1]}]
                  </span>
                </>
              )}
            </div>
            {diag.fallback && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <div className="font-medium">Fallback: {diag.fallback.reason}</div>
                <div className="text-muted-foreground">{diag.fallback.detail}</div>
                <div className="mt-1">
                  Skipped tier:{' '}
                  <Badge variant={diag.fallback.skipped ? 'destructive' : 'secondary'}>
                    {String(diag.fallback.skipped)}
                  </Badge>
                </div>
              </div>
            )}
            <div className="text-xs">
              <span className="text-muted-foreground">Sample targets: </span>
              <span className="font-mono">{diag.sampleTargets.join(', ') || '—'}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
