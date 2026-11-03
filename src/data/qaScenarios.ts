/**
 * Phase 1B — Manual QA runbook scenarios.
 *
 * Pure data. NOT a logic file. Read by /dev/qa-runbook to render the
 * guided manual checklist. Adding/removing scenarios here has zero
 * effect on game logic, progression, or scoring.
 *
 * Authoring guidelines:
 * - One scenario per discrete user journey.
 * - Steps are atomic: one action, one observation.
 * - `expect` describes the pass condition in plain language.
 */

import { CANONICAL_EXERCISES } from './canonicalExerciseRegistry';
import { getGameMeasurementSpec } from '@/lib/clinical/gameMeasurementContracts';

export type QaStep = {
  id: string;
  action: string;
  expect: string;
  /** Optional clinical-safety note tester should call out if violated. */
  safety?: string;
};

export type QaScenario = {
  id: string;
  title: string;
  role: 'patient' | 'caregiver' | 'clinician' | 'admin' | 'shared';
  area: 'auth' | 'onboarding' | 'game' | 'maya' | 'role' | 'a11y' | 'recovery';
  /** Slug (when area === 'game'). */
  slug?: string;
  steps: QaStep[];
};

/**
 * Patient audit inventory: every canonical game plus the separately routed
 * Functional Command Scenes activity. A scenario means "needs testing",
 * never "implemented", "passing", or "clinically validated".
 *
 * Derive canonical entries so adding a registered game cannot silently miss
 * the manual audit. The supplemental route is explicitly represented.
 */
export const QA_GAME_INVENTORY = [
  ...CANONICAL_EXERCISES.map(({ slug, title, clinicalRationale }) => ({
    slug,
    title,
    intendedSkill: clinicalRationale,
  })),
  {
    slug: 'functional-scenes',
    title: 'Functional Command Scenes',
    intendedSkill: 'Understanding and responding to everyday functional commands.',
  },
];

const gameStepsFor = (slug: string, title: string, intendedSkill: string): QaStep[] => [
  {
    id: 'enter',
    action: `Find ${title} in the patient Practice library and open /exercise/${slug}.`,
    expect: 'The intended game loads with adult-appropriate guidance, not an unrelated fallback or a generic placeholder.',
    safety: 'Missing route or placeholder content is an incomplete game, not a passing test.',
  },
  {
    id: 'purpose',
    action: `Verify the activity actually exercises this stated target: ${intendedSkill}`,
    expect: 'The patient is told what to do and why; task demands correspond to the named skill, not an arbitrary score.',
  },
  {
    id: 'start',
    action: 'Start a fresh game with reading support as needed.',
    expect: 'A clear first action and short spoken/visual instructions permit independent entry; no dead-end or unexpected microphone activation.',
  },
  {
    id: 'response',
    action: 'Complete an independently attempted trial and a clearly wrong or related-answer trial.',
    expect: 'Feedback corresponds to the actual answer; valid alternatives and uncertain recognition are not automatically labeled wrong, and open responses are not given invented objective accuracy.',
    safety: 'Do not present heuristic or self-reported participation as clinically verified independent success.',
  },
  {
    id: 'support',
    action: 'Request a clue, repeat the audio, or reveal/model an answer where supported.',
    expect: 'The requested support works and its type is recorded; assisted answers cannot be counted as independent attempts.',
  },
  {
    id: 'skip',
    action: 'Skip a trial or remain silent/no-response, then continue.',
    expect: 'The patient can proceed without troubleshooting; skipped/unscorable trials are not falsely recorded as successful or as independently measured failure.',
  },
  {
    id: 'speech-if-used',
    action: 'If the game uses speech, deny the microphone, interrupt playback, and test typing/choice/manual fallback; otherwise mark this step Skip with a note.',
    expect: 'No dead end, TTS echo, duplicate submission, invented transcript, or falsely independent spoken score. Spoken and non-spoken modes remain distinct.',
  },
  {
    id: 'stages',
    action: 'Exercise the lowest and highest claimed practice stages (1 and 8), checking actual stimulus and task differences.',
    expect: 'Both stages really run with distinct appropriate difficulty. If Stage 8 is merely documented or unavailable, record Fail/blocked; do not call the game complete.',
    safety: 'A practice stage, a clinical mastery level and a generic difficulty chip are different measures.',
  },
  {
    id: 'evidence',
    action: 'On an explicitly isolated backend, inspect the just-completed raw trial and session output.',
    expect: 'Exactly one correctly owned event per attempt; accurate stimulus, response source, cue, result, trial identity and level; summary agrees with saved events.',
    safety: 'Without isolated authenticated read-back, record Skip/unverified, not Pass. Never use patient or production records for this check.',
  },
  {
    id: 'measurement-contract',
    action: `On an isolated backend, inspect the game's versioned ${getGameMeasurementSpec(slug)?.primaryMeasureId ?? 'MISSING CONTRACT'} measurement contract and proposed raw fields: ${getGameMeasurementSpec(slug)?.proposedTaskFields.join(', ') ?? 'MISSING CONTRACT'}.`,
    expect: 'The observed raw payload identifies the intended measure, actual source and assistance; compare each proposed key with the saved value. Missing/unreliable fields are documented instrumentation gaps, not failed patient attempts or completed clinical validation.',
    safety: 'A telemetry key merely existing is NOT construct validation. Do not mark Pass without inspecting a real isolated-backend write and source-consistent evidence.',
  },
  {
    id: 'resume',
    action: 'Exit partway through a trial, reload or return, and try a rapid double-tap at completion.',
    expect: 'No post-exit microphone/audio, duplicate result or surprise level-up; saved progress/exit is handled predictably.',
  },
  {
    id: 'guided-session',
    action: 'Use the game inside a guided session and observe the return to Maya/next exercise.',
    expect: 'Start, feedback, transition and exit remain usable; the coach does not take over the microphone or reuse a previous answer.',
  },
  {
    id: 'accessibility',
    action: 'Use a phone-width screen, large text/zoom, slow responses and one-handed input.',
    expect: 'Instructions, large controls, help, Skip and Pause/Exit remain reachable; no essential action relies on reading speed or a short timer.',
  },
];

