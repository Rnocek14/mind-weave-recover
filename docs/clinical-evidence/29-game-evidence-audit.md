# NeuroSpark — Clinical Evidence and Progression Audit for All 29 Activities

**Status:** technical design audit for the stacked draft PRs #101–#102; not a clinician-reviewed instrument, medical device approval, or product efficacy claim. This document is generated from the required game-level contract in `src/lib/clinicalEvidenceRegistry.ts`. No patient data were processed.

## Clinical basis and meaning of evidence categories

- **Direct method (5 games):** the app resembles an established aphasia intervention (such as word retrieval, SFA, script training or grammatical sentence treatments). This says nothing about NeuroSpark's own dose, scoring reliability, eight-stage order, or real-world impact.
- **Related (17 games):** clinical guidance supports a similar rehabilitation construct or strategy, but the specific digital mechanic and eight-level implementation are translational design.
- **Exploratory (7 games):** a plausible training target without direct evidence supporting the exact game/progression as rehabilitation; needs prioritised clinician appraisal.
- **None of the 29 games is a clinically validated eight-level NeuroSpark instrument.** Do not assert otherwise from passed software tests.

The uploaded research synthesis, `Clinical Progression Ladders for Seventeen Aphasia and Cognitive Linguistic Therapy Games.docx`, recommends **one primary progression axis per game**, at most a limited secondary modifier, and cues/support as an independent dimension rather than disguised difficulty. It explicitly identifies proposed 75–85% accuracy bands as *calibration defaults*, not published universal thresholds. Its 17-game analysis is a planning synthesis, not a controlled evaluation of NeuroSpark. The remaining games were mapped using broader cited clinical guidance, with appropriately modest evidence labels.

**High-level guidelines:** ESO (2025) suggests individualized, functionally relevant aphasia therapy with difficulty adapted to each person and supports digitally delivered therapy. Canadian Stroke Best Practices (2025) recommends validated assessments, tailored plans, meaningful repetitive motor practice, and supported communication. These **do not** validate any fixed eight-level hierarchy or automatic level-up calculation in this application.

**Critical generalization lesson:** The Big CACTUS RCT found computer therapy improved practiced-word retrieval, while untreated words and everyday conversation did not show corresponding generalization. Separately test trained items, untrained items, simulated communication and real-world conversation. Do not turn improvement in repeated trials into a medical recovery claim.

## Complete 29-game progression target and evidence mapping

