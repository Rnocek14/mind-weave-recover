import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAuthedUser, userHasAnyRole, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PredictionRequest {
  userId: string;
  clinicalProfile: any;
  currentGoals: any[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, clinicalProfile, currentGoals }: PredictionRequest = await req.json();
    
    console.log("Predicting outcomes for user:", userId);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user's learning rates
    const { data: learningRates } = await supabase
      .from("learning_rates")
      .select("*")
      .eq("user_id", userId)
      .order("calculated_at", { ascending: false })
      .limit(10);

    // Fetch user's assessments
    const { data: assessments } = await supabase
      .from("standardized_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("assessment_date", { ascending: false });

    // Fetch cluster data for similar patients
    const strokeLocation = Array.isArray(clinicalProfile?.stroke_location)
      ? clinicalProfile.stroke_location[0]
      : clinicalProfile?.stroke_location;

    const { data: clusterData } = await supabase
      .from("cluster_learning_rates")
      .select("*")
      .eq("lesion_zone", strokeLocation)
      .eq("stroke_mechanism", clinicalProfile?.stroke_mechanism);

    // Prepare context for AI prediction
    const predictionContext = {
      clinical_profile: {
        stroke_mechanism: clinicalProfile?.stroke_mechanism,
        stroke_location: strokeLocation,
        affected_side: clinicalProfile?.affected_side,
        chronicity: clinicalProfile?.chronicity,
        severity: clinicalProfile?.severity,
      },
      learning_rates: learningRates?.map((lr) => ({
        domain: lr.domain,
        accuracy_slope: lr.accuracy_slope,
        rt_slope: lr.rt_slope,
        confidence: lr.confidence_score,
        window_days: lr.time_window_days,
      })) || [],
      assessments: assessments?.slice(0, 3).map((a) => ({
        type: a.assessment_type,
        date: a.assessment_date,
        scores: a.scores,
      })) || [],
      cluster_benchmarks: clusterData?.map((c) => ({
        domain: c.domain,
        median_learning_rate: c.median_accuracy_slope,
        user_count: c.user_count,
      })) || [],
      current_goals: currentGoals.map((g) => ({
        goal_text: g.goal_text,
        target_domain: g.target_domain,
        baseline_status: g.baseline_status,
        created_at: g.created_at,
      })),
    };

    const systemPrompt = `You are an expert neurorehabilitation AI analyzing stroke recovery data to predict functional outcomes.

Your task is to predict goal achievement probabilities and recovery trajectories based on:
1. Clinical profile (stroke type, location, severity, chronicity)
2. Learning rate patterns (how fast the patient is improving in different cognitive domains)
3. Standardized assessment scores (WAB-R, BNT, NIHSS, etc.)
4. Cluster benchmarks (how similar patients have performed)
5. Current functional goals

Provide evidence-based predictions considering:
- Early learning velocity is predictive of long-term outcomes
- Chronic stroke patients (>6 months) show slower but steady improvement
- Cluster performance indicates realistic achievement timelines
- Domain-specific learning rates predict domain-specific goal achievement

Be realistic but encouraging. Base predictions on actual data patterns.`;

    const userPrompt = `Analyze this stroke patient's data and predict outcomes for their functional goals:

${JSON.stringify(predictionContext, null, 2)}

For each functional goal, predict:
1. Achievement probability (0-1 scale)
2. Expected timeline (weeks to achievement)
3. Confidence level (low/medium/high)
4. Key factors influencing prediction
5. Recommendations to improve achievement likelihood

Also provide an overall recovery trajectory forecast for the next 6 months.`;

    // Call OpenAI with structured output
    console.log("Calling OpenAI gpt-4o for outcome prediction...");
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 1.0,
        max_tokens: 3000,
        tools: [
          {
            type: "function",
            function: {
              name: "predict_outcomes",
              description: "Predict functional goal achievement and recovery trajectories",
              parameters: {
                type: "object",
                properties: {
                  goal_predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        goal_text: { type: "string" },
                        achievement_probability: { 
                          type: "number",
                          minimum: 0,
                          maximum: 1
                        },
                        expected_weeks: { type: "number" },
                        confidence: { 
                          type: "string",
                          enum: ["low", "medium", "high"]
                        },
                        key_factors: {
                          type: "array",
                          items: { type: "string" }
                        },
                        recommendations: {
                          type: "array",
                          items: { type: "string" }
                        },
                      },
                      required: ["goal_text", "achievement_probability", "expected_weeks", "confidence", "key_factors", "recommendations"],
                    },
                  },
                  recovery_trajectory: {
                    type: "object",
                    properties: {
                      overall_prognosis: { type: "string" },
                      expected_improvement_rate: { type: "string" },
                      milestones: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            week: { type: "number" },
                            expected_status: { type: "string" },
                          },
                          required: ["week", "expected_status"],
                        },
                      },
                      risk_factors: {
                        type: "array",
                        items: { type: "string" }
                      },
                      strengths: {
                        type: "array",
                        items: { type: "string" }
                      },
                    },
                    required: ["overall_prognosis", "expected_improvement_rate", "milestones", "risk_factors", "strengths"],
                  },
                },
                required: ["goal_predictions", "recovery_trajectory"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "predict_outcomes" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "OpenAI API requires payment. Please check your OpenAI account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Extract structured prediction from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const prediction = JSON.parse(toolCall.function.arguments);

    // Store prediction in database for future reference
    const { error: insertError } = await supabase
      .from("outcome_predictions")
      .insert({
        user_id: userId,
        prediction_data: prediction,
        clinical_context: predictionContext,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error storing prediction:", insertError);
      // Don't fail the request if storage fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        prediction,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in predict-outcomes:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
