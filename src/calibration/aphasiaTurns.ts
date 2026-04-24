/**
 * Labeled aphasia turn dataset for scorer calibration.
 *
 * Each case is a realistic prompt/response pair drawn from typical
 * stroke-rehab discourse exercises (Free Talk, Finish-the-Thought),
 * with the clinically-expected scoring + adaptation.
 *
 * These labels represent what an SLP would say is the right call — they
 * are the "ground truth" the scorer + calibration are evaluated against.
 *
 * Used by `scripts/runScorerCalibration.ts`.
 */

import type {
  DiscourseErrorType,
  DiscourseAdaptationDirection,
  ScoreInput,
} from "@/lib/discourseSignalScorer";

export interface LabeledTurn {
  id: string;
  scenario: string;
  input: ScoreInput;
  expected: {
    errorType: DiscourseErrorType;
    adaptation: DiscourseAdaptationDirection;
    /** Was this turn a clinical "success" (composite > 0.6)? */
    success: boolean;
    /** Acceptable error types if the LLM picks a close-but-not-exact label. */
    acceptableErrorTypes?: DiscourseErrorType[];
  };
}

const t = (
  id: string,
  scenario: string,
  promptText: string,
  transcript: string,
  partial: Partial<ScoreInput>,
  expected: LabeledTurn["expected"],
): LabeledTurn => ({
  id,
  scenario,
  input: {
    exerciseSlug: "conversation_partner",
    promptText,
    transcript,
    wordCount: transcript ? transcript.trim().split(/\s+/).filter(Boolean).length : 0,
    latencyToFirstWordMs: 1800,
    durationMs: 4000,
    ...partial,
  },
  expected,
});

