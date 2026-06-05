/**
 * Welcome — Guided First-Time Experience
 * 
 * Minimal 2-step onboarding: greeting + ready.
 * Teaches by doing, not explaining.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { markOnboardingComplete } from '@/lib/onboarding';
import { cn } from '@/lib/utils';

type WelcomeStep = 'greeting' | 'ready';

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
    markOnboardingComplete(user?.id);
    navigate('/smart-coach');
  };

  const skip = () => {
    markOnboardingComplete(user?.id);
    navigate('/today', { replace: true });
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
        {(['greeting', 'ready'] as WelcomeStep[]).map((s, i) => (
          <div
            key={s}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              step === s ? 'bg-primary w-6' :
              (['greeting', 'ready'].indexOf(step) > i) ? 'bg-primary/50' : 'bg-border'
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

          {/* Step 1: Greeting + Purpose (combined) */}
          {step === 'greeting' && (
            <div className="space-y-8 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Hi {displayName} 👋</h1>
                <p className="text-muted-foreground leading-relaxed">
                  I'm Maya. We'll practice talking together — with a clear purpose every time.
                </p>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  Nothing here is random. Every question helps you find words in real situations.
                </p>
              </div>
              <Button size="lg" className="w-full gap-2" onClick={() => advance('ready')}>
                Let's start
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Ready */}
          {step === 'ready' && (
            <div className="space-y-8 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Heart className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Ready when you are</h1>
                <p className="text-muted-foreground leading-relaxed">
                  There's no wrong answer. Take your time. If it's hard, I'll help. If it's easy, I'll push a little.
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

          <div className="mt-6 text-center">
            <Button variant="ghost" className="text-muted-foreground" onClick={skip}>
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
