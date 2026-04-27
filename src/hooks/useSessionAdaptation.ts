/**
 * Shared Adaptation Contract
 * 
 * Provides a unified decision surface that every exercise can consume.
 * Combines: focusPhonemes, recommendedCueType, difficultyTier, reasoning,
 * spaced repetition words, and mid-session pivot capabilities.
 * 
 * This replaces per-game adaptation logic with one source of truth.
 */

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStrugglingPhonemes } from '@/hooks/useStrugglingPhonemes';
import { useStrugglingWords } from '@/hooks/useStrugglingWords';
import { useUserSpeechProfile, type UserSpeechProfile } from '@/hooks/useUserSpeechProfile';
import { useUserAdaptationProfile, type UserAdaptationProfile } from '@/hooks/useUserAdaptationProfile';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { selectOptimalCue, type CueType, type CueRecommendation } from '@/lib/cueSelector';
import { getScheduledWords, type ScheduledWord } from '@/lib/spacedRepetitionScheduler';
import type { TodayFocus } from '@/lib/adaptiveDecisionEngine';

export interface AdaptationContract {
  // Phoneme targeting
  focusPhonemes: string[];
  targetWords: string[];
  
  // Spaced repetition
  scheduledRepetitionWords: ScheduledWord[];
  
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

  // Phase 2 — cross-game adaptation profile
  /** Long-running per-profile adaptation summary (errors, cue dependency, plateau). */
  adaptationProfile: UserAdaptationProfile | null;
  /** Cue dependency 0..1 (null when unknown). Drives the in-game safety gate. */
  cueDependencyScore: number | null;
  /** Whether the user is currently flagged as plateaued. */
  plateauFlag: boolean;
  /** Dominant error type, if any (e.g., 'semantic_paraphasia'). */
  dominantErrorType: string | null;

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
  options: UseSessionAdaptationOptions & { exerciseSlug?: string } = {}
): AdaptationContract {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { getDifficulty, getCueLevel } = useRuntimeConfig();
  
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

  // Fetch struggling words for spaced repetition
  const {
    strugglingWords,
    loading: wordsLoading,
  } = useStrugglingWords({ userId: user?.id });

  // Phase 2: long-running adaptation profile (cue dependency, plateau, dominant errors)
  const { profile: adaptationProfile, loading: adaptationProfileLoading } =
    useUserAdaptationProfile({
      profileId: activeProfile?.id ?? null,
      enabled: !!activeProfile?.id,
    });

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

    // 3. Spaced repetition: get words due for practice today
    // Cap at 3 injected words per session to avoid contaminating domain goals
    const MAX_REPETITION_INJECTION = 3;
    const todayDate = new Date().toISOString().slice(0, 10);
    const scheduledRepetitionWords = getScheduledWords(strugglingWords, todayDate, 5);
    if (scheduledRepetitionWords.length > 0) {
      reasons.push(
        `Spaced repetition: ${scheduledRepetitionWords.length} words due (${scheduledRepetitionWords.map(w => w.word).join(', ')})`
      );
      // Merge scheduled words into targetWords, capped to avoid crowding out domain goals
      let injected = 0;
      for (const sw of scheduledRepetitionWords) {
        if (injected >= MAX_REPETITION_INJECTION) break;
        if (!targetWords.includes(sw.word)) {
          targetWords.push(sw.word);
          injected++;
        }
      }
      if (injected < scheduledRepetitionWords.length) {
        reasons.push(
          `Repetition injection capped at ${MAX_REPETITION_INJECTION} to preserve domain balance`
        );
      }
    }

    // 4. Recommended cue type from speech profile
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

    // 4b. Cross-game adaptation profile bias — only applied when no stronger
    // signal already set the cue type (engine override / lesson override).
    if (
      adaptationProfile?.recommended_cue_bias &&
      adaptationProfile.recommended_cue_bias !== 'none' &&
      cueRec.cueType === 'none'
    ) {
      cueRec = {
        cueType: adaptationProfile.recommended_cue_bias as CueType,
        reasoning:
          `Cross-game profile bias: ${adaptationProfile.recommended_cue_bias} ` +
          `(dominant error: ${adaptationProfile.dominant_error_type ?? 'n/a'})`,
        confidence: adaptationProfile.data_confidence === 'high' ? 0.75 : 0.6,
      };
      reasons.push(cueRec.reasoning);
    }

    // 5. Difficulty tier: runtime_config (clinician) > lesson override > adaptive engine > default
    const runtimeDiffOffset = getDifficulty(options.exerciseSlug);
    let difficultyTier = 1;
    if (runtimeDiffOffset !== 0) {
      // Clinician override takes highest priority
      difficultyTier = Math.max(1, 1 + runtimeDiffOffset);
      reasons.push(`Clinician difficulty override: ${runtimeDiffOffset > 0 ? '+' : ''}${runtimeDiffOffset}`);
    } else if (lessonAdaptations?.startDifficulty) {
      difficultyTier = lessonAdaptations.startDifficulty;
      reasons.push(`Lesson start difficulty: ${difficultyTier}`);
    } else if (todayFocus?.adaptations?.startDifficulty) {
      difficultyTier = todayFocus.adaptations.startDifficulty;
      reasons.push(`Engine start difficulty: ${difficultyTier}`);
    }

    // 5c. Plateau / cue-dependency damping
    // If the cross-game profile shows a plateau or high cue dependency,
    // bias starting difficulty downward by 1 (floor 1) so the session opens
    // with a winnable trial. Down-only — never escalates here.
    if (
      adaptationProfile?.plateau_flag ||
      (adaptationProfile?.cue_dependency_score ?? 0) > 0.5
    ) {
      const before = difficultyTier;
      difficultyTier = Math.max(1, difficultyTier - 1);
      if (difficultyTier !== before) {
        reasons.push(
          adaptationProfile?.plateau_flag
            ? `Plateau detected — opening 1 step easier (${before}→${difficultyTier})`
            : `High cue dependency (${(adaptationProfile?.cue_dependency_score ?? 0).toFixed(2)}) — opening 1 step easier`,
        );
      }
    }

    // 5b. Cue level: runtime_config (clinician) > adaptive engine > speech profile
    const runtimeCueLevel = getCueLevel();
    if (runtimeCueLevel !== null) {
      // Clinician cue override — inform downstream but don't change cueRec type
      reasons.push(`Clinician cue level override: L${runtimeCueLevel}`);
    }

    // 6. Profile confidence
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
      scheduledRepetitionWords,
      recommendedCueType: cueRec.cueType,
      cueConfidence: cueRec.confidence,
      difficultyTier,
      adaptationReasons: reasons,
      profileConfidence,
      speechProfile,
      adaptationProfile: adaptationProfile ?? null,
      cueDependencyScore: adaptationProfile?.cue_dependency_score ?? null,
      plateauFlag: !!adaptationProfile?.plateau_flag,
      dominantErrorType: adaptationProfile?.dominant_error_type ?? null,
      loading:
        profileLoading || phonemesLoading || wordsLoading || adaptationProfileLoading,
    };
  }, [
    lessonFocusPhonemes,
    lessonFocusWords,
    lessonAdaptations,
    todayFocus,
    strugglingPhonemes,
    profileTargetWords,
    strugglingWords,
    speechProfile,
    adaptationProfile,
    adaptationProfileLoading,
    profileLoading,
    phonemesLoading,
    wordsLoading,
    defaultErrorType,
    getDifficulty,
    getCueLevel,
    options.exerciseSlug,
  ]);
}
