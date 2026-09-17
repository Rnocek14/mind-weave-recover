import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Download, Loader2, RefreshCw, Users } from "lucide-react";

interface OverviewRow {
  user_id: string;
  email: string | null;
  is_anonymous: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[] | null;
  profile_names: string[] | null;
  session_count: number;
  completed_session_count: number;
  last_session_at: string | null;
  total_practice_minutes: number;
}

type SortKey = "last_session_at" | "session_count" | "created_at";

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminUserOverview() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hideGuests, setHideGuests] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("last_session_at");

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await (supabase as any).rpc("admin_user_overview");
    if (error) setError(error.message);
    setRows((data as OverviewRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (hideGuests) out = out.filter(r => !r.is_anonymous && !!r.email);
    if (q) {
      out = out.filter(r =>
        (r.email || "").toLowerCase().includes(q) ||
        (r.profile_names || []).some(n => (n || "").toLowerCase().includes(q)) ||
        (r.roles || []).some(n => n.toLowerCase().includes(q))
      );
    }
    return [...out].sort((a, b) => {
      if (sortKey === "session_count") return b.session_count - a.session_count;
      const av = sortKey === "created_at" ? a.created_at : a.last_session_at;
      const bv = sortKey === "created_at" ? b.created_at : b.last_session_at;
      return new Date(bv || 0).getTime() - new Date(av || 0).getTime();
    });
  }, [rows, search, hideGuests, sortKey]);

  const stats = useMemo(() => {
    const real = rows.filter(r => !r.is_anonymous && !!r.email);
    const thirtyAgo = Date.now() - 30 * 86400000;
    return {
      totalAccounts: rows.length,
      realAccounts: real.length,
      guests: rows.length - real.length,
      activeLast30: real.filter(r => r.last_session_at && new Date(r.last_session_at).getTime() > thirtyAgo).length,
      newLast30: real.filter(r => new Date(r.created_at).getTime() > thirtyAgo).length,
      totalSessions: rows.reduce((s, r) => s + Number(r.session_count || 0), 0),
      practiceHours: Math.round(rows.reduce((s, r) => s + Number(r.total_practice_minutes || 0), 0) / 60),
    };
  }, [rows]);

  const exportCsv = () => {
    const header = ["email", "roles", "profiles", "signed_up", "last_sign_in", "sessions", "completed", "last_session", "practice_minutes"];
    const lines = filtered.map(r => [
      r.email ?? "(guest)",
      (r.roles || []).join(" "),
      (r.profile_names || []).join(" | "),
      r.created_at,
      r.last_sign_in_at ?? "",
      r.session_count,
      r.completed_session_count,
      r.last_session_at ?? "",
      r.total_practice_minutes,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neurospark-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Admin
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" /> All Users
          </h1>
          <p className="text-muted-foreground">Every account, their practice activity and roles.</p>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Real accounts", value: stats.realAccounts },
            { label: "Active (30d)", value: stats.activeLast30 },
            { label: "New (30d)", value: stats.newLast30 },
            { label: "Sessions", value: stats.totalSessions },
            { label: "Practice hours", value: stats.practiceHours },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="text-2xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="gap-3">
            <CardTitle className="text-base">
              {filtered.length} shown{hideGuests && stats.guests > 0 ? ` · ${stats.guests} guest accounts hidden` : ""}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search email, name or role…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Switch id="hide-guests" checked={hideGuests} onCheckedChange={setHideGuests} />
                <Label htmlFor="hide-guests" className="text-sm">Hide guest accounts</Label>
              </div>
              <div className="flex gap-1">
                {([
                  ["last_session_at", "Recent activity"],
                  ["session_count", "Most sessions"],
                  ["created_at", "Newest"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={sortKey === key ? "secondary" : "ghost"}
                    onClick={() => setSortKey(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : error ? (
              <p className="text-sm text-destructive py-6">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No accounts match that search.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3">Roles</th>
                      <th className="py-2 pr-3">Signed up</th>
                      <th className="py-2 pr-3 text-right">Sessions</th>
                      <th className="py-2 pr-3 text-right">Minutes</th>
                      <th className="py-2 pr-3">Last practice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.user_id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.email || "Guest session"}</div>
                          {(r.profile_names || []).length > 0 && (
                            <div className="text-xs text-muted-foreground">{(r.profile_names || []).join(", ")}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {(r.roles || []).length === 0
                              ? <span className="text-xs text-muted-foreground">patient</span>
                              : (r.roles || []).map(role => (
                                  <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                                ))}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {r.completed_session_count}/{r.session_count}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Math.round(Number(r.total_practice_minutes || 0))}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtDate(r.last_session_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
