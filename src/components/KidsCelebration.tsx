import { useMemo } from "react";

/**
 * Emoji confetti burst shown on correct answers in Kids Mode.
 * Pure CSS animation (see .kids-burst in index.css) — no libraries, no
 * timers, unmounts with its parent feedback block.
 */
const BURST_EMOJI = ["⭐", "🌟", "🎉", "✨", "🎈", "🌈"];
const STREAK_EMOJI = ["🔥", "⭐", "🌟", "🎉", "✨", "🎆", "🎇", "🌈"];
const PARTICLES = 8;
const STREAK_PARTICLES = 14;

interface KidsCelebrationProps {
  /** Re-keys the burst so it replays for each new correct answer. */
  burstKey: string | number;
  /** Streak mode: more particles, wider flight, fire emoji mixed in. */
  intense?: boolean;
}

export function KidsCelebration({ burstKey, intense = false }: KidsCelebrationProps) {
  const particles = useMemo(
    () => {
      const count = intense ? STREAK_PARTICLES : PARTICLES;
      const emoji = intense ? STREAK_EMOJI : BURST_EMOJI;
      const spread = intense ? 100 : 60;
      return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const distance = spread + Math.random() * 50;
        return {
          emoji: emoji[i % emoji.length],
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 30,
          rot: (Math.random() - 0.5) * 90,
          delay: Math.random() * 0.12,
        };
      });
    },
    // Recompute per burst so each celebration looks a little different
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, intense],
  );

  return (
    <div className="kids-burst" aria-hidden key={burstKey}>
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            "--burst-x": `${p.x}px`,
            "--burst-y": `${p.y}px`,
            "--burst-rot": `${p.rot}deg`,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
