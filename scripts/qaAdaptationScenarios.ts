/**
 * Adaptation Quality QA — runs 3 patient scenarios end-to-end through the
 * SAME code paths the live games use (scorer + calibration + bridge), and
 * checks every turn against an expected adaptation direction.
 *
 * What this validates that a UI test cannot:
 *   - actual successScore values per turn (calibrated)
 *   - actual recommendedAdaptation per turn from LLM v2
 *   - actual sliding-window decision (up/down/hold) from the bridge
 *   - actual badge-render decision from the hook (hold-suppression rule)
 *   - actual exercise_events.clinical_signal persistence per turn
 *
 * What it cannot validate (and we cover separately):
 *   - blank Describe & Guess card guard → checked via getDescribeGuessTrials()
 *   - badge component mounted in DescribeGuess + FixSentence → checked via grep
 *
 * Run: bun scripts/qaAdaptationScenarios.ts
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
import {
  decideDiscourseShift,
  scoreDiscourseTurn as scoreBridgeTurn,
  type DiscourseTurnSignals,
  type DiscourseDirection,
} from "../src/lib/discourseAdaptation";
import { getDescribeGuessTrials } from "../src/data/describeGuessBank";
import { readFileSync } from "node:fs";

const SUPABASE_URL = "https://wjedbpjaiqdxhmjzkcxo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZWRicGphaXFkeGhtanprY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjgyNjcsImV4cCI6MjA3ODU0NDI2N30.tXfA1zdAqvCsZGKNlfn8OC48fhS4olS88kou0zyR7OA";

const EMAIL = "demo.admin@gmail.com";
const PASSWORD = "Tomford8*";

// ---------- Scenario definitions ----------

interface QaTurn {
  prompt: string;
  transcript: string;
  durationMs: number;
  latencyToFirstWordMs: number;
  scaffoldUsed?: boolean;
  /** Per-turn intuitive expectation from a clinician. */
  expectedDirection: DiscourseDirection | "any";
  expectedErrorFamily?: string;
  note: string;
}

interface QaScenario {
  name: string;
  initialLevel: number;
  turns: QaTurn[];
  /** Where do we expect the level to land overall? */
  expectedFinalLevelDirection: "increase" | "decrease" | "stay";
}

const STRONG: QaScenario = {
  name: "Strong patient (clear, on-topic)",
  initialLevel: 2,
  expectedFinalLevelDirection: "increase",
  turns: [
    {
      prompt: "Tell me about your morning routine.",
      transcript:
        "I usually wake up around seven, make coffee, read the newspaper, then I take a short walk in the garden before breakfast.",
      durationMs: 9200, latencyToFirstWordMs: 900,
      expectedDirection: "hold", // first turn — bridge needs ≥2 in window
      expectedErrorFamily: "fluent_correct",
      note: "long, clear, fast onset",
    },
    {
      prompt: "What did you do last weekend?",
      transcript:
        "On Saturday my daughter visited with the grandkids, we had lunch on the patio and then we played cards in the afternoon.",
      durationMs: 8800, latencyToFirstWordMs: 1100,
      expectedDirection: "up",
      expectedErrorFamily: "fluent_correct",
      note: "second strong turn — should now lift difficulty",
    },
    {
      prompt: "Describe a place you'd like to visit someday.",
      transcript:
        "I've always wanted to go to Italy, especially Rome, to see the old buildings and try the food and walk the narrow streets.",
      durationMs: 9000, latencyToFirstWordMs: 800,
      expectedDirection: "up",
      expectedErrorFamily: "fluent_correct",
      note: "sustained strong → keep climbing or hold near ceiling",
    },
    {
      prompt: "What is something you are proud of?",
      transcript:
        "I'm proud of raising my children and seeing them build their own families and careers, that's the thing I'm most proud of.",
      durationMs: 9100, latencyToFirstWordMs: 950,
      expectedDirection: "any", // up or hold both clinically defensible at L4/5
      expectedErrorFamily: "fluent_correct",
      note: "should NOT crash difficulty back down",
    },
  ],
};

