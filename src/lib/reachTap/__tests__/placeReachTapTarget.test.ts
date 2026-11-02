import { describe, expect, it } from 'vitest';
import { placeReachTapTarget } from '@/lib/reachTap/placeReachTapTarget';

describe('Reach & Tap target placement on stroke-patient screens', () => {
  for (const width of [120, 180, 280, 320, 390, 640]) {
    it(`keeps a large target inside a narrow ${width}px screen`, () => {
      for (const variant of ['standard', 'left-side-hunt'] as const) {
        for (const seed of [0, 0.4, 0.8, 0.999999, Number.NaN]) {
          const placed = placeReachTapTarget({
            width, height: 350, desiredSize: 130, variant, random: () => seed,
          });
          expect(placed).not.toBeNull();
          expect(placed!.size).toBeGreaterThanOrEqual(24);
          expect(placed!.x).toBeGreaterThanOrEqual(12);
          expect(placed!.y).toBeGreaterThanOrEqual(12);
          expect(placed!.x + placed!.size).toBeLessThanOrEqual(width - 12 + 0.001);
          expect(placed!.y + placed!.size).toBeLessThanOrEqual(350 - 12 + 0.001);
          const center = placed!.x + placed!.size / 2;
          const actualSide = center <= width / 3 ? 'left'
            : center >= width * 2 / 3 ? 'right' : 'center';
          expect(placed!.side).toBe(actualSide);
        }
      }
    });
  }

  it('biases left without negative X coordinates on a 320px display', () => {
    const placed = placeReachTapTarget({
      width: 320, height: 440, desiredSize: 130, variant: 'left-side-hunt',
      random: () => 0,
    });
    expect(placed!.side).toBe('left');
    expect(placed!.x).toBeGreaterThanOrEqual(12);
  });

  it('does not claim a left-side observation if the actual center is not left', () => {
    const placed = placeReachTapTarget({
      width: 120, height: 120, desiredSize: 72,
      variant: 'left-side-hunt', random: () => 0,
    });
    expect(placed!.side).toBe('center');
  });

  it('uses bounded retries and avoids a stationary target under unlucky RNG', () => {
    const first = placeReachTapTarget({
      width: 320, height: 440, desiredSize: 80,
      variant: 'standard', random: () => 0,
    })!;
    const next = placeReachTapTarget({
      width: 320, height: 440, desiredSize: 80,
      variant: 'standard', random: () => 0, previous: first,
    })!;
    expect(next.x === first.x && next.y === first.y).toBe(false);
  });

  it('abstains when the game area cannot physically fit a target', () => {
    expect(placeReachTapTarget({
      width: 0, height: 300, desiredSize: 130, variant: 'standard',
    })).toBeNull();
    expect(placeReachTapTarget({
      width: 40, height: 40, desiredSize: 130, variant: 'standard',
    })).toBeNull();
  });
});
