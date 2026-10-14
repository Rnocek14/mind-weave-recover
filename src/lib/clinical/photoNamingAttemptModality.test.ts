import { describe, expect, it } from 'vitest';
import { resolvePhotoNamingTrialMode } from './photoNamingAttemptModality';

describe('Photo Naming response channel', () => {
  it('preserves independent speech mode', () => {
    expect(resolvePhotoNamingTrialMode('production', false)).toBe('production');
    expect(resolvePhotoNamingTrialMode('production', true)).toBe('production');
  });
  it('does not claim a pure chip response was spoken independently', () => {
    expect(resolvePhotoNamingTrialMode('recognition', false)).toBe('recognition');
  });
  it('calls a chip after attempted speech assisted, not independent', () => {
    expect(resolvePhotoNamingTrialMode('recognition', true)).toBe('scaffolded');
  });
});
