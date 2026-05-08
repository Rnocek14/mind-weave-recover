/**
 * Per-Game Clinical Rungs (v1 — spec, read-only consumed by About page)
 *
 * 2–4 named clinical rungs per game + orthogonal modifiers. References
 * the shared dimension vocabulary in `clinicalDimensions.ts`. Mapped
 * onto the existing 1–10 universal level so the engine keeps running
 * unchanged — only the *label* and clinician explanation change.
 *
 * IMPORTANT: Spec-only. Not imported by the adaptation engine. Only the
 * About page and (later) clinician explanations should read this.
 */

import type { ClinicalDimensionId } from './clinicalDimensions';

export type RungReadiness = 'ready' | 'thin' | 'aspirational';

export interface ClinicalRung {
  /** Short patient-facing name, e.g. "Single Event Retell". */
  name: string;
  /** Plain-language description of what this rung trains. */
  description: string;
  /** Dimensions this rung primarily stresses. */
  stresses: ClinicalDimensionId[];
  /** Plain-language mastery criterion. */
  masteryCriterion: string;
  /** How much real, tagged content backs this rung today. */
  readiness: RungReadiness;
  /** Inclusive 1–10 level range this rung corresponds to. */
  levelRange: [number, number];
}

export interface GameClinicalProfile {
  /** Underscored slug, matches PER_GAME_CONTRACTS keys. */
  slug: string;
  /** Hyphenated URL slug, matches /exercise/:slug routes. */
  urlSlug: string;
  /** Display title. */
  title: string;
  /** One-sentence patient-facing summary of what this game trains. */
  patientSummary: string;
  /** One-sentence clinician summary (dominant axis + rationale). */
  clinicalSummary: string;
  /** The dominant clinical axis (e.g. "lexical retrieval independence"). */
  dominantAxis: string;
  /** 2–4 named rungs, ordered easiest → hardest. */
  rungs: ClinicalRung[];
  /** Orthogonal modifiers the engine adapts independently of rung. */
  modifiers: ClinicalDimensionId[];
  /** What the coach watches in real time. */
  telemetryWatched: string[];
  /** Why support may temporarily increase (adaptation, not regression). */
  whySupportMayIncrease: string;
  /** What comes after the top rung. */
  whatComesNext: string;
}

