/**
 * useCoachProfile — Loads the user's full clinical context for Smart Coach
 * 
 * Combines:
 * - Clinical profile (severity, deficit type, impairments)
 * - Speech profile (phoneme difficulty, error distribution, cue efficacy)
 * - Struggling phonemes + target words
 * - Last session summary (for goal continuity)
 * - Cognitive domain scores (for data-driven drill selection)
 * 
 * This is the "patient chart" Maya reads before speaking.
 */

import { useState, useEffect, useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useUserSpeechProfile, type UserSpeechProfile } from '@/hooks/useUserSpeechProfile';
import { useStrugglingPhonemes, type StrugglingPhoneme } from '@/hooks/useStrugglingPhonemes';
import { supabase } from '@/integrations/supabase/client';
import type { SeverityProfile, PrimaryDeficit } from '@/lib/smartCoach/types';

// ─── Types ──────────────────────────────────────────────────

export interface CoachProfileData {
  // Clinical basics
  severityProfile: SeverityProfile;
  primaryDeficit: PrimaryDeficit;
  therapyFocus: string[];
  
  // Phoneme-level data
  strugglingPhonemes: StrugglingPhoneme[];
  strongPhonemes: StrugglingPhoneme[];
  phonemeTargetWords: string[];
  
  // Speech profile (for cue selection, error patterns)
  speechProfile: UserSpeechProfile | null;
  
  // Domain scores (for data-driven drill selection)
  domainScores: DomainScore[];
  
  // Cross-session continuity
  lastSessionGoals: CrossSessionGoals | null;
  
  // Exercise history (which games worked/didn't)
  exerciseHistory: ExercisePerformance[];
  
  // Loading state
  loading: boolean;
  /** Whether we have enough data to personalize meaningfully */
  hasProfile: boolean;
}

export interface DomainScore {
  domainSlug: string;
  score: number;
  confidence: string;
  trialCount: number;
}

export interface CrossSessionGoals {
  /** What to say at session start: "Last time X was hard" */
  continuityOpener: string;
  /** Specific struggles to carry forward */
  priorStruggles: string[];
  /** Specific wins to reinforce */
  priorWins: string[];
  /** Topic from last session */
  lastTopic: string | null;
  /** Words that were drilled last session */
  lastDrilledWords: string[];
  /** Average score from last session */
  lastAvgScore: number | null;
}

export interface ExercisePerformance {
  exerciseSlug: string;
  avgAccuracy: number;
  trialCount: number;
  lastPlayedAt: string;
}

// ─── Clinical Profile Extraction ────────────────────────────

function extractSeverity(clinicalProfile: Record<string, any> | null): SeverityProfile {
  if (!clinicalProfile) return 'moderate';
  
  const severity = clinicalProfile.severity;
  if (severity) {
    // Check speech severity first, then overall
    const speechSev = severity.speech || severity.overall || '';
    const lower = speechSev.toLowerCase();
    if (lower.includes('severe') || lower.includes('global')) return 'severe';
    if (lower.includes('mild')) return 'mild';
    return 'moderate';
  }
  
  // Infer from impairments
  const speech = clinicalProfile.impairments?.speech || [];
  if (speech.length === 0) return 'moderate';
  
  const speechStr = speech.join(' ').toLowerCase();
  if (speechStr.includes('global') || speechStr.includes('severe')) return 'severe';
  if (speechStr.includes('mild') || speechStr.includes('anomic')) return 'mild';
  return 'moderate';
}

function extractPrimaryDeficit(clinicalProfile: Record<string, any> | null): PrimaryDeficit {
  if (!clinicalProfile) return 'expressive';
  
  const speech = (clinicalProfile.impairments?.speech || []).join(' ').toLowerCase();
  
  if (speech.includes('wernicke') || speech.includes('receptive') || speech.includes('comprehension')) {
    return speech.includes('expressive') || speech.includes('broca') ? 'mixed' : 'receptive';
  }
  if (speech.includes('global')) return 'mixed';
  return 'expressive'; // Default for anomic, broca, conduction
}

// ─── Cross-Session Goals Builder ────────────────────────────

function buildCrossSessionGoals(
  lastSession: any | null,
  strugglingPhonemes: StrugglingPhoneme[],
  exerciseHistory: ExercisePerformance[],
): CrossSessionGoals | null {
  if (!lastSession) return null;
  
  const priorStruggles = lastSession.top_struggles || [];
  const priorWins = lastSession.top_wins || [];
  const lastTopic = lastSession.metadata?.topic || lastSession.primary_domain;
  const lastDrilledWords = lastSession.metadata?.drilledWords || [];
  const lastAvgScore = lastSession.avg_score;
  
  // Build the continuity opener Maya should say
  const parts: string[] = [];
  
  if (priorStruggles.length > 0) {
    parts.push(`Last time, ${priorStruggles[0].toLowerCase()}`);
  }
  if (priorWins.length > 0) {
    parts.push(`You did well with ${priorWins[0].toLowerCase()}`);
  }
  if (strugglingPhonemes.length > 0) {
    const phoneme = strugglingPhonemes[0].phoneme;
    const acc = Math.round(strugglingPhonemes[0].accuracy * 100);
    parts.push(`The "${phoneme}" sound has been tricky (${acc}% accuracy)`);
  }
  
  // Weak exercises
  const weakExercises = exerciseHistory
    .filter(e => e.avgAccuracy < 0.5 && e.trialCount >= 5)
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy);
  if (weakExercises.length > 0) {
    parts.push(`${weakExercises[0].exerciseSlug.replace(/-/g, ' ')} needs more work`);
  }
  
  const continuityOpener = parts.length > 0
    ? parts.slice(0, 2).join('. ') + ". Let's build on that today."
    : '';
  
  return {
    continuityOpener,
    priorStruggles,
    priorWins,
    lastTopic,
    lastDrilledWords,
    lastAvgScore,
  };
}

