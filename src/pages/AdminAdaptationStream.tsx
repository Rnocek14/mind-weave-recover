import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Activity, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";

const TRIGGER_COLORS: Record<string, string> = {
  system: "bg-blue-100 text-blue-800",
  clinician: "bg-purple-100 text-purple-800",
  mixed: "bg-amber-100 text-amber-800",
};

export default function AdminAdaptationStream() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-adaptation-stream"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptation_events")
        .select("*, profiles!adaptation_events_profile_id_fkey(profile_name, display_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const adaptationTypes = useMemo(() => {
    const types = new Set(events.map((e: any) => e.adaptation_type));
    return Array.from(types).sort();
  }, [events]);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return events;
    return events.filter((e: any) => e.adaptation_type === typeFilter);
  }, [events, typeFilter]);

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
          <h1 className="text-2xl font-bold">Adaptation Stream</h1>
          <Badge variant="outline" className="ml-auto">{events.length} events</Badge>
        </div>

        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {adaptationTypes.map((t) => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading events…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No adaptation events found</Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((evt: any) => {
              const profile = evt.profiles;
              const triggerColor = TRIGGER_COLORS[evt.trigger_type] || TRIGGER_COLORS.system;
              return (
                <Card key={evt.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-md bg-accent/50 mt-0.5">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm capitalize">
                          {evt.adaptation_type?.replace(/_/g, " ")}
                        </span>
                        <Badge className={`text-xs ${triggerColor}`}>{evt.trigger_type}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {profile?.display_name || profile?.profile_name || "—"}
                        </Badge>
                        {evt.exercise_slug && (
                          <Badge variant="secondary" className="text-xs">{evt.exercise_slug}</Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">{evt.confidence}</Badge>
                      </div>
                      {evt.trigger_condition && (
                        <p className="text-xs text-muted-foreground">{evt.trigger_condition}</p>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                      </span>
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
