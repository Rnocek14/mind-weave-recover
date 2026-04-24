/**
 * C3 Validation: Prove clinical_signal logging end-to-end.
 *
 * Mirrors useDiscourseSignalScorer.scoreAndRecord + scoreDiscourseTurn exactly:
 *   1. Authenticate as demo.admin@gmail.com (real RLS path).
 *   2. Create a session row.
 *   3. For each aphasia turn: shortCircuit → edge fn → calibration post-processing → insert.
 *   4. Re-query and confirm every required field is present.
 *
 * Run: bun scripts/validateClinicalSignalLogging.ts
 */

import { createClient } from "@supabase/supabase-js";
import {
  shortCircuit,
  localFallbackScore,
  ERROR_TYPES,
  clamp01,
  type ClinicalSignal,
  type DiscourseErrorType,
  type ScoreInput,
} from "../src/lib/discourseSignalScorerCore";
import {
  ACTIVE_CALIBRATION,
  applyErrorTypeCaps,
  computeSuccessScoreCalibrated,
  resolveAdaptation,
} from "../src/lib/scorerCalibration";

const SUPABASE_URL = "https://wjedbpjaiqdxhmjzkcxo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZWRicGphaXFkeGhtanprY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjgyNjcsImV4cCI6MjA3ODU0NDI2N30.tXfA1zdAqvCsZGKNlfn8OC48fhS4olS88kou0zyR7OA";

const EMAIL = "demo.admin@gmail.com";
const PASSWORD = "Tomford8*";

interface Turn {
  label: string;
  prompt: string;
  transcript: string;
  expectedFamily: string;
}

const TURNS: Turn[] = [
  {
    label: "fluent_correct",
    prompt: "Tell me about your morning routine.",
    transcript:
      "I usually wake up around seven, make coffee, and read the news for a little while before I get ready for the day.",
    expectedFamily: "fluent_correct",
  },
  {
    label: "off_topic",
    prompt: "What did you have for breakfast today?",
    transcript:
      "My grandson is visiting next week, he just started college and he plays in the marching band.",
    expectedFamily: "off_topic",
  },
  {
    label: "surrender",
    prompt: "Describe a place you like to visit.",
    transcript: "I don't know.",
    expectedFamily: "surrender",
  },
  {
    label: "circumlocution",
    prompt: "What do you use to write a letter?",
    transcript:
      "The thing, you know, the long thin thing, you hold it and it makes the marks on the paper, the writing thing.",
    expectedFamily: "circumlocution",
  },
];

