// Score Discourse Turn — LLM-first clinical scoring with structured output
// Returns a ClinicalSignal that drives discourse adaptation.
// Used by ConversationPartner + ThoughtContinuation.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
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
}

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

const SYSTEM_PROMPT = `You are a clinical aphasia speech-language pathologist scoring a single user turn in a stroke rehabilitation exercise.

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

Rules:
- Fluency without correctness is NOT success. A long off-topic ramble = low targetAchievement.
- A short but accurate answer to a yes/no-ish prompt CAN be high targetAchievement.
- Surrender is always errorType=surrender, recommendedAdaptation=down.
- No speech is always errorType=no_response, recommendedAdaptation=down.`;

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

const TIMEOUT_MS = 4000;

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
            { role: "system", content: SYSTEM_PROMPT },
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