export const APHASIA_TURNS: LabeledTurn[] = [
  // ---------------------------------------------------------------------
  // FLUENT CORRECT — clean wins
  // ---------------------------------------------------------------------
  t("fc-01", "Direct on-topic answer",
    "What did you have for breakfast today?",
    "I had eggs and toast with coffee.",
    { topicKeywords: ["breakfast", "eggs", "toast", "coffee", "ate"] },
    { errorType: "fluent_correct", adaptation: "up", success: true },
  ),
  t("fc-02", "Short but complete answer",
    "Tell me about your weekend plans.",
    "I am visiting my daughter on Saturday.",
    { topicKeywords: ["weekend", "saturday", "sunday", "plans", "family"] },
    { errorType: "fluent_correct", adaptation: "up", success: true },
  ),
  t("fc-03", "Finish the thought, completed naturally",
    "When the rain started, I quickly...",
    "grabbed my umbrella and ran inside.",
    { exerciseSlug: "thought_continuation", topicKeywords: ["rain", "umbrella", "inside", "ran", "wet"] },
    { errorType: "fluent_correct", adaptation: "up", success: true },
  ),

  // ---------------------------------------------------------------------
  // OFF-TOPIC — fluent but irrelevant (the classic false-positive trap)
  // ---------------------------------------------------------------------
  t("ot-01", "Fluent ramble on wrong topic",
    "What did you have for breakfast today?",
    "The weather is really nice today and I might go for a walk later if my knee feels better.",
    { topicKeywords: ["breakfast", "eggs", "toast", "coffee", "ate"] },
    { errorType: "off_topic", adaptation: "down", success: false },
  ),
  t("ot-02", "Answers a different question",
    "Tell me about your weekend plans.",
    "My grandson called me yesterday about his school project.",
    { topicKeywords: ["weekend", "saturday", "plans"] },
    { errorType: "off_topic", adaptation: "down", success: false,
      acceptableErrorTypes: ["off_topic", "incomplete"] },
  ),
  t("ot-03", "Drifts away from the prompt",
    "When the rain started, I quickly...",
    "well you know my brother used to live in Florida years ago.",
    { exerciseSlug: "thought_continuation", topicKeywords: ["rain", "umbrella", "inside"] },
    { errorType: "off_topic", adaptation: "down", success: false },
  ),

  // ---------------------------------------------------------------------
  // CIRCUMLOCUTION — talking around the target
  // ---------------------------------------------------------------------
  t("cl-01", "Classic 'the thing' pattern",
    "What did you eat for breakfast?",
    "I had the thing, you know, the thing in the kitchen, with the bread.",
    { topicKeywords: ["breakfast", "eggs", "toast", "cereal", "ate"] },
    { errorType: "circumlocution", adaptation: "down", success: false,
      acceptableErrorTypes: ["circumlocution", "word_finding"] },
  ),
  t("cl-02", "Describes function instead of naming",
    "What animal lives in the ocean and has fins?",
    "the swimming one with the things on the side, you know, in the water.",
    { topicKeywords: ["fish", "shark", "whale", "ocean"] },
    { errorType: "circumlocution", adaptation: "down", success: false },
  ),

  // ---------------------------------------------------------------------
  // WORD FINDING — long latency, gaps, hesitation
  // ---------------------------------------------------------------------
  t("wf-01", "Long latency before partial answer",
    "What did you have for breakfast?",
    "um... the... uh... eggs.",
    { latencyToFirstWordMs: 9500, topicKeywords: ["breakfast", "eggs", "toast"] },
    { errorType: "word_finding", adaptation: "down", success: false,
      acceptableErrorTypes: ["word_finding", "incomplete"] },
  ),
  t("wf-02", "Gets there eventually with gaps",
    "Tell me about your weekend.",
    "I went to... uh... the... place... my daughter... visiting.",
    { latencyToFirstWordMs: 7500, topicKeywords: ["weekend", "daughter", "visit"] },
    { errorType: "word_finding", adaptation: "down", success: false,
      acceptableErrorTypes: ["word_finding", "incomplete", "circumlocution"] },
  ),

  // ---------------------------------------------------------------------
  // INCOMPLETE — trails off
  // ---------------------------------------------------------------------
  t("ic-01", "Trails off mid-sentence",
    "When the rain started, I quickly...",
    "I... uh... grabbed...",
    { exerciseSlug: "thought_continuation", topicKeywords: ["rain", "umbrella", "inside"] },
    { errorType: "incomplete", adaptation: "down", success: false,
      acceptableErrorTypes: ["incomplete", "word_finding"] },
  ),
  t("ic-02", "Single word answer to open-ended prompt",
    "Tell me about a happy memory from your childhood.",
    "fishing.",
    { topicKeywords: ["childhood", "memory", "happy"] },
    { errorType: "incomplete", adaptation: "down", success: false },
  ),

  // ---------------------------------------------------------------------
  // SEMANTIC PARAPHASIA — wrong but related word
  // ---------------------------------------------------------------------
  t("sp-01", "Substitutes related word",
    "What do you use to eat soup?",
    "I use a fork for the soup.",
    { topicKeywords: ["spoon", "soup", "eat"] },
    { errorType: "semantic_paraphasia", adaptation: "down", success: false,
      acceptableErrorTypes: ["semantic_paraphasia", "off_topic"] },
  ),

  // ---------------------------------------------------------------------
  // SURRENDER — explicit give-ups
  // ---------------------------------------------------------------------
  t("sr-01", "Direct surrender", "What did you have for breakfast?", "I don't know.",
    { topicKeywords: ["breakfast"] },
    { errorType: "surrender", adaptation: "down", success: false }),
  t("sr-02", "Skip request", "Tell me about your weekend.", "skip.",
    { topicKeywords: ["weekend"] },
    { errorType: "surrender", adaptation: "down", success: false }),
  t("sr-03", "Forgot phrasing", "Finish: when I get tired, I usually...", "I forgot.",
    { exerciseSlug: "thought_continuation", topicKeywords: ["tired", "rest", "sleep"] },
    { errorType: "surrender", adaptation: "down", success: false }),

  // ---------------------------------------------------------------------
  // NO RESPONSE
  // ---------------------------------------------------------------------
  t("nr-01", "Empty transcript", "What did you have for breakfast?", "",
    { topicKeywords: ["breakfast"], latencyToFirstWordMs: null, durationMs: 0 },
    { errorType: "no_response", adaptation: "down", success: false }),
  t("nr-02", "Filler only", "Tell me about your weekend.", "um uh hmm.",
    { topicKeywords: ["weekend"] },
    { errorType: "incomplete", adaptation: "down", success: false,
      acceptableErrorTypes: ["incomplete", "no_response"] }),

  // ---------------------------------------------------------------------
  // BORDERLINE — should HOLD, not adapt
  // ---------------------------------------------------------------------
  t("hd-01", "On topic but vague",
    "What did you do this morning?",
    "I did some stuff around the house.",
    { topicKeywords: ["morning", "house", "did"] },
    { errorType: "fluent_correct", adaptation: "hold", success: true,
      acceptableErrorTypes: ["fluent_correct", "incomplete"] }),
  t("hd-02", "Partial answer with mild hesitation",
    "Tell me about your favorite meal.",
    "I really like... pasta. With sauce. It's good.",
    { latencyToFirstWordMs: 3500, topicKeywords: ["meal", "food", "favorite", "like"] },
    { errorType: "fluent_correct", adaptation: "hold", success: true,
      acceptableErrorTypes: ["fluent_correct", "word_finding"] }),

  // ---------------------------------------------------------------------
  // STRONG SUCCESSES — should clearly trigger UP
  // ---------------------------------------------------------------------
  t("up-01", "Detailed structured answer",
    "Tell me about your morning routine.",
    "I wake up at seven, make coffee, read the newspaper, and then I take my medication before breakfast.",
    { topicKeywords: ["morning", "routine", "coffee", "breakfast"] },
    { errorType: "fluent_correct", adaptation: "up", success: true }),
  t("up-02", "Clear thought completion with detail",
    "When the rain started, I quickly...",
    "ran to the porch and closed all the windows so the floor wouldn't get wet.",
    { exerciseSlug: "thought_continuation", topicKeywords: ["rain", "windows", "inside", "wet"] },
    { errorType: "fluent_correct", adaptation: "up", success: true }),

  // ---------------------------------------------------------------------
  // UNCLEAR — garbled / ambiguous
  // ---------------------------------------------------------------------
  t("un-01", "Mostly unintelligible",
    "What did you have for breakfast?",
    "the and a was in for the.",
    { topicKeywords: ["breakfast"] },
    { errorType: "unclear", adaptation: "down", success: false,
      acceptableErrorTypes: ["unclear", "off_topic", "incomplete"] }),
];
