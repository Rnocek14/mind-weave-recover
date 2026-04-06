/**
 * Welcome — Guided First-Time Experience
 * 
 * Zero-decision onboarding that explains purpose, sets expectations,
 * and launches the user into their first Smart Coach session.
 * 
 * Flow: Greeting → Purpose → Ready → Auto-launch session
 * 
 * Design constraints:
 * - No navigation decisions
 * - No "what do I click?"
 * - Everything guided, linear, purposeful
 * - Feels like entering a therapy session, not an app
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, Brain, Target, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type WelcomeStep = 'greeting' | 'purpose' | 'how_it_works' | 'ready';

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<WelcomeStep>('greeting');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const advance = (next: WelcomeStep) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setIsTransitioning(false);
    }, 200);
  };

  const launchSession = () => {
    // Go directly to SmartCoach — topic selection is the first guided step there
    navigate('/smart-coach');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.user_metadata?.display_name || 'there';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress dots */}
      <div className="p-6 flex justify-center gap-2">
        {(['greeting', 'purpose', 'how_it_works', 'ready'] as WelcomeStep[]).map((s, i) => (
          <div
            key={s}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              step === s ? 'bg-primary w-6' : 
              (['greeting', 'purpose', 'how_it_works', 'ready'].indexOf(step) > i) ? 'bg-primary/50' : 'bg-border'
            )}
          />
        ))}
      </div>

      {/* Content area */}
      <div className={cn(
        'flex-1 flex items-center justify-center p-6 transition-opacity duration-200',
        isTransitioning ? 'opacity-0' : 'opacity-100'
      )}>
        <div className="w-full max-w-sm">
          
          {/* Step 1: Greeting */}
          {step === 'greeting' && (
            <div className="space-y-8 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Hi {displayName} 👋</h1>
                <p className="text-muted-foreground leading-relaxed">
                  I'm Maya, your speech practice coach. We're going to work on your word-finding together — at your pace, with real purpose.
                </p>
              </div>
              <Button size="lg" className="w-full gap-2" onClick={() => advance('purpose')}>
                Nice to meet you, Maya
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Purpose */}
          {step === 'purpose' && (
            <div className="space-y-8 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Target className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">This isn't random</h1>
                <p className="text-muted-foreground leading-relaxed">
                  Every question I ask targets a real skill — like finding the right word when ordering food or describing your day to family.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  I'll tell you what we're working on and why. You'll always know the purpose.
                </p>
              </div>
              <Button size="lg" className="w-full gap-2" onClick={() => advance('how_it_works')}>
                That makes sense
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 3: How it works */}
          {step === 'how_it_works' && (
            <div className="space-y-8">
              <div className="space-y-4 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Brain className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Here's how it works</h1>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</span>
                  <div>
                    <p className="text-sm font-medium">We pick a topic together</p>
                    <p className="text-xs text-muted-foreground">Something familiar — like food, family, or hobbies</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</span>
                  <div>
                    <p className="text-sm font-medium">We have a real conversation</p>
                    <p className="text-xs text-muted-foreground">I'll ask specific questions that practice word-finding</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">3</span>
                  <div>
                    <p className="text-sm font-medium">I adapt to you</p>
                    <p className="text-xs text-muted-foreground">If it's hard, I'll help. If it's easy, I'll push a little. ~5 minutes.</p>
                  </div>
                </div>
              </div>

              <Button size="lg" className="w-full gap-2" onClick={() => advance('ready')}>
                Got it
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 'ready' && (
            <div className="space-y-8 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Heart className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Ready when you are</h1>
                <p className="text-muted-foreground leading-relaxed">
                  There's no wrong answer. Take your time. Pausing is part of the practice.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your first session takes about 5 minutes.
                </p>
              </div>
              <Button size="lg" className="w-full gap-2 text-base" onClick={launchSession}>
                Start my first practice
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
