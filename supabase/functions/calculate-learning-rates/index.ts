import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LearningRateResult {
  userId: string;
  profileId: string | null;
  domain: string;
  timeWindowDays: number;
  accuracySlope: number;
  rtSlope: number;
  trialCount: number;
  startAccuracy: number;
  endAccuracy: number;
  startDate: string;
  endDate: string;
  confidenceScore: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, allUsers } = await req.json();

    console.log('Starting learning rate calculation:', { userId, allUsers });

    let userIds: string[] = [];

    if (allUsers) {
      // Get all users who have had activity in last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: activeSessions } = await supabase
        .from('sessions')
        .select('user_id')
        .gte('started_at', ninetyDaysAgo.toISOString());

      if (activeSessions) {
        userIds = [...new Set(activeSessions.map(s => s.user_id))];
      }
      console.log(`Found ${userIds.length} active users`);
    } else if (userId) {
      userIds = [userId];
    } else {
      throw new Error('Must provide userId or allUsers=true');
    }

    const results = [];
    // Added speech and language domains for full coverage
    const domains = ['phonological', 'semantic', 'grammar', 'motor', 'visuospatial', 'speech', 'language'];
    const windows = [7, 14, 30];

    for (const uid of userIds) {
      console.log(`Calculating learning rates for user ${uid}`);
      
      for (const domain of domains) {
        for (const window of windows) {
          try {
            const result = await calculateLearningRate(supabase, uid, domain, window);
            if (result) {
              await saveLearningRate(supabase, result);
              results.push({ userId: uid, domain, window, success: true });
            }
          } catch (err) {
            console.error(`Error calculating ${domain} ${window}d for ${uid}:`, err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            results.push({ userId: uid, domain, window, success: false, error: errorMessage });
          }
        }
      }
    }

    console.log('Learning rate calculation complete:', {
      totalUsers: userIds.length,
      totalCalculations: results.length,
      successful: results.filter(r => r.success).length
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        usersProcessed: userIds.length,
        calculations: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calculate-learning-rates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function calculateLearningRate(
  supabase: any,
  userId: string,
  domain: string,
  windowDays: number
): Promise<LearningRateResult | null> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - windowDays);

  // Get sessions in time window
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', startDate.toISOString())
    .lte('started_at', endDate.toISOString());

  if (!sessions || sessions.length === 0) {
    return null;
  }

  const sessionIds = sessions.map((s: any) => s.id);
  const exerciseSlug = getDomainExerciseSlug(domain);

  // Fetch exercise events
  const { data: events } = await supabase
    .from('exercise_events')
    .select('score, reaction_time_ms, created_at')
    .in('session_id', sessionIds)
    .eq('exercise_slug', exerciseSlug)
    .not('reaction_time_ms', 'is', null)
    .order('created_at', { ascending: true });

  if (!events || events.length < 10) {
    return null; // Need minimum 10 trials
  }

  // Group by day
  const dailyData = groupByDay(events);
  
  if (dailyData.length < 3) {
    return null; // Need at least 3 days
  }

  // Calculate slopes
  const accuracySlope = linearRegression(
    dailyData.map(d => d.dayIndex),
    dailyData.map(d => d.accuracy)
  );

  const rtSlope = linearRegression(
    dailyData.map(d => d.dayIndex),
    dailyData.map(d => d.avgReactionTime)
  );

  const confidenceScore = calculateConfidence(events.length, dailyData.length);

  return {
    userId,
    domain,
    timeWindowDays: windowDays,
    accuracySlope,
    rtSlope,
    trialCount: events.length,
    startAccuracy: dailyData[0].accuracy,
    endAccuracy: dailyData[dailyData.length - 1].accuracy,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    confidenceScore
  };
}

async function saveLearningRate(supabase: any, result: LearningRateResult): Promise<void> {
  const { error } = await supabase
    .from('learning_rates')
    .upsert({
      user_id: result.userId,
      domain: result.domain,
      time_window_days: result.timeWindowDays,
      accuracy_slope: result.accuracySlope,
      rt_slope: result.rtSlope,
      trial_count: result.trialCount,
      start_accuracy: result.startAccuracy,
      end_accuracy: result.endAccuracy,
      start_date: result.startDate,
      end_date: result.endDate,
      confidence_score: result.confidenceScore,
      calculated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,domain,time_window_days,end_date'
    });

  if (error) {
    console.error('Error saving learning rate:', error);
    throw error;
  }
}

function getDomainExerciseSlug(domain: string): string {
  // Use normalized slugs (underscores, lowercase) for consistent analytics
  const mapping: Record<string, string> = {
    'phonological': 'phonological_awareness',
    'semantic': 'semantic_features',
    'grammar': 'sentence_construction',
    'motor': 'reach_tap',
    'visuospatial': 'left_side_hunt',
    'speech': 'photo_naming',      // NEW: speech domain
    'language': 'phrase_practice', // NEW: language domain
  };
  return mapping[domain] || 'photo_naming';
}

interface DailyDataPoint {
  dayIndex: number;
  date: string;
  accuracy: number;
  avgReactionTime: number;
  trialCount: number;
}

function groupByDay(events: any[]): DailyDataPoint[] {
  const dayMap = new Map<string, { correct: number; total: number; rtSum: number; rtCount: number }>();

  events.forEach(event => {
    const date = event.created_at.split('T')[0];
    const existing = dayMap.get(date) || { correct: 0, total: 0, rtSum: 0, rtCount: 0 };
    
    existing.total += 1;
    if (event.score > 0) existing.correct += 1;
    if (event.reaction_time_ms) {
      existing.rtSum += event.reaction_time_ms;
      existing.rtCount += 1;
    }
    
    dayMap.set(date, existing);
  });

  const sortedDays = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data], index) => ({
      dayIndex: index,
      date,
      accuracy: data.total > 0 ? data.correct / data.total : 0,
      avgReactionTime: data.rtCount > 0 ? data.rtSum / data.rtCount : 0,
      trialCount: data.total
    }));

  return sortedDays;
}

function linearRegression(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  return isNaN(slope) ? 0 : slope;
}

function calculateConfidence(trialCount: number, dayCount: number): number {
  const trialScore = Math.min(1, trialCount / 50);
  const dayScore = Math.min(1, dayCount / 7);
  
  return Math.round((trialScore * 0.6 + dayScore * 0.4) * 100) / 100;
}
