import { useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ShieldAlert,
  Info,
  X,
} from "lucide-react";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";
import { AlertEvidenceBlock } from "@/components/AlertEvidenceBlock";

interface RecoveryAlertsPanelProps {
  alerts: RecoveryAlert[];
  onAcknowledge: (id: string, notes?: string) => Promise<void>;
  onResolve: (id: string, notes?: string) => Promise<void>;
}

const severityConfig = {
  critical: {
    icon: ShieldAlert,
    badgeVariant: "destructive" as const,
    borderClass: "border-destructive/40",
  },
  warning: {
    icon: AlertTriangle,
    badgeVariant: "secondary" as const,
    borderClass: "border-chart-4/40",
  },
  info: {
    icon: Info,
    badgeVariant: "outline" as const,
    borderClass: "border-muted",
  },
};

type ActionMode = null | "acknowledge" | "resolve";

export const RecoveryAlertsPanel = memo(function RecoveryAlertsPanel({
  alerts,
  onAcknowledge,
  onResolve,
}: RecoveryAlertsPanelProps) {
  const [activeAction, setActiveAction] = useState<{ id: string; mode: ActionMode }>({ id: "", mode: null });
  const [notes, setNotes] = useState("");

  if (alerts.length === 0) return null;

  const unackedCount = alerts.filter((a) => !a.acknowledged_at).length;

  const handleSubmit = async () => {
    if (!activeAction.mode || !activeAction.id) return;
    if (activeAction.mode === "acknowledge") {
      await onAcknowledge(activeAction.id, notes || undefined);
    } else {
      await onResolve(activeAction.id, notes || undefined);
    }
    setActiveAction({ id: "", mode: null });
    setNotes("");
  };

  const toggleAction = (id: string, mode: ActionMode) => {
    if (activeAction.id === id && activeAction.mode === mode) {
      setActiveAction({ id: "", mode: null });
      setNotes("");
    } else {
      setActiveAction({ id, mode });
      setNotes("");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          Recovery Alerts
          <Badge variant="destructive" className="text-xs">
            {alerts.length}
          </Badge>
          {unackedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unackedCount} new
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const config =
            severityConfig[alert.severity as keyof typeof severityConfig] ||
            severityConfig.info;
          const Icon = config.icon;
          const isAcked = !!alert.acknowledged_at;
          const isActive = activeAction.id === alert.id;

          return (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${config.borderClass} bg-card space-y-2 ${isAcked ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{alert.title}</span>
                      <Badge variant={config.badgeVariant} className="text-xs">
                        {alert.severity}
                      </Badge>
                      {isAcked && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Eye className="w-3 h-3" />
                          Ack
                        </Badge>
                      )}
                      {alert.domain_slug && (
                        <Badge variant="outline" className="text-xs">
                          {alert.domain_slug}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.description}
                    </p>
                    {alert.trigger_data && Object.keys(alert.trigger_data).length > 0 && (
                      <AlertEvidenceBlock
                        alertType={alert.alert_type}
                        triggerData={alert.trigger_data}
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isAcked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Acknowledge"
                      onClick={() => toggleAction(alert.id, "acknowledge")}
                    >
                      <Eye className={`w-4 h-4 ${isActive && activeAction.mode === "acknowledge" ? "text-primary" : "text-muted-foreground"}`} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Resolve"
                    onClick={() => toggleAction(alert.id, "resolve")}
                  >
                    {isActive && activeAction.mode === "resolve" ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {isActive && activeAction.mode && (
                <div className="flex gap-2 animate-fade-in">
                  <Input
                    placeholder={activeAction.mode === "acknowledge" ? "Acknowledgement notes (optional)" : "Resolution notes (optional)"}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-sm h-8"
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1"
                    variant={activeAction.mode === "resolve" ? "default" : "secondary"}
                    onClick={handleSubmit}
                  >
                    {activeAction.mode === "acknowledge" ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Acknowledge
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolve
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});
