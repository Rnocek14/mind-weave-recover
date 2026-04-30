/**
 * Clinician Glance — Card 3: Listen / Voice Evidence
 * Answers: "What does the actual deficit sound like?"
 *
 * Same picker logic as caregiver Listen card (best, struggle), but adds:
 *   - target word + ASR confidence
 *   - error type chip
 *   - link out to full session detail
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Props {
  userId: string;
}

interface Clip {
  id: string;
  sessionId: string | null;
  targetWord: string | null;
  transcript: string | null;
  audioPath: string;
  confidence: number | null;
  isCorrect: boolean;
  errorType: string | null;
  createdAt: string;
}

async function getRecordingUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("session-recordings")
    .createSignedUrl(path, 900);
  if (error) return null;
  return data?.signedUrl ?? null;
}

function ClipRow({ clip, label, tone }: { clip: Clip | null; label: string; tone: "good" | "struggle" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tonePill =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-700 border-amber-500/20";

  const handlePlay = async () => {
    if (!clip) return;
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    let src = url;
    if (!src) {
      setLoading(true);
      src = await getRecordingUrl(clip.audioPath);
      setLoading(false);
      if (!src) return;
      setUrl(src);
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onpause = () => setPlaying(false);
    }
    audioRef.current.play();
    setPlaying(true);
  };

  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);

  if (!clip) {
    return (
      <div className="flex items-center gap-3 py-2 opacity-50">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${tonePill} font-medium`}>
            {label}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">No clip in window</div>
        </div>
      </div>
    );
  }

  const matches =
    clip.targetWord &&
    clip.transcript &&
    clip.targetWord.toLowerCase() === clip.transcript.toLowerCase();

  return (
    <div className="flex items-center gap-3 py-2">
      <Button
        size="icon"
        variant="outline"
        onClick={handlePlay}
        disabled={loading}
        className="w-10 h-10 rounded-full shrink-0"
        aria-label={playing ? "Pause clip" : "Play clip"}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${tonePill} font-medium`}>
            {label}
          </span>
          {clip.confidence !== null && (
            <Badge variant="outline" className="text-[10px] font-normal">
              ASR {Math.round((clip.confidence || 0) * 100)}%
            </Badge>
          )}
          {!clip.isCorrect && clip.errorType && (
            <Badge variant="outline" className="text-[10px] font-normal text-amber-700 border-amber-500/30">
              {clip.errorType.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        <div className="text-sm font-medium text-foreground truncate">
          "{clip.transcript || "—"}"
        </div>
        {clip.targetWord && !matches && (
          <div className="text-[11px] text-muted-foreground truncate">
            target: <span className="font-medium">{clip.targetWord}</span>
          </div>
        )}
      </div>
      {clip.sessionId && (
        <Link to={`/sessions/${clip.sessionId}`} className="text-muted-foreground hover:text-foreground shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

export function ClinicianListenCard({ userId }: Props) {
  const [clips, setClips] = useState<{ best: Clip | null; struggle: Clip | null }>({ best: null, struggle: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("utterance_analyses")
        .select(
          "id, session_id, target_word, transcript, audio_storage_path, created_at, is_correct, asr_confidence, recording_duration_ms, did_speak, error_type"
        )
        .eq("user_id", userId)
        .gte("created_at", since)
        .not("audio_storage_path", "is", null)
        .not("transcript", "is", null)
        .order("created_at", { ascending: false })
        .limit(120);

      if (!mounted) return;
      const rows = (data || []) as any[];

      const meaningful = rows.filter((r) => {
        const len = (r.transcript || "").trim().length;
        const dur = r.recording_duration_ms ?? 0;
        if (r.did_speak === false) return false;
        if (len < 2) return false;
        if (dur > 0 && dur < 400) return false;
        return true;
      });

      const bestPool = meaningful.filter((r) => r.is_correct === true);
      bestPool.sort((a, b) => {
        const ac = a.asr_confidence ?? 0;
        const bc = b.asr_confidence ?? 0;
        if (Math.abs(bc - ac) > 0.05) return bc - ac;
        return (b.transcript || "").length - (a.transcript || "").length;
      });

      const strugglePool = meaningful.filter(
        (r) =>
          r.is_correct === false &&
          r.error_type !== "no_response" &&
          r.error_type !== "no_attempt"
      );

      const toClip = (r: any | null): Clip | null =>
        r
          ? {
              id: r.id,
              sessionId: r.session_id,
              targetWord: r.target_word,
              transcript: r.transcript,
              audioPath: r.audio_storage_path,
              confidence: r.asr_confidence,
              isCorrect: r.is_correct,
              errorType: r.error_type,
              createdAt: r.created_at,
            }
          : null;

      setClips({ best: toClip(bestPool[0] || null), struggle: toClip(strugglePool[0] || null) });
      setLoading(false);
    };
    run();
    return () => { mounted = false; };
  }, [userId]);

  return (
    <Card className="p-5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
        Voice Evidence
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading clips…</div>
      ) : !clips.best && !clips.struggle ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          No qualifying recordings in the last 7 days.
        </div>
      ) : (
        <div className="divide-y divide-border">
          <ClipRow clip={clips.best} label="Best attempt" tone="good" />
          <ClipRow clip={clips.struggle} label="Representative struggle" tone="struggle" />
        </div>
      )}
    </Card>
  );
}
