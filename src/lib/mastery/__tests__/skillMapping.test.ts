import { describe, it, expect } from 'vitest';
import { mapTrialToSkills } from '../skillMapping';

describe('mapTrialToSkills — uses inputs', () => {
  describe('photo-naming', () => {
    it('maps low difficulty (1-2) to high-frequency', () => {
      expect(mapTrialToSkills({ exerciseSlug: 'photo-naming', inputs: { difficulty: 1 } }))
        .toEqual(['naming.high-frequency']);
      expect(mapTrialToSkills({ exerciseSlug: 'photo-naming', inputs: { difficulty: 2 } }))
        .toEqual(['naming.high-frequency']);
    });

    it('maps difficulty >=3 to low-frequency', () => {
      expect(mapTrialToSkills({ exerciseSlug: 'photo-naming', inputs: { difficulty: 3 } }))
        .toEqual(['naming.low-frequency']);
      expect(mapTrialToSkills({ exerciseSlug: 'photo-naming', inputs: { difficulty: 7 } }))
        .toEqual(['naming.low-frequency']);
    });

    it('returns naming.unspecified when difficulty missing', () => {
      expect(mapTrialToSkills({ exerciseSlug: 'photo-naming', inputs: null }))
        .toEqual(['naming.unspecified']);
      expect(mapTrialToSkills({ exerciseSlug: 'photo-naming', inputs: { difficulty: null } }))
        .toEqual(['naming.unspecified']);
    });
  });

  describe('minimal-pairs', () => {
    it('classifies voicing pair', () => {
      const r = mapTrialToSkills({ exerciseSlug: 'minimal-pairs', inputs: { pairId: 'p/b' } });
      expect(r).toContain('phonology.voicing');
    });

    it('classifies place pair', () => {
      const r = mapTrialToSkills({ exerciseSlug: 'minimal-pairs', inputs: { contrast: 'k/t' } });
      expect(r).toContain('phonology.place');
    });

    it('returns unspecified when no pair info given (no longer defaults to manner)', () => {
      const r = mapTrialToSkills({ exerciseSlug: 'minimal-pairs', inputs: null });
      expect(r).toContain('phonology.unspecified');
      expect(r).not.toContain('phonology.manner');
    });
  });
});
