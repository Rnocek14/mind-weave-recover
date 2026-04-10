/**
 * Shadow Analytics — Research/admin console for inspecting Shadow Mode events.
 * NOT clinician-facing. Internal research + tuning tool.
 */
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Activity, Database, Eye, Search, Download, ChevronDown, ChevronRight,
  Shield, AlertTriangle, CheckCircle2, XCircle, HelpCircle, BarChart3
} from "lucide-react";
import { useShadowAnalytics, type ShadowEvent, type FieldCompleteness } from "@/hooks/useShadowAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ─── Health Summary Cards ───────────────────────────────────
function HealthSummary({ health }: { health: ReturnType<typeof useShadowAnalytics>['health'] }) {
  const cards = [
    { label: 'Total Events', value: health.total, icon: Database },
    { label: 'Last 7 Days', value: health.last7Days, icon: Activity },
    { label: 'Active Profiles', value: health.activeProfiles, icon: Shield },
    { label: 'Self-Recovered', value: health.selfRecovered, icon: CheckCircle2 },
  ];

  const pctCards = [
    { label: '% w/ Transcript', value: health.total ? Math.round((health.withTranscript / health.total) * 100) : 0 },
    { label: '% w/ Target Word', value: health.total ? Math.round((health.withTargetWord / health.total) * 100) : 0 },
    { label: '% w/ Trigger Reason', value: health.total ? Math.round((health.withTriggerReason / health.total) * 100) : 0 },
    { label: '% w/ Cue Candidate', value: health.total ? Math.round((health.withCueCandidate / health.total) * 100) : 0 },
    { label: '% w/ Model Version', value: health.total ? Math.round((health.withModelVersion / health.total) * 100) : 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <c.icon className="w-3.5 h-3.5" />
                {c.label}
              </div>
              <div className="text-2xl font-bold text-foreground">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {pctCards.map(c => (
          <Card key={c.label}>
            <CardContent className="pt-3 pb-2 px-3 text-center">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className={`text-lg font-semibold ${c.value >= 80 ? 'text-green-600' : c.value >= 50 ? 'text-amber-600' : c.value > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {c.value}%
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Field Completeness ─────────────────────────────────────
function FieldCompletenessPanel({ fields }: { fields: FieldCompleteness[] }) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No events to analyze</p>;
  }

  const statusColors: Record<string, string> = {
    strong: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    weak: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    missing: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {fields.map(f => (
        <div key={f.field} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border">
          <code className="text-xs font-mono text-foreground">{f.field}</code>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{f.filled}/{f.total}</span>
            <Badge variant="secondary" className={`text-xs ${statusColors[f.status]}`}>
              {f.pct}% {f.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Event Row (expandable) ─────────────────────────────────
function EventRow({ event }: { event: ShadowEvent }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(!open)}>
        <TableCell className="w-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="text-xs font-mono">{format(new Date(event.created_at), 'MM/dd HH:mm:ss')}</TableCell>
        <TableCell className="text-xs">{event.task_type}</TableCell>
        <TableCell className="text-xs max-w-[100px] truncate">{event.target_word || event.target_phrase || '—'}</TableCell>
        <TableCell className="text-xs max-w-[120px] truncate">{event.user_transcript || '—'}</TableCell>
        <TableCell className="text-xs">{event.outcome_error_type || '—'}</TableCell>
        <TableCell className="text-xs">{event.cue_type_candidate || '—'}</TableCell>
        <TableCell className="text-xs">
          {event.system_confidence != null ? `${Math.round(event.system_confidence * 100)}%` : '—'}
        </TableCell>
        <TableCell>
          {event.user_self_recovered === true ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">Yes</Badge>
          ) : event.user_self_recovered === false ? (
            <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">No</Badge>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">{event.review_status}</Badge>
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30">
          <TableCell colSpan={10} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">ID:</span> <code className="font-mono">{event.id.slice(0, 8)}</code></div>
              <div><span className="text-muted-foreground">Session:</span> <code className="font-mono">{event.session_id?.slice(0, 8) || '—'}</code></div>
              <div><span className="text-muted-foreground">Domain:</span> {event.domain || '—'}</div>
              <div><span className="text-muted-foreground">Mode:</span> {event.interaction_mode || '—'}</div>
              <div><span className="text-muted-foreground">System Guess:</span> {event.system_guess || '—'}</div>
              <div><span className="text-muted-foreground">System Action:</span> {event.system_action || '—'}</div>
              <div><span className="text-muted-foreground">Trigger:</span> {event.trigger_reason || '—'}</div>
              <div><span className="text-muted-foreground">Latency:</span> {event.latency_ms != null ? `${event.latency_ms}ms` : '—'}</div>
              <div><span className="text-muted-foreground">ASR Conf:</span> {event.asr_confidence != null ? `${Math.round(event.asr_confidence * 100)}%` : '—'}</div>
              <div><span className="text-muted-foreground">Model:</span> {event.model_version || '—'}</div>
              <div><span className="text-muted-foreground">Source:</span> {event.source_type}</div>
              <div><span className="text-muted-foreground">Env:</span> {event.environment || '—'}</div>
            </div>
            {event.user_transcript && (
              <div className="mt-3 p-2 bg-background rounded border text-xs">
                <span className="text-muted-foreground font-medium">Full Transcript: </span>
                {event.user_transcript}
              </div>
            )}
            {(event.analysis_data || event.task_data) && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Raw JSON</summary>
                <pre className="mt-1 text-xs bg-background p-2 rounded border overflow-x-auto max-h-40">
                  {JSON.stringify({ analysis: event.analysis_data, task: event.task_data }, null, 2)}
                </pre>
              </details>
            )}
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Frequency Table ────────────────────────────────────────
function FrequencyTable({ title, data, icon }: { title: string; data: Record<string, number>; icon?: React.ReactNode }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-4 text-center">No data yet</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {sorted.map(([key, count]) => (
          <div key={key} className="flex items-center justify-between text-xs py-1">
            <code className="font-mono text-foreground">{key}</code>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(count / total) * 100}%` }} />
              </div>
              <span className="text-muted-foreground w-12 text-right">{count} ({Math.round((count / total) * 100)}%)</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function ShadowAnalytics() {
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{
    taskType?: string;
    triggerReason?: string;
    reviewStatus?: string;
    selfRecovered?: boolean | null;
  }>({});

  const {
    events, health, fieldCompleteness,
    triggerReasonCounts, cueTypeCounts, taskTypeCounts, errorTypeCounts,
    confidenceBuckets, selfRecoveredCount, unresolvedCount, wouldHaveCuedCount,
    isLoading, refetch,
  } = useShadowAnalytics({
    taskType: filters.taskType,
    triggerReason: filters.triggerReason,
    reviewStatus: filters.reviewStatus,
    selfRecovered: filters.selfRecovered,
  });

  // Distinct values for filter dropdowns
  const distinctTaskTypes = useMemo(() => [...new Set(events.map(e => e.task_type).filter(Boolean))], [events]);
  const distinctTriggers = useMemo(() => [...new Set(events.map(e => e.trigger_reason).filter(Boolean) as string[])], [events]);

  // Filtered events for table search
  const filteredEvents = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(e =>
      e.user_transcript?.toLowerCase().includes(q) ||
      e.target_word?.toLowerCase().includes(q) ||
      e.task_type.toLowerCase().includes(q) ||
      e.trigger_reason?.toLowerCase().includes(q) ||
      e.cue_type_candidate?.toLowerCase().includes(q)
    );
  }, [events, search]);

  // CSV export
  const handleExport = () => {
    if (filteredEvents.length === 0) return;
    const headers = ['created_at','task_type','target_word','user_transcript','outcome_error_type','system_confidence','cue_type_candidate','trigger_reason','user_self_recovered','review_status','model_version','source_type','environment'];
    const rows = filteredEvents.map(e => headers.map(h => {
      const v = (e as any)[h];
      return v != null ? String(v).replace(/"/g, '""') : '';
    }));
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow-events-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filteredEvents.length} events exported to CSV` });
  };

  // Review marking
  const markReview = async (eventId: string, status: string) => {
    const { error } = await supabase
      .from('shadow_events')
      .update({ review_status: status })
      .eq('id', eventId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Event marked as ${status}` });
      refetch();
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Eye className="w-6 h-6 text-primary" />
            Shadow Mode Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Research console — inspect, validate, and learn from shadow events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredEvents.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && health.total === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Eye className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Shadow Events Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Shadow Mode is wired but dormant. To start capturing events, enable the feature flag
              via <code className="bg-muted px-1 py-0.5 rounded text-xs">VITE_SHADOW_MODE_ENABLED=true</code> or
              run <code className="bg-muted px-1 py-0.5 rounded text-xs">setShadowModeOverride(true)</code> in the browser console.
              Then complete PhotoNaming or PhrasePractice exercises.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events ({filteredEvents.length})</TabsTrigger>
          <TabsTrigger value="cues">Cue Opportunities</TabsTrigger>
          <TabsTrigger value="recovery">Self-Recovery</TabsTrigger>
          <TabsTrigger value="confidence">Confidence</TabsTrigger>
          <TabsTrigger value="cohort">Cohort</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ──────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <HealthSummary health={health} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field Completeness</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldCompletenessPanel fields={fieldCompleteness} />
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FrequencyTable title="Task Types" data={taskTypeCounts} icon={<BarChart3 className="w-4 h-4" />} />
            <FrequencyTable title="Error Types" data={errorTypeCounts} icon={<AlertTriangle className="w-4 h-4" />} />
          </div>
        </TabsContent>

        {/* ─── Events Tab ────────────────────────── */}
        <TabsContent value="events" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search transcript, target, task..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
            <Select value={filters.taskType || '__all__'} onValueChange={v => setFilters(f => ({ ...f, taskType: v === '__all__' ? undefined : v }))}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Task Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Tasks</SelectItem>
                {distinctTaskTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.reviewStatus || '__all__'} onValueChange={v => setFilters(f => ({ ...f, reviewStatus: v === '__all__' ? undefined : v }))}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Review" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            {filters.taskType || filters.reviewStatus ? (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilters({})}>
                Clear filters
              </Button>
            ) : null}
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Task</TableHead>
                  <TableHead className="text-xs">Target</TableHead>
                  <TableHead className="text-xs">Transcript</TableHead>
                  <TableHead className="text-xs">Error</TableHead>
                  <TableHead className="text-xs">Cue Candidate</TableHead>
                  <TableHead className="text-xs">Confidence</TableHead>
                  <TableHead className="text-xs">Self-Recovered</TableHead>
                  <TableHead className="text-xs">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">
                      {isLoading ? 'Loading...' : 'No events match filters'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.slice(0, 100).map(e => <EventRow key={e.id} event={e} />)
                )}
              </TableBody>
            </Table>
          </div>
          {filteredEvents.length > 100 && (
            <p className="text-xs text-muted-foreground text-center">
              Showing first 100 of {filteredEvents.length} events. Use filters to narrow results.
            </p>
          )}

          {/* Quick review buttons for selected events */}
          {filteredEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Review</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Click an event row to expand, then use these buttons to mark individual events by ID.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {filteredEvents.slice(0, 5).map(e => (
                    <div key={e.id} className="flex items-center gap-1 border rounded px-2 py-1">
                      <code className="text-xs font-mono">{e.id.slice(0, 6)}</code>
                      <Button size="sm" variant="ghost" className="h-5 px-1 text-xs text-green-600" onClick={() => markReview(e.id, 'confirmed')}>✓</Button>
                      <Button size="sm" variant="ghost" className="h-5 px-1 text-xs text-red-600" onClick={() => markReview(e.id, 'dismissed')}>✗</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Cue Opportunities Tab ─────────────── */}
        <TabsContent value="cues" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground mb-1">Would-Have-Cued Events</div>
                <div className="text-2xl font-bold">{wouldHaveCuedCount}</div>
                <div className="text-xs text-muted-foreground">confidence ≥ 50% + cue candidate present</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground mb-1">Unique Trigger Reasons</div>
                <div className="text-2xl font-bold">{Object.keys(triggerReasonCounts).length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground mb-1">Unique Cue Types</div>
                <div className="text-2xl font-bold">{Object.keys(cueTypeCounts).length}</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FrequencyTable title="Trigger Reasons" data={triggerReasonCounts} icon={<AlertTriangle className="w-4 h-4" />} />
            <FrequencyTable title="Cue Type Candidates" data={cueTypeCounts} icon={<HelpCircle className="w-4 h-4" />} />
          </div>
          <FrequencyTable title="Cue Opportunities by Task Type" data={
            (() => {
              const byTask: Record<string, number> = {};
              events.filter(e => e.cue_type_candidate).forEach(e => {
                byTask[e.task_type] = (byTask[e.task_type] || 0) + 1;
              });
              return byTask;
            })()
          } icon={<BarChart3 className="w-4 h-4" />} />
        </TabsContent>

        {/* ─── Self-Recovery Tab ──────────────────── */}
        <TabsContent value="recovery" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground mb-1">Self-Recovered</div>
                <div className="text-2xl font-bold text-green-600">{selfRecoveredCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground mb-1">Unresolved</div>
                <div className="text-2xl font-bold text-red-600">{unresolvedCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground mb-1">Recovery Rate</div>
                <div className="text-2xl font-bold">
                  {selfRecoveredCount + unresolvedCount > 0
                    ? `${Math.round((selfRecoveredCount / (selfRecoveredCount + unresolvedCount)) * 100)}%`
                    : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* By task type */}
          <FrequencyTable title="Self-Recovery by Task Type" data={
            (() => {
              const byTask: Record<string, number> = {};
              events.filter(e => e.user_self_recovered === true).forEach(e => {
                byTask[e.task_type] = (byTask[e.task_type] || 0) + 1;
              });
              return byTask;
            })()
          } icon={<CheckCircle2 className="w-4 h-4" />} />

          <FrequencyTable title="Unresolved by Task Type" data={
            (() => {
              const byTask: Record<string, number> = {};
              events.filter(e => e.outcome_correct === false && e.user_self_recovered !== true).forEach(e => {
                byTask[e.task_type] = (byTask[e.task_type] || 0) + 1;
              });
              return byTask;
            })()
          } icon={<XCircle className="w-4 h-4" />} />
        </TabsContent>

        {/* ─── Confidence Tab ────────────────────── */}
        <TabsContent value="confidence" className="space-y-4">
          <FrequencyTable title="Confidence Distribution" data={confidenceBuckets} icon={<BarChart3 className="w-4 h-4" />} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FrequencyTable title="Trigger Reasons (High Confidence ≥80%)" data={
              (() => {
                const m: Record<string, number> = {};
                events.filter(e => e.system_confidence != null && e.system_confidence >= 0.8 && e.trigger_reason)
                  .forEach(e => { m[e.trigger_reason!] = (m[e.trigger_reason!] || 0) + 1; });
                return m;
              })()
            } />
            <FrequencyTable title="Error Types (High Confidence ≥80%)" data={
              (() => {
                const m: Record<string, number> = {};
                events.filter(e => e.system_confidence != null && e.system_confidence >= 0.8 && e.outcome_error_type)
                  .forEach(e => { m[e.outcome_error_type!] = (m[e.outcome_error_type!] || 0) + 1; });
                return m;
              })()
            } />
          </div>
        </TabsContent>

        {/* ─── Cohort Tab ────────────────────────── */}
        <TabsContent value="cohort" className="space-y-4">
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Cohort Breakdown</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Cross-patient analysis by aphasia type, laterality, chronicity, and territory will
                become available once shadow events span multiple profiles. Currently tracking
                <strong> {health.activeProfiles}</strong> active profile(s).
              </p>
            </CardContent>
          </Card>

          <FrequencyTable title="Events by Profile" data={
            (() => {
              const m: Record<string, number> = {};
              events.forEach(e => {
                const key = e.profile_id?.slice(0, 8) || 'no-profile';
                m[key] = (m[key] || 0) + 1;
              });
              return m;
            })()
          } icon={<Shield className="w-4 h-4" />} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
