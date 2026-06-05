// Score Discourse Turn — LLM-first clinical scoring with structured output
// Returns a ClinicalSignal that drives discourse adaptation.
// Used by ConversationPartner + ThoughtContinuation.
import { getAuthedUser, jsonResponse } from "../_shared/auth.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// User selected gpt-5-mini for clinical accuracy. ~3-5s typical latency.
const MODEL = "openai/gpt-5-mini";

interface ScoreRequest {
  exerciseSlug: string;            // 'conversation_partner' | 'thought_continuation'
  promptText: string;              // What Maya / the system asked
  transcript: string;              // What the user said
  taskGoal?: string;               // Optional: what the user was supposed to do
  topicKeywords?: string[];        // Optional: expected on-topic vocabulary
  wordCount: number;
  latencyToFirstWordMs: number | null;
  durationMs: number | null;
  scaffoldUsed?: boolean;          // Did we give a hint?
  turnNumber?: number;
  /**
   * Prompt rubric version. Defaults to the calibrated production version (v2).
   * v3 underperformed v2 on the labeled dataset (-17.4% overall accuracy) and
   * is kept ONLY for offline calibration A/B experiments. Do not promote
   * without re-running the calibration runner and beating v2.
   */
  promptVersion?: "v2" | "v3";
}

const DEFAULT_PROMPT_VERSION: "v2" | "v3" = "v2";

const ERROR_TYPES = [
  "fluent_correct",
  "off_topic",
  "incomplete",
  "word_finding",
  "circumlocution",
  "semantic_paraphasia",
  "phonemic_issue",
  "no_response",
  "surrender",
  "unclear",
] as const;

// v2 — production rubric. Hardened (2026-04-24) to prevent fluent-but-unrelated
// answers from being rewarded as `fluent_correct` and to anchor `off_topic`
// to topical relevance, not grammaticality.
const SYSTEM_PROMPT_V2 = `You are a clinical aphasia speech-language pathologist scoring a single user turn in a stroke rehabilitation exercise.

Score the user's response against the prompt. Be honest but charitable: stroke survivors have language impairments, so partial answers can still be successful.

Return ONLY via the score_turn tool with these fields:

- onTopicScore (0..1): How well the response addresses the prompt's topic. 1.0 = directly on topic. 0 = unrelated.
- targetAchievementScore (0..1): Did they accomplish the communicative task? Did they answer the question, finish the thought, or share the requested information? Volume of speech does NOT mean success.
- responseQualityScore (0..1): Specificity, structure, and coherence. Vague/disorganized = low. Specific/structured = high.
- errorType: One of fluent_correct, off_topic, incomplete, word_finding, circumlocution, semantic_paraphasia, phonemic_issue, no_response, surrender, unclear.
  - fluent_correct: clear, on-topic, complete
  - off_topic: spoken but unrelated to prompt
  - incomplete: trailed off, ran out of words mid-thought
  - word_finding: long pauses or "the thing", "you know" patterns suggesting anomia
  - circumlocution: talked around the target without naming it
  - semantic_paraphasia: substituted a related but wrong word ("fork" for "spoon")
  - phonemic_issue: target word distorted phonologically
  - no_response: didn't speak
  - surrender: "I don't know", "skip", "I can't"
  - unclear: cannot tell what they were trying to say
- confidence (0..1): How sure are you of this scoring?
- recommendedAdaptation: 'up' | 'down' | 'hold'.
  - up: They handled this comfortably; raise difficulty next.
  - down: They struggled; ease difficulty next.
  - hold: Right at the optimal challenge band.
- reasoning: One short clinician-readable sentence.

CRITICAL CLASSIFICATION RULES (do not violate):
- Fluency is NEVER sufficient for fluent_correct. A grammatically smooth answer about the wrong subject is off_topic, not fluent_correct.
- fluent_correct REQUIRES onTopicScore ≥ 0.7 AND targetAchievementScore ≥ 0.7. If either is below 0.7, you MUST pick a different errorType.
- off_topic REQUIRES onTopicScore ≤ 0.3 AND targetAchievementScore ≤ 0.3. Use it whenever the response is recognizable language about a different subject than the prompt asked about — even if it's eloquent.
- A short but accurate answer to a focused prompt CAN be fluent_correct (e.g. "spoon" for "what do you eat soup with?").
- A short but WRONG answer in the right semantic neighborhood (e.g. "fork" for soup) is semantic_paraphasia, not incomplete.
- Surrender → errorType=surrender, recommendedAdaptation=down.
- No speech → errorType=no_response, recommendedAdaptation=down.

Worked examples:
  Prompt: "What did you do this morning?"
  Response: "Yesterday I went to the beach with my brother and had a great lunch."
    → off_topic (fluent but addresses a different time/event). Do NOT score fluent_correct.
  Prompt: "What do you eat soup with?"
  Response: "fork"
    → semantic_paraphasia (wrong utensil, related category). Do NOT score incomplete.
  Prompt: "What do you eat soup with?"
  Response: "spoon"
    → fluent_correct.`;

