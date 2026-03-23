/**
 * Runtime Config Inspector — shows raw active config state for clinicians.
 * Displays difficulty overrides, cue level, practice assignments, and
 * distinguishes clinician-driven vs system-driven state.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SlidersHorizontal, ChevronDown, Settings, User, Bot } from "lucide-react";
import { parseRuntimeConfig } from "@/hooks/useRuntimeConfig";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";
import { useState } from "react";

interface RuntimeConfigInspectorProps {
  runtimeConfig: Record<string, any> | null;
  activeOverrides?: ClinicianOverride[];
}

export function RuntimeConfigInspector({ runtimeConfig, activeOverrides = [] }: RuntimeConfigInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const config = parseRuntimeConfig(runtimeConfig);

  // Build a set of keys currently driven by clinician overrides
  const clinicianDrivenKeys = new Set<string>();
  activeOverrides.forEach((o) => {
    if (o.overrideType === "difficulty") clinicianDrivenKeys.add("difficulty");
    if (o.overrideType === "cue_level") clinicianDrivenKeys.add("cue_level");
    if (o.overrideType === "practice_assignment") clinicianDrivenKeys.add("practice");
    if (o.overrideType === "dose_reduction") clinicianDrivenKeys.add("dose");
  });

  const diffEntries = Object.entries(config.difficultyOverrides);
  const activePractice = config.practiceAssignments.filter((a) => a.status === "active");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CardHeader className="pb-2 pt-3">
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold flex-1">
              Runtime Config Inspector
            </CardTitle>
            <Badge variant="outline" className="text-[9px] h-5">
              {diffEntries.length} diff · {activePractice.length} practice · cue {config.cueOverride !== null ? `L${config.cueOverride}` : "auto"}
            </Badge>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pb-3 space-y-3">
            {/* Difficulty Overrides */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3" />
                Difficulty Overrides
                <ProvenanceBadge isClinician={clinicianDrivenKeys.has("difficulty")} />
              </p>
              {diffEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 pl-4">No overrides — using defaults</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pl-4">
                  {diffEntries.map(([key, value]) => (
                    <div key={key} className="rounded bg-muted/40 px-2 py-1 text-xs flex items-center justify-between">
                      <span className="font-mono text-muted-foreground truncate">
                        {key === "_global" ? "global" : key.replace(/-/g, " ")}
                      </span>
                      <span className={`font-bold ${Number(value) > 0 ? "text-green-600" : Number(value) < 0 ? "text-red-500" : "text-foreground"}`}>
                        {Number(value) > 0 ? `+${value}` : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cue Level */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                Cue Level
                <ProvenanceBadge isClinician={clinicianDrivenKeys.has("cue_level")} />
              </p>
              <div className="pl-4 text-xs space-y-0.5">
                <p>
                  <span className="text-muted-foreground">Override:</span>{" "}
                  <span className="font-medium">{config.cueOverride !== null ? `Level ${config.cueOverride}` : "Auto (no override)"}</span>
                </p>
                {config.cueReviewedAt && (
                  <p className="text-muted-foreground/60">
                    Last reviewed: {new Date(config.cueReviewedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
            </div>

            {/* Practice Assignments */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                Practice Assignments ({activePractice.length} active)
                <ProvenanceBadge isClinician={clinicianDrivenKeys.has("practice")} />
              </p>
              {activePractice.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 pl-4">No active assignments</p>
              ) : (
                <div className="space-y-1 pl-4">
                  {activePractice.map((a) => (
                    <div key={a.id} className="rounded bg-muted/40 px-2 py-1 text-xs flex items-center gap-2">
                      <span className="truncate flex-1">{a.notes}</span>
                      <span className="text-muted-foreground/60 shrink-0">
                        {new Date(a.assigned_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Raw JSON (collapsed) */}
            <details className="pl-4">
              <summary className="text-[10px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground">
                Raw JSON
              </summary>
              <pre className="text-[10px] mt-1 p-2 rounded bg-muted/30 overflow-auto max-h-32 text-muted-foreground font-mono">
                {JSON.stringify(config.raw, null, 2)}
              </pre>
            </details>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function ProvenanceBadge({ isClinician }: { isClinician: boolean }) {
  return (
    <Badge variant="outline" className="text-[8px] h-4 gap-0.5">
      {isClinician ? (
        <>
          <User className="w-2 h-2" />
          clinician
        </>
      ) : (
        <>
          <Bot className="w-2 h-2" />
          system
        </>
      )}
    </Badge>
  );
}
