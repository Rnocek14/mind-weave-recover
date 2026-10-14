import { describe, expect, it } from 'vitest';
import { resolvePhotoNamingTrialMode } from './photoNamingAttemptModality';

describe('Photo Naming clinical attempt provenance', () => {
  it('records a spoken response as production', () => {
    expect(resolvePhotoNamingTrialMode('production', false)).toBe('production');
    expect(resolvePhotoNamingTrialMode('production', true)).toBe('production');
  });

  it('records a chip-only response as recognition, not independent speech', () => {
    expect(resolvePhotoNamingTrialMode('recognition', false)).toBe('recognition');
  });

  it('records a choice after an attempted spoken response as scaffolded', () => {
    expect(resolvePhotoNamingTrialMode('recognition', true)).toBe('scaffolded');
  });
});
