/**
 * Surfaces the top 3 most clinically important recordings.
 * Ranking logic: error diversity > low scores > regressions > improvements.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, Star, AlertTriangle, TrendingDown, HelpCircle } from "lucide-react";
import { AudioPlaybackWithWaveform } from "@/components/AudioPlaybackWithWaveform";
import type { AudioSample } from "@/hooks/useCuratedAudioSamples";
import type { WeeklyRecording } from "@/hooks/useWeeklySessionTimeline";

interface ClinicalRecordingPicksProps {
  curatedChallenging: AudioSample[];
  curatedBest: AudioSample[];
  allRecordings: WeeklyRecording[];
}

interface RankedRecording {
  id: string;
  targetWord: string;
  transcript: string | null;
  score: number | null;
  audioPath: string;
  errorType: string | null;
  timestamp: string;
  reason: string;
  reasonIcon: "error" | "regression" | "improvement";
  clinicalPriority: number; // higher = more important
}

export function ClinicalRecordingPicks({
  curatedChallenging,
  curatedBest,
  allRecordings,
}: ClinicalRecordingPicksProps) {
  const picks = useMemo(() => {
    const ranked: RankedRecording[] = [];

    // 1. Challenging samples get high priority (errors to review)
    curatedChallenging.forEach((s, i) => {
      ranked.push({
        id: s.id,
        targetWord: s.targetWord,
        transcript: s.transcript,
        score: s.score,
        audioPath: s.audioPath,
        errorType: s.errorType,
        timestamp: s.timestamp,
        reason: s.errorType
          ? `${s.errorType.replace(/_/g, " ")} error — lowest scores this period`
          : `Low pronunciation score (${s.score}%) — needs clinical review`,
        reasonIcon: "error",
        clinicalPriority: 100 - i, // top challenging = highest priority
      });
    });

    // 2. Look for regression patterns in all recordings
    const wordScores: Record<string, { scores: number[]; recordings: WeeklyRecording[] }> = {};
    allRecordings.forEach((r) => {
      if (r.targetWord && r.score !== null) {
        if (!wordScores[r.targetWord]) wordScores[r.targetWord] = { scores: [], recordings: [] };
        wordScores[r.targetWord].scores.push(r.score);
        wordScores[r.targetWord].recordings.push(r);
      }
    });

    // Words where latest attempt is worse than earlier attempts
    Object.entries(wordScores).forEach(([word, data]) => {
      if (data.scores.length >= 2) {
        const earliest = data.scores[0];
        const latest = data.scores[data.scores.length - 1];
        if (latest < earliest && (earliest - latest) >= 20) {
          const latestRec = data.recordings[data.recordings.length - 1];
          if (!ranked.find((r) => r.id === latestRec.attemptId)) {
            ranked.push({
              id: latestRec.attemptId,
              targetWord: word,
              transcript: latestRec.transcript,
              score: latest,
              audioPath: latestRec.audioPath,
              errorType: latestRec.errorType,
              timestamp: latestRec.createdAt,
              reason: `Regression on "${word}" — dropped from ${earliest}% to ${latest}%`,
              reasonIcon: "regression",
              clinicalPriority: 80,
            });
          }
        }
      }
    });

    // 3. Best samples as positive evidence
    curatedBest.forEach((s, i) => {
      if (!ranked.find((r) => r.id === s.id)) {
        ranked.push({
          id: s.id,
          targetWord: s.targetWord,
          transcript: s.transcript,
          score: s.score,
          audioPath: s.audioPath,
          errorType: null,
          timestamp: s.timestamp,
          reason: `Strong performance (${s.score}%) — positive progress evidence`,
          reasonIcon: "improvement",
          clinicalPriority: 50 - i,
        });
      }
    });

    // Sort by priority, take top 3
    ranked.sort((a, b) => b.clinicalPriority - a.clinicalPriority);
    return ranked.slice(0, 3);
  }, [curatedChallenging, curatedBest, allRecordings]);

  if (picks.length === 0) return null;

  const iconMap = {
    error: AlertTriangle,
    regression: TrendingDown,
    improvement: Star,
  };

  const colorMap = {
    error: "text-red-500",
    regression: "text-amber-500",
    improvement: "text-green-500",
  };

  const bgMap = {
    error: "bg-red-500/5 border-red-200/30",
    regression: "bg-amber-500/5 border-amber-200/30",
    improvement: "bg-green-500/5 border-green-200/30",
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          Top Recordings to Review
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p>
                  These are the 3 most clinically relevant recordings from this period,
                  ranked by: (1) error patterns needing review, (2) words showing regression
                  compared to earlier attempts, (3) strong performances as positive evidence.
                  Each recording includes an explanation of why it was surfaced.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-2">
        {picks.map((pick) => {
          const Icon = iconMap[pick.reasonIcon];
          return (
            <div key={pick.id} className={`p-3 rounded-lg border ${bgMap[pick.reasonIcon]}`}>
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 shrink-0 ${colorMap[pick.reasonIcon]}`} />
                  <div>
                    <span className="font-medium text-sm capitalize">{pick.targetWord}</span>
                    {pick.transcript && (
                      <span className="text-xs text-muted-foreground ml-2">"{pick.transcript}"</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pick.errorType && (
                    <Badge variant="outline" className="text-xs h-5">
                      {pick.errorType.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {pick.score !== null && (
                    <span className={`text-sm font-semibold ${
                      pick.score >= 80 ? "text-green-600" : pick.score >= 50 ? "text-amber-600" : "text-red-500"
                    }`}>
                      {pick.score}%
                    </span>
                  )}
                </div>
              </div>

              {/* Clinical reason */}
              <p className="text-[11px] text-muted-foreground mb-2 pl-6">{pick.reason}</p>

              <div className="pl-6">
                <AudioPlaybackWithWaveform storagePath={pick.audioPath} showWaveform={false} />
              </div>

              <p className="text-xs text-muted-foreground mt-1 pl-6">
                {new Date(pick.timestamp).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
