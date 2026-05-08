# Phase B Implementation Plan — "What Changed Today" (spec-first, no code yet)

This plan defines the **foundation layer** that must exist before any "What changed today" UI is built. The order is deliberate: rules → signal contract → confidence gate → UI. The first three are spec/scaffolding work. The UI ships only after they are stable.

---

## Step 1 — Codify phrase safety rules

**Deliverable:** `src/lib/insights/insightLanguage.ts` (new) — the single authority for any patient/caregiver-facing wording in Phase B and beyond. UI components and the narrator MUST import phrases from here. Free-form strings in components are forbidden.

**Contents:**

1. **Whitelist (allowed verbs/frames).** Examples (final list locked in implementation):
   - "held steady"
   - "stayed consistent"
   - "more independent today"
   - "needed less prompting"
   - "support stayed available"
   - "support stepped in to keep practice productive"
   - "pacing eased to match today's effort"
   - "ready for a stretch next time"

2. **Blacklist (banned terms — generator throws if detected).**
   - "decreased", "declined", "dropped", "worsened", "regressed", "regression"
   - "fell", "weaker", "failed", "struggled" (when used about the user)
   - "difficulty decreased" / "difficulty increased" (engine internals)
   - "cue dependency", "fatigue score", "z-score", "delta", "threshold"
   - any number with two decimals (raw metric leak)
   - any % when describing change ("accuracy fell 12%")

3. **Mastery-first ordering rule.** A `composeInsights(signals)` function:
   - Always emits mastery/independence wins first.
   - Support-related framings appear only after a mastery line OR alone if no mastery line qualifies.
   - Never emits a support line in punitive position.

4. **Tone frame.** Every emitted line is post-processed to ensure it carries the protective stance: *"One hard session never costs a rung."* This is enforced as a max-length + tone-check rule, not as a literal suffix.

5. **Silence is valid.** `composeInsights` may return `[]`. UI must handle empty state (render nothing or a calm "Nice work today" — TBD in UI step).

**Tests required before merge:** unit tests covering blacklist enforcement, mastery-first ordering, and the empty-output path.

---

## Step 2 — `sessionAdaptationDigest(sessionId)` spec

**Deliverable:** `src/lib/insights/sessionAdaptationDigest.ts` (new). Pure reader over `adaptation_trial_logs` + `exercise_events` for a single session. Returns a **structured signal object**, never strings. The wording layer (Step 1) consumes it.

**Signal contract (initial set — closed enum, additive only):**

```text
type DigestSignal =
  | { kind: 'cue_support_changed';     direction: 'less' | 'more' | 'same'; dimension: 'cue_dependency'; trials: number; confidence: number }
  | { kind: 'pacing_changed';          direction: 'eased' | 'tightened' | 'same'; dimension: 'processing_speed'; trials: number; confidence: number }
  | { kind: 'distractor_load_changed'; direction: 'fewer' | 'more' | 'same'; dimension: 'distractor_load'; trials: number; confidence: number }
  | { kind: 'task_complexity_changed'; direction: 'simpler' | 'harder' | 'same'; dimension: 'linguistic_complexity' | 'working_memory_load'; trials: number; confidence: number }
  | { kind: 'accuracy_held_steady';    band: 'warmup' | 'core' | 'stretch' | 'consolidation'; trials: number; confidence: number }
  | { kind: 'fatigue_support_activated'; trials: number; confidence: number }
  | { kind: 'independence_gain';       dimension: 'independence' | 'cue_dependency'; trials: number; confidence: number };
```

**Rules:**
- Reader is read-only — never writes, never adapts, never branches engine behavior.
- Each signal is per-game (carries `slug`) so the UI can group or filter.
- `confidence` is computed by Step 3's helper, not inline.
- If a signal cannot be computed safely (too few trials, ambiguous direction), it is **omitted**, not emitted as `direction: 'same'`.
- New signal kinds are added by appending to the union — never by overloading existing ones.

