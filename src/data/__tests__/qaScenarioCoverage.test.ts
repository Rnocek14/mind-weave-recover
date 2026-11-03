import { describe, expect, it } from 'vitest';
import { ALL_EXERCISE_SLUGS, EXERCISE_COUNT } from '../canonicalExerciseRegistry';
import { QA_GAME_INVENTORY, QA_RUNBOOK_VERSION, QA_SCENARIOS } from '../qaScenarios';

const REQUIRED_GAME_CHECKS = [
  'enter',
  'purpose',
  'start',
  'response',
  'support',
  'skip',
  'speech-if-used',
  'stages',
  'evidence',
  'resume',
  'guided-session',
  'accessibility',
] as const;

describe('NeuroSpark all-game manual QA audit coverage', () => {
  it('covers every canonical game plus separately routed functional command scenes', () => {
    expect(EXERCISE_COUNT).toBe(28);
    const expected = new Set([...ALL_EXERCISE_SLUGS, 'functional-scenes']);
    expect(expected.size).toBe(29);

    const inventorySlugs = QA_GAME_INVENTORY.map((game) => game.slug);
    expect(inventorySlugs).toHaveLength(expected.size);
    expect(new Set(inventorySlugs)).toEqual(expected);
    expect(QA_GAME_INVENTORY.every((game) => game.title.trim() && game.intendedSkill.trim())).toBe(true);
  });

  it('requires a unique, reviewable patient scenario for all 29 activities', () => {
    const scenarios = QA_SCENARIOS.filter((scenario) => scenario.area === 'game');
    expect(scenarios).toHaveLength(QA_GAME_INVENTORY.length);
    expect(new Set(scenarios.map((scenario) => scenario.slug)).size).toBe(scenarios.length);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);

    for (const game of QA_GAME_INVENTORY) {
      const scenario = scenarios.find((candidate) => candidate.slug === game.slug);
      expect(scenario, game.slug).toBeDefined();
      expect(scenario?.role).toBe('patient');
      expect(scenario?.title).toContain(game.title);
      expect(scenario?.steps.map((step) => step.id)).toEqual(REQUIRED_GAME_CHECKS);
      expect(new Set(scenario?.steps.map((step) => step.id)).size).toBe(REQUIRED_GAME_CHECKS.length);
    }
  });

  it('does not mistake an audit requirement for playable stage, persistence, or independent speech evidence', () => {
    const scenarios = QA_SCENARIOS.filter((scenario) => scenario.area === 'game');
    for (const scenario of scenarios) {
      const byId = Object.fromEntries(scenario.steps.map((step) => [step.id, step]));
      expect(byId.stages.expect).toMatch(/unavailable|incomplete/i);
      expect(byId.evidence.safety).toMatch(/without isolated authenticated read-back/i);
      expect(byId.speech-if-used.expect).toMatch(/spoken and non-spoken modes remain distinct/i);
      expect(byId.response.safety).toMatch(/not.*clinically verified independent success/i);
      expect(byId.skip.expect).toMatch(/not falsely recorded/i);
    }
    expect(QA_RUNBOOK_VERSION).toBe('2.0.0');
  });
});