const profiles: GameClinicalProfile[] = [
  {
    slug: 'photo_naming',
    urlSlug: 'photo-naming',
    title: 'Name That Photo',
    patientSummary: 'Strengthens the link between an everyday object and the word for it.',
    clinicalSummary: 'Confrontation naming targeting lexical retrieval independence with frequency- and imageability-graded stimuli.',
    dominantAxis: 'Lexical retrieval independence',
    rungs: [
      {
        name: 'Supported high-frequency naming',
        description: 'High-frequency, concrete everyday objects with cues available on request.',
        stresses: ['retrieval_burden', 'cue_dependency'],
        masteryCriterion: 'Names familiar items accurately with at most light cueing.',
        readiness: 'ready',
        levelRange: [1, 3],
      },
      {
        name: 'Independent familiar naming',
        description: 'Familiar items without first-sound or semantic cues.',
        stresses: ['independence', 'cue_dependency'],
        masteryCriterion: 'Names familiar items independently across a session without heavy cueing.',
        readiness: 'ready',
        levelRange: [4, 6],
      },
      {
        name: 'Lower-frequency / less typical items',
        description: 'Less common or less prototypical items. Word-finding effort climbs.',
        stresses: ['retrieval_burden', 'abstraction'],
        masteryCriterion: 'Reaches >70% accuracy on lower-frequency or atypical items.',
        readiness: 'thin',
        levelRange: [7, 8],
      },
      {
        name: 'Timed retrieval / category switching',
        description: 'Tighter response windows, distractors, and reduced cue availability.',
        stresses: ['processing_speed', 'distractor_load', 'independence'],
        masteryCriterion: 'Responds quickly and accurately under time pressure with minimal cues.',
        readiness: 'aspirational',
        levelRange: [9, 10],
      },
    ],
    modifiers: ['cue_dependency', 'processing_speed', 'distractor_load'],
    telemetryWatched: ['accuracy', 'response latency', 'cue use', 'semantic errors', 'phonemic errors', 'no-response', 'self-correction'],
    whySupportMayIncrease: 'If you fatigue or several trials in a row are hard, the coach may add cues for the rest of the session. Your long-term level does not drop because of a single tired session.',
    whatComesNext: 'Naming under conversation-level demands — Smart Coach and Free Talk transfer naming into spontaneous speech.',
  },
  {
    slug: 'minimal_pairs',
    urlSlug: 'minimal-pairs',
    title: 'Minimal Pairs',
    patientSummary: 'Trains your ear to tell apart speech sounds that are easy to confuse.',
    clinicalSummary: 'Auditory phoneme discrimination across graded acoustic similarity, with shadow-mode phoneme telemetry.',
    dominantAxis: 'Phoneme discrimination',
    rungs: [
      {
        name: 'Distinct contrasts',
        description: 'Sound pairs that differ a lot — easy to hear apart.',
        stresses: ['speech_motor_precision'],
        masteryCriterion: 'High accuracy on distant contrasts at slow pace.',
        readiness: 'ready',
        levelRange: [1, 3],
      },
      {
        name: 'Single-feature contrasts',
        description: 'Sounds that differ by one feature (voicing, place, or manner).',
        stresses: ['speech_motor_precision', 'distractor_load'],
        masteryCriterion: '>70% on single-feature contrasts at standard pace.',
        readiness: 'thin',
        levelRange: [4, 7],
      },
      {
        name: 'Fast discrimination with similar distractors',
        description: 'Quick decisions on highly similar pairs in noisier conditions.',
        stresses: ['processing_speed', 'distractor_load'],
        masteryCriterion: 'Maintains accuracy under time pressure and across voices.',
        readiness: 'aspirational',
        levelRange: [8, 10],
      },
    ],
    modifiers: ['processing_speed', 'cue_dependency'],
    telemetryWatched: ['correct discrimination', 'confused phoneme pairs', 'response time', 'repeated sound-specific errors', 'cue dependency'],
    whySupportMayIncrease: 'If a specific sound pair keeps tripping you up, the coach may slow the audio or repeat it. Phoneme-targeted selection is currently in shadow mode and not yet driving content.',
    whatComesNext: 'Phoneme accuracy in production — Phonological Awareness and Photo Naming provide the speaking transfer.',
  },
  {
    slug: 'fix_sentence',
    urlSlug: 'fix-sentence',
    title: 'Fix the Sentence',
    patientSummary: 'Practices spotting and repairing small grammar mistakes in sentences.',
    clinicalSummary: 'Receptive grammar repair across length, error-type subtlety, and embedded structure.',
    dominantAxis: 'Syntactic repair',
    rungs: [
      {
        name: 'Word order in simple sentences',
        description: 'Subject–verb–object ordering in short, common sentences.',
        stresses: ['linguistic_complexity'],
        masteryCriterion: 'Reliably repairs basic SVO and missing-word errors.',
        readiness: 'ready',
        levelRange: [1, 3],
      },
      {
        name: 'Function words and morphology',
        description: 'Articles, prepositions, verb tense and agreement.',
        stresses: ['linguistic_complexity', 'working_memory_load'],
        masteryCriterion: 'Catches function-word and tense errors without highlight cues.',
        readiness: 'ready',
        levelRange: [4, 6],
      },
      {
        name: 'Compound and embedded sentences',
        description: 'Longer sentences with embedded clauses or multiple errors.',
        stresses: ['linguistic_complexity', 'working_memory_load'],
        masteryCriterion: 'Repairs longer sentences with at most one cue.',
        readiness: 'ready',
        levelRange: [7, 8],
      },
      {
        name: 'Functional conversation-level syntax',
        description: 'Naturalistic, conversation-style sentences with subtle errors under time pressure.',
        stresses: ['linguistic_complexity', 'processing_speed', 'independence'],
        masteryCriterion: 'Independent repair at functional pace.',
        readiness: 'aspirational',
        levelRange: [9, 10],
      },
    ],
    modifiers: ['cue_dependency', 'processing_speed'],
    telemetryWatched: ['grammar accuracy', 'cue level', 'sentence length', 'error type', 'working memory load'],
    whySupportMayIncrease: 'Long sentences fatigue working memory quickly. The coach may shorten sentences or highlight the error region in real time without lowering your long-term level.',
    whatComesNext: 'Sentence Construction and Smart Coach carry repaired syntax into spontaneous use.',
  },
  {
    slug: 'narrative_retell',
    urlSlug: 'narrative-retell',
    title: 'Narrative Retell',
    patientSummary: 'Practices retelling short stories with the right events in the right order.',
    clinicalSummary: 'Discourse-level reproduction targeting narrative organization, sequencing, and inference.',
    dominantAxis: 'Discourse / narrative organization',
    rungs: [
      {
        name: 'Single-event retell',
        description: 'One short event, recalled in a sentence or two.',
        stresses: ['discourse_organization', 'working_memory_load'],
        masteryCriterion: 'Recalls the gist of a single event without prompts.',
        readiness: 'thin',
        levelRange: [1, 3],
      },
      {
        name: 'Sequenced retell',
        description: 'Beginning, middle, end. Before/after language.',
        stresses: ['discourse_organization', 'working_memory_load'],
        masteryCriterion: 'Sequences 2–3 events in correct order.',
        readiness: 'thin',
        levelRange: [4, 6],
      },
      {
        name: 'Connected narrative',
        description: 'Multiple events with characters and causal links.',
        stresses: ['discourse_organization', 'linguistic_complexity', 'working_memory_load'],
        masteryCriterion: 'Produces a coherent narrative with most propositions intact.',
        readiness: 'aspirational',
        levelRange: [7, 8],
      },
      {
        name: 'Independent story organization',
        description: 'Coherent retell with reduced cues, plus inference, emotion, or summary.',
        stresses: ['discourse_organization', 'abstraction', 'independence'],
        masteryCriterion: 'Organizes a full story independently with summary or inference.',
        readiness: 'aspirational',
        levelRange: [9, 10],
      },
    ],
    modifiers: ['cue_dependency', 'processing_speed', 'working_memory_load'],
    telemetryWatched: ['event units recalled', 'sequence accuracy', 'coherence', 'cue dependency', 'omissions', 'inferencing success'],
    whySupportMayIncrease: 'Long narratives stress memory. The coach may chunk replay or offer an outline so you can practice the structure without losing the events.',
    whatComesNext: 'Free Talk and Smart Coach transfer narrative organization to spontaneous conversation.',
  },
];

