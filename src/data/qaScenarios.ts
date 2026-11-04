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

  // === 2026-11-04 patient-observed field failures ===
  // These are real-device / isolated-staging manual acceptance checks, NOT
  // automatically passing contracts. Record PASS, FAIL or SKIP for each step.
  // Never add synthetic patient transcripts to a production database.
  {
    id: 'patient-repro-two-clues-rehearsal',
    title: 'Patient regression: Two Clues — slow speech, repeated clues, ambiguous answers',
    role: 'patient',
    area: 'game',
    slug: 'two-clues',
    steps: [
      { id: 'real-device', action: 'On the same iPhone/Safari device used in therapy, start a voice-led Two Clues session with speech input available.', expect: 'Clues can be read aloud and replayed without an unexpected microphone stop.' },
      { id: 'rehearsal', action: 'On a safe test fixture, read "holds", pause 2 seconds, then say "water" and pause again; rehearse "holds water" a second time.', expect: 'No repeated clue is recorded as an incorrect patient answer; no progress/score change for thinking aloud.', safety: 'Uncertain or clue-only speech must never be interpreted as incorrect clinical performance.' },
      { id: 'valid-cup', action: 'Use an isolated historical-puzzle fixture for holds/water, then say "holds ... water ... I think a cup", with natural pauses.', expect: '"Cup" is accepted as a full-credit anchor, even after clue repetition; exactly one trial result is recorded.', safety: 'The ambiguous puzzle is held out of normal new-session selection pending clinical review. Do not unquarantine it just for this test.' },
      { id: 'valid-bottle', action: 'Repeat the historical-puzzle fixture with "bottle".', expect: 'Bottle is recognized as a defensible related response, not a wrong answer.' },
      { id: 'self-correction', action: 'Speak "bottle ... no ... cup" with a 2–4 second word-finding pause.', expect: 'The later self-corrected answer is not cut off or overwritten by earlier recognition.' },
      { id: 'database-integrity', action: 'In an isolated backend, inspect the transcript, scoring tier, attempt ID, exercise event, and progression/adaptation result for the previous steps.', expect: 'Clue rehearsal makes no false-negative event or level drop; each actual answer has one coherent event and retains the raw transcript.', safety: 'Never label ASR failure or an unverified semantic guess as patient failure.' },
    ],
  },
  {
    id: 'patient-repro-describe-guess-handoff',
    title: 'Patient regression: Describe & Guess — readable prompts and mic across multiple cards',
    role: 'patient',
    area: 'game',
    slug: 'describe-guess',
    steps: [
      { id: 'prompts-mobile', action: 'On iPhone/Safari at a normal mobile viewport, open the first description card without tapping anything.', expect: 'Prominent full questions about use, appearance and material are visible immediately, not hidden under a timer or abbreviated chips; essential controls remain visible.' },
      { id: 'first-response', action: 'Describe the first object with two or three separate thoughts and natural 2–5 second pauses.', expect: 'Microphone remains active during thought pauses; Maya does not guess from the first fragment.' },
      { id: 'next-card-mic', action: 'Finish or skip the first card, advance to the second, and immediately speak a different description.', expect: 'Second card starts a fresh recognizer; it captures the NEW description, not the previous answer or Maya audio.', safety: 'Mic-on indicators must reflect actual recognition state, not just an intended start.' },
      { id: 'failed-mic-recovery', action: 'In the isolated test setup, force the second-card recognition start to fail.', expect: 'A clear, usable Retry or accessible alternate input appears; successful retry listens on the SAME card without fabricating a failed trial.' },
      { id: 'old-audio-callback', action: 'In a controlled test, hold a first-card microphone/TTS callback until after the second card appears, then release it.', expect: 'Old callbacks cannot stop or restart the second-card recognizer.' },
      { id: 'guidance-evidence', action: 'Tap a displayed question for Maya to read it; then give a spoken answer mentioning one feature.', expect: 'The displayed question alone counts as a visual scaffold; only requested spoken help counts as a requested cue, and only the patient\'s speech counts as produced features.' },
      { id: 'data-review', action: 'Inspect isolated attempt rows and summary after the two-card journey.', expect: 'No duplicate attempts, no false no-response scores, no phantom phonemic/full-answer cues, and no next-card transcript contamination.', safety: 'Do not infer independent language production from a visible or tapped prompt.' },
    ],
  },
  {
    id: 'patient-repro-finish-thought-pauses',
    title: 'Patient regression: Finish the Thought — pauses are not submission',
    role: 'patient',
    area: 'game',
    slug: 'thought-continuation',
    steps: [
      { id: 'long-pauses', action: 'Begin a sentence, pause 2 seconds, continue, pause 5 seconds, continue, then pause 8 seconds before completing the thought.', expect: 'No premature scoring or advance; continuation joins the same patient answer.' },
      { id: 'unfinished', action: 'Stop temporarily after an unfinished phrase such as "I wanted to because".', expect: 'The system does not silently mark the thought complete or incorrect and offers a usable Done action.' },
      { id: 'manual-complete', action: 'Use "I\'m Done Speaking" to complete, then leave the control untouched.', expect: 'The turn completes once and never auto-submits a duplicate after a later timer fires.' },
      { id: 'late-callback', action: 'Skip or exit while a recognition/timing callback is pending.', expect: 'No later answer is logged, scored, or carried into another game.', safety: 'Post-speech thinking delay must not be reported as measured speaking time.' },
    ],
  },
  {
    id: 'patient-repro-minimal-pairs-echo',
    title: 'Patient regression: Minimal Pairs — spoken echo vs tapped recognition',
    role: 'patient',
    area: 'game',
    slug: 'minimal-pairs',
    steps: [
      { id: 'repetition', action: 'Complete an auditory selection and then say the chosen word when the echo prompt appears.', expect: 'Microphone captures an actual repetition, rather than treating the selected tile or a browser transcript as verified pronunciation.' },
      { id: 'analysis', action: 'With isolated live speech service configured, inspect the captured audio and pronunciation response.', expect: 'Pronunciation evidence is attributed to the correct word and attempt, or explicitly marked unavailable when recognition or the service fails.', safety: 'Tapped choices and missing audio must not inflate spoken-language metrics.' },
      { id: 'next-trial', action: 'Advance to the next Minimal Pairs item, then repeat with a different word.', expect: 'Mic state and analysis attach to the new item, with no duplicated audio or mixed attempts.' },
    ],
  },

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

export const QA_RUNBOOK_VERSION = '1.0.0';
