/**
 * Adaptation Event Logger
 * 
 * Lightweight hook for logging adaptation events to the database.
 * Supports both session-level (TodayFocus) and in-game (difficulty, lane) events.
 * 
 * Features:
 * - Rate limiting (max 50 events per session)
 * - Fire-and-forget pattern (non-blocking)
 * - Batching for high-frequency events (lane switches)
 */

import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

// Adaptation types matching the database schema
export type AdaptationType =
  // Session-level
  | 'start_difficulty_set'
  | 'timeout_extended'
  | 'session_cap_reduced'
  | 'large_targets_enabled'
  | 'slower_tts_enabled'
  | 'preferred_cue_type_set'
  | 'focus_phonemes_set'
  | 'focus_words_set'
  // In-game
  | 'difficulty_up'
  | 'difficulty_down'
  | 'frustration_stepdown'
  | 'lane_switch'
  | 'cue_delivered'
  | 'cue_escalated'
  | 'break_prompted'
  | 'confidence_boost_shown';

export type AdaptationLayer = 'session' | 'in_game';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AdaptationEventInput {
  adaptationType: AdaptationType;
  layer: AdaptationLayer;
  
  sessionId?: string | null;
  exerciseSlug?: string;
  trialIndex?: number;
  
  valueBefore?: unknown;
  valueAfter?: unknown;
  
  triggerType: 'rule' | 'threshold' | 'timer' | 'user_request';
  triggerRuleId?: string;
  triggerCondition?: string;
  
  evidence: Record<string, unknown>;
  confidence: ConfidenceLevel;
}

interface UseAdaptationEventLoggerOptions {
  userId: string | undefined;
  profileId?: string;
  maxEventsPerSession?: number;
}

