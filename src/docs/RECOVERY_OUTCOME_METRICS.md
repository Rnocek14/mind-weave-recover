# Recovery Outcome Metrics — Definition & Data Mapping

## Purpose

These metrics answer: **"Is this patient recovering?"**

They are NOT engagement metrics (sessions completed, time spent).
They are **functional improvement signals** — the kind that convince clinicians, hospitals, and insurers.

---

## The 7 Core Outcome Metrics

### 1. Naming Accuracy Trajectory
**What it proves:** Core word retrieval is improving over time.

**Definition:**
- 30/60/90-day smoothed accuracy trend (7-day rolling average)
- Must use weighted accuracy (trials × accuracy per session) to avoid session-length bias
- Improvement = sustained positive slope over ≥14 days (not a single good session)

**Noise filter:**
- Require ≥10 trials per 7-day window to include a data point
- Exclude sessions with <3 trials (incomplete/abandoned)
- Use accuracy_slope from `learning_rates` table (already computed) for the core signal
- Supplement with raw `exercise_events` for granular daily view

**Data sources:**
| Table | Field | Usage |
|-------|-------|-------|
| `learning_rates` | `accuracy_slope`, `confidence_score`, `start_accuracy`, `end_accuracy` | Primary trend signal |
| `exercise_events` | `score`, `created_at`, `session_id` | Daily granularity |
| `sessions` | `started_at`, `profile_id` | Session grouping |

**Clinically meaningful change:** ≥5% absolute accuracy increase sustained over 14+ days.

---

### 2. Cue Independence Index
**What it proves:** Patient needs less help over time — the strongest recovery signal.

**Definition:**
- Average cue level per session, tracked over time
- Scale: 0 (independent) → 3 (maximum cueing)
- Independence = downward trend in cue level with maintained or improved accuracy

**Why this matters more than accuracy alone:**
A patient can score 80% with heavy cueing or 60% independently.
The 60% independent patient is recovering faster.

**Calculation:**
```
cue_independence_score = (max_cue - avg_cue) / max_cue
```
Range: 0.0 (fully dependent) → 1.0 (fully independent)

**Noise filter:**
- Only count trials where cueing was available (not forced-cue exercises)
- Require ≥5 trials per data point
- Compare same exercise types across time (not mixed)

**Data sources:**
| Table | Field | Usage |
|-------|-------|-------|
| `exercise_events` | `cue_level`, `cue_type_given`, `cue_was_effective` | Primary signal |
| `cognitive_domain_scores` | `transfer_index`, `transfer_components` | Transfer validation |
| `functionalScoreCalculator` | `cueLevel` contribution (30% of functional score) | Already computed |

**Clinically meaningful change:** ≥0.5 cue level reduction sustained over 14+ days.

---

### 3. Transfer Index (Generalization)
**What it proves:** Gains generalize beyond practiced items — not just memorization.

**Definition:**
- Ratio of independent accuracy to scaffolded accuracy
- `transferIndex = independentAcc / scaffoldedAcc` (capped at 1.0)
- Independent = `cue_level === 0`; Scaffolded = `cue_level >= 1`

**Why this is critical:**
Without transfer, "improvement" may be rote memorization of practiced words.
Transfer proves the underlying language network is recovering.

**Noise filter:**
- Require ≥3 independent AND ≥3 scaffolded trials (already enforced in `cognitiveStateEngine.ts`)
- Track per cognitive domain (lexical_retrieval, phonology, syntax, etc.)

**Data sources:**
| Table | Field | Usage |
|-------|-------|-------|
| `cognitive_domain_scores` | `transfer_index`, `transfer_components` | Primary signal |
| `exercise_events` | `cue_level`, `score`, `inputs` | Raw computation |

**Clinically meaningful change:** Transfer index rising from <0.4 to >0.6 = strong generalization signal.

---

### 4. Error Pattern Evolution
**What it proves:** Error types are shifting toward less severe patterns (a hallmark of neural recovery).

