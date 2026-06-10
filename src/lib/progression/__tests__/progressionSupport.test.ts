import { describe, it, expect } from 'vitest';
import {
  isProgressionSupported,
  isProgressionUnsupported,
  PROGRESSION_UNSUPPORTED_SLUGS,
} from '@/lib/progression/progressionSupport';

describe('progressionSupport registry', () => {
  it('marks discourse/conversation exercises as unsupported', () => {
    for (const slug of PROGRESSION_UNSUPPORTED_SLUGS) {
      expect(isProgressionUnsupported(slug)).toBe(true);
      expect(isProgressionSupported(slug)).toBe(false);
    }
  });

  it('explicitly classifies narrative_retell / conversation_coach / conversation_partner', () => {
    expect(isProgressionUnsupported('narrative_retell')).toBe(true);
    expect(isProgressionUnsupported('conversation_coach')).toBe(true);
    expect(isProgressionUnsupported('conversation_partner')).toBe(true);
  });

  it('normalizes hyphen variants before classifying', () => {
    expect(isProgressionUnsupported('narrative-retell')).toBe(true);
    expect(isProgressionUnsupported('conversation-partner')).toBe(true);
  });

  it('treats progression-driven games as supported', () => {
    expect(isProgressionSupported('photo_naming')).toBe(true);
    expect(isProgressionSupported('minimal-pairs')).toBe(true);
    expect(isProgressionSupported('fix_sentence')).toBe(true);
    expect(isProgressionSupported('pattern-match')).toBe(true);
  });
});
