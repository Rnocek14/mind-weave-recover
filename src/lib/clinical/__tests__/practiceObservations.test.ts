import { describe, expect, it } from 'vitest';
import { buildPracticeObservations } from '../practiceObservations';

const empty = { averageScorePct: null, scoreSlopePerDay: null, cueIndexPct: null };
describe('practice observation evidence boundaries', () => {
  it('shows no invented metrics when evidence is missing', () => {
    expect(buildPracticeObservations(empty)).toEqual([]);
  });
  it.each([0, 50, 70, 100])('reports a real %s percent score without inferring unassisted naming', (averageScorePct) => {
    const [observation] = buildPracticeObservations({ ...empty, averageScorePct });
    expect(observation.signal).toContain(`${averageScorePct}% across eligible recorded events`);
    expect(observation.signal).toContain('not independent naming accuracy');
  });
  it.each([NaN, Infinity, -Infinity, -1, 101])('does not format invalid percentages as real evidence: %s', (invalid) => {
    expect(buildPracticeObservations({ ...empty, averageScorePct: invalid, cueIndexPct: invalid })).toEqual([]);
  });
  it.each([[0.02, 'increased'], [-0.02, 'decreased'], [0, 'were unchanged']] as const)(
    'describes score slope %s without making a speed claim', (scoreSlopePerDay, direction) => {
      const [observation] = buildPracticeObservations({ ...empty, scoreSlopePerDay });
      expect(observation.signal).toContain(direction);
      expect(observation.signal).toContain('does not measure response speed or everyday communication');
    },
  );
  it('does not use a nonfinite trend', () => {
    expect(buildPracticeObservations({ ...empty, scoreSlopePerDay: NaN })).toEqual([]);
  });
  it('retains a cue observation while explicitly limiting its interpretation', () => {
    const [observation] = buildPracticeObservations({ ...empty, cueIndexPct: 85 });
    expect(observation.signal).toContain('85% on the existing app cue index');
    expect(observation.signal).toContain('not a measure of support needed in everyday conversation');
  });
  it('even maximum app scores do not recommend discharge or claim daily-life carryover', () => {
    const output = JSON.stringify(buildPracticeObservations({ averageScorePct: 100, scoreSlopePerDay: 1, cueIndexPct: 100 }));
    expect(output).not.toMatch(/ready for step-down|discharge|transferring to daily use|faster responses/i);
  });
});
