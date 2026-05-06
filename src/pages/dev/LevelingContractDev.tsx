/**
 * /dev/leveling-contract — Admin-only audit view of the Per-Game Leveling
 * Contract registry.
 *
 * Read-only. Does NOT touch the in-game adaptation engine, the mastery
 * shadow layer, or any patient-facing surface. Pure visualization of
 * `src/lib/leveling/perGameContracts.ts`.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PER_GAME_CONTRACTS,
  PER_GAME_CONTRACTS_VERSION,
  type PerGameLevelingContract,
} from '@/lib/leveling/perGameContracts';

const READINESS_VARIANT: Record<
  PerGameLevelingContract['contentReadiness'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  ready: 'default',
  needs_bank_expansion: 'secondary',
  needs_tier_tagging: 'outline',
  shadow_only: 'destructive',
};

const RISK_VARIANT: Record<
  PerGameLevelingContract['wiringRisk'],
  'default' | 'secondary' | 'destructive'
> = {
  low: 'default',
  medium: 'secondary',
  high: 'destructive',
};

export default function LevelingContractDev() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const contracts = useMemo(() => {
    const all = Object.values(PER_GAME_CONTRACTS);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.slug.includes(q) ||
        c.contentReadiness.includes(q) ||
        c.wiringRisk.includes(q),
    );
  }, [query]);

  const counts = useMemo(() => {
    const all = Object.values(PER_GAME_CONTRACTS);
    return {
      total: all.length,
      ready: all.filter((c) => c.contentReadiness === 'ready').length,
      needsContent: all.filter((c) => c.contentReadiness !== 'ready').length,
      lowRisk: all.filter((c) => c.wiringRisk === 'low').length,
    };
  }, []);

  const detail = selected ? PER_GAME_CONTRACTS[selected] : null;

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Per-Game Leveling Contract</h1>
          <p className="text-sm text-muted-foreground">
            Spec registry — version {PER_GAME_CONTRACTS_VERSION}. Read-only.
            Not consumed by runtime.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">← Admin</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Games" value={counts.total} />
        <StatCard label="Ready to wire" value={counts.ready} />
        <StatCard label="Need content work" value={counts.needsContent} />
        <StatCard label="Low wiring risk" value={counts.lowRisk} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Contracts</CardTitle>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by slug, readiness, risk…"
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game</TableHead>
                <TableHead>Internal scale</TableHead>
                <TableHead>Fast climb</TableHead>
                <TableHead>Hard regression</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow
                  key={c.slug}
                  className="cursor-pointer"
                  onClick={() => setSelected(c.slug)}
                >
                  <TableCell className="font-medium">{c.slug}</TableCell>
                  <TableCell>
                    {c.internalScale.min}–{c.internalScale.max}
                  </TableCell>
                  <TableCell className="text-sm">
                    ≤L{c.fastClimb.upToLevel} after{' '}
                    {c.fastClimb.consecutiveStrongTrials} strong
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.hardRegression.minPoorSessions}+ poor sessions, cue
                    indep &lt; {c.hardRegression.cueIndependenceFloor}
                  </TableCell>
                  <TableCell>
                    <Badge variant={READINESS_VARIANT[c.contentReadiness]}>
                      {c.contentReadiness.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={RISK_VARIANT[c.wiringRisk]}>
                      {c.wiringRisk}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {detail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{detail.slug}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Section title="Difficulty drivers">
              <ChipList items={detail.difficultyDrivers} />
            </Section>
            <Section title="Support drivers">
              <ChipList items={detail.supportDrivers} />
            </Section>
            <Section title="Progress weights">
              <pre className="text-xs bg-muted p-2 rounded">
                {JSON.stringify(detail.progressWeights, null, 2)}
              </pre>
            </Section>
            {detail.notes && (
              <Section title="Notes">
                <p className="text-muted-foreground">{detail.notes}</p>
              </Section>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <Badge key={it} variant="outline">
          {it}
        </Badge>
      ))}
    </div>
  );
}
