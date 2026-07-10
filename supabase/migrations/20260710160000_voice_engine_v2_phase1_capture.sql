-- Voice Engine v2 — V2.1 Phase 1: pure-capture columns.
--
-- Spec: docs/voice-engine-v2-spec.md §10, §12 (Phase 1).
-- This migration ONLY adds nullable/defaulted capture columns. It changes no
-- scoring, no verdict, and no existing behavior. The app begins persisting the
-- richer raw/cleaned transcript record and the reconciliation signals the v2
-- axis engine will later consume; nothing reads these columns to score yet.
--
-- Every column is additive and idempotent (ADD COLUMN IF NOT EXISTS) so this is
-- safe to run against a live table with existing rows.

-- ── utterance_analyses: the clean analytics table gains the full capture set ──
ALTER TABLE public.utterance_analyses
  -- Both ASR sources, verbatim, so reconciliation is auditable after the fact.
  ADD COLUMN IF NOT EXISTS raw_transcript_browser TEXT,
  ADD COLUMN IF NOT EXISTS raw_transcript_azure TEXT,
  -- Which source won the reconciliation for `transcript`/`cleaned_transcript`.
  -- Normalized to azure|browser|manual (legacy transcript_source uses 'whisper').
  ADD COLUMN IF NOT EXISTS chosen_transcript_source TEXT,
  -- The normalized transcript the v1 matcher already computes in-memory but
  -- has always discarded until now (filler/lead-in/noise stripped).
  ADD COLUMN IF NOT EXISTS cleaned_transcript TEXT,
  -- Structured record of WHAT cleaning removed: fillers[], filler_count,
  -- lead_in_used, and any self-correction { first, marker, final }.
  ADD COLUMN IF NOT EXISTS cleaning_events JSONB,
  -- Per-source confidence, e.g. { "azure": 0.91, "browser": null }.
  ADD COLUMN IF NOT EXISTS source_confidences JSONB,
  -- Did the two ASR sources agree on the cleaned content word?
  ADD COLUMN IF NOT EXISTS sources_agreed BOOLEAN,
  -- Which scoring engine produced this row's verdict. Existing + Phase-1 rows
  -- are v1 (scoring is unchanged); the flip to v2 verdicts happens in Phase 5.
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'v1';

-- ── exercise_events: only version-stamped in Phase 1 ──
-- The always-on axis columns (communication_success, word_retrieval,
-- independence) are intentionally deferred to the Phase 2 migration so no dead
-- columns exist ahead of the code that writes them. exercise_events already
-- carries both raw transcripts (browser_transcript, whisper_transcript) and the
-- Azure confidence (whisper_confidence), so no transcript capture is added here.
ALTER TABLE public.exercise_events
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'v1';

-- Cheap lookup for backfill/rollout analytics that segment by engine_version.
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_engine_version
  ON public.utterance_analyses(engine_version);
CREATE INDEX IF NOT EXISTS idx_exercise_events_engine_version
  ON public.exercise_events(engine_version);

COMMENT ON COLUMN public.utterance_analyses.cleaned_transcript IS
  'Voice Engine v2 Phase 1: normalized transcript (fillers/lead-ins/noise stripped). Capture-only; not yet used for scoring.';
COMMENT ON COLUMN public.utterance_analyses.cleaning_events IS
  'Voice Engine v2 Phase 1: what cleaning removed — fillers_removed[], filler_count, lead_in_used, self_correction{first,marker,final}.';
COMMENT ON COLUMN public.utterance_analyses.engine_version IS
  'Scoring engine that produced this row. v1 until the Phase 5 flip; do not assume capture columns imply a v2 verdict.';
