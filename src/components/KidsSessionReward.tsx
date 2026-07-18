import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useKidsSounds } from '@/hooks/useKidsSounds';
import { awardPetXp, loadPet, type KidsPetState } from '@/lib/kidsPet';
import { PetDisplay } from '@/components/kids/PetDisplay';

/**
 * Kids Mode session-end reward overlay: the session's stars bounce in one by
 * one, a badge is awarded by accuracy, and a running all-time star count
 * (device-local, no telemetry) gives kids a collection to grow. Shown on top
 * of the normal completion flow; dismissing reveals the standard recap.
 */

import { scopedKey } from '@/lib/deviceStore';

const TOTAL_STARS_KEY = 'kidsMode_totalStars';

function readTotalStars(): number {
  try {
    const v = parseInt(localStorage.getItem(scopedKey(TOTAL_STARS_KEY)) ?? '0', 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

function badgeFor(earned: number, total: number): { title: string; emoji: string } {
  const pct = total > 0 ? earned / total : 0;
  if (pct >= 0.8) return { title: 'Word Wizard!', emoji: '🧙' };
  if (pct >= 0.5) return { title: 'Star Explorer!', emoji: '🚀' };
  return { title: 'Super Tryer!', emoji: '💪' };
}

interface KidsSessionRewardProps {
  starsEarned: number;
  totalTrials: number;
  onContinue: () => void;
}

export function KidsSessionReward({ starsEarned, totalTrials, onContinue }: KidsSessionRewardProps) {
  const { playKidsFanfare } = useKidsSounds();
  const [allTimeStars, setAllTimeStars] = useState<number | null>(null);
  const [pet, setPet] = useState<KidsPetState | null>(null);
  const [petLeveled, setPetLeveled] = useState(false);
  const bankedRef = useRef(false);

  // Bank the stars exactly once (StrictMode-safe via ref guard).
  useEffect(() => {
    if (bankedRef.current) return;
    bankedRef.current = true;
    const total = readTotalStars() + starsEarned;
    try {
      localStorage.setItem(scopedKey(TOTAL_STARS_KEY), String(total));
    } catch {
      /* storage unavailable — still show this session's stars */
    }
    setAllTimeStars(total);
    // Every Kids Mode session with at least one star feeds the practice pet.
    // Zero-star sessions still show the pet but don't advance the streak —
    // the streak must keep meaning "practiced meaningfully".
    if (starsEarned > 0) {
      const petResult = awardPetXp(starsEarned);
      setPet(petResult.pet);
      setPetLeveled(petResult.leveledUp);
    } else {
      setPet(loadPet());
    }
    playKidsFanfare();
  }, [starsEarned, playKidsFanfare]);

  const badge = badgeFor(starsEarned, totalTrials);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Session complete"
    >
      <div className="w-full max-w-sm rounded-3xl border-2 border-primary/30 bg-card shadow-glow p-6 text-center space-y-4">
        <p className="text-lg font-semibold text-muted-foreground">All done!</p>

        {/* Session stars bounce in one by one */}
        <div className="flex flex-wrap items-center justify-center gap-1" aria-label={`${starsEarned} of ${totalTrials} stars`}>
          {Array.from({ length: totalTrials }, (_, i) => (
            <span
              key={i}
              className={
                i < starsEarned
                  ? 'text-3xl kids-star-pop'
                  : 'text-3xl opacity-25 grayscale'
              }
              style={i < starsEarned ? { animationDelay: `${i * 0.15}s`, animationFillMode: 'backwards' } : undefined}
              aria-hidden
            >
              ⭐
            </span>
          ))}
        </div>

        <div className="space-y-1">
          <div className="text-5xl" aria-hidden>{badge.emoji}</div>
          <p className="text-2xl font-bold text-primary">{badge.title}</p>
          <p className="text-sm text-muted-foreground">
            You earned {starsEarned} {starsEarned === 1 ? 'star' : 'stars'} this game!
          </p>
        </div>

        {allTimeStars !== null && allTimeStars > starsEarned && (
          <p className="text-sm font-medium rounded-full bg-accent/20 text-accent-foreground px-3 py-1.5 inline-block">
            🏆 {allTimeStars} stars collected in all!
          </p>
        )}

        {/* Practice pet grows with every session */}
        {pet && (
          <div className="rounded-2xl bg-muted/50 p-3">
            {petLeveled && (
              <p className="text-sm font-bold text-secondary mb-1">✨ Your pet grew! ✨</p>
            )}
            <PetDisplay pet={pet} celebrate={petLeveled} />
          </div>
        )}

        <Button size="lg" className="w-full text-base font-bold rounded-2xl" onClick={onContinue}>
          Keep Going! →
        </Button>
      </div>
    </div>
  );
}
