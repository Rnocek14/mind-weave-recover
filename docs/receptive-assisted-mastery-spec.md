# Receptive & Assisted Mastery — Architecture Spec

**Status:** Spec only (v0.1). No code, no schema, no scoring changes.
**Companion to:** `docs/progression-gating-spec.md`, `src/lib/mastery/masterySignalRouting.ts`.
**Frozen layer:** Aligns with `PROGRESSION_ARCHETYPES_VERSION = 0.3.0-spec`.

---

## 0. Why this document exists

P0-A landed `MasterySignalRouting` and stopped non-production trials from
inflating expressive mastery on adopted slugs (Photo Naming). The fix was
deliberately narrow: recognition, scaffolded, and exposure trials are
**dropped** from mastery computation, not re-routed.

That is correct as a safety measure. It is **not** the long-term model.

Recognition success, scaffolded success, and exposure repetitions are
clinically meaningful signals. They tell us things expressive accuracy
cannot. This document specifies how those signals should eventually be
captured as their own evidence channels — without contaminating
expressive mastery and without being implemented prematurely.

---

## 1. Evidence channels (conceptual model)

The platform has, conceptually, four distinct evidence channels. Each
answers a different clinical question.

| Channel | Question it answers | Source trials | Current handling |
|---|---|---|---|
| **Expressive production mastery** | Can the patient *retrieve and produce* the target unaided? | `trial_mode = 'production'` | ✅ implemented (`computeMastery` on filtered production trials) |
| **Receptive recognition mastery** | Does the patient *recognize / comprehend* the target when shown? | `trial_mode = 'recognition'` | ❌ excluded; future channel |
| **Assisted (scaffolded) evidence** | Can the patient produce the target *with cueing/support*? | `trial_mode = 'scaffolded'` | ❌ excluded; future channel |
| **Exposure / dose evidence** | How much *time-on-task* did the patient log against this target? | `trial_mode = 'exposure'` | ❌ excluded from mastery; partially captured by dose logs |

These four channels are **not interchangeable**. Collapsing any two of
them into a single "mastery score" produces clinically invalid signal —
which is exactly what P0-A was undoing.

---

## 2. Routing contract (target state)

Today's `routeTrialMode` returns `expressive | excluded | skipped_unknown`.
The target verdict set is:

```
production   → "expressive"
recognition  → "receptive"
scaffolded   → "assisted"
exposure     → "exposure"
mixed        → "skipped_unknown"   (per-trial mixed = defect)
null/missing → "skipped_unknown"   (adopted slugs only)
```

**Critical invariant.** Each channel is its own row / vector / track.
A trial contributes to **at most one** channel. There is no
weighted-average across channels. There is no "blended mastery score".

For non-adopted slugs the legacy behavior continues to route everything
to `expressive` until the slug is explicitly adopted. Adoption order
should follow the same one-slug-at-a-time discipline as the existing
recency standard.

---

## 3. Clinical semantics

### 3.1 Expressive production mastery (already implemented)
- Trial: unaided naming, sentence completion, retell production.
- Signal: `is_correct` under `cue_level = 0` weighted by cue independence
  on supported correct trials.
- Clinical claim: *retrieval + production is intact at this difficulty.*
- This is the only channel that should drive UP escalation eligibility,
  scaffold withdrawal, and visible "Levels" progress in the long run.

### 3.2 Receptive recognition mastery (new channel)
- Trial: choice-tap, minimal-pair discrimination, comprehension probes,
  recognition foils in Photo Naming.
- Clinical claim:
  - **preserved semantic access** at this difficulty
  - **cue-responsive retrieval support** is plausible
  - patient can disambiguate target vs distractor
- Explicitly **NOT** a claim about expressive naming recovery.
  A patient can be at 90% recognition and 20% production — the channels
  must be allowed to diverge.
- Should be reported separately in clinician analytics with a clear
  label: e.g. "Recognition: 88% (12 trials)" sitting alongside
  "Expressive: 22% (8 trials)", never averaged.

### 3.3 Assisted / scaffolded evidence (new channel)
- Trial: production attempts under explicit cue / phonemic prompt /
  semantic prompt / written scaffold / caregiver cueing.
