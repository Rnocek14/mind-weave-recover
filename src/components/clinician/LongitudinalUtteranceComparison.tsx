/**
 * Longitudinal Utterance Comparison — same word across time.
 * Side-by-side: date, score, error type, transcript, audio.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GitCompareArrows, TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { AudioPlaybackWithWaveform } from "@/components/AudioPlaybackWithWaveform";
import type { WeeklyRecording } from "@/hooks/useWeeklySessionTimeline";

interface LongitudinalUtteranceComparisonProps {
  currentRecordings: WeeklyRecording[];
  priorRecordings: WeeklyRecording[];
  windowSize: number;
}

interface WordTimeline {
  word: string;
  attempts: {
    date: string;
    score: number | null;
    errorType: string | null;
    transcript: string | null;
    audioPath: string;
    isPrior: boolean;
  }[];
  currentAvg: number | null;
  priorAvg: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "stable" | "new";
}

export function LongitudinalUtteranceComparison({
  currentRecordings,
  priorRecordings,
  windowSize,
}: LongitudinalUtteranceComparisonProps) {
  const [selectedWord, setSelectedWord] = useState<string>("auto");

  const wordTimelines = useMemo(() => {
    const wordMap: Record<string, WordTimeline["attempts"]> = {};

    // Prior period recordings
    priorRecordings.forEach((r) => {
      if (!r.targetWord) return;
      const key = r.targetWord.toLowerCase();
      if (!wordMap[key]) wordMap[key] = [];
      wordMap[key].push({
        date: r.createdAt,
        score: r.score,
        errorType: r.errorType,
        transcript: r.transcript,
        audioPath: r.audioPath,
        isPrior: true,
      });
    });

    // Current period recordings
    currentRecordings.forEach((r) => {
      if (!r.targetWord) return;
      const key = r.targetWord.toLowerCase();
      if (!wordMap[key]) wordMap[key] = [];
      wordMap[key].push({
        date: r.createdAt,
        score: r.score,
        errorType: r.errorType,
        transcript: r.transcript,
        audioPath: r.audioPath,
        isPrior: false,
      });
    });

    // Build timelines for words that appear in BOTH periods
    const timelines: WordTimeline[] = [];
    Object.entries(wordMap).forEach(([word, attempts]) => {
      const priorAttempts = attempts.filter((a) => a.isPrior);
      const currentAttempts = attempts.filter((a) => !a.isPrior);

      const avg = (arr: typeof attempts) => {
        const scored = arr.filter((a) => a.score !== null);
        return scored.length > 0
          ? Math.round(scored.reduce((s, a) => s + a.score!, 0) / scored.length)
          : null;
      };

      const priorAvg = avg(priorAttempts);
      const currentAvg = avg(currentAttempts);
      const hasBoth = priorAttempts.length > 0 && currentAttempts.length > 0;

      let direction: WordTimeline["direction"] = "new";
      let delta: number | null = null;
      if (hasBoth && priorAvg !== null && currentAvg !== null) {
        delta = currentAvg - priorAvg;
        direction = delta > 10 ? "improved" : delta < -10 ? "declined" : "stable";
      }

      // Sort attempts by date
      attempts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      timelines.push({
        word,
        attempts,
        currentAvg,
        priorAvg,
        delta,
        direction,
      });
    });

    // Sort: declined first, then improved, then stable, then new
    const dirOrder = { declined: 0, improved: 1, stable: 2, new: 3 };
    timelines.sort((a, b) => dirOrder[a.direction] - dirOrder[b.direction]);

    return timelines;
  }, [currentRecordings, priorRecordings]);

  // Words with cross-period data
  const crossPeriodWords = wordTimelines.filter((w) => w.direction !== "new");

  if (crossPeriodWords.length === 0 && wordTimelines.length === 0) return null;

  const displayWords = selectedWord === "auto"
    ? crossPeriodWords.slice(0, 5)
    : wordTimelines.filter((w) => w.word === selectedWord);

  const directionIcon = (d: WordTimeline["direction"]) => {
    switch (d) {
      case "improved": return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
      case "declined": return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
      case "stable": return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
      default: return null;
    }
  };

  const directionColor = (d: WordTimeline["direction"]) => {
    switch (d) {
      case "improved": return "text-green-600 dark:text-green-400";
      case "declined": return "text-red-500";
      case "stable": return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            Utterance Comparison
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  <p>
                    Tracks the same target words across this period and the prior period.
                    Shows whether the patient is improving, declining, or stable on specific
                    words — with side-by-side audio for direct comparison. Words showing
                    regression are surfaced first to prioritize clinical attention.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          {wordTimelines.length > 5 && (
            <Select value={selectedWord} onValueChange={setSelectedWord}>
              <SelectTrigger className="w-36 h-7 text-xs">
                <SelectValue placeholder="Auto (top 5)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (top 5)</SelectItem>
                {wordTimelines.map((w) => (
                  <SelectItem key={w.word} value={w.word}>
                    {w.word} {w.delta !== null ? `(${w.delta > 0 ? "+" : ""}${w.delta}%)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        {crossPeriodWords.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            No words with recordings in both current and prior periods yet. 
            Cross-period comparison will appear as more data accumulates.
          </p>
        )}

        {displayWords.map((wt) => (
          <div key={wt.word} className="rounded-lg border p-3 space-y-2">
            {/* Word header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {directionIcon(wt.direction)}
                <span className="font-medium text-sm capitalize">{wt.word}</span>
                <Badge variant="outline" className="text-xs h-4">
                  {wt.attempts.length} attempt{wt.attempts.length > 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {wt.priorAvg !== null && (
                  <span className="text-muted-foreground">
                    Prior: <span className="font-medium">{wt.priorAvg}%</span>
                  </span>
                )}
                {wt.currentAvg !== null && (
                  <span>
                    Current: <span className="font-semibold">{wt.currentAvg}%</span>
                  </span>
                )}
                {wt.delta !== null && (
                  <span className={`font-semibold ${directionColor(wt.direction)}`}>
                    {wt.delta > 0 ? "+" : ""}{wt.delta}%
                  </span>
                )}
              </div>
            </div>

            {/* Timeline of attempts */}
            <div className="space-y-1.5">
              {wt.attempts.slice(-6).map((attempt, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2 rounded text-xs ${
                    attempt.isPrior ? "bg-muted/20" : "bg-primary/5"
                  }`}
                >
                  <Badge
                    variant={attempt.isPrior ? "outline" : "secondary"}
                    className="text-xs h-4 w-14 justify-center shrink-0"
                  >
                    {attempt.isPrior ? "Prior" : "Current"}
                  </Badge>
                  <span className="text-muted-foreground w-20 shrink-0">
                    {new Date(attempt.date).toLocaleDateString(undefined, {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  {attempt.score !== null && (
                    <span className={`font-semibold w-10 shrink-0 ${
                      attempt.score >= 80 ? "text-green-600" :
                      attempt.score >= 50 ? "text-amber-600" : "text-red-500"
                    }`}>
                      {attempt.score}%
                    </span>
                  )}
                  {attempt.errorType && (
                    <Badge variant="outline" className="text-xs h-4 shrink-0">
                      {attempt.errorType.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {attempt.transcript && (
                    <span className="text-muted-foreground truncate">"{attempt.transcript}"</span>
                  )}
                  <div className="shrink-0 ml-auto">
                    <AudioPlaybackWithWaveform storagePath={attempt.audioPath} showWaveform={false} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
