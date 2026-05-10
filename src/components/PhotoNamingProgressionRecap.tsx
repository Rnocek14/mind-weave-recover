/**
 * PhotoNamingProgressionRecap — thin Photo-Naming-flavored wrapper around the
 * generic `ProgressionRecap` component. The shared component is the source of
 * truth; this wrapper exists so PhotoNamingGame keeps its existing import +
 * call shape (no per-game props duplication beyond the level lookup).
 */

import { ProgressionRecap } from '@/components/ProgressionRecap';
import { getPhotoNamingLevelSpec } from '@/lib/progression/photoNamingLevels';

export interface PhotoNamingProgressionRecapProps {
  prev: { level: number; progressPct: number };
  next: { level: number; progressPct: number };
  leveledUp: boolean;
  onContinue: () => void;
  autoAdvanceMs?: number;
}

export function PhotoNamingProgressionRecap(props: PhotoNamingProgressionRecapProps) {
  const displayLevel = props.leveledUp ? props.next.level : props.prev.level;
  const spec = getPhotoNamingLevelSpec(displayLevel);
  return (
    <ProgressionRecap
      gameTitle="Picture Naming"
      levelDescription={spec.description}
      {...props}
    />
  );
}
