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

const gameStepsFor = (slug: string, title: string): QaStep[] => [
  { id: 'enter', action: `Open /exercise/${slug}`, expect: `${title} loads, instruction banner visible.` },
  { id: 'first-trial', action: 'Complete first trial as expected', expect: 'Trial is scored, structured feedback summary appears.' },
  { id: 'wrong-trial', action: 'Deliberately fail one trial', expect: 'No celebratory copy, no emoji on failure; supportive feedback only.', safety: 'Never celebrate failures.' },
  { id: 'silence', action: 'For speech games: stay silent through 3 prompts', expect: 'Multi-input fallback offers choice chips or typing.' },
  { id: 'round-advance', action: 'Finish a round', expect: '3-second auto-advance fires; next trial preloads cleanly.' },
  { id: 'summary', action: 'Reach the session summary screen', expect: 'Summary shows 4 integrated reflection parts; no dead state.' },
];

const WIRED_GAMES: { slug: string; title: string }[] = [
  { slug: 'photo-naming', title: 'Photo Naming' },
  { slug: 'fix-sentence', title: 'Fix the Sentence' },
  { slug: 'minimal-pairs', title: 'Minimal Pairs' },
  { slug: 'meaning-match', title: 'Meaning Match' },
  { slug: 'two-clues', title: 'Two Clues' },
  { slug: 'semantic-features', title: 'Semantic Features' },
  { slug: 'detective-mind', title: 'Detective Mind' },
  { slug: 'multi-step-plan', title: 'Multi-Step Plan' },
  { slug: 'pattern-match', title: 'Pattern Match' },
  { slug: 'sentence-construction', title: 'Sentence Construction' },
  { slug: 'phonological-awareness', title: 'Phonological Awareness' },
  { slug: 'dual-load-naming', title: 'Dual-Load Naming' },
  { slug: 'category-fluency', title: 'Category Fluency' },
  { slug: 'synonym-generator', title: 'Synonym Generator' },
];

const ASPIRATIONAL_GAMES: { slug: string; title: string }[] = [
  { slug: 'describe-guess', title: 'Describe & Guess' },
  { slug: 'narrative-retell', title: 'Narrative Retell' },
  { slug: 'abstract-compare', title: 'Abstract Compare' },
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

  // === All wired games ===
  ...WIRED_GAMES.map<QaScenario>(({ slug, title }) => ({
    id: `game-${slug}`,
    title: `Game: ${title}`,
    role: 'patient',
    area: 'game',
    slug,
    steps: gameStepsFor(slug, title),
  })),

  // === Aspirational games (ride discourse engine only) ===
  ...ASPIRATIONAL_GAMES.map<QaScenario>(({ slug, title }) => ({
    id: `game-${slug}`,
    title: `Game (aspirational, no progression): ${title}`,
    role: 'patient',
    area: 'game',
    slug,
    steps: [
      { id: 'enter', action: `Open /exercise/${slug}`, expect: `${title} loads and runs to summary without crashing.` },
      { id: 'no-level-up', action: 'Complete several trials successfully', expect: 'No level-up banner appears (intentional — not wired to progression).' },
      { id: 'no-mastery-contamination', action: 'Check /dev/mastery-shadow after session', expect: 'No new rows for this slug in mastery shadow.' },
    ],
  })),

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

export const QA_RUNBOOK_VERSION = '1.0.0';
