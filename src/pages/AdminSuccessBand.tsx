import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminSuccessBand() {
  const navigate = useNavigate();

  // Get latest cognitive domain scores per user to compute band distribution
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["admin-success-band"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cognitive_domain_scores")
        .select("user_id, domain_slug, score, trial_count, profiles!cognitive_domain_scores_profile_id_fkey(profile_name, display_name)")
        .gte("trial_count", 5)
        .order("computed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Deduplicate to latest score per user×domain
  const latestByUserDomain = useMemo(() => {
    const seen = new Map<string, any>();
    scores.forEach((s: any) => {
      const key = `${s.user_id}__${s.domain_slug}`;
      if (!seen.has(key)) seen.set(key, s);
    });
    return Array.from(seen.values());
  }, [scores]);

  const bandStats = useMemo(() => {
    if (latestByUserDomain.length === 0) return { below: 0, optimal: 0, above: 0, total: 0 };
    let below = 0, optimal = 0, above = 0;
    latestByUserDomain.forEach((s) => {
      const pct = s.score * 100;
      if (pct < 70) below++;
      else if (pct <= 85) optimal++;
      else above++;
    });
    const total = below + optimal + above;
    return { below, optimal, above, total };
  }, [latestByUserDomain]);

  const pctOf = (n: number) => bandStats.total ? Math.round((n / bandStats.total) * 100) : 0;

  // Per-user summary
  const userSummaries = useMemo(() => {
    const map = new Map<string, { name: string; domains: { slug: string; score: number }[] }>();
    latestByUserDomain.forEach((s: any) => {
      const key = s.user_id;
      if (!map.has(key)) {
        const p = s.profiles;
        map.set(key, { name: p?.display_name || p?.profile_name || "Unknown", domains: [] });
      }
      map.get(key)!.domains.push({ slug: s.domain_slug, score: s.score });
    });
    return Array.from(map.entries()).map(([uid, data]) => {
      const avg = data.domains.reduce((s, d) => s + d.score, 0) / data.domains.length;
      return { userId: uid, name: data.name, avgScore: avg, domainCount: data.domains.length };
    }).sort((a, b) => a.avgScore - b.avgScore);
  }, [latestByUserDomain]);

  const getBandLabel = (score: number) => {
    const pct = score * 100;
    if (pct < 70) return { label: "Below band", color: "text-amber-600", Icon: TrendingDown };
    if (pct <= 85) return { label: "Optimal", color: "text-emerald-600", Icon: Target };
    return { label: "Above band", color: "text-blue-600", Icon: TrendingUp };
  };

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
          <h1 className="text-2xl font-bold">Success-Band Monitor</h1>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading…</p>
        ) : (
          <>
            {/* Fleet summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Below Band (<70%)", value: bandStats.below, pct: pctOf(bandStats.below), color: "text-amber-600", bg: "bg-amber-500" },
                { label: "Optimal (70–85%)", value: bandStats.optimal, pct: pctOf(bandStats.optimal), color: "text-emerald-600", bg: "bg-emerald-500" },
                { label: "Above Band (>85%)", value: bandStats.above, pct: pctOf(bandStats.above), color: "text-blue-600", bg: "bg-blue-500" },
              ].map((b) => (
                <Card key={b.label} className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                  <p className={`text-3xl font-bold ${b.color}`}>{b.pct}%</p>
                  <Progress value={b.pct} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">{b.value} of {bandStats.total} scores</p>
                </Card>
              ))}
            </div>

            {/* Per-user breakdown */}
            <h2 className="text-lg font-semibold">Per-User Overview</h2>
            {userSummaries.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No users with sufficient trial data yet
              </Card>
            ) : (
              <div className="space-y-2">
                {userSummaries.map((u) => {
                  const band = getBandLabel(u.avgScore);
                  const BandIcon = band.Icon;
                  return (
                    <Card key={u.userId} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.domainCount} domains scored</p>
                        </div>
                        <div className={`flex items-center gap-1.5 ${band.color}`}>
                          <BandIcon className="w-4 h-4" />
                          <span className="text-sm font-semibold">{Math.round(u.avgScore * 100)}%</span>
                          <span className="text-xs">{band.label}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
