/**
 * Photo Naming — chip-tap support resolution after ASR silence.
 *
 * Regression for the "false struggle session" bug: when the mic was active
 * and ASR returned silence/no_response, a subsequent correct chip tap was
 * being mapped to `recognition_only`. The longitudinal progression layer
 * then correctly treated the entire session as 100% struggle, blocking
 * progress credit for trials that involved real production attempts.
 *
 * Contract:
 *   - chip tap with no production attempt → `recognition_only`
 *   - chip tap after a production attempt (mic open / silence) →
 *     scaffolded production (NEVER `recognition_only`); minimum
 *     `semantic_cue` even if cueLevel was 0.
 *   - a session of all-correct chip recoveries must NOT be classified as
 *     100% struggle solely because the user fell back to chips.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolvePhotoNamingChipSupport, resolvePhotoNamingTrialMode } from '@/hooks/usePhotoNamingProgression';
import { applySessionToState, defaultProgressionState } from '@/lib/progression/clinicalProgression';

describe('Photo Naming chip recovery support mapping', () => {
  it('pure recognition tap (no production attempt) stays recognition_only', () => {
    expect(
      resolvePhotoNamingChipSupport({ productionAttempted: false, cueLevel: 0 })
    ).toBe('recognition_only');
  });

  it('chip tap after mic-silence is NOT recognition_only', () => {
    const support = resolvePhotoNamingChipSupport({
      productionAttempted: true,
      cueLevel: 0,
    });
    expect(support).not.toBe('recognition_only');
    // Floor at semantic_cue — chips reveal lexical target without phonemic info.
    expect(support).toBe('semantic_cue');
  });

  it('chip tap after production attempt with phonemic cue uses phonemic_cue', () => {
    expect(
      resolvePhotoNamingChipSupport({ productionAttempted: true, cueLevel: 2 })
    ).toBe('phonemic_cue');
  });

  it('all-correct chip recoveries do not produce a 100% struggle session', () => {
    const prev = defaultProgressionState({
      userId: 'u',
      profileId: 'p',
      exerciseSlug: 'photo-naming',
    });
    const trials = Array.from({ length: 9 }, () => ({
      correct: true,
      support: resolvePhotoNamingChipSupport({
        productionAttempted: true,
        cueLevel: 0,
      }),
    }));
    const next = applySessionToState(prev, { trials, evidenceMet: false });
    // Bug repro: previously this incremented consecutiveStruggleSessions on every
    // session because every trial was recognition_only. With the fix, scaffolded
    // production trials must not trigger the all-struggle classification.
    expect(next.consecutiveStruggleSessions).toBeLessThanOrEqual(
      prev.consecutiveStruggleSessions
    );
  });
});

describe('resolvePhotoNamingTrialMode — the record agrees with the ladder', () => {
  it('a plain chip tap (no production attempted) is a recognition trial', () => {
    const support = resolvePhotoNamingChipSupport({ productionAttempted: false, cueLevel: 0 });
    expect(support).toBe('recognition_only');
    expect(resolvePhotoNamingTrialMode({ inputMode: 'recognition', support })).toBe('recognition');
  });

  it('a chip tap after an attempted production the mic could not score is scaffolded, as the ladder credits it', () => {
    const support = resolvePhotoNamingChipSupport({ productionAttempted: true, cueLevel: 0 });
    expect(support).toBe('semantic_cue');
    expect(resolvePhotoNamingTrialMode({ inputMode: 'recognition', support })).toBe('scaffolded');
  });

  it('a spoken answer is production whatever cue it needed', () => {
    expect(resolvePhotoNamingTrialMode({ inputMode: 'production', support: 'independent' })).toBe('production');
    expect(resolvePhotoNamingTrialMode({ inputMode: 'production', support: 'phonemic_cue' })).toBe('production');
  });
});

describe('productionAttempted is evidence of speech, not an open microphone', () => {
  // The mic auto-starts on every trial. Keying the flag off isListening made
  // every silent tap "scaffolded production" (semantic_cue, credit 0.6), so a
  // patient who never spoke could climb the expressive ladder on taps alone.
  const src = readFileSync('src/components/PhotoNamingGame.tsx', 'utf8');

  it('the flag is no longer set from isListening', () => {
    expect(src).not.toMatch(/if \(isListening\) productionAttemptedRef\.current = true/);
  });

  it('the flag is set where the recognizer delivers the patient\'s speech', () => {
    const start = src.indexOf('const handleSpeechResult = useCallback(');
    const body = src.slice(start, src.indexOf('}, [', start));
    expect(start).toBeGreaterThan(0);
    expect(body).toMatch(/productionAttemptedRef\.current = true/);
  });

  it('a gated tap reaches a progression ladder only as recognition_only', () => {
    const sub = readFileSync('src/hooks/useTrialSubmission.ts', 'utf8');
    expect(sub).toMatch(/validity === 'recognition_response' \? 'recognition_only' : input\.supportUsed/);
    expect(sub).toMatch(/support: bufferedSupport/);
  });
});
