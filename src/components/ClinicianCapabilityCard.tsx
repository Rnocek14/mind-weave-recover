import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, ArrowDownRight, Minus, Activity } from "lucide-react";

import { useCapabilityAssessment } from "@/hooks/useCapabilityAssessment";
import { useCapabilityProgression } from "@/hooks/useCapabilityProgression";
import { predictExpectedCapabilities, type ClinicalProfile } from "@/lib/clinicalProfileMapper";

type Trend = "up" | "down" | "stable";

interface ClinicianCapabilityCardProps {
  userId: string;
  profileId: string;
  clinicalProfile: ClinicalProfile | null;
}

interface DomainRow {
  label: string;
  key: "vision" | "motor" | "attention";
  predictedMin: number;
  predictedMax: number;
  predicted: number;
  measured: number | null;
  status: "below" | "within" | "above" | "no-data";
  gap: number | null;
  trend: Trend;
}

export const ClinicianCapabilityCard: React.FC<ClinicianCapabilityCardProps> = ({
  userId,
  profileId,
  clinicalProfile,
}) => {
  const { currentAssessment } = useCapabilityAssessment(userId, profileId);
  const { getTrend, hasMultipleAssessments } = useCapabilityProgression(userId);

  if (!currentAssessment) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Capability vs Expected Profile</CardTitle>
          <CardDescription>
            No capability assessment completed yet. Run the baseline assessment to compare
            behavioral performance with imaging & clinical expectations.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const expected = predictExpectedCapabilities(clinicalProfile || null);

  const makeRow = (label: string, key: "vision" | "motor" | "attention"): DomainRow => {
    const predictedDomain = expected[key];
    const measured = (currentAssessment as any)[`${key}_score`] as number | null ?? null;

    let status: DomainRow["status"] = "no-data";
    let gap: number | null = null;

    if (typeof measured === "number") {
      gap = measured - predictedDomain.predicted;

      if (measured < predictedDomain.min) {
        status = "below";
      } else if (measured > predictedDomain.max) {
        status = "above";
      } else {
        status = "within";
      }
    }

    const trend = hasMultipleAssessments ? getTrend(key) : "stable";

    return {
      label,
      key,
      predictedMin: predictedDomain.min,
      predictedMax: predictedDomain.max,
      predicted: predictedDomain.predicted,
      measured,
      status,
      gap,
      trend,
    };
  };

  const rows: DomainRow[] = [
    makeRow("Vision", "vision"),
    makeRow("Motor Control", "motor"),
    makeRow("Attention", "attention"),
  ];

  const assessedDate = currentAssessment.assessed_at
    ? new Date(currentAssessment.assessed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown date";

  const confidencePct = currentAssessment.confidence_score
    ? Math.round(currentAssessment.confidence_score * 100)
    : null;

  const overallStatus = getOverallStatus(rows);
  const overallSummary = getOverallSummary(rows);

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Capability vs Expected Profile
          </CardTitle>
          {overallStatus && (
            <Badge
              variant={
                overallStatus === "better"
                  ? "default"
                  : overallStatus === "worse"
                  ? "destructive"
                  : "outline"
              }
              className="text-xs"
            >
              {overallStatus === "better" && "Above expected"}
              {overallStatus === "worse" && "Below expected"}
              {overallStatus === "mixed" && "Mixed vs expected"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Last assessed {assessedDate}
          {confidencePct !== null && ` • Assessment confidence ${confidencePct}%`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="flex flex-col gap-1 rounded-md border bg-card/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{row.label}</span>
                  {renderTrendBadge(row.trend)}
                </div>
                {renderStatusBadge(row.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <div className="text-[11px] uppercase tracking-wide">Expected (imaging/clinical)</div>
                  <div>
                    {row.predictedMin}–{row.predictedMax} / 10{" "}
                    <span className="text-[11px]">(≈{row.predicted})</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide">Measured (behavioral)</div>
                  <div>
                    {row.measured !== null ? `${row.measured}/10` : "No data"}
                    {row.gap !== null && (
                      <span className="ml-2 text-[11px]">
                        {row.gap > 0 && `(+${row.gap} vs expected)`}
                        {row.gap < 0 && `(${row.gap} vs expected)`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground block mb-1">Clinical Interpretation</span>
          {overallSummary}
        </div>

        {expected.reasoning?.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Imaging & Clinical Reasoning
            </div>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              {expected.reasoning.slice(0, 3).map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
              {expected.reasoning.length > 3 && (
                <li>+ {expected.reasoning.length - 3} more factors</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function renderTrendBadge(trend: Trend) {
  if (trend === "up") {
    return (
      <Badge variant="outline" className="text-[11px] gap-1">
        <ArrowUpRight className="w-3 h-3" />
        Improving
      </Badge>
    );
  }
  if (trend === "down") {
    return (
      <Badge variant="outline" className="text-[11px] gap-1">
        <ArrowDownRight className="w-3 h-3" />
        Declining
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[11px] gap-1">
      <Minus className="w-3 h-3" />
      Stable
    </Badge>
  );
}

function renderStatusBadge(status: DomainRow["status"]) {
  if (status === "below") {
    return (
      <Badge variant="destructive" className="text-[11px]">
        Below expected
      </Badge>
    );
  }
  if (status === "above") {
    return (
      <Badge variant="default" className="text-[11px]">
        Above expected
      </Badge>
    );
  }
  if (status === "within") {
    return (
      <Badge variant="outline" className="text-[11px]">
        Within expected range
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[11px]">
      No expected data
    </Badge>
  );
}

function getOverallStatus(rows: DomainRow[]): "better" | "worse" | "mixed" | null {
  const withData = rows.filter((r) => r.status !== "no-data");
  if (withData.length === 0) return null;

  const below = withData.filter((r) => r.status === "below").length;
  const above = withData.filter((r) => r.status === "above").length;

  if (below > 0 && above === 0) return "worse";
  if (above > 0 && below === 0) return "better";
  if (above > 0 && below > 0) return "mixed";
  return null;
}

function getOverallSummary(rows: DomainRow[]): string {
  const withData = rows.filter((r) => r.status !== "no-data");
  if (withData.length === 0) {
    return "Behavioral capabilities have not yet been assessed against imaging/clinical expectations.";
  }

  const below = withData.filter((r) => r.status === "below");
  const above = withData.filter((r) => r.status === "above");

  if (below.length === 0 && above.length === 0) {
    return "Measured capabilities are broadly consistent with what would be expected from the documented stroke pattern and clinical profile.";
  }

  if (below.length > 0 && above.length === 0) {
    const domains = below.map((r) => r.label.toLowerCase()).join(", ");
    return `Measured ${domains} performance is lower than expected from the imaging profile. Consider fatigue, mood, engagement, or unrecognized cognitive factors when interpreting these scores.`;
  }

  if (above.length > 0 && below.length === 0) {
    const domains = above.map((r) => r.label.toLowerCase()).join(", ");
    return `Measured ${domains} performance is better than expected from the imaging profile, which is encouraging and may reflect strong compensatory strategies or recovery.`;
  }

  return "Capabilities show a mixed pattern relative to imaging expectations, with some domains performing above and others below the predicted range. Review domain-level details and serial trends over time.";
}
