import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, Activity, MessageSquare, Brain, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

interface CategoryErrorPattern {
  category: string;
  mostCommonError: string;
  errorCounts: Record<string, number>;
  totalTrials: number;
}

interface DifficultWord {
  targetWord: string;
  trials: number;
  avgScore: number;
  effortfulRate: number;
  mostCommonError: string;
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
  const [categoryPatterns, setCategoryPatterns] = useState<CategoryErrorPattern[]>([]);
  const [difficultWords, setDifficultWords] = useState<DifficultWord[]>([]);
  const [clinicalSnapshot, setClinicalSnapshot] = useState({
    mostCommonError: '',
    strongestCategory: '',
    totalTrials: 0,
  });
  const [keyMetrics, setKeyMetrics] = useState({
    avgSpeechRateWpm: 0,
    avgPauseCount: 0,
    avgPhonemeAccuracy: 0,
    avgSemanticSimilarity: 0,
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
      console.log('📊 [SpeechTrendsAnalytics] Loading analytics for user:', user.id);

      // Get last 14 days of data
      const startDate = startOfDay(subDays(new Date(), 14)).toISOString();

      // Query utterance_analyses directly (the canonical speech analysis table)
      const { data: analyses, error } = await supabase
        .from('utterance_analyses')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ [SpeechTrendsAnalytics] Query error:', error);
        throw error;
      }

      console.log('📊 [SpeechTrendsAnalytics] Found', analyses?.length || 0, 'utterance analyses');

      if (!analyses || analyses.length === 0) {
        setLoading(false);
        return;
      }

      // Process daily metrics from utterance_analyses
      const dailyMap = new Map<string, { scoreSum: number; effortfulCount: number; total: number; correctCount: number }>();
      const errorTypeMap = new Map<string, number>();
      const categoryErrorMap = new Map<string, { errors: Map<string, number>; total: number }>();
      const wordDifficultyMap = new Map<string, {
        scoreSum: number;
        trials: number;
        effortfulCount: number;
        errors: Map<string, number>;
        correctCount: number;
      }>();
      let totalSpeechRate = 0;
      let totalPauseCount = 0;
      let totalPhonemeAcc = 0;
      let totalSemanticSim = 0;
      let speechRateCount = 0;
      let pauseCountCount = 0;
      let phonemeCount = 0;
      let semanticCount = 0;
      let circumlocutions = 0;

      analyses.forEach((analysis) => {
        const date = format(new Date(analysis.created_at || ''), 'MM/dd');

        // Daily metrics
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { scoreSum: 0, effortfulCount: 0, total: 0, correctCount: 0 });
        }
        const dayData = dailyMap.get(date)!;
        dayData.total += 1;

        // Calculate encouragement score from is_correct and error_type
        const encouragementScore = analysis.is_correct ? 100 : 
          analysis.error_type === 'attempted' ? 70 :
          analysis.error_type === 'circumlocution' ? 80 :
          analysis.error_type === 'phonemic_paraphasia' ? 66 :
          analysis.error_type === 'semantic_paraphasia' ? 50 : 30;
        dayData.scoreSum += encouragementScore;

        if (analysis.is_correct) {
          dayData.correctCount += 1;
        }
        if (analysis.effortful_speech === true) {
          dayData.effortfulCount += 1;
        }

        // Error type distribution
        const errorType = analysis.error_type || 'unknown';
        errorTypeMap.set(errorType, (errorTypeMap.get(errorType) || 0) + 1);

        // Category-level patterns
        const category = analysis.category || 'general';
        if (!categoryErrorMap.has(category)) {
          categoryErrorMap.set(category, { errors: new Map(), total: 0 });
        }
        const categoryData = categoryErrorMap.get(category)!;
        categoryData.total += 1;
        categoryData.errors.set(errorType, (categoryData.errors.get(errorType) || 0) + 1);

        // Word-level difficulty tracking
        const targetWord = analysis.target_word;
        if (targetWord) {
          if (!wordDifficultyMap.has(targetWord)) {
            wordDifficultyMap.set(targetWord, {
              scoreSum: 0,
              trials: 0,
              effortfulCount: 0,
              errors: new Map(),
              correctCount: 0,
            });
          }
          const wordData = wordDifficultyMap.get(targetWord)!;
          wordData.trials += 1;
          wordData.scoreSum += encouragementScore;
          if (analysis.is_correct) {
            wordData.correctCount += 1;
          }
          if (analysis.effortful_speech === true) {
            wordData.effortfulCount += 1;
          }
          wordData.errors.set(errorType, (wordData.errors.get(errorType) || 0) + 1);
        }

        // Acoustic metrics from utterance_analyses columns
        if (analysis.speech_rate_wpm) {
          totalSpeechRate += analysis.speech_rate_wpm;
          speechRateCount += 1;
        }
        if (analysis.pause_count !== null && analysis.pause_count !== undefined) {
          totalPauseCount += analysis.pause_count;
          pauseCountCount += 1;
        }

        // Phonological similarity (used as phoneme accuracy proxy)
        if (analysis.phonological_similarity !== null && analysis.phonological_similarity !== undefined) {
          totalPhonemeAcc += analysis.phonological_similarity;
          phonemeCount += 1;
        }

        // Semantic similarity
        if (analysis.semantic_similarity !== null && analysis.semantic_similarity !== undefined) {
          totalSemanticSim += analysis.semantic_similarity;
          semanticCount += 1;
        }

        // Circumlocution count
        if (analysis.error_type === 'circumlocution') {
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

      // Category patterns
      const categoryData: CategoryErrorPattern[] = Array.from(categoryErrorMap.entries())
        .map(([category, data]) => {
          const sortedErrors = Array.from(data.errors.entries()).sort((a, b) => b[1] - a[1]);
          const mostCommonError = sortedErrors[0]?.[0] || 'none';
          const errorCounts = Object.fromEntries(data.errors);
          return {
            category,
            mostCommonError,
            errorCounts,
            totalTrials: data.total,
          };
        })
        .sort((a, b) => b.totalTrials - a.totalTrials);

      // Difficult words
      const difficultWordsData: DifficultWord[] = Array.from(wordDifficultyMap.entries())
        .map(([targetWord, data]) => {
          const avgScore = data.trials > 0 ? Math.round(data.scoreSum / data.trials) : 0;
          const effortfulRate = data.trials > 0 ? Math.round((data.effortfulCount / data.trials) * 100) : 0;
          const sortedErrors = Array.from(data.errors.entries()).sort((a, b) => b[1] - a[1]);
          const mostCommonError = sortedErrors[0]?.[0] || 'none';
          return {
            targetWord,
            trials: data.trials,
            avgScore,
            effortfulRate,
            mostCommonError,
          };
        })
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 10);

      // Clinical snapshot
      const mostCommonError = errorData[0]?.errorType || 'none';
      const strongestCategory = categoryData.reduce((best, current) => {
        const correctRate = (current.errorCounts['correct'] || 0) / current.totalTrials;
        const attemptedRate = (current.errorCounts['attempted'] || 0) / current.totalTrials;
        const strengthScore = correctRate + (attemptedRate * 0.7);
        
        const bestCorrectRate = (best.errorCounts['correct'] || 0) / best.totalTrials;
        const bestAttemptedRate = (best.errorCounts['attempted'] || 0) / best.totalTrials;
        const bestScore = bestCorrectRate + (bestAttemptedRate * 0.7);
        
        return strengthScore > bestScore ? current : best;
      }, categoryData[0] || { category: 'none', errorCounts: {}, totalTrials: 0 });

      setDailyMetrics(dailyData);
      setErrorDistribution(errorData);
      setCategoryPatterns(categoryData);
      setDifficultWords(difficultWordsData);
      setClinicalSnapshot({
        mostCommonError,
        strongestCategory: strongestCategory?.category || 'none',
        totalTrials: analyses?.length || 0,
      });
      setKeyMetrics({
        avgSpeechRateWpm: speechRateCount > 0 ? Math.round(totalSpeechRate / speechRateCount) : 0,
        avgPauseCount: pauseCountCount > 0 ? Math.round((totalPauseCount / pauseCountCount) * 10) / 10 : 0,
        avgPhonemeAccuracy: phonemeCount > 0 ? Math.round((totalPhonemeAcc / phonemeCount) * 100) : 0,
        avgSemanticSimilarity: semanticCount > 0 ? Math.round((totalSemanticSim / semanticCount) * 100) : 0,
        circumlocutionCount: circumlocutions,
        totalTrials: analyses?.length || 0,
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
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-sm text-muted-foreground">Avg Phoneme Accuracy</p>
            </div>
            <p className="text-3xl font-bold">{keyMetrics.avgPhonemeAccuracy}%</p>
            <p className="text-xs text-muted-foreground mt-1">sound-level match</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-indigo-500" />
              <p className="text-sm text-muted-foreground">Avg Semantic Match</p>
            </div>
            <p className="text-3xl font-bold">{keyMetrics.avgSemanticSimilarity}%</p>
            <p className="text-xs text-muted-foreground mt-1">meaning-level match</p>
          </Card>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

        {/* Clinical Snapshot */}
        <Card className="p-6 mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-3 text-blue-900 dark:text-blue-100">Clinical Snapshot</h2>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Most Common Pattern</p>
                  <p className="text-blue-900 dark:text-blue-100 capitalize">
                    {clinicalSnapshot.mostCommonError.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Area of Strength</p>
                  <p className="text-blue-900 dark:text-blue-100 capitalize">
                    {clinicalSnapshot.strongestCategory}
                  </p>
                </div>
                <div>
                  <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Total Trials Analyzed</p>
                  <p className="text-blue-900 dark:text-blue-100">
                    {clinicalSnapshot.totalTrials}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Category Error Patterns */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Error Patterns by Category</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-left py-2 px-3">Most Common Error</th>
                  <th className="text-right py-2 px-3">Trials</th>
                  <th className="text-left py-2 px-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {categoryPatterns.map((pattern) => {
                  const correctCount = pattern.errorCounts['correct'] || 0;
                  const attemptedCount = pattern.errorCounts['attempted'] || 0;
                  const circumlocutionCount = pattern.errorCounts['circumlocution'] || 0;
                  const notes = 
                    correctCount / pattern.totalTrials > 0.7 ? 'Strong area' :
                    circumlocutionCount / pattern.totalTrials > 0.3 ? 'Frequent descriptions' :
                    attemptedCount / pattern.totalTrials > 0.4 ? 'Good effort, partial success' :
                    'Challenging area';
                  
                  return (
                    <tr key={pattern.category} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 capitalize">{pattern.category}</td>
                      <td className="py-2 px-3 capitalize">{pattern.mostCommonError.replace('_', ' ')}</td>
                      <td className="py-2 px-3 text-right">{pattern.totalTrials}</td>
                      <td className="py-2 px-3 text-sm text-muted-foreground">{notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {categoryPatterns.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No category data available yet
              </p>
            )}
          </div>
        </Card>

        {/* Difficult Words */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Most Challenging Words</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Word</th>
                  <th className="text-right py-2 px-3">Trials</th>
                  <th className="text-right py-2 px-3">Avg Score</th>
                  <th className="text-right py-2 px-3">Effortful %</th>
                  <th className="text-left py-2 px-3">Common Error</th>
                </tr>
              </thead>
              <tbody>
                {difficultWords.map((word) => (
                  <tr key={word.targetWord} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{word.targetWord}</td>
                    <td className="py-2 px-3 text-right">{word.trials}</td>
                    <td className="py-2 px-3 text-right">
                      <Badge variant={word.avgScore >= 70 ? 'default' : 'destructive'}>
                        {word.avgScore}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right">{word.effortfulRate}%</td>
                    <td className="py-2 px-3 capitalize text-sm text-muted-foreground">
                      {word.mostCommonError.replace('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {difficultWords.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No word difficulty data available yet
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
