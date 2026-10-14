/**
 * Reusable hook to fetch trial-level data + audio for a given session.
 * Extracted from SessionDetailPanel logic.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrialData {
  attempt_id: string;
  target_word: string;
  transcript: string | null;
  is_correct: boolean | null;
  exercise_slug: string | null;
  latency_ms: number | null;
  error_type: string | null;
  cue_type_given: string | null;
  cue_was_effective: boolean | null;
  audio_storage_path: string | null;
  recording_duration_ms: number | null;
  pronunciation_status: string | null;
  semantic_similarity: number | null;
  phonological_similarity: number | null;
  stuck_type: string | null;
  speech_rate_wpm: number | null;
  created_at: string | null;
  taskParameters?: any;
  outputs?: any;
  // Speech Validity Gate (Phase 1)
  validity_label?: string | null;
  validity_reason?: string | null;
  counts_toward_score?: boolean | null;
  clinician_validity_override?: string | null;
  /** Which underlying table the row came from - needed for clinician overrides. */
  source_table?: 'utterance_analyses' | 'exercise_events';
  // Shadow verdicts are persisted in exercise_events.outputs.shadow_v2.
  // Joined by attempt_id; never authoritative for scoring or progression.
  axis_scores?: Record<string, { value: number; confidence: number; evidence: string[] }> | null;
  strategy_used?: string | null;
  measurement_confidence?: string | null;
  verdict_primary?: string | null;
  verdict_reason?: string | null;
  shadow_v1_agreement?: { v1_correct: boolean; v2_primary: string; agrees: boolean | null } | null;
  // Advisory evidence is displayed only; it never feeds scoring.
  gop_data?: any;
  pause_count?: number | null;
  effortful_speech?: boolean | null;
}

type ShadowEvidence = Pick<TrialData,
  'axis_scores' | 'strategy_used' | 'measurement_confidence' |
  'verdict_primary' | 'verdict_reason' | 'shadow_v1_agreement'>;

