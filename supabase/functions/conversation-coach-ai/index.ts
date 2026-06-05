/**
 * Conversation Coach AI — Maya's conversational intelligence
 * 
 * Upgraded from keyword-grep memory to:
 * 1. AI-maintained semantic rolling memory (via tool calling)
 * 2. Therapy intent-driven responses
 * 3. Slimmed prompt with personality-first design
 * 4. Speech-aware adaptation (unchanged)
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =========================================================================
// Semantic Memory Builder (replaces old keyword-grep approach)
// =========================================================================

/**
 * Build semantic context from actual conversation history + AI rolling memory.
 * No hardcoded word lists — works with whatever the user actually says.
 */
function buildSemanticMemory(
  history: { role: string; text: string }[],
  rollingMemory?: string
): string {
  if (!history || history.length === 0) return rollingMemory || '';

  const userMessages = history
    .filter(m => m.role === 'user' && m.text && m.text !== '(no speech)' && m.text !== '(silence)')
    .map(m => m.text.trim());

  if (userMessages.length === 0) return rollingMemory || '';

  // Build Q&A exchange log from actual conversation pairs
  const exchanges: string[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    if (history[i].role === 'ai' && history[i + 1]?.role === 'user') {
      const answer = history[i + 1].text;
      if (answer && answer !== '(no speech)' && answer !== '(silence)') {
        exchanges.push(
          `You asked: "${history[i].text.slice(0, 35)}…" → They said: "${answer.slice(0, 55)}"`
        );
      }
    }
  }

  let memory = '';
  if (rollingMemory) {
    memory += `WHAT YOU REMEMBER: ${rollingMemory}\n`;
  }
  if (exchanges.length > 0) {
    memory += `RECENT EXCHANGES:\n${exchanges.slice(-3).join('\n')}\n`;
  }
  memory += `LATEST FROM USER: "${userMessages[userMessages.length - 1].slice(0, 80)}"`;
  memory += '\nCRITICAL: Reference specific things they said. Never re-ask something already discussed.';

  return memory;
}

// =========================================================================
// Therapy Intent Instructions
// =========================================================================

function getIntentInstruction(intent?: string): string {
  const map: Record<string, string> = {
    expand_topic:
      'You\'re genuinely curious about what they shared. Pick a specific detail and ask about it because YOU want to know — like a friend who\'s actually interested. Offer a choice if it helps ("was it X or Y?").',
    probe_word_finding:
      'Ask a question where the answer naturally IS the word they need. Don\'t say "what\'s it called?" — instead ask something like "which place was that?" or "who was with you?" so the word comes out organically.',
    probe_sentence:
      'Ask something that invites a little story, not just a word. "What happened when…?" or "How did that go?" Let them stretch.',
    confirm_understanding:
      'Echo back what you think they meant in your own words, then check — "So you went to the park, right?" Quick and natural.',
    build_confidence:
      'They need a win. React warmly to what they said, then ask something super easy — a yes/no or simple choice. Make them feel heard.',
    gentle_repair:
      'They got stuck. That\'s okay. React naturally ("no rush" or "I think I get it"), maybe offer the word you think they meant, then give them an easy one.',
    shift_topic:
      'Bridge to something new using what they already said. "That reminds me — do you also like…?" Keep it connected.',
    prepare_exercise:
      'Smoothly set up a transition: "Hey, want to try a quick thing?" Make it feel like a fun break, not a test.',
    reflect_progress:
      'You noticed something good — they used a harder word, spoke more fluently, or tried something new. Mention it casually, not like grading them.',
  };
  return map[intent || 'expand_topic'] || map.expand_topic;
}

// =========================================================================
// Types
// =========================================================================

interface SpeechAnalysis {
  effortfulSpeech: boolean;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  circumlocutionDetected: boolean;
  fluencyScore: number;
  wordCount: number;
  completionConfidence: 'high' | 'medium' | 'low';
  speechContext?: string;
  pronunciationScore?: number | null;
  challengingSounds?: string[];
  microFluencyNotes?: string[];
}

interface UserSpeechContext {
  primaryChallenge?: string;
  bestCueType?: string;
  typicalPace?: string;
  predominantErrorPattern?: string;
  effortfulSpeechRate?: number;
}

interface SessionMetrics {
  turnsCompleted: number;
  avgFluency: number;
  fluencyTrend: 'improving' | 'stable' | 'declining';
  effortfulCount: number;
  avgPronunciationScore?: number | null;
  challengingSounds?: string[];
}

interface CardContext {
  cardType: string;
  response: string;
  success: boolean;
}

interface EngagementState {
  frustration: 'none' | 'low' | 'medium' | 'high';
  fatigue: 'none' | 'low' | 'medium' | 'high';
  recommendedAction?: string;
}