**Definition — Error Severity Hierarchy (most → least severe):**
1. `no_response` (0 pts) — No output at all
2. `neologism` (1 pt) — Made-up word (severe network disruption)
3. `unrelated` (2 pts) — Real word, no connection to target
4. `semantic_paraphasia` (3 pts) — Related meaning ("fork" for "spoon")
5. `phonemic_paraphasia` (4 pts) — Related sound ("spook" for "spoon")
6. `circumlocution` (5 pts) — Described it ("the thing you eat with")
7. `correct` (6 pts) — Got it right

**Composite Error Quality Score:**
```
error_quality = weighted_average(error_points) / 6
```
Range: 0.0 (all no-response) → 1.0 (all correct)

**Recovery signal:** Error quality score trending upward = errors shifting from severe (neologisms, no response) to mild (semantic, phonemic) even before accuracy improves.

**Data sources:**
| Table | Field | Usage |
|-------|-------|-------|
| `exercise_events` | `error_type`, `error_classification` | Primary signal |
| `speech_profile_snapshots` | `error_type_distribution` | Aggregated snapshots |

**Clinically meaningful change:** Error quality score ↑ by ≥0.15 over 30 days = meaningful shift.

---

### 5. Response Latency Improvement
**What it proves:** Word retrieval is becoming faster/more automatic.

**Definition:**
- Median reaction time per session, tracked over time
- Use median (not mean) to resist outlier contamination
- Only include correct trials (latency on errors is noisy)

**Why median, why correct-only:**
- Incorrect trials have meaningless RT (patient may have given up, or said wrong word fast)
- Mean is distorted by single 10s+ outliers
- Median of correct trials = true retrieval speed

**Noise filter:**
- Exclude RT < 200ms (accidental tap) and > 15000ms (timeout/distraction)
- Require ≥5 correct trials per data point
- Track `rt_slope` from `learning_rates` for the longitudinal signal

**Data sources:**
| Table | Field | Usage |
|-------|-------|-------|
| `exercise_events` | `reaction_time_ms`, `score` | Per-trial RT |
| `learning_rates` | `rt_slope` | Longitudinal trend |

**Clinically meaningful change:** ≥300ms median RT reduction sustained over 14+ days.

---

### 6. Word Mastery Count
**What it proves:** The patient can reliably name specific words — tangible progress.

**Definition:**
A word is "mastered" when:
- ≥80% accuracy over last 5+ attempts
- Most recent attempt was correct
- At least one attempt was at cue_level ≤ 1 (some independence)

A word is "emerging" when:
- 40-79% accuracy over last 5+ attempts
- OR ≥80% but only with cue_level ≥ 2

A word is "struggling" when:
- <40% accuracy over 5+ attempts
- OR consistently requires cue_level ≥ 2

**Tracking over time:**
- Count of mastered words at each weekly checkpoint
- Upward trend = recovery
- Plateau = possible ceiling or need for intervention change

**Data sources:**
| Table | Field | Usage |
|-------|-------|-------|
| `exercise_events` | `inputs` (target word), `score`, `cue_level` | Per-word tracking |
| `exercise_events` | `outputs` (spoken word) | Error analysis |

**Note:** This metric does NOT currently exist as a computed aggregate. It must be derived from raw `exercise_events` grouped by target word.

**Clinically meaningful change:** ≥3 new words mastered per week = active learning.

---

### 7. Session Tolerance (Cognitive Endurance)
**What it proves:** Patient can sustain quality performance longer — fatigue resilience improving.

**Definition:**
- Compare accuracy in first half vs second half of session
- `endurance_ratio = second_half_accuracy / first_half_accuracy`
- Track endurance_ratio over time

**Why this matters:**
Early post-stroke: patients fatigue fast, performance collapses mid-session.
Recovery signal: sustained performance across full session.

**Supplementary signals:**
- `fatigue_sensitivity` from `cognitive_domain_scores` (already computed per domain)
- `daily_readiness.fatigue_rating` correlation with session performance
- `sessions.ended_reason` — fewer "fatigue" or "dose_cap" endings = better tolerance

