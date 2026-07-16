-- Voice Engine v2 — V2.1 Phase 2: shadow axis verdict.
--
-- Spec: docs/voice-engine-v2-spec.md §1, §2, §12 (Phase 2).
-- The v2 axis engine now runs in SHADOW alongside live v1 scoring. It re-expresses
-- the evidence v1 already produced onto the always-on axes (Word Retrieval,
-- Communication Success, Independence) plus a strategy label, a measurement-
-- confidence band, and a primary verdict. NOTHING here gates: v1 remains the
-- authoritative scorer (engine_version stays 'v1' — see Phase 1 migration) and no
-- product surface or progression query reads these columns yet. They exist so the
-- shadow verdict can be compared against v1 before the Phase 5 flip.
--
-- All columns are additive, nullable, and idempotent. The three always-on axis
-- values live inside axis_scores (jsonb) for now; they are promoted to first-class
-- gating columns only in the Phase 5 migration, alongside the flip.
ALTER TABLE public.exercise_events
  -- { wordRetrieval, communicationSuccess, independence } each { value, confidence, evidence[] }.
  ADD COLUMN IF NOT EXISTS axis_scores JSONB,
  -- Cognitive Strategy classification (spontaneous | self_correction | circumlocution | ...).
  ADD COLUMN IF NOT EXISTS strategy_used TEXT,
  -- Overall measurement confidence band (high | medium | low).
  ADD COLUMN IF NOT EXISTS measurement_confidence TEXT,
  -- Shadow primary verdict (success | partial | retry | no_score). Non-authoritative.
  ADD COLUMN IF NOT EXISTS verdict_primary TEXT,
  -- One clinician-readable reason line templated from the evidence.
  ADD COLUMN IF NOT EXISTS verdict_reason TEXT,
  -- Shadow-vs-live comparison: { v1_correct, v2_primary, agrees }.
  -- agrees = null when v2 abstained (no_score) — i.e. not comparable.
  ADD COLUMN IF NOT EXISTS shadow_v1_agreement JSONB;

-- Indexes for the shadow-diff review queries (segment by verdict / strategy).
CREATE INDEX IF NOT EXISTS idx_exercise_events_verdict_primary
  ON public.exercise_events(verdict_primary);
CREATE INDEX IF NOT EXISTS idx_exercise_events_strategy_used
  ON public.exercise_events(strategy_used);

COMMENT ON COLUMN public.exercise_events.axis_scores IS
  'Voice Engine v2 Phase 2 SHADOW: always-on axis scores. Non-authoritative until the Phase 5 flip; v1 still gates.';
COMMENT ON COLUMN public.exercise_events.shadow_v1_agreement IS
  'Voice Engine v2 Phase 2: whether the shadow v2 verdict agrees with the live v1 correct flag (agrees=null ⇒ v2 abstained).';
