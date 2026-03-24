# NeuroSpark — Full Role-Based UX & Data Audit

Generated: 2026-03-24

---

## 1. NAVIGATION STRUCTURE BY ROLE

### 👤 Patient Mode
**Header Nav**: Dashboard → Insights → History
**Home**: `/dashboard`
**Pages accessible**:
| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard` | PatientModeView | Simple motivational view (streak, progress, start session) |
| `/insights` | Insights | 6-tab intelligence hub (Overview, Progress, What's Hard, What Helps, How It's Adapting[hidden], Alerts) |
| `/history` | History | Session list with drill-down |
| `/exercise/*` | 18 exercise pages | Immersive game play |
| `/lesson` | Lesson | Guided session flow |
| `/photo-library` | PhotoLibrary | Personal photo management |
| `/speech-profile` | SpeechProfile | Trust page: what system knows about you |
| `/recovery-progress` | RecoveryProgress | Longitudinal outcomes (beta) |

### 👪 Caregiver Mode
**Header Nav**: Same as Patient (Dashboard → Insights → History)
**Dedicated Entry**: `/caregiver` (CaregiverPortal)
**Pages accessible**: All Patient pages + CaregiverPortal
| Route | Page | Purpose |
|-------|------|---------|
| `/caregiver` | CaregiverPortal | 2-tab view (Overview + Alerts), adherence tracker |
| `/dashboard` | Dashboard | Full 4-tab Recovery Profile Hub (not PatientModeView) |
| `/clinical-documents` | ClinicalDocuments | Upload/manage clinical notes |
| `/profile-history` | ProfileVersionHistory | View profile version changes |

### 🧑‍⚕️ Clinician Mode
**Header Nav**: Caseload → Review → Insights → History
**Home**: `/clinician/caseload` (auto-redirect from `/dashboard`)
**Pages accessible**: All Caregiver pages + Clinician routes
| Route | Page | Purpose |
|-------|------|---------|
| `/clinician/caseload` | ClinicianPanel | Triage caseload, filter/sort patients |
| `/clinician/review` | WeeklyPatientReview | 751-line single-screen decision surface |
| `/clinician/report` | ClinicianReport | Print/export clinical report |
| `/dashboard` | Dashboard → **REDIRECTS** to /clinician/review | — |

### 🧑‍💻 Admin Mode
**Header Nav**: Same as Clinician
**Pages accessible**: All Clinician pages + Admin routes
| Route | Page | Purpose |
|-------|------|---------|
| `/admin` | Admin | 3-tab panel (Clinical Review, Photo Library, Tools) |
| `/admin/pipeline` | AdminPipeline | Processing pipeline health |
| `/admin/analytics` | ParserAnalytics | Parser accuracy analytics |
| `/admin/research-export` | ResearchExport | Data export for research |
| `/admin/outcomes-validation` | OutcomesValidation | Metric validation sandbox |
| `/analytics/cluster` | ClusterAnalytics | Cluster comparison analytics |

---

## 2. PAGE-BY-PAGE COMPONENT AUDIT

### `/dashboard` — Recovery Profile Hub (Caregiver/Patient)

#### Overview Tab
| Component | Data Source | Patient | Caregiver | Classification |
|-----------|-----------|---------|-----------|---------------|
| RedFlagAlerts | useRedFlagDetection | 🟢 Essential | 🟢 Essential | Safety-critical |
| ReadinessStatusCard | useDailyReadiness | 🟢 Essential | 🟡 Useful | Daily check-in |
| DailyReadinessCheckin | useDailyReadiness | 🟢 Essential | 🔴 Noise | Patient action |
| "Start Today's Session" CTA | useDailyLesson | 🟢 Essential | 🟡 Useful | Primary action |
| "Choose a Game" button | — | 🟢 Essential | 🟡 Useful | Alt action |
| Targeted Practice CTA | nav state | 🟢 Essential | 🟡 Useful | Closed-loop |
| DoseCap progress bar | useDoseCap | 🟡 Useful | 🟡 Useful | Safety |
| WeeklyDeltasCard | useWeeklyRecoverySnapshot | 🟢 Essential | 🟢 Essential | "Am I improving?" |
| CaregiverTodayCard | — | — | 🟢 Essential | Caregiver-specific |
| InsightsCTACard | — | 🟡 Useful | 🟡 Useful | Navigation |
| DomainConfidenceSummary | useCognitiveState | 🔴 Noise | 🔴 Noise | Too clinical |
| ClinicianPatientHeader | — | 🔴 Noise | 🔴 Noise | Should not render |

#### Domains Tab
| Component | Data Source | Patient | Caregiver | Classification |
|-----------|-----------|---------|-----------|---------------|
| CognitiveStateCard (x7) | useCognitiveState | 🔴 Noise | 🔴 Noise | Too clinical for patient |
| ICF groupings | COGNITIVE_DOMAINS | 🔴 Noise | 🔴 Noise | Clinical framework |
| DomainDetailRow with confidence/components | cognitive_domain_scores | 🔴 Noise | 🔴 Noise | Technical |

#### Progress Tab
| Component | Data Source | Patient | Caregiver | Classification |
|-----------|-----------|---------|-----------|---------------|
| Adherence strip (7d) | useWeeklyRecoverySnapshot | 🟢 Essential | 🟢 Essential | Key engagement |
| Fatigue/Mood/Sleep cards | useDailyReadiness | 🟡 Useful | 🟡 Useful | PRO data |
| WeeklyRecoverySnapshot | useWeeklyRecoverySnapshot | 🟢 Essential | 🟢 Essential | Visual trend |
| TodaysActivityCard | exercise_events | 🟡 Useful | 🟡 Useful | Today's stats |
| ActivityTrendChart | sessions | 🟡 Useful | 🟡 Useful | Activity graph |
| TodaysSessionStats | exercise_events | 🟡 Useful | 🔴 Noise | Detailed stats |
| WeeklyTrendsChart | exercise_events | 🟡 Useful | 🟡 Useful | Weekly graph |
| ExerciseStatsTile x3 | exercise_events | 🟡 Useful | 🔴 Noise | Per-game stats |
| RecoverySnapshot (AI) | recovery_summaries | 🟢 Essential | 🟢 Essential | AI narrative |

#### Plan Tab
| Component | Data Source | Patient | Caregiver | Classification |
|-----------|-----------|---------|-----------|---------------|
| Today's Focus Rationale | useDailyLesson | 🟢 Essential | 🟡 Useful | "Why this plan" |
| Dosing Guidance | useDoseCap | 🟡 Useful | 🟡 Useful | Safety |
| TodaysPlanCard + Start | useDailyLesson | 🟢 Essential | 🟡 Useful | Primary action |
| DoseLogEntry | useDoseLogs | 🟡 Useful | 🟡 Useful | Manual logging |
| FunctionalGoalsWidget | functional_goals | 🟢 Essential | 🟢 Essential | Goal tracking |
| RecentSessionsSummary | sessions | 🟡 Useful | 🟡 Useful | History snippet |
| StrokeProfileSummary | clinical_profile | 🔴 Noise (patient) | 🟡 Useful (cg) | Clinical detail |
| BrainMap | clinical_profile | 🔴 Noise | 🔴 Noise | Too clinical |
| MechanismSessionPlanner | clinical_profile | 🔴 Noise | 🔴 Noise | Clinician tool |
| StandardizedAssessmentsCard | — | 🔴 Noise | 🔴 Noise | Clinician tool |
| CaregiverContextNotes | caregiver_context_notes | 🔴 Noise | 🟡 Useful | Caregiver notes |

### `/insights` — Insights Page

| Tab | Components | Patient | Caregiver | Classification |
|-----|-----------|---------|-----------|---------------|
| Overview | AnalyticsSnapshotCard (4 cards: accuracy trend, top struggles, best strategy, alert count) | 🟢 Essential | 🟢 Essential | Quick pulse |
| Progress | LearningRateCard, domain trends, cluster comparison | 🟡 Useful | 🟡 Useful | Learning rates may confuse patients |
| What's Hard | Struggling words, phonemes, PracticeNow buttons | 🟢 Essential | 🟢 Essential | Actionable |
| What Helps | Cue effectiveness, best strategies | 🟡 Useful | 🟡 Useful | Informative |
| How It's Adapting | AdaptationTimeline, proof panel | 🟡 Useful (cg+) | 🟡 Useful | System transparency |
| Alerts | Red flag alerts, recovery alerts | 🟢 Essential | 🟢 Essential | Safety |

### `/caregiver` — Caregiver Portal

| Component | Data Source | Classification |
|-----------|-----------|---------------|
| Overview → OverviewSection (shared) | useAnalyticsSnapshot | 🟢 Essential |
| SessionAdherenceTracker | calculateStreak | 🟢 Essential |
| Alerts → AlertsSection (shared) | useRedFlagDetection | 🟢 Essential |
| "View full Insights" link | — | 🟡 Useful |

### `/clinician/review` — Weekly Patient Review (751 lines)

| Section | Components | Classification |
|---------|-----------|---------------|
| **Summary Bar** (always visible) | Accuracy, trials, active days, fatigue, engagement score, sparkline | 🟢 Essential |
| **Clinical Interpretation** (always visible) | Rule-based narrative: what changed, why, what to do | 🟢 Essential |
| **Pending Suggestions** (always visible) | System-generated clinician action items | 🟢 Essential |
| **Week-over-Week Deltas** (always visible) | Accuracy Δ, trials Δ, fatigue Δ, active days Δ | 🟢 Essential |
| **Next Actions** (always visible) | ActionableNextSteps with EHR copy | 🟢 Essential |
| **Recordings** (collapsible) | ClinicalRecordingPicks (best + hardest) | 🟡 Useful |
| **Alerts** (collapsible) | Recovery alerts + red flags | 🟢 Essential |
| **Patient & Plan** (collapsible) | ProfileSummaryCard + WhyThisPlan (Therapy Focus Map) | 🟢 Essential |
| **Longitudinal Comparison** (collapsible) | LongitudinalUtteranceComparison | 🟡 Useful |
| **Deep Dive** (collapsible) | Domain trial breakdown, dose compliance | 🟡 Useful |
| **Sticky Documentation Bar** | Copy to clipboard, print, progress note | 🟢 Essential |

### `/clinician/caseload` — Caseload Triage

| Component | Data Source | Classification |
|-----------|-----------|---------------|
| PatientCard list | useClinicianCaseload | 🟢 Essential |
| CaseloadFilters (risk, engagement, sort) | — | 🟢 Essential |
| Triage rollup (critical, alerts, inactive) | derived | 🟢 Essential |

### `/admin` — Admin Panel

| Tab | Components | Classification |
|-----|-----------|---------------|
| Clinical Review | ClinicalReviewDashboard (utterance review) | 🟢 Essential |
| Photo Library | PhotoLibraryAdmin | 🟡 Useful |
| Tools | AdminTools (speech profile compute, etc.) | 🟢 Essential |

### `/recovery-progress` — Recovery Progress (Beta)

| Component | Data Source | Classification |
|-----------|-----------|---------------|
| Accuracy Trajectory card + chart | useLearningRate | 🟢 Essential |
| Cue Independence card | useCueIndependence | 🟢 Essential |
| Word Mastery card (mastered/emerging/struggling) | useWordMastery | 🟢 Essential |
| Error Quality card | useErrorQualityScore | 🟢 Essential |
| Early vs Recent comparison block | useCueIndependence | 🟢 Essential |
| Clinical disclaimer | — | 🟢 Essential |

---

## 3. REDUNDANCY MAP

| Data Point | Shown In | Problem |
|-----------|----------|---------|
| **Accuracy trend** | Dashboard ProgressTab (WeeklyTrendsChart), Insights Overview (snapshot card), Weekly Review (summary bar + sparkline), Recovery Progress (trajectory chart) | 4 surfaces showing same signal differently |
| **Adherence / active days** | Dashboard ProgressTab (adherence strip), Weekly Review (summary bar), CaregiverPortal (SessionAdherenceTracker) | 3 surfaces, slightly different calculations |
| **Fatigue** | Dashboard ProgressTab (fatigue card), Weekly Review (summary bar), Dashboard OverviewTab (ReadinessStatusCard) | 3 surfaces |
| **Red flag alerts** | Dashboard OverviewTab (RedFlagAlerts), Insights Alerts tab, CaregiverPortal Alerts tab, Weekly Review Alerts section | 4 surfaces — but appropriate (safety-critical) |
| **Weekly deltas** | Dashboard OverviewTab (WeeklyDeltasCard), Weekly Review (WeekComparisonRow) | 2 surfaces, similar but different depth |
| **Today's plan / focus** | Dashboard OverviewTab (Start Session CTA), Dashboard PlanTab (TodaysPlanCard + rationale), Insights Overview | Near-duplicate CTAs |
| **Recovery AI summary** | Dashboard ProgressTab (RecoverySnapshot), Insights Progress tab | 2 surfaces for same AI narrative |
| **Domain scores** | Dashboard DomainsTab (CognitiveStateCard x7), Dashboard OverviewTab (DomainConfidenceSummary) | 2 places on same page — one should go |
| **Clinical profile** | Dashboard PlanTab (StrokeProfileSummary + BrainMap), Weekly Review (ProfileSummaryCard) | 2 surfaces — PlanTab version is noise for patients |
| **Struggling words** | Insights "What's Hard" tab, Speech Profile page | Minor overlap, acceptable |

---

## 4. MISSING CRITICAL DATA BY ROLE

### 👤 Patient — "Am I getting better? What should I do today?"

| Need | Status | Gap |
|------|--------|-----|
| Simple "you're improving" message | ✅ WeeklyDeltasCard + RecoverySnapshot | Adequate |
| Today's plan | ✅ Lesson CTA on Overview | Adequate |
| What I'm struggling with | ✅ Insights "What's Hard" | Adequate, but not surfaced on Dashboard |
| Long-term progress story | ⚠️ RecoveryProgress exists but not linked from patient flow | **Missing navigation** — patient has no path to /recovery-progress |
| Celebration / milestones | ⚠️ Achievement count shown but no milestone narrative | **Weak** |
| "Words I've mastered" | ⚠️ Only on /recovery-progress | **Should be on Dashboard** |

### 👪 Caregiver — "Is this working? Where do they need help?"

| Need | Status | Gap |
|------|--------|-----|
| Clear progress signal | ✅ OverviewSection snapshot | Adequate |
| Struggles in plain language | ⚠️ Available in Insights but CaregiverPortal only has Overview + Alerts | **CaregiverPortal missing "What's Hard" tab** |
| Session adherence | ✅ SessionAdherenceTracker | Adequate |
| Alerts | ✅ AlertsSection | Adequate |
| Long-term progress view | ❌ Not linked | **Missing** |

### 🧑‍⚕️ Clinician — "What changed, why, what to do?"

| Need | Status | Gap |
|------|--------|-----|
| Weekly performance summary | ✅ Summary Bar | Excellent |
| Clinical interpretation | ✅ ClinicalInterpretation | Excellent |
| Why this plan | ✅ Therapy Focus Map | Excellent |
| Next actions | ✅ ActionableNextSteps | Excellent |
| Long-term outcome trajectory | ⚠️ /recovery-progress exists but not integrated into Weekly Review | **Missing link from review** |
| Caseload triage | ✅ ClinicianPanel | Adequate |
| Before vs after comparison | ⚠️ LongitudinalUtteranceComparison exists but limited | Partial |

### 🧑‍💻 Admin — "Is the system working? Are outcomes improving?"

| Need | Status | Gap |
|------|--------|-----|
| Cohort-level outcomes | ❌ | **Completely missing** |
| Adaptation effectiveness | ⚠️ Per-patient only (OutcomesValidation) | **No cross-patient view** |
| Engagement vs outcomes | ❌ | **Missing** |
| System health | ⚠️ AdminPipeline exists | Partial |
| Metric validation | ✅ OutcomesValidation | Adequate for beta |

---

## 5. RECOMMENDED RESTRUCTURE

### 👤 Patient Mode — SIMPLIFY

**Question**: "Am I getting better and what should I do today?"

**Keep**:
- PatientModeView (simple, motivational)
- Insights page (all 5 patient-visible tabs)
- History
- Exercise flows

**Remove from patient view**:
- 🔴 Domains Tab entirely (ICF framework is clinical, not patient-facing)
- 🔴 DomainConfidenceSummary from OverviewTab
- 🔴 ExerciseStatsTile x3 from ProgressTab (too granular)
- 🔴 StrokeProfileSummary / BrainMap / MechanismSessionPlanner from PlanTab
- 🔴 StandardizedAssessmentsCard from PlanTab
- 🔴 ClinicianPatientHeader from OverviewTab

**Add**:
- ✅ "Words Mastered" count on PatientModeView (from useWordMastery)
- ✅ Link to /recovery-progress from Insights Progress tab
- ✅ Simple milestone celebrations ("You've mastered 12 words!")

### 👪 Caregiver Mode — FOCUS ON SUPPORT

**Question**: "Is this working and where do they need help?"

**Keep**:
- CaregiverPortal (Overview + Alerts)
- Full Dashboard (4-tab hub) for deep dives
- Insights page

**Remove from caregiver view**:
- 🔴 Domains Tab (or simplify to plain-language domain names only)
- 🔴 TodaysSessionStats from ProgressTab
- 🔴 ExerciseStatsTile x3 from ProgressTab

**Add**:
- ✅ "What's Hard" summary card on CaregiverPortal Overview tab
- ✅ Link to /recovery-progress
- ✅ Progress section on CaregiverPortal (currently only Overview + Alerts)

### 🧑‍⚕️ Clinician Mode — ALREADY STRONG, CONNECT THE PROOF

**Question**: "What changed, why, what to do?"

**Keep everything in Weekly Review** — this is already well-structured.

**Add**:
- ✅ Recovery Progress link/card in Weekly Review collapsible section
- ✅ Small "Longitudinal Outcomes" card showing 90-day trajectory headline (from /recovery-progress data) in the main flow, not just as a separate page

**Consider**:
- ⚠️ Make header nav say "Caseload" + "Review" + "Outcomes" instead of "Insights" + "History" — clinicians shouldn't need the patient-facing Insights page

### 🧑‍💻 Admin Mode — BUILD THE PROOF LAYER

**Question**: "Is the system producing recovery?"

**Keep**:
- All clinician pages
- Admin panel (Clinical Review, Photo Library, Tools)
- OutcomesValidation
- Pipeline + Parser analytics

**Add (future)**:
- ❌ Cohort outcomes dashboard (aggregate RecoveryProgress across patients)
- ❌ Adaptation effectiveness dashboard (which adaptations correlate with improvement)
- ❌ Engagement vs outcomes view

---

## 6. PRIORITY ACTION ITEMS

### Immediate (Low effort, high impact)

1. **Hide Domains Tab for patient/caregiver** — it leaks clinical complexity
2. **Hide clinician-only components from patient PlanTab** — StrokeProfileSummary, BrainMap, MechanismPlanner, StandardizedAssessments should be `isClinician` gated (some already are but BrainMap and mechanism planner still show)
3. **Add /recovery-progress to patient navigation** — currently unreachable from patient flow
4. **Add "Words Mastered" count to PatientModeView** — most emotionally resonant metric

### Medium-term (Moderate effort)

5. **Add "What's Struggling" card to CaregiverPortal** — currently caregiver portal is too thin
6. **Add Recovery Progress summary card to Weekly Review** — connect proof layer to decision layer
7. **Update clinician header nav** — replace "Insights" with "Outcomes" pointing to /recovery-progress

### Long-term (New surfaces)

8. **Build admin cohort outcomes dashboard** — aggregate recovery metrics across all patients
9. **Build patient milestone/celebration system** — "You mastered 5 new words this month!"
10. **Make header fully role-aware** — different labels, different home, different settings menu per role

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total routes | 38 (18 exercises, 20 app pages) |
| Components audited | ~85 unique components |
| 🔴 Noise items (patient view) | 12 components that leak clinical complexity |
| Redundant data surfaces | 8 data points shown 3-4x |
| Missing critical features | 4 patient, 2 caregiver, 1 clinician, 3 admin |
| Recommended removals | 6 component visibilities to gate |
| Recommended additions | 7 new links/cards/surfaces |

**The system is architecturally sound but over-exposes clinical data to patients and under-connects the longitudinal proof layer to all roles.**
