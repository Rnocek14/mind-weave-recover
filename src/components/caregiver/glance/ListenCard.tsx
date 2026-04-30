/**
 * Glance Card 3 — Listen
 * Answers: "What did it sound like?"
 * One best clip, one struggle clip from the last 7 days.
 * Simple play buttons. No nav.
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ListenCardProps {
  userId: string;
}

interface Clip {
  id: string;
  targetWord: string | null;
  transcript: string | null;
  audioPath: string;
  createdAt: string;
  isCorrect: boolean;
}

async function getRecordingUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("session-recordings")
    .createSignedUrl(path, 900);
  if (error) return null;
  return data?.signedUrl ?? null;
}

function ClipRow({
  clip,
  label,
  tone,
}: {
  clip: Clip | null;
  label: string;
  tone: "good" | "struggle";
}) {
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

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

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
          <div className="text-sm text-muted-foreground mt-0.5">No clip yet</div>
        </div>
      </div>
    );
  }

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
        <div className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${tonePill} font-medium mb-0.5`}>
          {label}
        </div>
        <div className="text-sm font-medium text-foreground truncate">
          "{clip.transcript || clip.targetWord || "—"}"
        </div>
        {clip.targetWord && clip.transcript && clip.targetWord !== clip.transcript && (
          <div className="text-[11px] text-muted-foreground">target: {clip.targetWord}</div>
        )}
      </div>
    </div>
  );
}

export function ListenCard({ userId }: ListenCardProps) {
  const [clips, setClips] = useState<{ best: Clip | null; struggle: Clip | null }>({
    best: null,
    struggle: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchClips = async () => {
      setLoading(true);
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("utterance_analyses")
        .select("id, target_word, transcript, audio_storage_path, created_at, is_correct")
        .eq("user_id", userId)
        .gte("created_at", since)
        .not("audio_storage_path", "is", null)
        .not("transcript", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!mounted) return;

      const rows = (data || []) as any[];
      const best = rows.find((r) => r.is_correct === true) || null;
      const struggle = rows.find((r) => r.is_correct === false) || null;

      const toClip = (r: any | null): Clip | null =>
        r
          ? {
              id: r.id,
              targetWord: r.target_word,
              transcript: r.transcript,
              audioPath: r.audio_storage_path,
              createdAt: r.created_at,
              isCorrect: r.is_correct,
            }
          : null;

      setClips({ best: toClip(best), struggle: toClip(struggle) });
      setLoading(false);
    };

    fetchClips();
    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <Card className="p-5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
        Listen
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading clips…</div>
      ) : !clips.best && !clips.struggle ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          No recordings yet this week.
        </div>
      ) : (
        <div className="divide-y divide-border">
          <ClipRow clip={clips.best} label="Best moment" tone="good" />
          <ClipRow clip={clips.struggle} label="Working on" tone="struggle" />
        </div>
      )}
    </Card>
  );
}
