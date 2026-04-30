/**
 * Across-Time View — pick a target word and play every attempt of it
 * across the patient's recent sessions, in chronological order.
 *
 * Goal: let clinicians *hear* recovery on the same word over time,
 * not just see metrics.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Play, Pause, Mic, Calendar, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { TrialData } from "@/hooks/useSessionDetail";
import { cn } from "@/lib/utils";

interface AcrossTimeViewProps {
  /** Trials in the *currently selected* session — used to seed target options. */
  currentSessionTrials: TrialData[];
  profileId: string | undefined;
  /** Limit how many recent sessions to scan. */
  sessionLimit?: number;
}

interface AttemptRow {
  attempt_id: string;
  session_id: string;
  created_at: string;
  target_word: string;
  transcript: string | null;
  is_correct: boolean | null;
  error_type: string | null;
  cue_type_given: string | null;
  latency_ms: number | null;
  audio_storage_path: string | null;
  recording_duration_ms: number | null;
}

const QUALITY_MIN_MS = 400;

function normalize(w: string): string {
  return (w || "").trim().toLowerCase();
}

export function AcrossTimeView({
  currentSessionTrials,
  profileId,
  sessionLimit = 8,
}: AcrossTimeViewProps) {
  // Targets the patient practiced in this session (seed choices)
  const targetOptions = useMemo(() => {
    const counts = new Map<string, number>();
    currentSessionTrials.forEach((t) => {
      const w = normalize(t.target_word);
      if (!w) return;
      counts.set(w, (counts.get(w) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word, n]) => ({ word, count: n }));
  }, [currentSessionTrials]);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-pick top target
  useEffect(() => {
    if (!selectedWord && targetOptions.length > 0) {
      setSelectedWord(targetOptions[0].word);
    }
  }, [targetOptions, selectedWord]);

  // Fetch all attempts for this word across recent sessions
  useEffect(() => {
    if (!profileId || !selectedWord) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1. recent session ids for this patient
        const { data: sessRows } = await supabase
          .from("sessions")
          .select("id")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(sessionLimit);

        const sessionIds = (sessRows ?? []).map((r) => r.id);
        if (sessionIds.length === 0) {
          if (!cancelled) { setAttempts([]); setLoading(false); }
          return;
        }

        // 2. utterance_analyses where target matches (case-insensitive)
        const { data: rows } = await supabase
          .from("utterance_analyses")
          .select(
            "attempt_id, session_id, created_at, target_word, transcript, is_correct, error_type, cue_type_given, latency_ms, audio_storage_path, recording_duration_ms"
          )
          .in("session_id", sessionIds)
          .ilike("target_word", selectedWord)
          .order("created_at", { ascending: true });

        if (cancelled) return;
        setAttempts((rows ?? []) as AttemptRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileId, selectedWord, sessionLimit]);

  // Audio: single-clip + sequential playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sequenceIndex, setSequenceIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seqRef = useRef<{ list: AttemptRow[]; i: number } | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    setPlayingId(null);
    setSequenceIndex(null);
    seqRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const playOne = useCallback(async (row: AttemptRow, onEnd?: () => void) => {
    if (!row.audio_storage_path) { onEnd?.(); return; }
    const { data } = await supabase.storage
      .from("session-recordings")
      .createSignedUrl(row.audio_storage_path, 60);
    if (!data?.signedUrl) { onEnd?.(); return; }
    const audio = new Audio(data.signedUrl);
    audio.onended = () => {
      setPlayingId(null);
      onEnd?.();
    };
    audio.onerror = () => {
      setPlayingId(null);
      onEnd?.();
    };
    audioRef.current = audio;
    setPlayingId(row.attempt_id);
    try { await audio.play(); } catch { setPlayingId(null); onEnd?.(); }
  }, []);

  const togglePlay = useCallback((row: AttemptRow) => {
    if (playingId === row.attempt_id) { stop(); return; }
    stop();
    playOne(row);
  }, [playingId, stop, playOne]);

  const playable = useMemo(
    () => attempts.filter(
      (a) => a.audio_storage_path && (a.recording_duration_ms ?? 0) >= QUALITY_MIN_MS
    ),
    [attempts]
  );

  const playSequence = useCallback(() => {
    if (playable.length === 0) return;
    stop();
    seqRef.current = { list: playable, i: 0 };
    setSequenceIndex(0);
    const advance = () => {
      const s = seqRef.current;
      if (!s) return;
      if (s.i >= s.list.length) { stop(); return; }
      const row = s.list[s.i];
      setSequenceIndex(s.i);
      s.i += 1;
      playOne(row, advance);
    };
    advance();
  }, [playable, stop, playOne]);

  if (targetOptions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No target words in this session to track.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Target:</span>
        <Select value={selectedWord ?? undefined} onValueChange={setSelectedWord}>
          <SelectTrigger className="w-auto min-w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targetOptions.map((o) => (
              <SelectItem key={o.word} value={o.word}>
                {o.word}{" "}
                <span className="text-muted-foreground">· {o.count}×</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          onClick={playSequence}
          disabled={playable.length === 0 || sequenceIndex !== null}
          className="h-9 gap-1.5"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Play in sequence ({playable.length})
        </Button>
        {sequenceIndex !== null && (
          <Button size="sm" variant="ghost" onClick={stop} className="h-9">
            Stop
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No prior attempts of <span className="font-semibold">{selectedWord}</span>{" "}
          in the last {sessionLimit} sessions.
        </div>
      ) : (
        <ol className="space-y-2">
          {attempts.map((a, i) => {
            const playing = playingId === a.attempt_id;
            const isCurrentSeq = sequenceIndex !== null && playable[sequenceIndex]?.attempt_id === a.attempt_id;
            const hasAudio = !!a.audio_storage_path && (a.recording_duration_ms ?? 0) >= QUALITY_MIN_MS;
            return (
              <li
                key={a.attempt_id}
                className={cn(
                  "rounded-lg border bg-card p-3 flex items-start gap-3 transition-colors",
                  isCurrentSeq ? "border-primary" : "border-border"
                )}
              >
                <Button
                  size="sm"
                  variant={playing ? "secondary" : "default"}
                  onClick={() => togglePlay(a)}
                  disabled={!hasAudio}
                  className="h-8 w-8 p-0 shrink-0"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </Button>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        month: "short", day: "numeric",
                      })}
                    </span>
                    <span className="opacity-60">· attempt {i + 1} of {attempts.length}</span>
                    {a.is_correct === true && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">correct</Badge>
                    )}
                    {a.is_correct === false && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">incorrect</Badge>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <Mic className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground/90 italic">
                      {a.transcript
                        ? `"${a.transcript}"`
                        : <span className="text-muted-foreground not-italic">
                            {hasAudio ? "(no transcript)" : "(no recording)"}
                          </span>}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {a.error_type && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {a.error_type.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {a.cue_type_given && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        cue: {a.cue_type_given}
                      </Badge>
                    )}
                    {a.latency_ms != null && a.latency_ms > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {(a.latency_ms / 1000).toFixed(1)}s
                      </Badge>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