| Activity | Research fit | Measurement track | Primary progression axis | What the game could measure | Reference keys |
| --- | --- | --- | --- | --- | --- |
| Abstract Compare | exploratory | expressive | Concept abstractness and imageability, not sentence length | Relevant, accurate similarities and differences across a comparable concept pair | CANADA_COGNITION, ASHA_APHASIA |
| Conversation Coach | related | expressive | Interactional complexity: turns, topic shifts and repair opportunities | Successful functional message and independently attempted conversational repair | CANADA_LANGUAGE, ASHA_APHASIA, PARTNER_TRAINING_REVIEW |
| Conversation Partner | related | expressive | Pragmatic contingency in unscripted exchanges | Topic maintenance, response relevance, initiation and successful repair | CANADA_LANGUAGE, ASHA_APHASIA, PARTNER_TRAINING_REVIEW |
| Describe Guess | related | expressive | Target feature opacity and imageability with constant describe-until-guessed rule | Distinctive semantic features and whether the intended message was conveyed | ASHA_APHASIA, CANADA_LANGUAGE, SFA_REVIEW |
| Detective Mind | exploratory | receptive | Inferential load and implicit clue integration | Correct justified inference from supported, matched-language clues | CANADA_COGNITION, ASHA_APHASIA |
| Dual Load Naming | related | expressive | Concurrent-task interference while naming target difficulty remains stable | Naming validity plus concurrent task accuracy, recorded separately | CANADA_COGNITION, ASHA_APHASIA |
| Fix Sentence | related | expressive | Syntactic relation and error complexity, not word-count alone | Grammatical and meaningful repair with defensible alternative sentences | ASHA_APHASIA, CANADA_LANGUAGE, SENTENCE_REVIEW |
| Left Side Hunt | related | non-linguistic | Systematic leftward visual exploration under controlled clutter | Target detection, search pattern, side and assistance, not spoken output | CANADA_VISION, CANADA_COGNITION |
| Meaning Match | related | receptive | Semantic distance between plausible meaning alternatives | Unaided identification of intended meaning among controlled competitors | ASHA_APHASIA, CANADA_LANGUAGE |
| Minimal Pairs | related | receptive | Auditory phoneme contrast and controlled acoustic similarity | Accurate first-hearing discrimination with replay separately recorded | ASHA_APHASIA, CANADA_LANGUAGE |
| Multi Step Plan | related | expressive | Plan depth, ordered dependencies and subgoals | Valid functional order, retained dependencies and independent self-correction | CANADA_COGNITION |
| Narrative Retell | related | expressive | Story-grammar and discourse macrostructure complexity | Correct information units, event sequence and global coherence | ASHA_APHASIA, CANADA_LANGUAGE, SENTENCE_REVIEW |
| Pattern Match | exploratory | non-linguistic | Rule induction and controlled sequence complexity | Correct application of a novel nonverbal rule, with supports recorded | CANADA_COGNITION |
| Phonological Awareness | related | receptive | Phoneme segmentation and manipulation complexity | Accurate target sound identification/manipulation, replay separated | ASHA_APHASIA, CANADA_LANGUAGE |
| Photo Naming | direct-method | expressive | Lexical retrieval complexity while cue support is independently tracked | Valid target or meaning-equivalent response, error type and help delivered | ASHA_APHASIA, BIG_CACTUS, CANADA_LANGUAGE, SFA_REVIEW |
| Phrase Practice | direct-method | expressive | Functional script autonomy and flexible use, not repeated phrase length alone | Correct communicative intent with independent versus modeled production | ASHA_APHASIA, CANADA_LANGUAGE, SCRIPT_TRAINING_RCT |
| Reach Tap | related | non-linguistic | Comfortable task-specific reach accuracy and control | Targeting precision, device/hand used, assistance and fatigue | CANADA_MOTOR |
| Semantic Features | direct-method | expressive | Target semantic abstractness and feature discriminability | Nonredundant, correct target features recorded by independence and cues | ASHA_APHASIA, CANADA_LANGUAGE, SFA_REVIEW |
| Sentence Construction | direct-method | expressive | Syntactic structure complexity and argument relations | Grammatically valid produced sentence and thematic-role accuracy | ASHA_APHASIA, CANADA_LANGUAGE, SENTENCE_REVIEW |
| Sentence Game | related | expressive | Self-formulated clause and grammatical relation complexity | Independent intelligible agent-action-object message or adequate alternative | ASHA_APHASIA, CANADA_LANGUAGE, SENTENCE_REVIEW |
| Thought Continuation | exploratory | expressive | Contextual under-specification and self-generated proposition demand | Relevant coherent continuation with independent intent | CANADA_LANGUAGE, ASHA_APHASIA |
| Thought Organization | related | expressive | Organization of propositions and goal-relevant sequence | Relevant ordered ideas, causal links and topic retention | CANADA_COGNITION, CANADA_LANGUAGE |
| Two Clues | exploratory | expressive | Semantic cue diagnosticity and competitor resolution | Valid convergent target or defensible alternative; actual hint use separately | ASHA_APHASIA, CANADA_LANGUAGE |
| Word Finding | direct-method | expressive | Independent lexical retrieval across personally relevant semantic contexts | Target named or effective circumlocution; those outcomes marked separately | ASHA_APHASIA, BIG_CACTUS, SFA_REVIEW |
| Follow Directions | related | receptive | Spoken instruction step/dependency complexity, with constant accessible audio | Correct ordered action on first presentation versus after replay | CANADA_LANGUAGE, ASHA_APHASIA |
| Category Fluency | related | expressive | Semantic search and switching demand with comparable timed windows | Unique valid category items and switching quality, separated from cues | CANADA_COGNITION, ASHA_APHASIA |
| Synonym Generator | exploratory | expressive | Semantic competition and intended word sense specificity | Context-appropriate substitute or paraphrase, not one string only | ASHA_APHASIA |
| Sequence Builder | related | receptive | Temporal/causal dependencies in meaningful everyday sequences | Correct independent ordering, partial order and cause-effect reasoning | CANADA_COGNITION |
| Command Scenes | exploratory | expressive | Context-appropriate functional commands and goal changes | Successfully communicated intended scene action with acceptable phrasing | CANADA_LANGUAGE, ASHA_APHASIA |

## Required separation of outcomes

1. **Trial performance:** Did the patient perform the specific task on an actual trial, with what modality, answer validity, assistance and uncertainty? Includes stopped/abandoned/skip and failed recognition.
2. **Within-game progress:** Can the patient perform *harder, genuinely different* tasks within one target skill across sessions? Short-term adaptation should change pacing and support separately from saved clinical stage.
3. **Untrained generalization:** Does the skill hold on previously unseen, difficulty-matched stimuli without the memorized answer/model? Record trained and untrained separately.
4. **Functional communication/activity:** Can the patient accomplish the intended real-life communication, cognitive or motor task with an unfamiliar person or situation? AI roleplay success is not automatically real-world transfer.
5. **Clinical outcome:** Does a clinician-administered, validated and relevant measure change, with a design capable of distinguishing treatment effects from practice, fatigue and spontaneous recovery? Not inferred automatically from points or a game level.