**Data sources:**
| Table | Field | Usage |
|-------|-------|-------|
| `exercise_events` | `trial_index`, `score`, `session_id` | Within-session trajectory |
| `cognitive_domain_scores` | `fatigue_sensitivity` | Domain-specific fatigue |
| `daily_readiness` | `fatigue_rating`, `fatigue_limited_practice` | Subjective fatigue |
| `sessions` | `ended_reason`, `duration_sec` | Session completion |

**Clinically meaningful change:** Endurance ratio rising from <0.7 to >0.9 = significant improvement.

---

## Metric Priority for Recovery Progress Page

| Priority | Metric | Visualization | Why First |
|----------|--------|---------------|-----------|
| **P0** | Naming Accuracy | 90-day smoothed line | Most intuitive, universally understood |
| **P0** | Cue Independence | Downward trend line | Strongest clinical signal |
| **P1** | Word Mastery Count | Cumulative counter | Most emotionally compelling |
| **P1** | Error Pattern Evolution | Quality score line | Proves neural reorganization |
| **P2** | Transfer Index | Single gauge/badge | Hard to visualize, better as a label |
| **P2** | Response Latency | Small sparkline | Supporting signal, not primary |
| **P3** | Session Tolerance | Badge or sparkline | Important but secondary |

---

## What This Does NOT Include (By Design)

| Excluded Metric | Why |
|----------------|-----|
| Sessions completed | Engagement, not recovery |
| Time spent practicing | Dose adherence, not outcome |
| Streak length | Gamification, not clinical |
| Number of exercises tried | Activity, not progress |
| Raw trial count | Volume, not quality |

These belong on the patient motivation layer, NOT the outcomes layer.

---

## Confidence Tiers

Every metric should display with a confidence badge:

| Tier | Criteria | Display |
|------|----------|---------|
| **High** | ≥30 trials + ≥3 active days in window | Full confidence |
| **Moderate** | 10-29 trials OR 1-2 active days | "Limited data" note |
| **Low** | <10 trials | "Insufficient data — keep practicing" |
| **Baseline** | First 7 days of data | "Establishing baseline" |

---

## Composite Recovery Score (Future — v2)

Once individual metrics are validated, combine into a single 0-100 score:

```
recovery_score = (
  accuracy_trajectory × 0.25 +
  cue_independence × 0.25 +
  error_quality × 0.15 +
  word_mastery_growth × 0.15 +
  transfer_index × 0.10 +
  latency_improvement × 0.05 +
  session_tolerance × 0.05
)
```

Weights reflect clinical importance:
- Accuracy + Independence = 50% (core functional recovery)
- Error quality + Word mastery = 30% (depth of recovery)
- Transfer + Speed + Endurance = 20% (supporting signals)

**Do NOT ship this composite score until individual metrics are validated with real patient data.**

> **Status 2026-09-01:** an implementation exists (`useRecoveryScore.ts`,
> `SCORE_VERSION v1`) and had reached patient surfaces ahead of this rule.
> Patient exposure (Recovery Progress hero, Smart Coach summary, the
> `/recovery-score` breakdown) is now gated off behind
> `src/lib/flags/patientRecoveryScore.ts` until validation lands; clinician
> Patient Hub surfaces keep the beta-labeled score. Note the shipped v1
> weights differ from the formula above (no transfer index; latency and
> endurance at 0.10 each) — reconcile before any validation study.

---

## Data Gaps — Status

| Gap | Hook | Status |
|-----|------|--------|
| Word-level mastery tracking | `useWordMastery.ts` | ✅ Built |
| Error quality score | `useErrorQualityScore.ts` | ✅ Built |
| Endurance ratio | `useSessionEndurance.ts` | ✅ Built |
| Weekly cue independence | `useCueIndependence.ts` | ✅ Built |

All data needed already exists in `exercise_events`. No new tables required.
Only new computation/aggregation logic is needed.