// v3 — sharpened rubric with explicit decision tree + worked examples for the
// categories the offline runner exposed as weak: circumlocution,
// semantic_paraphasia, and unclear. Designed to reduce false-positives where
// the model previously labeled these as fluent_correct or off_topic.
const SYSTEM_PROMPT_V3 = `You are a clinical aphasia speech-language pathologist scoring a single user turn in a stroke rehabilitation exercise.

Be honest but charitable: stroke survivors have impaired language, so a partial answer can still be a clinical success — but fluency alone is NEVER success. The most important question is "did the user produce the meaning the prompt asked for?"

You will return scoring via the score_turn tool. The fields:

- onTopicScore (0..1): how well the response addresses the prompt's TOPIC.
- targetAchievementScore (0..1): did the user actually produce the requested meaning/answer? This is the single most important score.
- responseQualityScore (0..1): specificity, structure, coherence.
- errorType: one of fluent_correct, off_topic, incomplete, word_finding, circumlocution, semantic_paraphasia, phonemic_issue, no_response, surrender, unclear.
- confidence (0..1): your confidence in this scoring.
- recommendedAdaptation: 'up' | 'down' | 'hold'.
- reasoning: ONE short clinician-readable sentence.

============================================================
ERROR TYPE DECISION TREE — work through these in order.
============================================================

STEP 1 — Trivial cases.
  - No speech at all → errorType=no_response.
  - Explicit give-up ("I don't know", "skip", "pass", "I forgot") → errorType=surrender.

STEP 2 — Is the transcript interpretable?
  If the transcript is garbled, fragmentary syntax, mostly function words with no content
  ("the and a was in for the"), nonsensical word salad, or you genuinely cannot determine
  what the user was trying to say → errorType=unclear. Do NOT default to off_topic for
  garbled speech; off_topic requires recognizable but irrelevant content.
  Examples of unclear:
    Prompt: "What did you have for breakfast?"
    Response: "the and a was in for the." → unclear
    Response: "yeah, mm, and the. with. it." → unclear

STEP 3 — Did the user produce a recognizable real word that is WRONG but RELATED?
  This is semantic_paraphasia. Key signal: a SPECIFIC content word from the same
  semantic neighborhood as the target, used confidently, no hedging or talking around.
  Examples of semantic_paraphasia:
    Prompt: "What do you use to eat soup?"     → target: spoon
    Response: "I use a fork for the soup."     → semantic_paraphasia (fork is in the
                                                  utensil category but wrong)
    Prompt: "Who is your spouse?"              → target: wife/husband
    Response: "My daughter."                   → semantic_paraphasia (family member,
                                                  wrong relation)
    Prompt: "Name a red fruit."                → target: apple/strawberry
    Response: "An orange."                     → semantic_paraphasia (fruit, wrong color)
  semantic_paraphasia is NOT the same as off_topic. Off_topic talks about an entirely
  different subject; semantic_paraphasia answers in the right category with the wrong item.

STEP 4 — Did the user TALK AROUND the target without naming it?
  This is circumlocution. Key signals (any of these):
    - "the thing", "that thing", "the one", "you know", "whatchamacallit"
    - description by function ("the swimming one with the fins")
    - description by location ("the thing in the kitchen with the bread")
    - category clues without the specific word
    - related details orbiting the target without ever landing on it
  Crucially: circumlocution often LOOKS fluent. The user produces many words.
  Length is not success — the absence of the target name is the diagnosis.
  Examples of circumlocution:
    Prompt: "What did you eat for breakfast?"
    Response: "I had the thing, you know, the thing in the kitchen, with the bread."
                                                → circumlocution (orbits "eggs"/"toast")
    Prompt: "What animal lives in the ocean and has fins?"
    Response: "the swimming one with the things on the side, in the water."
                                                → circumlocution (orbits "fish")
  When circumlocution is paired with long latency/hesitation it can also fit
  word_finding — choose circumlocution if the talking-around pattern dominates,
  word_finding if pauses/hesitations dominate without descriptive substitution.

STEP 5 — Did the user run out of words mid-thought?
  Trailed off, very short, single word answer to an open-ended prompt → incomplete.

STEP 6 — Long latency or "uh… the… um…" patterns with eventual partial output → word_finding.

STEP 7 — Fluent, recognizable language about the WRONG topic entirely → off_topic.
  Off_topic requires the user to be answering a different question or talking about
  unrelated subject matter. If the response is in the right category but wrong item,
  prefer semantic_paraphasia. If the response talks around the target, prefer circumlocution.

STEP 8 — Otherwise: clear, on-topic, target produced → fluent_correct.

============================================================
SCORING RULES
============================================================
- circumlocution: targetAchievementScore must NOT exceed 0.5 (target was not named).
- semantic_paraphasia: targetAchievementScore must NOT exceed 0.45 (wrong item produced).
- unclear: confidence should be ≤ 0.6 unless the unclarity itself is unambiguous.
- off_topic: onTopicScore must be ≤ 0.3.
- fluent_correct: requires onTopicScore ≥ 0.7 AND targetAchievementScore ≥ 0.7.
- Surrender → errorType=surrender, recommendedAdaptation=down.
- No speech → errorType=no_response, recommendedAdaptation=down.
- Volume of speech ≠ success. A long ramble that misses the target is a failure.
- A short but accurate answer can be a strong success.

Return ONLY via the score_turn tool.`;

