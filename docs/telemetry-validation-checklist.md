# Granular Telemetry Validation Checklist

**Status:** v0.1 — source of truth for `adaptation_trial_logs` granular fields
(`trial_mode`, `graded_score`, `score_vector`, `signal_granularity`,
`scaffold_level`, `dominant_axis`, `archetype`).

Anomaly detection, dashboards, and drill-down views MUST validate against
this document. Update this checklist BEFORE adding new rules in code.

Scope: Photo Naming is the only producer today. Each new game adds a
**Game Contract** section before its telemetry is trusted.

---

## 1. Schema-Level Invariants (hard — DB trigger or anomaly = error)

These are violations of the frozen progression spec. They should never occur.

| ID  | Rule | Severity |
|-----|------|----------|
| S1  | `trial_mode ∈ {production, recognition, exposure, scaffolded, mixed}` or NULL | error |
| S2  | `signal_granularity ∈ {boolean, graded, multi-dimensional}` or NULL | error |
| S3  | `dominant_axis ∈ {content-complexity, pressure-retention, scaffold-independence, recognition-to-production, mixed}` or NULL | error |
| S4  | `archetype ∈ {content-expanding, performance-pressure, hybrid, open-ended}` or NULL | error |
| S5  | `graded_score ∈ [0,1]` or NULL | error |
| S6  | If `signal_granularity = 'boolean'` then `graded_score IS NULL` and `score_vector IS NULL` | error |
| S7  | If `signal_granularity = 'graded'` then `graded_score IS NOT NULL` | error |
| S8  | If `signal_granularity = 'multi-dimensional'` then `score_vector IS NOT NULL` and is a JSON object | error |
| S9  | `scaffold_level >= 0` when present | error |
| S10 | If any granular field is set, `archetype` and `dominant_axis` SHOULD also be set (logger contract) | warn |

DB trigger `validate_adaptation_trial_log_granular` already enforces S1–S5.
S6–S10 are anomaly-detector responsibilities (Phase 2).

---

## 2. Cross-Field Semantic Invariants

| ID  | Rule | Severity |
|-----|------|----------|
| C1  | `trial_mode='production'` + `correct=true` → `response_text` non-empty (otherwise ASR misrouting) | warn |
| C2  | `trial_mode='recognition'` → `response_text` may be empty (chip-only is valid) | info |
| C3  | `trial_mode='scaffolded'` → some scaffold signal must exist (`scaffold_level > 0` OR caregiver-rated flag in payload) | warn |
| C4  | `trial_mode='exposure'` → `correct` SHOULD be NULL or omitted from mastery (no judgement implied) | warn |
| C5  | `trial_mode='mixed'` → only allowed when a single trial spans modes; require explicit per-trial justification in `outputs` | warn |
| C6  | `archetype='content-expanding'` → `dominant_axis ∈ {content-complexity, recognition-to-production}` | warn |
| C7  | `archetype='performance-pressure'` → `dominant_axis = 'pressure-retention'` | warn |
| C8  | `archetype='open-ended'` → `signal_granularity ∈ {graded, multi-dimensional}` (boolean is suspect) | warn |
| C9  | `archetype='hybrid'` → may use any axis but must declare it | info |

---

## 3. Distributional Invariants (per session, per slug, per 7-day window)

These are the "live observation" rules — anomaly detector watches for drift.

### 3.1 Mode mix (Photo Naming, per session)

| ID  | Rule | Severity |
|-----|------|----------|
| D1  | `production` share ≥ 30% of scored trials in a Photo Naming session | warn |
| D2  | `recognition` share ≤ 60% in a Photo Naming session | warn — "recognition inflation" |
| D3  | `scaffolded` share ≤ 40% in a Photo Naming session | warn — "scaffold inflation" |
| D4  | Untyped (`trial_mode IS NULL`) share = 0% for slugs that have adopted the contract | error — logger gap |

### 3.2 Accuracy stratification

| ID  | Rule | Severity |
|-----|------|----------|
| D5  | Recognition accuracy SHOULD be ≥ production accuracy on the same items (ceiling effect) | info — flag if reversed by >20pp over 50+ trials |
| D6  | Scaffolded accuracy SHOULD be ≥ production accuracy on the same items | info — flag if reversed |
| D7  | Production accuracy in a single session within [0.0, 1.0]; absolute 100% over ≥10 production trials → suspect mislabeling | warn |

### 3.3 Scaffold trajectory (cross-session, per user × slug)

| ID  | Rule | Severity |
|-----|------|----------|
| D8  | Across 8+ recent sessions, `scaffold_level` mean should trend flat or down — sustained upward trend without accuracy drop = scaffold creep | warn |
| D9  | `scaffolded` share trending up while `production` share trending down at stable accuracy → withdrawal regression | warn |

---

## 4. Logger Contract (per slug)

Each game emitting granular telemetry MUST declare these in code (and mirror here):

- `archetype` (constant per slug, or per-trial if hybrid)
- `dominantAxis` (constant per slug)
- `signalGranularity` (constant per slug; sets which score field is required)
- Mapping of UI input path → `trialMode`:
  - speech / ASR → `production`
  - choice chip / tap → `recognition`
  - caregiver-rated retrieval → `scaffolded`
  - timed exposure with no answer → `exposure`
- Backward compat: legacy callers omitting all granular fields MUST still write the row (all new columns nullable).

### 4.1 Game contracts

#### photo_naming (LIVE)
- archetype: `content-expanding`
- dominantAxis: `recognition-to-production`
- signalGranularity: `boolean`
- trialMode mapping:
  - spoken answer (correct/incorrect/timeout after speech path) → `production`
  - chip tap → `recognition`
  - caregiver "they got it" → `scaffolded`
  - timeout with no input attempt → `production` (still a production failure)

#### narrative_retell (NOT YET WIRED)
- expected archetype: `open-ended`
- expected granularity: `graded` or `multi-dimensional`
- DO NOT wire until graded score contract is defined.

#### sentence_construction (NOT YET WIRED)
- expected archetype: `hybrid`
- DO NOT wire until scaffold-state-machine spec lands.

---

## 5. Anomaly Detector Output Contract (Phase 2 prep)

When anomaly detection is built, every flagged row/aggregate must emit:

```
{
  rule_id: "D2",
  severity: "warn" | "error" | "info",
  scope: "trial" | "session" | "user_slug_window",
  scope_ref: { trial_log_id?, session_id?, user_id?, exercise_slug?, window? },
  observed: { ... },
  expected: { ... },
  checklist_version: "0.1"
}
```

Stored in `adaptation_trial_log_anomalies` (to be created in Phase 2).
Dashboards consume this table — they do NOT recompute rules.

---

## 6. Change Process

1. Propose a new rule here as a PR-style edit (new ID, severity, rationale).
2. Only after merge: implement in anomaly detector.
3. Only after detector ships: visualize in dashboard.
4. Never inline a rule in a dashboard query — dashboards reflect this doc, never extend it.

Removing or relaxing a rule requires a note in this section with date + reason.

---

**Owner:** progression theory layer
**Linked spec:** `src/lib/leveling/progressionArchetypes.ts` (frozen v0.3.0-spec)
**Linked logger:** `src/hooks/useAdaptationTrialLogger.ts`
**Linked DB:** `validate_adaptation_trial_log_granular` trigger on `adaptation_trial_logs`
