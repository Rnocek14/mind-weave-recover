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
  /**
   * The whole session was answered by tapping, with no attempt to speak.
   * Recognition earns no expressive credit (progression spec §5.4), so the
   * bar cannot move — and telling the patient "your work still counts" would
   * be untrue. Say what would move it instead.
   */
  recognitionOnly?: boolean;
}

export const RECOGNITION_ONLY_HOLD_MESSAGE =
  'You found the right pictures. Saying each word out loud is what moves your level — tap I Said It if the microphone cannot hear you.';

export function PhotoNamingProgressionRecap({
  recognitionOnly,
  ...props
}: PhotoNamingProgressionRecapProps) {
  const displayLevel = props.leveledUp ? props.next.level : props.prev.level;
  const spec = getPhotoNamingLevelSpec(displayLevel);
  return (
    <ProgressionRecap
      gameTitle="Picture Naming"
      levelDescription={spec.description}
      holdMessage={recognitionOnly ? RECOGNITION_ONLY_HOLD_MESSAGE : undefined}
      {...props}
    />
  );
}
