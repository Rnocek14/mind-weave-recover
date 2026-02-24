import { useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  X,
} from "lucide-react";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";

interface RecoveryAlertsPanelProps {
  alerts: RecoveryAlert[];
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

export const RecoveryAlertsPanel = memo(function RecoveryAlertsPanel({
  alerts,
  onResolve,
}: RecoveryAlertsPanelProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  if (alerts.length === 0) return null;

  const handleResolve = async (id: string) => {
    await onResolve(id, resolveNotes || undefined);
    setResolvingId(null);
    setResolveNotes("");
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
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const config =
            severityConfig[alert.severity as keyof typeof severityConfig] ||
            severityConfig.info;
          const Icon = config.icon;
          const isResolving = resolvingId === alert.id;

          return (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${config.borderClass} bg-card space-y-2`}
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
                      {alert.domain_slug && (
                        <Badge variant="outline" className="text-xs">
                          {alert.domain_slug}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 w-7 p-0"
                  onClick={() =>
                    setResolvingId(isResolving ? null : alert.id)
                  }
                >
                  {isResolving ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {isResolving && (
                <div className="flex gap-2 animate-fade-in">
                  <Input
                    placeholder="Resolution notes (optional)"
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    className="text-sm h-8"
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1"
                    onClick={() => handleResolve(alert.id)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolve
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
