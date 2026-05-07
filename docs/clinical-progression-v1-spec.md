# Clinical Progression v1 — Spec

**Status:** Draft for SLP review. Spec-only. No code, no schema, no enforcement.
**Scope:** 3 anchor games — Photo Naming, Fix Sentence, Minimal Pairs.
**Goal:** Define clinically meaningful persistent levels (1–8) so the trial demo
shows recognizable rehabilitation progression rather than generic difficulty.

---

## 1. Framing

Levels in v1 are **rehabilitation states**, not difficulty knobs. Each level
must describe something a speech-language pathologist would recognize as a
distinct stage of recovery for that skill.

Three anchor skills:

| Game           | Clinical skill                                                |
|----------------|---------------------------------------------------------------|
| Photo Naming   | Expressive lexical retrieval + cue fade                       |
| Fix Sentence   | Lexical-semantic / syntactic repair + working memory          |
| Minimal Pairs  | Phonological discrimination + perceptual precision            |

Levels run **1–8**. 8 is functional independence on the targeted skill, not
"impossible." Higher than 8 is reserved for future stretch / generalization
work and is intentionally out of scope.

For every game, each level defines:

- **Clinical meaning** — the rehab state this level represents
- **Primary demand** — the dominant cognitive/language load
- **Support / cue profile** — what scaffolding is available by default
- **Progression evidence** — what an SLP would accept as "earned this level"
- **Struggle signal** — what a clinician would call regression-worthy
- **Soft regression behavior** — what the system does *before* dropping a level

---

## 2. Photo Naming — Expressive Lexical Retrieval + Cue Fade

Targeted skill: independent confrontation naming, with cues fading as retrieval
stabilizes. Recognition (multiple choice, yes/no) does **not** count as
expressive progress here.

| Lvl | Clinical meaning                          | Primary demand                       | Cue profile (default)                       | Progression evidence                                 | Struggle signal                              |
|-----|-------------------------------------------|--------------------------------------|---------------------------------------------|------------------------------------------------------|----------------------------------------------|
| 1   | Severe retrieval block, cue-dependent     | Recognition + repetition             | Phonemic + semantic + carrier phrase always | ≥70% with full cues across 2 sessions                | Cannot produce even with full cue            |
| 2   | Cued naming, high-frequency concrete      | Cued retrieval                       | Phonemic + semantic on demand               | ≥70% with ≤1 cue per item                            | Needs ≥2 cues most trials                    |
| 3   | Reduced cue dependence, high-freq nouns   | Self-initiated retrieval, common     | Semantic cue on request                     | ≥70% independent on Tier-1 vocabulary                | Cue requests ≥50%                            |
| 4   | Independent naming, common nouns          | Independent retrieval, low pressure  | Cues only if asked                          | ≥75% independent across 2 sessions                   | Independent accuracy <55% sustained          |
| 5   | Independent naming, mid-frequency         | Retrieval depth                      | Cues only if asked                          | ≥75% independent on Tier-2 vocabulary                | Independent accuracy <55% sustained          |
| 6   | Lower-frequency / less imageable          | Lexical depth, phonological access   | Cues discouraged but available              | ≥70% independent on Tier-3 vocabulary                | Frequent phonemic paraphasias on Tier-3      |
| 7   | Time-pressured naming                     | Retrieval speed                      | No cues by default                          | ≥70% within target latency on Tier-2/3               | Latency drift; accuracy holds but slow       |
| 8   | Functional naming under load              | Retrieval + mild distractor          | No cues                                     | ≥70% independent + on-time on mixed Tier-2/3         | Repeated breakdowns under load               |

**Notes**
- Cue use is logged and reduces "credit" for that trial (see §5.4).
- Level 1–2 success requires the cue context to be *present*, not assumed.
- Recognition trials, if shown, are diagnostic only — not expressive evidence.

---

## 3. Fix Sentence — Lexical-Semantic / Syntactic Repair + Working Memory

Targeted skill: detect and repair sentence-level errors. Levels move from
single-word semantic substitutions toward multi-clause syntactic repair under
working-memory load.