const STRUGGLING: QaScenario = {
  name: "Struggling patient (short, slow, surrenders)",
  initialLevel: 3,
  expectedFinalLevelDirection: "decrease",
  turns: [
    {
      prompt: "Tell me about your morning.",
      transcript: "Coffee.",
      durationMs: 1200, latencyToFirstWordMs: 5200,
      expectedDirection: "hold", // single turn, need window
      expectedErrorFamily: "incomplete",
      note: "single word, very slow onset",
    },
    {
      prompt: "What did you do yesterday?",
      transcript: "I don't know.",
      durationMs: 1500, latencyToFirstWordMs: 4800,
      expectedDirection: "down", // surrender hard floor
      expectedErrorFamily: "surrender",
      note: "surrender — must immediately ease",
    },
    {
      prompt: "Tell me about a family member.",
      transcript: "Um... my... uh...",
      durationMs: 2800, latencyToFirstWordMs: 6800,
      expectedDirection: "down",
      expectedErrorFamily: "word_finding",
      note: "long latency + filler — should keep easing",
    },
    {
      prompt: "What did you eat today?",
      transcript: "Skip.",
      durationMs: 800, latencyToFirstWordMs: 3500,
      expectedDirection: "down",
      expectedErrorFamily: "surrender",
      note: "second surrender — should be near floor",
    },
  ],
};

const MIXED: QaScenario = {
  name: "Mixed aphasia (circumloc, paraphasia, off-topic, surrender, unclear)",
  initialLevel: 3,
  expectedFinalLevelDirection: "decrease",
  turns: [
    {
      prompt: "What do you use to eat soup?",
      transcript: "The thing, you know, the one you hold and you scoop with it, the round thing.",
      durationMs: 5800, latencyToFirstWordMs: 2200,
      expectedDirection: "hold",
      expectedErrorFamily: "circumlocution",
      note: "classic circumlocution — should NOT score as fluent_correct",
    },
    {
      prompt: "What do you use to eat soup?",
      transcript: "A fork.",
      durationMs: 1100, latencyToFirstWordMs: 1900,
      expectedDirection: "down",
      expectedErrorFamily: "semantic_paraphasia",
      note: "semantic paraphasia — same category, wrong item",
    },
    {
      prompt: "Tell me about your weekend.",
      transcript: "My grandson started college and he plays in the marching band, the trombone.",
      durationMs: 6200, latencyToFirstWordMs: 1800,
      expectedDirection: "down",
      expectedErrorFamily: "off_topic",
      note: "off-topic — fluent but unrelated",
    },
    {
      prompt: "What is your spouse's name?",
      transcript: "I don't know.",
      durationMs: 1100, latencyToFirstWordMs: 4000,
      expectedDirection: "down",
      expectedErrorFamily: "surrender",
      note: "surrender — must hard-floor down",
    },
    {
      prompt: "What did you have for breakfast?",
      transcript: "the and a was in for the with it",
      durationMs: 4500, latencyToFirstWordMs: 2300,
      expectedDirection: "down",
      expectedErrorFamily: "unclear",
      note: "unclear / jargon — should not be off_topic",
    },
  ],
};

// ---------- Production-parity scoring (mirrors src/lib/discourseSignalScorer.ts) ----------

async function scoreLikeProduction(
  supabase: any,
  input: ScoreInput,
): Promise<{ signal: ClinicalSignal & { promptVersion?: string }; latencyMs: number }> {
  const t0 = Date.now();
  const sc = shortCircuit(input);
  if (sc) return { signal: sc, latencyMs: Date.now() - t0 };
  if (input.wordCount <= 2) {
    const fast = localFallbackScore(input);
    return {
      signal: { ...fast, reasoning: `Short input fast-path (≤2 words). ${fast.reasoning}` },
      latencyMs: Date.now() - t0,
    };
  }

  const { data, error } = await supabase.functions.invoke("score-discourse-turn", {
    body: input,
  });
  const latencyMs = Date.now() - t0;
  if (error || !data || (data as any).error) {
    console.warn(`    ⚠ edge fail (${latencyMs}ms): ${error?.message ?? (data as any)?.error}`);
    return { signal: localFallbackScore(input), latencyMs };
  }
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
  const signal: ClinicalSignal & { promptVersion?: string } = {
    ...sub,
    errorType,
    confidence,
    recommendedAdaptation,
    reasoning: typeof d.reasoning === "string" ? d.reasoning.slice(0, 240) : "",
    source: "llm",
    model: typeof d.model === "string" ? d.model : undefined,
    latencyMs: typeof d.latencyMs === "number" ? d.latencyMs : undefined,
    successScore,
    promptVersion: typeof d.promptVersion === "string" ? d.promptVersion : undefined,
  };
  return { signal, latencyMs };
}

