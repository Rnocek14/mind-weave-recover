/**
 * Admin Voice Analytics — Voice interaction telemetry dashboard
 * 
 * Answers 5 key questions:
 * 1. Are people using voice?
 * 2. Is recognition good enough?
 * 3. Do users trust transcripts?
 * 4. Is fallback saving bad turns?
 * 5. Is Maya voice output useful?
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, Mic, CheckCircle2, Edit, LifeBuoy, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Threshold bands ─────────────────────────────────────────

type Band = 'green' | 'yellow' | 'red';

function adoptionBand(v: number): Band { return v >= 0.40 ? 'green' : v >= 0.20 ? 'yellow' : 'red'; }
function recognitionBand(v: number): Band { return v >= 0.70 ? 'green' : v >= 0.50 ? 'yellow' : 'red'; }
function acceptBand(v: number): Band { return v >= 0.60 ? 'green' : v >= 0.40 ? 'yellow' : 'red'; }

const BAND_COLORS: Record<Band, string> = {
  green: 'text-green-600 bg-green-50 border-green-200',
  yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  red: 'text-red-600 bg-red-50 border-red-200',
};

function pct(v: number | null): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(0)}%`;
}

// ─── Component ───────────────────────────────────────────────

export default function AdminVoiceAnalytics() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-voice-analytics'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('voice_session_summaries' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (rows ?? []) as any[];
    },
  });

  const sessions = data ?? [];
  const totalSessions = sessions.length;

  // Aggregate metrics
  const avg = (key: string) => {
    const vals = sessions.map((s: any) => s[key]).filter((v: any) => v != null) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const sum = (key: string) => sessions.reduce((a: number, s: any) => a + (s[key] ?? 0), 0);

  const avgAdoption = avg('voice_adoption_rate');
  const avgRecognition = avg('recognition_success_rate');
  const avgAccept = avg('first_attempt_accept_rate');
  const avgConfidence = avg('avg_confidence');
  const totalMicStarts = sum('mic_starts');
  const totalMicSuccesses = sum('mic_successes');
  const totalEdited = sum('preview_edited');
  const totalRetried = sum('preview_retried');
  const totalFallbackChips = sum('fallback_chips_used');
  const totalFallbackType = sum('fallback_type_used');
  const totalTtsPlays = sum('tts_plays');
  const totalVoiceTurns = sum('voice_turns');
  const totalTextTurns = sum('text_turns');

  // Per-topic breakdown
  const byTopic = sessions.reduce((acc: Record<string, any[]>, s: any) => {
    const t = s.topic_id || 'unknown';
    if (!acc[t]) acc[t] = [];
    acc[t].push(s);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Admin
        </Button>
        <h1 className="text-2xl font-bold">Voice Analytics</h1>
        <span className="text-sm text-muted-foreground ml-auto">
          {totalSessions} session{totalSessions !== 1 ? 's' : ''} tracked
        </span>
      </div>

      {totalSessions === 0 ? (
        <Card className="p-8 text-center">
          <Mic className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No voice sessions recorded yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Run Smart Coach sessions with voice enabled to see data here.</p>
        </Card>
      ) : (
        <>
          {/* ─── Key metrics ──────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard
              icon={Mic}
              label="Voice Adoption"
              value={pct(avgAdoption)}
              band={avgAdoption != null ? adoptionBand(avgAdoption) : 'yellow'}
              detail={`${totalVoiceTurns} voice / ${totalTextTurns} text`}
            />
            <MetricCard
              icon={CheckCircle2}
              label="Recognition"
              value={pct(avgRecognition)}
              band={avgRecognition != null ? recognitionBand(avgRecognition) : 'yellow'}
              detail={`${totalMicSuccesses}/${totalMicStarts} mic attempts`}
            />
            <MetricCard
              icon={Edit}
              label="First Accept"
              value={pct(avgAccept)}
              band={avgAccept != null ? acceptBand(avgAccept) : 'yellow'}
              detail={`${totalEdited} edits, ${totalRetried} retries`}
            />
            <MetricCard
              icon={LifeBuoy}
              label="Fallback Usage"
              value={String(totalFallbackChips + totalFallbackType)}
              band={totalFallbackChips + totalFallbackType > totalSessions * 2 ? 'red' : 'green'}
              detail={`${totalFallbackChips} chips, ${totalFallbackType} typed`}
            />
            <MetricCard
              icon={Volume2}
              label="TTS Plays"
              value={String(totalTtsPlays)}
              band="green"
              detail={`${avgConfidence != null ? (avgConfidence * 100).toFixed(0) : '—'}% avg ASR conf`}
            />
          </div>

          {/* ─── Per-topic breakdown ─────────────────────── */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3">By Topic</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Topic</th>
                    <th className="text-right py-2 px-2">Sessions</th>
                    <th className="text-right py-2 px-2">Adoption</th>
                    <th className="text-right py-2 px-2">Recognition</th>
                    <th className="text-right py-2 px-2">Accept</th>
                    <th className="text-right py-2 px-2">Fallback</th>
                    <th className="text-right py-2 px-2">TTS</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byTopic).map(([topic, rows]) => {
                    const topicRows = rows as any[];
                    const tAvg = (k: string) => {
                      const v = topicRows.map((r: any) => r[k]).filter((x: any) => x != null) as number[];
                      return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null;
                    };
                    const tSum = (k: string) => topicRows.reduce((a: number, r: any) => a + (r[k] ?? 0), 0);
                    return (
                      <tr key={topic} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium capitalize">{topic}</td>
                        <td className="text-right py-2 px-2">{topicRows.length}</td>
                        <td className="text-right py-2 px-2">{pct(tAvg('voice_adoption_rate'))}</td>
                        <td className="text-right py-2 px-2">{pct(tAvg('recognition_success_rate'))}</td>
                        <td className="text-right py-2 px-2">{pct(tAvg('first_attempt_accept_rate'))}</td>
                        <td className="text-right py-2 px-2">{tSum('fallback_chips_used') + tSum('fallback_type_used')}</td>
                        <td className="text-right py-2 px-2">{tSum('tts_plays')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ─── Recent sessions ─────────────────────────── */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Sessions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Time</th>
                    <th className="text-left py-2 px-2">Topic</th>
                    <th className="text-right py-2 px-2">Turns</th>
                    <th className="text-right py-2 px-2">Voice%</th>
                    <th className="text-right py-2 px-2">Recog%</th>
                    <th className="text-right py-2 px-2">Accept%</th>
                    <th className="text-right py-2 px-2">Fallback</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 20).map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-2 capitalize">{s.topic_id || '—'}</td>
                      <td className="text-right py-2 px-2">{s.total_turns}</td>
                      <td className="text-right py-2 px-2">{pct(s.voice_adoption_rate)}</td>
                      <td className="text-right py-2 px-2">{pct(s.recognition_success_rate)}</td>
                      <td className="text-right py-2 px-2">{pct(s.first_attempt_accept_rate)}</td>
                      <td className="text-right py-2 px-2">{(s.fallback_chips_used ?? 0) + (s.fallback_type_used ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Metric card component ───────────────────────────────────

function MetricCard({ icon: Icon, label, value, band, detail }: {
  icon: typeof Mic;
  label: string;
  value: string;
  band: Band;
  detail: string;
}) {
  return (
    <Card className={cn('p-3 border', BAND_COLORS[band])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] opacity-70 mt-0.5">{detail}</p>
    </Card>
  );
}