export function useSessionDetail() {
  const [trials, setTrials] = useState<TrialData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const audioRequestRef = useRef(0);

  // Invalidate pending requests when the owner unmounts (including profile
  // changes). A late result must not restart audio or publish old evidence.
  useEffect(() => () => {
    requestRef.current += 1;
    audioRequestRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    audioRequestRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const fetchTrials = useCallback(async (sessionId: string) => {
    const request = ++requestRef.current;
    stopAudio();
    setTrials([]);
    setLoadedSessionId(null);
    setLoading(true);
    try {
      // Try utterance_analyses first.
      const { data: uaData, error: uaError } = await supabase
        .from("utterance_analyses")
        .select(
          "attempt_id, target_word, transcript, is_correct, exercise_slug, latency_ms, error_type, cue_type_given, cue_was_effective, audio_storage_path, recording_duration_ms, pronunciation_status, semantic_similarity, phonological_similarity, stuck_type, speech_rate_wpm, created_at, validity_label, validity_reason, counts_toward_score, clinician_validity_override, gop_data, pause_count, effortful_speech"
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (request !== requestRef.current) return;
      if (uaError) throw uaError;

      let rows: TrialData[];
      if (uaData && uaData.length > 0) {
        rows = uaData.map((r) => ({ ...r, source_table: 'utterance_analyses' as const }));
      } else {
        const { data: eeData, error: eeError } = await supabase
          .from("exercise_events")
          .select(
            "attempt_id, exercise_slug, score, reaction_time_ms, error_type, cue_type_given, cue_was_effective, cue_level, audio_storage_path, recording_duration_ms, semantic_similarity, phonological_similarity, browser_transcript, whisper_transcript, task_parameters, outputs, created_at, validity_label, validity_reason, counts_toward_score, clinician_validity_override, acoustic_metrics"
          )
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });
        if (request !== requestRef.current) return;
        if (eeError) throw eeError;

        const mapped: TrialData[] = (eeData ?? []).map((ev) => ({
          attempt_id: ev.attempt_id || ev.created_at || "",
          target_word: (ev.task_parameters as any)?.target_word || (ev.task_parameters as any)?.targetWord || (ev.outputs as any)?.target || "",
          transcript: ev.whisper_transcript || ev.browser_transcript || null,
          is_correct: ev.score === 1 || ev.score === 100 ? true : ev.score === 0 ? false : null,
          exercise_slug: ev.exercise_slug,
          latency_ms: ev.reaction_time_ms,
          error_type: ev.error_type,
          cue_type_given: ev.cue_type_given,
          cue_was_effective: ev.cue_was_effective,
          audio_storage_path: ev.audio_storage_path,
          recording_duration_ms: ev.recording_duration_ms,
          pronunciation_status: null,
          semantic_similarity: ev.semantic_similarity,
          phonological_similarity: ev.phonological_similarity,
          stuck_type: null,
          speech_rate_wpm: (ev as any).acoustic_metrics?.speechRateWpm ?? null,
          pause_count: (ev as any).acoustic_metrics?.pauseCount ?? null,
          effortful_speech: null,
          gop_data: null,
          created_at: ev.created_at,
          taskParameters: ev.task_parameters,
          outputs: ev.outputs,
          validity_label: (ev as any).validity_label ?? null,
          validity_reason: (ev as any).validity_reason ?? null,
          counts_toward_score: (ev as any).counts_toward_score ?? null,
          clinician_validity_override: (ev as any).clinician_validity_override ?? null,
          source_table: 'exercise_events' as const,
        }));
        rows = mapped;
      }

      // Read the location actually written by useExerciseTelemetry. The old
      // query selected nonexistent top-level columns and silently lost every
      // shadow verdict. No schema change and no new scoring authority here.
      try {
        const { data: shadowRows, error: shadowError } = await supabase
          .from("exercise_events")
          .select("attempt_id, outputs")
          .eq("session_id", sessionId);
        if (request !== requestRef.current) return;
        if (shadowError) throw shadowError;
        const byAttempt = new Map<string, ShadowEvidence>();
        for (const row of shadowRows ?? []) {
          const outputs = row.outputs as { shadow_v2?: ShadowEvidence | null } | null;
          const shadow = outputs?.shadow_v2;
          if (row.attempt_id && shadow && typeof shadow === 'object' && !Array.isArray(shadow)) {
            byAttempt.set(row.attempt_id, shadow);
          }
        }
        rows = rows.map((t) => {
          const s = byAttempt.get(t.attempt_id);
          return s ? {
            ...t,
            axis_scores: s.axis_scores ?? null,
            strategy_used: s.strategy_used ?? null,
            measurement_confidence: s.measurement_confidence ?? null,
            verdict_primary: s.verdict_primary ?? null,
            verdict_reason: s.verdict_reason ?? null,
            shadow_v1_agreement: s.shadow_v1_agreement ?? null,
          } : t;
        });
      } catch (shadowErr) {
        if (request !== requestRef.current) return;
        console.warn("Shadow verdict merge failed (non-fatal):", shadowErr);
      }

      if (request !== requestRef.current) return;
      setTrials(rows);
      setLoadedSessionId(sessionId);
    } catch (err) {
      if (request !== requestRef.current) return;
      console.error("Error fetching session trials:", err);
      setTrials([]);
      setLoadedSessionId(null);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [stopAudio]);

  const playAudio = useCallback(async (path: string, attemptId: string) => {
    if (playingId === attemptId) {
      stopAudio();
      return;
    }
    stopAudio();
    const request = audioRequestRef.current;
    try {
      const { data, error } = await supabase.storage
        .from("session-recordings")
        .createSignedUrl(path, 60);
      if (request !== audioRequestRef.current) return;
      if (error) throw error;
      if (data?.signedUrl) {
        const audio = new Audio(data.signedUrl);
        const finish = () => {
          if (request === audioRequestRef.current) {
            audioRef.current = null;
            setPlayingId(null);
          }
        };
        audio.onended = finish;
        audio.onerror = finish;
        audioRef.current = audio;
        setPlayingId(attemptId);
        await audio.play();
      }
    } catch (err) {
      if (request !== audioRequestRef.current) return;
      console.error("Error playing audio:", err);
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
  }, [playingId, stopAudio]);

  return { trials, loading, loadedSessionId, fetchTrials, playAudio, stopAudio, playingId };
}