function mapErrorTypeToStuckType(t: DiscourseErrorType) {
  switch (t) {
    case "no_response": return "no_speech";
    case "surrender": return "surrender";
    case "incomplete": return "incomplete";
    case "off_topic": return "off_topic";
    case "word_finding": return "long_latency";
    case "circumlocution": return "circumlocution";
    case "fluent_correct": return "fluent_complete";
    default: return "incomplete";
  }
}

// ---------- Bridge replay (matches useDiscourseAdaptation) ----------

interface ReplayState {
  scores: number[];
  level: number;
  turnCount: number;
}

function replayBridge(state: ReplayState, signal: ClinicalSignal, input: ScoreInput) {
  const bridgeSignals: DiscourseTurnSignals = {
    meaningful: input.wordCount >= 2 && signal.errorType !== "surrender" && signal.errorType !== "no_response",
    wordCount: input.wordCount,
    latencyToFirstWordMs: input.latencyToFirstWordMs,
    scaffoldUsed: !!input.scaffoldUsed,
    surrendered: signal.errorType === "surrender",
    stuckType: mapErrorTypeToStuckType(signal.errorType),
    momentum: signal.successScore,
  };
  const { successScore } = scoreBridgeTurn(bridgeSignals);
  state.scores.push(successScore);
  if (state.scores.length > 6) state.scores.shift();
  const decision = decideDiscourseShift(state.scores, state.level, bridgeSignals);
  state.turnCount += 1;

  // Hook badge-render rule: show non-hold always; show hold every 3rd turn
  const shouldShowHold = decision.direction === "hold" && state.turnCount % 3 === 0;
  const badgeShown = decision.direction !== "hold" || shouldShowHold;

  if (decision.direction !== "hold" && decision.level !== state.level) {
    state.level = decision.level;
  }
  return { decision, bridgeSuccess: successScore, badgeShown };
}

// ---------- Orchestrator ----------

interface TurnReport {
  scenario: string;
  turn: number;
  prompt: string;
  transcript: string;
  expected: string;
  actualErrorType: string;
  actualSuccess: number;
  actualScorerAdaptation: string;
  actualBridgeDirection: DiscourseDirection;
  badgeShown: boolean;
  level: number;
  source: string;
  promptVersion?: string;
  latencyMs: number;
  pass: boolean;
  why?: string;
}

