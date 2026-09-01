import { describe, it, expect, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { warning: vi.fn() },
}));

import { toast } from 'sonner';
import {
  detectCrisis,
  crisisSafetyMessage,
  maybeSurfaceCrisisNotice,
} from '../crisisDetection';

describe('detectCrisis (client port — keep in sync with the edge _shared module)', () => {
  it('detects self-harm intent', () => {
    for (const text of [
      'I want to die',
      "i don't want to live",
      'thinking about suicide',
      'better off dead',
      'no reason to live anymore',
    ]) {
      const r = detectCrisis(text);
      expect(r.isCrisis, text).toBe(true);
      expect(r.kind, text).toBe('self_harm');
    }
  });

  it('detects acute stroke / medical-emergency red flags', () => {
    for (const text of [
      "i think i'm having another stroke",
      'my face is drooping',
      "can't move my arm",
      'my speech is slurring, slurred speech',
      'worst headache of my life',
      'chest pain right now',
      'call 911',
    ]) {
      const r = detectCrisis(text);
      expect(r.isCrisis, text).toBe(true);
      expect(r.kind, text).toBe('medical_emergency');
    }
  });

  it('does not flag ordinary exercise speech', () => {
    for (const text of [
      'the cat is on the table',
      'i went to the beach with my brother',
      'spoon',
      'i had eggs and toast for breakfast',
      'my arm was sore after the gym last year',
      '',
    ]) {
      expect(detectCrisis(text).isCrisis, text).toBe(false);
    }
  });

  it('handles null/undefined without throwing', () => {
    expect(detectCrisis(null).isCrisis).toBe(false);
    expect(detectCrisis(undefined).isCrisis).toBe(false);
  });
});

describe('crisisSafetyMessage', () => {
  it('medical emergency message surfaces the emergency number', () => {
    expect(crisisSafetyMessage('medical_emergency')).toContain('911');
  });
  it('self-harm message surfaces the crisis line', () => {
    expect(crisisSafetyMessage('self_harm')).toContain('988');
  });
});

describe('maybeSurfaceCrisisNotice', () => {
  it('shows the notice once per kind within the cooldown window', () => {
    const warning = vi.mocked(toast.warning);
    warning.mockClear();
    maybeSurfaceCrisisNotice('i want to die');
    maybeSurfaceCrisisNotice('i want to die'); // within cooldown — suppressed
    expect(warning).toHaveBeenCalledTimes(1);
    expect(String(warning.mock.calls[0][0])).toContain('988');
  });

  it('never fires for benign transcripts', () => {
    const warning = vi.mocked(toast.warning);
    warning.mockClear();
    maybeSurfaceCrisisNotice('the dog chased the ball');
    expect(warning).not.toHaveBeenCalled();
  });
});