// v3 underperformed v2 on the labeled dataset (overall -17.4%, fluent_correct
// + off_topic regressions, no movement on weak categories). Default stays v2
// until v4 beats it. Callers can opt into v3 for experiments.
function resolvePromptVersion(version?: "v2" | "v3"): "v2" | "v3" {
  return version === "v2" || version === "v3" ? version : DEFAULT_PROMPT_VERSION;
}

function pickPrompt(version: "v2" | "v3"): string {
  return version === "v3" ? SYSTEM_PROMPT_V3 : SYSTEM_PROMPT_V2;
}

const TOOL = {
  type: "function",
  function: {
    name: "score_turn",
    description: "Return the clinical scoring for a discourse turn.",
    parameters: {
      type: "object",
      properties: {
        onTopicScore: { type: "number", minimum: 0, maximum: 1 },
        targetAchievementScore: { type: "number", minimum: 0, maximum: 1 },
        responseQualityScore: { type: "number", minimum: 0, maximum: 1 },
        errorType: { type: "string", enum: ERROR_TYPES as unknown as string[] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        recommendedAdaptation: { type: "string", enum: ["up", "down", "hold"] },
        reasoning: { type: "string", maxLength: 240 },
      },
      required: [
        "onTopicScore",
        "targetAchievementScore",
        "responseQualityScore",
        "errorType",
        "confidence",
        "recommendedAdaptation",
        "reasoning",
      ],
      additionalProperties: false,
    },
  },
};

// Bumped 9s → 12s. Empirical: gpt-5-mini under tool-call constraint p95 is
// 7-9s warm and routinely 8-10s on cold paths. 9s caused real-world short
// semantic_paraphasia turns to time out (e.g. "a fork" for soup). Client
// wrapper times out at 13s so the server still gets the last word.
const TIMEOUT_MS = 12000;

function buildUserMessage(req: ScoreRequest): string {
  const lines = [
    `Exercise: ${req.exerciseSlug}`,
    `Prompt: "${req.promptText}"`,
    req.taskGoal ? `Task goal: ${req.taskGoal}` : null,
    req.topicKeywords?.length
      ? `Expected topic vocabulary: ${req.topicKeywords.join(", ")}`
      : null,
    `User response: "${req.transcript || "(no speech)"}"`,
    `Word count: ${req.wordCount}`,
    req.latencyToFirstWordMs != null
      ? `Latency to first word: ${req.latencyToFirstWordMs}ms`
      : null,
    req.durationMs != null ? `Speech duration: ${req.durationMs}ms` : null,
    req.scaffoldUsed ? `Note: a hint/narrowing prompt was provided this turn.` : null,
    req.turnNumber != null ? `Turn #${req.turnNumber}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ScoreRequest;

    // Basic input validation
    if (!body || typeof body.transcript !== "string" || typeof body.promptText !== "string") {
      return new Response(
        JSON.stringify({ error: "transcript and promptText are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured", source: "config_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const startedAt = Date.now();
    const promptVersion = resolvePromptVersion(body.promptVersion);
    let aiResp: Response;
    try {
      aiResp = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: pickPrompt(promptVersion) },
            { role: "user", content: buildUserMessage(body) },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: "score_turn" } },
        }),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const aborted = (err as Error)?.name === "AbortError";
      return new Response(
        JSON.stringify({
          error: aborted ? "llm_timeout" : "llm_network_error",
          message: aborted
            ? `Scorer exceeded ${TIMEOUT_MS}ms`
            : (err as Error)?.message ?? "fetch failed",
          source: "llm_error",
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    clearTimeout(timeoutId);
    const upstreamMs = Date.now() - startedAt;
    console.log(
      `[score-discourse-turn] upstream=${upstreamMs}ms status=${aiResp.status} promptV=${promptVersion} model=${MODEL}`,
    );

    if (!aiResp.ok) {
      const text = await aiResp.text();
      // Surface 429 / 402 cleanly so the client can fall back / show a toast
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: text, source: "llm_error" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "payment_required",
            message: "Add credits in Settings > Workspace > Usage",
            source: "llm_error",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "llm_error", status: aiResp.status, message: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ai = await aiResp.json();
    const toolCall = ai?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "llm_no_tool_call", source: "llm_error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "llm_invalid_json",
          message: (err as Error)?.message,
          raw: toolCall.function.arguments,
          source: "llm_error",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = {
      ...parsed,
      source: "llm" as const,
      model: MODEL,
      promptVersion,
      latencyMs: Date.now() - startedAt,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("score-discourse-turn error:", err);
    return new Response(
      JSON.stringify({
        error: "unexpected_error",
        message: err instanceof Error ? err.message : String(err),
        source: "exception",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
