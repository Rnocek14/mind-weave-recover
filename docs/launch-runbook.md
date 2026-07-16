# Launch Runbook — NeuroRecover

**Scope:** Everything required to take the current branch
(`claude/stroke-recovery-qa-audit-min40j`) live, verify it, and operate the
Voice Engine v2 shadow rollout after launch.
**Last updated:** 2026-07-16 (V2.1 Phases 1–4 complete).

---

## 0. What is where

- **In `main` already (PR #1 merged):** the QA-audit fix waves — RPC/edge-function
  auth lockdown, data-integrity fixes, routing/UX/clinical fixes.
- **On the branch, NOT in `main` yet (7 commits):**
  1. Photo Naming validity test matrix
  2. **Reliability fixes** — sessions no longer end mid-practice
     (pagehide/visibility/sweeper), voice input patience for aphasic speech
  3. Voice Engine v2 design spec (`docs/voice-engine-v2-spec.md`)
  4. V2.1 Phase 1 — raw/cleaned transcript capture
  5. V2.1 Phase 2 — shadow axis engine
  6. V2.1 Phase 4 — clinician evidence panel + Voice Practice quarantine
  7. V2.1 Phase 3 — advisory axes + shadow hardening

A dry merge against `main` shows **zero conflicts**.

---

## 1. Merge to main

Open/merge a PR from `claude/stroke-recovery-qa-audit-min40j` → `main`.
The reliability fixes alone are launch-critical (they resolve the
"session ended halfway through" patient-facing failure).

## 2. Apply database migrations

Two new migrations ship on this branch (both **additive, idempotent,
nullable/defaulted — safe to run against the live database with existing rows;
no downtime, no data rewrite**):

| Migration | What it adds |
|---|---|
| `20260710160000_voice_engine_v2_phase1_capture.sql` | `utterance_analyses`: raw/cleaned transcript capture columns + `engine_version`; `exercise_events`: `engine_version` |
| `20260710161500_voice_engine_v2_phase2_shadow.sql` | `exercise_events`: shadow verdict columns (`axis_scores`, `strategy_used`, `measurement_confidence`, `verdict_primary`, `verdict_reason`, `shadow_v1_agreement`) |

**Via Supabase CLI** (from a machine with project access):

```bash
supabase link --project-ref wjedbpjaiqdxhmjzkcxo
supabase db push          # applies pending migrations in supabase/migrations
```

(If this project is managed through Lovable, its Supabase sync applies pending
migrations on deploy — confirm both files show as applied.)

**Verify** (SQL editor):

```sql
-- Both should return the new columns:
select column_name from information_schema.columns
 where table_name = 'utterance_analyses'
   and column_name in ('cleaned_transcript','cleaning_events','raw_transcript_browser',
                       'raw_transcript_azure','source_confidences','sources_agreed','engine_version');

select column_name from information_schema.columns
 where table_name = 'exercise_events'
   and column_name in ('engine_version','axis_scores','strategy_used',
                       'measurement_confidence','verdict_primary','verdict_reason','shadow_v1_agreement');
```

## 3. Redeploy changed edge functions

Two edge functions changed on this branch:

```bash
supabase functions deploy sweep-stale-sessions        # staleness = last activity, not session age
supabase functions deploy compute-adaptation-profile  # excludes quarantined/invalid rows from adaptation
```

## 4. Regenerate Supabase types (non-blocking)

The app writes the new columns through untyped payloads, so this is hygiene,
not a blocker:

```bash
supabase gen types typescript --project-id wjedbpjaiqdxhmjzkcxo > src/integrations/supabase/types.ts
```

## 5. Post-deploy smoke pass (~10 minutes, real device)

The sandbox verification covered unit (1230 passed), typecheck, lint (0
errors), and production build — but could not drive authenticated flows
against the live backend. One human pass on a phone:

1. **Photo Naming, 3–4 trials by voice** — say one correct, one wrong,
   one description ("the thing you cut with"), one silence.
   - Trials advance smoothly; no premature "session complete".
2. **Background the app mid-session for 2 minutes, return** — session resumes,
   is NOT ended.
3. **Voice Practice, 2 rounds** — completion screen says
   "Practice Complete" with Completed/Skipped (no percentage).
4. **Clinician → Session Review** for that session:
   - "What happened on each attempt" section renders with the
     "Preview — new scoring model" banner.
   - Expand an attempt: named states ("Fully conveyed" etc.), evidence lines,
     advisory rows tagged "advisory — never gates" (pronunciation appears only
     if Azure PA ran).
5. **SQL spot-check** that capture is flowing:

```sql
select cleaned_transcript, cleaning_events, verdict_primary, strategy_used
  from exercise_events e
  join utterance_analyses ua using (attempt_id)
 order by e.created_at desc limit 5;
```

## 6. Launch gates — status

| Gate | Status |
|---|---|
| Security fix waves (RPC/edge auth) | ✅ merged in PR #1 |
| Session-reliability fixes | ⬜ on branch — **merge required** |
| Unit suite / typecheck / lint / build | ✅ 1230 passed · clean · 0 errors · builds |
| Migrations applied to live DB | ⬜ step 2 |
| Edge functions redeployed | ⬜ step 3 |
| Real-device smoke pass | ⬜ step 5 |
| Voice Practice quarantine | ✅ shipped (5 fences) |
| v1 scoring authoritative everywhere | ✅ by design — shadow only |

## 7. After launch — operating the shadow rollout

- Every voice attempt now logs both verdicts. **Weekly**, review the diff:

```sql
select shadow_v1_agreement->>'agrees' as agrees,
       verdict_primary, strategy_used, count(*)
  from exercise_events
 where verdict_primary is not null
 group by 1, 2, 3
 order by count(*) desc;
```

- Disagreements are also visible per-attempt in Session Review (flagged
  "disagrees with current scoring") — review them with an SLP.
- **The Phase 5 flip** (v2 verdicts start gating progression) happens only
  after that review says the shadow is trustworthy. It is deliberately not
  implemented yet (`docs/voice-engine-v2-spec.md` §12).
- Deferred by design, not gaps: sentence-level CIU scoring + Voice Practice
  rebuild (V2.2); confidence-gate calibration (V2.2); advisory-axis promotion
  (V2.3+); Recovery Signature (V2.2+).
