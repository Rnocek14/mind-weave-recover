/**
 * Photo Naming has two independent clinical writers:
 *  - the page's unified attempt/progression-shadow writer
 *  - the game's adaptation and Photo Naming progression writer
 *
 * Reconcile both in that order, exactly once per confirmed stage, before the
 * shared session lifecycle can close. The caller owns the patient-specific
 * ledger and must discard it on session/profile changes.
 */
export interface PhotoNamingCommitStages {
  rawCommitted: boolean;
  utterancesCommitted: boolean;
  adaptationCommitted: boolean;
  notesCommitted: boolean;
  progressionCommitted: boolean;
}

export interface PhotoNamingProgressionSnapshot {
  prev: { level: number; progressPct: number };
  next: { level: number; progressPct: number };
  leveledUp: boolean;
}

interface PhotoNamingCommitServices {
  sessionId: string | null;
  stages: PhotoNamingCommitStages;
  commitRaw: () => Promise<{ ok: boolean }>;
  /** Audio/utterance evidence uses separate original attempt IDs. */
  confirmUtterances: () => Promise<boolean>;
  retryAdaptation: () => Promise<boolean>;
  persistNotes: () => Promise<boolean>;
  commitProgression: (sessionId: string) => Promise<{
    ok: boolean;
    snapshot?: PhotoNamingProgressionSnapshot | null;
  }>;
  onProgressionSnapshot: (snapshot: PhotoNamingProgressionSnapshot) => void;
}

export async function commitPhotoNamingEvidence({
  sessionId, stages, commitRaw, confirmUtterances, retryAdaptation, persistNotes,
  commitProgression, onProgressionSnapshot,
}: PhotoNamingCommitServices): Promise<{ ok: boolean }> {
  if (!sessionId) return { ok: false };

  try {
    if (!stages.rawCommitted) {
      const raw = await commitRaw();
      if (!raw.ok) return { ok: false };
      stages.rawCommitted = true;
    }
    // PhotoNamingGame owns utterance_analyses separately from the page's
    // exercise_events. A scored task can save while its speech record fails;
    // never advance the session/progression until both write paths confirm.
    if (!stages.utterancesCommitted) {
      if (!await confirmUtterances()) return { ok: false };
      stages.utterancesCommitted = true;
    }
    if (!stages.adaptationCommitted) {
      if (!await retryAdaptation()) return { ok: false };
      stages.adaptationCommitted = true;
    }
    if (!stages.notesCommitted) {
      if (!await persistNotes()) return { ok: false };
      stages.notesCommitted = true;
    }
    if (!stages.progressionCommitted) {
      const progression = await commitProgression(sessionId);
      if (!progression.ok) return { ok: false };
      stages.progressionCommitted = true;
      if (progression.snapshot) onProgressionSnapshot(progression.snapshot);
    }
    return { ok: true };
  } catch (error) {
    console.error('[PhotoNaming] Clinical evidence commit interrupted', error);
    return { ok: false };
  }
}
