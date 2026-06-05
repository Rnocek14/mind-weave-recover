/**
 * ScenarioOverlay — Focused real-world practice experience
 * 
 * Slides up from chat (~85% height) for immersive roleplay.
 * States: pre_start → live → feedback → reflection
 * 
 * Design principles:
 * - Feels like a safe conversation, not a test
 * - "Maya whispers" for scaffolded cues
 * - Functional scoring, not accuracy %
 * - Progressive support hierarchy (Hint > Repeat > Help)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Mic, MicOff, ArrowRight, MessageCircle, RotateCcw, HelpCircle, Lightbulb, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type ScenarioDefinition,
  type ScenarioState,
  type ScenarioPhase,
  type ScenarioScore,
  createScenarioState,
  computeScenarioScore,
} from '@/lib/scenarioEngine';

interface ScenarioOverlayProps {
  scenario: ScenarioDefinition;
  onClose: () => void;
  onComplete: (score: ScenarioScore) => void;
  /** Speech recognition hook — parent provides */
  isListening: boolean;
  liveTranscript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  /** TTS — parent provides */
  onSpeak: (text: string) => Promise<void>;
  isSpeaking: boolean;
}

export function ScenarioOverlay({
  scenario,
  onClose,
  onComplete,
  isListening,
  liveTranscript,
  onStartListening,
  onStopListening,
  onSpeak,
  isSpeaking,
}: ScenarioOverlayProps) {
  const [state, setState] = useState<ScenarioState>(() => createScenarioState(scenario.id));
  const [partnerText, setPartnerText] = useState('');
  const [whisperText, setWhisperText] = useState<string | null>(null);
  const [score, setScore] = useState<ScenarioScore | null>(null);
  const [reflectionAnswer, setReflectionAnswer] = useState<string | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exchangeStartRef = useRef<number>(Date.now());
  const latestTranscriptRef = useRef<string>('');

  // ===== Phase transitions =====
  
  const startScenario = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'live', startedAt: Date.now() }));
    setPartnerText(scenario.openingLine);
    exchangeStartRef.current = Date.now();
    await onSpeak(scenario.openingLine);
    // Auto-start listening after partner speaks
    setTimeout(() => onStartListening(), 300);
  }, [scenario, onSpeak, onStartListening]);

  // Handle user completing a turn
  const handleUserTurn = useCallback((transcript: string) => {
    if (!transcript.trim()) return;
    
    const currentBeat = scenario.beats[state.currentBeatIndex];
    const latencyMs = Date.now() - exchangeStartRef.current;
    
    // Functional intent scoring — checks if the response is meaningful for this beat
    const currentBeatExpected = currentBeat?.expectedUserIntent || '';
    const intentLanded = assessIntentLanded(transcript, currentBeatExpected, partnerText);
    
    const exchange = {
      partnerText: partnerText,
      userTranscript: transcript,
      intentLanded,
      latencyMs,
      cuesUsed: state.hintsUsed,
      timestamp: Date.now(),
    };

    const nextBeatIndex = state.currentBeatIndex + 1;
    const isLastBeat = nextBeatIndex >= scenario.beats.length;

    setState(prev => ({
      ...prev,
      exchanges: [...prev.exchanges, exchange],
      currentBeatIndex: nextBeatIndex,
    }));

    setWhisperText(null);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (isLastBeat) {
      // Scenario complete
      const finalState = {
        ...state,
        exchanges: [...state.exchanges, exchange],
        completedAt: Date.now(),
        phase: 'feedback' as ScenarioPhase,
      };
      const computed = computeScenarioScore(finalState, scenario);
      setScore(computed);
      setState(prev => ({ ...prev, phase: 'feedback', completedAt: Date.now() }));
    } else {
      // Next beat — partner responds
      const nextBeat = scenario.beats[nextBeatIndex];
      setTimeout(async () => {
        // Generate contextual partner response (for now, use beat action as prompt)
        const response = generatePartnerResponse(nextBeat, transcript);
        setPartnerText(response);
        exchangeStartRef.current = Date.now();
        await onSpeak(response);
        setTimeout(() => onStartListening(), 300);
      }, 500);
    }
  }, [state, scenario, partnerText, onSpeak, onStartListening]);

  // Keep transcript ref in sync so we always capture the latest value
  useEffect(() => {
    latestTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  // Silence detection → Maya whispers
  useEffect(() => {
    if (state.phase !== 'live' || !isListening || isSpeaking) return;
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    const currentBeat = scenario.beats[state.currentBeatIndex];
    if (!currentBeat) return;

    // Only trigger whisper if user hasn't produced meaningful speech yet
    const hasSpoken = liveTranscript.trim().length > 0;
    const silenceDelay = hasSpoken ? 12000 : 8000; // longer if they started speaking

    silenceTimerRef.current = setTimeout(() => {
      const whisperIndex = Math.min(state.whispersTriggered, currentBeat.whispers.length - 1);
      const whisper = currentBeat.whispers[whisperIndex];
      if (whisper) {
        setWhisperText(whisper);
        setState(prev => ({ ...prev, whispersTriggered: prev.whispersTriggered + 1 }));
      }
    }, silenceDelay);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [state.phase, state.currentBeatIndex, isListening, isSpeaking, state.whispersTriggered, scenario.beats, liveTranscript]);

  // When user stops speaking (transcript finalizes) — use ref to avoid stale closure
  useEffect(() => {
    if (!isListening && state.phase === 'live') {
      const captured = latestTranscriptRef.current.trim();
      if (captured) {
        handleUserTurn(captured);
      }
    }
  }, [isListening, state.phase, handleUserTurn]);

  // ===== Support actions =====
  
  const handleHint = useCallback(() => {
    const currentBeat = scenario.beats[state.currentBeatIndex];
    if (!currentBeat) return;
    const hint = currentBeat.whispers[0];
    if (hint) {
      setWhisperText(hint);
      setState(prev => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
    }
  }, [state.currentBeatIndex, scenario.beats]);

  const handleRepeat = useCallback(() => {
    onSpeak(partnerText);
    setState(prev => ({ ...prev, repeatsUsed: prev.repeatsUsed + 1 }));
  }, [partnerText, onSpeak]);

  const handleHelp = useCallback(() => {
    const currentBeat = scenario.beats[state.currentBeatIndex];
    if (!currentBeat) return;
    const lastWhisper = currentBeat.whispers[currentBeat.whispers.length - 1];
    if (lastWhisper) {
      setWhisperText(lastWhisper);
      onSpeak(lastWhisper);
      setState(prev => ({ ...prev, helpsUsed: prev.helpsUsed + 1 }));
    }
  }, [state.currentBeatIndex, scenario.beats, onSpeak]);

  // ===== Render by phase =====

  return (
    <div className="fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Backdrop */}
      <div className="h-[15%] bg-background/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Overlay panel */}
      <div className="h-[85%] bg-background rounded-t-3xl border-t border-border/50 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{scenario.icon}</span>
            <div>
              <span className="text-sm font-medium text-foreground">{scenario.title}</span>
              <span className="text-xs text-muted-foreground ml-2">with {scenario.partnerName}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {state.phase === 'pre_start' && (
            <PreStartView scenario={scenario} onStart={startScenario} />
          )}
          {state.phase === 'live' && (
            <LiveView
              scenario={scenario}
              state={state}
              partnerText={partnerText}
              liveTranscript={liveTranscript}
              isListening={isListening}
              isSpeaking={isSpeaking}
              whisperText={whisperText}
              onMicToggle={() => isListening ? onStopListening() : onStartListening()}
              onHint={handleHint}
              onRepeat={handleRepeat}
              onHelp={handleHelp}
            />
          )}
          {state.phase === 'feedback' && score && (
            <FeedbackView
              scenario={scenario}
              score={score}
              state={state}
              onReflection={(answer) => {
                setReflectionAnswer(answer);
                onComplete(score);
              }}
              onDone={() => onComplete(score)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Pre-Start View =====

function PreStartView({ scenario, onStart }: { scenario: ScenarioDefinition; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
      <span className="text-5xl">{scenario.icon}</span>
      
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          {scenario.title}
        </h2>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          You'll practice with <strong>{scenario.partnerName}</strong> ({scenario.partnerRole.toLowerCase()})
        </p>
      </div>

      {/* What success looks like */}
      <div className="bg-muted/50 rounded-xl px-4 py-3 max-w-[300px]">
        <p className="text-xs text-muted-foreground mb-1">What to aim for</p>
        <p className="text-sm text-foreground">{scenario.successCriteria}</p>
      </div>

      {/* Confidence primer */}
      <p className="text-sm text-muted-foreground italic">
        {scenario.confidencePrimer}
      </p>

      {/* Supports enabled */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Lightbulb className="w-3 h-3" /> Hints available
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> I'll help if you get stuck
        </span>
      </div>

      <Button 
        size="lg" 
        className="gap-2 px-8 mt-2"
        onClick={onStart}
      >
        I'm ready
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ===== Live View =====

interface LiveViewProps {
  scenario: ScenarioDefinition;
  state: ScenarioState;
  partnerText: string;
  liveTranscript: string;
  isListening: boolean;
  isSpeaking: boolean;
  whisperText: string | null;
  onMicToggle: () => void;
  onHint: () => void;
  onRepeat: () => void;
  onHelp: () => void;
}

function LiveView({
  scenario, state, partnerText, liveTranscript,
  isListening, isSpeaking, whisperText,
  onMicToggle, onHint, onRepeat, onHelp,
}: LiveViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Partner message */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 gap-6">
        {/* Role indicator */}
        <div className="text-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {scenario.partnerName} · {scenario.partnerRole}
          </span>
        </div>

        {/* Partner speech bubble */}
        <div className={cn(
          "bg-muted/60 rounded-2xl px-5 py-4 max-w-[320px] mx-auto",
          "animate-in fade-in-0 duration-200",
          isSpeaking && "ring-2 ring-primary/20"
        )}>
          <p className="text-base text-foreground leading-relaxed">{partnerText}</p>
        </div>

        {/* Maya whisper */}
        {whisperText && (
          <div className="flex items-start gap-2 mx-auto max-w-[280px] animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
            <span className="text-xs mt-0.5">✨</span>
            <p className="text-xs text-muted-foreground italic">{whisperText}</p>
          </div>
        )}

        {/* User transcript area */}
        <div className={cn(
          "bg-card/60 border border-border/30 rounded-2xl px-5 py-4 max-w-[320px] mx-auto min-h-[60px]",
          "flex items-center justify-center transition-all duration-200",
          isListening && "border-primary/40 bg-primary/5"
        )}>
          {liveTranscript ? (
            <p className="text-base text-foreground text-center">{liveTranscript}</p>
          ) : isListening ? (
            <p className="text-sm text-muted-foreground animate-pulse">Listening…</p>
          ) : (
            <p className="text-sm text-muted-foreground">Tap mic to speak</p>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="border-t border-border/30 px-6 py-4 space-y-3">
        {/* Support row — progressive hierarchy */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onHint}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Hint
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={onRepeat}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Repeat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground/60"
            onClick={onHelp}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help
          </Button>
        </div>

        {/* Mic button */}
        <div className="flex justify-center">
          <button
            onClick={onMicToggle}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
              isListening
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Feedback View =====

interface FeedbackViewProps {
  scenario: ScenarioDefinition;
  score: ScenarioScore;
  state: ScenarioState;
  onReflection: (answer: string) => void;
  onDone: () => void;
}

function FeedbackView({ scenario, score, state, onReflection, onDone }: FeedbackViewProps) {
  const [showReflection, setShowReflection] = useState(false);

  return (
    <div className="flex flex-col h-full px-6 py-6 gap-5">
      {/* Emotional headline */}
      <div className="text-center space-y-2">
        <span className="text-4xl">{score.overall >= 70 ? '🎉' : score.overall >= 40 ? '💪' : '🌱'}</span>
        <p className="text-base font-medium text-foreground">{score.emotionalFeedback}</p>
      </div>

      {/* Readiness score */}
      <div className="bg-muted/50 rounded-2xl px-5 py-4 text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Real-World Readiness</p>
        <p className="text-3xl font-bold text-foreground">{score.overall}<span className="text-lg text-muted-foreground">%</span></p>
        <p className="text-xs text-muted-foreground">You're getting more confident in real conversations.</p>
      </div>

      {/* Functional summary */}
      <div className="space-y-2">
        <p className="text-sm text-foreground">{score.functionalSummary}</p>
        
        {/* Score pillars — compact */}
        <div className="grid grid-cols-2 gap-2">
          <ScorePill label="Intent" value={score.intentScore} />
          <ScorePill label="Responsiveness" value={score.responsivenessScore} />
          <ScorePill label="Independence" value={score.independenceScore} />
          <ScorePill label="Naturalness" value={score.naturalnessScore} />
        </div>
      </div>

      {/* Next improvement */}
      <div className="bg-primary/5 rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-0.5">Next time</p>
        <p className="text-sm text-foreground">{score.nextImprovement}</p>
      </div>

      {/* Micro-reflection */}
      {!showReflection ? (
        <button
          onClick={() => setShowReflection(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Did this feel easier than real life? <ChevronDown className="w-3 h-3 inline ml-0.5" />
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 animate-in fade-in-0 duration-200">
          {['Yes', 'A little', 'Not yet'].map((option) => (
            <Button
              key={option}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onReflection(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      )}

      {/* Done button */}
      <Button
        className="w-full mt-auto"
        onClick={onDone}
      >
        Back to Maya
      </Button>
    </div>
  );
}

// ===== Helpers =====

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card/80 rounded-lg px-3 py-2 text-center">
      <p className="text-lg font-semibold text-foreground">{value}<span className="text-xs text-muted-foreground">%</span></p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Context-aware partner response generator.
 * Picks a response based on beat AND what the user actually said,
 * creating a more natural conversation flow.
 * Phase 2 will replace this with AI-generated responses.
 */
function generatePartnerResponse(beat: { partnerAction: string; expectedUserIntent: string }, userSaid: string): string {
  const u = userSaid.toLowerCase().trim();

  const responses: Record<string, (u: string) => string[]> = {
    // === Coffee scenario ===
    'Greet and ask what they want': () => [
      "Hi there! Welcome in. What can I get started for you today?",
    ],
    'Ask about size or milk preference': (u) => {
      if (u.includes('latte') || u.includes('cappuccino'))
        return ["Nice choice! What size — regular or large?", "Ooh, good pick! Any milk preference?"];
      if (u.includes('tea'))
        return ["Love it. What kind — black, green, or herbal?", "Sure! Hot or iced?"];
      return [
        "Sounds good! What size would you like?",
        "Great! Small, medium, or large?",
        "You got it. Regular or large?",
      ];
    },
    'Repeat order back and give total': (u) => {
      if (u.includes('large') || u.includes('big'))
        return ["Large it is! That's $5.25.", "Perfect, one large coming up. $5.25!"];
      if (u.includes('small'))
        return ["Small, got it. That'll be $3.50!", "One small, perfect. $3.50!"];
      return [
        "Got it! That'll be $4.50.",
        "Coming right up! $4.25.",
        "Perfect. That's $4.50 — pay whenever you're ready!",
      ];
    },
    'Say thanks and goodbye': () => [
      "Thank you! Enjoy your drink!",
      "Have a great day! Come back anytime.",
      "Thanks! See you next time!",
    ],
    // === Doctor call scenario ===
    'Answer phone and ask how to help': () => [
      "Good morning, Dr. Chen's office. How can I help you?",
    ],
    'Ask what the appointment is for': () => [
      "Sure thing. What's it about — a check-up, or something bothering you?",
      "Of course. Is it for something specific, or just a general visit?",
      "Absolutely. Can you tell me briefly what it's for?",
    ],
    'Offer two time options': () => [
      "Let me check… I've got Tuesday at 10am or Thursday at 2pm. Which works?",
      "How about Monday morning at 9, or Wednesday at 3?",
      "I can do tomorrow at 11am or Friday at 1pm. Either work?",
    ],
    'Confirm the appointment details': (u) => {
      if (u.includes('tuesday') || u.includes('monday') || u.includes('first'))
        return ["Great, you're booked! See you then.", "All set. We'll see you then!"];
      return [
        "Perfect, that's confirmed. See you soon!",
        "You're all set! We'll send a reminder.",
      ];
    },
    // === Family chat scenario ===
    'Greet and share exciting news': () => [
      "Hi! Guess what happened at school today!",
      "Hey! You'll never guess what we did today!",
      "Hi! I had the BEST day today!",
    ],
    'Tell a short, cute school story': () => [
      "We made a volcano in science and it actually EXPLODED! It was so cool!",
      "My friend and I built the tallest tower in the whole class! It was THIS big!",
      "We had a spelling bee and I got three words right! My teacher clapped!",
    ],
    'Ask what grandparent has been doing': () => [
      "What did YOU do today? Did you go outside?",
      "Have you been doing anything fun? Tell me tell me!",
      "What about you? Did you do something nice today?",
    ],
    'Say a loving goodbye': () => [
      "I love you so much! Talk soon! Bye bye!",
      "Bye! Love you! Miss you already!",
      "Love you! Bye bye! Hugs!",
    ],
  };

  const generator = responses[beat.partnerAction];
  if (generator) {
    const options = generator(u);
    return options[Math.floor(Math.random() * options.length)];
  }
  // Fallback — should not happen if all beats are mapped
  console.warn(`[ScenarioEngine] No partner response for action: "${beat.partnerAction}"`);
  return "That sounds great! Tell me more.";
}

/**
 * Functional intent assessment — determines if the user's response
 * meaningfully addresses the expected intent for this conversation beat.
 * 
 * Phase 1: keyword + heuristic approach. Phase 2: LLM-based semantic matching.
 */
function assessIntentLanded(transcript: string, expectedIntent: string, partnerText: string): boolean {
  const t = transcript.trim().toLowerCase();
  
  // Too short = didn't really respond
  if (t.length < 2) return false;
  
  // Intent-specific keyword maps
  const intentKeywords: Record<string, string[]> = {
    'Order a drink': ['coffee', 'tea', 'latte', 'cappuccino', 'mocha', 'espresso', 'water', 'juice', 'hot chocolate', 'drink', 'please', 'like', 'want', 'have', 'get', 'one'],
    'Specify preferences': ['large', 'medium', 'small', 'regular', 'big', 'milk', 'oat', 'cream', 'sugar', 'black', 'hot', 'iced', 'cold'],
    'Confirm or correct': ['yes', 'yeah', 'yep', 'right', 'correct', 'perfect', 'good', 'great', 'that', 'no', 'change', 'actually'],
    'Say goodbye': ['bye', 'thank', 'thanks', 'see you', 'goodbye', 'later', 'have a', 'day', 'cheers'],
    'Request an appointment': ['appointment', 'see', 'doctor', 'visit', 'come in', 'schedule', 'book', 'need', 'want'],
    'Describe the reason': ['check', 'feeling', 'pain', 'sick', 'not well', 'hurts', 'problem', 'checkup', 'follow', 'routine'],
    'Choose a time': ['morning', 'afternoon', 'tuesday', 'monday', 'wednesday', 'thursday', 'friday', 'first', 'second', 'that one', 'works', 'good', 'fine', 'okay', 'ten', 'two'],
    'Confirm and say goodbye': ['yes', 'thank', 'thanks', 'great', 'perfect', 'see you', 'bye', 'goodbye'],
    'Respond warmly': ['hi', 'hello', 'hey', 'what', 'tell', 'really', 'wow', 'oh', 'sweetheart', 'dear', 'love'],
    'React to the story': ['wow', 'cool', 'nice', 'great', 'fun', 'amazing', 'really', 'oh', 'that', 'sounds', 'good', 'love'],
    'Share something about your day': ['i', 'went', 'did', 'had', 'was', 'today', 'walk', 'ate', 'read', 'watched', 'garden', 'morning'],
    'Say goodbye warmly': ['bye', 'love', 'miss', 'talk', 'soon', 'see', 'sweetheart', 'dear', 'take care'],
  };

  const keywords = intentKeywords[expectedIntent];
  if (keywords) {
    const matched = keywords.some(kw => t.includes(kw));
    if (matched) return true;
  }

  // Fallback: if user produced 3+ words it's likely a meaningful attempt
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 3) return true;

  // Very short but is a yes/no response to a question
  if (partnerText.includes('?') && /^(yes|no|yeah|yep|nah|nope|okay|ok|sure|right|mhm)$/i.test(t)) {
    return true;
  }

  return false;
}
