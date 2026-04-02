/**
 * Smart Coach — Production Page
 * 
 * Clean, user-facing conversation practice using the new modular engine.
 * Text-first. No legacy dependencies.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Loader2, RotateCcw, Heart, MessageCircle, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { createInitialCoachState } from '@/lib/smartCoach/coachState';
import { runCoachTurn } from '@/lib/smartCoach/runCoachTurn';
import type { CoachState, CoachMode, CoachTurnResult } from '@/lib/smartCoach/types';
import { cn } from '@/lib/utils';

// ─── Topics ──────────────────────────────────────────────────

const TOPICS = [
  { id: 'food', label: '🍳 Food & Cooking', description: 'meals, recipes, favorites', keywords: ['food', 'cook', 'eat', 'meal', 'recipe', 'kitchen'] },
  { id: 'family', label: '👨‍👩‍👧 Family', description: 'people you care about', keywords: ['family', 'mom', 'dad', 'sister', 'brother', 'kids'] },
  { id: 'hobbies', label: '🎨 Hobbies', description: 'things you enjoy doing', keywords: ['hobby', 'fun', 'play', 'game', 'read', 'music'] },
  { id: 'daily_routine', label: '☀️ Daily Routine', description: 'your day, morning to night', keywords: ['morning', 'day', 'routine', 'wake', 'sleep', 'night'] },
  { id: 'travel', label: '✈️ Travel & Places', description: 'places you\'ve been', keywords: ['travel', 'trip', 'visit', 'place', 'city', 'beach'] },
  { id: 'pets', label: '🐕 Pets & Animals', description: 'furry friends', keywords: ['pet', 'dog', 'cat', 'animal', 'walk', 'feed'] },
];

// ─── Chat message type ───────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'maya';
  text: string;
  timestamp: number;
}

// ─── User-friendly mode labels ──────────────────────────────

const MODE_LABELS: Record<CoachMode, string> = {
  warmup: 'Starting easy',
  expand: 'Say a little more',
  scaffold: "I'm helping you build it",
  support: 'Slowing it down',
  wrapup: 'Finishing up',
};

const MODE_COLORS: Record<string, string> = {
  warmup: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  expand: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  scaffold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  support: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  wrapup: 'bg-muted text-muted-foreground',
};

// ─── Phase steps for visual indicator ───────────────────────

const PHASE_STEPS = [
  { key: 'warmup', label: 'Start', icon: MessageCircle },
  { key: 'expand', label: 'Build', icon: Sparkles },
  { key: 'support', label: 'Support', icon: Heart },
  { key: 'wrapup', label: 'Finish', icon: CheckCircle2 },
];

function getPhaseIndex(mode: CoachMode): number {
  if (mode === 'warmup') return 0;
  if (mode === 'expand') return 1;
  if (mode === 'scaffold' || mode === 'support') return 2;
  return 3;
}

// ─── Better openers ─────────────────────────────────────────

const OPENERS: Record<string, string[]> = {
  food: [
    "Hey! I'd love to hear about food you enjoy. What's something you really like to eat?",
    "Let's chat about food. What did you have for your last meal?",
    "I love talking about food! What's your favorite thing to cook or eat?",
  ],
  family: [
    "I'd love to hear about the people in your life. Who's someone special to you?",
    "Let's talk about family. Who would you like to tell me about?",
    "Tell me about someone in your family — whoever comes to mind first.",
  ],
  hobbies: [
    "What's something you really enjoy doing? Anything at all.",
    "Let's talk about fun stuff. What do you like to do when you have free time?",
    "I'd love to hear what you enjoy. What's a hobby or activity you like?",
  ],
  daily_routine: [
    "Tell me about your day so far. What have you been up to?",
    "What does a typical morning look like for you?",
    "Let's talk about your day. What did you do when you woke up today?",
  ],
  travel: [
    "I'd love to hear about a place you've been. Where's somewhere you've visited?",
    "Let's talk about places. Where's your favorite place you've been?",
    "Think of a place you really liked visiting. Where was it?",
  ],
  pets: [
    "Do you have any pets? I'd love to hear about them.",
    "Let's talk about animals. Do you have a favorite pet or animal?",
    "Tell me about a pet — yours, or one you've known. What were they like?",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Session tracking for summary ───────────────────────────

interface SessionStats {
  topicLabel: string;
  topicId: string;
  turnCount: number;
  scaffoldUsed: boolean;
  supportUsed: boolean;
  forcedChoiceUsed: boolean;
  sentenceStarterUsed: boolean;
  maxSupportLevel: number;
}

// ─── Component ───────────────────────────────────────────────

export default function SmartCoach() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<'topic_select' | 'intro' | 'chatting' | 'complete'>('topic_select');
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null);
  const [coachState, setCoachState] = useState<CoachState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const maxTurns = 8;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after Maya responds
  useEffect(() => {
    if (!isProcessing && phase === 'chatting') {
      inputRef.current?.focus();
    }
  }, [isProcessing, phase]);

  // ─── Topic select → intro ─────────────────────────────────

  const handleTopicSelect = useCallback((topic: typeof TOPICS[0]) => {
    setSelectedTopic(topic);
    setPhase('intro');
    setSessionStats({
      topicLabel: topic.label,
      topicId: topic.id,
      turnCount: 0,
      scaffoldUsed: false,
      supportUsed: false,
      forcedChoiceUsed: false,
      sentenceStarterUsed: false,
      maxSupportLevel: 0,
    });
  }, []);

  // ─── Intro → chatting ─────────────────────────────────────

  const handleStartConversation = useCallback(() => {
    if (!selectedTopic) return;

    const state = createInitialCoachState({
      topic: selectedTopic.id,
      topicKeywords: selectedTopic.keywords,
    });
    setCoachState(state);
    setPhase('chatting');
    setTurnCount(0);

    const opener = pickRandom(OPENERS[selectedTopic.id] || [`Hi! Let's talk about ${selectedTopic.label}. What comes to mind?`]);
    setMessages([{
      id: 'opener',
      role: 'maya',
      text: opener,
      timestamp: Date.now(),
    }]);
  }, [selectedTopic]);

  // ─── Send a turn ────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !coachState || isProcessing) return;

    const userText = inputText.trim();
    setInputText('');
    setIsProcessing(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result: CoachTurnResult = await runCoachTurn({
        state: coachState,
        userUtterance: userText,
        maxTurns,
      });

      setCoachState(result.nextState);
      setTurnCount(result.nextState.turnCount);

      // Track stats for summary
      setSessionStats(prev => prev ? {
        ...prev,
        turnCount: result.nextState.turnCount,
        scaffoldUsed: prev.scaffoldUsed || result.nextState.mode === 'scaffold',
        supportUsed: prev.supportUsed || result.nextState.mode === 'support',
        forcedChoiceUsed: prev.forcedChoiceUsed || result.cueDecision.cueType === 'forced_choice',
        sentenceStarterUsed: prev.sentenceStarterUsed || result.cueDecision.cueType === 'sentence_starter',
        maxSupportLevel: Math.max(prev.maxSupportLevel, result.nextState.supportLevel),
      } : null);

      const mayaMsg: ChatMessage = {
        id: `maya-${Date.now()}`,
        role: 'maya',
        text: result.output,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, mayaMsg]);

      if (result.nextState.mode === 'wrapup') {
        setPhase('complete');
      }
    } catch (err) {
      console.error('[SmartCoach] Turn failed:', err);
      setMessages(prev => [...prev, {
        id: `maya-err-${Date.now()}`,
        role: 'maya',
        text: "Take your time — I'm right here.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, coachState, isProcessing, maxTurns]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = () => {
    setPhase('topic_select');
    setMessages([]);
    setCoachState(null);
    setSelectedTopic(null);
    setTurnCount(0);
    setSessionStats(null);
  };

  // ─── Derived values ────────────────────────────────────────

  const currentPhaseIndex = coachState ? getPhaseIndex(coachState.mode) : 0;
  const progressPercent = Math.round((turnCount / maxTurns) * 100);
  const showSupportBadge = coachState && coachState.supportLevel >= 2;

  // ─── Summary helpers ──────────────────────────────────────

  const summaryHelpDescription = useMemo(() => {
    if (!sessionStats) return null;
    const parts: string[] = [];
    if (sessionStats.sentenceStarterUsed) parts.push('sentence starters');
    if (sessionStats.forcedChoiceUsed) parts.push('simple choices');
    if (sessionStats.supportUsed) parts.push('extra support');
    if (parts.length === 0) return 'You did great on your own!';
    return `I helped with ${parts.join(' and ')} when needed.`;
  }, [sessionStats]);

  const topicDisplayName = useMemo(() => {
    if (!selectedTopic) return coachState?.topic || '';
    return selectedTopic.label.replace(/^[^\s]+\s/, ''); // remove emoji
  }, [selectedTopic, coachState]);

  // ─── Render ────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  // ─── Topic Selection ────────────────────────────────────────

  if (phase === 'topic_select') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Smart Coach</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">What shall we talk about?</h2>
              <p className="text-muted-foreground text-sm">
                Pick a topic and we'll have a guided conversation together.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {TOPICS.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicSelect(topic)}
                  className="p-4 rounded-xl border bg-card hover:bg-accent transition-colors text-left space-y-1"
                >
                  <span className="text-base font-medium block">{topic.label}</span>
                  <span className="text-xs text-muted-foreground">{topic.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Session Intro ──────────────────────────────────────────

  if (phase === 'intro' && selectedTopic) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => setPhase('topic_select')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Smart Coach</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            {/* Topic card */}
            <div className="bg-card border rounded-2xl p-6 space-y-4 text-center">
              <span className="text-4xl">{selectedTopic.label.split(' ')[0]}</span>
              <h2 className="text-xl font-semibold">{topicDisplayName}</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>We'll have a short guided conversation about <strong>{topicDisplayName.toLowerCase()}</strong>.</p>
                <p>If you get stuck, I'll help with hints and starters.</p>
                <p>You only need to say a little at a time.</p>
              </div>
            </div>

            {/* Session structure preview */}
            <div className="flex items-center justify-center gap-1">
              {PHASE_STEPS.map((step, i) => (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <step.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{step.label}</span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <div className="w-6 h-px bg-border mt-[-12px]" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <Button size="lg" className="w-full" onClick={handleStartConversation}>
              Start conversation
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Session Complete ───────────────────────────────────────

  if (phase === 'complete') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Session Complete</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            {/* Summary card */}
            <div className="bg-card border rounded-2xl p-6 space-y-5 text-center">
              <div className="text-4xl">✨</div>
              <h2 className="text-xl font-bold">Nice work today</h2>

              <div className="space-y-3 text-sm text-left">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <MessageCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>You practiced talking about <strong>{topicDisplayName.toLowerCase()}</strong>.</span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>You stayed with the conversation for <strong>{sessionStats?.turnCount || turnCount} turns</strong>.</span>
                </div>
                {summaryHelpDescription && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <HelpCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{summaryHelpDescription}</span>
                  </div>
                )}
              </div>

              <p className="text-muted-foreground text-sm pt-1">
                Every conversation is practice. You should feel proud. 💛
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={handleNewSession} className="w-full gap-2">
                <RotateCcw className="w-4 h-4" />
                Practice Again
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/dashboard')} className="w-full">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Chat ────────────────────────────────────────────

  return (
    <div className="h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="p-3 border-b shrink-0 space-y-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">Smart Coach · {topicDisplayName}</h1>
            {/* Mode helper text */}
            {coachState && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {MODE_LABELS[coachState.mode]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Support badge */}
            {showSupportBadge && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium whitespace-nowrap">
                Extra support on
              </span>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {turnCount}/{maxTurns}
            </span>
          </div>
        </div>

        {/* Phase progress steps */}
        <div className="flex items-center gap-1 px-1">
          {PHASE_STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                i <= currentPhaseIndex
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/50'
              )}>
                <step.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < PHASE_STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-px max-w-[24px]',
                  i < currentPhaseIndex ? 'bg-primary/30' : 'bg-border'
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'maya'
                ? 'bg-muted text-foreground self-start mr-auto'
                : 'bg-primary text-primary-foreground self-end ml-auto'
            )}
          >
            {msg.role === 'maya' && (
              <span className="text-xs font-medium text-muted-foreground block mb-1">Maya</span>
            )}
            {msg.text}
          </div>
        ))}

        {isProcessing && (
          <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-muted mr-auto">
            <span className="text-xs font-medium text-muted-foreground block mb-1">Maya</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t shrink-0">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <Input
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            disabled={isProcessing}
            className="flex-1"
            autoComplete="off"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
