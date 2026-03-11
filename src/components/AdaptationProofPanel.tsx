/**
 * Adaptation Proof Panel
 * 
 * Cross-game evidence table showing how the unified adaptation layer
 * is actually performing across all speech exercises.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  CheckCircle2, 
  Minus, 
  Fingerprint, 
  BarChart3,
  Zap,
} from 'lucide-react';
import { useAdaptationProof, type GameAdaptationRow } from '@/hooks/useAdaptationProof';
import { cn } from '@/lib/utils';

interface AdaptationProofPanelProps {
  userId: string;
  daysBack?: number;
}

const MODE_LABELS: Record<string, string> = {
  phoneme_targeting: 'Phoneme',
  cue_personalization: 'Cue',
  difficulty_only: 'Difficulty',
  profile_aware: 'Profile',
  none: 'None',
};

const MODE_COLORS: Record<string, string> = {
  phoneme_targeting: 'bg-primary/10 text-primary border-primary/20',
  cue_personalization: 'bg-accent/10 text-accent-foreground border-accent/20',
  difficulty_only: 'bg-secondary/50 text-secondary-foreground border-secondary',
  profile_aware: 'bg-muted text-muted-foreground border-muted',
  none: 'bg-muted/30 text-muted-foreground border-muted/50',
};

function formatSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getDominantMode(modes: Record<string, number>): string {
  const entries = Object.entries(modes).filter(([k]) => k !== 'none');
  if (entries.length === 0) return 'none';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export const AdaptationProofPanel = ({ userId, daysBack = 14 }: AdaptationProofPanelProps) => {
  const { summary, isLoading } = useAdaptationProof(userId, daysBack);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.totalTrials === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="w-4 h-4" />
            Adaptation Evidence
          </CardTitle>
          <CardDescription>No trial data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Play some exercises to see cross-game adaptation data here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKPI
          label="Adaptation Rate"
          value={`${Math.round(summary.overallAdaptationRate * 100)}%`}
          detail={`${summary.totalAdapted} / ${summary.totalTrials} trials`}
        />
        <MiniKPI
          label="Games Adapted"
          value={`${summary.gamesWithAdaptation} / ${summary.totalGames}`}
          detail="with active adaptation"
        />
        <MiniKPI
          label="Dominant Mode"
          value={MODE_LABELS[summary.dominantMode] || summary.dominantMode}
          detail="most common strategy"
        />
        <MiniKPI
          label="Window"
          value={`${daysBack}d`}
          detail={`${summary.totalTrials} total trials`}
        />
      </div>

      {/* Cross-game table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Cross-Game Adaptation Evidence
          </CardTitle>
          <CardDescription>
            How each exercise consumed the shared adaptation contract
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercise</TableHead>
                <TableHead className="text-center">Trials</TableHead>
                <TableHead className="text-center">Adapted</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Focus Phonemes</TableHead>
                <TableHead>Cue</TableHead>
                <TableHead className="text-center">Difficulty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map(row => (
                <GameRow key={row.exerciseSlug} row={row} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const GameRow = ({ row }: { row: GameAdaptationRow }) => {
  const dominantMode = getDominantMode(row.adaptationModes);
  const dominantCue = Object.entries(row.cueTypesRecommended)
    .filter(([k]) => k !== 'none')
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const diffLevels = Object.keys(row.difficultyLevels).map(Number).sort();
  const adapted = row.adaptedTrials > 0;

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">
        <div className="flex items-center gap-2">
          {adapted ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          ) : (
            <Minus className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          )}
          {formatSlug(row.exerciseSlug)}
        </div>
      </TableCell>
      <TableCell className="text-center text-sm">{row.totalTrials}</TableCell>
      <TableCell className="text-center text-sm">
        <span className={cn(
          adapted ? 'text-primary font-medium' : 'text-muted-foreground'
        )}>
          {Math.round(row.adaptationRate * 100)}%
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('text-xs', MODE_COLORS[dominantMode] || '')}>
          {MODE_LABELS[dominantMode] || dominantMode}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {row.focusPhonemesUsed.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.focusPhonemesUsed.slice(0, 4).map(p => (
              <Badge key={p} variant="secondary" className="text-xs px-1.5 py-0">
                /{p}/
              </Badge>
            ))}
            {row.focusPhonemesUsed.length > 4 && (
              <span className="text-xs text-muted-foreground">+{row.focusPhonemesUsed.length - 4}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {dominantCue ? (
          <Badge variant="outline" className="text-xs">
            {dominantCue}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm">
        {diffLevels.length > 1 ? (
          <span className="flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            {diffLevels[0]}–{diffLevels[diffLevels.length - 1]}
          </span>
        ) : (
          <span className="text-muted-foreground">{diffLevels[0] ?? '—'}</span>
        )}
      </TableCell>
    </TableRow>
  );
};

const MiniKPI = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <Card className="p-3">
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-xl font-bold mt-1">{value}</p>
    <p className="text-xs text-muted-foreground">{detail}</p>
  </Card>
);
