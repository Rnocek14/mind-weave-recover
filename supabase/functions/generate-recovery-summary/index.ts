import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getAuthedUser, userHasAnyRole, isAssignedClinician, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateSummaryRequest {
  userId: string;
  profileId?: string | null;
  summaryType: 'progress' | 'education';
  trialCount?: number; // Optional: current trial count for tracking
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { userId, profileId, summaryType, trialCount }: GenerateSummaryRequest = await req.json();

    if (!userId || !summaryType) {
      return new Response(
        JSON.stringify({ error: 'userId and summaryType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helper: scope a query to the active profile when profileId is provided
    const scope = (q: any) => (profileId ? q.eq('profile_id', profileId) : q);
    // Profiles row for the active profile (avoids .single() failures for multi-profile users)
    const profileFilter = (q: any) =>
      profileId ? q.eq('id', profileId) : q.eq('user_id', userId).eq('is_active', true);

    // Fetch data based on summary type
    let dataSnapshot: any = {};
    let systemPrompt = '';
    let userPrompt = '';

    if (summaryType === 'progress') {
      // Fetch progress-related data
      const [profileRes, capabilityRes, learningRatesRes, goalsRes] = await Promise.all([
        profileFilter(supabase.from('profiles').select('stroke_date, clinical_profile')).maybeSingle(),
        scope(supabase.from('capability_assessments').select('*').eq('user_id', userId)).order('assessed_at', { ascending: false }).limit(5),
        scope(supabase.from('learning_rates').select('*').eq('user_id', userId)).order('calculated_at', { ascending: false }).limit(10),
        scope(supabase.from('functional_goals').select('*, goal_progress_ratings(*)').eq('user_id', userId)).is('archived_at', null)
      ]);

      const profile = profileRes.data;
      const capabilities = capabilityRes.data || [];
      const learningRates = learningRatesRes.data || [];
      const goals = goalsRes.data || [];

      // Calculate time since stroke
      const monthsSinceStroke = profile?.stroke_date 
        ? Math.floor((Date.now() - new Date(profile.stroke_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
        : null;

      dataSnapshot = {
        profile: profile?.clinical_profile,
        monthsSinceStroke,
        capabilities: capabilities.map(c => ({
          date: c.assessed_at,
          vision: c.vision_score,
          motor: c.motor_score,
          attention: c.attention_score,
          confidence: c.confidence_score
        })),
        learningRates: learningRates.map(lr => ({
          domain: lr.domain,
          accuracySlope: lr.accuracy_slope,
          trialCount: lr.trial_count,
          timeWindow: lr.time_window_days
        })),
        goals: goals.map(g => ({
          text: g.goal_text,
          domain: g.target_domain,
          baseline: g.baseline_status,
          latestRating: g.goal_progress_ratings?.[0]?.status
        }))
      };

      systemPrompt = `You are a compassionate neurorehabilitation specialist explaining a patient's recovery progress. Use specific data but avoid medical jargon. Be encouraging and realistic.`;

      userPrompt = `Based on this stroke recovery data, generate a clear, compassionate summary:

Stroke Context:
- Time since stroke: ${monthsSinceStroke || 'Unknown'} months
- Clinical profile: ${JSON.stringify(profile?.clinical_profile || {}, null, 2)}

Capability Trends (most recent first):
${capabilities.slice(0, 3).map((c, i) => `${i === 0 ? 'Current' : `${i} assessment(s) ago`}: Vision ${c.vision_score}/10, Motor ${c.motor_score}/10, Attention ${c.attention_score}/10`).join('\n')}

Learning Rates:
${learningRates.slice(0, 5).map(lr => `- ${lr.domain}: ${lr.accuracy_slope > 0 ? 'improving' : lr.accuracy_slope < 0 ? 'declining' : 'stable'} (${lr.trial_count} trials)`).join('\n')}

Functional Goals:
${goals.map(g => `- ${g.goal_text} (${g.target_domain}): ${g.latestRating || g.baseline_status}`).join('\n')}

Generate a 3-paragraph narrative covering:
1. Overall trajectory (Are they improving, stable, or facing challenges?)
2. What's working well (specific exercises or domains showing progress)
3. Areas needing attention (with specific encouragement)

Then provide 3-5 key insights as an array of brief, actionable statements.

Return your response as JSON:
{
  "summary": "3-paragraph narrative here",
  "keyInsights": ["insight 1", "insight 2", ...]
}`;

    } else {
      // Education mode - fetch clinical data
      const [profileRes, notesRes] = await Promise.all([
        profileFilter(supabase.from('profiles').select('clinical_profile')).maybeSingle(),
        scope(supabase.from('clinical_notes').select('raw_text, document_date, note_type').eq('user_id', userId)).order('document_date', { ascending: false }).limit(1)
      ]);

      const profile = profileRes.data?.clinical_profile || {};
      const latestNote = notesRes.data?.[0];

      dataSnapshot = {
        clinicalProfile: profile,
        latestNote: latestNote ? {
          date: latestNote.document_date,
          type: latestNote.note_type,
          excerpt: latestNote.raw_text?.substring(0, 500)
        } : null
      };

      systemPrompt = `You are a neurologist explaining stroke effects to a patient and their family. Use clear analogies, avoid medical jargon, be compassionate and provide realistic hope.`;

      userPrompt = `Explain this stroke in plain language:

Stroke Location: ${profile.stroke_location || 'Not specified'}
Affected Side: ${profile.affected_side || 'Not specified'}
Stroke Mechanism: ${profile.extraction_metadata?.stroke_mechanism || 'Not specified'}

Impairments:
- Motor: ${profile.impairments?.motor?.join(', ') || 'None noted'}
- Speech: ${profile.impairments?.speech?.join(', ') || 'None noted'}
- Visual: ${profile.impairments?.visual?.join(', ') || 'None noted'}
- Cognitive: ${profile.impairments?.cognitive?.join(', ') || 'None noted'}

Generate:
1. Plain-language explanation of affected brain regions (2-3 sentences using analogies like "language center", "movement controller")
2. Why each impairment occurs (as bullet points)
3. What these impairments mean for daily activities
4. Realistic recovery expectations with encouragement

Return as JSON:
{
  "summary": "Full educational narrative",
  "keyInsights": ["key point 1", "key point 2", ...]
}`;
    }

    // Call OpenAI
    console.log('Calling OpenAI gpt-4o-mini for summary generation...');
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API requires payment. Please check your OpenAI account.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content received from AI');
    }

    // Parse AI response
    let parsedResponse;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/) || aiContent.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
      parsedResponse = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      // Fallback: treat entire response as summary
      parsedResponse = {
        summary: aiContent,
        keyInsights: ['AI-generated summary (parsing issue)']
      };
    }

    const generationDuration = Date.now() - startTime;

    // Store in database
    const { data: summary, error: insertError } = await supabase
      .from('recovery_summaries')
      .insert({
        user_id: userId,
        profile_id: profileId ?? null,
        summary_type: summaryType,
        data_snapshot: dataSnapshot,
        ai_summary: parsedResponse.summary,
        key_insights: parsedResponse.keyInsights || [],
        model_used: 'gpt-4o-mini',
        generation_duration_ms: generationDuration,
        confidence_score: 0.85,
        trial_count_at_generation: trialCount || 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log(`Summary generated in ${generationDuration}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        generationDuration 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-recovery-summary:', error);
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
