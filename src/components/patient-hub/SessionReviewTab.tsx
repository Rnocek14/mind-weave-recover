/**
 * Session Review Tab — picks one session and presents focused
 * recording-level evidence for clinical analysis.
 *
 * Sections:
 *   1. Session summary strip
 *   2. Voice evidence (4 curated clips)
 *   3. Error pattern breakdown (interactive)
 *   4. Sounds to watch (auto-detected, hedged)
 *   5. Cue response + cross-session fade
 *   6. Clinician notes
 *
 * Only the *selected* session loads its trial detail (lazy).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSessionDetail, type TrialData } from "@/hooks/useSessionDetail";
import { SessionSummaryStrip } from "./review/SessionSummaryStrip";
import { VoiceEvidenceGrid } from "./review/VoiceEvidenceGrid";
import { ErrorPatternBreakdown, categoryOfTrial } from "./review/ErrorPatternBreakdown";
import { SoundsToWatch } from "./review/SoundsToWatch";
import { CueResponsePanel } from "./review/CueResponsePanel";
import { SessionNotesPanel } from "./review/SessionNotesPanel";
import { Volume2, VolumeX } from "lucide-react";

interface SessionReviewTabProps {
  profileId: string | undefined;
}

interface SessionLite {
  id: string;
  started_at: string;
  duration_sec: number | null;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function SessionReviewTab({ profileId }: SessionReviewTabProps) {
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorFilter, setErrorFilter] = useState<string | null>(null);

  const { trials, loading: trialsLoading, fetchTrials } = useSessionDetail();

  // Load last 10 sessions for the picker
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, duration_sec")
        .eq("profile_id", profileId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(10);
      if (cancelled) return;
      const rows = (data ?? []) as SessionLite[];
      setSessions(rows);
      if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id);
      setSessionsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profileId]);

  // Load trials for selected session
  useEffect(() => {
    if (selectedId) {
      setErrorFilter(null);
      fetchTrials(selectedId);
    }
  }, [selectedId, fetchTrials]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) || null,
    [sessions, selectedId]
  );

  // Derived session-level metrics
  const metrics = useMemo(() => {
    const total = trials.length;
    const correct = trials.filter((t) => t.is_correct === true).length;
    const slugs = new Set(trials.map((t) => t.exercise_slug || "").filter(Boolean));
    const cued = trials.filter((t) => !!t.cue_type_given).length;
    const levels = trials
      .map((t) => {
        const tp = t.taskParameters as any;
        return Number(tp?.difficulty ?? tp?.level ?? 0) || 0;
      })
      .filter((n) => n > 0);
    return {
      gamesPlayed: slugs.size,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
      cueDependencyPct: total > 0 ? Math.round((cued / total) * 100) : 0,
      highestLevel: levels.length > 0 ? Math.max(...levels) : null,
    };
  }, [trials]);

  // Trials filtered by selected error category
  const filteredTrials = useMemo(() => {
    if (!errorFilter) return trials;
    return trials.filter((t) => categoryOfTrial(t).includes(errorFilter));
  }, [trials, errorFilter]);

  if (sessionsLoading) {
    return (
      <div className="space-y-3 p-2">
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
        No completed sessions yet for this patient.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-1">
      {/* Session picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Reviewing session:</span>
        <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
          <SelectTrigger className="w-auto min-w-[220px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {new Date(s.started_at).toLocaleDateString(undefined, {
                  weekday: "short", month: "short", day: "numeric",
                })}
                {" · "}
                {new Date(s.started_at).toLocaleTimeString(undefined, {
                  hour: "numeric", minute: "2-digit",
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {trialsLoading || !selectedSession ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {/* 1. Summary */}
          <SessionSummaryStrip
            startedAt={selectedSession.started_at}
            durationSec={selectedSession.duration_sec}
            gamesPlayed={metrics.gamesPlayed}
            accuracyPct={metrics.accuracyPct}
            highestLevel={metrics.highestLevel}
            cueDependencyPct={metrics.cueDependencyPct}
          />

          {/* 2. Voice Evidence */}
          <Section
            title="Voice evidence"
            description="Four curated clips drawn from this session's recordings."
          >
            <VoiceEvidenceGrid trials={trials} />
          </Section>

          {/* 3. Error patterns */}
          <Section
            title="Error pattern breakdown"
            description="Click any bar to filter the trials below."
          >
            <ErrorPatternBreakdown
              trials={trials}
              selected={errorFilter}
              onSelect={setErrorFilter}
            />
          </Section>

          {/* 4. Sounds to watch */}
          <SoundsToWatch trials={trials} />

          {/* 5. Cue response */}
          <Section
            title="Cue response"
            description="What kind of support unlocked correct production."
          >
            <CueResponsePanel trials={trials} profileId={profileId} />
          </Section>

          {/* Filtered trial list (when an error category is selected) */}
          {errorFilter && (
            <Section
              title={`Trials in this category (${filteredTrials.length})`}
            >
              <FilteredTrialList trials={filteredTrials} />
            </Section>
          )}

          {/* 6. Notes */}
          <SessionNotesPanel sessionId={selectedSession.id} profileId={profileId} />
        </>
      )}
    </div>
  );
}

function FilteredTrialList({ trials }: { trials: TrialData[] }) {
  if (trials.length === 0) {
    return <div className="text-xs text-muted-foreground">No trials in this category.</div>;
  }
  return (
    <ul className="space-y-1.5">
      {trials.map((t) => (
        <li
          key={t.attempt_id}
          className="rounded-md border border-border bg-card px-3 py-2 flex items-center gap-2"
        >
          {t.audio_storage_path ? (
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground truncate">
              <span className="font-medium">{t.target_word || "—"}</span>
              <span className="text-muted-foreground"> → </span>
              <span className="italic">{t.transcript || "(no transcript)"}</span>
            </div>
          </div>
          {t.error_type && (
            <span className="text-[10px] text-muted-foreground capitalize shrink-0">
              {t.error_type.replace(/_/g, " ")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