**No auto-promotion from unsupported evidence.** Valid per-game promotion will require operational stage content, patient-specific persistence, ability-appropriate scoring, true cue attribution, stable comparable independent probes, and criteria signed off by an appropriately qualified SLP or OT/vision clinician. The current existing heuristic rules remain unchanged by this audit; clinician review is pending.

## Game-specific measurement confounds and transfer checks

### Abstract Compare

- **Key measurement confound:** General knowledge, culture, and vocabulary can masquerade as reasoning
- **Independent transfer check:** Untrained concept pair with independent human-rated relation accuracy
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Conversation Coach

- **Key measurement confound:** AI partner variability, prompted imitation and TTS echo can inflate success
- **Independent transfer check:** Unscripted conversation with an unfamiliar partner, scored separately
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Conversation Partner

- **Key measurement confound:** An overly accommodating AI partner can conceal communication difficulty
- **Independent transfer check:** Independent real-world partner-rated functional goal assessment
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Describe Guess

- **Key measurement confound:** AI guesser instability, forbidden gestures and target-word leakage distort scores
- **Independent transfer check:** Novel target conveyed to a person without seeing the answer
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Detective Mind

- **Key measurement confound:** Reading demand and memory span can dominate inference
- **Independent transfer check:** New cases with equivalent comprehension demands and clinician review
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Dual Load Naming

- **Key measurement confound:** Response speed alone or changing both loads prevents interpretation
- **Independent transfer check:** Untrained naming under an equivalent validated dual-task condition
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Fix Sentence

- **Key measurement confound:** Exact-string scoring rejects valid grammar; cues mask independence
- **Independent transfer check:** Untrained sentence structures reviewed for grammatical adequacy
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Left Side Hunt

- **Key measurement confound:** Vision loss, device layout or lighting can mimic spatial neglect
- **Independent transfer check:** Functional visual search and validated neglect assessment by a specialist
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Meaning Match

- **Key measurement confound:** Uneven reading load, implausible foils and item memorization
- **Independent transfer check:** Held-out, difficulty-balanced semantic discrimination items
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Minimal Pairs

- **Key measurement confound:** Hearing loss, equipment and text labels may confound phonemic processing
- **Independent transfer check:** Novel minimal pairs with calibrated playback and hearing accommodations
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Multi Step Plan

- **Key measurement confound:** Complicated wording may become a language-comprehension test
- **Independent transfer check:** New everyday task evaluated with functional planning criteria
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Narrative Retell

- **Key measurement confound:** Word count, repeated stories or ASR omissions create false improvement
- **Independent transfer check:** Untrained stories scored with a reproducible human-checked rubric
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Pattern Match

- **Key measurement confound:** Visual acuity, motor precision and memory load masquerade as rule learning
- **Independent transfer check:** Independent nonverbal rule-transfer task, not aphasia outcome
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Phonological Awareness

- **Key measurement confound:** Orthography and microphone/acoustic artifacts confound phonology
- **Independent transfer check:** Novel phonological material assessed separately from reading
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Photo Naming

- **Key measurement confound:** Speech-recognition error and rehearsed items can inflate naming outcomes
- **Independent transfer check:** Untrained naming probes distinct from therapy words
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Phrase Practice

- **Key measurement confound:** Echoed target, fixed scripts and ASR match are not real-world generalization
- **Independent transfer check:** Personally relevant unprompted exchange with another speaker
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Reach Tap

- **Key measurement confound:** Touchscreen tapping is not a validated measure of upper limb recovery
- **Independent transfer check:** Functional upper-limb activity evaluated with standardized motor measure
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Semantic Features

- **Key measurement confound:** More clues or more words may not reflect improved semantic retrieval
- **Independent transfer check:** Untrained naming and feature generation distinct from practiced items
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Sentence Construction

- **Key measurement confound:** Longer sentences and tile arrangement alone do not prove sentence production
- **Independent transfer check:** Novel syntactic structures produced without automatic full models
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Sentence Game

- **Key measurement confound:** Choice/tile success is not equivalent to spontaneous sentence generation
- **Independent transfer check:** Untrained sentence prompt rated for grammar and intended meaning
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Thought Continuation

- **Key measurement confound:** Grammar-only scoring and auto-complete cues hide discourse difficulty
- **Independent transfer check:** Novel contexts scored for cohesion and self-initiated content
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Thought Organization

- **Key measurement confound:** More words, rigid scripts or dictated outlines can mask organization
- **Independent transfer check:** New functional explanation scored for coherence by a trained rater
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Two Clues

- **Key measurement confound:** A strong anchor match must never be mistaken for a delivered cue
- **Independent transfer check:** Novel clue combinations with accepted-alternative review
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Word Finding

- **Key measurement confound:** ASR exact match and memorized items can be mistaken for generalized naming
- **Independent transfer check:** Untrained personally meaningful words distinct from practice set
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Follow Directions

