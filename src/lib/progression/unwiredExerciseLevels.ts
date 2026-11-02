/**
 * Proposed eight-stage designs for registered games that do not yet have a
 * dedicated, persisted L1–L8 clinical ladder. These are SPECIFICATIONS ONLY.
 *
 * No numeric mastery claims, no speech attribution claims, no patient-level
 * changes, no exercise or content selector wiring. In particular motor/visual
 * assistance labels are not SupportLevel values and must NEVER be persisted
 * to the language-mastery score pipeline.
 *
 * Runtime owners must implement distinct content and evidence criteria,
 * clinician review, and patient-safe selection before promoting any stage.
 */
import type {
  DesignOfRecordLevelSpec,
  DesignOfRecordLevelTable,
  DesignOnlySupport,
} from './_shared/designOfRecord';

interface ProposedStage {
  /** What a patient practices, not a recovery outcome. */
  focus: string;
  /** Planned content / interaction mechanic not yet enforced in gameplay. */
  plannedContent: string;
  /** Task-specific proposed assistance, not a validated mastery criterion. */
  support: DesignOnlySupport;
}

// A compile-time complete eight-item tuple (no missing/duplicate numeric keys).
type EightStages = readonly [
  ProposedStage, ProposedStage, ProposedStage, ProposedStage,
  ProposedStage, ProposedStage, ProposedStage, ProposedStage,
];

function defineUnwiredStages(stages: EightStages): DesignOfRecordLevelTable {
  return Object.fromEntries(
    stages.map((stage, index): [number, DesignOfRecordLevelSpec] => [
      index + 1,
      {
        level: index + 1,
        description: stage.focus,
        targetSupport: stage.support,
        readiness: 'aspirational',
        contentSelector: {
          tierKey: 'stage_' + String(index + 1),
          description: 'Planned, not playable as a distinct clinical level: ' + stage.plannedContent,
          implemented: false,
        },
      },
    ]),
  );
}

