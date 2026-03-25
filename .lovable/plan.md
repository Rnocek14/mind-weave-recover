
# Recovery Intelligence Platform — Implementation Plan

## Strategic Position

**From:** Speech therapy app
**To:** Out-of-Hospital Recovery Intelligence Layer

Speech is the first vertical module. PT, OT, cognitive, cardiac are future modules plugged into the same spine.

## Architecture: Three-Layer Model

| Layer | Purpose | Changes With New Disciplines? |
|-------|---------|-------------------------------|
| **Core Recovery Spine** | Readiness, dose tracking, trends, alerts, snapshot | No — therapy-agnostic |
| **Discipline Modules** | Speech telemetry, PT exercises, cognitive tasks | Yes — one module per discipline |
| **Hospital Interface** | Weekly Snapshot, team export, RTM docs, risk dashboard | No — consumes spine data |

## Database Schema (Recovery Spine)

### recovery_domains ✅ Created
Registry of discipline modules. Each domain has a `slug`, `display_name`, `dose_unit`, and `icon_name`.
Seeded: `speech`, `pt`, `ot`, `cognitive`, `activity`.

### daily_readiness ✅ Created
Patient self-report (discipline-agnostic). One row per profile per day.
- `fatigue_rating` (1-5), `fatigue_limited_practice` (bool)
- Optional: `sleep_quality`, `pain_level`, `mood_rating`, `notes`
- Unique on `(profile_id, checkin_date)` — upsert-friendly

### dose_targets ✅ Created
Prescribed dose per domain per patient. Supports time-windowed targets.
- `domain_slug` → recovery_domains, `target_value`, `target_frequency`
- `effective_from` / `effective_until` for versioned prescriptions

### dose_logs ✅ Created
Actual dose delivered per domain per day.
- `domain_slug`, `log_date`, `dose_value`, `source` (manual/auto/wearable/system)
- Optional: `intensity_score`, `quality_score`, `metadata` (jsonb)

### recovery_alerts ✅ Created
Cross-domain actionable flags for clinicians.
- `alert_type`: engagement_failure, fatigue_risk, deterioration, dose_inadequacy, plateau_risk, regression_risk
- `severity`: info, warning, critical
- `domain_slug`: nullable (NULL = cross-domain alert)
- Resolvable with `resolved_at`, `resolved_by`, `resolution_notes`

## Clinician Dashboard — Phased Build

### Sprint 1: Single-Patient Intelligence ✅ In Progress

#### Auto Progress Note Generator ✅ Done
- `src/lib/generateProgressNote.ts` — template-driven, deterministic narrative
- Numbers in, sentences out — no LLM, no clinical claims beyond data
- Data confidence assessment (high/moderate/low/insufficient)
- Headline generation for card display
- `src/hooks/useWeeklySessionStats.ts` — fetches 7d + prior 7d session/trial aggregates
- "Note" button in `ClinicianPatientHeader` with dialog showing narrative + copy

#### Plateau & Regression Alerts ✅ Done
- `plateau_risk` (info): dose + speech volume flat across 14d window, ≥60% adherence
- `regression_risk` (info/warning): speech drops >40% WoW despite engagement (≥3/7 active days)
- Both have adherence guardrails to avoid false alerts on under-dosing

### Sprint 2: Multi-Patient Caseload UI ⏳ Next
- [ ] `ClinicianPanel.tsx` — card grid for all assigned patients
- [ ] `PatientCard.tsx` — compact summary (compliance, accuracy trend, flags, fatigue sparkline)
- [ ] Temporary linking via admin-seeded list (dev phase)
- [ ] Route: `/clinician/caseload`

### Sprint 3: Clinician-Patient Linking + RLS
- [ ] `clinician_patient_links` table (clinician_user_id, patient_profile_id, role, status, assigned_at, revoked_at)
- [ ] RLS policies: clinician read-only, admin full, patient self
- [ ] Swap caseload hook to query real links