// =========================================================================
// System Prompt — Slimmed, personality-first, intent-aware
// =========================================================================

function buildSystemPrompt(
  userProfile: UserSpeechContext | null,
  sessionMetrics: SessionMetrics | null,
  challengingSounds: string[],
  semanticMemory: string,
  therapyIntent?: string,
  speechState?: 'struggling' | 'flowing' | 'neutral',
  sessionIntelligence?: string,
  crossSessionIntelligence?: string,
  therapyStrategy?: string,
  speechAnalysis?: SpeechAnalysis | null,
): string {
  let context = '';

  if (userProfile) {
    context += `\nUSER: ${userProfile.primaryChallenge || 'Word-finding'} challenge. ${userProfile.typicalPace || 'Variable'} pace.`;
    if (userProfile.effortfulSpeechRate && userProfile.effortfulSpeechRate > 0.3) {
      context += ' Often effortful — keep demands low.';
    }
  }

  if (sessionMetrics) {
    context += `\nSESSION: Turn ${sessionMetrics.turnsCompleted}. Fluency ${sessionMetrics.avgFluency}% (${sessionMetrics.fluencyTrend}).`;
    if (sessionMetrics.effortfulCount > 1) context += ' Reduce pressure.';
  }

  if (challengingSounds.length > 0) {
    context += `\nAVOID words containing these sounds: ${challengingSounds.join(', ')}.`;
  }

  const intentLine = getIntentInstruction(therapyIntent);

  // Determine speech state for prompt constraints
  const isStruggling = speechState === 'struggling';
  const isFlowing = speechState === 'flowing';

  const struggleRule = isStruggling
    ? `\nCRITICAL — USER IS STRUGGLING RIGHT NOW:
- Ask ONLY ONE question. Never two.
- Use yes/no or A-or-B format ONLY.
- Do NOT use open questions like "what did you do?"
- Say "no rush" or "I think I get it" ONCE, then give the choice.`
    : '';

  const flowRule = isFlowing
    ? `\nUSER IS FLOWING — do NOT use repair language ("no rush", "take your time", "I think I know"). They're doing fine. Match their energy.`
    : '';

  // Determine ASR confidence level for safety gating
  const completionConfidence = speechAnalysis?.completionConfidence || 'high';
  const lowConfidenceRule = completionConfidence === 'low'
    ? `\nLOW ASR CONFIDENCE — You are NOT sure what the user said:
- Do NOT correct, rephrase, or guess their words.
- Do NOT assume you understood correctly.
- Use a soft confirmation: "I think you said something about ___?" or "Did you say ___?"
- If completely unclear, say: "I didn't quite catch that — could you say it again?"
- NEVER respond as if you understood perfectly when confidence is low.`
    : '';

  // Progressive complexity: if user is consistently performing well, push harder
  const progressionRule = sessionMetrics && sessionMetrics.avgFluency > 70 && 
    sessionMetrics.fluencyTrend === 'improving' && sessionMetrics.turnsCompleted > 5
    ? `\nPROGRESSIVE COMPLEXITY — User is improving:
- Ask slightly more open questions (not just yes/no).
- Use longer sentence prompts that invite elaboration.
- Reference earlier topics to test recall.
- Gently introduce harder vocabulary related to their interests.`
    : '';

  // Emotional mirroring based on detected user state
  let emotionalRule = '';
  if (speechState === 'struggling') {
    emotionalRule = `\nEMOTIONAL MIRRORING — User is struggling:
- Match their effort with genuine empathy, not cheerfulness.
- Use softer reactions: "Mm-hmm", "I hear you", "That's okay", "No rush at all."
- Do NOT use upbeat reactions like "Ha!", "Ooh!", "Nice!" when they are clearly struggling.
- Acknowledge the difficulty without making it the focus.`;
  } else if (speechState === 'flowing' && sessionMetrics && sessionMetrics.effortfulCount > 0) {
    emotionalRule = `\nEMOTIONAL MIRRORING — User was struggling but now flowing:
- Celebrate the shift subtly: "Oh you're on a roll now" or "See, you've got this."
- Match their energy — they're building momentum, ride it with them.
- Do NOT reference past struggles explicitly ("you were struggling before").`;
  }

  const parts = [
    'You are Maya. You\'re having a real conversation with someone practicing speech after a stroke.',
    '',
    'You are genuinely curious about their life. You react to what they say like a real person would — with surprise, warmth, humor, or interest. You NEVER sound like a test, a system, or a script.' + context,
    '',
    'PURPOSE LAYER (CRITICAL — this is what makes this meaningful):',
    'You are NOT just chatting — you are helping this person communicate better in real life.',
    'Every question you ask should feel connected to real situations: talking to family, describing their day, ordering food, telling stories.',
    'Subtly reinforce WHY this matters by connecting to real life:',
    '- "like how you\'d tell someone about your day"',
    '- "so someone could picture it"',
    '- "like when you\'re explaining something to a friend"',
    'Do NOT be explicit or lecture-y. Keep it embedded and natural — 1 in every 2-3 responses.',
    'The user should always feel: "This is helping me talk better in real life" — never "Why am I doing this?"',
    '',
    'WHAT YOU KNOW:',
    semanticMemory || 'This is the start of the conversation.',
    crossSessionIntelligence || '',
    sessionIntelligence || '',
    therapyStrategy || '',
    'THIS TURN: ' + intentLine,
    struggleRule + flowRule + lowConfidenceRule + progressionRule + emotionalRule,
    '',
    'MANDATORY RESPONSE STRUCTURE:',
    '1. REACT to what they just said — reference something SPECIFIC they mentioned. Not "nice" — something real.',
    '2. THEN ask or guide. Never start with a question alone.',
    '',
    'OPENER VARIETY (CRITICAL — never use the same opener twice in a row):',
    'Pick from ALL of these categories, rotating through them:',
    'Warm: "Oh I love that." / "That sounds really nice." / "Aww." / "Ha, that\'s funny." / "That\'s sweet."',
    'Curious: "Wait really?" / "Oh wow." / "Huh, interesting." / "No way." / "Whoa." / "Oh?" / "Hmm!"',
    'Casual: "Right, right." / "Ah okay." / "Hmm." / "Got it, got it." / "Mm-hmm." / "Sure, sure."',
    'Engaged: "Ooh." / "Ha!" / "Oh cool." / "Nice, nice." / "Love it." / "Oh fun!"',
    'Empathetic: "I hear you." / "That makes sense." / "I get it." / "Of course." / "Yeah, totally."',
    'Surprised: "Oh no!" / "Seriously?" / "Wait what?" / "You\'re kidding!" / "Oh man."',
    'Reflective: "That\'s a good point." / "Huh, never thought of it that way." / "Yeah I can see that."',
    'RULE: Track which opener category you used last. Use a DIFFERENT category this turn.',
    '',
    'CONTEXT ANCHORING (CRITICAL):',
    '- Reference a SPECIFIC word, name, or detail from their last message.',
    '- BAD: "Tell me more." GOOD: "Eggs and toast — did you make that yourself?"',
    '- BAD: "What else?" GOOD: "The park sounds nice — who\'d you go with?"',
    '',
    'HARD RULES:',
    '- MAX 18 words. Short and warm.',
    '- ONE question max per response. Never two.',
    '- End with something easy to answer.',
    '- NEVER say: "exercise", "task", "correct", "incorrect", "let\'s assess", "good job" (sounds clinical).',
    '- NEVER re-ask something they already told you.',
    '- Sound like a warm friend, not a therapist or AI.',
    '- Never mention being AI.',
    '',
    'CONVERSATION RELIABILITY RULES (CRITICAL — violating these breaks user trust):',
    '',
    '1. NEVER PROMISE SOMETHING YOU CANNOT DO:',
    '   - NEVER say "let me show you", "I\'ll show you", "check this out", "look at this"',
    '     unless a game/visual is ACTUALLY being triggered (you\'ll see [Exercise done] context).',
    '   - You are a voice conversational partner. You cannot show images, links, or demos on your own.',
    '   - Instead of "let me show you something", say: "Tell me more about that."',
    '',
    '2. NEVER USE VAGUE FILLER DIRECTIVES:',
    '   - BANNED: bare "keep going", "go on", "continue" WITHOUT specifying the topic.',
    '   - BAD: "That was good! Keep going." GOOD: "That was good! Tell me more about the app."',
    '   - Every directive MUST include the topic or a specific detail from their speech.',
    '',
    '3. WHEN THE USER CORRECTS YOU — TOP PRIORITY:',
    '   - If user says "no, I was talking about X" or "aren\'t you listening" or "I already said":',
    '     a) Acknowledge: "Right, sorry!" or "My bad!"',
    '     b) Restate THEIR topic',
    '     c) Ask about THEIR topic',
    '   - NEVER deflect or pivot. NEVER ask a generic new question.',
    '',
    '4. NEVER RESET TO A GENERIC TOPIC:',
    '   - If the user has a clear topic, NEVER switch to "think about your morning" or "what did you do today".',
    '   - If unsure what to ask, ask ANOTHER question about the SAME topic from your MEMORY.',
    '',
    '5. STAY ON THE USER\'S TOPIC:',
    '   - Their topic is MORE important than your therapy intent.',
    '   - Topic changes should ONLY come from the user, never from you.',
  ];
  return parts.filter(Boolean).join('\n');
}