// Generic 3-rung defaults for games not yet richly specified.
function genericProfile(opts: {
  slug: string;
  urlSlug: string;
  title: string;
  patientSummary: string;
  clinicalSummary: string;
  dominantAxis: string;
  stresses: ClinicalDimensionId[];
  modifiers: ClinicalDimensionId[];
  telemetryWatched: string[];
  whySupportMayIncrease?: string;
  whatComesNext?: string;
  readiness?: [RungReadiness, RungReadiness, RungReadiness];
}): GameClinicalProfile {
  const r = opts.readiness ?? ['ready', 'thin', 'aspirational'];
  return {
    slug: opts.slug,
    urlSlug: opts.urlSlug,
    title: opts.title,
    patientSummary: opts.patientSummary,
    clinicalSummary: opts.clinicalSummary,
    dominantAxis: opts.dominantAxis,
    rungs: [
      {
        name: 'Supported foundation',
        description: 'Easier items with help available so you can get the pattern.',
        stresses: opts.stresses.slice(0, 2),
        masteryCriterion: 'Performs reliably with light cueing.',
        readiness: r[0],
        levelRange: [1, 3],
      },
      {
        name: 'Independent core',
        description: 'Standard items without heavy scaffolding.',
        stresses: opts.stresses,
        masteryCriterion: 'Reaches the success band independently across a session.',
        readiness: r[1],
        levelRange: [4, 7],
      },
      {
        name: 'Stretch & generalization',
        description: 'Harder items, fewer cues, faster pace, or added load.',
        stresses: [...opts.stresses, 'processing_speed', 'independence'].slice(0, 4) as ClinicalDimensionId[],
        masteryCriterion: 'Maintains accuracy under stretch conditions.',
        readiness: r[2],
        levelRange: [8, 10],
      },
    ],
    modifiers: opts.modifiers,
    telemetryWatched: opts.telemetryWatched,
    whySupportMayIncrease: opts.whySupportMayIncrease ?? 'If a session is hard, the coach may add cues or simplify items so you can keep practicing. Your long-term level does not drop from one tough day.',
    whatComesNext: opts.whatComesNext ?? 'Carry this skill into Smart Coach and Free Talk where it shows up in real conversation.',
  };
}

