import { describe, expect, it } from 'vitest';
import { hasMissingClinicalRawEvidence } from '@/lib/trial/clinicalRawCompletionGate';

describe('clinical raw completion gate', () => {
  it('stops a session that lost exercise event writes', () => {
    expect(hasMissingClinicalRawEvidence({
      ok: false,
      errors: ['raw clinical event writes failed: 1 of this session\'s trial submissions; progression and mastery were not flushed'],
    })).toBe(true);
  });

  it('does not mistake a failed mastery/adaptation flush for missing raw evidence', () => {
    expect(hasMissingClinicalRawEvidence({ ok: false, errors: ['mastery flush: unavailable'] })).toBe(false);
    expect(hasMissingClinicalRawEvidence({ ok: false, errors: ['adaptation flush: offline'] })).toBe(false);
    expect(hasMissingClinicalRawEvidence({ ok: true, errors: [] })).toBe(false);
  });
});
