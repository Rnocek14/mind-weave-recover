/**
 * Geometry-only target placement for Reach & Tap / Left-Side Hunt.
 * Screen dimensions and actual target centers determine left/center/right,
 * never the requested region. No clinical neglect or recovery inference.
 */
export type ReachTapSide = 'left' | 'center' | 'right';
export type ReachTapVariant = 'standard' | 'left-side-hunt';
export interface ReachTapPlacement {
  x: number;
  y: number;
  size: number;
  side: ReachTapSide;
}

export function placeReachTapTarget(args: {
  width: number;
  height: number;
  desiredSize: number;
  variant: ReachTapVariant;
  previous?: { x: number; y: number } | null;
  random?: () => number;
}): ReachTapPlacement | null {
  const { width, height, desiredSize, variant, previous } = args;
  if (![width, height, desiredSize].every(Number.isFinite) || width < 48 || height < 48) {
    return null; // no physically tappable 24px target can fit with padding
  }
  const padding = 12;
  const size = Math.min(
    Math.max(24, desiredSize),
    width - 2 * padding,
    height - 2 * padding,
  );
  if (size < 24) return null;

  const xMin = padding;
  const xMax = width - size - padding;
  const yMin = padding;
  const yMax = height - size - padding;
  const sample = () => {
    const value = args.random ? args.random() : Math.random();
    return Number.isFinite(value) ? Math.min(0.99999999, Math.max(0, value)) : 0.5;
  };
  const inRange = (min: number, max: number) => min + sample() * Math.max(0, max - min);
  const minJump = Math.hypot(width, height) * 0.3;

  let best: ReachTapPlacement | null = null;
  let farthest = -1;
  for (let attempt = 0; attempt < 10; attempt++) {
    let x: number;
    if (variant === 'left-side-hunt') {
      // Center of target lies in the left third for ~70% of draws. The old
      // (width/3 - targetSize) range became NEGATIVE on normal phone screens
      // when an easy large target was wider than a third of the play area.
      const leftMax = Math.max(xMin, Math.min(xMax, width / 3 - size / 2));
      const otherMin = Math.max(xMin, Math.min(xMax, width / 3 - size / 2));
      x = sample() < 0.7
        ? inRange(xMin, leftMax)
        : inRange(otherMin, xMax);
    } else {
      x = inRange(xMin, xMax);
    }
    const y = inRange(yMin, yMax);
    const centerX = x + size / 2;
    const candidate: ReachTapPlacement = {
      x,
      y,
      size,
      side: centerX <= width / 3 ? 'left'
        : centerX >= (width * 2) / 3 ? 'right' : 'center',
    };
    const distance = previous
      ? Math.hypot(x - previous.x, y - previous.y)
      : Number.POSITIVE_INFINITY;
    if (distance > farthest) { best = candidate; farthest = distance; }
    if (distance >= minJump) return candidate;
  }

  if (!best) return null;
  // Under deterministic or unusually clustered RNG, avoid freezing a target
  // in the same position. Prefer the far vertical edge without moving it
  // outside the actual available screen.
  if (previous && farthest < minJump && yMax > yMin) {
    const y = Math.abs(previous.y - yMin) > Math.abs(previous.y - yMax)
      ? yMin : yMax;
    return { ...best, y };
  }
  return best;
}
