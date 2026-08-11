import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, AlertCircle, Info, ChevronLeft, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  red: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  orange: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
  yellow: { icon: Info, color: "text-yellow-600", bg: "bg-yellow-50" },
};

export default function AdminAlertRollup() {
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["admin-alert-rollup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_alerts")
        .select("*, profiles!recovery_alerts_profile_id_fkey(profile_name, display_name)")
        .is("resolved_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (severityFilter === "all") return alerts;
    return alerts.filter((a: any) => a.severity === severityFilter);
  }, [alerts, severityFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { red: 0, orange: 0, yellow: 0 };
    alerts.forEach((a: any) => { if (c[a.severity] !== undefined) c[a.severity]++; });
    return c;
  }, [alerts]);

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
          <h1 className="text-2xl font-bold">Alert Rollup</h1>
          <Badge variant="outline" className="ml-auto">{alerts.length} unresolved</Badge>
        </div>

        {/* Severity counts */}
        <div className="grid grid-cols-3 gap-3">
          {(["red", "orange", "yellow"] as const).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            const Icon = cfg.icon;
            return (
              <Card
                key={sev}
                className={`p-4 cursor-pointer border-2 transition-colors ${severityFilter === sev ? "border-primary" : "border-transparent hover:border-primary/20"}`}
                onClick={() => setSeverityFilter(severityFilter === sev ? "all" : sev)}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <span className="text-2xl font-bold">{counts[sev]}</span>
                  <span className="text-sm text-muted-foreground capitalize">{sev}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Alert list */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading alerts…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No unresolved alerts{severityFilter !== "all" ? ` with ${severityFilter} severity` : ""}
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((alert: any) => {
              const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.yellow;
              const Icon = cfg.icon;
              const profile = alert.profiles;
              return (
                <Card key={alert.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-md mt-0.5 ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{alert.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {profile?.display_name || profile?.profile_name || "Unknown"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">{alert.alert_type}</Badge>
                      </div>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground">{alert.description}</p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
