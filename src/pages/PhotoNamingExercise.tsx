import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCustomPhotoTrials } from '@/hooks/useCustomPhotoTrials';
import { useStrugglingWords } from '@/hooks/useStrugglingWords';
import { formatPhonemeDisplay } from '@/hooks/useStrugglingPhonemes';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { useMidSessionPivot } from '@/hooks/useMidSessionPivot';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { PhotoNamingGame } from '@/components/PhotoNamingGame';
import { usePhotoNamingProgression } from '@/hooks/usePhotoNamingProgression';
import {
  resolveEffectiveInitialDifficulty,
  clinicalLevelToEngineFloor,
} from '@/lib/progression/photoNamingDifficultyBridge';
import { mapEngineLevelToPhotoTier, generateChoices, computePhotoTier } from '@/data/photoBank';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, SkipForward, Target, AlertTriangle, Coffee, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PHOTO_BANK, PhotoTrial, getTrialsForLevel } from '@/data/photoBank';
import { getAudioTrialsForPhonemes, AudioTrial } from '@/data/audioTrialBank';
import { Card } from '@/components/ui/card';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { classifyUtteranceValidity } from '@/lib/clinical/classifyUtteranceValidity';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { toast } from 'sonner';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { LiveAnalysisProvider, useLiveAnalysis } from '@/contexts/LiveAnalysisContext';
import { LiveAnalysisPanel } from '@/components/LiveAnalysisPanel';
import type { RecentTrialData } from '@/lib/midSessionPivot';
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