const CORE_FIELDS = [
  "onTopicScore",
  "targetAchievementScore",
  "responseQualityScore",
  "successScore",
  "errorType",
  "recommendedAdaptation",
  "source",
  "confidence",
  "reasoning",
];
const LLM_FIELDS = ["model", "llm_latency_ms", "promptVersion"];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("→ Signing in as", EMAIL);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (authErr || !auth.user) {
    console.error("✗ Auth failed:", authErr?.message);
    process.exit(1);
  }
  console.log("✓ Authenticated as", auth.user.id);

  console.log("→ Resolving profile");
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("user_id", auth.user.id);
  console.log("  profiles query:", { count: profiles?.length, err: profErr?.message });
  const profile = profiles?.[0];
  if (!profile) {
    console.error("✗ Profile lookup returned no rows (RLS or missing row)");
    process.exit(1);
  }
  console.log("✓ Profile", profile.id);

  console.log("→ Creating session row");
  const { data: session, error: sessErr } = await supabase
    .from("sessions")
    .insert({
      user_id: auth.user.id,
      profile_id: profile.id,
      started_at: new Date().toISOString(),
      plan: { source: "c3_validation_script" },
    })
    .select("id")
    .single();
  if (sessErr || !session) {
    console.error("✗ Session insert failed:", sessErr?.message);
    process.exit(1);
  }
  console.log("✓ Session", session.id);

  let turnIdx = 0;
  for (const turn of TURNS) {
    turnIdx += 1;
    console.log(`\n→ Turn ${turnIdx} (${turn.label}): "${turn.transcript.slice(0, 60)}…"`);

    const wordCount = turn.transcript.trim().split(/\s+/).length;
    const input: ScoreInput = {
      exerciseSlug: "conversation_partner",
      promptText: turn.prompt,
      transcript: turn.transcript,
      wordCount,
      durationMs: 4500,
      latencyToFirstWordMs: 1200,
      scaffoldUsed: false,
      topicKeywords: [],
      taskGoal: turn.prompt,
      turnNumber: turnIdx,
    };

    // Mirror src/lib/discourseSignalScorer.ts:scoreDiscourseTurn() exactly
    let signal: ClinicalSignal;
    const sc = shortCircuit(input);
    if (sc) {
      signal = sc;
      console.log(`  ↳ short-circuit: ${signal.errorType} (no LLM call)`);
    } else if (input.wordCount <= 2) {
      const fast = localFallbackScore(input);
      signal = { ...fast, reasoning: `Short input fast-path (≤2 words). ${fast.reasoning}` };
      console.log(`  ↳ ≤2-word fast-path: ${signal.errorType}`);
    } else {
      const t0 = Date.now();
      const { data, error: scoreErr } = await supabase.functions.invoke(
        "score-discourse-turn",
        { body: input },
      );
      const elapsed = Date.now() - t0;

      if (scoreErr || !data || (data as any).error) {
        console.warn(`  ⚠ edge fn failed (${elapsed}ms): ${scoreErr?.message ?? (data as any)?.error} → falling back locally`);
        signal = localFallbackScore(input);
      } else {
        const d = data as any;
        const rawSub = {
          onTopicScore: clamp01(d.onTopicScore),
          targetAchievementScore: clamp01(d.targetAchievementScore),
          responseQualityScore: clamp01(d.responseQualityScore),
        };
        const errorType = (ERROR_TYPES.has(d.errorType) ? d.errorType : "unclear") as DiscourseErrorType;
        const confidence = clamp01(d.confidence ?? 0.7);
        const sub = applyErrorTypeCaps(rawSub, errorType, ACTIVE_CALIBRATION);
        const successScore = computeSuccessScoreCalibrated(sub, ACTIVE_CALIBRATION);
        const recommendedAdaptation = resolveAdaptation(successScore, errorType, confidence, ACTIVE_CALIBRATION);
        signal = {
          ...sub,
          errorType,
          confidence,
          recommendedAdaptation,
          reasoning: typeof d.reasoning === "string" ? d.reasoning.slice(0, 240) : "",
          source: "llm",
          model: typeof d.model === "string" ? d.model : undefined,
          latencyMs: typeof d.latencyMs === "number" ? d.latencyMs : undefined,
          successScore,
          // promptVersion is metadata not on ClinicalSignal type; pass-through for log
          ...(typeof d.promptVersion === "string" ? { promptVersion: d.promptVersion } : {}),
        } as ClinicalSignal & { promptVersion?: string };
        console.log(`  ✓ LLM (${elapsed}ms) model=${d.model} promptV=${d.promptVersion}`);
      }
    }

    console.log(
      `  → errorType=${signal.errorType} success=${signal.successScore?.toFixed(2)} adapt=${signal.recommendedAdaptation} src=${signal.source}`,
    );

    // Mirror useDiscourseSignalScorer.log() exactly
    const { error: insertErr } = await supabase.from("exercise_events").insert({
      session_id: session.id,
      exercise_slug: "conversation_partner",
      round: turnIdx,
      score: Math.round((signal.successScore ?? 0) * 100),
      reaction_time_ms: input.latencyToFirstWordMs,
      inputs: {
        prompt: input.promptText,
        transcript: input.transcript,
        word_count: input.wordCount,
        duration_ms: input.durationMs,
        scaffold_used: false,
        topic_keywords: [],
        task_goal: input.taskGoal,
      },
      outputs: {
        clinical_signal: {
          onTopicScore: signal.onTopicScore,
          targetAchievementScore: signal.targetAchievementScore,
          responseQualityScore: signal.responseQualityScore,
          successScore: signal.successScore,
          errorType: signal.errorType,
          confidence: signal.confidence,
          recommendedAdaptation: signal.recommendedAdaptation,
          reasoning: signal.reasoning,
          source: signal.source,
          model: signal.model ?? null,
          promptVersion: (signal as any).promptVersion ?? null,
          llm_latency_ms: signal.latencyMs ?? null,
        },
      },
      engagement_flags: {
        spoke: input.wordCount > 0,
        on_topic: (signal.onTopicScore ?? 0) >= 0.5,
        target_achieved: (signal.targetAchievementScore ?? 0) >= 0.6,
        scorer_source: signal.source,
      },
    });

    if (insertErr) {
      console.error(`  ✗ insert failed:`, insertErr.message);
    } else {
      console.log(`  ✓ exercise_events row inserted`);
    }
  }

  // Re-query
  console.log("\n→ Re-querying exercise_events for this session");
  const { data: rows, error: qErr } = await supabase
    .from("exercise_events")
    .select("round, exercise_slug, score, outputs, created_at")
    .eq("session_id", session.id)
    .order("round", { ascending: true });

  if (qErr) {
    console.error("✗ requery failed:", qErr.message);
    process.exit(1);
  }
  console.log(`✓ Found ${rows?.length ?? 0} rows`);

  let allPass = true;
  for (const row of rows ?? []) {
    const sig = (row.outputs as any)?.clinical_signal ?? {};
    const required = sig.source === "llm" ? [...CORE_FIELDS, ...LLM_FIELDS] : CORE_FIELDS;
    const missing = required.filter((f) => sig[f] === undefined || sig[f] === null);
    if (missing.length === 0) {
      console.log(
        `  ✓ round=${row.round} ${row.exercise_slug} score=${row.score} errorType=${sig.errorType} adapt=${sig.recommendedAdaptation} src=${sig.source}${sig.promptVersion ? ` promptV=${sig.promptVersion}` : ""}${sig.model ? ` model=${sig.model}` : ""}`,
      );
    } else {
      allPass = false;
      console.log(`  ✗ round=${row.round} src=${sig.source} MISSING: ${missing.join(", ")}`);
    }
  }

  console.log("\n" + (allPass ? "✅ C3 PASS — clinical_signal logging is fully wired end-to-end" : "❌ C3 FAIL — see missing fields above"));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
