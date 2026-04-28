import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  runSimulation,
  type SimulationResult,
} from '@/lib/simulation/sessionSimulator';
import { USER_PROFILES, type ProfileId } from '@/lib/simulation/userProfiles';
import { SimulationChart } from '@/components/dev/SimulationChart';

/**
 * Dev-only validation harness. Run multiple patient archetypes through the
 * real adaptation engine and inspect difficulty / cue / engagement trajectories.
 *
 * Route: /dev/adaptation-sim
 */
export default function AdaptationSimDev() {
  const [seed, setSeed] = useState(1);
  const [trials, setTrials] = useState(40);

  const results: Array<{ id: ProfileId; label: string; result: SimulationResult }> = useMemo(() => {
    return USER_PROFILES.map((p) => ({
      id: p.id,
      label: p.label,
      result: runSimulation({ profileId: p.id, seed, trials }),
    }));
  }, [seed, trials]);

  const overall = useMemo(() => {
    const totalAssertions = results.reduce(
      (acc, r) => acc + r.result.assertions.passed.length + r.result.assertions.failed.length,
      0,
    );
    const failed = results.reduce((acc, r) => acc + r.result.assertions.failed.length, 0);
    const inconsistencies = results.reduce(
      (acc, r) => acc + r.result.assertions.inconsistencies.length,
      0,
    );
    return { totalAssertions, failed, inconsistencies };
  }, [results]);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Adaptation Validation Harness</h1>
        <p className="text-sm text-muted-foreground">
          Runs synthetic patient profiles through the real adaptive engine
          (controller + engagement monitor + cue-dependency gate + narrator).
          No data is written. Refresh to re-seed.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>
            Re-seed (current: {seed})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTrials((t) => (t === 40 ? 50 : t === 50 ? 30 : 40))}
          >
            Trials: {trials}
          </Button>
          <Badge variant={overall.failed === 0 ? 'default' : 'destructive'}>
            {overall.totalAssertions - overall.failed}/{overall.totalAssertions} assertions passed
          </Badge>
          {overall.inconsistencies > 0 && (
            <Badge variant="secondary">{overall.inconsistencies} inconsistencies</Badge>
          )}
        </div>
      </header>

      <Tabs defaultValue={results[0]?.id}>
        <TabsList className="flex flex-wrap h-auto">
          {results.map((r) => {
            const failed = r.result.assertions.failed.length;
            return (
              <TabsTrigger key={r.id} value={r.id} className="gap-2">
                {r.label}
                <Badge variant={failed === 0 ? 'default' : 'destructive'} className="ml-1">
                  {failed === 0 ? 'OK' : `${failed} fail`}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {results.map(({ id, label, result }) => (
          <TabsContent key={id} value={id} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {USER_PROFILES.find((p) => p.id === id)?.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <SummaryGrid result={result} />
                <SimulationChart log={result.log} />
                <AssertionsList result={result} />
                <NarrationLog result={result} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SummaryGrid({ result }: { result: SimulationResult }) {
  const s = result.summary;
  const items: Array<[string, string | number]> = [
    ['Trials', s.totalTrials],
    ['Final difficulty', s.finalDifficulty],
    ['Difficulty range', `${s.minDifficulty} → ${s.maxDifficulty}`],
    ['Up changes', s.upChanges],
    ['Down changes', s.downChanges],
    ['Blocked escalations', s.blockedEscalations],
    ['Final success rate', `${(s.finalSuccessRate * 100).toFixed(0)}%`],
    ['Final cue dependency', s.finalCueDependency.toFixed(2)],
    ['Peak frustration', s.peakFrustration],
    ['Peak fatigue', s.peakFatigue],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="rounded border p-2">
          <div className="text-muted-foreground text-xs">{k}</div>
          <div className="font-medium">{v}</div>
        </div>
      ))}
    </div>
  );
}

function AssertionsList({ result }: { result: SimulationResult }) {
  const { passed, failed, inconsistencies } = result.assertions;
  return (
    <div className="space-y-2">
      <div className="font-semibold text-sm">Assertions</div>
      <ul className="space-y-1 text-sm">
        {passed.map((a) => (
          <li key={a.id} className="text-green-700">✓ {a.description}</li>
        ))}
        {failed.map((a) => (
          <li key={a.id} className="text-red-700">
            ✗ {a.description}
            {a.detail ? <span className="block text-xs opacity-80">{a.detail}</span> : null}
          </li>
        ))}
      </ul>
      {inconsistencies.length > 0 && (
        <div className="text-sm">
          <div className="font-semibold mt-2">Inconsistencies</div>
          <ul className="list-disc pl-5 text-amber-700">
            {inconsistencies.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NarrationLog({ result }: { result: SimulationResult }) {
  const events = result.log.filter((l) => l.difficultyChange || l.escalationBlocked);
  if (events.length === 0) {
    return <div className="text-sm text-muted-foreground">No adaptation events.</div>;
  }
  return (
    <div className="space-y-1">
      <div className="font-semibold text-sm">Adaptation events</div>
      <ul className="text-xs space-y-1 font-mono">
        {events.map((e) => (
          <li key={e.trialIndex} className="border-l-2 pl-2 border-muted">
            <span className="text-muted-foreground">t{e.trialIndex}:</span>{' '}
            {e.escalationBlocked ? (
              <span className="text-amber-700">
                BLOCKED · "{e.difficultyChange?.narration}" — {e.escalationBlocked.reason}
              </span>
            ) : (
              <span>
                {e.difficultyChange?.direction.toUpperCase()} {e.difficultyChange?.from}→
                {e.difficultyChange?.to} · "{e.difficultyChange?.narration}" ({e.difficultyChange?.reason})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
