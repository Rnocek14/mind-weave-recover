import { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface AlertEvidenceBlockProps {
  alertType: string;
  triggerData: Record<string, unknown>;
}

const EVIDENCE_RENDERERS: Record<string, (data: Record<string, unknown>) => React.ReactNode> = {
  deconditioning_risk: (data) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      <dt className="font-medium">Inactive days:</dt>
      <dd>{String(data.inactive_phys_days ?? "—")}/7</dd>
      <dt className="font-medium">Physical coverage:</dt>
      <dd>{String(data.coverage_days ?? "—")}/7 days with device data</dd>
      <dt className="font-medium">Thresholds:</dt>
      <dd>activeMin &lt; {String(data.threshold_active_minutes ?? 10)}, steps &lt; {String(data.threshold_steps ?? 2500)}</dd>
    </dl>
  ),
  overexertion_risk: (data) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      <dt className="font-medium">Activity (last 3d):</dt>
      <dd>{String(data.avg_phys_last3 ?? "—")} min</dd>
      <dt className="font-medium">Activity (prior 4d):</dt>
      <dd>{String(data.avg_phys_prev4 ?? "—")} min</dd>
      <dt className="font-medium">Spike:</dt>
      <dd>
        {data.avg_phys_prev4 && Number(data.avg_phys_prev4) > 0
          ? `${Math.round((Number(data.avg_phys_last3) / Number(data.avg_phys_prev4) - 1) * 100)}%`
          : "—"}
      </dd>
      <dt className="font-medium">Fatigue (last 3d):</dt>
      <dd>{data.avg_fatigue_last3 != null ? `${Number(data.avg_fatigue_last3).toFixed(1)}/5` : "insufficient data"}</dd>
      <dt className="font-medium">Fatigue (prior 4d):</dt>
      <dd>{data.avg_fatigue_prev4 != null ? `${Number(data.avg_fatigue_prev4).toFixed(1)}/5` : "insufficient data"}</dd>
      <dt className="font-medium">Dose (last 3d):</dt>
      <dd>{String(data.avg_dose_last3 ?? "—")} min</dd>
      <dt className="font-medium">Dose (prior 4d):</dt>
      <dd>{String(data.avg_dose_prev4 ?? "—")} min</dd>
    </dl>
  ),
  engagement_failure: (data) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      <dt className="font-medium">Gap length:</dt>
      <dd>{String(data.streak_days ?? "—")} days</dd>
      <dt className="font-medium">Gap start:</dt>
      <dd>{String(data.gap_start ?? "—")}</dd>
      <dt className="font-medium">Gap end:</dt>
      <dd>{String(data.gap_end ?? "—")}</dd>
    </dl>
  ),
  fatigue_risk: (data) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      <dt className="font-medium">High fatigue days:</dt>
      <dd>{String(data.high_fatigue_days ?? "—")}/7</dd>
      <dt className="font-medium">Avg fatigue:</dt>
      <dd>{data.avg_fatigue != null ? `${Number(data.avg_fatigue).toFixed(1)}/5` : "—"}</dd>
      <dt className="font-medium">Dose drop:</dt>
      <dd>{data.dose_drop_pct != null ? `${data.dose_drop_pct}%` : "—"}</dd>
    </dl>
  ),
  dose_inadequacy: (data) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      <dt className="font-medium">Active days:</dt>
      <dd>{String(data.active_days ?? "—")}/7</dd>
      <dt className="font-medium">Target:</dt>
      <dd>{String(data.target_days ?? 5)}+ days</dd>
    </dl>
  ),
};

/** Fallback: render raw key-value pairs */
function GenericEvidence({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null);
  if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">No evidence data</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {entries.map(([k, v]) => (
        <span key={k} className="contents">
          <dt className="font-medium">{k.replace(/_/g, " ")}:</dt>
          <dd>{String(v)}</dd>
        </span>
      ))}
    </dl>
  );
}

export const AlertEvidenceBlock = memo(function AlertEvidenceBlock({
  alertType,
  triggerData,
}: AlertEvidenceBlockProps) {
  const [open, setOpen] = useState(false);

  const renderer = EVIDENCE_RENDERERS[alertType];
  const content = renderer ? renderer(triggerData) : <GenericEvidence data={triggerData} />;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Why am I seeing this?
      </button>
      {open && (
        <div className="mt-1.5 pl-4 py-1.5 border-l-2 border-muted animate-fade-in">
          {content}
        </div>
      )}
    </div>
  );
});
