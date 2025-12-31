import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCustomPhotoTrials } from '@/hooks/useCustomPhotoTrials';
import { useStrugglingWords } from '@/hooks/useStrugglingWords';
import { formatPhonemeDisplay } from '@/hooks/useStrugglingPhonemes';
import { PhotoNamingGame } from '@/components/PhotoNamingGame';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, SkipForward, Target } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PHOTO_BANK, PhotoTrial, getTrialsForLevel } from '@/data/photoBank';
import { getAudioTrialsForPhonemes, AudioTrial } from '@/data/audioTrialBank';
import { Card } from '@/components/ui/card';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { supabase } from '@/integrations/supabase/client';
import { startSession } from '@/lib/sessionTracking';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { toast } from 'sonner';
import { SessionProgressBubble } from '@/components/SessionProgressBubble';
import { SessionSidePanel } from '@/components/SessionSidePanel';
type PhotoSource = 'stock' | 'custom' | 'mixed';

// Extended trial type that supports both photo and audio-only trials
export interface MixedTrial extends Omit<PhotoTrial, 'imageUrl'> {
  imageUrl?: string; // Optional for audio-only trials
  isAudioOnly?: boolean;
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Deduplicate trials by target word (some targets have multiple difficulty variants)
const deduplicateByTarget = (trials: PhotoTrial[]): PhotoTrial[] => {
  const seen = new Set<string>();
  return trials.filter(t => {
    const key = t.target.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Convert AudioTrial to MixedTrial format
const audioToMixedTrial = (audio: AudioTrial): MixedTrial => ({
  id: audio.id,
  target: audio.word,
  semanticFoils: audio.semanticFoils,
  category: audio.category,
  isAudioOnly: true,
  features: {
    frequency_rank: 5000,
    imageability: 5,
    concreteness: 6,
    age_of_acquisition: 4,
    syllable_count: 1,
    phoneme_count: audio.phonemes.length,
    phonological_complexity: audio.difficulty > 3 ? 2 : 1,
    neighborhood_density: 'moderate' as const,
    first_phoneme: audio.phonemes[0] || '/k/',
    semantic_category: audio.category,
    typicality_rating: 3,
    part_of_speech: 'noun' as const,
  },
  computed_difficulty: audio.difficulty,
  minLevel: 1,
  maxLevel: 10,
});

export default function PhotoNamingExercise() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract lesson flow state
  const fromLesson = location.state?.fromLesson === true;
  const lessonSessionId = location.state?.sessionId as string | undefined;
  const lessonAdaptations = location.state?.adaptations as Record<string, any> | undefined;
  const lessonFocusWords = location.state?.focusWords as string[] | undefined;
  const lessonFocusPhonemes = location.state?.focusPhonemes as string[] | undefined;
  const isTargetedPractice = location.state?.is_targeted_practice === true;
  const statePracticeSource = location.state?.practice_source as string | undefined;
  
  // Extract targeted practice from URL params or lesson state
  const searchParams = new URLSearchParams(location.search);
  const urlTargets = searchParams.get('targets')?.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) || [];
  const practiceSource = statePracticeSource || searchParams.get('source') || null;
  
  // Fallback to struggling words when not in lesson mode (makes standalone "Choose a Game" feel smart)
  const { focusWords: strugglingWordsFallback } = useStrugglingWords({ 
    userId: user?.id, 
    enabled: !fromLesson && urlTargets.length === 0  // Only fetch when standalone and no URL targets
  });
  
  // Priority: lesson focus words > URL targets > struggling words fallback
  const targetedWords = lessonFocusWords?.length ? lessonFocusWords 
    : urlTargets.length ? urlTargets 
    : strugglingWordsFallback?.slice(0, 5) || [];
  
  // Extract adaptations for game configuration
  const initialDifficulty = lessonAdaptations?.startDifficulty ?? 1;
  const timeoutMultiplier = lessonAdaptations?.timeoutMultiplier ?? 1;
  const largeTargets = lessonAdaptations?.largeTargets ?? false;
  
  const [photoSource, setPhotoSource] = useState<PhotoSource>('mixed');
  const [trials, setTrials] = useState<MixedTrial[]>([]);
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
    let selectedTrials: MixedTrial[] = [];

    console.log('📸 PhotoNaming Trial Selection START:', {
      fromLesson,
      lessonFocusPhonemes,
      targetedWords,
      photoSource,
      customPhotosCount: customPhotos.length,
      strugglingWordsFallbackCount: strugglingWordsFallback?.length,
      photoBankSize: PHOTO_BANK.length,
    });

    // If phoneme-targeted practice mode (from phoneme practice card)
    if (lessonFocusPhonemes && lessonFocusPhonemes.length > 0) {
      // 1. Get photo trials with phoneme targeting - use actual difficulty level
      const photoTrials = getTrialsForLevel(initialDifficulty, totalTrials, {
        focusPhonemes: lessonFocusPhonemes,
        focusWords: targetedWords.length > 0 ? targetedWords : undefined,
      });
      
      // 2. If not enough photo trials, supplement with audio-only trials
      if (photoTrials.length < totalTrials) {
        const usedWords = new Set(photoTrials.map(t => t.target.toLowerCase()));
        const audioTrials = getAudioTrialsForPhonemes(lessonFocusPhonemes, totalTrials - photoTrials.length, Array.from(usedWords));
        const mixedAudioTrials = audioTrials.map(audioToMixedTrial);
        
        selectedTrials = shuffleArray([...photoTrials, ...mixedAudioTrials]);
        
        console.log('🎯 Phoneme-targeted practice (mixed):', { 
          focusPhonemes: lessonFocusPhonemes, 
          photoTrials: photoTrials.length,
          audioTrials: mixedAudioTrials.length,
          totalTrials: selectedTrials.length,
          source: practiceSource 
        });
      } else {
        selectedTrials = photoTrials;
        console.log('🎯 Phoneme-targeted practice (photos only):', { 
          focusPhonemes: lessonFocusPhonemes, 
          matchedTrials: selectedTrials.length, 
          source: practiceSource 
        });
      }
    }
    // If word-targeted practice mode, prioritize those words (NO DUPLICATES)
    else if (targetedWords.length > 0) {
      // Find matching trials from difficulty-filtered pool (unique only)
      const levelFilteredTrials = getTrialsForLevel(initialDifficulty, PHOTO_BANK.length);
      const targetedTrials = levelFilteredTrials.filter(trial => 
        targetedWords.includes(trial.target.toLowerCase())
      );
      
      if (targetedTrials.length > 0) {
        // Start with targeted trials - NO REPETITION
        selectedTrials = shuffleArray([...targetedTrials]);
        
        // If not enough targeted trials, pad with OTHER unique photos from level pool (never repeat)
        if (selectedTrials.length < totalTrials) {
          const targetedTargets = new Set(selectedTrials.map(t => t.target.toLowerCase()));
          const paddingTrials = levelFilteredTrials
            .filter(trial => !targetedTargets.has(trial.target.toLowerCase()))
            .slice(0, totalTrials - selectedTrials.length);
          
          // Combine: targeted first, then padding, then shuffle the whole set
          selectedTrials = shuffleArray([...selectedTrials, ...shuffleArray(paddingTrials)]);
        }
        
        console.log('🎯 Word-targeted practice:', { 
          targetedWords, 
          matchedTrials: targetedTrials.length,
          paddingTrials: Math.max(0, selectedTrials.length - targetedTrials.length),
          totalTrials: selectedTrials.length,
          difficultyLevel: initialDifficulty,
          source: practiceSource 
        });
      } else {
        // Fallback to level-filtered stock if no matches - deduplicate to ensure variety
        const uniqueStock = deduplicateByTarget(shuffleArray(levelFilteredTrials));
        selectedTrials = uniqueStock.slice(0, totalTrials);
        console.warn('⚠️ No matching trials for targets:', targetedWords);
      }
    } else if (photoSource === 'stock') {
      // Use difficulty-filtered trials for proper variety
      const levelFilteredTrials = getTrialsForLevel(initialDifficulty, totalTrials);
      const uniqueStock = deduplicateByTarget(shuffleArray(levelFilteredTrials));
      selectedTrials = uniqueStock.slice(0, totalTrials);
      console.log('📸 Stock photo mode:', { 
        selectedCount: selectedTrials.length,
        uniquePhotosAvailable: uniqueStock.length,
        difficultyLevel: initialDifficulty,
        targets: selectedTrials.map(t => t.target),
      });
    } else if (photoSource === 'custom') {
      if (customPhotos.length === 0) {
        selectedTrials = [];
        console.log('📸 Custom photo mode (empty)');
      } else {
        selectedTrials = shuffleArray(customPhotos).slice(0, totalTrials);
        console.log('📸 Custom photo mode:', { selectedCount: selectedTrials.length });
      }
    } else {
      // Mixed: 60% custom, 40% stock if custom photos exist
      const levelFilteredTrials = getTrialsForLevel(initialDifficulty, PHOTO_BANK.length);
      if (customPhotos.length > 0) {
        const customCount = Math.min(Math.ceil(totalTrials * 0.6), customPhotos.length);
        const stockCount = totalTrials - customCount;
        // Use difficulty-filtered stock photos
        const uniqueStock = deduplicateByTarget(shuffleArray(levelFilteredTrials));
        selectedTrials = [
          ...shuffleArray(customPhotos).slice(0, customCount),
          ...uniqueStock.slice(0, stockCount),
        ];
        selectedTrials = shuffleArray(selectedTrials);
        console.log('📸 Mixed mode (custom + stock):', { customCount, stockCount, difficultyLevel: initialDifficulty });
      } else {
        // Use difficulty-filtered trials for variety
        const uniqueStock = deduplicateByTarget(shuffleArray(levelFilteredTrials));
        selectedTrials = uniqueStock.slice(0, totalTrials);
        console.log('📸 Mixed mode (stock fallback):', { 
          selectedCount: selectedTrials.length,
          uniquePhotosAvailable: uniqueStock.length,
          difficultyLevel: initialDifficulty,
          targets: selectedTrials.map(t => t.target),
        });
      }
    }

    // 🛡️ SAFETY FALLBACK: Ensure we always have valid photo trials
    const validPhotoTrials = selectedTrials.filter(t => !!t.imageUrl && !t.isAudioOnly);
    console.log('📸 Photo trial validation:', {
      totalSelected: selectedTrials.length,
      withImageUrl: validPhotoTrials.length,
      audioOnly: selectedTrials.filter(t => t.isAudioOnly).length,
      missingImageUrl: selectedTrials.filter(t => !t.imageUrl && !t.isAudioOnly).length,
      sampleTrials: selectedTrials.slice(0, 3).map(t => ({
        target: t.target,
        hasImageUrl: !!t.imageUrl,
        isAudioOnly: !!t.isAudioOnly,
        imageUrlPreview: t.imageUrl?.substring(0, 50),
      })),
    });

    // If no valid photo trials and not in phoneme-targeted mode, fallback to level-filtered PHOTO_BANK
    if (validPhotoTrials.length === 0 && !(lessonFocusPhonemes && lessonFocusPhonemes.length > 0)) {
      console.warn('⚠️ No valid photo trials found! Falling back to level-filtered PHOTO_BANK');
      const fallbackTrials = getTrialsForLevel(initialDifficulty, totalTrials);
      selectedTrials = shuffleArray(fallbackTrials);
      console.log('📸 Fallback applied:', {
        newTrialCount: selectedTrials.length,
        difficultyLevel: initialDifficulty,
        sampleTargets: selectedTrials.slice(0, 3).map(t => t.target),
      });
    }

    setTrials(selectedTrials);
    setGameKey(prev => prev + 1);
  }, [photoSource, customPhotos, isLoading, targetedWords.join(','), lessonFocusPhonemes?.join(',')]);

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
    cueTypeGiven?: 'none' | 'semantic' | 'phonemic' | 'full_word';
    cueWasEffective?: boolean | null;
    timeToSuccessAfterCueMs?: number | null;
  }, trial: PhotoTrial) => {
    if (!sessionId) return;

    const interactionMode = mode === 'caregiver' 
      ? 'caregiver_assisted' 
      : 'independent';

    // 🧪 Log trial with unified UtteranceAnalysis + ShadowEvent
    console.log('📊 Logging trial with utterance analysis:', {
      targetWord: trial.target,
      utteranceAnalysis: result.utteranceAnalysis,
      shadowEvent: result.shadowEvent,
      hasAnalysis: !!result.utteranceAnalysis,
      hasShadowEvent: !!result.shadowEvent,
    });
    
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
      cueTypeGiven: result.cueTypeGiven,
      cueWasEffective: result.cueWasEffective,
      timeToSuccessAfterCueMs: result.timeToSuccessAfterCueMs,
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
        
        // Targeted practice tracking (closed loop measurement)
        practice_source: practiceSource,     // 'error_pattern_dashboard' | null
        targeted_words: targetedWords.length > 0 ? targetedWords : null,
        is_targeted_practice: targetedWords.length > 0,
        
        // Store unified analysis for future co-pilot
        utterance_analysis: result.utteranceAnalysis,
        shadow_event: result.shadowEvent,
      },
    });
    
    console.log('✅ Trial logged successfully to exercise_events');
  };

  const handleSkipExercise = async () => {
    // Log skip analytics with clinical profile snapshot
    if (user?.id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, clinical_profile')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        await supabase.from('exercise_skips').insert({
          user_id: user.id,
          profile_id: profile?.id,
          session_id: sessionId,
          exercise_slug: CANONICAL_SLUGS.PHOTO_NAMING,
          skip_reason: 'too_difficult',
          from_lesson: fromLesson,
          clinical_snapshot: profile?.clinical_profile
        });
      } catch (error) {
        console.error('Error logging skip:', error);
      }
    }
    
    toast.info("Exercise skipped - moving to next activity");
    
    // Dispatch event and navigate back to lesson
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate('/lesson', { state: { resuming: true } });
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
    
    // Show post-practice summary for targeted practice
    const isPhonemeTargeted = lessonFocusPhonemes && lessonFocusPhonemes.length > 0;
    const isWordTargeted = targetedWords.length > 0 && !isPhonemeTargeted;
    
    if (isPhonemeTargeted || isWordTargeted) {
      const focusLabel = isPhonemeTargeted 
        ? lessonFocusPhonemes!.map(formatPhonemeDisplay).join(', ')
        : targetedWords.slice(0, 3).join(', ') + (targetedWords.length > 3 ? '...' : '');
      const trialsLogged = trials?.length ?? 10;
      
      toast.success("Targeted practice complete", {
        description: `Focus: ${focusLabel} • ${trialsLogged} trials logged\nProfile updates after analysis`,
        duration: 4000,
      });
    }
    
    // Auto-trigger speech profile recompute (non-blocking)
    if (user?.id && activeProfile?.id) {
      const userId = user.id;
      const profileId = activeProfile.id;
      
      supabase.functions
        .invoke('compute-speech-profile', {
          body: { user_id: userId, profile_id: profileId },
        })
        .then((res) => {
          if (res.data?.skipped) {
            console.log('🔄 Speech profile recompute skipped:', res.data.reason, res.data);
          } else if (res.data?.success) {
            console.log('✅ Speech profile auto-recomputed:', res.data);
            // Invalidate cached data so dashboard picks up new profile
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['user-speech-profile', userId, profileId] });
              queryClient.invalidateQueries({ queryKey: ['phoneme-history', userId, profileId] });
            }, 500);
          }
        })
        .catch((err) => {
          console.error('❌ Error auto-computing speech profile:', err);
        });
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
    <div className="min-h-screen bg-background flex flex-col">
      {fromLesson && <SessionSidePanel />}
      {fromLesson && <SessionProgressBubble />}
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 max-w-4xl flex-1 flex flex-col">
        {/* Compact header on mobile */}
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2 sm:mb-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => fromLesson ? navigate('/lesson', { state: { resuming: false } }) : navigate('/dashboard')}
              className="px-2 sm:px-3"
            >
              <ArrowLeft className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{fromLesson ? 'Back to Lesson' : 'Back'}</span>
            </Button>
            
            {fromLesson && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipExercise}
                className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950 px-2 sm:px-3"
              >
                <SkipForward className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Skip</span>
              </Button>
            )}
          </div>
          
          {/* Controls - hidden on mobile, visible on sm+ */}
          <div className="hidden sm:flex items-center gap-2">
            <Select value={photoSource} onValueChange={(v: PhotoSource) => setPhotoSource(v)}>
              <SelectTrigger className="w-[140px] md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed Photos</SelectItem>
                <SelectItem value="custom">My Photos Only</SelectItem>
                <SelectItem value="stock">Stock Photos Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={mode} onValueChange={(v: typeof mode) => setMode(v)}>
              <SelectTrigger className="w-[140px] md:w-[180px]">
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

        {/* Active adaptations debug badges (visible when adaptations applied) */}
        {lessonAdaptations && Object.keys(lessonAdaptations).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {lessonAdaptations.timeoutMultiplier && lessonAdaptations.timeoutMultiplier !== 1 && (
              <Badge variant="secondary" className="text-xs">Timeout ×{lessonAdaptations.timeoutMultiplier}</Badge>
            )}
            {lessonAdaptations.startDifficulty && (
              <Badge variant="secondary" className="text-xs">Start Lv {lessonAdaptations.startDifficulty}</Badge>
            )}
            {lessonAdaptations.largeTargets && (
              <Badge variant="secondary" className="text-xs">Large Targets</Badge>
            )}
            {lessonAdaptations.sessionDurationCap && (
              <Badge variant="secondary" className="text-xs">Cap {lessonAdaptations.sessionDurationCap}m</Badge>
            )}
          </div>
        )}
        
        {/* Targeted practice banner */}
        {targetedWords.length > 0 && (
          <Card className="p-3 bg-primary/10 border-primary/20 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Targeted Practice:</span>
              <span className="text-muted-foreground">
                Focusing on {targetedWords.slice(0, 3).join(', ')}{targetedWords.length > 3 ? ` +${targetedWords.length - 3} more` : ''}
              </span>
            </div>
          </Card>
        )}

        {/* Optional caregiver notes - hidden on mobile */}
        <Card className="hidden md:block p-4 bg-muted/50 mb-4">
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

        {/* Game area - fills remaining space */}
        <div className="flex-1 min-h-0">
        {trials.length > 0 ? (
          <PhotoNamingGame
            key={gameKey}
            totalTrials={trials.length}
            initialDifficulty={initialDifficulty}
            assistMode={mode === 'caregiver'}
            onTrialComplete={(result, trial) => {
              handleTrialComplete(result, trial);
              startTrial(); // Start timing next trial
            }}
            onGameComplete={handleGameComplete}
            customTrials={trials}
          />
        ) : (
          <Card className="p-4 sm:p-8 text-center">
            <Camera className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">No photos available</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              {photoSource === 'custom' 
                ? "You haven't added any photos yet. Add some family photos to get started!"
                : "No photos available for this selection."}
            </p>
            <Link to="/photo-library">
              <Button size="sm">
                <Camera className="mr-2 h-4 w-4" />
                Add Your First Photo
              </Button>
            </Link>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
