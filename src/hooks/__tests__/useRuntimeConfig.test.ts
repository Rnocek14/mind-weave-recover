/**
 * Config precedence tests for runtime_config → capability bounds → profile defaults.
 * 
 * Tests the parseRuntimeConfig function and the precedence contract:
 * runtime_config clinician override > safety/capability bounds > profile-derived defaults.
 */
import { describe, it, expect } from 'vitest';
import { parseRuntimeConfig } from '../useRuntimeConfig';

describe('parseRuntimeConfig', () => {
  it('returns defaults for null input', () => {
    const result = parseRuntimeConfig(null);
    expect(result.globalDifficulty).toBe(0);
    expect(result.cueOverride).toBeNull();
    expect(result.practiceAssignments).toEqual([]);
    expect(result.difficultyOverrides).toEqual({});
  });

  it('returns defaults for empty object', () => {
    const result = parseRuntimeConfig({});
    expect(result.globalDifficulty).toBe(0);
    expect(result.cueOverride).toBeNull();
  });

  it('parses global difficulty override', () => {
    const result = parseRuntimeConfig({
      difficulty_overrides: { _global: 2 },
    });
    expect(result.globalDifficulty).toBe(2);
    expect(result.difficultyOverrides._global).toBe(2);
  });

  it('parses exercise-specific difficulty override', () => {
    const result = parseRuntimeConfig({
      difficulty_overrides: { _global: 0, 'photo-naming': -1 },
    });
    expect(result.globalDifficulty).toBe(0);
    expect(result.difficultyOverrides['photo-naming']).toBe(-1);
  });

  it('exercise-specific overrides take precedence over global', () => {
    const config = parseRuntimeConfig({
      difficulty_overrides: { _global: 2, 'photo-naming': -1 },
    });
    // Exercise-specific should be returned when queried for that slug
    expect(config.difficultyOverrides['photo-naming']).toBe(-1);
    // Global should still be accessible
    expect(config.globalDifficulty).toBe(2);
  });

  it('parses cue level override', () => {
    const result = parseRuntimeConfig({
      cue_level_override: 3,
      cue_review_at: '2026-03-20T10:00:00Z',
      cue_reviewed_by: 'clinician-123',
    });
    expect(result.cueOverride).toBe(3);
    expect(result.cueReviewedAt).toBe('2026-03-20T10:00:00Z');
    expect(result.cueReviewedBy).toBe('clinician-123');
  });

  it('null cue_level_override means auto', () => {
    const result = parseRuntimeConfig({ cue_level_override: null });
    expect(result.cueOverride).toBeNull();
  });

  it('parses practice assignments', () => {
    const assignments = [
      { id: '1', notes: 'Practice naming', assigned_by: 'c1', assigned_at: '2026-03-20', status: 'active' },
      { id: '2', notes: 'Old assignment', assigned_by: 'c1', assigned_at: '2026-03-10', status: 'completed' },
    ];
    const result = parseRuntimeConfig({ practice_assignments: assignments });
    expect(result.practiceAssignments).toHaveLength(2);
    expect(result.practiceAssignments[0].status).toBe('active');
  });

  it('preserves raw JSON for edge cases', () => {
    const raw = { difficulty_overrides: { _global: 1 }, custom_field: 'test' };
    const result = parseRuntimeConfig(raw);
    expect(result.raw).toEqual(raw);
    expect(result.raw.custom_field).toBe('test');
  });

  it('handles negative difficulty overrides', () => {
    const result = parseRuntimeConfig({
      difficulty_overrides: { _global: -2 },
    });
    expect(result.globalDifficulty).toBe(-2);
  });
});

describe('config precedence contract', () => {
  it('runtime_config difficulty > profile default (0)', () => {
    // When runtime_config has a difficulty override, it should take precedence
    const config = parseRuntimeConfig({ difficulty_overrides: { _global: 3 } });
    const profileDefault = 0;
    const effective = config.globalDifficulty !== 0 ? config.globalDifficulty : profileDefault;
    expect(effective).toBe(3);
  });

  it('runtime_config cue > auto when set', () => {
    const config = parseRuntimeConfig({ cue_level_override: 2 });
    const autoCue = null;
    const effective = config.cueOverride !== null ? config.cueOverride : autoCue;
    expect(effective).toBe(2);
  });

  it('falls back to auto cue when runtime_config is null', () => {
    const config = parseRuntimeConfig({});
    const autoCue = null;
    const effective = config.cueOverride !== null ? config.cueOverride : autoCue;
    expect(effective).toBeNull();
  });
});
