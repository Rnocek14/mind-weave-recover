import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComputeProfileRequest {
  user_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id }: ComputeProfileRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Computing speech profile for user ${user_id}...`);

    // First get sessions for this user
    const { data: userSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user_id);

    if (sessionsError) {
      console.error('Error fetching user sessions:', sessionsError);
      throw sessionsError;
    }

    if (!userSessions || userSessions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No sessions found for this user', profile: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionIds = userSessions.map(s => s.id);

    // Fetch all exercise events for these sessions
    const { data: events, error: fetchError } = await supabase
      .from('exercise_events')
      .select('error_type, cue_type_given, cue_was_effective, time_to_success_after_cue_ms, utterance_analysis, task_parameters')
      .in('session_id', sessionIds);

    if (fetchError) {
      console.error('Error fetching exercise events:', fetchError);
      throw fetchError;
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No exercise events found for this user', profile: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${events.length} exercise events...`);

    // Initialize aggregation structures
    const errorTypeCounts: Record<string, number> = {};
    const cueStats: Record<string, { success: number; total: number; avgTimeMs: number; totalTimeMs: number }> = {};
    const categoryStats: Record<string, { success: number; total: number }> = {};
    let totalWpm = 0;
    let wpmCount = 0;
    let totalPauseCount = 0;
    let totalPauseDuration = 0;
    let pauseMetricCount = 0;
    let effortfulCount = 0;

    // Process each event
    for (const event of events) {
      // Error type distribution
      const errorType = event.error_type ?? 'unknown';
      errorTypeCounts[errorType] = (errorTypeCounts[errorType] || 0) + 1;

      // Cue efficacy by type
      if (event.cue_type_given && event.cue_type_given !== 'none') {
        const cueType = event.cue_type_given;
        if (!cueStats[cueType]) {
          cueStats[cueType] = { success: 0, total: 0, avgTimeMs: 0, totalTimeMs: 0 };
        }
        cueStats[cueType].total += 1;
        if (event.cue_was_effective === true) {
          cueStats[cueType].success += 1;
          if (event.time_to_success_after_cue_ms) {
            cueStats[cueType].totalTimeMs += event.time_to_success_after_cue_ms;
          }
        }
      }

      // Category-based stats (from task_parameters)
      const category = event.task_parameters?.category;
      if (category) {
        if (!categoryStats[category]) {
          categoryStats[category] = { success: 0, total: 0 };
        }
        categoryStats[category].total += 1;
        if (errorType === 'correct') {
          categoryStats[category].success += 1;
        }
      }

      // Fluency metrics from utterance_analysis
      const ua = event.utterance_analysis as any;
      if (ua?.fluency) {
        if (typeof ua.fluency.speechRateWpm === 'number') {
          totalWpm += ua.fluency.speechRateWpm;
          wpmCount += 1;
        }
        if (typeof ua.fluency.pauseCount === 'number') {
          totalPauseCount += ua.fluency.pauseCount;
          pauseMetricCount += 1;
        }
        if (typeof ua.fluency.avgPauseDurationMs === 'number') {
          totalPauseDuration += ua.fluency.avgPauseDurationMs;
        }
        if (ua.fluency.effortfulSpeech === true) {
          effortfulCount += 1;
        }
      }
    }

    // Compute cue efficacy with success rates and average times
    const cueEfficacyByType: Record<string, { successRate: number; success: number; total: number; avgTimeToSuccessMs: number }> = {};
    for (const [type, stats] of Object.entries(cueStats)) {
      const successRate = stats.total > 0 ? stats.success / stats.total : 0;
      const avgTimeMs = stats.success > 0 ? stats.totalTimeMs / stats.success : 0;
      cueEfficacyByType[type] = {
        successRate,
        success: stats.success,
        total: stats.total,
        avgTimeToSuccessMs: Math.round(avgTimeMs)
      };
    }

    // Compute category-based cue efficacy
    const cueEfficacyByCategory: Record<string, { successRate: number; success: number; total: number }> = {};
    for (const [category, stats] of Object.entries(categoryStats)) {
      cueEfficacyByCategory[category] = {
        successRate: stats.total > 0 ? stats.success / stats.total : 0,
        success: stats.success,
        total: stats.total
      };
    }

    // Find most challenging categories (lowest success rates, min 3 trials)
    const challengingCategories = Object.entries(cueEfficacyByCategory)
      .filter(([_, stats]) => stats.total >= 3)
      .sort((a, b) => a[1].successRate - b[1].successRate)
      .slice(0, 5)
      .map(([category, stats]) => ({ category, successRate: stats.successRate, trials: stats.total }));

    // Build the profile object
    const profile = {
      user_id,
      profile_id: null, // TODO: support multi-profile when needed
      error_type_distribution: errorTypeCounts,
      cue_efficacy_by_type: cueEfficacyByType,
      cue_efficacy_by_category: cueEfficacyByCategory,
      most_challenging_categories: challengingCategories,
      baseline_wpm: wpmCount > 0 ? Math.round((totalWpm / wpmCount) * 100) / 100 : null,
      baseline_pause_frequency: pauseMetricCount > 0 ? Math.round((totalPauseCount / pauseMetricCount) * 100) / 100 : null,
      avg_stall_duration_ms: pauseMetricCount > 0 ? Math.round(totalPauseDuration / pauseMetricCount) : null,
      effortful_speech_rate: events.length > 0 ? Math.round((effortfulCount / events.length) * 100) / 100 : null,
      last_computed_at: new Date().toISOString(),
      trial_count_at_computation: events.length,
      updated_at: new Date().toISOString()
    };

    console.log('Profile computed:', JSON.stringify(profile, null, 2));

    // Upsert into user_speech_profiles
    // The unique constraint is on (user_id, profile_id), so we specify both in onConflict
    const { data: upsertedProfile, error: upsertError } = await supabase
      .from('user_speech_profiles')
      .upsert(profile, { onConflict: 'user_id,profile_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
      throw upsertError;
    }

    console.log(`Speech profile computed successfully for user ${user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: upsertedProfile,
        eventsProcessed: events.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compute-speech-profile:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
