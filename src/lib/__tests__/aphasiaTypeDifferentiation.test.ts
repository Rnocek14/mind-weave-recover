/**
 * QA: Aphasia-type differentiation.
 *
 * Guards the #5 unlock — a provisional clinical profile must actually change
 * the therapy plan. If Broca / anomic / Wernicke / global all produced the
 * same lesson, personalization would be cosmetic. These tests assert real
 * divergence in domain priorities AND generated lesson plans, and that the
 * onboarding builder maps screener answers to the correct provisional type.
 */

import { describe, it, expect } from 'vitest';
import {
  detectAphasiaType,
  calculateDomainPriorities,
  generateDailyLesson,
  type PerformanceSignals,
  type AphasiaType,
} from '@/lib/dailyLessonEngine';
import type { ClinicalProfile } from '@/lib/clinicalProfileMapper';
import { POLISHED_EXERCISES } from '@/lib/polishedExercises';
import { buildOnboardingClinicalProfile } from '@/lib/onboardingClinicalProfile';

function profileWithSpeech(speech: string[]): ClinicalProfile {
  return {
    impairments: { motor: [], speech, cognitive: [], visual: [] },
    stroke_location: null,
    affected_side: null,
    therapy_focus: ['speech/language'],
  };
}

const NEUTRAL_SIGNALS: PerformanceSignals = {
  avgReactionTime: 2000,
  avgAccuracy: 0.7,
  timeoutRate: 0.1,
  errorTypes: { semantic: 0.1, phonological: 0.1, omissions: 0.1, perseverations: 0.1 },
  frustrationLevel: 'low',
  fatigueLevel: 'low',
  engagementScore: 6,
};

const CAPABILITY = { vision: 7, motor: 7, attention: 7, confidence: 0.5 };
const ACCESSIBLE = [...POLISHED_EXERCISES];

const TYPE_SAMPLES: Record<Exclude<AphasiaType, null | 'generic_speech' | 'conduction'>, string[]> = {
  anomic: ['anomic aphasia (word-finding difficulty)'],
  broca: ["Broca's aphasia (non-fluent, expressive)"],
  wernicke: ["Wernicke's aphasia (receptive, comprehension)"],
  global: ['global aphasia'],
};

describe('aphasia-type detection', () => {
  it('detects each canonical type', () => {
    for (const [type, speech] of Object.entries(TYPE_SAMPLES)) {
      expect(detectAphasiaType(profileWithSpeech(speech))).toBe(type);
    }
  });
});

describe('domain priorities differ by aphasia type', () => {
  const priorities = Object.fromEntries(
    Object.entries(TYPE_SAMPLES).map(([type, speech]) => [
      type,
      calculateDomainPriorities(profileWithSpeech(speech)),
    ]),
  );

  it('anomic emphasizes expressive + semantic, NOT receptive-high', () => {
    expect(priorities.anomic.expressive_language).toBe('high');
    expect(priorities.anomic.semantic_systems).toBe('high');
    expect(priorities.anomic.receptive_language).not.toBe('high');
  });

  it('wernicke emphasizes receptive comprehension', () => {
    expect(priorities.wernicke.receptive_language).toBe('high');
  });

  it('broca emphasizes phonology + expressive', () => {
    expect(priorities.broca.phonology).toBe('high');
    expect(priorities.broca.expressive_language).toBe('high');
  });

  it('global elevates all four language domains', () => {
    expect(priorities.global.expressive_language).toBe('high');
    expect(priorities.global.receptive_language).toBe('high');
    expect(priorities.global.semantic_systems).toBe('high');
    expect(priorities.global.phonology).toBe('high');
  });

  it('produces at least 3 distinct priority signatures across the 4 types', () => {
    const signatures = new Set(Object.values(priorities).map((p) => JSON.stringify(p)));
    expect(signatures.size).toBeGreaterThanOrEqual(3);
  });
});

describe('generated lesson plans differ by aphasia type', () => {
  function planFor(speech: string[]): string {
    const lesson = generateDailyLesson(
      CAPABILITY,
      profileWithSpeech(speech),
      ACCESSIBLE,
      NEUTRAL_SIGNALS,
      [],
    );
    // Signature = ordered exercise ids + target domains
    return JSON.stringify({
      blocks: lesson.blocks.map((b) => b.exerciseId),
      targets: lesson.targetDomains,
    });
  }

  it('anomic vs wernicke produce different plans', () => {
    expect(planFor(TYPE_SAMPLES.anomic)).not.toBe(planFor(TYPE_SAMPLES.wernicke));
  });

  it('at least 3 distinct lesson signatures across the 4 types', () => {
    const sigs = new Set(Object.values(TYPE_SAMPLES).map(planFor));
    expect(sigs.size).toBeGreaterThanOrEqual(3);
  });
});

describe('onboarding builder maps screener answers to provisional types', () => {
  it('word-finding only → anomic', () => {
    const p = buildOnboardingClinicalProfile(
      { strokeTiming: 'Over 1 year', mainDifficulty: ['Finding words'], energyLevel: '😊 Good energy' },
      ['speech'],
    );
    expect(p).not.toBeNull();
    expect(detectAphasiaType(p)).toBe('anomic');
    expect(p!.confidence).not.toBe('high');
  });

  it('comprehension only → wernicke (receptive)', () => {
    const p = buildOnboardingClinicalProfile(
      { strokeTiming: null, mainDifficulty: ['Understanding others'], energyLevel: null },
      ['speech'],
    );
    expect(detectAphasiaType(p)).toBe('wernicke');
  });

  it('both finding words + understanding → global', () => {
    const p = buildOnboardingClinicalProfile(
      { strokeTiming: null, mainDifficulty: ['Finding words', 'Understanding others'], energyLevel: '😫 Easily tired' },
      ['speech'],
    );
    expect(detectAphasiaType(p)).toBe('global');
    expect(p!.extraction_metadata?.severe_aphasia_mode).toBe(true);
  });

  it('never claims high confidence and tags onboarding provenance', () => {
    const p = buildOnboardingClinicalProfile(
      { strokeTiming: null, mainDifficulty: ['Finding words'], energyLevel: null },
      ['speech'],
    );
    expect(p!.confidence).not.toBe('high');
    expect(p!.extraction_metadata?.provenance).toBe('onboarding');
  });

  it('returns null when there is nothing to personalize on', () => {
    expect(
      buildOnboardingClinicalProfile({ strokeTiming: null, mainDifficulty: [], energyLevel: null }, []),
    ).toBeNull();
  });
});
