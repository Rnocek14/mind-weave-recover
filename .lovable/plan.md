
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
- `alert_type`: engagement_failure, fatigue_risk, deterioration, dose_inadequacy
- `severity`: info, warning, critical
- `domain_slug`: nullable (NULL = cross-domain alert)
- Resolvable with `resolved_at`, `resolved_by`, `resolution_notes`

## Implementation Phases

### Phase 1: Data Capture ⏳ Next
- [ ] Daily Readiness Check-in component (fatigue + optional fields)
- [ ] Manual dose logging UI (PT/OT minutes, activity)
- [ ] Auto-log speech dose from existing session data (`source = 'system'`)
- [ ] Wire existing `MoodCheckIn` into daily_readiness

### Phase 2: Weekly Recovery Snapshot
- [ ] `useRecoverySnapshot` hook — aggregates all domains
- [ ] `WeeklyRecoverySnapshot` component with domain sparklines
- [ ] Dose adequacy bars (target vs actual per domain)
- [ ] Auto-interpretation text
- [ ] Cross-domain overlay chart

### Phase 3: Alert Engine
- [ ] `lib/recoveryAlertDetector.ts` — rule-based alert generation
- [ ] 3-day engagement failure detection
- [ ] Fatigue risk (high fatigue + dose drop)
- [ ] Dose inadequacy flagging
- [ ] Integration with existing RedFlagAlerts pattern

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

## Prior Work (Speech Telemetry)

### Azure Pronunciation Assessment

| Phase | Description | Status |
|-------|-------------|--------|
| A | NBest phoneme capture + gop_data enrichment | ✅ Done |
| B | Substitution pattern aggregation in compute-speech-profile | ⏳ Next |
| C | Pronunciation diagnostics parity (Two Clues + Phrase Practice) | ⏳ Planned |
| D | Prosody score surfacing | ⏳ Deferred |

See git history for Phase A details (NBest extraction, azure-pa-v2 schema).
