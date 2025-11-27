import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, Activity, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface ErrorTypeCount {
  errorType: string;
  count: number;
}

interface DailyMetric {
  date: string;
  avgEncouragementScore: number;
  effortfulRate: number;
  trialCount: number;
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  correct: '#22c55e',
  attempted: '#3b82f6',
  circumlocution: '#8b5cf6',
  phonemic_paraphasia: '#f59e0b',
  semantic_paraphasia: '#ef4444',
  neologism: '#ec4899',
  no_response: '#6b7280',
  timeout: '#9ca3af',
};

export default function SpeechTrendsAnalytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [errorDistribution, setErrorDistribution] = useState<ErrorTypeCount[]>([]);
  const [keyMetrics, setKeyMetrics] = useState({
    avgSpeechRateWpm: 0,
    avgPauseCount: 0,
    circumlocutionCount: 0,
    totalTrials: 0,
  });

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get last 14 days of data
      const startDate = startOfDay(subDays(new Date(), 14)).toISOString();

      // First get user's sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .gte('started_at', startDate);

      if (sessionsError) throw sessionsError;

      const sessionIds = sessions?.map(s => s.id) || [];
      if (sessionIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get events for user's sessions
      const { data: events, error } = await supabase
        .from('exercise_events')
        .select('*')
        .in('session_id', sessionIds)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process daily metrics
      const dailyMap = new Map<string, { scoreSum: number; effortfulCount: number; total: number }>();
      const errorTypeMap = new Map<string, number>();
      let totalSpeechRate = 0;
      let totalPauseCount = 0;
      let speechRateCount = 0;
      let pauseCountCount = 0;
      let circumlocutions = 0;

      events?.forEach((event) => {
        const date = format(new Date(event.created_at || ''), 'MM/dd');
        const taskParams = event.task_parameters as any;
        const utteranceAnalysis = taskParams?.utterance_analysis;

        // Daily metrics
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { scoreSum: 0, effortfulCount: 0, total: 0 });
        }
        const dayData = dailyMap.get(date)!;
        dayData.total += 1;

        if (taskParams?.encouragement_score) {
          dayData.scoreSum += taskParams.encouragement_score;
        }
        if (taskParams?.effortful_speech === true) {
          dayData.effortfulCount += 1;
        }

        // Error type distribution
        const errorType = utteranceAnalysis?.errorType || event.error_type || 'unknown';
        errorTypeMap.set(errorType, (errorTypeMap.get(errorType) || 0) + 1);

        // Acoustic metrics
        const acousticMetrics = event.acoustic_metrics as any;
        if (acousticMetrics?.speechRateWpm) {
          totalSpeechRate += acousticMetrics.speechRateWpm;
          speechRateCount += 1;
        }
        if (acousticMetrics?.pauseCount !== undefined) {
          totalPauseCount += acousticMetrics.pauseCount;
          pauseCountCount += 1;
        }

        // Circumlocution count
        if (utteranceAnalysis?.circumlocutionDetected === true) {
          circumlocutions += 1;
        }
      });

      // Convert to chart data
      const dailyData: DailyMetric[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        avgEncouragementScore: data.total > 0 ? Math.round(data.scoreSum / data.total) : 0,
        effortfulRate: data.total > 0 ? Math.round((data.effortfulCount / data.total) * 100) : 0,
        trialCount: data.total,
      }));

      const errorData: ErrorTypeCount[] = Array.from(errorTypeMap.entries())
        .map(([errorType, count]) => ({ errorType, count }))
        .sort((a, b) => b.count - a.count);

      setDailyMetrics(dailyData);
      setErrorDistribution(errorData);
      setKeyMetrics({
        avgSpeechRateWpm: speechRateCount > 0 ? Math.round(totalSpeechRate / speechRateCount) : 0,
        avgPauseCount: pauseCountCount > 0 ? Math.round((totalPauseCount / pauseCountCount) * 10) / 10 : 0,
        circumlocutionCount: circumlocutions,
        totalTrials: events?.length || 0,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Speech Progress Trends</h1>
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Total Trials</p>
            </div>
            <p className="text-3xl font-bold">{keyMetrics.totalTrials}</p>
            <p className="text-xs text-muted-foreground mt-1">Last 14 days</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <p className="text-sm text-muted-foreground">Avg Speech Rate</p>
            </div>
            <p className="text-3xl font-bold">{keyMetrics.avgSpeechRateWpm}</p>
            <p className="text-xs text-muted-foreground mt-1">words/min</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              <p className="text-sm text-muted-foreground">Circumlocutions</p>
            </div>
            <p className="text-3xl font-bold">{keyMetrics.circumlocutionCount}</p>
            <p className="text-xs text-muted-foreground mt-1">descriptions used</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <p className="text-sm text-muted-foreground">Avg Pauses</p>
            </div>
            <p className="text-3xl font-bold">{keyMetrics.avgPauseCount}</p>
            <p className="text-xs text-muted-foreground mt-1">per trial</p>
          </Card>
        </div>

        {/* Time Series Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Encouragement Score Trend */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Encouragement Score Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgEncouragementScore" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  name="Avg Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Effortful Speech Rate */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Effortful Speech Rate</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="effortfulRate" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="% Effortful"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Error Type Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Error Type Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={errorDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="errorType" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Error Type Breakdown</h2>
            <div className="space-y-3">
              {errorDistribution.slice(0, 6).map((item) => (
                <div key={item.errorType} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ERROR_TYPE_COLORS[item.errorType] || '#6b7280' }}
                    />
                    <span className="text-sm capitalize">{item.errorType.replace('_', ' ')}</span>
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))}
            </div>
            {errorDistribution.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No error data available yet
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