| Lvl | Clinical meaning                              | Primary demand                                  | Support profile                            | Progression evidence                              | Struggle signal                              |
|-----|-----------------------------------------------|-------------------------------------------------|--------------------------------------------|---------------------------------------------------|----------------------------------------------|
| 1   | Detect single concrete semantic anomaly       | Semantic violation detection                    | Error highlighted; choices given           | ≥75% with highlight + choices                     | Cannot detect even with highlight            |
| 2   | Repair single-word semantic error             | Semantic substitution                           | Choices given, no highlight                | ≥75% with choices                                 | Selects distractor ≥40%                      |
| 3   | Repair single-word semantic error, open       | Lexical retrieval in repair frame               | Open response, semantic cue on request     | ≥70% open response                                | Cue requests ≥50%                            |
| 4   | Detect and repair simple morphosyntactic error| Verb tense / agreement                          | Choices given                              | ≥70% on tense/agreement items                     | Tense errors persist post-feedback           |
| 5   | Repair morphosyntactic error, open response   | Morphology + retrieval                          | Open response                              | ≥70% open response                                | Frequent omissions / over-regularizations    |
| 6   | Repair word-order error, simple sentence      | Syntactic structure                             | Open response                              | ≥70% on canonical/non-canonical SVO repairs       | Reverts to memorized template                |
| 7   | Repair multi-clause sentence                  | Syntax + working memory                         | Open response                              | ≥70% on 2-clause items                            | Loses second clause; truncates               |
| 8   | Repair under semantic + syntactic load        | Combined repair, mild time pressure             | Open response                              | ≥70% on mixed items at target pace                | Accuracy collapses when both errors present  |

**Notes**
- "Choices given" must be 3–4 plausible options including one semantically near
  distractor — never trivially obvious.
- Working memory is loaded by sentence length and clause count, not by adding
  unrelated dual tasks in v1.

---

## 4. Minimal Pairs — Phonological Discrimination + Perceptual Precision

Targeted skill: discriminate increasingly close phonological contrasts.
Optional "say it" production echo is diagnostic, not required for level credit
in v1.

| Lvl | Clinical meaning                                   | Primary demand                          | Support profile                       | Progression evidence                          | Struggle signal                          |
|-----|----------------------------------------------------|-----------------------------------------|---------------------------------------|-----------------------------------------------|------------------------------------------|
| 1   | Gross contrast, distinct place + manner            | Auditory discrimination, easy          | Slow audio, replay unlimited          | ≥80% on gross contrasts                       | <60% even with replay                    |
| 2   | Single feature contrast, high salience             | Feature-level discrimination            | Replay unlimited                      | ≥80% on single-feature pairs                  | Confuses voicing across pairs            |
| 3   | Voicing contrast, initial position                 | Voicing perception                      | Replay 2x                             | ≥75% on voicing pairs                         | Systematic voicing errors                |
| 4   | Place-of-articulation contrast, initial            | Place perception                        | Replay 2x                             | ≥75% on place pairs                           | Systematic place confusions              |
| 5   | Manner contrast, including fricatives              | Manner perception                       | Replay 1x                             | ≥75% on manner pairs                          | Fricative/affricate confusions persist   |
| 6   | Final-position contrasts                           | Coda discrimination                     | Replay 1x                             | ≥75% on final-position pairs                  | Final consonants neutralized             |
| 7   | Cluster vs. singleton contrasts                    | Sequence-level perception               | Replay 1x                             | ≥70% on cluster pairs                         | Cluster reduction perceived as singleton |
| 8   | Mixed contrasts at conversational pace             | Discrimination under pace               | No replay by default                  | ≥70% at target pace, mixed contrast set       | Accuracy drops sharply when pace tightens|

**Notes**
- Replay use is logged. Heavy replay reliance at L5+ is a struggle signal even
  if accuracy is met.
- "Say it" echo, if used, can flag production-perception mismatch but does not
  gate level progress in v1.

---

## 5. Clinical Progression v1 — Mechanics

### 5.1 Persistence
- One **current level** per (profile × game), persisted across sessions.
- One **progress within level** value (0–100%) per (profile × game).
- Next session resumes at the stored level and progress.

