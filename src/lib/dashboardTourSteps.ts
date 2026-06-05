/**
 * Dashboard spotlight tour step definitions.
 *
 * Each role gets an in-place coachmark tour that highlights real elements on
 * its dashboard. Targets map to `data-tour="<id>"` attributes added to the
 * actual UI. Steps whose target isn't present are skipped at runtime, so it's
 * safe to list conditional sections here.
 *
 * Bump TOUR_VERSION whenever the steps change meaningfully — first-visit
 * auto-run keys off this so updated tours re-introduce themselves once.
 */
import type { SpotlightStep } from "@/components/tour/SpotlightTour";
import type { NonPatientRole } from "@/lib/roleOnboardingSteps";

export const TOUR_VERSION = 1;

export const DASHBOARD_TOUR_STEPS: Record<NonPatientRole, SpotlightStep[]> = {
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
      what: "Expandable section with session history, adherence, and quick actions like uploading photos or documents.",
      why: "Keeps the everyday view simple while still giving you depth when you want it.",
      how: "Expand it when you need history or want to add personal photos that make practice more meaningful.",
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
      title: "Filters & phenotype",
      what: "Search and filter the caseload by risk, engagement, and clinical phenotype (aphasia type, laterality, chronicity).",
      why: "Lets you slice the list to the exact subgroup you want to review or compare.",
      how: "Combine filters to focus a clinic session, then clear them to return to the full caseload.",
    },
  ],

  admin: [
    {
      target: "ad-tabs",
      title: "Admin sections",
      what: "The main areas of the admin panel: the hub, user roles, review tools, photos, and system tools.",
      why: "Each tab is a distinct administrative job — keeping setup, access, and oversight clearly separated.",
      how: "Switch tabs to move between tasks; most provisioning work happens under Users.",
    },
    {
      target: "ad-users",
      title: "Users & roles",
      what: "Where you grant clinician, caregiver, or admin roles and link care teams to patients.",
      why: "Roles control who can see patient data — correct assignment here is the backbone of privacy and access.",
      how: "Assign a role, then connect that provider to the patients they support under care assignments.",
    },
    {
      target: "ad-review",
      title: "Review",
      what: "Cross-patient review and oversight tools for monitoring activity and quality.",
      why: "Lets you audit how the platform is being used and catch issues that span multiple accounts.",
      how: "Open it periodically to spot-check data quality and unusual patterns.",
    },
  ],
};
