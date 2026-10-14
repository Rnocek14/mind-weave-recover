/**
 * Session Review Tab - picks one session and presents focused
 * recording-level evidence for clinical analysis.
 * Only the selected session loads its trial detail (lazy).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSessionDetail, type TrialData } from "@/hooks/useSessionDetail";
import { hasDeliveredCue, isScoredClinicalEvidence } from "@/lib/clinical/scoredEvidence";
import { SessionSummaryStrip } from "./review/SessionSummaryStrip";
import { VoiceEvidenceGrid } from "./review/VoiceEvidenceGrid";
import { ErrorPatternBreakdown, categoryOfTrial } from "./review/ErrorPatternBreakdown";
import { SoundsToWatch } from "./review/SoundsToWatch";
import { CueResponsePanel } from "./review/CueResponsePanel";
import { SessionNotesPanel } from "./review/SessionNotesPanel";
import { AcrossTimeView } from "./review/AcrossTimeView";
import { ExcludedClipsAudit } from "./review/ExcludedClipsAudit";
import { AxisEvidencePanel } from "./review/AxisEvidencePanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Volume2, VolumeX } from "lucide-react";

interface SessionReviewTabProps {
  profileId: string | undefined;
}

interface SessionLite {
  id: string;
  started_at: string;
  duration_sec: number | null;
}

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function SessionReviewTab({ profileId }: SessionReviewTabProps) {
  // Reset selection, evidence, filters and child audio state together, before
  // any render can display the old patient's recordings under the new ID.
  return <ProfileSessionReview key={profileId ?? 'no-profile'} profileId={profileId} />;
}

function ProfileSessionReview({ profileId }: SessionReviewTabProps) {
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorFilter, setErrorFilter] = useState<string | null>(null);
  const { trials, loading: trialsLoading, loadedSessionId, fetchTrials } = useSessionDetail();

  useEffect(() => {
    if (!profileId) {
      setSessions([]);
      setSelectedId(null);
      setSessionsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      setSessionsError(false);
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("id, started_at, duration_sec")
          .eq("profile_id", profileId)
          .not("ended_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(10);
        if (cancelled) return;
        if (error) throw error;
        const rows = (data ?? []) as SessionLite[];
        setSessions(rows);
        setSelectedId((current) => rows.some((row) => row.id === current)
          ? current : rows[0]?.id ?? null);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading review sessions:", error);
        setSessions([]);
        setSelectedId(null);
        setSessionsError(true);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileId, reload]);

  useEffect(() => {
    if (selectedId) {
      setErrorFilter(null);
      void fetchTrials(selectedId);
    }
  }, [selectedId, fetchTrials]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) || null,
    [sessions, selectedId]
  );

  const metrics = useMemo(() => {
    const scored = trials.filter(isScoredClinicalEvidence);
    const total = scored.length;
    const correct = scored.filter((t) => t.is_correct === true).length;
    const slugs = new Set(scored.map((t) => t.exercise_slug || "").filter(Boolean));
    const cued = scored.filter((t) => hasDeliveredCue(t.cue_type_given)).length;
    const levels = scored
      .map((t) => {
        const tp = t.taskParameters as any;
        return Number(tp?.difficulty ?? tp?.level ?? 0) || 0;
      })
      .filter((n) => n > 0);

    const buckets = { valid: 0, filler: 0, silence: 0, noise: 0, flagged: 0 };
    for (const t of trials) {
      if (isScoredClinicalEvidence(t)) { buckets.valid += 1; continue; }
      const label = t.clinician_validity_override || t.validity_label || "";
      switch (label) {
        case "filler":
        case "filler_only": buckets.filler += 1; break;
        case "no_response": buckets.silence += 1; break;
        case "noise":
        case "background_noise": buckets.noise += 1; break;
        case "low_confidence":
        case "not_patient": buckets.flagged += 1; break;
        default: buckets.flagged += 1; break;
      }
    }
    return {
      gamesPlayed: slugs.size,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
      cueDependencyPct: total > 0 ? Math.round((cued / total) * 100) : 0,
      highestLevel: levels.length > 0 ? Math.max(...levels) : null,
      validityBuckets: buckets,
    };
  }, [trials]);

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
  if (sessionsError) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-6 text-sm">
        <p>Session history could not be loaded. No patient results are shown.</p>
        <Button variant="outline" onClick={() => setReload((value) => value + 1)}>Retry</Button>
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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Reviewing session:</span>
        <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
          <SelectTrigger className="w-auto min-w-[220px] h-9"><SelectValue /></SelectTrigger>
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
      ) : loadedSessionId !== selectedId ? (
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          <p>Evidence for this session is not loaded. No previous session results are shown.</p>
          <Button variant="outline" onClick={() => selectedId && void fetchTrials(selectedId)}>Retry</Button>
        </div>
      ) : (
        <>
          <SessionSummaryStrip
            startedAt={selectedSession.started_at}
            durationSec={selectedSession.duration_sec}
            gamesPlayed={metrics.gamesPlayed}
            accuracyPct={metrics.accuracyPct}
            highestLevel={metrics.highestLevel}
            cueDependencyPct={metrics.cueDependencyPct}
            validityBuckets={metrics.validityBuckets}
          />
          <Section title="Voice evidence" description="Curated clips from this session, or hear the same target across time.">
            <Tabs defaultValue="session" className="w-full">
              <TabsList className="h-9">
                <TabsTrigger value="session" className="text-xs">This session</TabsTrigger>
                <TabsTrigger value="across" className="text-xs">Across time</TabsTrigger>
              </TabsList>
              <TabsContent value="session" className="mt-3 space-y-3">
                <VoiceEvidenceGrid trials={trials} />
                <ExcludedClipsAudit
                  trials={trials}
                  sessionId={selectedId}
                  profileId={profileId}
                  onOverridden={() => selectedId && fetchTrials(selectedId)}
                />
              </TabsContent>
              <TabsContent value="across" className="mt-3">
                <AcrossTimeView currentSessionTrials={trials} profileId={profileId} />
              </TabsContent>
            </Tabs>
          </Section>
          <Section title="Error pattern breakdown" description="Click any bar to filter the trials below.">
            <ErrorPatternBreakdown trials={trials} selected={errorFilter} onSelect={setErrorFilter} />
          </Section>
          <Section
            title="What happened on each attempt"
            description="Plain-language verdicts with the evidence behind them - word retrieval, communication success, and independence per attempt."
          >
            <AxisEvidencePanel trials={trials} />
          </Section>
          <SoundsToWatch trials={trials} />
          <Section title="Cue response" description="What kind of support unlocked correct production.">
            <CueResponsePanel trials={trials} profileId={profileId} />
          </Section>
          {errorFilter && (
            <Section title={`Trials in this category (${filteredTrials.length})`}>
              <FilteredTrialList trials={filteredTrials} />
            </Section>
          )}
          <SessionNotesPanel sessionId={selectedSession.id} profileId={profileId} />
        </>
      )}
    </div>
  );
}

function FilteredTrialList({ trials }: { trials: TrialData[] }) {
  if (trials.length === 0) return <div className="text-xs text-muted-foreground">No trials in this category.</div>;
  return (
    <ul className="space-y-1.5">
      {trials.map((t) => (
        <li key={t.attempt_id} className="rounded-md border border-border bg-card px-3 py-2 flex items-center gap-2">
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
            <span className="text-[10px] text-muted-foreground capitalize shrink-0">{t.error_type.replace(/_/g, " ")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
