import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commitPhotoNamingEvidence, type PhotoNamingCommitStages,
  type PhotoNamingProgressionSnapshot,
} from './verifiedPhotoNamingCommit';

const exampleSnapshot: PhotoNamingProgressionSnapshot = {
  prev: { level: 1, progressPct: 75 },
  next: { level: 2, progressPct: 3 },
  leveledUp: true,
};

function setup() {
  const stages: PhotoNamingCommitStages = {
    rawCommitted: false,
    utterancesCommitted: false,
    adaptationCommitted: false,
    notesCommitted: false,
    progressionCommitted: false,
  };
  const raw = vi.fn(async () => ({ ok: true }));
  const utterances = vi.fn(async () => true);
  const adaptation = vi.fn(async () => true);
  const notes = vi.fn(async () => true);
  const progression = vi.fn(async (_sessionId: string) => ({
    ok: true,
    snapshot: exampleSnapshot,
  }));
  const onSnapshot = vi.fn();

  const commit = (sessionId: string | null = 'patient-session') =>
    commitPhotoNamingEvidence({
      sessionId, stages,
      commitRaw: raw,
      confirmUtterances: utterances,
      retryAdaptation: adaptation,
      persistNotes: notes,
      commitProgression: progression,
      onProgressionSnapshot: onSnapshot,
    });
  return { stages, raw, utterances, adaptation, notes, progression, onSnapshot, commit };
}

beforeEach(() => vi.restoreAllMocks());

describe('Photo Naming staged clinical completion (production commit function)', () => {
  it('requires all writers to confirm and never commits progression before raw clinical attempts', async () => {
    const ctx = setup();
    const order: string[] = [];
    ctx.raw.mockImplementation(async () => { order.push('raw'); return { ok: true }; });
    ctx.utterances.mockImplementation(async () => { order.push('utterances'); return true; });
    ctx.adaptation.mockImplementation(async () => { order.push('adaptation'); return true; });
    ctx.notes.mockImplementation(async () => { order.push('notes'); return true; });
    ctx.progression.mockImplementation(async () => { order.push('progression'); return { ok: true, snapshot: exampleSnapshot }; });
    expect(await ctx.commit()).toEqual({ ok: true });
    expect(order).toEqual(['raw', 'utterances', 'adaptation', 'notes', 'progression']);
    expect(ctx.progression).toHaveBeenCalledWith('patient-session');
    expect(ctx.onSnapshot).toHaveBeenCalledExactlyOnceWith(exampleSnapshot);
  });

  it('refuses progression, notes and closure when the last raw trial is not confirmed', async () => {
    const ctx = setup();
    ctx.raw.mockResolvedValueOnce({ ok: false });
    expect(await ctx.commit()).toEqual({ ok: false });
    expect(ctx.adaptation).not.toHaveBeenCalled();
    expect(ctx.notes).not.toHaveBeenCalled();
    expect(ctx.progression).not.toHaveBeenCalled();
    expect(ctx.stages.rawCommitted).toBe(false);
    expect(await ctx.commit()).toEqual({ ok: true });
    expect(ctx.raw).toHaveBeenCalledTimes(2);
    expect(ctx.progression).toHaveBeenCalledTimes(1);
  });

  it('waits for all original utterance records and retries only incomplete evidence', async () => {
    const ctx = setup();
    ctx.utterances.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await ctx.commit()).toEqual({ ok: false });
    expect(ctx.stages.rawCommitted).toBe(true);
    expect(ctx.stages.utterancesCommitted).toBe(false);
    expect(ctx.adaptation).not.toHaveBeenCalled();
    expect(ctx.notes).not.toHaveBeenCalled();
    expect(ctx.progression).not.toHaveBeenCalled();

    expect(await ctx.commit()).toEqual({ ok: true });
    expect(ctx.raw).toHaveBeenCalledTimes(1);
    expect(ctx.utterances).toHaveBeenCalledTimes(2);
    expect(ctx.adaptation).toHaveBeenCalledTimes(1);
    expect(ctx.progression).toHaveBeenCalledTimes(1);
    expect(ctx.stages.utterancesCommitted).toBe(true);
  });

  it('retries only incomplete stages after a buffered adaptation insert fails', async () => {
    const ctx = setup();
    ctx.adaptation.mockResolvedValueOnce(false);
    expect(await ctx.commit()).toEqual({ ok: false });
    expect(ctx.stages.rawCommitted).toBe(true);
    expect(ctx.progression).not.toHaveBeenCalled();
    expect(await ctx.commit()).toEqual({ ok: true });
    expect(ctx.raw).toHaveBeenCalledTimes(1);
    expect(ctx.adaptation).toHaveBeenCalledTimes(2);
    expect(ctx.progression).toHaveBeenCalledTimes(1);
  });

  it('retains verified raw/adaptation stages when the caregiver notes update reports zero rows', async () => {
    const ctx = setup();
    ctx.notes.mockResolvedValueOnce(false);
    expect(await ctx.commit()).toEqual({ ok: false });
    expect(ctx.progression).not.toHaveBeenCalled();
    expect(await ctx.commit()).toEqual({ ok: true });
    expect(ctx.raw).toHaveBeenCalledTimes(1);
    expect(ctx.adaptation).toHaveBeenCalledTimes(1);
    expect(ctx.notes).toHaveBeenCalledTimes(2);
    expect(ctx.progression).toHaveBeenCalledTimes(1);
  });

  it('does not apply Photo Naming progression twice after a failed progression save', async () => {
    const ctx = setup();
    ctx.progression.mockResolvedValueOnce({ ok: false, snapshot: exampleSnapshot });
    expect(await ctx.commit()).toEqual({ ok: false });
    expect(ctx.onSnapshot).not.toHaveBeenCalled();
    expect(await ctx.commit()).toEqual({ ok: true });
    expect(ctx.raw).toHaveBeenCalledTimes(1);
    expect(ctx.adaptation).toHaveBeenCalledTimes(1);
    expect(ctx.notes).toHaveBeenCalledTimes(1);
    expect(ctx.progression).toHaveBeenCalledTimes(2);
    expect(await ctx.commit()).toEqual({ ok: true });
    expect(ctx.progression).toHaveBeenCalledTimes(2);
    expect(ctx.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('fails closed on offline or unknown session and thrown client errors', async () => {
    const noSession = setup();
    expect(await noSession.commit(null)).toEqual({ ok: false });
    expect(noSession.raw).not.toHaveBeenCalled();

    const thrown = setup();
    thrown.raw.mockRejectedValueOnce(new Error('synthetic transport loss'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await thrown.commit()).toEqual({ ok: false });
      expect(thrown.progression).not.toHaveBeenCalled();
      expect(await thrown.commit()).toEqual({ ok: true });
    } finally { spy.mockRestore(); }
  });
});