export const QA_SCENARIOS: QaScenario[] = [
  // === Auth ===
  {
    id: 'auth-signin',
    title: 'Sign-in works',
    role: 'shared',
    area: 'auth',
    steps: [
      { id: 'open', action: 'Open /auth', expect: 'Email + password form visible, no console errors.' },
      { id: 'invalid', action: 'Submit invalid credentials', expect: 'User-facing error appears; no app crash.' },
      { id: 'valid', action: 'Submit valid credentials', expect: 'Redirects to /today (patient) or role landing.' },
    ],
  },
  {
    id: 'auth-signup-patient',
    title: 'New patient account creation',
    role: 'patient',
    area: 'auth',
    steps: [
      { id: 'open', action: 'Open /auth and switch to Sign Up (role = patient)', expect: 'Form shows email, password, display name, Terms checkbox.' },
      { id: 'terms-gate', action: 'Try to submit without checking Terms', expect: 'Toast asks you to accept Terms; no request sent.' },
      { id: 'submit', action: 'Fill valid email + password, accept Terms, submit', expect: 'Toast "Account created!"; no "Failed to fetch"; POST /auth/v1/signup returns 200 in Network tab.' },
      { id: 'network-fail', action: 'If you see "Failed to fetch": check DevTools Network for the /auth/v1/signup request', expect: 'If request is blocked/CORS/net::ERR_*, cause is browser-side (extension, adblock, corporate proxy, DNS). Server-side is healthy when curl to the same endpoint returns 200.', safety: 'Do NOT patch signup code when the network request never reaches the server \u2014 the bug is environmental.' },
      { id: 'route', action: 'After signup, wait for auth state', expect: 'Routes to /onboarding (or /today if onboarding_completed_at set).' },
    ],
  },
  {
    id: 'auth-signup-caregiver',
    title: 'Caregiver self-serve signup',
    role: 'caregiver',
    area: 'auth',
    steps: [
      { id: 'signup', action: 'Sign up with role = caregiver', expect: 'account_intent=caregiver in user metadata; no clinician approval wall.' },
      { id: 'setup', action: 'Land at /caregiver/setup', expect: 'Prompt: "Who is recovering?"; creating patient makes an active profile.' },
      { id: 'practice', action: 'Click "Start practice for [name]"', expect: 'Routes to /today with active patient profile.' },
    ],
  },
  {
    id: 'auth-signup-clinician',
    title: 'Clinician signup routes through approval',
    role: 'clinician',
    area: 'auth',
    steps: [
      { id: 'signup', action: 'Sign up with role = clinician', expect: 'role_requests row inserted; toast confirms request submitted.' },
      { id: 'pending', action: 'Land at /pending-approval', expect: 'Clear waiting state; no access to clinician tools yet.' },
    ],
  },


  // === Onboarding ===
  {
    id: 'onboarding-new-patient',
    title: 'New patient onboarding completes',
    role: 'patient',
    area: 'onboarding',
    steps: [
      { id: 'start', action: 'Open /onboarding as new account', expect: 'Maya bubble static, intro copy adult and calm.' },
      { id: 'progress', action: 'Advance through each step', expect: 'No skipped fields, no dead states.' },
      { id: 'finish', action: 'Complete onboarding', expect: 'Lands at /today; first lesson available.' },
    ],
  },

  // === Every clinical/practice game (29 patient-facing activities) ===
  // Inclusion creates an audit task, not a claim that Stage 8 or scoring works.
  ...QA_GAME_INVENTORY.map<QaScenario>(({ slug, title, intendedSkill }) => ({
    id: `game-${slug}`,
    title: `Game audit: ${title}`,
    role: 'patient',
    area: 'game',
    slug,
    steps: gameStepsFor(slug, title, intendedSkill),
  })),

  // === Between-game / session pacing (post-UX1.1 timing bumps) ===
  {
    id: 'pacing-between-trials',
    title: 'Between-trial and between-game pacing feels calm',
    role: 'patient',
    area: 'game',
    steps: [
      { id: 'auto-advance', action: 'Complete a correct trial and watch the gap before the next trial', expect: 'Roughly 3s auto-advance; not abrupt, not sluggish.' },
      { id: 'encouragement', action: 'Trigger an encouragement overlay between blocks', expect: 'Overlay is on-screen ~5.5s (6.5s with coaching); user has time to read it.' },
      { id: 'breathing', action: 'Observe the between-block breathing pause', expect: '~8s micro-pause; no jarring jump into the next block.' },
      { id: 'maya-tail', action: 'In Guided/Full Coaching, wait after Maya finishes speaking', expect: '~1.4s tail before mic opens or next action; not clipped.' },
      { id: 'stops-short', action: 'Note any game that ends before 10 trials without a session-end reason', expect: 'All wired games run 10 trials unless dose cap, ended_reason, or user exit \u2014 flag counterexamples.' },
    ],
  },

  // === Signup network diagnostics (published-site blocker) ===
  {
    id: 'auth-signup-network',
    title: 'Signup "Failed to fetch" triage',
    role: 'shared',
    area: 'auth',
    steps: [
      { id: 'devtools', action: 'Open DevTools > Network before clicking Sign Up', expect: 'A POST to /auth/v1/signup should appear.' },
      { id: 'no-request', action: 'If NO request is fired', expect: 'Browser extension / adblock is blocking supabase.co; try incognito with extensions off.' },
      { id: 'blocked', action: 'If request shows (blocked) or net::ERR_*', expect: 'Environmental: DNS, VPN, corporate proxy, or Brave shields. Not a code bug.' },
      { id: 'cors', action: 'If request shows CORS error', expect: 'Managed Supabase auth allows all origins; a CORS failure usually means the request was intercepted by an extension.' },
      { id: 'server-500', action: 'If request returns 500', expect: 'Check Supabase Auth logs; likely handle_new_user trigger error \u2014 escalate to agent.' },
    ],
  },



  // === Maya ===
  {
    id: 'maya-coaching-modes',
    title: 'Maya overlay across coaching modes',
    role: 'patient',
    area: 'maya',
    steps: [
      { id: 'games-only', action: 'Start a session in Games Only mode', expect: 'Maya bubble does not appear in-trial.' },
      { id: 'guided', action: 'Start a session in Guided mode', expect: 'Maya bubble appears between trials, static (no rapid animation).' },
      { id: 'full-coaching', action: 'Start a session in Full Coaching mode', expect: 'Voice-led; mic auto-starts 0.5–1.0s after Maya finishes speaking.' },
    ],
  },

  // === Role switching ===
  {
    id: 'role-switching',
    title: 'Role switching routes correctly',
    role: 'shared',
    area: 'role',
    steps: [
      { id: 'clinician', action: 'setUiMode(clinician)', expect: 'Routes to /clinician dashboard.' },
      { id: 'caregiver', action: 'setUiMode(caregiver)', expect: 'Routes to caregiver landing.' },
      { id: 'admin', action: 'setUiMode(admin)', expect: 'Routes to /admin pipeline.' },
      { id: 'patient', action: 'setUiMode(patient)', expect: 'Routes to /today.' },
    ],
  },

  // === Accessibility quick check ===
  {
    id: 'a11y-quick',
    title: 'A11y quick check (pre-Phase 2 audit)',
    role: 'patient',
    area: 'a11y',
    steps: [
      { id: 'tap-targets', action: 'Tap-test primary buttons on /today on mobile viewport', expect: 'All primary buttons ≥ 44×44.' },
      { id: 'contrast', action: 'Visually scan for low-contrast text', expect: 'No text fails WCAG AA against background.' },
      { id: 'keyboard', action: 'Tab through /today', expect: 'Focus order is logical; focus-visible ring present.' },
    ],
  },

  // === Recovery ===
  {
    id: 'recovery-mid-session',
    title: 'Resume a session within 4h',
    role: 'patient',
    area: 'recovery',
    steps: [
      { id: 'start', action: 'Start a session and close tab mid-trial', expect: 'No data loss warning to user.' },
      { id: 'reopen', action: 'Reopen within 4h', expect: 'Session resumes from saved trial.' },
      { id: 'expire', action: 'Reopen after 4h (or clear localStorage)', expect: 'Starts a fresh session, no stale resume offer.' },
    ],
  },
];

export const QA_RUNBOOK_VERSION = '2.1.0';