profiles.push(
  genericProfile({
    slug: 'two_clues', urlSlug: 'two-clues', title: 'Two Clues',
    patientSummary: 'Use two hints to guess a target word.',
    clinicalSummary: 'Lexical retrieval scaffolded by graded semantic clues.',
    dominantAxis: 'Cue-supported retrieval',
    stresses: ['retrieval_burden', 'cue_dependency'],
    modifiers: ['cue_dependency', 'abstraction'],
    telemetryWatched: ['accuracy', 'cue use', 'response latency'],
  }),
  genericProfile({
    slug: 'describe_guess', urlSlug: 'describe-guess', title: 'Describe & Guess',
    patientSummary: 'Describe a target so its key features come through.',
    clinicalSummary: 'Semantic feature analysis through self-generated description.',
    dominantAxis: 'Semantic feature production',
    stresses: ['retrieval_burden', 'discourse_organization'],
    modifiers: ['cue_dependency', 'abstraction'],
    telemetryWatched: ['concept anchors hit', 'partial credit', 'cue use'],
  }),
  genericProfile({
    slug: 'meaning_match', urlSlug: 'meaning-match', title: 'Meaning Match',
    patientSummary: 'Match a word or phrase to its meaning among similar options.',
    clinicalSummary: 'Receptive semantic matching with graded distractor similarity.',
    dominantAxis: 'Semantic discrimination',
    stresses: ['distractor_load', 'abstraction'],
    modifiers: ['distractor_load', 'cue_dependency'],
    telemetryWatched: ['accuracy', 'distractor type chosen', 'response latency'],
  }),
  genericProfile({
    slug: 'phonological_awareness', urlSlug: 'phonological-awareness', title: 'Phonological Awareness',
    patientSummary: 'Build sounds into words, syllable by syllable.',
    clinicalSummary: 'Phonological assembly across cluster complexity and syllable count.',
    dominantAxis: 'Phonological assembly',
    stresses: ['speech_motor_precision', 'working_memory_load'],
    modifiers: ['cue_dependency', 'processing_speed'],
    telemetryWatched: ['accuracy', 'cue use', 'pronunciation score'],
  }),
  genericProfile({
    slug: 'semantic_features', urlSlug: 'semantic-features', title: 'Semantic Features',
    patientSummary: 'Build out what makes a thing what it is — uses, parts, category.',
    clinicalSummary: 'Semantic Feature Analysis (SFA) with graded feature requirements.',
    dominantAxis: 'Semantic depth',
    stresses: ['retrieval_burden', 'abstraction'],
    modifiers: ['cue_dependency'],
    telemetryWatched: ['features produced', 'cue use', 'accuracy'],
  }),
  genericProfile({
    slug: 'synonym_generator', urlSlug: 'synonym-generator', title: 'Synonym Generator',
    patientSummary: 'Generate other words that mean the same thing.',
    clinicalSummary: 'Lexical breadth via synonym retrieval; bank tagging incomplete.',
    dominantAxis: 'Lexical breadth',
    stresses: ['retrieval_burden', 'abstraction'],
    modifiers: ['cue_dependency'],
    telemetryWatched: ['synonyms produced', 'cue use'],
    readiness: ['thin', 'aspirational', 'aspirational'],
  }),
  genericProfile({
    slug: 'sentence_construction', urlSlug: 'sentence-construction', title: 'Sentence Construction',
    patientSummary: 'Build sentences from given words, parts, or roles.',
    clinicalSummary: 'Expressive syntax across length and structural rarity.',
    dominantAxis: 'Expressive syntax',
    stresses: ['linguistic_complexity', 'working_memory_load'],
    modifiers: ['cue_dependency'],
    telemetryWatched: ['sentence accuracy', 'length', 'structure used'],
  }),
  genericProfile({
    slug: 'multi_step_planning', urlSlug: 'multi-step-plan', title: 'Multi-Step Planning',
    patientSummary: 'Order the steps of an everyday plan correctly.',
    clinicalSummary: 'Executive sequencing of functional, multi-step scenarios.',
    dominantAxis: 'Executive sequencing',
    stresses: ['working_memory_load', 'discourse_organization'],
    modifiers: ['cue_dependency', 'distractor_load'],
    telemetryWatched: ['order accuracy', 'cue use'],
    readiness: ['thin', 'thin', 'aspirational'],
  }),
  genericProfile({
    slug: 'abstract_compare', urlSlug: 'abstract-compare', title: 'Abstract Compare',
    patientSummary: 'Compare two ideas across meaning, category, or function.',
    clinicalSummary: 'Abstract semantic comparison across graded conceptual distance.',
    dominantAxis: 'Abstract reasoning',
    stresses: ['abstraction', 'retrieval_burden'],
    modifiers: ['cue_dependency'],
    telemetryWatched: ['accuracy', 'dimensions compared', 'cue use'],
    readiness: ['thin', 'aspirational', 'aspirational'],
  }),
  genericProfile({
    slug: 'dual_load_naming', urlSlug: 'dual-load-naming', title: 'Dual-Load Naming',
    patientSummary: 'Name items while a small extra task runs in the background.',
    clinicalSummary: 'Naming under cognitive load to push generalization.',
    dominantAxis: 'Naming under load',
    stresses: ['retrieval_burden', 'working_memory_load'],
    modifiers: ['processing_speed', 'cue_dependency'],
    telemetryWatched: ['accuracy', 'load condition', 'response latency'],
    readiness: ['thin', 'aspirational', 'aspirational'],
  }),
  genericProfile({
    slug: 'detective_mind', urlSlug: 'detective-mind', title: 'Detective Mind',
    patientSummary: 'Use clues to figure out who, what, or where.',
    clinicalSummary: 'Inferential reasoning across clue count and inferential distance.',
    dominantAxis: 'Inferencing',
    stresses: ['abstraction', 'working_memory_load'],
    modifiers: ['cue_dependency', 'distractor_load'],
    telemetryWatched: ['accuracy', 'clues used', 'cue use'],
    readiness: ['thin', 'thin', 'aspirational'],
  }),
);

const BY_SLUG: Record<string, GameClinicalProfile> = Object.fromEntries(
  profiles.flatMap(p => [[p.slug, p], [p.urlSlug, p]])
);

export const CLINICAL_RUNGS_VERSION = '1.0.0-spec';

export function getGameClinicalProfile(slugOrUrlSlug: string): GameClinicalProfile | null {
  if (!slugOrUrlSlug) return null;
  const direct = BY_SLUG[slugOrUrlSlug];
  if (direct) return direct;
  // Try normalizing: hyphens ↔ underscores
  const alt = slugOrUrlSlug.includes('-')
    ? slugOrUrlSlug.replace(/-/g, '_')
    : slugOrUrlSlug.replace(/_/g, '-');
  return BY_SLUG[alt] ?? null;
}

export function listGameClinicalProfiles(): GameClinicalProfile[] {
  return profiles;
}

/** Map a 1–10 universal level to the rung that contains it. */
export function rungForLevel(profile: GameClinicalProfile, level: number): ClinicalRung {
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  return (
    profile.rungs.find(r => lvl >= r.levelRange[0] && lvl <= r.levelRange[1]) ??
    profile.rungs[profile.rungs.length - 1]
  );
}