async function runScenario(
  supabase: any,
  sessionId: string,
  scenario: QaScenario,
): Promise<{ turns: TurnReport[]; finalLevel: number }> {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`Scenario: ${scenario.name}`);
  console.log(`  initialLevel=${scenario.initialLevel}  expectFinal=${scenario.expectedFinalLevelDirection}`);
  console.log(`══════════════════════════════════════════════════════════`);

  const state: ReplayState = { scores: [], level: scenario.initialLevel, turnCount: 0 };
  const turns: TurnReport[] = [];

  for (let i = 0; i < scenario.turns.length; i++) {
    const t = scenario.turns[i];
    const wordCount = t.transcript.trim().split(/\s+/).filter(Boolean).length;
    const input: ScoreInput = {
      exerciseSlug: "conversation_partner",
      promptText: t.prompt,
      transcript: t.transcript,
      wordCount,
      durationMs: t.durationMs,
      latencyToFirstWordMs: t.latencyToFirstWordMs,
      scaffoldUsed: !!t.scaffoldUsed,
      topicKeywords: [],
      taskGoal: t.prompt,
      turnNumber: i + 1,
    };

    const { signal, latencyMs } = await scoreLikeProduction(supabase, input);
    const replay = replayBridge(state, signal, input);

    // Persist exactly as useDiscourseSignalScorer does
    await supabase.from("exercise_events").insert({
      session_id: sessionId,
      exercise_slug: "conversation_partner",
      round: i + 1,
      score: Math.round((signal.successScore ?? 0) * 100),
      reaction_time_ms: input.latencyToFirstWordMs,
      inputs: {
        prompt: input.promptText,
        transcript: input.transcript,
        word_count: input.wordCount,
        duration_ms: input.durationMs,
        scaffold_used: !!input.scaffoldUsed,
        topic_keywords: [],
        task_goal: input.taskGoal,
        scenario: scenario.name,
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
        bridge: {
          direction: replay.decision.direction,
          level: state.level,
          successRateInWindow: replay.decision.successRateInWindow,
          badgeShown: replay.badgeShown,
        },
      },
      engagement_flags: {
        spoke: input.wordCount > 0,
        on_topic: (signal.onTopicScore ?? 0) >= 0.5,
        target_achieved: (signal.targetAchievementScore ?? 0) >= 0.6,
        scorer_source: signal.source,
      },
    });

    // Pass logic: turn-level expectation vs bridge direction
    let pass = false;
    let why = "";
    if (t.expectedDirection === "any") {
      pass = true;
    } else {
      pass = replay.decision.direction === t.expectedDirection;
      if (!pass) why = `expected ${t.expectedDirection}, got ${replay.decision.direction}`;
    }
    if (t.expectedErrorFamily && t.expectedErrorFamily !== signal.errorType) {
      // soft fail — we report it but don't tank the row unless direction also wrong
      why = (why ? why + "; " : "") + `errorType expected ${t.expectedErrorFamily}, got ${signal.errorType}`;
    }

    const report: TurnReport = {
      scenario: scenario.name,
      turn: i + 1,
      prompt: t.prompt,
      transcript: t.transcript,
      expected: t.expectedDirection,
      actualErrorType: signal.errorType,
      actualSuccess: signal.successScore,
      actualScorerAdaptation: signal.recommendedAdaptation,
      actualBridgeDirection: replay.decision.direction,
      badgeShown: replay.badgeShown,
      level: state.level,
      source: signal.source,
      promptVersion: (signal as any).promptVersion,
      latencyMs,
      pass,
      why: why || undefined,
    };
    turns.push(report);

    console.log(
      `  T${i + 1} [${pass ? "✓" : "✗"}] errorType=${signal.errorType.padEnd(20)} success=${signal.successScore.toFixed(2)} ` +
      `scorerRec=${signal.recommendedAdaptation.padEnd(4)} bridge=${replay.decision.direction.padEnd(4)} ` +
      `level=${state.level} badge=${replay.badgeShown ? "YES" : "no "} src=${signal.source}${(signal as any).promptVersion ? ` v${(signal as any).promptVersion}` : ""} (${latencyMs}ms)`,
    );
    if (why) console.log(`      ↳ ${why}`);
    console.log(`      note: ${t.note}`);
  }

  return { turns, finalLevel: state.level };
}

// ---------- Standalone capability checks ----------

function checkBlankCardGuard() {
  const trials = getDescribeGuessTrials({ count: 20, difficulty: "easy" });
  const blanks = trials.filter((t) => !t.targetPhotoId || !t.targetWord);
  return { total: trials.length, blanks: blanks.length, sample: trials.slice(0, 3) };
}

function checkBadgeMounts() {
  const files = [
    "src/components/DescribeGuessGame.tsx",
    "src/components/FixSentenceGame.tsx",
    "src/components/ConversationPartnerGame.tsx",
    "src/components/ThoughtContinuationGame.tsx",
  ];
  const results = files.map((f) => {
    const src = readFileSync(f, "utf8");
    return {
      file: f,
      importsBadge: src.includes("AdaptationBadge"),
      rendersBadge: /<AdaptationBadge\b/.test(src),
    };
  });
  return results;
}