function PhotoNamingExerciseInner() {
  const { setLiveSnapshot, appendAuditEvent, setDecisionChain } = useLiveAnalysis();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract lesson flow state (with sessionStorage fallback)
  const restored = useRestoredLessonContext('photo-naming');
  const { fromLesson, returnTo } = restored;
  const lessonSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const lessonFocusWords = location.state?.focusWords as string[] | undefined;
  const isTargetedPractice = location.state?.is_targeted_practice === true;
  const statePracticeSource = location.state?.practice_source as string | undefined;
  
  // Shared adaptation contract — single source of truth for phonemes, cues, difficulty
  const adaptation = useSessionAdaptation({
    exerciseSlug: 'photo-naming',
    lessonAdaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes as string[] | undefined,
    lessonFocusWords,
    defaultErrorType: 'phonemic_paraphasia',
  });
  
  // Mid-session pivot — feature-flagged, conservative (max 1 pivot, 8-trial cooldown)
  const {
    pivotRecommendation,
    recordTrial: recordPivotTrial,
    acknowledgePivot,
    hasPendingPivot,
    pivotState,
  } = useMidSessionPivot({
    enabled: fromLesson, // Only active during lesson flow (controlled rollout)
    currentDomainSlug: 'lexical_retrieval',
    checkInterval: 5,
  });
  
  // Use contract-derived values
  const lessonFocusPhonemes = adaptation.focusPhonemes.length > 0 ? adaptation.focusPhonemes : undefined;
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: true,
    cueSensitive: true,
  });
  
  // Extract targeted practice from URL params or lesson state
  const searchParams = new URLSearchParams(location.search);
  const urlTargets = searchParams.get('targets')?.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) || [];
  const practiceSource = statePracticeSource || searchParams.get('source') || null;
  
  // Fallback to struggling words when not in lesson mode (makes standalone "Choose a Game" feel smart)
  const { focusWords: strugglingWordsFallback } = useStrugglingWords({ 
    userId: user?.id, 
    enabled: !fromLesson && urlTargets.length === 0  // Only fetch when standalone and no URL targets
  });
  
  // Priority: lesson focus words > contract target words > URL targets > struggling words fallback
  const targetedWords = lessonFocusWords?.length ? lessonFocusWords 
    : adaptation.targetWords.length > 0 ? adaptation.targetWords
    : urlTargets.length ? urlTargets 
    : strugglingWordsFallback?.slice(0, 5) || [];
  
  // Extract adaptations for game configuration — use contract difficulty
  // Clinical Progression v1 — Step 6 (Photo Naming bridge).
  // Persistent Clinical Level provides a FLOOR for engine difficulty.
  // In-session adaptation can still escalate above this floor.
  const progression = usePhotoNamingProgression({
    userId: user?.id,
    profileId: activeProfile?.id,
  });
  const sessionAdaptationDifficulty = adaptation.difficultyTier;
  const bridge = resolveEffectiveInitialDifficulty({
    sessionAdaptationDifficulty,
    clinicalLevel: progression.startingLevel,
  });
  const initialDifficulty = bridge.effective;
  const timeoutMultiplier = lessonAdaptations?.timeoutMultiplier ?? 1;
  const largeTargets = lessonAdaptations?.largeTargets ?? false;
  
  const [photoSource, setPhotoSource] = useState<PhotoSource>('mixed');
  const [trials, setTrials] = useState<MixedTrial[]>([]);
  const [gameKey, setGameKey] = useState(0);
  const [mode, setMode] = useState<'independent' | 'caregiver'>('independent');
  const [caregiverNotes, setCaregiverNotes] = useState('');
  const [recentAccuracies, setRecentAccuracies] = useState<number[]>([]);
  const sessionStartRef = useRef(Date.now());

  // Single owner of session creation: useStandaloneSession (mutex-protected,
  // StrictMode-safe, remount-safe). When fromLesson, lessonSessionId is forwarded
  // and standalone hook short-circuits via its `providedSessionId` branch.
  const { activeSessionId } = useStandaloneSession(
    user?.id,
    fromLesson ? lessonSessionId ?? null : null,
    CANONICAL_SLUGS.PHOTO_NAMING,
  );
  const sessionId = activeSessionId;

  const { data: customPhotos = [], isLoading } = useCustomPhotoTrials(user?.id);
  const { startTrial, logTrial, calculateReactionTime } = useExerciseTelemetry(sessionId, 'photo_naming');

  // Push initial snapshot so the panel isn't empty before first trial
  useEffect(() => {
    setLiveSnapshot({
      micState: 'idle',
      currentDomain: 'lexical_retrieval',
      difficultyTier: adaptation.difficultyTier,
      focusPhonemes: adaptation.focusPhonemes,
      adaptationReasons: adaptation.adaptationReasons,
      profileConfidence: adaptation.profileConfidence,
      exerciseSlug: CANONICAL_SLUGS.PHOTO_NAMING,
      sessionId: sessionId || undefined,
      trialIndex: 0,
    });
  }, [sessionId, adaptation.difficultyTier]);

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

    // ── DEV-only Clinical Level → Difficulty selection diagnostics ────────
    if (import.meta.env.DEV) {
      const tier = mapEngineLevelToPhotoTier(initialDifficulty);
      const choiceCount = initialDifficulty <= 3 ? 3 : 4;
      const foilType = initialDifficulty >= 8 ? 'phonological + semantic' : 'semantic';
      const sampleTrial = selectedTrials.find((t) => !t.isAudioOnly) as PhotoTrial | undefined;
      const sampleChoices = sampleTrial ? generateChoices(sampleTrial, initialDifficulty) : [];
      console.groupCollapsed(
        `[ClinicalBridge] L${progression.startingLevel ?? '?'} → engine ${initialDifficulty} (tier ${tier})`
      );
      console.log('clinical level (persistent):', progression.startingLevel);
      console.log('clinical floor:', bridge.clinicalFloor);
      console.log('session adaptation difficulty (raw):', sessionAdaptationDifficulty);
      console.log('effective initial engine difficulty:', initialDifficulty, bridge.raised ? '(raised by clinical floor)' : '');
      console.log('selected content tier:', tier);
      console.log('answer choice count:', choiceCount);
      console.log('foil type:', foilType);
      console.log('selected targets:', selectedTrials.map((t) => t.target));
      if (sampleTrial) {
        console.log('sample trial:', sampleTrial.target, '→ choices:', sampleChoices, '| computed tier:', computePhotoTier(sampleTrial));
      }
      console.groupEnd();
    }

    setTrials(selectedTrials);
    setGameKey(prev => prev + 1);
  }, [photoSource, customPhotos, isLoading, targetedWords.join(','), lessonFocusPhonemes?.join(','), initialDifficulty]);

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
    // Adaptation state for Live Analysis
    latencyMs?: number;
    consecutiveErrors?: number;
    frustrationLevel?: string;
    recentSuccessRate?: number;
    trialCount?: number;
  }, trial: PhotoTrial) => {
    // Track recent accuracies for Live Analysis dots
    setRecentAccuracies(prev => {
      const next = [...prev, result.correct ? 1 : 0];
      return next.length > 10 ? next.slice(-10) : next;
    });

    const hasSession = Boolean(sessionId);

    // Record trial for mid-session pivot evaluation
    const pivotTrialData: RecentTrialData = {
      wasCorrect: result.correct,
      reactionTimeMs: result.reactionTimeMs,
      wasTimeout: result.errorType === 'timeout',
      cueLevel: result.cueLevel,
      exerciseSlug: CANONICAL_SLUGS.PHOTO_NAMING,
      domainSlug: 'lexical_retrieval',
    };
    recordPivotTrial(pivotTrialData);

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
    
    if (hasSession) {
      // Speech Validity Gate — classify before scoring is recorded
      const validity = classifyUtteranceValidity({
        transcript: result.whisperTranscript,
        asrConfidence: result.whisperConfidence ?? null,
        recordingDurationMs: result.recordingDurationMs ?? null,
        acousticMetrics: result.acousticMetrics ?? null,
        targetWord: trial.target,
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
          // Universal 1–10 GameLevel — PhotoNaming already uses 1–10 natively.
          game_level: typeof result.difficultyLevel === 'number' ? result.difficultyLevel : null,
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
          
          // Shared adaptation contract telemetry
          ...adaptationTelemetry,
        },
        validity,
      });

      // Log pivot telemetry if a pivot was recommended
      if (hasPendingPivot && pivotRecommendation) {
        console.log('🔄 Mid-session pivot triggered:', {
          action: pivotRecommendation.action,
          reason: pivotRecommendation.reason,
          confidence: pivotRecommendation.confidence,
          pivotState,
        });
        
        // Log to adaptation_events
        if (user?.id) {
          supabase.from('adaptation_events').insert([{
            user_id: user.id,
            profile_id: activeProfile?.id ?? null,
            session_id: sessionId,
            layer: 'mid_session',
            adaptation_type: `pivot_${pivotRecommendation.action}`,
            trigger_type: 'rule_based',
            trigger_condition: pivotRecommendation.reason,
            confidence: pivotRecommendation.confidence,
            evidence: JSON.parse(JSON.stringify({
              recent_accuracy: pivotTrialData.wasCorrect ? 1 : 0,
              pivot_state: pivotState,
            })),
            exercise_slug: CANONICAL_SLUGS.PHOTO_NAMING,
            trial_index: pivotState.totalTrials,
          }]).then(({ error }) => {
            if (error) console.warn('[PivotTelemetry] Log failed:', error);
          });
        }
      }
      
      console.log('✅ Trial logged successfully to exercise_events');
    } else {
      console.warn('[LiveAnalysis] sessionId missing; skipping persistence but updating live snapshot');
    }

    // ===== Push data to Live Analysis Panel =====
    const ua = result.utteranceAnalysis;
    setLiveSnapshot({
      // Transcript: fallback to target word if ASR didn't return text (direct match short-circuit)
      transcript: result.whisperTranscript || ua?.transcript || trial.target,
      targetWord: trial.target,
      asrConfidence: result.whisperConfidence ?? ua?.asrConfidence,
      errorType: result.errorType || ua?.errorType,
      phonologicalSimilarity: ua?.phonologicalSimilarity,
      semanticSimilarity: ua?.semanticSimilarity,
      pronunciationScore: ua?.pronunciationScore,
      accuracyScore: ua?.accuracyScore,
      fluencyScore: ua?.fluencyScore,
      completenessScore: ua?.completenessScore,
      prosodyScore: ua?.prosodyScore,
      meaningAccuracy: ua?.meaningAccuracy,
      circumlocutionDetected: ua?.circumlocutionDetected,
      effortfulSpeech: result.effortfulSpeech,
      reasoning: ua?.reasoning,
      classificationConfidence: ua?.classificationConfidence,
      encouragementScore: result.encouragementScore,
      encouragementLevel: ua?.encouragementLevel,
      // Adaptation state
      currentDomain: 'lexical_retrieval',
      difficultyTier: result.difficultyLevel,
      cueType: result.cueTypeGiven,
      cueLevel: result.cueLevel,
      focusPhonemes: adaptation.focusPhonemes,
      scheduledRepetitionWords: adaptation.scheduledRepetitionWords.map(w => w.word),
      adaptationReasons: adaptation.adaptationReasons,
      profileConfidence: adaptation.profileConfidence,
      // Session state — now populated from in-game adaptation hook
      trialIndex: pivotState.totalTrials,
      trialTotal: 10,
      consecutiveErrors: result.consecutiveErrors ?? 0,
      frustrationLevel: result.frustrationLevel ?? 'none',
      recentAccuracies: recentAccuracies,
      fatigueFlag: (result.consecutiveErrors ?? 0) >= 5 || (Date.now() - sessionStartRef.current) > 15 * 60 * 1000,
      latencyMs: result.latencyMs,
      micState: 'processing',
      pivotRecommendation: pivotRecommendation ? {
        action: pivotRecommendation.action,
        reason: pivotRecommendation.reason,
        confidence: pivotRecommendation.confidence,
      } : null,
      exerciseSlug: CANONICAL_SLUGS.PHOTO_NAMING,
      sessionId: sessionId || undefined,
    });

    // Decision chain card
    setDecisionChain({
      transcript: result.whisperTranscript || ua?.transcript || '(no speech)',
      detected: result.errorType || 'unknown',
      confidence: ua?.classificationConfidence != null ? `${(ua.classificationConfidence * 100).toFixed(0)}%` : '—',
      cueChosen: result.cueTypeGiven || 'none',
      difficultyAction: `Level ${result.difficultyLevel}`,
      reason: adaptation.adaptationReasons[0] || 'Default settings',
      timestamp: Date.now(),
    });

    // Audit event
    appendAuditEvent({
      source: 'utterance_analyzer',
      eventType: 'trial_scored',
      label: `${result.correct ? '✓' : '✗'} "${trial.target}" → ${result.errorType || 'unknown'}`,
      detail: result.whisperTranscript ? `Heard: "${result.whisperTranscript}"` : undefined,
      confidence: ua?.classificationConfidence != null ? `${(ua.classificationConfidence * 100).toFixed(0)}%` : undefined,
    });
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
    navigate(returnTo, { state: { resuming: true } });
  };

  const handleGameComplete = async () => {
    // End session with caregiver notes.
    // CRITICAL: When part of a lesson, LessonFlow owns the session lifecycle.
    // We must NOT set ended_at here, otherwise the next exercise in the
    // lesson is orphaned. Only persist caregiver_notes in that case.
    if (sessionId) {
      const updatePayload: Record<string, any> = {
        caregiver_notes: caregiverNotes.trim() || null,
      };
      if (!fromLesson) {
        updatePayload.ended_at = new Date().toISOString();
      }
      await supabase
        .from('sessions')
        .update(updatePayload)
        .eq('id', sessionId)
        .is('ended_at', null);
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
      navigate(returnTo, { state: { resuming: true } });
    } else {
      // Standalone mode - go to dashboard
      navigate('/today');
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
    <div className={fromLesson ? "h-dvh bg-background flex flex-col overflow-hidden" : "h-dvh bg-background flex flex-col overflow-hidden"}>
      {fromLesson && <SessionSidePanel />}
      <LiveAnalysisPanel />
      <div className="flex-1 flex flex-col min-h-0 px-2 sm:px-4 py-1 sm:py-2 max-w-4xl mx-auto w-full">
        {fromLesson && <InlineSessionProgress />}
        {/* Compact header */}
        <div className="flex justify-between items-center gap-1 mb-1 sm:mb-2 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => navigate('/today')}
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

        {/* Active adaptations debug badges - hidden in lesson mode */}
        {!fromLesson && lessonAdaptations && Object.keys(lessonAdaptations).length > 0 && (
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
        
        {/* Targeted practice banner - only show for intentional targeting (URL params, lesson focus), not auto-fallback */}
        {!fromLesson && targetedWords.length > 0 && (isTargetedPractice || urlTargets.length > 0 || lessonFocusWords?.length) && (
          <Card className="p-2 bg-primary/10 border-primary/20 mb-1 shrink-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Target className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium">Targeted Practice:</span>
              <span className="text-muted-foreground truncate">
                {targetedWords.slice(0, 3).join(', ')}{targetedWords.length > 3 ? ` +${targetedWords.length - 3} more` : ''}
              </span>
            </div>
          </Card>
        )}

        {/* Optional caregiver notes - hidden in lesson mode and on mobile */}
        {!fromLesson && (
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
        )}

        {/* Mid-session pivot suggestion banner */}
        {hasPendingPivot && pivotRecommendation && (
          <Card className="p-3 mb-3 border-accent bg-accent/10 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                {pivotRecommendation.action === 'rest_prompt' ? (
                  <Coffee className="h-4 w-4 text-accent-foreground shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-accent-foreground shrink-0" />
                )}
                <span className="text-accent-foreground font-medium">
                  {pivotRecommendation.action === 'rest_prompt'
                    ? "You seem tired — want to take a short break?"
                    : pivotRecommendation.action === 'step_down'
                    ? "This seems tough — we can make it a bit easier"
                    : "Let's try a different activity for a change of pace"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7 px-2"
                  onClick={() => {
                    acknowledgePivot();
                    toast.info("Continuing current exercise");
                  }}
                >
                  Keep Going
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="text-xs h-7 px-2"
                  onClick={() => {
                    acknowledgePivot();
                    if (pivotRecommendation.action === 'rest_prompt') {
                      toast.info("Take a break — come back when you're ready! 💪");
                    } else if (pivotRecommendation.action === 'step_down') {
                      toast.success("Making things a bit easier");
                      // Difficulty step-down would be handled by the game internally
                    } else {
                      // Switch to strength domain — navigate back to lesson to pick next exercise
                      if (fromLesson) {
                        window.dispatchEvent(new CustomEvent('exercise-complete'));
                        navigate(returnTo, { state: { resuming: true } });
                      }
                    }
                  }}
                >
                  {pivotRecommendation.action === 'rest_prompt' ? 'Take a Break'
                    : pivotRecommendation.action === 'step_down' ? 'Make Easier'
                    : 'Switch Activity'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Game area - fills remaining space */}
        <div className="flex-1 min-h-0 overflow-y-auto">
        {trials.length > 0 ? (
          <PhotoNamingGame
            key={gameKey}
            sessionId={sessionId}
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

export default function PhotoNamingExercise() {
  return (
    <LiveAnalysisProvider>
      <PhotoNamingExerciseInner />
    </LiveAnalysisProvider>
  );
}