- **Key measurement confound:** Literacy, motor limitations and hearing may bias auditory comprehension
- **Independent transfer check:** Novel commands assessed in supported real-world action contexts
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Category Fluency

- **Key measurement confound:** Time changes, repeats and education/cultural exposure bias output
- **Independent transfer check:** Novel matched categories with consistent timing and cluster metrics
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Synonym Generator

- **Key measurement confound:** Multiple valid synonyms, polysemy and lexical frequency confound scoring
- **Independent transfer check:** Untrained contextual substitution assessed for equivalent meaning
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Sequence Builder

- **Key measurement confound:** Drag precision, reading and rote familiar pictures distort cognitive score
- **Independent transfer check:** Novel everyday sequence demonstrated with functional performance
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

### Command Scenes

- **Key measurement confound:** Preloaded keywords and prompted echoes mask independent requests
- **Independent transfer check:** Unseen everyday scene intent tested with a human communication partner
- **What is NOT established:** an empirically validated eight-rung NeuroSpark hierarchy, promotion thresholds, and real-world functional gain attributable to this game

## Development and clinical release criteria

- [ ] Every stage's underlying *skill construct* has been confirmed by the appropriate clinician, with a documented citation fit and population.
- [ ] Stage-to-stage complexity changes only the intended primary axis; cue fading, time pressure, repetition, extra words, and user interface changes cannot masquerade as recovery.
- [ ] Every task has sufficient adult-appropriate exemplars, valid alternates, distractor controls and reserved untrained probes; item difficulty and content quality are reviewed.
- [ ] Independent, semantic, phonemic, choice-based and full-model help are separately logged; caregiver overrides, text responses and AI echoes do not count as independent spoken success.
- [ ] For each stage, a defensible, per-game decision rule is clinician-reviewed, with adequate trial sample, multiple-session stability, fatigue safeguards, uncertainty and patient-specific starting state.
- [ ] Test real aphasic speech, pauses, unintelligible utterances, environmental noise, device differences, visual and motor accessibility, and failure-to-recognize cases before trusting scores.
- [ ] Validate persistence, authorization, isolation and clinician-readback against a dedicated staging database; browser mocks alone do not prove durability.
- [ ] Validate test/retest reliability, sensitivity to change, appropriate reference measures, rater agreement and the extent of untrained transfer with people who have aphasia.
- [ ] Distinguish motor/visual results, receptive language, expressive language and participation; never aggregate all into a single language-recovery score.
- [ ] Run the existing full regression suite and independent patient/clinician usability reviews on every promoted implementation PR.

## Source index

- **ASHA_APHASIA** — ASHA Aphasia Practice Portal (clinical-practice). https://www.asha.org/practice-portal/clinical-topics/aphasia/
- **ESO_2025** — European Stroke Organisation Aphasia Rehabilitation Guideline (2025) (guideline). https://academic.oup.com/esj/article/10/4/1189/8377346
- **CANADA_LANGUAGE** — Canadian Stroke Best Practices, Language and Communication (2025) (guideline). https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/7-language-and-communication
- **CANADA_COGNITION** — Canadian Stroke Best Practices, Cognitive Rehabilitation (2025) (guideline). https://www.strokebestpractices.ca/recommendations/activity-participation-following-stroke/3-cognitive-rehabilitation-for-individuals-with-stroke
- **CANADA_VISION** — Canadian Stroke Best Practices, Visual and Visual-Perceptual Impairment (2025) (guideline). https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/8-visual-and-visual-perceptual-impairment
- **CANADA_MOTOR** — Canadian Stroke Best Practices, Upper Extremity Function (2025) (guideline). https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/1-initial-stroke-rehabilitation-screening-and-assessment
- **BIG_CACTUS** — Big CACTUS computerized aphasia therapy RCT (trial). https://www.ncbi.nlm.nih.gov/books/NBK556719/
- **SFA_REVIEW** — Semantic Feature Analysis systematic review (2014) (systematic-review). https://pubmed.ncbi.nlm.nih.gov/24797214/
- **SENTENCE_REVIEW** — Aphasia sentence treatment evidence scoping review (2022) (systematic-review). https://pubmed.ncbi.nlm.nih.gov/34941377/
- **PARTNER_TRAINING_REVIEW** — Communication partner training in aphasia systematic review (2016) (systematic-review). https://pubmed.ncbi.nlm.nih.gov/27117383/
- **SCRIPT_TRAINING_RCT** — Script training dose and generalization randomized trial (2026) (trial). https://pubmed.ncbi.nlm.nih.gov/42821294/

**Important:** Sources support the **clinical context or treatment ingredients** as described; they are not citations for exact NeuroSpark game rules. See the individual per-ladder `docs/clinical-evidence/` files for more context. A source appearing in this index is **not** a regulatory endorsement.
