/**
 * Dashboard spotlight tour step definitions.
 *
 * Each role gets an in-place coachmark tour that highlights real elements on
 * its dashboard. Targets map to `data-tour="<id>"` attributes added to the
 * actual UI. Steps whose target isn't present (and that can't reveal it via
 * `openSteps`) are skipped at runtime, so it's safe to list conditional
 * sections here.
 *
 * `openSteps` let a step reveal a target that lives inside a collapsed drawer
 * or an inactive tab — the tour clicks the trigger first, then highlights.
 *
 * Bump TOUR_VERSION whenever the steps change meaningfully — first-visit
 * auto-run keys off this so updated tours re-introduce themselves once.
 */
import type { SpotlightStep } from "@/components/tour/SpotlightTour";

export const TOUR_VERSION = 2;

/** Tour identifiers — three non-patient role dashboards plus the patient hub. */
export type TourId = "caregiver" | "clinician" | "admin" | "patient-hub";

export const DASHBOARD_TOUR_STEPS: Record<TourId, SpotlightStep[]> = {
  caregiver: [
    {
      target: "cg-status",
      title: "Status — are they okay?",
      what: "A daily snapshot of how your loved one is doing, including any wellbeing or fatigue flags they reported.",
      why: "It's the fastest way to know if today needs a gentle check-in or extra encouragement before anything else.",
      how: "Read this first each day. If it shows a concern, scroll down to 'How You Can Help Today' for a specific suggestion.",
    },
    {
      target: "cg-practice",
      title: "Practice — did they practice?",
      what: "Whether they've practiced recently and their current streak of active days.",
      why: "Consistency drives recovery far more than long, occasional sessions. Small daily reps matter most.",
      how: "If practice dipped, a short, warm nudge — not pressure — tends to help. Even five minutes counts.",
    },
    {
      target: "cg-listen",
      title: "Listen — what did it sound like?",
      what: "Short voice samples from recent sessions so you can actually hear how their speech is going.",
      why: "Numbers don't capture everything — hearing real attempts tells you how communication feels day to day.",
      how: "Tap a clip to listen. Notice effort and clarity rather than judging single mistakes.",
    },
    {
      target: "cg-progress",
      title: "Progress — are they getting better?",
      what: "The longer-term trend across sessions, summarised in plain language.",
      why: "Recovery isn't linear. Seeing the overall direction prevents over-reacting to a single hard day.",
      how: "Look at the trend, not one data point. Celebrate steady direction over perfect numbers.",
    },
    {
      target: "cg-levels",
      title: "Levels — what are they playing at?",
      what: "The difficulty levels the exercises are currently set to for your loved one.",
      why: "The app adjusts difficulty automatically to keep practice challenging but achievable — this shows where it landed.",
      how: "No action needed, but it's useful context if you discuss progress with their clinician.",
    },
    {
      target: "cg-more",
      title: "More detail",
      what: "An expandable section that holds everything beyond the daily glance — adherence, full session history, and quick actions.",
      why: "It keeps the everyday view calm and simple while still giving you depth the moment you want it.",
      how: "Let's open it now and walk through what's inside.",
    },
    {
      target: "cg-more-history",
      title: "Adherence & session history",
      what: "Their practice consistency over time plus a scrollable log of every recent session.",
      why: "Patterns over weeks tell you far more than any single day — you'll spot a slow drift before it becomes a slump.",
      how: "Skim the history before a clinician chat so you can describe what practice actually looked like.",
      openSteps: [{ click: '[data-tour="cg-more"]', skipIfVisible: '[data-tour="cg-more-history"]' }],
    },
    {
      target: "cg-more-actions",
      title: "Quick actions",
      what: "Shortcuts to upload personal photos, add medical documents, and view profile history.",
      why: "Personal photos make naming practice meaningful, and shared documents help the care team make better decisions.",
      how: "Add a few familiar faces or places — practice with personally relevant items tends to stick better.",
      openSteps: [{ click: '[data-tour="cg-more"]', skipIfVisible: '[data-tour="cg-more-actions"]' }],
    },
  ],

  clinician: [
    {
      target: "cl-header",
      title: "Clinician Dashboard",
      what: "Your caseload command center — every patient assigned to you, summarised for triage.",
      why: "It's built to answer 'who needs me today?' before you dive into any single chart.",
      how: "Use the refresh control to pull the latest, and 'Trial' to manage enrolled study patients.",
    },
    {
      target: "cl-attention",
      title: "Needs Attention",
      what: "Patients flagged for declining accuracy, inactivity, or active alerts — sorted by urgency.",
      why: "This is your triage queue. Acting here first focuses your limited time where it changes outcomes.",
      how: "Click a patient to open their hub and review the specific reason they were flagged.",
    },
    {
      target: "cl-cohort",
      title: "Cohort Snapshot",
      what: "At-a-glance averages across your caseload: accuracy, adherence, and the most common issue.",
      why: "Gives you the big-picture pulse and helps spot patterns affecting many patients at once.",
      how: "Use it as context; open Cohort Analytics for deeper research-grade comparisons.",
    },
    {
      target: "cl-filters",
      title: "Search & filters",
      what: "Search by name plus filters for risk, engagement, and sort order across the caseload.",
      why: "Lets you slice a long list down to the exact subgroup you want to review right now.",
      how: "Combine filters to focus a clinic session, then clear them to return to the full caseload.",
    },
    {
      target: "cl-phenotype",
      title: "Phenotype filters",
      what: "Clinical-profile filters: aphasia type, lesion laterality, and chronicity (acute vs. chronic phase).",
      why: "Phenotype shapes prognosis and the right therapy approach — isolating, say, Broca's chronic patients lets you compare like with like.",
      how: "Stack phenotype with risk/engagement filters to build a targeted review list, e.g. 'declining anomic patients in the chronic phase'.",
    },
  ],

  admin: [
    {
      target: "ad-tabs",
      title: "Admin sections",
      what: "The five top-level areas: the Dashboard hub, Users, Clinical Review, Photo Library, and Tools.",
      why: "Each tab is a distinct administrative job — keeping setup, access, oversight, and content clearly separated.",
      how: "Switch tabs to move between tasks. We'll start in the Dashboard hub, then visit each area.",
    },
    {
      target: "ad-hub-oversight",
      title: "System Oversight",
      what: "Live monitoring tools: alert rollup, override audit, the adaptation event stream, success-band monitor, and telemetry anomalies.",
      why: "This is where you catch platform-wide problems — unresolved alerts or anomalous engine behaviour — that no single patient chart would reveal.",
      how: "Check Alert Rollup and Telemetry Anomalies regularly; open Override Audit when you need to trace a clinician's manual changes.",
      openSteps: [{ click: '[data-tour="ad-tab-hub"]', skipIfVisible: '[data-tour="ad-hub-oversight"]' }],
    },
    {
      target: "ad-hub-analytics",
      title: "Analytics & Research",
      what: "Voice analytics, parser accuracy, cohort clustering, outcomes validation, and de-identified research export.",
      why: "These turn raw usage into research-grade evidence — and let you validate that predictions track real outcomes.",
      how: "Use Research Export for study data; check Outcomes Validation to confirm the model's predictions hold up.",
      openSteps: [{ click: '[data-tour="ad-tab-hub"]', skipIfVisible: '[data-tour="ad-hub-analytics"]' }],
    },
    {
      target: "ad-hub-engine",
      title: "Engine & Pipeline",
      what: "Engine simulation (test the lesson engine against clinical profiles) and speech pipeline health.",
      why: "Before changes reach patients, you can verify the adaptive engine behaves correctly and the speech pipeline is healthy.",
      how: "Run Engine Simulation after any engine change; watch Pipeline Health if speech scoring looks off.",
      openSteps: [{ click: '[data-tour="ad-tab-hub"]', skipIfVisible: '[data-tour="ad-hub-engine"]' }],
    },
    {
      target: "ad-hub-content",
      title: "Content & Review",
      what: "Quick links into clinical review of flagged utterances and the exercise photo library.",
      why: "Content quality directly affects therapy — flagged utterances and good photos keep practice accurate and relevant.",
      how: "These mirror the Clinical Review and Photo Library tabs above for fast access from the hub.",
      openSteps: [{ click: '[data-tour="ad-tab-hub"]', skipIfVisible: '[data-tour="ad-hub-content"]' }],
    },
    {
      target: "ad-users",
      title: "Users & roles",
      what: "Where you grant clinician, caregiver, or admin roles, link care teams to patients, and send email invitations.",
      why: "Roles control who can see patient data — correct assignment here is the backbone of privacy and access.",
      how: "Assign a role, connect that provider to their patients under care assignments, or pre-assign by email under Invitations.",
    },
    {
      target: "ad-review",
      title: "Clinical Review",
      what: "Cross-patient review and oversight tools for monitoring activity and quality.",
      why: "Lets you audit how the platform is being used and catch issues that span multiple accounts.",
      how: "Open it periodically to spot-check data quality and unusual patterns.",
    },
    {
      target: "ad-photos",
      title: "Photo Library",
      what: "Manage the exercise photo assets patients name and describe during practice.",
      why: "Clear, well-categorised images are the raw material for naming and description exercises.",
      how: "Add or curate photos here; quality and variety directly affect exercise difficulty and relevance.",
    },
    {
      target: "ad-tools",
      title: "Tools",
      what: "Profile computation and maintenance utilities for keeping clinical data fresh.",
      why: "Background computations (like recomputing profiles) keep adaptation and analytics accurate.",
      how: "Use sparingly and deliberately — these are maintenance actions, not day-to-day tasks.",
    },
  ],

  "patient-hub": [
    {
      target: "ph-header",
      title: "Patient Hub",
      what: "The single place to review one patient in depth — their status, practice, and clinical detail.",
      why: "Everything you need to assess and decide for this patient lives here, so you don't hop between screens.",
      how: "Use the day-window selector (top right) to change the time range, and the back arrow to return to your caseload.",
    },
    {
      target: "ph-status",
      title: "Status — should I worry?",
      what: "Triage summary: active red/orange flags, unacknowledged alerts, and the recent accuracy trend.",
      why: "It surfaces clinical risk first, so you can decide in seconds whether this patient needs action today.",
      how: "If flags or alerts show, open Clinical Detail → Overview to see the underlying sessions.",
    },
    {
      target: "ph-practice",
      title: "Practice — are they engaged?",
      what: "Session count, trial volume, and streak over the selected window.",
      why: "Engagement is the strongest predictor of progress; low practice explains many plateaus.",
      how: "Pair this with Status — declining accuracy plus low practice usually means a dose or motivation issue.",
    },
    {
      target: "ph-listen",
      title: "Listen — what does it sound like?",
      what: "Real voice samples from recent sessions.",
      why: "Audio reveals error patterns (phonemic, anomic, agrammatic) that summary numbers can miss.",
      how: "Play a few clips before changing a plan — what you hear should match the metrics.",
    },
    {
      target: "ph-progress",
      title: "Progress — getting better?",
      what: "The longer-term accuracy trajectory across sessions.",
      why: "Distinguishes a genuine trend from a single off day, which guides whether to hold or advance.",
      how: "Look at slope direction over the window, not isolated points.",
    },
    {
      target: "ph-levels",
      title: "Levels — where are they working?",
      what: "Current difficulty levels the adaptive engine has settled on for this patient.",
      why: "Shows whether the patient is appropriately challenged — too easy stalls gains, too hard erodes confidence.",
      how: "If levels look mismatched to ability, review the Plan tab before manually intervening.",
    },
    {
      target: "ph-detail",
      title: "Clinical Detail",
      what: "The deep drawer behind the glance cards, organised into three jobs-based tabs.",
      why: "It keeps the glance view clean while holding full session data, evidence, and planning tools when you need them.",
      how: "Let's open it and walk through each tab: Overview, Review, then Plan.",
    },
    {
      target: "ph-tab-overview",
      title: "Overview — triage",
      what: "The 'should I worry?' tab: flags, alerts, accuracy detail, and the sessions behind the status card.",
      why: "It connects the at-a-glance risk to the actual evidence, so a flag is never a black box.",
      how: "Start here to confirm why a patient was surfaced before you act on it.",
      openSteps: [
        { click: '[data-tour="ph-detail"]', skipIfVisible: '[data-tour="ph-tab-overview"]' },
        { click: '[data-tour="ph-tab-overview"]' },
      ],
    },
    {
      target: "ph-tab-review",
      title: "Review — listen & analyse",
      what: "Voice evidence plus the error breakdown: perseveration, agrammatism, sound patterns, and cue-response trajectory.",
      why: "This is where you characterise the deficit — the audio and error patterns explain *why* the numbers look the way they do.",
      how: "Listen to the clips, then read the error breakdown to name the pattern driving the scores.",
      openSteps: [
        { click: '[data-tour="ph-detail"]', skipIfVisible: '[data-tour="ph-tab-overview"]' },
        { click: '[data-tour="ph-tab-review"]' },
      ],
    },
    {
      target: "ph-tab-plan",
      title: "Plan — decide",
      what: "The decision tab: adjust difficulty, cueing, and dose, add clinical notes, and schedule outreach.",
      why: "It closes the loop — everything you assessed in Overview and Review turns into a logged, trackable plan change.",
      how: "Make your adjustment here; every change is logged for continuity and the study record.",
      openSteps: [
        { click: '[data-tour="ph-detail"]', skipIfVisible: '[data-tour="ph-tab-overview"]' },
        { click: '[data-tour="ph-tab-plan"]' },
      ],
    },
  ],
};