function checkShortInputFastPath() {
  const cases = [
    { transcript: "yes", wordCount: 1 },
    { transcript: "fork", wordCount: 1 },
    { transcript: "I don't", wordCount: 2 }, // ≤2 → fast path
  ];
  return cases.map((c) => {
    const input: ScoreInput = {
      exerciseSlug: "conversation_partner",
      promptText: "What is it?",
      transcript: c.transcript,
      wordCount: c.wordCount,
      durationMs: 1000,
      latencyToFirstWordMs: 800,
      scaffoldUsed: false,
      topicKeywords: [],
      taskGoal: "",
      turnNumber: 1,
    };
    const sc = shortCircuit(input);
    if (sc) return { ...c, route: "shortcircuit", errorType: sc.errorType };
    if (c.wordCount <= 2) {
      const fast = localFallbackScore(input);
      return { ...c, route: "≤2-word fast-path", errorType: fast.errorType };
    }
    return { ...c, route: "LLM (would be called)", errorType: "?" };
  });
}

// ---------- Main ----------

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ ADAPTATION QUALITY QA — 3 SCENARIOS                     │");
  console.log("└─────────────────────────────────────────────────────────┘");

  // Standalone checks first (don't need DB)
  console.log("\n━━━ Standalone capability checks ━━━");

  const blank = checkBlankCardGuard();
  console.log(`\n[Describe & Guess blank-card guard]`);
  console.log(`  trials returned: ${blank.total}, blanks: ${blank.blanks}`);
  console.log(`  sample[0]: targetWord="${blank.sample[0]?.targetWord}" photoId="${blank.sample[0]?.targetPhotoId}"`);
  const blankPass = blank.total > 0 && blank.blanks === 0;
  console.log(`  → ${blankPass ? "✅ PASS" : "❌ FAIL"} no blank cards`);

  console.log(`\n[AdaptationBadge mount audit]`);
  const badgeMounts = checkBadgeMounts();
  for (const b of badgeMounts) {
    const ok = b.importsBadge && b.rendersBadge;
    console.log(`  ${ok ? "✓" : "✗"} ${b.file.replace("src/components/", "")} imports=${b.importsBadge} renders=${b.rendersBadge}`);
  }
  const badgesPass = badgeMounts.every((b) => b.importsBadge && b.rendersBadge);

  console.log(`\n[Short-input fast path (no LLM hang)]`);
  const fast = checkShortInputFastPath();
  for (const f of fast) {
    console.log(`  "${f.transcript}" (wc=${f.wordCount}) → ${f.route} → ${f.errorType}`);
  }
  const fastPass = fast.every((f) => f.route !== "LLM (would be called)");
  console.log(`  → ${fastPass ? "✅ PASS" : "❌ FAIL"} short inputs bypass LLM`);

  // Auth + session
  console.log("\n━━━ Auth + session setup ━━━");
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL, password: PASSWORD,
  });
  if (authErr || !auth.user) { console.error("✗ auth:", authErr?.message); process.exit(1); }
  const { data: profiles } = await supabase.from("profiles").select("id").eq("user_id", auth.user.id);
  const profileId = profiles?.[0]?.id;
  if (!profileId) { console.error("✗ no profile"); process.exit(1); }

  const { data: session } = await supabase
    .from("sessions").insert({
      user_id: auth.user.id, profile_id: profileId,
      started_at: new Date().toISOString(),
      plan: { source: "qa_adaptation_scenarios" },
    }).select("id").single();
  console.log(`  session=${session.id}`);

  // Run all 3 scenarios
  const allReports: TurnReport[] = [];
  const summaries: { name: string; finalLevel: number; initial: number; expected: string }[] = [];

  for (const scenario of [STRONG, STRUGGLING, MIXED]) {
    const { turns, finalLevel } = await runScenario(supabase, session.id, scenario);
    allReports.push(...turns);
    summaries.push({
      name: scenario.name,
      finalLevel, initial: scenario.initialLevel,
      expected: scenario.expectedFinalLevelDirection,
    });
  }

  // Verify clinical_signal persistence
  console.log("\n━━━ Verifying clinical_signal persistence ━━━");
  const { data: rows } = await supabase
    .from("exercise_events")
    .select("round, outputs, inputs")
    .eq("session_id", session.id)
    .order("round");
  const persistedTurns = rows?.length ?? 0;
  const expectedTurns = STRONG.turns.length + STRUGGLING.turns.length + MIXED.turns.length;
  // Note: rounds collide across scenarios; query returns all rows ordered by round
  console.log(`  rows persisted: ${persistedTurns} (expected ${expectedTurns} — same session, rounds may repeat)`);
  const completeRows = (rows ?? []).filter((r: any) => {
    const s = r.outputs?.clinical_signal ?? {};
    return s.successScore != null && s.errorType && s.recommendedAdaptation && s.source;
  }).length;
  const persistPass = completeRows === persistedTurns && persistedTurns > 0;
  console.log(`  rows with complete clinical_signal: ${completeRows}/${persistedTurns} → ${persistPass ? "✅" : "❌"}`);

  // promptVersion check
  const llmRows = (rows ?? []).filter((r: any) => r.outputs?.clinical_signal?.source === "llm");
  const v2Rows = llmRows.filter((r: any) => r.outputs?.clinical_signal?.promptVersion === "v2");
  console.log(`  LLM rows: ${llmRows.length}, with promptVersion=v2: ${v2Rows.length} → ${llmRows.length > 0 && v2Rows.length === llmRows.length ? "✅" : "❌"}`);

  // ---------- Summary tables ----------
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ FINAL ADAPTATION TABLE                                  │");
  console.log("└─────────────────────────────────────────────────────────┘");
  console.log("scen.t  expect | errorType            success rec  bridge lvl badge src   pass");
  for (const r of allReports) {
    const tag = `${r.scenario.split(" ")[0].toLowerCase().slice(0,5)}.${r.turn}`;
    console.log(
      `${tag.padEnd(7)} ${String(r.expected).padEnd(6)} | ${r.actualErrorType.padEnd(20)} ${r.actualSuccess.toFixed(2)}    ${r.actualScorerAdaptation.padEnd(4)} ${r.actualBridgeDirection.padEnd(6)} ${r.level}   ${r.badgeShown ? "yes  " : "no   "} ${r.source.padEnd(5)} ${r.pass ? "✓" : "✗"}`
    );
  }

  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ SCENARIO LEVEL TRAJECTORY                               │");
  console.log("└─────────────────────────────────────────────────────────┘");
  for (const s of summaries) {
    const moved = s.finalLevel - s.initial;
    const dirOK =
      (s.expected === "increase" && moved > 0) ||
      (s.expected === "decrease" && moved < 0) ||
      (s.expected === "stay" && moved === 0);
    console.log(`  ${dirOK ? "✓" : "✗"} ${s.name}`);
    console.log(`     initial=${s.initial} → final=${s.finalLevel}  (expected ${s.expected})`);
  }

  // Failures
  const fails = allReports.filter((r) => !r.pass);
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log(`│ WRONG ADAPTATION DECISIONS: ${fails.length.toString().padStart(2)}                          │`);
  console.log("└─────────────────────────────────────────────────────────┘");
  for (const f of fails) {
    console.log(`  • ${f.scenario.split(" ")[0]} T${f.turn}: ${f.why}`);
    console.log(`    transcript: "${f.transcript.slice(0, 70)}${f.transcript.length > 70 ? "…" : ""}"`);
  }

  // Confusing transitions: bridge direction != scorer recommendation
  const transitions = allReports.filter((r) => r.actualScorerAdaptation !== r.actualBridgeDirection);
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log(`│ SCORER vs BRIDGE MISMATCH: ${transitions.length.toString().padStart(2)}                           │`);
  console.log("└─────────────────────────────────────────────────────────┘");
  console.log("  (Mismatch is normal: scorer is per-turn, bridge averages 3.)");
  for (const t of transitions) {
    console.log(`  ${t.scenario.split(" ")[0]} T${t.turn}: scorer=${t.actualScorerAdaptation} bridge=${t.actualBridgeDirection} (success=${t.actualSuccess.toFixed(2)})`);
  }

  console.log("\nSession id for inspection:", session.id);
  process.exit(0);
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
