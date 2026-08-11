import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Shield, ArrowLeftRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  approved: "bg-blue-100 text-blue-800",
  suggested: "bg-amber-100 text-amber-800",
  reversed: "bg-red-100 text-red-800",
  superseded: "bg-muted text-muted-foreground",
};

export default function AdminOverrideAudit() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ["admin-override-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinician_overrides")
        .select("*, profiles!clinician_overrides_profile_id_fkey(profile_name, display_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return overrides;
    return overrides.filter((o: any) => o.status === statusFilter);
  }, [overrides, statusFilter]);

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
          <h1 className="text-2xl font-bold">Override Audit</h1>
          <div className="ml-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="suggested">Suggested</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
                <SelectItem value="superseded">Superseded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading overrides…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No overrides found</Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((o: any) => {
              const profile = o.profiles;
              return (
                <Card key={o.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-md bg-primary/10 mt-0.5">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm capitalize">
                          {o.override_type?.replace(/_/g, " ")}
                        </span>
                        <Badge className={`text-xs ${STATUS_COLORS[o.status] || ""}`}>
                          {o.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {profile?.display_name || profile?.profile_name || "—"}
                        </Badge>
                        {o.target_slug && (
                          <Badge variant="secondary" className="text-xs">{o.target_slug}</Badge>
                        )}
                      </div>
                      {o.reason && (
                        <p className="text-xs text-muted-foreground">{o.reason}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{format(new Date(o.created_at), "MMM d, yyyy HH:mm")}</span>
                        {o.reversed_at && (
                          <span className="flex items-center gap-1 text-destructive">
                            <ArrowLeftRight className="w-3 h-3" />
                            Reversed {format(new Date(o.reversed_at), "MMM d")}
                          </span>
                        )}
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