### 5.2 Earning progress within a level
- Each completed trial contributes to progress for the **current level only**.
- Independent correct trials contribute full credit.
- Cued / scaffolded correct trials contribute **partial** credit (see §5.4).
- Incorrect trials contribute zero (they may also feed struggle, see §5.5).
- Progress is monotonic within a session in the up direction; it does not
  decrease mid-session.

### 5.3 Crossing a level
- Level-up requires:
  1. Progress reaches 100% within the level, **and**
  2. The level's "progression evidence" criterion has been met
     (e.g. accuracy threshold across the required window).
- Both conditions are required. Hitting 100% progress without meeting the
  evidence criterion holds the user at the top of the level — it does not
  escalate.

### 5.4 Cue / support discounting (so recognition does not inflate expressive)
- Photo Naming: independent = 1.0, semantic cue = 0.6, phonemic cue = 0.4,
  carrier phrase or full model = 0.2, recognition-only trials = 0.0 toward
  expressive progress.
- Fix Sentence: open response = 1.0, choice-based = 0.6, highlight + choice =
  0.4.
- Minimal Pairs: first-listen correct = 1.0, after replay = 0.7, after
  multiple replays = 0.4.
- Discount values are spec-level intent — exact numbers tunable in
  implementation, but the *ordering* must hold.

### 5.5 Fast early progression
- Within levels 1–3, three consecutive independent corrects may advance
  progress more aggressively (e.g. larger increment) so a clearly capable user
  is not stuck at trivial levels.
- Cap: fast progression may not skip levels; it only accelerates within-level
  progress.

### 5.6 Soft regression (support increases first)
Before any level drop, the system increases support at the **current** level:

- Photo Naming: re-enable cues by default; offer semantic before phonemic.
- Fix Sentence: re-enable choice-based trials; reduce open response share.
- Minimal Pairs: restore replays; slow audio.

Soft regression is recoverable in-session: if the user stabilizes with added
support, the level is not dropped.

### 5.7 Hard regression (level drop)
A level drop only happens when **all** are true:

1. Soft regression has been active for the rest of the current session **and**
   in the previous session for this game.
2. Independent (un-cued) accuracy at the current level is below the level's
   struggle threshold across **two consecutive sessions**.
3. The user has completed at least the minimum trial count for the current
   level in those sessions (no level drop on tiny samples).

Level drop is **one level at a time**. Never multi-level.

### 5.8 What does not count
- Recognition-only trials never advance expressive levels (Photo Naming,
  Fix Sentence open).
- Trials abandoned, skipped, or cut short by technical failure are excluded
  from both progress and struggle.
- Clinician/manual content insertion (future) is excluded from auto-progress.

---

## 6. Non-Goals (v1)

Explicitly out of scope so the trial demo stays small and reviewable:

- No full scaffold state machine.
- No receptive mastery surface or rollout.
- No gating enforcement (levels do not block content selection elsewhere).
- No rollout to the other 13 games.
- No pressure mechanics beyond what each level table already names.
- No clinician override surface.
- No cross-game generalization claims.

---

## 7. Review Checklist (for SLP)

Before implementation, the SLP review should confirm:

- [ ] Each level for each game describes a recognizable rehab state, not a
      generic difficulty knob.
- [ ] Cue / support profiles match accepted clinical practice for that skill.
- [ ] Progression evidence thresholds are clinically defensible (not just
      gameable accuracy targets).
- [ ] Struggle signals would prompt a real clinician to add support.
- [ ] Soft-regression-before-hard-regression matches how a clinician would
      respond in session.
- [ ] Cue discounting ordering (independent > cued > recognition) is correct.
- [ ] Nothing in v1 implies receptive or generalization claims that aren't
      earned.

---

## 8. After Approval

Once the SLP signs off on this spec:

1. Build the **persistence layer only**: per-profile per-game `{level, progress}`
   storage, read on session start, written on session end.
2. Wire the three anchor games to read/write this state.
3. Surface the level + progress to the trial demo UI.
4. Hold all other items (gating, regression enforcement beyond §5.6/5.7,
   additional games) for v2.