**Tests required:** fixture-based tests using synthetic `adaptation_trial_logs` rows for each signal kind, plus a "low-data session → empty digest" fixture.

---

## Step 3 — Centralize the confidence threshold

**Deliverable:** `src/lib/insights/insightConfidence.ts` (new). One helper, one import site for every insight type.

**API (locked):**

```text
insightConfidence({
  trialsAtDimension: number,
  effectSize: number,         // normalized 0..1, signal-specific
  consistencyAcrossTrials: number, // 0..1
  sessionsObserved?: number,  // optional, for future longitudinal use
}): { score: number; tier: 'high' | 'medium' | 'low' | 'insufficient' }
```

**Defaults (Phase B initial bar — intentionally strict):**
- `insufficient` if `trialsAtDimension < 10` for that dimension within the session.
- `low` is **not eligible** for emission in Phase B (filtered out by composer).
- `medium` requires `consistencyAcrossTrials ≥ 0.7` AND `effectSize ≥ 0.25`.
- `high` requires `consistencyAcrossTrials ≥ 0.85` AND `effectSize ≥ 0.4`.
- Composer caps Phase B output at **0–2 lines per session**, prioritizing `high` over `medium`.

**Why one helper:** prevents per-insight threshold drift; lets us loosen the bar in one place once weekly aggregation is wired in Phase C.

**Tests required:** golden-table tests covering the four tiers and the cap behavior in the composer.

---

## Step 4 — Ship "What changed today" UI (only after Steps 1–3 land)

**Scope (intentionally minimal):**
- New component `src/components/insights/WhatChangedToday.tsx`.
- Mounted on the post-session summary screen only. **Not** on Patient Hub. **Not** on per-game pages.
- Reads `sessionAdaptationDigest(sessionId)` → composer → renders 0–2 lines.
- Renders nothing (no card, no header) on empty output.
- Each line is read-only text. No CTAs, no expand/collapse, no "why" deep-link in this first cut (the About pages already cover dimension explanations).
- Carries the same protective frame copy used in `RecoveryProfileSection`.

**Out of scope for this step:**
- Longitudinal claims of any kind ("this week", "this month").
- Weekly digest surface.
- Caregiver/clinician variants.
- Personalized rung-description rewriting.

---

## Step 5 — Weekly longitudinal digest (Phase C, deferred)

Captured here so we don't lose it — **not built in this plan**.

- Lives in **Patient Hub**, not post-session.
- New reader `weeklyAdaptationDigest(userId, weekStart)` aggregates per-dimension signals across sessions.
- Reuses Step 1 language rules and Step 3 confidence helper unchanged.
- Loosens the trial-count bar because it has cross-session evidence.
- Adds new signal kinds for trends only when we can compute them safely (e.g. `cue_reliance_trend`, `narrative_sequencing_stabilizing`).

---

## Architectural guarantees (Phase B-wide)

- **Read-only.** Nothing in this plan writes to `adaptation_trial_logs`, `sessions`, mastery shadow, or any engine state.
- **No engine coupling.** The digest reader does not import from `drillTriggerEvaluator`, `drillSelector`, `useSessionAdaptation`, or any adaptation engine module. It only reads logged rows.
- **Spec-only dimensions.** Reuses `clinicalDimensions.ts` IDs — no new dimensions invented here.
- **Additive signal union.** New `DigestSignal` kinds are appended, never overloaded.
- **Single language authority.** `insightLanguage.ts` is the only place phrases live; components import, never inline.

---

## Suggested order of PRs

1. PR-B1: `insightLanguage.ts` + tests (Step 1).
2. PR-B2: `sessionAdaptationDigest.ts` + fixtures + tests (Step 2).
3. PR-B3: `insightConfidence.ts` + composer integration + tests (Step 3).
4. PR-B4: `WhatChangedToday.tsx` mounted on post-session summary (Step 4).
5. (Phase C, separate plan) Weekly digest in Patient Hub.

Each PR is independently reviewable and does not require the next to ship. PR-B1 through PR-B3 are invisible to users; PR-B4 is the first user-visible change.