export const UNWIRED_EXERCISE_LEVELS: Record<string, DesignOfRecordLevelTable> = {
  'left-side-hunt': defineUnwiredStages([
    { focus: 'Large, high-contrast target presented on the left with explicit visual guidance', plannedContent: 'Single left-side object and continuous location prompt', support: 'visual_prompt' },
    { focus: 'Locate a familiar left-side target while following a brief visual prompt', plannedContent: 'Two predictable positions within the left visual field', support: 'visual_prompt' },
    { focus: 'Scan left to locate a target after the location prompt fades', plannedContent: 'Left-side targets with temporary orientation aid', support: 'visual_prompt' },
    { focus: 'Locate left-side targets across varied screen positions', plannedContent: 'Variable leftward scan distance with optional reorientation', support: 'independent_motor' },
    { focus: 'Identify a left-side target among a small number of visual distractors', plannedContent: 'Mild visual clutter without time-based failure', support: 'independent_motor' },
    { focus: 'Search from center toward the left while maintaining an organized scanning path', plannedContent: 'Distributed targets and optional scanning-line cue', support: 'independent_motor' },
    { focus: 'Systematically explore a more visually crowded bilateral display', plannedContent: 'Varied distractor locations and clinician-configurable cue frequency', support: 'independent_motor' },
    { focus: 'Practice leftward awareness in new visual scenes without routine prompts', plannedContent: 'Novel practical visual layouts; NOT a validated neglect recovery measure', support: 'independent_motor' },
  ]),

  'reach-tap': defineUnwiredStages([
    { focus: 'Comfortable reach to a large stationary target with visual guidance', plannedContent: 'Single oversized target, no time pressure', support: 'guided_touch' },
    { focus: 'Repeated accurate touches to large targets in a familiar area', plannedContent: 'Large stationary targets at modest varying positions', support: 'visual_prompt' },
    { focus: 'Reach accurately to targets at different comfortable distances', plannedContent: 'Position variation without mandatory speed escalation', support: 'visual_prompt' },
    { focus: 'Reach to moderately smaller targets while controlling movement', plannedContent: 'Target-size variation that respects motor and visual accessibility', support: 'independent_motor' },
    { focus: 'Alternate between two reachable areas without losing accuracy', plannedContent: 'Predictable target alternation; unaffected limb allowed as appropriate', support: 'independent_motor' },
    { focus: 'Maintain precision across a short series of varied positions', plannedContent: 'Series selection with generous rest and pause options', support: 'independent_motor' },
    { focus: 'Respond to an unfamiliar sequence of reachable targets with controlled pacing', plannedContent: 'Novel positions, adaptable pace and device-specific limits', support: 'independent_motor' },
    { focus: 'Practice precision and task pacing across new everyday target layouts', plannedContent: 'Clinician-configured functional layouts; no clinical motor outcome inference', support: 'independent_motor' },
  ]),

  'pattern-match': defineUnwiredStages([
    { focus: 'Recognize a single visual feature while the example remains visible', plannedContent: 'One-feature same-screen matching, no recall interval', support: 'visual_prompt' },
    { focus: 'Select a matching pair from a very small set', plannedContent: 'Two familiar shapes, distractors kept visually distinct', support: 'visual_prompt' },
    { focus: 'Recall a short visual pattern after a brief presentation', plannedContent: 'Two items with adjustable preview time', support: 'visual_prompt' },
    { focus: 'Recall shape and color of a short sequence', plannedContent: 'Two- or three-item sequence with independently varying visual features', support: 'independent_motor' },
    { focus: 'Maintain a three-item pattern despite plausible visual distractors', plannedContent: 'Additional shape/color distractors, accessible replay if needed', support: 'independent_motor' },
    { focus: 'Reproduce a longer visual sequence with reduced prompting', plannedContent: 'Four-item sequence and gradually shorter preview as tolerated', support: 'independent_motor' },
    { focus: 'Apply a changed matching rule without losing the current sequence', plannedContent: 'Alternating shape/color matching instructions, if cognitively appropriate', support: 'independent_motor' },
    { focus: 'Work through a novel multi-feature sequence at an individualized pace', plannedContent: 'Unfamiliar patterns and review; not an aphasia-specific improvement score', support: 'independent_motor' },
  ]),

  'phrase-practice': defineUnwiredStages([
    { focus: 'Repeat an immediately modeled familiar functional expression', plannedContent: 'Short everyday request with spoken model and optional visible text', support: 'carrier_or_full_model' },
    { focus: 'Produce a familiar request using a partial spoken model', plannedContent: 'Very short high-frequency phrase with a completion cue', support: 'phonemic_cue' },
    { focus: 'Produce a trained functional phrase using a meaning cue', plannedContent: 'Same communicative intent in several supported contexts', support: 'semantic_cue' },
    { focus: 'Produce a trained phrase without hearing the full model first', plannedContent: 'Independently initiated request with optional re-model', support: 'independent' },
    { focus: 'Adapt a trained phrase to a changed person, object, or place', plannedContent: 'Meaningful substitution in a short request; not rote echo alone', support: 'semantic_cue' },
    { focus: 'Combine two short trained expressions into a useful message', plannedContent: 'Two-unit functional message with cue tracking', support: 'independent' },
    { focus: 'Select and initiate an appropriate phrase in a simulated daily-life exchange', plannedContent: 'Conversation prompt without automatic spoken target reveal', support: 'independent' },
    { focus: 'Use a functional message flexibly during an unfamiliar simulated exchange', plannedContent: 'Novel scenario bank and clinician-reviewed message adequacy; no automatic real-world transfer claim', support: 'independent' },
  ]),

  'sentence-game': defineUnwiredStages([
    { focus: 'Recognize an agent-action pair with a full sentence model', plannedContent: 'Two-unit spoken/visual sentence support', support: 'carrier_or_full_model' },
    { focus: 'Complete a familiar subject-verb sentence using a choice prompt', plannedContent: 'Short everyday S–V response with visible alternatives', support: 'choice_based' },
    { focus: 'Form a simple subject-verb-object message from familiar words', plannedContent: 'Concrete agents and objects with semantic highlighting', support: 'semantic_cue' },
    { focus: 'Produce a short sentence with basic grammatical markers', plannedContent: 'Common tense/article frames without automatic full-sentence reveal', support: 'open_response' },
    { focus: 'Describe an everyday event using a complete clause', plannedContent: 'Varied subjects, objects and prepositions', support: 'open_response' },
    { focus: 'Connect two related events in a coherent sentence', plannedContent: 'Short conjunctions and two-event prompts', support: 'open_response' },
    { focus: 'Produce a sentence with an embedded reason or time relation', plannedContent: 'Because/when frame, with cue use tracked', support: 'open_response' },
    { focus: 'Explain a new everyday situation in an independently formulated message', plannedContent: 'Novel event prompts and human-reviewed grammatical/functional adequacy', support: 'open_response' },
  ]),

  'thought-organization': defineUnwiredStages([
    { focus: 'Select the main idea from a supported visual or spoken prompt', plannedContent: 'One-topic recognition with pictured choices', support: 'choice_based' },
    { focus: 'Organize two ideas into a meaningful order with cues', plannedContent: 'First/next prompts using familiar activities', support: 'semantic_cue' },
    { focus: 'Express three connected ideas using an outline', plannedContent: 'Simple beginning-middle-end support', support: 'semantic_cue' },
    { focus: 'Explain why one idea follows another', plannedContent: 'Cause-effect question with reduced outline', support: 'open_response' },
    { focus: 'Give a brief organized account with only an opening cue', plannedContent: 'Personal event or plan with optional visual structure', support: 'open_response' },
    { focus: 'Separate essential information from less relevant details', plannedContent: 'Relevant-versus-extra detail task', support: 'open_response' },
    { focus: 'Stay on topic while answering a follow-up question', plannedContent: 'Multi-turn communication with intentional topic monitoring', support: 'open_response' },
    { focus: 'Organize a novel practical explanation without a prescribed script', plannedContent: 'Unfamiliar functional explanation with human-rated coherence', support: 'open_response' },
  ]),

  'word-finding': defineUnwiredStages([
    { focus: 'Retrieve a very familiar name after a full spoken model', plannedContent: 'High-frequency concrete word and model', support: 'carrier_or_full_model' },
    { focus: 'Retrieve a familiar name with an initial-sound cue', plannedContent: 'Common pictured nouns and phonemic prompt', support: 'phonemic_cue' },
    { focus: 'Name familiar objects from a meaning cue', plannedContent: 'Semantic cues with distinct everyday objects', support: 'semantic_cue' },
    { focus: 'Independently name a familiar item across varied examples', plannedContent: 'Fresh pictures of trained semantic categories', support: 'independent' },
    { focus: 'Retrieve less common concrete words across categories', plannedContent: 'Medium-frequency stimuli with verified difficulty tags', support: 'independent' },
    { focus: 'Use a description when a specific word is temporarily unavailable', plannedContent: 'Circumlocution alternative allowed and tagged separately', support: 'independent' },
    { focus: 'Retrieve target words while topic or context changes', plannedContent: 'Alternating-category items with adequate silence allowance', support: 'independent' },
    { focus: 'Express an intended message using a word or effective alternative in a new situation', plannedContent: 'Functional scene scoring with caregiver/SLP review; not ASR exact-match alone', support: 'independent' },
  ]),

  'follow-directions': defineUnwiredStages([
    { focus: 'Follow one concrete spoken instruction with visual demonstration', plannedContent: 'Single-step action, no reading requirement', support: 'after_replay' },
    { focus: 'Follow one familiar spoken instruction without a visual demonstration', plannedContent: 'Single-step auditory comprehension', support: 'first_listen' },
    { focus: 'Follow two familiar sequential instructions with replay available', plannedContent: 'Two-step action using concrete objects', support: 'after_replay' },
    { focus: 'Follow two spoken instructions in the correct order on first presentation', plannedContent: 'Two-step order with no text dependency', support: 'first_listen' },
    { focus: 'Follow three connected instructions with time to plan', plannedContent: 'Three-step everyday command, low distractor demand', support: 'first_listen' },
    { focus: 'Interpret directional or conditional qualifiers in a multi-step command', plannedContent: 'Before/after and location terms with hearing/vision accommodations', support: 'first_listen' },
    { focus: 'Follow directions with several relevant competing objects', plannedContent: 'Multiple-step spoken instruction with controlled distractors', support: 'first_listen' },
    { focus: 'Respond to an unfamiliar functional direction sequence without visual text', plannedContent: 'Novel everyday tasks; clinician review of receptive accuracy', support: 'first_listen' },
  ]),

  'sequence-builder': defineUnwiredStages([
    { focus: 'Place two clearly ordered pictured events with a worked example', plannedContent: 'Two-step routine and explicit first/last cue', support: 'choice_based' },
    { focus: 'Place two familiar events in order without a worked example', plannedContent: 'Two-picture temporal ordering', support: 'recognition_only' },
    { focus: 'Arrange three familiar events with an optional first-step hint', plannedContent: 'Simple everyday sequence with semantic cue', support: 'semantic_cue' },
    { focus: 'Arrange three novel events from a familiar scenario', plannedContent: 'Unseen three-step routine with no model', support: 'recognition_only' },
    { focus: 'Arrange four steps with a coherent outcome', plannedContent: 'Longer functional sequence, adjustable preview', support: 'recognition_only' },
    { focus: 'Identify cause and consequence while organizing a sequence', plannedContent: 'Reordering prompts with causal relation choices', support: 'recognition_only' },
    { focus: 'Choose among two plausible multi-step event orders', plannedContent: 'Controlled distractors and explanation optional', support: 'recognition_only' },
    { focus: 'Sequence an unfamiliar practical situation without step-by-step prompting', plannedContent: 'Novel functional scene bank with separately assessed comprehension', support: 'recognition_only' },
  ]),

  'functional-scenes': defineUnwiredStages([
    { focus: 'Trigger a visible scene action from one modeled functional word', plannedContent: 'Short single-command scene and spoken model', support: 'carrier_or_full_model' },
    { focus: 'Select one of two context-appropriate words to change the scene', plannedContent: 'Two familiar scene commands with pictured choice', support: 'choice_based' },
    { focus: 'Use a familiar word to complete a small functional goal', plannedContent: 'Repeatable object/action result and semantic cue', support: 'semantic_cue' },
    { focus: 'Initiate a single known command from scene context', plannedContent: 'Prompted intent without a spoken full-word model', support: 'independent' },
    { focus: 'Combine action and object words for an intended result', plannedContent: 'Verb-noun scene interaction; assess intent apart from ASR exact match', support: 'independent' },
    { focus: 'Adjust a previous command after seeing an unexpected scene result', plannedContent: 'Functional repair with safe visual feedback', support: 'independent' },
    { focus: 'Achieve a scene goal using an alternative acceptable expression', plannedContent: 'Multiple valid commands and clinician-reviewed mapping', support: 'independent' },
    { focus: 'Communicate a new scene goal with flexible functional commands', plannedContent: 'Novel scenes, no automatic accuracy inference from speech alone', support: 'independent' },
  ]),
};

/** No score/persistence calls are permitted from this specification module. */
export const UNWIRED_EXERCISE_LEVELS_VERSION = '1.0.0-proposed';