export const useAdaptationEventLogger = ({
  userId,
  profileId,
  maxEventsPerSession = 50,
}: UseAdaptationEventLoggerOptions) => {
  // Store latest config in ref to avoid stale closures
  const configRef = useRef({ userId, profileId, maxEventsPerSession });
  useEffect(() => {
    configRef.current = { userId, profileId, maxEventsPerSession };
  }, [userId, profileId, maxEventsPerSession]);

  // Rate limiting counter
  const eventCountRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  
  // Batch queue for high-frequency events
  const batchQueueRef = useRef<AdaptationEventInput[]>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Prevent double-flush on overlapping timer + unmount
  const isFlushingRef = useRef(false);

  /**
   * Flush queued events to database (defined first so queueEvent can depend on it)
   */
  const flushBatch = useCallback(async () => {
    // Guard against concurrent flushes (timer + unmount overlap)
    if (isFlushingRef.current) return;
    
    const { userId, profileId, maxEventsPerSession } = configRef.current;
    if (!userId || batchQueueRef.current.length === 0) return;

    isFlushingRef.current = true;

    const events = [...batchQueueRef.current];
    batchQueueRef.current = [];

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Check rate limit
    const remaining = maxEventsPerSession - eventCountRef.current;
    const toInsert = events.slice(0, remaining);
    
    if (toInsert.length === 0) {
      isFlushingRef.current = false;
      return;
    }

    try {
      const rows = toInsert.map(event => ({
        user_id: userId,
        profile_id: profileId || null,
        session_id: event.sessionId || null,
        exercise_slug: event.exerciseSlug ? normalizeExerciseSlug(event.exerciseSlug) : null,
        trial_index: event.trialIndex ?? null,
        adaptation_type: event.adaptationType,
        layer: event.layer,
        // Store raw JSONB values, not wrapped in {value: ...}
        value_before: event.valueBefore ?? null,
        value_after: event.valueAfter ?? null,
        trigger_type: event.triggerType,
        trigger_rule_id: event.triggerRuleId || null,
        trigger_condition: event.triggerCondition || null,
        evidence: event.evidence,
        confidence: event.confidence,
      }));

      const { error } = await supabase
        .from('adaptation_events' as any)
        .insert(rows);

      if (error) {
        console.warn('[AdaptationLogger] Batch insert failed:', error.message);
      } else {
        eventCountRef.current += toInsert.length;
        if (import.meta.env.DEV) {
          console.debug(`[AdaptationLogger] Flushed ${toInsert.length} events`);
        }
      }
    } catch (err) {
      console.warn('[AdaptationLogger] Batch flush error:', err);
    } finally {
      isFlushingRef.current = false;
    }
  }, []); // No deps - uses configRef

  /**
   * Queue a high-frequency event for batched insert (e.g., lane switches)
   * Flushes after 5 seconds of inactivity or when session ends
   */
  const queueEvent = useCallback((event: AdaptationEventInput) => {
    const { userId, maxEventsPerSession } = configRef.current;
    if (!userId) return;

    // Early drop if already at cap including queued events (avoid memory growth)
    const totalPending = eventCountRef.current + batchQueueRef.current.length;
    if (totalPending >= maxEventsPerSession) {
      if (import.meta.env.DEV) {
        console.debug('[AdaptationLogger] Queue cap reached, dropping event');
      }
      return;
    }

    batchQueueRef.current.push(event);

    // Reset flush timer
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(flushBatch, 5000);
  }, [flushBatch]);

  // Cleanup: flush on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      // Best-effort flush on exit
      flushBatch();
    };
  }, [flushBatch]);

  /**
   * Log a single adaptation event (fire-and-forget)
   */
  const logEvent = useCallback(async (event: AdaptationEventInput): Promise<boolean> => {
    const { userId, profileId, maxEventsPerSession } = configRef.current;
    if (!userId) {
      if (import.meta.env.DEV) {
        console.debug('[AdaptationLogger] No userId, skipping');
      }
      return false;
    }

    // Rate limiting - account for queued events too
    const totalPending = eventCountRef.current + batchQueueRef.current.length;
    if (totalPending >= maxEventsPerSession) {
      if (import.meta.env.DEV) {
        console.debug('[AdaptationLogger] Rate limit reached, skipping');
      }
      return false;
    }

    // Reset counter on new session
    if (event.sessionId && event.sessionId !== sessionIdRef.current) {
      sessionIdRef.current = event.sessionId;
      eventCountRef.current = 0;
    }

    try {
      const { error } = await supabase
        .from('adaptation_events' as any)
        .insert({
          user_id: userId,
          profile_id: profileId || null,
          session_id: event.sessionId || null,
          exercise_slug: event.exerciseSlug ? normalizeExerciseSlug(event.exerciseSlug) : null,
          trial_index: event.trialIndex ?? null,
          adaptation_type: event.adaptationType,
          layer: event.layer,
          // Store raw JSONB values
          value_before: event.valueBefore ?? null,
          value_after: event.valueAfter ?? null,
          trigger_type: event.triggerType,
          trigger_rule_id: event.triggerRuleId || null,
          trigger_condition: event.triggerCondition || null,
          evidence: event.evidence,
          confidence: event.confidence,
        });

      if (error) {
        console.warn('[AdaptationLogger] Insert failed:', error.message);
        return false;
      }

      eventCountRef.current += 1;
      
      if (import.meta.env.DEV) {
        console.debug(`[AdaptationLogger] Logged: ${event.adaptationType} (${event.layer})`, {
          before: event.valueBefore,
          after: event.valueAfter,
          trigger: event.triggerType,
        });
      }
      
      return true;
    } catch (err) {
      console.warn('[AdaptationLogger] Unexpected error:', err);
      return false;
    }
  }, []); // No deps - uses configRef

  /**
   * Log difficulty change (convenience method)
   */
  const logDifficultyChange = useCallback((
    direction: 'up' | 'down',
    previousLevel: number,
    newLevel: number,
    successRate: number,
    consecutiveErrors: number,
    sessionId?: string | null,
    exerciseSlug?: string,
    trialIndex?: number
  ) => {
    return logEvent({
      adaptationType: direction === 'up' ? 'difficulty_up' : 'difficulty_down',
      layer: 'in_game',
      sessionId,
      exerciseSlug,
      trialIndex,
      valueBefore: previousLevel,
      valueAfter: newLevel,
      triggerType: 'threshold',
      triggerCondition: direction === 'up' 
        ? `successRate > 90% (${Math.round(successRate * 100)}%)`
        : `successRate < 70% (${Math.round(successRate * 100)}%)`,
      evidence: {
        successRate,
        consecutiveErrors,
        previousLevel,
        newLevel,
      },
      confidence: 'HIGH',
    });
  }, [logEvent]);

  /**
   * Log lane switch (queued for batching)
   */
  const logLaneSwitch = useCallback((
    previousLane: string,
    newLane: string,
    currentDifficulty: number,
    sessionId?: string | null,
    exerciseSlug?: string,
    trialIndex?: number
  ) => {
    queueEvent({
      adaptationType: 'lane_switch',
      layer: 'in_game',
      sessionId,
      exerciseSlug,
      trialIndex,
      valueBefore: previousLane,
      valueAfter: newLane,
      triggerType: 'threshold',
      triggerCondition: `difficulty ${currentDifficulty} maps to ${newLane} lane`,
      evidence: {
        currentDifficulty,
        previousLane,
        newLane,
      },
      confidence: 'HIGH',
    });
  }, [queueEvent]);

  /**
   * Log cue delivery
   */
  const logCueDelivered = useCallback((
    cueType: string,
    cueLevel: number,
    trigger: 'stall' | 'consecutive_errors' | 'user_request',
    consecutiveErrors: number,
    sessionId?: string | null,
    exerciseSlug?: string,
    trialIndex?: number
  ) => {
    return logEvent({
      adaptationType: 'cue_delivered',
      layer: 'in_game',
      sessionId,
      exerciseSlug,
      trialIndex,
      valueAfter: cueType,
      triggerType: trigger === 'user_request' ? 'user_request' : 'threshold',
      triggerCondition: trigger,
      evidence: {
        cueType,
        cueLevel,
        trigger,
        consecutiveErrors,
      },
      confidence: 'HIGH',
    });
  }, [logEvent]);

  /**
   * Log session-level adaptation from TodayFocus
   */
  const logSessionAdaptation = useCallback((
    adaptationType: AdaptationType,
    value: unknown,
    ruleId: string,
    evidence: Record<string, unknown>,
    confidence: ConfidenceLevel,
    sessionId?: string | null
  ) => {
    return logEvent({
      adaptationType,
      layer: 'session',
      sessionId,
      // Store raw value directly as JSONB
      valueAfter: value,
      triggerType: 'rule',
      triggerRuleId: ruleId,
      evidence,
      confidence,
    });
  }, [logEvent]);

  /**
   * Reset rate limit counter (call on session start)
   */
  const resetSession = useCallback((newSessionId: string) => {
    sessionIdRef.current = newSessionId;
    eventCountRef.current = 0;
    batchQueueRef.current = [];
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, []);

  /**
   * Get current event count (for debugging, not reactive)
   */
  const getEventCount = useCallback(() => eventCountRef.current, []);

  return {
    logEvent,
    logDifficultyChange,
    logLaneSwitch,
    logCueDelivered,
    logSessionAdaptation,
    flushBatch,
    resetSession,
    getEventCount,
  };
};
