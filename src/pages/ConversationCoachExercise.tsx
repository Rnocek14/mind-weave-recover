import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { ConversationCoachGame } from '@/components/ConversationCoachGame';

interface SessionSummary {
  turnsCompleted: number;
  cardsCompleted: number;
  avgLatencyMs: number;
  userAIRatio: number;
}

export default function ConversationCoachExercise() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  
  const [gameStarted, setGameStarted] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  // Redirect to auth if not logged in
  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleStart = () => {
    setGameStarted(true);
    setSessionSummary(null);
  };

  const handleComplete = (metrics: SessionSummary) => {
    setSessionSummary(metrics);
  };

  const handleExit = () => {
    navigate('/dashboard');
  };

  const handlePlayAgain = () => {
    setGameStarted(false);
    setSessionSummary(null);
    setTimeout(() => setGameStarted(true), 100);
  };

  // Summary screen
  if (sessionSummary && !gameStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={handleExit}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Session Complete</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8 text-center">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Great Practice!</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-xl p-4">
                <div className="text-3xl font-bold text-primary">
                  {sessionSummary.turnsCompleted}
                </div>
                <div className="text-sm text-muted-foreground">turns completed</div>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <div className="text-3xl font-bold text-primary">
                  {sessionSummary.cardsCompleted}
                </div>
                <div className="text-sm text-muted-foreground">exercises done</div>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <div className="text-3xl font-bold text-primary">
                  {Math.round(sessionSummary.userAIRatio)}%
                </div>
                <div className="text-sm text-muted-foreground">you talked</div>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <div className="text-3xl font-bold text-primary">
                  {sessionSummary.avgLatencyMs > 0 
                    ? `${(sessionSummary.avgLatencyMs / 1000).toFixed(1)}s`
                    : '-'}
                </div>
                <div className="text-sm text-muted-foreground">avg response</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button size="lg" onClick={handlePlayAgain} className="w-full">
                Practice Again
              </Button>
              <Button variant="outline" size="lg" onClick={handleExit} className="w-full">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Start screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b">
          <Button variant="ghost" size="icon" onClick={handleExit}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Conversation Coach</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Smart Conversation Practice</h2>
              <p className="text-muted-foreground">
                Have a natural conversation with a patient listener. 
                I'll gently help if you get stuck—with quick exercises 
                that get you back on track.
              </p>
            </div>

            <div className="bg-muted rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">How it works</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• We'll chat about everyday topics</li>
                <li>• If you get stuck, I'll offer a quick exercise</li>
                <li>• Exercises help you find words naturally</li>
                <li>• Then we continue our conversation</li>
              </ul>
            </div>

            <Button size="lg" onClick={handleStart} className="w-full">
              Start Practice
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active game
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex items-center gap-3 border-b">
        <Button variant="ghost" size="icon" onClick={handleExit}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Conversation Coach</h1>
      </header>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <ConversationCoachGame
          userId={user.id}
          profileId={activeProfile?.id || ''}
          sessionId={null}
          onComplete={handleComplete}
          onExit={handleExit}
        />
      </div>
    </div>
  );
}
