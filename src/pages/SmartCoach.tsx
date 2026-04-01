/**
 * Smart Coach — Production Page
 * 
 * Clean, user-facing conversation practice using the new modular engine.
 * Text-first. No legacy dependencies.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { createInitialCoachState } from '@/lib/smartCoach/coachState';
import { runCoachTurn } from '@/lib/smartCoach/runCoachTurn';
import type { CoachState, CoachTurnResult } from '@/lib/smartCoach/types';
import { cn } from '@/lib/utils';

// ─── Topics ──────────────────────────────────────────────────

const TOPICS = [
  { id: 'food', label: '🍳 Food & Cooking', keywords: ['food', 'cook', 'eat', 'meal', 'recipe', 'kitchen'] },
  { id: 'family', label: '👨‍👩‍👧 Family', keywords: ['family', 'mom', 'dad', 'sister', 'brother', 'kids'] },
  { id: 'hobbies', label: '🎨 Hobbies', keywords: ['hobby', 'fun', 'play', 'game', 'read', 'music'] },
  { id: 'daily_routine', label: '☀️ Daily Routine', keywords: ['morning', 'day', 'routine', 'wake', 'sleep', 'night'] },
  { id: 'travel', label: '✈️ Travel & Places', keywords: ['travel', 'trip', 'visit', 'place', 'city', 'beach'] },
  { id: 'pets', label: '🐕 Pets & Animals', keywords: ['pet', 'dog', 'cat', 'animal', 'walk', 'feed'] },
];

// ─── Chat message type ───────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'maya';
  text: string;
  timestamp: number;
}

// ─── Mode badge colors ──────────────────────────────────────

const MODE_COLORS: Record<string, string> = {
  warmup: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  expand: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  scaffold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  support: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  wrapup: 'bg-muted text-muted-foreground',
};

// ─── Component ───────────────────────────────────────────────

export default function SmartCoach() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<'topic_select' | 'chatting' | 'complete'>('topic_select');
  const [coachState, setCoachState] = useState<CoachState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
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

  // ─── Start session ──────────────────────────────────────────

  const handleTopicSelect = useCallback((topic: typeof TOPICS[0]) => {
    const state = createInitialCoachState({
      topic: topic.id,
      topicKeywords: topic.keywords,
    });
    setCoachState(state);
    setPhase('chatting');
    setTurnCount(0);

    // Maya's opening line
    const openers: Record<string, string> = {
      food: "Hi! Let's talk about food. What's something you like to eat?",
      family: "Hi! Let's talk about your family. Who would you like to tell me about?",
      hobbies: "Hi! Let's talk about things you enjoy. What do you do for fun?",
      daily_routine: "Hi! Let's talk about your day. What did you do this morning?",
      travel: "Hi! Let's talk about places. Where is somewhere you've been?",
      pets: "Hi! Let's talk about animals. Do you have a pet?",
    };

    const opener = openers[topic.id] || `Hi! Let's talk about ${topic.label}. What comes to mind?`;
    setMessages([{
      id: 'opener',
      role: 'maya',
      text: opener,
      timestamp: Date.now(),
    }]);
  }, []);

  // ─── Send a turn ────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !coachState || isProcessing) return;

    const userText = inputText.trim();
    setInputText('');
    setIsProcessing(true);

    // Add user message
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

      // Add Maya's response
      const mayaMsg: ChatMessage = {
        id: `maya-${Date.now()}`,
        role: 'maya',
        text: result.output,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, mayaMsg]);

      // Check for session end
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
    setTurnCount(0);
  };

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
                Pick a topic and we'll have a conversation. I'll help if you get stuck.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {TOPICS.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicSelect(topic)}
                  className="p-4 rounded-xl border bg-card hover:bg-accent transition-colors text-left space-y-1"
                >
                  <span className="text-lg">{topic.label}</span>
                </button>
              ))}
            </div>
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
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-bold">Great conversation!</h2>
            <p className="text-muted-foreground">
              You completed {turnCount} turns about <strong>{coachState?.topic}</strong>.
            </p>

            <div className="flex flex-col gap-3 pt-4">
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

  const progressPercent = Math.round((turnCount / maxTurns) * 100);

  return (
    <div className="h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="p-3 flex items-center gap-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">Smart Coach</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {coachState && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', MODE_COLORS[coachState.mode] || 'bg-muted')}>
                {coachState.mode}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Turn {turnCount}/{maxTurns}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
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
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
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
