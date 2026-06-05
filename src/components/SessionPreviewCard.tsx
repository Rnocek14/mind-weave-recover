/**
 * Pre-Session Preview Card
 * 
 * Shows the user what today's session will focus on before it begins.
 * In light/full coaching modes, adds purpose text connecting exercises to real goals.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { humanizeSlug } from "@/lib/performanceAwareFeedback";
import type { DailyLesson, ExerciseBlock } from "@/lib/dailyLessonEngine";
import { Sparkles, Clock, Target } from "lucide-react";
import { useState } from "react";
import { useCoachingMode } from "@/contexts/CoachingModeContext";
import { getExercisePurpose } from "@/lib/exercisePurposeMap";
import { getContinuityOpener } from "@/lib/coachingNarrative";
import { MessageCircle } from "lucide-react";
import { useUiProfile } from "@/hooks/useUiProfile";
import { variantClass, isSimplified, isMinimal } from "@/lib/ui/variantClass";

interface SessionPreviewCardProps {
  lesson: DailyLesson;
  displayName?: string;
  onStart: () => void;
}

function getPhaseLabel(priority: ExerciseBlock['priority']): string {
  switch (priority) {
    case 'warmup': return 'Warm-up';
    case 'primary': return 'Core work';
    case 'secondary': return 'Stretch';
    case 'consolidation': return 'Cool-down';
    default: return 'Exercise';
  }
}

function getSessionGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const SessionPreviewCard = ({ lesson, displayName, onStart }: SessionPreviewCardProps) => {
  const greeting = getSessionGreeting();
  const name = displayName || "there";
  const { showPurpose, showContinuity, mode } = useCoachingMode();
  const { profile: uiProfile } = useUiProfile();
  const variant = uiProfile.variant;
  const simplified = isSimplified(variant);
  const minimal = isMinimal(variant);
  const isNonFluent = variant === "simplified-non-fluent";
  const isNeglect = variant === "simplified-neglect";

  // Continuity opener for Full mode — suppressed in simplified/minimal (reading-load cap)
  const [continuityLine] = useState(() =>
    showContinuity && !simplified ? getContinuityOpener(lesson.targetDomains?.[0]) : null
  );

  // Deduplicate target domains for display
  const focusAreas = [...new Set(lesson.targetDomains)].slice(0, 3).map(humanizeSlug);

  // Build a simple session outline from blocks
  const outline = lesson.blocks.map((block) => ({
    name: humanizeSlug(block.exerciseId),
    phase: getPhaseLabel(block.priority),
    duration: block.duration,
    purpose: showPurpose ? getExercisePurpose(block.exerciseId) : null,
  }));

  const energyLabel = lesson.energyLevel === 'light' ? 'Light session'
    : lesson.energyLevel === 'challenging' ? 'Challenge session'
    : 'Balanced session';

  // Derive a session-level purpose from the primary domain
  const primaryDomain = lesson.targetDomains?.[0];
  const sessionPurpose = showPurpose && primaryDomain
    ? getSessionPurposeText(primaryDomain)
    : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Greeting */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">
            {greeting}, {name} 👋
          </h1>
          <p className="text-muted-foreground">Here's your session for today</p>
        </div>

        {/* Continuity opener — Full coaching mode only */}
        {continuityLine && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground leading-relaxed italic">
                "{continuityLine}"
              </p>
            </div>
          </div>
        )}

        {/* Focus areas — only in light/full coaching modes */}
        {showPurpose && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Target className="w-4 h-4" />
              Today's focus
            </div>
            <div className="flex flex-wrap gap-2">
              {focusAreas.map((area) => (
                <span
                  key={area}
                  className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  {area}
                </span>
              ))}
            </div>
            {sessionPurpose && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {sessionPurpose}
              </p>
            )}
          </div>
        )}

        {/* Session outline */}
        <div className="space-y-2">
          {outline.map((item, i) => (
            <div key={i} className="py-2 px-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-medium w-16">
                    {item.phase}
                  </span>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.duration}m</span>
              </div>
              {item.purpose && (
                <p className="text-xs text-muted-foreground mt-1 ml-[76px]">
                  {item.purpose}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Session meta */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            ~{lesson.totalDuration} min
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {energyLabel}
          </div>
        </div>

        {/* Start button */}
        <Button
          size="lg"
          className="w-full text-lg py-6"
          onClick={onStart}
        >
          Let's begin
        </Button>
      </Card>
    </div>
  );
};

/** Map domain slug to a short, purposeful session-level sentence */
function getSessionPurposeText(domain: string): string | null {
  const map: Record<string, string> = {
    lexical_retrieval: "Building faster word finding for everyday conversation.",
    semantic_depth: "Strengthening word meaning and connections.",
    semantic: "Strengthening word meaning and connections.",
    phonology: "Sharpening sound awareness for clearer speech.",
    phonological: "Sharpening sound awareness for clearer speech.",
    syntax: "Practicing sentence building for smoother communication.",
    discourse: "Working on connected speech and storytelling.",
    comprehension: "Improving understanding of spoken language.",
    executive_function: "Practicing flexible thinking and planning.",
    attention: "Building focused attention for daily tasks.",
  };
  return map[domain] || null;
}
