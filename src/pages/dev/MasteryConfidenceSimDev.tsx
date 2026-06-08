/**
 * /dev/mastery-confidence-sim — Phase A.1 (Mastery Visibility), admin-gated.
 *
 * Runs the four longitudinal archetypes through the REAL `computeMastery`
 * scorer (same chaining production uses) and visualizes the per-session
 * confidence / mastery / cue-independence trajectory.
 *
 * VISIBILITY ONLY. No gating, no progression, no DB writes. This page exists
 * to answer "does confidence behave sensibly?" before A.2 (influence) and
 * A.3 (enforcement).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  runAllMasteryConfidenceSims,
  CONFIDENCE_RANK,
  type MasteryTrajectory,
  type MasterySessionSnapshot,
} from '@/lib/mastery/masteryConfidenceSim';

const CONFIDENCE_COLOR: Record<string, string> = {
  none: 'bg-muted text-muted-foreground',
  low: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  medium: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  high: 'bg-green-500/15 text-green-700 border-green-500/30',
};

export default function MasteryConfidenceSimDev() {
  const [seed, setSeed] = useState(7);
  const [sessions, setSessions] = useState(30);

  const trajectories = useMemo(
    () => runAllMasteryConfidenceSims(sessions, seed),
    [seed, sessions],
  );

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Mastery Confidence — Visibility Harness</h1>
        <p className="text-sm text-muted-foreground">
          Phase A.1. Drives the real <code>computeMastery</code> scorer across
          four longitudinal archetypes. No gating, no progression, no writes —
          this only validates that confidence behaves sensibly before it is
          allowed to influence promotion.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>
            Re-seed (current: {seed})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSessions((n) => (n === 30 ? 45 : n === 45 ? 20 : 30))}
          >
            Sessions: {sessions}
          </Button>
        </div>
      </header>

      <Tabs defaultValue={trajectories[0]?.archetype}>
        <TabsList className="flex flex-wrap h-auto">
          {trajectories.map((t) => (
            <TabsTrigger key={t.archetype} value={t.archetype} className="gap-2">
              {t.label}
              <Badge variant="outline" className={CONFIDENCE_COLOR[t.peakConfidence]}>
                peak: {t.peakConfidence}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {trajectories.map((t) => (
          <TabsContent key={t.archetype} value={t.archetype} className="space-y-4">
            <TrajectoryCard trajectory={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TrajectoryCard({ trajectory }: { trajectory: MasteryTrajectory }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{trajectory.label}</span>
          <div className="flex items-center gap-2 text-xs font-normal">
            <span className="text-muted-foreground">final mastery</span>
            <Badge variant="secondary">
              {(trajectory.final.masteryScore * 100).toFixed(0)}%
            </Badge>
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{trajectory.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ConfidenceStrip snapshots={trajectory.snapshots} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Session</th>
                <th>Confidence</th>
                <th>Mastery</th>
                <th>Cue indep.</th>
                <th>Accuracy</th>
                <th>Trials (14d)</th>
                <th>Plateau</th>
                <th>Support trend</th>
              </tr>
            </thead>
            <tbody>
              {trajectory.snapshots.map((s) => (
                <tr key={s.sessionIndex} className="border-t">
                  <td className="py-1">{s.sessionIndex}</td>
                  <td>
                    <Badge variant="outline" className={CONFIDENCE_COLOR[s.confidence]}>
                      {s.confidence}
                    </Badge>
                  </td>
                  <td>{(s.masteryScore * 100).toFixed(0)}%</td>
                  <td>{s.cueIndependence != null ? (s.cueIndependence * 100).toFixed(0) + '%' : '—'}</td>
                  <td>{s.accuracyRecent != null ? (s.accuracyRecent * 100).toFixed(0) + '%' : '—'}</td>
                  <td>{s.trialsTotal}</td>
                  <td>{s.plateauFlag ? <Badge variant="destructive">plateau</Badge> : '—'}</td>
                  <td>{s.supportTrend ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** Simple sparkline of mastery score with confidence-coloured bars. */
function ConfidenceStrip({ snapshots }: { snapshots: MasterySessionSnapshot[] }) {
  return (
    <div className="flex items-end gap-0.5 h-24 border-b border-l p-1">
      {snapshots.map((s) => {
        const colorVar =
          CONFIDENCE_RANK[s.confidence] >= CONFIDENCE_RANK.high
            ? 'hsl(var(--primary))'
            : CONFIDENCE_RANK[s.confidence] >= CONFIDENCE_RANK.medium
            ? 'hsl(217 91% 60%)'
            : CONFIDENCE_RANK[s.confidence] >= CONFIDENCE_RANK.low
            ? 'hsl(38 92% 50%)'
            : 'hsl(var(--muted-foreground))';
        return (
          <div
            key={s.sessionIndex}
            className="flex-1 rounded-t"
            style={{
              height: `${Math.max(4, s.masteryScore * 100)}%`,
              backgroundColor: colorVar,
            }}
            title={`s${s.sessionIndex} · ${s.confidence} · mastery ${(s.masteryScore * 100).toFixed(0)}%`}
          />
        );
      })}
    </div>
  );
}
