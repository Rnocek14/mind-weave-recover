import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCustomPhotoTrials } from '@/hooks/useCustomPhotoTrials';
import { PhotoNamingGame } from '@/components/PhotoNamingGame';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PHOTO_BANK, PhotoTrial } from '@/data/photoBank';
import { Card } from '@/components/ui/card';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { supabase } from '@/integrations/supabase/client';
import { startSession } from '@/lib/sessionTracking';

type PhotoSource = 'stock' | 'custom' | 'mixed';

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function PhotoNamingExercise() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract lesson flow state
  const fromLesson = location.state?.fromLesson === true;
  const lessonSessionId = location.state?.sessionId as string | undefined;
  
  const [photoSource, setPhotoSource] = useState<PhotoSource>('mixed');
  const [trials, setTrials] = useState<PhotoTrial[]>([]);
  const [gameKey, setGameKey] = useState(0);
  const [mode, setMode] = useState<'independent' | 'caregiver'>('independent');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [caregiverNotes, setCaregiverNotes] = useState('');

  const { data: customPhotos = [], isLoading } = useCustomPhotoTrials(user?.id);
  const { startTrial, logTrial, calculateReactionTime } = useExerciseTelemetry(sessionId, 'photo_naming');

  // Initialize session when component mounts
  useEffect(() => {
    const initSession = async () => {
      if (!user?.id) return;
      
      // If coming from lesson, use the passed sessionId
      if (fromLesson && lessonSessionId) {
        setSessionId(lessonSessionId);
      } else {
        // Create new session
        const session = await startSession(user.id, {
          blocks: [{ exercise: 'photo_naming', duration: 10 }]
        });
        
        if (session) {
          setSessionId(session.id);
        }
      }
    };
    
    initSession();
  }, [user?.id, fromLesson, lessonSessionId]);

  useEffect(() => {
    if (isLoading) return;

    const totalTrials = 10;
    let selectedTrials: PhotoTrial[] = [];

    if (photoSource === 'stock') {
      selectedTrials = shuffleArray(PHOTO_BANK).slice(0, totalTrials);
    } else if (photoSource === 'custom') {
      if (customPhotos.length === 0) {
        selectedTrials = [];
      } else {
        selectedTrials = shuffleArray(customPhotos).slice(0, totalTrials);
      }
    } else {
      // Mixed: 60% custom, 40% stock if custom photos exist
      if (customPhotos.length > 0) {
        const customCount = Math.min(Math.ceil(totalTrials * 0.6), customPhotos.length);
        const stockCount = totalTrials - customCount;
        selectedTrials = [
          ...shuffleArray(customPhotos).slice(0, customCount),
          ...shuffleArray(PHOTO_BANK).slice(0, stockCount),
        ];
        selectedTrials = shuffleArray(selectedTrials);
      } else {
        selectedTrials = shuffleArray(PHOTO_BANK).slice(0, totalTrials);
      }
    }

    setTrials(selectedTrials);
    setGameKey(prev => prev + 1);
  }, [photoSource, customPhotos, isLoading]);

  const handleTrialComplete = async (result: {
    correct: boolean;
    reactionTimeMs: number;
    errorType?: string;
    difficultyLevel: number;
    cueLevel: number;
    errorClassification?: any;
    audioStoragePath?: string;
    recordingDurationMs?: number;
    audioMimeType?: string;
    whisperTranscript?: string;
    whisperConfidence?: number;
    acousticMetrics?: any;
    encouragementScore?: number;
    effortfulSpeech?: boolean;
    utteranceAnalysis?: any;
    shadowEvent?: any;
  }, trial: PhotoTrial) => {
    if (!sessionId) return;

    const interactionMode = mode === 'caregiver' 
      ? 'caregiver_assisted' 
      : 'independent';

    // 🧪 Log trial with unified UtteranceAnalysis + ShadowEvent
    await logTrial({
      correct: result.correct,
      reactionTimeMs: result.reactionTimeMs,
      cueLevel: result.cueLevel,
      errorType: result.errorType,
      errorClassification: result.errorClassification,
      whisperTranscript: result.whisperTranscript,
      whisperConfidence: result.whisperConfidence,
      acousticMetrics: result.acousticMetrics,
      audioStoragePath: result.audioStoragePath,
      audioMimeType: result.audioMimeType,
      recordingDurationMs: result.recordingDurationMs,
      taskParameters: {
        // Condition tags for experimental analysis
        photo_source: photoSource,           // 'stock' | 'custom' | 'mixed'
        interaction_mode: interactionMode,   // 'independent' | 'caregiver_assisted'
        difficulty_level: result.difficultyLevel,
        custom_photo_id: trial.id,           // Useful for per-photo analysis
        is_custom_photo: trial.category === 'personal',
        target_word: trial.target,
        encouragement_score: result.encouragementScore,
        effortful_speech: result.effortfulSpeech,
        
        // NEW: Store unified analysis for future co-pilot
        utterance_analysis: result.utteranceAnalysis,
        shadow_event: result.shadowEvent,
      },
    });
  };

  const handleGameComplete = async () => {
    // End session with caregiver notes
    if (sessionId) {
      await supabase
        .from('sessions')
        .update({ 
          ended_at: new Date().toISOString(),
          caregiver_notes: caregiverNotes.trim() || null,
        })
        .eq('id', sessionId);
    }
    
    if (fromLesson) {
      // Return to lesson flow
      window.dispatchEvent(new CustomEvent('exercise-complete'));
      navigate('/lesson', { state: { resuming: true } });
    } else {
      // Standalone mode - go to dashboard
      navigate('/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <Link to="/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <Select value={photoSource} onValueChange={(v: PhotoSource) => setPhotoSource(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed Photos</SelectItem>
                <SelectItem value="custom">My Photos Only</SelectItem>
                <SelectItem value="stock">Stock Photos Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={mode} onValueChange={(v: typeof mode) => setMode(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="independent">Independent Mode</SelectItem>
                <SelectItem value="caregiver">Caregiver Assisted</SelectItem>
              </SelectContent>
            </Select>
            
            {customPhotos.length === 0 && (
              <Link to="/photo-library">
                <Button variant="outline" size="sm">
                  <Camera className="mr-2 h-4 w-4" />
                  Add Photos
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Optional caregiver notes */}
        <Card className="p-4 bg-muted/50 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">
                Session Notes (optional)
              </label>
              <span className="text-xs text-muted-foreground">
                Quick observations about mood, energy, engagement
              </span>
            </div>
            <Textarea
              placeholder="e.g., Alert and engaged today. Needed more time with family photos. Laughed at the dog picture."
              value={caregiverNotes}
              onChange={(e) => setCaregiverNotes(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>
        </Card>

        {trials.length > 0 ? (
          <PhotoNamingGame
            key={gameKey}
            totalTrials={trials.length}
            initialDifficulty={1}
            assistMode={mode === 'caregiver'}
            onTrialComplete={(result, trial) => {
              handleTrialComplete(result, trial);
              startTrial(); // Start timing next trial
            }}
            onGameComplete={handleGameComplete}
            customTrials={trials}
          />
        ) : (
          <Card className="p-8 text-center">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No photos available</h3>
            <p className="text-muted-foreground mb-4">
              {photoSource === 'custom' 
                ? "You haven't added any photos yet. Add some family photos to get started!"
                : "No photos available for this selection."}
            </p>
            <Link to="/photo-library">
              <Button>
                <Camera className="mr-2 h-4 w-4" />
                Add Your First Photo
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
