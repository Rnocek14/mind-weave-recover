import { describe, it, expect } from 'vitest';
import {
  buildCleaningEvents,
  normalizeASROutput,
} from '@/lib/speechNormalizer';

/**
 * Voice Engine v2 Phase 1 — pure-capture cleaning events.
 *
 * These lock in that buildCleaningEvents:
 *   (a) produces a `cleaned` string byte-identical to normalizeASROutput (it
 *       must add evidence, never change cleaning behavior), and
 *   (b) reports WHAT was removed — fillers, lead-ins, self-corrections — so the
 *       capture is auditable clinical signal rather than silent deletion.
 */
describe('buildCleaningEvents — Voice Engine v2 Phase 1 capture', () => {
  it('cleaned output matches normalizeASROutput exactly (no behavior drift)', () => {
    const samples = [
      'um the dog',
      'I think it is a bird',
      'knife no fork',
      '[breathing] cat (pause)',
      'well so like actually a house',
    ];
    for (const s of samples) {
      expect(buildCleaningEvents(s).cleaned).toBe(normalizeASROutput(s));
    }
  });

  it('records removed filler tokens and their count', () => {
    const { events } = buildCleaningEvents('um uh the dog');
    expect(events.fillers_removed).toEqual(['um', 'uh']);
    expect(events.filler_count).toBe(2);
  });

  it('flags a lead-in carrier phrase without corrupting the cleaned answer', () => {
    const res = buildCleaningEvents("I think it's a bird");
    expect(res.events.lead_in_used).toBe(true);
    // Lead-in detection is evidence only — normalizeASROutput does not strip
    // lead-ins, so "bird" survives in the cleaned string.
    expect(res.cleaned).toContain('bird');
  });

  it('captures a self-correction as { first, marker, final }', () => {
    const { events } = buildCleaningEvents('knife no fork');
    expect(events.self_correction).toEqual({
      first: 'knife',
      marker: 'no',
      final: 'fork',
    });
  });

  it('does not fabricate a self-correction when there is no repair', () => {
    const { events } = buildCleaningEvents('the dog is running');
    expect(events.self_correction).toBeNull();
  });

  it('handles empty / no-response input safely', () => {
    const res = buildCleaningEvents('');
    expect(res.cleaned).toBe('');
    expect(res.events.filler_count).toBe(0);
    expect(res.events.fillers_removed).toEqual([]);
    expect(res.events.lead_in_used).toBe(false);
    expect(res.events.self_correction).toBeNull();
  });

  it('reports no fillers when the utterance is clean', () => {
    const { events } = buildCleaningEvents('elephant');
    expect(events.filler_count).toBe(0);
    expect(events.self_correction).toBeNull();
    expect(events.lead_in_used).toBe(false);
  });
});
