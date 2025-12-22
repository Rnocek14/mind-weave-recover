/**
 * MinimalPairsExercise Page
 * 
 * Dedicated exercise for phoneme discrimination using minimal pairs.
 * Presents two images side-by-side and asks user to identify the target word.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MinimalPairsGame } from '@/components/MinimalPairsGame';
import { getMinimalPairStats } from '@/data/minimalPairsBank';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { startSession } from '@/lib/sessionTracking';
import { ArrowLeft, Ear, Info } from 'lucide-react';

export default function MinimalPairsExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(1);
  const [isStarted, setIsStarted] = useState(false);
  
  // Get stats about available pairs
  const stats = getMinimalPairStats();
  
  // Initialize session with 'listening' modality to avoid speech-related red flags
  useEffect(() => {
    const initSession = async () => {
      if (!user?.id) return;
      
      const session = await startSession(
        user.id, 
        { blocks: [{ exercise: 'minimal_pairs', duration: 10 }] },
        { modality: 'listening' }
      );
      
      if (session) {
        setSessionId(session.id);
      }
    };
    
    if (isStarted) {
      initSession();
    }
  }, [user?.id, isStarted]);
  
  const handleComplete = (results: {
    score: number;
    correctCount: number;
    incorrectCount: number;
    accuracy: number;
  }) => {
    console.log('Minimal pairs exercise complete:', results);
    // Could log to telemetry here
  };
  
  const handleTrialComplete = (trialData: {
    targetWord: string;
    selectedWord: string;
    isCorrect: boolean;
    pair: { word1: string; word2: string };
  }) => {
    console.log('Trial complete:', trialData);
    // Could log individual trials to telemetry here
  };
  
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          
          {/* Header */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Ear className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Minimal Pairs Practice</CardTitle>
              <p className="text-muted-foreground mt-2">
                Train your ear to distinguish between similar sounds
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* How it works */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4" />
                  How It Works
                </h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>You'll hear a word spoken aloud</li>
                  <li>Two similar pictures will appear side by side</li>
                  <li>Tap the picture that matches the word you heard</li>
                  <li>Learn the difference between similar sounds!</li>
                </ol>
              </div>
              
              {/* Stats */}
              <div className="flex justify-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Available Pairs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{Object.keys(stats.byCategory).length}</div>
                  <div className="text-xs text-muted-foreground">Contrast Types</div>
                </div>
              </div>
              
              {/* Difficulty selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">Difficulty</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((level) => (
                    <Button
                      key={level}
                      variant={difficulty === level ? "default" : "outline"}
                      onClick={() => setDifficulty(level)}
                      className="flex-1"
                    >
                      {level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard'}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Example pairs */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Example pairs you'll practice:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">cat / hat</Badge>
                  <Badge variant="secondary">fan / van</Badge>
                  <Badge variant="secondary">ship / chip</Badge>
                  <Badge variant="secondary">goat / coat</Badge>
                </div>
              </div>
              
              {/* Start button */}
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => setIsStarted(true)}
                disabled={stats.total === 0}
              >
                Start Practice
              </Button>
              
              {stats.total === 0 && (
                <p className="text-sm text-destructive text-center">
                  No minimal pairs available. Add more photos to the photo bank.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit
        </Button>
        
        <MinimalPairsGame
          difficulty={difficulty}
          totalTrials={Math.min(stats.total, 10)}
          onComplete={handleComplete}
          onTrialComplete={handleTrialComplete}
        />
      </div>
    </div>
  );
}