- Clinical claim:
  - patient can produce the target **with support**
  - useful for **support-withdrawal planning** (taper schedule)
  - useful for **caregiver coaching** ("they can do this with the first
    sound — try that prompt at home")
- Explicitly **NOT** independent mastery. Must never substitute for
  expressive mastery in level decisions.
- Pairs naturally with the future scaffold state machine: assisted
  evidence is the input that justifies a withdrawal step; expressive
  evidence is the input that confirms it stuck.

### 3.4 Exposure / dose evidence (existing dose logs)
- Trial: items the patient saw/heard but was not scored on (introductory
  items, demos, repetition rounds).
- Clinical claim: **time-on-task only**. No mastery claim of any kind.
- Already partially captured by dose logs (`useDoseLogs`,
  `dose_cap` enforcement). The mastery layer should keep ignoring it;
  this section exists only to make the deliberate exclusion explicit.

---

## 4. Storage strategy (options)

Three viable storage shapes. Listing pros/cons; **recommending Option B**.

### Option A — Separate row per channel in `user_skill_mastery`
Add a `mastery_channel` column to the existing table; primary key
becomes `(profile_id, skill_slug, mastery_channel)`.

- ✅ Smallest schema delta.
- ✅ Reuses `computeMastery` with a per-channel partition.
- ⚠️ Forces every consumer of `user_skill_mastery` to filter by
  channel, or risk silently summing across channels.
- ⚠️ Confidence/velocity semantics differ per channel; one column set
  starts to feel overloaded.
- ⚠️ Snapshot table (`skill_mastery_history`) inherits the same
  channel-fanout problem.

### Option B — Channel-typed columns on the same row *(recommended)*
Keep one row per `(profile_id, skill_slug)` but add per-channel score
columns:

```
expressive_mastery_score, expressive_confidence, expressive_trials_recent
receptive_mastery_score,  receptive_confidence,  receptive_trials_recent
assisted_evidence_score,  assisted_confidence,   assisted_trials_recent
```

(`mastery_score` / `confidence` stay as aliases of the expressive
columns for backward compatibility during migration, then deprecate.)

- ✅ Impossible to accidentally average two channels — they live in
  named columns with explicit clinical meaning.
- ✅ One row per skill keeps clinician views simple ("Apple — Expressive
  22% / Receptive 88% / Assisted 64%").
- ✅ Snapshot table mirrors the same column shape.
- ⚠️ Schema is wider; future channels require migrations rather than
  inserts. Acceptable: the channel set is small and stable
  (production / recognition / scaffolded / exposure).

### Option C — Separate table for assisted + exposure evidence
Keep `user_skill_mastery` strictly expressive + receptive (Option B
shape, two channels), and put assisted + exposure into a sibling
`user_skill_support_evidence` table.

- ✅ Cleanly separates "mastery" from "support behavior".
- ✅ Lets assisted evidence carry richer fields (cue type, scaffold
  level distribution, caregiver-cued flag) without bloating the
  mastery table.
- ⚠️ Two tables to query for any clinician dashboard.
- ⚠️ Some duplicated bookkeeping (last_practiced_at, model_version).

**Recommendation.** Adopt Option B for `expressive` + `receptive`, and
adopt the spirit of Option C for assisted evidence — i.e. assisted
gets a dedicated sibling table later because its fields genuinely
differ from a scalar mastery score (cue-type histogram, withdrawal
trajectory). Exposure stays in dose logs.

This recommendation is non-binding until a separate implementation PR
re-evaluates it against real data.

---

## 5. Interaction with existing systems

This section is the load-bearing part of the spec. Each existing system
has a stated rule for how the new channels affect (or do not affect) it.

### 5.1 `MasterySignalRouting`
- Today: returns `expressive | excluded | skipped_unknown`.
- Target: returns `expressive | receptive | assisted | exposure | skipped_unknown`.
- Migration path: add new verdicts as additional return values; existing
  consumers that only switch on `expressive` continue to work
  (everything else is treated as "not for me").

### 5.2 `computeMastery`
- Today: scalar EWMA over a single stream of trials.
- Target: **the same function, called once per channel**, on the
  pre-routed subset for that channel. Not made polymorphic, not made
  channel-aware. The router does the work; `computeMastery` stays pure.
- Cue-independence math is meaningful for the expressive channel only.
  For receptive, "cue independence" is not a coherent concept — the
  receptive `computeMastery` call should pass cue_level = 0 or use a
  receptive-specific scoring function in a later phase.

### 5.3 Anomaly gating (`docs/progression-gating-spec.md`)
- D1 / D2 / D3 are defined in terms of *production share* and
  *recognition share* — they already presuppose multi-channel evidence.
  The new channels make those rules more meaningful, not less.
- New verdict to add later: gating rules may produce per-channel
  verdicts (`drop_expressive`, `drop_receptive`) instead of one global
  drop. **Out of scope for v1 of the gate.**

### 5.4 Scaffold state machine (future)
- Assisted evidence is the natural input for "is this patient ready for
  scaffold withdrawal?".
- Withdrawal is *confirmed* by expressive evidence at the lower
  scaffold level — not by more assisted evidence at the same level.
- The scaffold state machine MUST consume the assisted channel
  separately from the expressive channel. Collapsing them re-introduces
  exactly the inflation P0-A removed.

### 5.5 Visible level projector (Glance Cards: Levels, Progress)
- Visible levels remain driven by **expressive mastery only**.
- Receptive mastery is **not** shown in patient-facing UI in v1.
- Receptive mastery may appear in clinician-facing UI as a separate
  read-only line ("Recognition: 88%") once shadow data is reviewed.
- Assisted evidence is clinician-facing only, ever.

### 5.6 Clinician analytics
- Each channel gets its own labeled column / sparkline. Never a single
  blended number.
- Recovery summaries should be allowed to say things like:
  > "Expressive naming has not improved (22% → 24%, low confidence),
  > but recognition is now consistent (60% → 88%) and the patient
  > succeeds at 78% with first-sound cues. Suggested next step:
  > targeted phonemic-cue practice with planned cue fade."

  The existing `generate-recovery-summary` edge function will need
  receptive + assisted inputs to compose statements like this.

---

## 6. What this spec deliberately defers

- **No DB changes now.** Recommended schema (Option B + assisted
  sibling) is documented but not migrated.
- **No scoring changes now.** `computeMastery` stays scalar.
- **No receptive mastery implementation now.** No new tables, no new
  routing branches, no new UI.
- **No weighted / graded / vector mastery now.** Visibility-only fields
  on `MasteryTrial` (`gradedScore`, `scoreVector`, `signalGranularity`)
  remain unconsumed. Graded mastery is its own future phase and its own
  future spec.
- **No new clinician UI now.** Even read-only receptive/assisted
  surfacing waits for shadow data review.
- **No automatic progression effects from receptive/assisted.** Even
  once those channels exist, they do **not** drive UP escalation in v1
  of the receptive/assisted rollout. Clinician-visible only.

---

## 7. Rollout sequence

Each phase ships independently. Each phase has a clean rollback (drop
the new channel; existing systems are unaffected because nothing
depends on it yet).

**Phase R0 — This spec.** Architecture only. No code.

**Phase R1 — Shadow capture.** Extend `MasterySignalRouting` to return
`receptive` and `assisted` verdicts (still no consumer). Extend
`flushMasteryShadow` to compute and write per-channel scores into a
**new shadow-only table** (e.g. `user_skill_mastery_channels_shadow`).
No reads, no UI, no gating impact. Runs alongside the existing
expressive flush.

**Phase R2 — Dev review.** A `/dev/receptive-shadow` page (or extension
of `/dev/mastery-shadow`) renders the shadow channel data side-by-side
with expressive mastery for clinician review. ≥ 2 weeks of real
sessions before proceeding. Acceptance criterion: clinician reviewers
agree the per-channel breakdowns match their bedside intuition for
sampled patients.

**Phase R3 — Clinician-facing read-only display.** Promote receptive
and assisted from shadow to the canonical mastery table (Option B
schema). Surface them as labeled lines in the Patient Hub Levels card
drawer. Patient-facing UI unchanged. Still no gating impact.

**Phase R4 — Optional progression influence (much later).** Only after
R3 has ≥ 4 weeks of clean data and a documented clinical rule. Examples
of rules that *might* eventually be considered (none committed):
- Receptive ≥ 80% sustained may unlock assisted-channel practice
  recommendations.
- Assisted ≥ 70% with stable expressive trend may justify a scaffold
  withdrawal step in the scaffold state machine.

These remain hypothetical until R3 data is in.

---

## 8. Non-goals (explicit)

- This spec does not redefine `TrialMode`. It consumes the existing
  frozen enum.
- This spec does not modify the gating spec's verdict vocabulary.
- This spec does not propose a "unified mastery score". The whole point
  is that no such number exists.
- This spec does not change patient-facing language, levels, or
  Glance Cards.
- This spec does not commit to receptive/assisted ever influencing
  automatic progression. That decision is reserved for Phase R4 and
  requires its own clinical sign-off.

---

## 9. Change process

- Edits to this document land before edits to `MasterySignalRouting`,
  the mastery schema, or any new shadow table.
- New evidence channels are not added without first updating §1, §2,
  and §5.
- Once Phase R1 ships, this document moves from "spec" to "contract";
  changes then require the same checklist-versioning discipline as
  `docs/telemetry-validation-checklist.md`.
