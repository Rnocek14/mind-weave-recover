/**
 * Real-World Scenario Engine — Core definitions & scoring
 * 
 * Phase 1 scenarios: Coffee Order, Doctor Call, Family Chat
 * Scoring: Real-World Readiness (Intent 40%, Responsiveness 25%, Independence 25%, Naturalness 10%)
 */

// ===== Scenario definitions =====

export interface ScenarioDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: string; // emoji
  partnerRole: string;
  partnerName: string;
  setting: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  /** What success looks like (shown pre-start) */
  successCriteria: string;
  /** Confidence primer shown pre-start */
  confidencePrimer: string;
  /** Opening line from the partner */
  openingLine: string;
  /** System prompt additions for the AI partner */
  partnerPersona: string;
  /** Key intents the user should communicate */
  targetIntents: string[];
  /** Conversation beats / phases */
  beats: ScenarioBeat[];
  /** Support hints available */
  hints: string[];
}

export interface ScenarioBeat {
  id: string;
  description: string;
  partnerAction: string;
  expectedUserIntent: string;
  /** Escalating cues if user is stuck */
  whispers: string[];
}

// ===== Scenario state during execution =====

export type ScenarioPhase = 'pre_start' | 'live' | 'feedback' | 'reflection';

export interface ScenarioState {
  phase: ScenarioPhase;
  scenarioId: string;
  currentBeatIndex: number;
  exchanges: ScenarioExchange[];
  hintsUsed: number;
  repeatsUsed: number;
  helpsUsed: number;
  whispersTriggered: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface ScenarioExchange {
  partnerText: string;
  userTranscript: string;
  intentLanded: boolean;
  latencyMs: number;
  cuesUsed: number;
  timestamp: number;
}

// ===== Scoring =====

export interface ScenarioScore {
  overall: number; // 0-100 "Real-World Readiness"
  intentScore: number; // 0-100
  responsivenessScore: number; // 0-100
  independenceScore: number; // 0-100
  naturalnessScore: number; // 0-100
  emotionalFeedback: string;
  functionalSummary: string;
  nextImprovement: string;
}

export function computeScenarioScore(state: ScenarioState, scenario: ScenarioDefinition): ScenarioScore {
  const exchanges = state.exchanges;
  if (exchanges.length === 0) {
    return {
      overall: 0, intentScore: 0, responsivenessScore: 0,
      independenceScore: 0, naturalnessScore: 0,
      emotionalFeedback: "Let's try again when you're ready.",
      functionalSummary: "No exchanges completed.",
      nextImprovement: "Start by saying anything — there's no wrong answer.",
    };
  }

  // Intent: % of exchanges where intent landed
  const intentLanded = exchanges.filter(e => e.intentLanded).length;
  const intentScore = Math.round((intentLanded / exchanges.length) * 100);

  // Responsiveness: based on average latency (< 4s = 100, > 15s = 0)
  const avgLatency = exchanges.reduce((s, e) => s + e.latencyMs, 0) / exchanges.length;
  const responsivenessScore = Math.round(Math.max(0, Math.min(100, 100 - ((avgLatency - 4000) / 110))));

  // Independence: penalty per cue used
  const totalCues = state.hintsUsed + state.whispersTriggered + state.helpsUsed;
  const maxCues = exchanges.length * 3; // 3 possible per exchange
  const independenceScore = Math.round(Math.max(0, (1 - totalCues / Math.max(1, maxCues)) * 100));

  // Naturalness: rough heuristic — longer transcripts + fewer repeats = more natural
  const avgWords = exchanges.reduce((s, e) => s + e.userTranscript.split(/\s+/).length, 0) / exchanges.length;
  const naturalnessScore = Math.round(Math.min(100, avgWords * 20 - state.repeatsUsed * 10));

  // Weighted overall
  const overall = Math.round(
    intentScore * 0.40 +
    responsivenessScore * 0.25 +
    independenceScore * 0.25 +
    Math.max(0, naturalnessScore) * 0.10
  );

  // Emotional feedback
  let emotionalFeedback: string;
  if (overall >= 80) emotionalFeedback = "That felt like a real conversation. You handled it beautifully.";
  else if (overall >= 60) emotionalFeedback = "You handled that really well. Your message came through clearly.";
  else if (overall >= 40) emotionalFeedback = "Great effort — you communicated the important parts.";
  else emotionalFeedback = "That was brave. Every practice makes real life easier.";

  // Functional summary
  const functionalSummary = `${intentLanded} of ${exchanges.length} messages understood` +
    (totalCues > 0 ? ` · Got ${totalCues} helpful hint${totalCues > 1 ? 's' : ''} when needed` : ' · No hints needed');

  // Next improvement
  let nextImprovement: string;
  if (intentScore < 60) nextImprovement = "Try using shorter, clearer phrases to get your point across.";
  else if (independenceScore < 50) nextImprovement = "You're doing well — try pausing before asking for help next time.";
  else if (responsivenessScore < 60) nextImprovement = "Take a breath, then respond — speed will come with practice.";
  else nextImprovement = "Keep practicing — you're building real confidence.";

  return {
    overall: Math.max(0, Math.min(100, overall)),
    intentScore, responsivenessScore, independenceScore,
    naturalnessScore: Math.max(0, naturalnessScore),
    emotionalFeedback, functionalSummary, nextImprovement,
  };
}

// ===== Initial state factory =====

export function createScenarioState(scenarioId: string): ScenarioState {
  return {
    phase: 'pre_start',
    scenarioId,
    currentBeatIndex: 0,
    exchanges: [],
    hintsUsed: 0,
    repeatsUsed: 0,
    helpsUsed: 0,
    whispersTriggered: 0,
    startedAt: null,
    completedAt: null,
  };
}

// ===== Phase 1 Scenarios =====

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'coffee_order',
    title: 'Order a Coffee',
    subtitle: 'Practice ordering at a café',
    icon: '☕',
    partnerRole: 'Barista',
    partnerName: 'Alex',
    setting: 'A friendly neighborhood café',
    difficulty: 'easy',
    estimatedMinutes: 2,
    successCriteria: 'Order a drink and respond to the barista',
    confidencePrimer: "There's no wrong way to do this — just try.",
    openingLine: "Hi there! Welcome in. What can I get started for you today?",
    partnerPersona: `You are Alex, a friendly barista at a small café. You're warm, patient, and helpful. 
    Speak in short, clear sentences. If the customer struggles, gently offer options like "Would you like coffee or tea?" 
    Never rush them. React naturally to what they say. Keep responses under 20 words.
    Conversation flow: greeting → take order → ask about size/extras → confirm → farewell.`,
    targetIntents: ['order_drink', 'specify_preferences', 'respond_to_question', 'say_goodbye'],
    beats: [
      {
        id: 'greeting',
        description: 'Barista greets, user orders',
        partnerAction: 'Greet and ask what they want',
        expectedUserIntent: 'Order a drink',
        whispers: ["You could say what drink you'd like", "Try: 'Coffee, please'", "Just say the name of any drink"],
      },
      {
        id: 'preferences',
        description: 'Barista asks about size or extras',
        partnerAction: 'Ask about size or milk preference',
        expectedUserIntent: 'Specify preferences',
        whispers: ["They're asking about size", "Try: 'Large' or 'Medium'", "You can say 'regular' if you're not sure"],
      },
      {
        id: 'confirm',
        description: 'Barista confirms order',
        partnerAction: 'Repeat order back and give total',
        expectedUserIntent: 'Confirm or correct',
        whispers: ["They're checking your order is right", "You can say 'yes' or 'that's right'", "Just nod or say 'perfect'"],
      },
      {
        id: 'farewell',
        description: 'Barista says goodbye',
        partnerAction: 'Say thanks and goodbye',
        expectedUserIntent: 'Say goodbye',
        whispers: ["Time to say bye!", "Try: 'Thank you!'", "'Thanks, bye' works great"],
      },
    ],
    hints: ['Think about what drink you want', 'You can keep it simple — one or two words is fine', 'If you get stuck, I\'ll help'],
  },
  {
    id: 'doctor_call',
    title: 'Call the Doctor',
    subtitle: 'Schedule an appointment by phone',
    icon: '📞',
    partnerRole: 'Receptionist',
    partnerName: 'Sam',
    setting: "A doctor's office phone line",
    difficulty: 'medium',
    estimatedMinutes: 3,
    successCriteria: 'Explain why you need an appointment and confirm a time',
    confidencePrimer: "There's no wrong way to do this — just try.",
    openingLine: "Good morning, Dr. Chen's office. How can I help you?",
    partnerPersona: `You are Sam, a receptionist at a doctor's office. You're professional but warm and patient.
    Speak clearly and slowly. If the caller struggles, offer simple yes/no choices.
    Keep responses under 25 words. Be encouraging if they need time.
    Flow: greeting → reason for call → suggest times → confirm details → goodbye.`,
    targetIntents: ['state_purpose', 'describe_need', 'choose_time', 'confirm_details', 'say_goodbye'],
    beats: [
      {
        id: 'purpose',
        description: 'Receptionist answers, user states purpose',
        partnerAction: 'Answer phone and ask how to help',
        expectedUserIntent: 'Request an appointment',
        whispers: ["Tell them you need to see the doctor", "Try: 'I need an appointment'", "'Appointment, please' works fine"],
      },
      {
        id: 'reason',
        description: 'Receptionist asks what it is about',
        partnerAction: 'Ask what the appointment is for',
        expectedUserIntent: 'Describe the reason',
        whispers: ["They want to know why you're coming in", "Try: 'Check-up' or 'Not feeling well'", "Any reason is fine — keep it simple"],
      },
      {
        id: 'scheduling',
        description: 'Receptionist offers time slots',
        partnerAction: 'Offer two time options',
        expectedUserIntent: 'Choose a time',
        whispers: ["Pick one of the times they offered", "Try: 'The morning one' or 'Tuesday'", "Just say which one sounds better"],
      },
      {
        id: 'confirm',
        description: 'Receptionist confirms',
        partnerAction: 'Confirm the appointment details',
        expectedUserIntent: 'Confirm and say goodbye',
        whispers: ["They're confirming your appointment", "Say 'yes' or 'that's right'", "'Thank you, goodbye' is perfect"],
      },
    ],
    hints: ['Think about why you need to see the doctor', "You don't need to be specific — 'check-up' is fine", 'If they ask a question, a short answer works'],
  },
  {
    id: 'family_chat',
    title: 'Chat with Family',
    subtitle: 'Have a warm conversation with a grandchild',
    icon: '👨‍👧',
    partnerRole: 'Grandchild',
    partnerName: 'Lily',
    setting: 'A video call with your grandchild',
    difficulty: 'easy',
    estimatedMinutes: 2,
    successCriteria: 'Have a short, warm conversation',
    confidencePrimer: "There's no wrong way to do this — just try.",
    openingLine: "Hi Grandma! Guess what happened at school today!",
    partnerPersona: `You are Lily, an enthusiastic 8-year-old grandchild on a video call. You're excited, loving, and talkative.
    Speak in simple, short sentences. Be patient if grandparent takes time to respond.
    React with genuine excitement to anything they say. Share small stories about school, pets, or games.
    Keep responses under 20 words. Always be warm and affectionate.
    Flow: excited greeting → share a story → ask a question → respond to their answer → loving goodbye.`,
    targetIntents: ['greet_warmly', 'respond_to_story', 'ask_question', 'share_something', 'say_goodbye'],
    beats: [
      {
        id: 'greeting',
        description: 'Grandchild greets excitedly',
        partnerAction: 'Greet and share exciting news',
        expectedUserIntent: 'Respond warmly',
        whispers: ["Say hi back!", "Try: 'Hi! Tell me!'", "You can say 'Hello, sweetheart'"],
      },
      {
        id: 'story',
        description: 'Grandchild tells a short story',
        partnerAction: 'Tell a short, cute school story',
        expectedUserIntent: 'React to the story',
        whispers: ["React to what they told you", "Try: 'That sounds fun!'", "'Wow!' or 'Really?' works great"],
      },
      {
        id: 'question',
        description: 'Grandchild asks a question',
        partnerAction: 'Ask what grandparent has been doing',
        expectedUserIntent: 'Share something about your day',
        whispers: ["Tell them something about your day", "Try: 'I went for a walk'", "Any small thing — 'I had coffee' is perfect"],
      },
      {
        id: 'goodbye',
        description: 'Time to say bye',
        partnerAction: 'Say a loving goodbye',
        expectedUserIntent: 'Say goodbye warmly',
        whispers: ["Time to say bye!", "Try: 'Love you!'", "'Bye bye, sweetheart' is lovely"],
      },
    ],
    hints: ['Just be yourself — Lily loves hearing from you', 'Short answers are totally fine', "If you're stuck, just react — 'wow!' or 'nice!'"],
  },
];

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIOS.find(s => s.id === id);
}
