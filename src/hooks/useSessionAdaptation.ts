/**
 * Shared Adaptation Contract
 * 
 * Provides a unified decision surface that every exercise can consume.
 * Combines: focusPhonemes, recommendedCueType, difficultyTier, and reasoning.
 * 
 * This replaces per-game adaptation logic with one source of truth.
 */

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStrugglingPhonemes } from '@/hooks/useStrugglingPhonemes';
import { useUserSpeechProfile, type UserSpeechProfile } from '@/hooks/useUserSpeechProfile';
import { selectOptimalCue, type CueType, type CueRecommendation } from '@/lib/cueSelector';
import type { TodayFocus } from '@/lib/adaptiveDecisionEngine';

export interface AdaptationContract {
  // Phoneme targeting
  focusPhonemes: string[];
  targetWords: string[];
  
  // Cue personalization
  recommendedCueType: CueType;
  cueConfidence: number;
  
  // Difficulty
  difficultyTier: number;
  
  // Reasoning (for telemetry + debug)
  adaptationReasons: string[];
  profileConfidence: 'high' | 'medium' | 'low' | 'none';
  
  // Raw profile for games that need deeper access
  speechProfile: UserSpeechProfile | null;
  
  // Loading state
  loading: boolean;
}

interface UseSessionAdaptationOptions {
  /** Override from lesson flow or URL state */
  lessonAdaptations?: Record<string, any>;
  /** Override focusPhonemes from lesson state */
  lessonFocusPhonemes?: string[];
  /** Override focus words from lesson state */
  lessonFocusWords?: string[];
  /** TodayFocus from adaptive engine */
  todayFocus?: TodayFocus | null;
  /** Default error type for cue selection */
  defaultErrorType?: 'semantic_paraphasia' | 'phonemic_paraphasia' | 'no_response';
}

export function useSessionAdaptation(
  options: UseSessionAdaptationOptions = {}
): AdaptationContract {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  
  const {
    lessonAdaptations,
    lessonFocusPhonemes,
    lessonFocusWords,
    todayFocus,
    defaultErrorType = 'no_response',
  } = options;

  // Fetch speech profile
  const { profile: speechProfile, loading: profileLoading } = useUserSpeechProfile(
    user?.id,
    { profileId: activeProfile?.id, enabled: !!user?.id }
  );

  // Fetch struggling phonemes
  const {
    strugglingPhonemes,
    targetWords: profileTargetWords,
    loading: phonemesLoading,
  } = useStrugglingPhonemes(user?.id, { profileId: activeProfile?.id });

  return useMemo(() => {
    const reasons: string[] = [];
    
    // 1. Focus phonemes: lesson override > adaptive engine > profile
    let focusPhonemes: string[] = [];
    if (lessonFocusPhonemes && lessonFocusPhonemes.length > 0) {
      focusPhonemes = lessonFocusPhonemes;
      reasons.push(`Lesson-targeted phonemes: ${focusPhonemes.join(', ')}`);
    } else if (todayFocus?.adaptations?.focusPhonemes?.length) {
      focusPhonemes = todayFocus.adaptations.focusPhonemes;
      reasons.push(`Engine-targeted phonemes: ${focusPhonemes.join(', ')}`);
    } else if (strugglingPhonemes.length > 0) {
      focusPhonemes = strugglingPhonemes.slice(0, 3).map(p => p.phoneme);
      reasons.push(`Profile struggling phonemes: ${focusPhonemes.join(', ')}`);
    }

    // 2. Target words
    let targetWords: string[] = [];
    if (lessonFocusWords && lessonFocusWords.length > 0) {
      targetWords = lessonFocusWords;
    } else if (profileTargetWords.length > 0) {
      targetWords = profileTargetWords.slice(0, 10);
    }

    // 3. Recommended cue type from speech profile
    let cueRec: CueRecommendation = {
      cueType: 'none',
      reasoning: 'No profile data',
      confidence: 0.5,
    };
    
    // Use preferred cue from adaptive engine if available
    if (todayFocus?.adaptations?.preferredCueType) {
      cueRec = {
        cueType: todayFocus.adaptations.preferredCueType,
        reasoning: `Engine recommended: ${todayFocus.adaptations.preferredCueType}`,
        confidence: 0.7,
      };
      reasons.push(cueRec.reasoning);
    } else if (speechProfile) {
      cueRec = selectOptimalCue(defaultErrorType, speechProfile);
      if (cueRec.cueType !== 'none') {
        reasons.push(cueRec.reasoning);
      }
    }

    // 4. Difficulty tier: lesson override > adaptive engine > default
    let difficultyTier = 1;
    if (lessonAdaptations?.startDifficulty) {
      difficultyTier = lessonAdaptations.startDifficulty;
      reasons.push(`Lesson start difficulty: ${difficultyTier}`);
    } else if (todayFocus?.adaptations?.startDifficulty) {
      difficultyTier = todayFocus.adaptations.startDifficulty;
      reasons.push(`Engine start difficulty: ${difficultyTier}`);
    }

    // 5. Profile confidence
    let profileConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';
    if (speechProfile) {
      const totalTrials = speechProfile.trials_with_phonemes ?? 0;
      if (totalTrials >= 20) profileConfidence = 'high';
      else if (totalTrials >= 5) profileConfidence = 'medium';
      else profileConfidence = 'low';
    }

    return {
      focusPhonemes,
      targetWords,
      recommendedCueType: cueRec.cueType,
      cueConfidence: cueRec.confidence,
      difficultyTier,
      adaptationReasons: reasons,
      profileConfidence,
      speechProfile,
      loading: profileLoading || phonemesLoading,
    };
  }, [
    lessonFocusPhonemes,
    lessonFocusWords,
    lessonAdaptations,
    todayFocus,
    strugglingPhonemes,
    profileTargetWords,
    speechProfile,
    profileLoading,
    phonemesLoading,
    defaultErrorType,
  ]);
}