// =========================================================================
// Tool definition for structured response + memory
// =========================================================================

const RESPOND_TOOL = {
  type: "function" as const,
  function: {
    name: "respond_and_remember",
    description: "Respond to the user and update your conversation memory",
    parameters: {
      type: "object",
      properties: {
        response: {
          type: "string",
          description:
            "Your spoken response. Start with a brief human reaction (e.g. 'Oh nice!', 'Ha really?', 'Hmm got it'), then your question or follow-up. Maximum 18 words total. NEVER say 'let me show you' or bare 'keep going' without a topic.",
        },
        memory: {
          type: "string",
          description:
            "Structured memory: TOPIC: [current main topic — update when user corrects you]. DETAILS: [ALL key people, places, things, specifics mentioned so far — accumulate, never discard]. THREAD: [what they were JUST talking about]. When user corrects you ('no, I was talking about X'), immediately update TOPIC to X.",
        },
      },
      required: ["response", "memory"],
      additionalProperties: false,
    },
  },
};

// =========================================================================
// Main Handler
// =========================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a valid Supabase session — prevents anonymous AI-credit abuse.
    const caller = await getAuthedUser(req);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const {
      userTranscript,
      turnNumber,
      conversationHistory,
      cardContext,
      speechAnalysis,
      userProfile,
      sessionMetrics,
      engagementState,
      suggestedCue,
      exerciseContext,
      priorSessionMemory,
      rollingMemory,
      therapyIntent,
      circumlocutionDetected,
      difficultyNarration,
      sessionIntelligence,
      crossSessionIntelligence,
      therapyStrategy,
      anchorContext,
      therapeuticLevel,
      hallucinationGuard,
    } = await req.json() as {
      userTranscript: string;
      turnNumber: number;
      conversationHistory?: { role: string; text: string }[];
      cardContext?: CardContext;
      speechAnalysis?: SpeechAnalysis;
      userProfile?: UserSpeechContext;
      sessionMetrics?: SessionMetrics;
      engagementState?: EngagementState;
      suggestedCue?: { cueType: string; cueText: string };
      exerciseContext?: {
        slug: string;
        summary: string;
        accuracy?: number;
        cueLevelUsed?: number;
        successBand?: string;
        targetDomain?: string;
        errorTypes?: string[];
        struggleSignal?: string;
      };
      priorSessionMemory?: string;
      rollingMemory?: string;
      therapyIntent?: string;
      circumlocutionDetected?: boolean;
      difficultyNarration?: string;
      sessionIntelligence?: string;
      crossSessionIntelligence?: string;
      therapyStrategy?: string;
      anchorContext?: {
        candidateAnchors: string[];
        preferredAnchor: string | null;
        anchorRequired: boolean;
      };
      therapeuticLevel?: {
        level: number;
        label: string;
        promptBlock: string;
        anchorUsageType: string;
      };
      hallucinationGuard?: {
        promptBlock: string;
        allowedEntities: string[];
      };
    };

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ response: "Tell me more.", memoryUpdate: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Engagement safety check
    if (engagementState?.frustration === 'high' || engagementState?.fatigue === 'high') {
      return new Response(
        JSON.stringify({
          response: "Let's take a break. You're doing great.",
          suggestBreak: true,
          memoryUpdate: rollingMemory || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build semantic memory from actual conversation + AI rolling memory
    const semanticMemory = buildSemanticMemory(
      conversationHistory || [],
      rollingMemory
    );

    // Collect challenging sounds from all sources
    const challengingSounds: string[] = [
      ...(speechAnalysis?.challengingSounds || []),
      ...(sessionMetrics?.challengingSounds || []),
    ];

    // Derive speech state for prompt-level constraints
    const speechState: 'struggling' | 'flowing' | 'neutral' = 
      speechAnalysis?.effortfulSpeech || speechAnalysis?.pausePattern === 'very_slow'
        ? 'struggling'
        : speechAnalysis?.fluencyScore && speechAnalysis.fluencyScore > 60
          ? 'flowing'
          : 'neutral';

    // Build system prompt (slimmed, intent-aware, speech-state-aware)
    const systemPrompt = buildSystemPrompt(
      userProfile || null,
      sessionMetrics || null,
      challengingSounds,
      semanticMemory,
      therapyIntent,
      speechState,
      sessionIntelligence,
      crossSessionIntelligence,
      therapyStrategy,
      speechAnalysis || null,
    );

    // Construct messages
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Prior session memory (MayaState cross-session context)
    if (priorSessionMemory) {
      messages.push({
        role: 'system',
        content: `[PRIOR SESSIONS — reference naturally, don't repeat verbatim: ${priorSessionMemory}]`,
      });
    }

    // Conversation history (increased window from 6 to 8)
    if (conversationHistory?.length) {
      conversationHistory.slice(-8).forEach((turn: { role: string; text: string }) => {
        messages.push({
          role: turn.role === 'ai' ? 'assistant' : 'user',
          content: turn.text,
        });
      });
    }

    // Card context
    if (cardContext) {
      const note = cardContext.success
        ? `[User named "${cardContext.response}" in a ${cardContext.cardType}. Echo it naturally and ask a follow-up about it.]`
        : `[User tried a ${cardContext.cardType}. Be encouraging, then continue conversation.]`;
      messages.push({ role: 'system', content: note });
    }

    // Exercise context
    if (exerciseContext) {
      const note =
        exerciseContext.successBand === 'high' || exerciseContext.successBand === 'target'
          ? `[Exercise done: ${exerciseContext.summary}. Acknowledge naturally, return to conversation.]`
          : `[Exercise done: ${exerciseContext.summary}. Be encouraging, return to conversation.]`;
      messages.push({ role: 'system', content: note });
    }

    // Speech analysis context — drives struggle/flow state
    if (speechAnalysis) {
      let note = '[SPEECH STATE: ';
      if (speechAnalysis.effortfulSpeech || speechAnalysis.pausePattern === 'very_slow') {
        note += 'STRUGGLING — one simple question only, yes/no or A-or-B. No open questions. ';
      } else if (speechAnalysis.pausePattern === 'hesitant') {
        note += 'HESITANT — keep question simple, offer choices. ';
      } else if (speechAnalysis.fluencyScore > 60) {
        note += 'FLOWING — do NOT say "no rush" or "take your time". They are fine. ';
      }
      if (speechAnalysis.circumlocutionDetected || circumlocutionDetected) {
        note += 'CIRCUMLOCUTION DETECTED — the user is describing a word they cannot find. ';
        note += 'Try to guess the word from context and offer it naturally. ';
        note += 'Example: If they say "the place where you buy food", say "The grocery store? Tell me about it." ';
        note += 'Do NOT ask them to try again. Just offer the word and move on. ';
      }
      if (speechAnalysis.wordCount < 3 && speechAnalysis.fluencyScore > 50) {
        note += 'Short but confident — they are okay, just brief. ';
      }
      if (speechAnalysis.speechContext) {
        note += speechAnalysis.speechContext;
      }
      note += ']';
      messages.push({ role: 'system', content: note });
    }

    // Difficulty change narration — prepend to response
    if (difficultyNarration) {
      messages.push({
        role: 'system',
        content: `[IMPORTANT: Start your response with this difficulty adjustment: "${difficultyNarration}" — then continue with your normal reaction and question.]`,
      });
    }

    // Cue context
    if (suggestedCue) {
      messages.push({
        role: 'system',
        content: `[User struggling. Work this ${suggestedCue.cueType} cue in naturally: "${suggestedCue.cueText}"]`,
      });
    }

    // Anchor contract — inject mandatory anchoring into prompt
    if (anchorContext?.anchorRequired && anchorContext.candidateAnchors.length > 0) {
      const preferred = anchorContext.preferredAnchor || anchorContext.candidateAnchors[0];
      const others = anchorContext.candidateAnchors.filter(a => a !== preferred);
      let anchorBlock = `\n[ANCHOR CONTRACT — MANDATORY]\n`;
      anchorBlock += `You MUST naturally reference "${preferred}" in your reply.\n`;
      if (others.length > 0) {
        anchorBlock += `Other valid anchors: ${others.join(', ')}\n`;
      }
      anchorBlock += `BAD: "That sounds nice. What did you do?" (ignores their words)\n`;
      anchorBlock += `GOOD: "Your ${preferred} — tell me more about that!"\n`;
      anchorBlock += `If you cannot use the anchor naturally, at least reference ONE specific detail they said.`;
      messages.push({ role: 'system', content: anchorBlock });
    }

    // Therapeutic Response Ladder — inject level-specific behavior
    if (therapeuticLevel?.promptBlock) {
      messages.push({ role: 'system', content: therapeuticLevel.promptBlock });
      console.log(`TRL Level ${therapeuticLevel.level}: ${therapeuticLevel.label} (${therapeuticLevel.anchorUsageType})`);
    }

    // Hallucination Guard — prevent Maya from introducing entities user never mentioned
    if (hallucinationGuard?.promptBlock) {
      messages.push({ role: 'system', content: hallucinationGuard.promptBlock });
    }

    // ═══ USER CORRECTION DETECTION ═══
    const correctionPatterns = [
      /no,?\s*(i was|i('m| am)|we were) (talking|telling|saying)/i,
      /aren('t| are not) you listening/i,
      /don('t| do not) you listen/i,
      /i (already|just) (said|told|mentioned)/i,
      /that('s| is) not what i (said|meant)/i,
      /i('m| am) talking about/i,
    ];
    const userIsCorrectingMaya = correctionPatterns.some(p => p.test(userTranscript || ''));
    
    if (userIsCorrectingMaya) {
      messages.push({
        role: 'system',
        content: `[⚠️ USER CORRECTION DETECTED — The user is telling you that you misunderstood or weren't listening. This is your TOP PRIORITY:\n1. Acknowledge: "Right, sorry!" or "My bad!"\n2. Restate THEIR topic from what they just said\n3. Ask about THEIR topic specifically\nDo NOT deflect. Do NOT ask a generic question. Do NOT change the subject.]`,
      });
      console.log('USER CORRECTION DETECTED:', userTranscript?.slice(0, 50));
    }

    // Current user message
    messages.push({ role: 'user', content: userTranscript?.trim() || '(silence)' });

    console.log(`Turn ${turnNumber}:`, {
      transcript: userTranscript?.slice(0, 50),
      intent: therapyIntent,
      hasMemory: !!rollingMemory,
      effortful: speechAnalysis?.effortfulSpeech,
      anchors: anchorContext?.candidateAnchors?.slice(0, 3),
    });

    // Call AI with tool calling for structured response + memory
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        tools: [RESPOND_TOOL],
        tool_choice: { type: "function", function: { name: "respond_and_remember" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limited', response: 'Go on...', memoryUpdate: rollingMemory }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', response: 'Tell me more.', memoryUpdate: rollingMemory }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fallback = speechAnalysis?.effortfulSpeech ? "Take your time." : "Interesting! Go on.";
      return new Response(
        JSON.stringify({ response: fallback, memoryUpdate: rollingMemory || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Parse structured response from tool call
    let aiResponse = 'Tell me more.';
    let memoryUpdate: string | null = rollingMemory || null;

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        aiResponse = args.response || aiResponse;
        memoryUpdate = args.memory || memoryUpdate;
      } catch (e) {
        console.warn('Failed to parse tool call, using content fallback:', e);
        aiResponse = data.choices?.[0]?.message?.content?.trim() || aiResponse;
      }
    } else {
      // Fallback: model returned plain text instead of tool call
      aiResponse = data.choices?.[0]?.message?.content?.trim() || aiResponse;
    }

    // Enforce word limit
    const words = aiResponse.split(/\s+/);
    if (words.length > 20) {
      let cutoff = 18;
      const qIdx = words.slice(0, 20).findIndex((w: string) => w.includes('?'));
      if (qIdx > 5) cutoff = qIdx + 1;
      aiResponse = words.slice(0, cutoff).join(' ');
      if (!aiResponse.match(/[.!?]$/)) aiResponse += '?';
    }

    // Remove AI self-references
    aiResponse = aiResponse
      .replace(/as an ai/gi, '')
      .replace(/I'm an AI/gi, '')
      .replace(/I am an AI/gi, '')
      .replace(/as your assistant/gi, '')
      .trim();

    // ═══ RELIABILITY GUARD — ban unfulfillable promises & vague fillers ═══
    const lowerResponse = aiResponse.toLowerCase();
    
    // 1. Ban unfulfillable promises (Maya can't show things)
    const unfulfillablePatterns = [
      /let me show you/i,
      /i('ll| will) show you/i,
      /check this out/i,
      /look at this/i,
      /here('s|,? take a look)/i,
      /watch this/i,
    ];
    
    let hadUnfulfillable = false;
    for (const pattern of unfulfillablePatterns) {
      if (pattern.test(aiResponse)) {
        hadUnfulfillable = true;
        // Replace the promise with a safe alternative
        aiResponse = aiResponse.replace(pattern, 'tell me more about that');
        console.log('RELIABILITY: Stripped unfulfillable promise from response');
      }
    }
    
    // 2. Ban vague bare "keep going" / "go on" / "continue" without topic
    const vagueFillerPattern = /^(.*?)(keep going|go on|continue)(\.|\!|\?)?$/i;
    const vagueInternalPattern = /(alright,?\s*)?keep going(\.|\!)?/i;
    if (vagueInternalPattern.test(aiResponse) && !aiResponse.includes('about') && !aiResponse.includes('with the') && !aiResponse.includes('with your')) {
      // The response has bare "keep going" without topic context
      const topicFromMemory = memoryUpdate?.match(/TOPIC:\s*([^.]+)/)?.[1]?.trim();
      if (topicFromMemory) {
        aiResponse = aiResponse.replace(vagueInternalPattern, `tell me more about ${topicFromMemory}`);
        console.log('RELIABILITY: Replaced vague "keep going" with topic:', topicFromMemory);
      } else {
        aiResponse = aiResponse.replace(vagueInternalPattern, 'what were you saying about that');
        console.log('RELIABILITY: Replaced vague "keep going" (no topic available)');
      }
    }

    // ═══ ANCHOR VALIDATION + RETRY ═══
    let anchoringPass = true;
    let regenerationNeeded = false;
    let matchedAnchor: string | null = null;

    if (anchorContext?.anchorRequired && anchorContext.candidateAnchors.length > 0) {
      const lowerReply = aiResponse.toLowerCase();
      for (const anchor of anchorContext.candidateAnchors) {
        if (lowerReply.includes(anchor.toLowerCase())) {
          matchedAnchor = anchor;
          break;
        }
      }

      if (!matchedAnchor) {
        anchoringPass = false;
        regenerationNeeded = true;
        console.log('Anchor MISS — retrying once. Anchors:', anchorContext.candidateAnchors);

        // One retry with stronger correction
        const retryMessages = [
          ...messages.slice(0, -1), // Remove last user message temporarily
          {
            role: 'system' as const,
            content: `REVISION REQUIRED: Your previous response "${aiResponse}" did not reference the user's specific details. Rewrite it so it naturally includes one of: ${anchorContext.candidateAnchors.join(', ')}. Keep it under 18 words.`,
          },
          messages[messages.length - 1], // Re-add user message
        ];

        try {
          const retryResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: retryMessages,
              tools: [RESPOND_TOOL],
              tool_choice: { type: "function", function: { name: "respond_and_remember" } },
            }),
          });

          if (retryResp.ok) {
            const retryData = await retryResp.json();
            const retryToolCall = retryData.choices?.[0]?.message?.tool_calls?.[0];
            let retryResponse = aiResponse; // Keep original as fallback

            if (retryToolCall?.function?.arguments) {
              try {
                const retryArgs = JSON.parse(retryToolCall.function.arguments);
                if (retryArgs.response) retryResponse = retryArgs.response;
                if (retryArgs.memory) memoryUpdate = retryArgs.memory;
              } catch { /* keep original */ }
            } else if (retryData.choices?.[0]?.message?.content) {
              retryResponse = retryData.choices[0].message.content.trim();
            }

            // Check if retry succeeded
            const retryLower = retryResponse.toLowerCase();
            for (const anchor of anchorContext.candidateAnchors) {
              if (retryLower.includes(anchor.toLowerCase())) {
                matchedAnchor = anchor;
                anchoringPass = true;
                break;
              }
            }

            if (anchoringPass) {
              aiResponse = retryResponse;
              // Re-apply word limit
              const retryWords = aiResponse.split(/\s+/);
              if (retryWords.length > 20) {
                const cutoff = 18;
                aiResponse = retryWords.slice(0, cutoff).join(' ');
                if (!aiResponse.match(/[.!?]$/)) aiResponse += '?';
              }
              console.log('Anchor RECOVERED on retry:', matchedAnchor);
            } else {
              console.log('Anchor still missed after retry — accepting best response');
            }
          }
        } catch (retryErr) {
          console.warn('Anchor retry failed:', retryErr);
        }
      }
    }

    // ═══ HALLUCINATION GUARD — POST-RESPONSE VALIDATION ═══
    let hallucinationPass = true;
    let hallucinatedWords: string[] = [];

    if (hallucinationGuard?.allowedEntities && hallucinationGuard.allowedEntities.length > 0) {
      // Build a concrete noun regex (simplified server-side check)
      const concreteNounPattern = /\b(dog|cat|bird|duck|ducks|elephant|fish|horse|cow|pig|rabbit|bear|lion|tiger|monkey|penguin|chicken|turtle|frog|snake|cake|pie|cookie|bread|toast|egg|eggs|bacon|cheese|butter|milk|juice|pizza|burger|sandwich|salad|soup|steak|rice|pasta|banana|apple|grape|strawberry|watermelon|peach|pear|lemon|mango|chocolate|vanilla|candy|donut|pancake|waffle|popcorn|car|truck|bus|train|plane|boat|bicycle|motorcycle|chair|table|desk|couch|bed|lamp|mirror|clock|door|window|pillow|blanket|cup|glass|plate|bowl|fork|knife|spoon|bottle|pen|pencil|book|camera|phone|computer|guitar|piano|ball|balloon|kite|puzzle|doll|swing|swings|slide|pool|beach|ocean|lake|river|pond|mountain|forest|garden|flower|flowers|tree|hat|glasses|scarf|shoe|shoes|shirt|jacket|coat|dress|pants|belt|purse|backpack|umbrella|watch|ring|necklace)\b/gi;
      
      const responseNouns = aiResponse.match(concreteNounPattern);
      if (responseNouns) {
        const allowedSet = new Set(hallucinationGuard.allowedEntities.map((e: string) => e.toLowerCase()));
        // Safe generic nouns Maya can always use
        const safeNouns = new Set(['time', 'day', 'way', 'thing', 'place', 'kind', 'type', 'fun', 'story', 'memory', 'break', 'rest', 'word', 'words', 'sound', 'sounds', 'question', 'answer', 'feeling', 'mood', 'energy']);
        
        const seen = new Set<string>();
        for (const noun of responseNouns) {
          const lower = noun.toLowerCase();
          if (seen.has(lower) || safeNouns.has(lower)) continue;
          seen.add(lower);
          // Check with singular/plural
          const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
          const plural = lower + 's';
          if (!allowedSet.has(lower) && !allowedSet.has(singular) && !allowedSet.has(plural)) {
            hallucinatedWords.push(lower);
          }
        }
        
        if (hallucinatedWords.length > 0) {
          hallucinationPass = false;
          console.log('HALLUCINATION DETECTED:', hallucinatedWords, '| Allowed:', [...allowedSet].slice(0, 10));
          
          // One retry without the hallucinated content
          const retryMessages = [
            ...messages.slice(0, -1),
            {
              role: 'system' as const,
              content: `REVISION REQUIRED: Your response "${aiResponse}" introduced words the user never said: [${hallucinatedWords.join(', ')}]. Rewrite using ONLY entities the user mentioned: ${hallucinationGuard.allowedEntities.slice(0, 10).join(', ')}. Do NOT add any new objects, animals, or food. Keep under 18 words.`,
            },
            messages[messages.length - 1],
          ];
          
          try {
            const retryResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: retryMessages,
                tools: [RESPOND_TOOL],
                tool_choice: { type: "function", function: { name: "respond_and_remember" } },
              }),
            });
            
            if (retryResp.ok) {
              const retryData = await retryResp.json();
              const retryToolCall = retryData.choices?.[0]?.message?.tool_calls?.[0];
              let retryResponse = aiResponse;
              
              if (retryToolCall?.function?.arguments) {
                try {
                  const retryArgs = JSON.parse(retryToolCall.function.arguments);
                  if (retryArgs.response) retryResponse = retryArgs.response;
                  if (retryArgs.memory) memoryUpdate = retryArgs.memory;
                } catch { /* keep original */ }
              } else if (retryData.choices?.[0]?.message?.content) {
                retryResponse = retryData.choices[0].message.content.trim();
              }
              
              // Check if retry is clean
              const retryNouns = retryResponse.match(concreteNounPattern);
              let retryClean = true;
              if (retryNouns) {
                for (const noun of retryNouns) {
                  const lower = noun.toLowerCase();
                  if (safeNouns.has(lower)) continue;
                  const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
                  const plural = lower + 's';
                  if (!allowedSet.has(lower) && !allowedSet.has(singular) && !allowedSet.has(plural)) {
                    retryClean = false;
                    break;
                  }
                }
              }
              
              if (retryClean) {
                aiResponse = retryResponse;
                hallucinationPass = true;
                hallucinatedWords = [];
                // Re-apply word limit
                const retryWords = aiResponse.split(/\s+/);
                if (retryWords.length > 20) {
                  aiResponse = retryWords.slice(0, 18).join(' ');
                  if (!aiResponse.match(/[.!?]$/)) aiResponse += '?';
                }
                console.log('Hallucination RECOVERED on retry');
              } else {
                console.log('Hallucination still present after retry — accepting best response');
              }
            }
          } catch (retryErr) {
            console.warn('Hallucination retry failed:', retryErr);
          }
        }
      }
    }

    console.log('Maya:', aiResponse, '| Memory:', memoryUpdate?.slice(0, 60),
      '| Anchor:', matchedAnchor || 'none', anchoringPass ? '✅' : '❌',
      '| Hallucination:', hallucinationPass ? '✅' : `❌ [${hallucinatedWords.join(',')}]`);

    return new Response(
      JSON.stringify({
        response: aiResponse,
        memoryUpdate,
        anchorMetrics: {
          candidateAnchors: anchorContext?.candidateAnchors || [],
          preferredAnchor: anchorContext?.preferredAnchor || null,
          anchorRequired: anchorContext?.anchorRequired || false,
          anchorUsed: anchoringPass,
          matchedAnchor,
          regenerationNeeded,
          anchoringPass,
        },
        therapeuticLevel: therapeuticLevel ? {
          level: therapeuticLevel.level,
          label: therapeuticLevel.label,
          anchorUsageType: therapeuticLevel.anchorUsageType,
        } : undefined,
        hallucinationMetrics: {
          passed: hallucinationPass,
          violatingWords: hallucinatedWords,
          allowlistSize: hallucinationGuard?.allowedEntities?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-coach-ai:', error);
    return new Response(
      JSON.stringify({ response: "What else?", memoryUpdate: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
// v3
