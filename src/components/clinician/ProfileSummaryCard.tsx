/**
 * Compact Profile Summary card — shows primary deficits, therapy focus,
 * cueing strategy, and personalization rules active for this patient.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { User, Brain, Target, Lightbulb, HelpCircle, Shield } from "lucide-react";

interface ProfileSummaryCardProps {
  clinicalProfile: Record<string, any> | null;
  strokeDate: string | null;
  daysPostOnset: number | null;
  profileName: string;
  speechLabel: string | null;
}

export function ProfileSummaryCard({
  clinicalProfile,
  strokeDate,
  daysPostOnset,
  profileName,
  speechLabel,
}: ProfileSummaryCardProps) {
  const cp = clinicalProfile;

  const speechImpairments: string[] = cp?.impairments?.speech || [];
  const cognitiveImpairments: string[] = cp?.impairments?.cognitive || [];
  const motorImpairments: string[] = cp?.impairments?.motor || [];
  const visualImpairments: string[] = cp?.impairments?.visual || [];
  const therapyFocus: string[] = cp?.therapy_focus || [];
  const affectedSide: string | null = cp?.affected_side || null;
  const strokeLocation: string | null = cp?.stroke_location || null;
  const severity = cp?.severity || {};
  const profileSource: string = cp?.profile_source || "manual";

  const allImpairments = [
    ...speechImpairments.map((i) => ({ domain: "Speech", label: formatImpairment(i) })),
    ...cognitiveImpairments.map((i) => ({ domain: "Cognitive", label: formatImpairment(i) })),
    ...motorImpairments.map((i) => ({ domain: "Motor", label: formatImpairment(i) })),
    ...visualImpairments.map((i) => ({ domain: "Visual", label: formatImpairment(i) })),
  ];

  const hasData = allImpairments.length > 0 || therapyFocus.length > 0 || strokeLocation;

  if (!hasData) {
    return (
      <Card className="border-dashed border-muted-foreground/20">
        <CardContent className="py-4 text-center">
          <p className="text-xs text-muted-foreground">
            No clinical profile data available. Upload clinical notes or manually enter the patient's
            profile to see deficits, therapy focus, and personalization rules here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Patient Profile Summary
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p>
                  Clinical profile driving therapy personalization. Shows primary deficits
                  (from uploaded clinical notes or manual entry), current therapy focus areas,
                  and active personalization settings. This profile shapes exercise selection,
                  difficulty progression, and cueing strategy.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="outline" className="text-[9px] h-4 ml-auto">
            {profileSource === "clinical_note" ? "From Notes" : "Manual"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Stroke Info */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Brain className="w-3 h-3" />
              Stroke Details
            </div>
            <div className="space-y-0.5 text-xs pl-4">
              {strokeLocation && (
                <p><span className="text-muted-foreground">Location:</span> <span className="font-medium">{formatImpairment(strokeLocation)}</span></p>
              )}
              {affectedSide && (
                <p><span className="text-muted-foreground">Affected side:</span> <span className="font-medium capitalize">{affectedSide}</span></p>
              )}
              {daysPostOnset !== null && (
                <p><span className="text-muted-foreground">Time since stroke:</span> <span className="font-medium">{daysPostOnset}d ({Math.round(daysPostOnset / 30)}mo)</span></p>
              )}
              {speechLabel && (
                <p><span className="text-muted-foreground">Primary dx:</span> <span className="font-medium">{speechLabel}</span></p>
              )}
            </div>
          </div>

          {/* Primary Deficits */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Shield className="w-3 h-3" />
              Primary Deficits
            </div>
            <div className="flex flex-wrap gap-1 pl-4">
              {allImpairments.length > 0 ? (
                allImpairments.slice(0, 8).map((imp, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] h-5">
                    <span className="text-muted-foreground mr-1">{imp.domain}:</span>
                    {imp.label}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">None documented</span>
              )}
              {allImpairments.length > 8 && (
                <Badge variant="secondary" className="text-[9px] h-5">
                  +{allImpairments.length - 8} more
                </Badge>
              )}
            </div>
          </div>

          {/* Therapy Focus */}
          {therapyFocus.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Target className="w-3 h-3" />
                Therapy Focus
              </div>
              <div className="flex flex-wrap gap-1 pl-4">
                {therapyFocus.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] h-5">
                    {formatImpairment(f)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Severity if available */}
          {Object.keys(severity).length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lightbulb className="w-3 h-3" />
                Severity Ratings
              </div>
              <div className="space-y-0.5 text-xs pl-4">
                {Object.entries(severity).map(([key, value]) => (
                  <p key={key}>
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                    <span className="font-medium capitalize">{String(value)}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatImpairment(s: unknown): string {
  const str = typeof s === 'string' ? s : String(s ?? '');
  return str.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
