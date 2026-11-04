import { describe, expect, it } from 'vitest';
import {
  createPatientPauseHistory,
  getPatientTurnSilenceMs,
  isExplicitlyUnfinishedSpeech,
  observePatientSpeech,
  resetPatientPauseHistory,
} from '@/lib/speech/patientTurnTaking';

describe('patient-paced speech turn policy', () => {
  it('uses task-specific default windows, not a universal 2-second submit', () => {
    expect(getPatientTurnSilenceMs('photo_naming', 'apple')).toBe(4_000);
    expect(getPatientTurnSilenceMs('two_clues', 'a cup')).toBe(5_500);
    expect(getPatientTurnSilenceMs('thought_continuation', 'I went home today.')).toBe(9_000);
    expect(getPatientTurnSilenceMs('describe_guess', 'it is metal.')).toBe(9_000);
    expect(getPatientTurnSilenceMs('narrative_retell', 'The woman went home.')).toBe(12_000);
  });

  it('is more patient with incomplete discourse; does not confuse a one-word name with an unfinished sentence', () => {
    expect(getPatientTurnSilenceMs('thought_continuation', 'I went because')).toBe(11_500);
    expect(getPatientTurnSilenceMs('describe_guess', 'it is')).toBe(11_000);
    expect(getPatientTurnSilenceMs('photo_naming', 'cup')).toBe(4_000);
    expect(isExplicitlyUnfinishedSpeech('I went to the store because')).toBe(true);
    expect(isExplicitlyUnfinishedSpeech('the dog ran home.')).toBe(false);
  });

  it('learns a real pause from accumulated transcript growth but never from a duplicate or recognition rewrite', () => {
    let h = createPatientPauseHistory();
    h = observePatientSpeech(h, 'I went', 1_000);
    h = observePatientSpeech(h, 'I went', 9_000);
    expect(h.pausesMs).toEqual([]);
    h = observePatientSpeech(h, 'I went to', 9_000);
    expect(h.pausesMs).toEqual([8_000]);
    expect(getPatientTurnSilenceMs('thought_continuation', 'I went to the shop.', h.pausesMs)).toBe(10_500);
    h = observePatientSpeech(h, 'I am going', 11_000);
    expect(h.pausesMs).toEqual([8_000]);
    h = resetPatientPauseHistory(h);
    expect(h.lastTranscript).toBe('');
    expect(h.lastUpdateMs).toBeNull();
    expect(h.pausesMs).toEqual([8_000]);
  });

  it('bounds extreme pauses and ignores malformed timing evidence', () => {
    const original = getPatientTurnSilenceMs('thought_continuation', 'The dog ran home.');
    expect(getPatientTurnSilenceMs('thought_continuation', 'The dog ran home.', [NaN, -1, Infinity])).toBe(original);
    expect(getPatientTurnSilenceMs('thought_continuation', 'The dog ran home.', [14_000])).toBe(15_000);
    let h = observePatientSpeech(createPatientPauseHistory(), 'the', 1_000);
    h = observePatientSpeech(h, 'the dog', 45_000);
    expect(h.pausesMs).toEqual([]);
  });
});
