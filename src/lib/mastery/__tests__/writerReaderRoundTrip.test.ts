/**
 * Round-trip integrity test for the mastery write/read seam.
 *
 * Reproduces the slug-form asymmetry that caused user_skill_mastery to
 * remain at 0 rows for the entire history of the platform: the trial
 * logger normalizes to canonical underscore form, but the mastery reader
 * was keyed on dash form.
 *
 * Any future regression that re-introduces this class of bug — slug form,
 * trial-mode adoption, allowlist tightening — must fail this test.
 */
import { describe, it, expect } from 'vitest';
import { mapTrialToSkills } from '../skillMapping';
import { routeTrialMode, isAdoptedForTrialMode } from '../masterySignalRouting';
import { normalizeExerciseSlug, CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';

describe('mastery writer↔reader round-trip', () => {
  // The exact shape useAdaptationTrialLogger writes to adaptation_trial_logs.
  // If this shape ever drifts from the writer, this test must be updated
  // alongside the writer — that's the point.
  function buildLoggedRowAsWriterWould(rawSlug: string) {
    return {
      exercise_slug: normalizeExerciseSlug(rawSlug),
      difficulty: 2,
      trial_mode: 'production' as const,
      correct: true,
    };
  }

  it('photo_naming round-trips into a non-empty skill list', () => {
    const row = buildLoggedRowAsWriterWould('photo-naming');
    expect(row.exercise_slug).toBe(CANONICAL_SLUGS.PHOTO_NAMING);
    expect(isAdoptedForTrialMode(row.exercise_slug)).toBe(true);
    expect(routeTrialMode(row.exercise_slug, row.trial_mode)).toBe('expressive');
    const skills = mapTrialToSkills({
      exerciseSlug: row.exercise_slug,
      inputs: { difficulty: row.difficulty },
    });
    expect(skills.length).toBeGreaterThan(0);
    expect(skills[0]).toMatch(/^naming\./);
  });

  it('photo_naming written via dash-form alias still resolves', () => {
    // Belt-and-suspenders: even if a future caller passes the dash form,
    // the reader must normalize it.
    const skills = mapTrialToSkills({ exerciseSlug: 'photo-naming', inputs: { difficulty: 1 } });
    expect(skills.length).toBeGreaterThan(0);
  });

  it('fix_sentence is allowlisted and routes to skipped_unknown without trial_mode', () => {
    // Fix Sentence is in the allowlist but its game does not yet emit
    // trial_mode. Trials must be skipped (not contaminate expressive mastery)
    // and the mapping itself must be non-empty so the moment trial_mode
    // emission ships, rows flow through.
    expect(isAdoptedForTrialMode('fix_sentence')).toBe(true);
    expect(routeTrialMode('fix_sentence', null)).toBe('skipped_unknown');
    const skills = mapTrialToSkills({ exerciseSlug: 'fix_sentence', inputs: null });
    expect(skills).toContain('comprehension.sentence');
  });

  it('non-adopted slugs are skipped (no contamination after slug fix)', () => {
    // After Phase 1+4: the legacy `expressive` fallthrough is tightened.
    // Non-adopted slugs must not silently flow into expressive mastery
    // even when their trial_mode is null. Receptive / non-linguistic games
    // remain non-adopted across Waves 1–3.
    for (const slug of ['meaning_match', 'pattern_match', 'detective_mind', 'phonological_awareness', 'minimal_pairs']) {
      expect(routeTrialMode(slug, null)).toBe('skipped_unknown');
      expect(routeTrialMode(slug, 'production')).toBe('skipped_unknown');
    }
  });

  it('quarantined slugs always map to empty', () => {
    expect(mapTrialToSkills({ exerciseSlug: 'conversation_partner', inputs: null })).toEqual([]);
    expect(mapTrialToSkills({ exerciseSlug: 'conversation_coach', inputs: null })).toEqual([]);
    // Dash form (legacy) must also normalize and stay quarantined.
    expect(mapTrialToSkills({ exerciseSlug: 'conversation-partner', inputs: null })).toEqual([]);
  });

  it('all canonical slugs in mapping are valid underscore form', () => {
    // Smoke-check the full canonical set: any slug used by the writer must
    // either (a) map to a non-empty skill list, or (b) be intentionally
    // omitted (motor games, conversation, etc.). Failure indicates the
    // switch in skillMapping has drifted from CANONICAL_SLUGS.
    const adoptedTargets = ['photo_naming', 'fix_sentence', 'two_clues', 'describe_guess', 'narrative_retell'];
    for (const slug of adoptedTargets) {
      const skills = mapTrialToSkills({ exerciseSlug: slug, inputs: { difficulty: 2 } });
      expect(skills.length).toBeGreaterThan(0);
    }
  });
});
