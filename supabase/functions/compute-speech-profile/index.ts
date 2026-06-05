import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getAuthedUser, userHasAnyRole, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComputeProfileRequest {
  user_id: string;
  profile_id?: string; // Optional - will look up active profile if not provided
  force?: boolean; // Skip debounce check for manual recomputes
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, profile_id: providedProfileId, force = false }: ComputeProfileRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Computing speech profile for user ${user_id} (force: ${force})...`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get profile_id - either provided or look up user's active profile
    let profile_id = providedProfileId;
    if (!profile_id) {
      const { data: activeProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (profileLookupError) {
        console.error('Error looking up active profile:', profileLookupError);
        throw new Error('Could not find active profile for user');
      }
      
      if (!activeProfile) {
        return new Response(
          JSON.stringify({ error: 'No active profile found for user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      profile_id = activeProfile.id;
    }

    console.log(`Using profile_id: ${profile_id}`);

    // First, check if speech profile exists and if we have enough new trials to justify recompute
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_speech_profiles')
      .select('*')
      .eq('user_id', user_id)
      .eq('profile_id', profile_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching existing speech profile:', profileError);
    }

    // CRITICAL: Read from utterance_analyses table (has accurate error classification)
    // instead of exercise_events (which had abandoned/incomplete data)
    const { data: analyses, error: fetchError } = await supabase
      .from('utterance_analyses')
      .select(`
        error_type,
        is_correct,
        cue_type_given,
        cue_was_effective,
        time_to_success_after_cue_ms,
        category,
        speech_rate_wpm,
        pause_count,
        total_pause_ms,
        avg_pause_duration_ms,
        effortful_speech,
        phonological_similarity,
        semantic_similarity,
        target_word,
        gop_data
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching utterance analyses:', fetchError);
      throw fetchError;
    }

    if (!analyses || analyses.length === 0) {
      console.log(`No utterance analyses found for user ${user_id}`);
      return new Response(
        JSON.stringify({ message: 'No utterance analyses found for this user', profile: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalTrials = analyses.length;
    const previousCount = existingProfile?.trial_count_at_computation ?? 0;
    const newTrials = totalTrials - previousCount;

    // Debounce: skip if we don't have enough new trials (min 10), unless force=true
    if (!force && existingProfile && newTrials > 0 && newTrials < 10) {
      console.log(
        `Skipping recompute for user ${user_id}: only ${newTrials} new trials since last computation (${previousCount} → ${totalTrials})`
      );
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'not_enough_new_trials',
          previousTrialCount: previousCount,
          totalTrials,
          newTrials,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${totalTrials} utterance analyses (${newTrials} new since last computation)...`);

    // Initialize aggregation structures
    const errorTypeCounts: Record<string, number> = {};
    const cueStats: Record<string, { success: number; total: number; avgTimeMs: number; totalTimeMs: number }> = {};
    const categoryStats: Record<string, { success: number; total: number }> = {};
    
    // Phoneme-level aggregation from Azure gop_data
    const phonemeStats: Record<string, { totalAccuracy: number; count: number }> = {};
    
    // ARPABET to IPA conversion map (Azure returns ARPABET, we store IPA)
    const ARPABET_TO_IPA: Record<string, string> = {
      'aa': 'ɑ', 'ae': 'æ', 'ah': 'ʌ', 'ao': 'ɔ', 'aw': 'aʊ', 'ay': 'aɪ',
      'ax': 'ə', // reduced vowel (schwa)
      'b': 'b', 'ch': 'tʃ', 'd': 'd', 'dh': 'ð', 'eh': 'ɛ', 'er': 'ɜ',
      'ey': 'eɪ', 'f': 'f', 'g': 'g', 'hh': 'h', 'ih': 'ɪ', 'iy': 'i',
      'jh': 'dʒ', 'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n', 'ng': 'ŋ',
      'ow': 'oʊ', 'oy': 'ɔɪ', 'p': 'p', 'r': 'r', 's': 's', 'sh': 'ʃ',
      't': 't', 'th': 'θ', 'uh': 'ʊ', 'uw': 'u', 'v': 'v', 'w': 'w',
      'y': 'j', 'z': 'z', 'zh': 'ʒ',
    };
    
    // Rhotic equivalence for consistent lookups
    const RHOTIC_EQUIV: Record<string, string> = {
      '/ɚ/': '/ɜ/',
      '/ɝ/': '/ɜ/',
      '/ɹ/': '/r/',
    };
    
    // Normalize Azure phoneme to IPA key (bulletproof version)
    function toIpaKey(raw: string | null | undefined): string | null {
      if (!raw) return null;
      
      // Strip slashes and digits, lowercase
      const stripped = raw.replace(/\//g, '').toLowerCase().replace(/[0-9]/g, '');
      if (!stripped) return null;
      
      // If it contains obvious IPA characters (non a-z), treat as IPA already
      const looksLikeIpa = /[^a-z]/.test(stripped);
      if (looksLikeIpa) {
        const key = `/${stripped}/`;
        return RHOTIC_EQUIV[key] || key;
      }
      
      // ARPABET → IPA (includes ax!)
      const ipa = ARPABET_TO_IPA[stripped];
      const key = `/${ipa ?? stripped}/`;
      
      return RHOTIC_EQUIV[key] || key;
    }
    
    // Diagnostic counters for phoneme coverage
    let trialsWithGopData = 0;
    let trialsWithAnyPhonemes = 0;
    let trialsWithNonZeroAccuracy = 0;
    let totalPhonemeTokens = 0;
    
    // Fluency aggregation
    let totalWpm = 0;
    let wpmCount = 0;
    let totalPauseCount = 0;
    let totalPauseDuration = 0;
    let pauseMetricCount = 0;
    let effortfulCount = 0;
    
    // Similarity aggregation for insight generation
    let totalSemanticSimilarity = 0;
    let semanticCount = 0;
    let totalPhonologicalSimilarity = 0;
    let phonologicalCount = 0;

    // Process each analysis
    for (const analysis of analyses) {
      // Error type distribution (from accurate classification)
      const errorType = analysis.error_type ?? 'unknown';
      errorTypeCounts[errorType] = (errorTypeCounts[errorType] || 0) + 1;

      // Cue efficacy by type
      if (analysis.cue_type_given && analysis.cue_type_given !== 'none') {
        const cueType = analysis.cue_type_given;
        if (!cueStats[cueType]) {
          cueStats[cueType] = { success: 0, total: 0, avgTimeMs: 0, totalTimeMs: 0 };
        }
        cueStats[cueType].total += 1;
        if (analysis.cue_was_effective === true) {
          cueStats[cueType].success += 1;
          if (analysis.time_to_success_after_cue_ms) {
            cueStats[cueType].totalTimeMs += analysis.time_to_success_after_cue_ms;
          }
        }
      }

      // Category-based stats
      const category = analysis.category;
      if (category) {
        if (!categoryStats[category]) {
          categoryStats[category] = { success: 0, total: 0 };
        }
        categoryStats[category].total += 1;
        if (analysis.is_correct === true || errorType === 'correct') {
          categoryStats[category].success += 1;
        }
      }

      // Fluency metrics (from utterance_analyses)
      if (analysis.speech_rate_wpm != null && analysis.speech_rate_wpm > 0) {
        totalWpm += analysis.speech_rate_wpm;
        wpmCount += 1;
      }
      
      if (analysis.pause_count != null) {
        totalPauseCount += analysis.pause_count;
        pauseMetricCount += 1;
      }
      
      if (analysis.total_pause_ms != null) {
        totalPauseDuration += analysis.total_pause_ms;
      }
      
      if (analysis.effortful_speech === true) {
        effortfulCount += 1;
      }
      
      // Similarity metrics for advanced insights
      if (analysis.semantic_similarity != null) {
        totalSemanticSimilarity += analysis.semantic_similarity;
        semanticCount += 1;
      }
      
      if (analysis.phonological_similarity != null) {
        totalPhonologicalSimilarity += analysis.phonological_similarity;
        phonologicalCount += 1;
      }
      
      // Extract phoneme-level accuracy from Azure gop_data
      // gop_data.words[].phonemes[] contains phoneme scores from Azure Pronunciation Assessment
      const gopData = analysis.gop_data as {
        source?: string;
        words?: Array<{
          word?: string;
          phonemes?: Array<{
            phoneme?: string;
            accuracyScore?: number;
          }>;
        }>;
      } | null;
      
      if (gopData?.source === 'azure' && gopData.words) {
        trialsWithGopData++;
        let trialHasPhonemes = false;
        let trialHasNonZeroAccuracy = false;
        
        for (const word of gopData.words) {
          if (word.phonemes && word.phonemes.length > 0) {
            trialHasPhonemes = true;
            for (const phoneme of word.phonemes) {
              const key = toIpaKey(phoneme.phoneme);
              if (key && phoneme.accuracyScore != null) {
                totalPhonemeTokens++;
                if (phoneme.accuracyScore > 0) trialHasNonZeroAccuracy = true;
                if (!phonemeStats[key]) {
                  phonemeStats[key] = { totalAccuracy: 0, count: 0 };
                }
                phonemeStats[key].totalAccuracy += phoneme.accuracyScore;
                phonemeStats[key].count += 1;
              }
            }
          }
        }
        if (trialHasPhonemes) trialsWithAnyPhonemes++;
        if (trialHasNonZeroAccuracy) trialsWithNonZeroAccuracy++;
      }
    }
    
    // Log phoneme coverage diagnostic (3-tier breakdown)
    console.log(`[phonemes] coverage: gop_data=${trialsWithGopData}, withPhonemes=${trialsWithAnyPhonemes}, nonZeroAccuracy=${trialsWithNonZeroAccuracy} of ${analyses.length} trials, totalTokens=${totalPhonemeTokens}`);

    // Compute cue efficacy with success rates and average times
    const cueEfficacyByType: Record<string, { successRate: number; success: number; total: number; avgTimeToSuccessMs: number }> = {};
    for (const [type, stats] of Object.entries(cueStats)) {
      const successRate = stats.total > 0 ? stats.success / stats.total : 0;
      const avgTimeMs = stats.success > 0 ? stats.totalTimeMs / stats.success : 0;
      cueEfficacyByType[type] = {
        successRate: Math.round(successRate * 100) / 100,
        success: stats.success,
        total: stats.total,
        avgTimeToSuccessMs: Math.round(avgTimeMs)
      };
    }

    // Compute category-based stats
    const cueEfficacyByCategory: Record<string, { successRate: number; success: number; total: number }> = {};
    for (const [category, stats] of Object.entries(categoryStats)) {
      cueEfficacyByCategory[category] = {
        successRate: Math.round((stats.total > 0 ? stats.success / stats.total : 0) * 100) / 100,
        success: stats.success,
        total: stats.total
      };
    }

    // Find most challenging categories (lowest success rates, min 3 trials)
    const challengingCategories = Object.entries(cueEfficacyByCategory)
      .filter(([_, stats]) => stats.total >= 3)
      .sort((a, b) => a[1].successRate - b[1].successRate)
      .slice(0, 5)
      .map(([category, stats]) => ({ 
        category, 
        successRate: stats.successRate, 
        trials: stats.total 
      }));

    // Compute average similarities for insight generation
    const avgSemanticSimilarity = semanticCount > 0 
      ? Math.round((totalSemanticSimilarity / semanticCount) * 100) / 100 
      : null;
    const avgPhonologicalSimilarity = phonologicalCount > 0 
      ? Math.round((totalPhonologicalSimilarity / phonologicalCount) * 100) / 100 
      : null;

    // Compute phoneme difficulty map (accuracy 0-100, only include phonemes with >= 2 samples)
    const phonemeDifficultyMap: Record<string, { accuracy: number; trials: number }> = {};
    for (const [phoneme, stats] of Object.entries(phonemeStats)) {
      if (stats.count >= 2) {
        phonemeDifficultyMap[phoneme] = {
          accuracy: Math.round(stats.totalAccuracy / stats.count),
          trials: stats.count,
        };
      }
    }
    
    console.log('Phoneme difficulty map:', JSON.stringify(phonemeDifficultyMap, null, 2));

    // Build the profile object
    const profile = {
      user_id,
      profile_id, // Now required - from lookup or provided
      error_type_distribution: errorTypeCounts,
      cue_efficacy_by_type: cueEfficacyByType,
      cue_efficacy_by_category: cueEfficacyByCategory,
      most_challenging_categories: challengingCategories,
      phoneme_difficulty_map: phonemeDifficultyMap,
      baseline_wpm: wpmCount > 0 ? Math.round((totalWpm / wpmCount) * 10) / 10 : null,
      baseline_pause_frequency: pauseMetricCount > 0 ? Math.round((totalPauseCount / pauseMetricCount) * 100) / 100 : null,
      avg_stall_duration_ms: pauseMetricCount > 0 && totalPauseDuration > 0 
        ? Math.round(totalPauseDuration / pauseMetricCount) 
        : null,
      effortful_speech_rate: totalTrials > 0 ? Math.round((effortfulCount / totalTrials) * 100) / 100 : null,
      last_computed_at: new Date().toISOString(),
      trial_count_at_computation: totalTrials,
      updated_at: new Date().toISOString(),
      // Phoneme coverage metadata
      trials_with_gop_data: trialsWithGopData,
      trials_with_phonemes: trialsWithAnyPhonemes,
      trials_with_nonzero_accuracy: trialsWithNonZeroAccuracy,
      phoneme_token_count: totalPhonemeTokens,
    };

    console.log('Profile computed:', JSON.stringify({
      ...profile,
      _meta: {
        avgSemanticSimilarity,
        avgPhonologicalSimilarity,
        wpmSampleSize: wpmCount,
        pauseSampleSize: pauseMetricCount,
        effortfulTrials: effortfulCount,
      }
    }, null, 2));

    // Upsert into user_speech_profiles (now with proper unique constraint)
    const { data: upsertedProfile, error: upsertError } = await supabase
      .from('user_speech_profiles')
      .upsert(profile, { onConflict: 'user_id,profile_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('Upsert failed:', {
        message: upsertError.message,
        details: (upsertError as any).details,
        hint: (upsertError as any).hint,
        code: (upsertError as any).code,
      });
      throw upsertError;
    }

    console.log(`Speech profile computed successfully for user ${user_id}`);

    // Insert snapshot for trend tracking (only if we have meaningful data)
    const shouldSnapshot = totalTrials > 0 && Object.keys(phonemeDifficultyMap).length > 0;
    
    if (shouldSnapshot) {
      // Check if we already have a snapshot with the same trial count (avoid force-recompute spam)
      const { data: lastSnapshot } = await supabase
        .from('speech_profile_snapshots')
        .select('trial_count_at_computation')
        .eq('user_id', user_id)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const alreadySnapshotted = lastSnapshot?.trial_count_at_computation === totalTrials;

      if (!alreadySnapshotted) {
        const { error: snapshotError } = await supabase
          .from('speech_profile_snapshots')
          .insert({
            user_id,
            profile_id, // Now required
            computed_at: profile.last_computed_at,
            trial_count_at_computation: totalTrials,
            phoneme_difficulty_map: phonemeDifficultyMap,
            error_type_distribution: errorTypeCounts,
            cue_efficacy_by_type: cueEfficacyByType,
            // Phoneme coverage metadata
            trials_with_gop_data: trialsWithGopData,
            trials_with_phonemes: trialsWithAnyPhonemes,
            trials_with_nonzero_accuracy: trialsWithNonZeroAccuracy,
            phoneme_token_count: totalPhonemeTokens,
          });

        if (snapshotError) {
          // Non-fatal: log but don't fail the whole operation
          console.error('Error inserting snapshot (non-fatal):', snapshotError);
        } else {
          console.log(`Snapshot inserted for user ${user_id} at ${totalTrials} trials`);
        }
      } else {
        console.log(`Skipping snapshot: already have one at ${totalTrials} trials`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: upsertedProfile,
        analysesProcessed: totalTrials,
        newTrials,
        previousTrialCount: previousCount,
        insights: {
          avgSemanticSimilarity,
          avgPhonologicalSimilarity,
          effortfulRate: profile.effortful_speech_rate,
          baselineWpm: profile.baseline_wpm,
        }
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
