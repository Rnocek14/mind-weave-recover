# Backlog: Expand + wire aspirational discourse games

**Status:** Deferred. Non-blocking. Live clinical stack is healthy at 20/20/20 across all 13 progression-wired games (verified post-Phase 6).

## Scope

Three games currently ride the discourse adaptation engine only — design-of-record ladders published, but **no progression hook, no difficulty bridge, no mastery routing, no per-level enforcement**:

| Game | Current bank depth | Readiness flag |
|------|-------------------|----------------|
| `describe-guess` | T1=20, T2=20, T3=14 | `needs_bank_expansion` (T3 below floor) |
| `narrative-retell` | T1=10, T2=20, T3=12 | `needs_bank_expansion` (T1 + T3 below floor) |
| `abstract-compare` | T1=16, T2=16, T3=16 | thin across all tiers |

Design-of-record docs:
- `docs/clinical-evidence/describe-guess.md`
- `docs/clinical-evidence/narrative-retell.md`
- `docs/clinical-evidence/abstract-compare.md`

Ladder specs:
- `src/lib/progression/describeGuessLevels.ts` (L1–L8 aspirational)
- `src/lib/progression/narrativeRetellLevels.ts` (L1–L8 aspirational)
- `src/lib/progression/abstractCompareLevels.ts` (L1–L8 aspirational)

## Why deferred (decision rationale)

- All three games are **non-wired** to the progression engine. Bank depth doesn't change clinical behavior today.
- Discourse engine handles content rotation; recency repetition is only marginally noticeable at current depth.
- Likely tier definitions will be refined at the point we actually wire mastery routing → content written today may need re-tiering anyway.
- Topping up now is **purely additive** (cosmetic consistency); not topping up has **zero clinical cost** while unwired.

## Trigger conditions for picking this up

Pull this off backlog when any of the following becomes true:

1. We're about to wire one of these slugs into `ADOPTED_TRIAL_MODE_SLUGS` / `useTrialSubmission` (then bank depth is a prerequisite, not cosmetic).
2. A clinical study or demo will run sessions where these games appear frequently and content repetition is observable.
3. We do a coordinated "Phase 3 — wire aspirational discourse games" effort (recommended bundling).

## Recommended combined phase shape (when triggered)

1. **Re-validate tier definitions** against the design-of-record docs — confirm L1–L8 collapse to the 3-tier bank structure still holds, or refactor.
2. **Expand banks** to 20/20/20:
   - `describe-guess`: +6 T3 items (abstract / low-imageability targets aligned with L6–L7 spec).
   - `narrative-retell`: +10 T1 (short sequential 3–4 events), +8 T3 (multi-episode with theme/perspective).
   - `abstract-compare`: +4 per tier to reach 20/20/20; T3 must include some cross-category abstract pairs for L5–L7.
3. **Verify** with `contentDepthAudit.test.ts` and `contentDistinctness.test.ts`.
4. **Decide wiring scope separately** — bank expansion does NOT auto-wire. Mastery routing, difficulty bridge, and `ADOPTED_TRIAL_MODE_SLUGS` promotion are their own decisions per game and require:
   - Runtime infrastructure for scoring credits the design-of-record docs flag as "not yet at runtime" (e.g. dimensionality scoring for `abstract-compare` L6–L7, macrostructure scoring for `narrative-retell` L6–L7, novel-target bank for `describe-guess` L8).
   - Per-level mastery enforcement numerics (intentionally omitted from current specs).

## Out of scope

- Building the runtime scoring infrastructure listed above. Each is a separate phase.
- Touching the 13 currently-wired games — they are healthy.

## Related

- Closing audit: post-Phase 6 health check (all wired games 20/20/20).
- Constraint: per `mem://architecture/clinical-adaptive-engine`, no progression wiring without success-band-aligned mastery enforcement.