### Sprint 4: Cross-Domain Recovery Overlay
- [ ] `CrossDomainOverlayChart.tsx` — speech accuracy + steps + fatigue on aligned axes
- [ ] Daily aggregation rules (mean accuracy weighted by trials)
- [ ] Missing data handling (visual gaps, not interpolation)

### Sprint 5: Cue Effectiveness Summary
- [ ] `CueEffectivenessSummary.tsx` — cue type, success rate, usage %, independence growth
- [ ] Data from `exercise_events` (cue_type_given, cue_was_effective)

## Implementation Phases (Data Capture)

### Phase 1: Data Capture ⏳ Next
- [ ] Daily Readiness Check-in component (fatigue + optional fields)
- [ ] Manual dose logging UI (PT/OT minutes, activity)
- [ ] Auto-log speech dose from existing session data (`source = 'system'`)
- [ ] Wire existing `MoodCheckIn` into daily_readiness

### Phase 2: Weekly Recovery Snapshot ✅ Done
- [x] `useRecoverySnapshot` hook — aggregates all domains
- [x] `WeeklyRecoverySnapshot` component with domain sparklines
- [x] Dose adequacy bars (target vs actual per domain)
- [x] Auto-interpretation text
- [x] Cross-domain overlay chart (basic)

### Phase 3: Alert Engine ✅ Done
- [x] `lib/recoveryAlertDetector.ts` — rule-based alert generation
- [x] 3-day engagement failure detection
- [x] Fatigue risk (high fatigue + dose drop)
- [x] Dose inadequacy flagging
- [x] Deconditioning risk (physical inactivity)
- [x] Overexertion risk (activity spike + fatigue/dose correlation)
- [x] Plateau risk (flat dose + speech volume)
- [x] Regression risk (speech dose drop despite engagement)
- [x] Integration with existing RedFlagAlerts pattern

### Phase 4: Hospital Interface (After Pilot)
- [ ] Clinician dashboard with patient list + traffic-light status
- [ ] Weekly report export (PDF / clipboard)
- [ ] RTM documentation support
- [ ] Population risk dashboard

### Phase 5: Module Expansion (After Validation)
- [ ] Wearable integration (Apple Health / Google Fit → dose_logs)
- [ ] Additional discipline modules
- [ ] Exercise-before-speech correlation analysis

---

## Navigation Restructure (Implemented)

### Constraints Applied
1. Patient = 3 bottom tabs (Home, Practice, My Progress) — header hidden
2. Old routes (/recovery-progress, /insights, /history) kept alive for deep-links and clinician/admin access
3. Patient My Progress uses visibility tiers (always-visible hero/metrics/domains, collapsible history/achievements)
4. Caregiver = 2 header tabs (Home, Status) — Status is caregiver-first, not relabeled patient
5. Clinician = 2 header tabs (Caseload, Review) — Recovery/Insights/History demoted to settings/deep-links
6. Admin stays hub-and-spoke unchanged

### Data Mapping (nothing lost)
| Old Location | New Location |
|---|---|
| /recovery-progress metrics | My Progress → hero + metrics grid |
| /insights → Overview | My Progress → hero headline |
| /insights → What's Hard | My Progress → "Focus Next" (always visible) |
| /insights → What Helps | My Progress → "What Helps You" (always visible) |
| /insights → Alerts | My Progress → inline concern card (conditional) |
| /insights → Adaptations | Hidden from patient (caregiver+ only) |
| /history | My Progress → collapsible session history |
| Dashboard → Progress tab | Eliminated (merged into My Progress) |

## Prior Work (Speech Telemetry)

### Azure Pronunciation Assessment

| Phase | Description | Status |
|-------|-------------|--------|
| A | NBest phoneme capture + gop_data enrichment | ✅ Done |
| B | Substitution pattern aggregation in compute-speech-profile | ⏳ Next |
| C | Pronunciation diagnostics parity (Two Clues + Phrase Practice) | ⏳ Planned |
| D | Prosody score surfacing | ⏳ Deferred |

See git history for Phase A details (NBest extraction, azure-pa-v2 schema).