// ─── Main Hook ──────────────────────────────────────────────

export function useCoachProfile(userId: string | null | undefined): CoachProfileData {
  const { activeProfile } = useProfile();
  
  // Speech profile
  const { profile: speechProfile, loading: speechLoading } = useUserSpeechProfile(
    userId,
    { profileId: activeProfile?.id, enabled: !!userId }
  );
  
  // Struggling phonemes
  const {
    strugglingPhonemes,
    strongPhonemes,
    targetWords: phonemeTargetWords,
    loading: phonemeLoading,
  } = useStrugglingPhonemes(userId, { profileId: activeProfile?.id });
  
  // Clinical profile from profiles table
  const clinicalProfile = activeProfile?.clinical_profile as Record<string, any> | null;
  
  // Domain scores + exercise history (loaded once)
  const [domainScores, setDomainScores] = useState<DomainScore[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExercisePerformance[]>([]);
  const [lastSessionRaw, setLastSessionRaw] = useState<any>(null);
  const [extraLoading, setExtraLoading] = useState(false);
  
  const profileId = activeProfile?.id;
  useEffect(() => {
    if (!userId) return;
    setExtraLoading(true);
    
    const loadExtraData = async () => {
      try {
        // Load domain scores and last session in parallel
        const [domainRes, sessionRes] = await Promise.all([
          // Domain scores (most recent per domain) — scoped to active profile
          (() => {
            let q = supabase
              .from('cognitive_domain_scores')
              .select('domain_slug, score, confidence, trial_count')
              .eq('user_id', userId)
              .order('computed_at', { ascending: false })
              .limit(20);
            if (profileId) q = q.eq('profile_id', profileId);
            return q;
          })(),
          
          // Last coach session — scoped to active profile
          (() => {
            let q = supabase
              .from('coach_conversation_summaries')
              .select('primary_domain, top_wins, top_struggles, maya_summary, avg_score, metadata, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1);
            if (profileId) q = q.eq('profile_id', profileId);
            return q.maybeSingle();
          })(),
        ]);
        
        // Process domain scores — deduplicate by domain
        if (domainRes.data) {
          const seen = new Set<string>();
          const scores: DomainScore[] = [];
          for (const row of domainRes.data) {
            if (!seen.has(row.domain_slug)) {
              seen.add(row.domain_slug);
              scores.push({
                domainSlug: row.domain_slug,
                score: row.score,
                confidence: row.confidence,
                trialCount: row.trial_count,
              });
            }
          }
          setDomainScores(scores);
        }
        
        // Load exercise history: get recent sessions then their events
        let sessionsQ = supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('started_at', new Date(Date.now() - 14 * 86400000).toISOString())
          .limit(50);
        if (profileId) sessionsQ = sessionsQ.eq('profile_id', profileId);
        const sessionsRes = await sessionsQ;
        
        if (sessionsRes.data && sessionsRes.data.length > 0) {
          const sessionIds = sessionsRes.data.map(s => s.id);
          const eventsRes = await supabase
            .from('exercise_events')
            .select('exercise_slug, score, created_at')
            .in('session_id', sessionIds)
            .limit(500);
          
          if (eventsRes.data && eventsRes.data.length > 0) {
            const bySlug = new Map<string, { scores: number[]; lastAt: string }>();
            for (const row of eventsRes.data) {
              if (!row.exercise_slug) continue;
              const existing = bySlug.get(row.exercise_slug) || { scores: [], lastAt: row.created_at || '' };
              existing.scores.push(row.score ?? 0);
              if ((row.created_at || '') > existing.lastAt) existing.lastAt = row.created_at || '';
              bySlug.set(row.exercise_slug, existing);
            }
            const history: ExercisePerformance[] = [];
            bySlug.forEach((val, slug) => {
              history.push({
                exerciseSlug: slug,
                avgAccuracy: val.scores.reduce((a, b) => a + b, 0) / val.scores.length,
                trialCount: val.scores.length,
                lastPlayedAt: val.lastAt,
              });
            });
            setExerciseHistory(history);
          }
        }
        
        if (sessionRes.data) {
          setLastSessionRaw(sessionRes.data);
        }
      } catch (err) {
        console.warn('[useCoachProfile] Failed to load extra data:', err);
      } finally {
        setExtraLoading(false);
      }
    };
    
    loadExtraData();
  }, [userId]);
  
  // Derived values
  const severityProfile = useMemo(() => extractSeverity(clinicalProfile), [clinicalProfile]);
  const primaryDeficit = useMemo(() => extractPrimaryDeficit(clinicalProfile), [clinicalProfile]);
  const therapyFocus = useMemo(
    () => (clinicalProfile as any)?.therapy_focus || [],
    [clinicalProfile]
  );
  
  const lastSessionGoals = useMemo(
    () => buildCrossSessionGoals(lastSessionRaw, strugglingPhonemes, exerciseHistory),
    [lastSessionRaw, strugglingPhonemes, exerciseHistory]
  );
  
  const loading = speechLoading || phonemeLoading || extraLoading;
  const hasProfile = !!clinicalProfile || !!speechProfile || strugglingPhonemes.length > 0;
  
  return {
    severityProfile,
    primaryDeficit,
    therapyFocus,
    strugglingPhonemes,
    strongPhonemes: strongPhonemes as StrugglingPhoneme[],
    phonemeTargetWords,
    speechProfile,
    domainScores,
    lastSessionGoals,
    exerciseHistory,
    loading,
    hasProfile,
  };
}
