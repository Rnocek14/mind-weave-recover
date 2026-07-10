# Voice Engine v2 — Design Spec

**Status:** Draft for SLP + engineering review. Spec-only. No code, no schema
migration, no scoring changes shipped by this document.
**Scope:** The full voice scoring path — Photo Naming and other single-target
naming tasks, Fix-Sentence / Describe-the-Scene propositional tasks, and Voice
Practice (which this spec quarantines). Supersedes the ad-hoc scoring in
`errorClassifier`, `semanticSimilarity`, `matchSpokenToChoice`, and
`voiceSessionController.scoreVoiceRound`.
**Goal:** Stop asking *"was the answer correct?"* and start recording *"what
actually happened during this communication attempt?"* — as a defensible
clinical measurement system where every score is a claim backed by traceable
evidence and a stated confidence.

This is the canonical spec. It integrates the base design and the five review
changes (Cognitive Strategy classification, 5-level Communication Success,
Required/Optional/Bonus concepts, Measurement Confidence, and the Recovery
Signature / Longitudinal layers).

---

## 0. Design principles (non-negotiable)

1. **Communication success is the top-line clinical truth, not word-perfect
   production.** A patient who conveys *"the thing you cut with… scissors, no,
   knife"* has succeeded at communication even though they mispronounced,
   self-corrected, and circumlocuted. Pronunciation or fluency penalties must
   never overturn a successful communicative act. Someone with aphasia may
   communicate perfectly while producing very little normal speech — if they
   communicated, they succeeded.
2. **Every score is a claim, and every claim carries its evidence and its
   confidence.** No axis emits a bare number. Each emits
   `{ value, confidence, evidence[] }`. Low-confidence axes are *advisory* —
   they render and inform the clinician, but they do not gate progression.
3. **Sentence-level meaning is scored by concept coverage (CIU / Main Concept
   Analysis), never by raw whole-sentence embedding cosine.** Embeddings are
   permitted *only* as a fuzzy matcher for "did they produce a token that maps
   to this required concept," never as the arbiter of "is this whole sentence
   equivalent to the target."
4. **Word-level and sentence-level are different scorers.** They share axes and
   a data schema, but the *evidence extraction* differs.
5. **Nothing scores a patient it can't hear.** The validity gate runs first.
   `filler_only`, `no_response`, `background_noise`, `low_confidence`
   short-circuit to a non-punitive verdict with `counts_toward_score = false`,
   exactly as v1's `classifyUtteranceValidity` already does. v2 inherits that
   gate unchanged as its front door.
6. **Keep it explainable, not AI-heavy.** Every number must trace back to
   evidence a clinician can read. If a clinician cannot answer *"why did it give
   0.73?"* they will stop trusting the system. Machine learning and embeddings
   are used narrowly and always behind a deterministic, inspectable guard;
   generated prose (if ever added) sits strictly on top of, and cites, the
   deterministic layer — it never replaces it.

---

## 1. The axes and the strategy classification

Six **magnitude axes** (each a 0–1 or ordinal quantity) plus one **categorical
Strategy classification** (not a magnitude).

Three axes are **always-on** (they gate progression and adaptation in V2.1).
Three are **provisional** (`advisory: true` — computed, stored, shown to
clinicians, but excluded from progression until each is independently
calibrated in a later milestone).

### 1.1 Always-on axes

#### Axis A — Word Retrieval  `range: 0.0–1.0` (banded)
*"Did the target lemma come out, and how much scaffolding did it take?"*

The naming / lexical-access axis — the core of anomia therapy. Not "did the ASR
string equal the target string." Graded:

| Band | Value | Meaning |
|---|---|---|
| Retrieved clean | 1.0 | Target lemma (or accepted alias/homophone) produced as the primary content word, no cue. |
| Retrieved after self-correction | 0.85 | Target produced after a self-repaired false start (`X, no, Y`). A clinical *win* — self-monitoring intact. |
| Retrieved with cue | 0.6 × cue-decay | Target produced only after a semantic/phonemic cue. Scaled by cue level. |
| Phonemic approximation | 0.4 | Recognizable phonological attempt a listener would gloss to the target (`calculatePhonologicalSimilarity` ≥ 0.6). |
| Not retrieved | 0.0 | No form recognizable as the target lemma (may still score on Communication Success via circumlocution). |

**Must not** award retrieval credit for a semantically-adjacent word ("fork"
for "knife") — that is a semantic paraphasia: Word Retrieval = 0.0, surfaced on
Semantic Content instead.

#### Axis B — Communication Success  `range: {0, 0.25, 0.5, 0.75, 1.0}` (ordinal, named states)
*"Would a real human listener understand what the patient meant?"*

The top-line axis. Five **named** rungs — the engine may only ever emit one of
these five, and the clinician view shows the **label**, never the decimal.
Nothing exists between the rungs (five *defined* states, not a continuous
curve — this preserves principle 6).

| Value | Named state | Definition |
|---|---|---|
| 1.0 | **Fully conveyed** | Listener gets the specific target, unambiguously. |
| 0.75 | **Gist conveyed, detail missing** | Listener knows exactly what they mean; a modifier/completion is absent. *"Boy throw…"*, *"the sharp cutting one"* for knife. |
| 0.5 | **Category conveyed** | Listener narrows to the right category but not the item. In-category paraphasia; function-not-identity circumlocution. |
| 0.25 | **Fragmentary** | A real, on-topic fragment a listener could partly use, not enough to act on. |
| 0.0 | **Failed** | Unrelated, neologism, no response, or gated out. |

**Critical rule:** Communication Success is computed from *meaning*.
**Pronunciation and fluency are forbidden inputs to it.** A dysarthric, halting,
mispronounced production that still conveys the target scores 1.0 here. This
mechanism enforces principle 1.

#### Axis C — Independence  `range: 0.0–1.0` (cue-penalty)
*"How much external scaffolding did success require?"*

Fully computable from signals **already captured today** (`cue_level`,
`supportUsed` ∈ {independent, semantic_cue, phonemic_cue}, `manual_confirmed`,
`counts_toward_score`). No new capture needed.

| Support delivered before success | Value |
|---|---|
| None — independent | 1.0 |
| Semantic cue ("it's an animal…") | 0.7 |
| Phonemic cue ("starts with /k/…") | 0.5 |
| Multiple cues / carrier phrase / forced choice | 0.3 |
| Clinician manually confirmed (`manual_confirmed`) | 0.6, **flagged**: excluded from ASR/independent-accuracy rollups, included in participation rollups (v1 Phase-1B rule, inherited). |

Independence decays within an attempt as cues are consumed. It drives the
adaptation engine (raise difficulty as it trends to 1.0; add scaffolding as it
trends down).

### 1.2 Provisional axes (`advisory: true` — computed & shown, never gate)

#### Axis D — Pronunciation  `range: 0.0–1.0`
Source: Azure Pronunciation Assessment `gop_data`
(`pronunciationScore`, `accuracyScore`, per-phoneme GOP), already captured in
`utterance_analyses.gop_data`. Reported as accuracy against the *retrieved*
word, not the target — we assess how well they said what they were trying to
say. **Advisory because** GOP is noisy on disordered speech and the browser mic
path has no GOP at all; a low score must never read as "wrong word."
Promotion gate: agreement study vs. SLP phoneme judgments on a held-out set.

#### Axis E — Semantic Content  `range: 0.0–1.0`
**Word tasks:** distance of the produced word from the target — used only to
*classify* the error (semantic paraphasia vs. unrelated), never to award
Communication Success. **Sentence tasks:** this is the **CIU / concept-coverage
score** (§7) and is the *primary* meaning signal there (no single lemma exists).
The advisory flag applies to its word-level discriminator role.

#### Axis F — Fluency  `range: 0.0–1.0`
Source: existing fluency metrics (`speech_rate_wpm`, `pause_count`,
`effortful_speech`) + Azure `fluencyScore`/`prosodyScore`. Measures effort and
flow. **Advisory because** effortful speech is expected and often *therapeutic*
in aphasia; a low fluency score is clinical information, not a failure. Exists to
show "retrieval improving but effort still high" trends.

### 1.3 Cognitive Strategy — a *classification*, not a scored axis

Strategy is not a magnitude. "Self-correction" is not 0.7 of anything — it is a
**category**: which route did the patient take to reach the answer (or the wall)?
It sits alongside the axes as a first-class categorical field, feeding the
Recovery Signature (§9):

```
strategy_used ∈ {
  spontaneous       // came out clean, no visible search
  effortful_search  // "uh…" pause "knife" — searched and found (a WIN)
  self_correction   // "fork, no, knife" — monitored and repaired
  circumlocution    // "the thing you cut with" — routed around the block
  phonemic_search   // "k… kn… knife" — self-cued phonologically
  semantic_search   // "kitchen… sharp… knife" — self-cued by meaning
  cue_dependent     // arrived only after an external cue
  abandoned         // search initiated, no resolution
  none              // no attempt
}
```

Why a classification, not a seventh number:

1. **Nearly free in V2.1** — every signal is already extracted for other axes
   (self-correction structure §5, circumlocution pathway §6, cue level =
   Independence, effortful-speech = Fluency). Strategy is a *relabeling* of
   existing evidence, so it rides along in V2.1 as a stored field.
2. **Fixes a blind spot the magnitude axes have** — two patients can both score
   Retrieval 0.0 / Communication 1.0 but reach it by circumlocution vs.
   effortful phonemic search. Different recoveries, different therapy. The
   strategy label distinguishes them.
3. **Its value is longitudinal** — a single attempt's strategy is a footnote;
   the *distribution of strategies over weeks* is the gold. "Spontaneous up,
   circumlocution down" = the block is lifting. "Retrieval flat, self-correction
   + circumlocution up" = retrieval isn't improving *but compensatory strategy
   is building* — which is still recovery, and must be surfaced as progress.

Open question for SLP: some distinctions (`phonemic_search` vs
`semantic_search`) are confident inferences at best. Per principle 6, anything we
cannot measure reliably should collapse to a single `self_cued` label until the
distinction is measurable.

---

## 2. Verdict model

Per attempt the engine emits:

```
AttemptVerdict {
  primary: 'success' | 'partial' | 'retry' | 'no_score'   // from always-on axes only
  measurement_confidence: 'high' | 'medium' | 'low'        // §8
  strategy_used: <enum §1.3>
  axes: {
    word_retrieval:        { value, confidence, evidence[] }
    communication_success: { value, confidence, evidence[] }
    independence:          { value, confidence, evidence[] }
    pronunciation?:        { value, confidence, evidence[], advisory: true }
    semantic_content?:     { value, confidence, evidence[], advisory: true }
    fluency?:              { value, confidence, evidence[], advisory: true }
  }
  error_type: <existing taxonomy>   // correct | self_corrected | semantic_paraphasia | ...
  counts_toward_score: boolean
  reason: string                    // one clinician-readable sentence (§9)
}
```

**`primary` is a pure function of the three always-on axes** and nothing else:

- `no_score` ← validity gate failed (`counts_toward_score = false`) **or**
  measurement confidence Low.
- `success` ← Communication Success ≥ 0.75.
- `partial` ← Communication Success 0.25–0.5.
- `retry` ← Communication Success 0.0 **and** confidence high enough to be sure
  it was a genuine miss (not an ASR failure). If Communication Success 0.0 but
  confidence is low → `no_score`. We never punish the patient for our own bad
  hearing.

Provisional axes **decorate** the verdict; they never move `primary`.

---

## 3. The pipeline (raw → verdict → recovery story)

```
Raw signals  →  Cleaned  →  Evidence  →  Axis scores  →  Clinical Verdict     (per ATTEMPT)
                                                              ↓
                                                    Recovery Signature          (per SESSION / WEEK)
                                                              ↓
                                                    Longitudinal Recovery Model (across weeks)
                                                              ↓
                                                    Adaptive Therapy Engine     (what to practice next)
```

Per-attempt detail:

```
  browser transcript+conf ─┐
  Azure transcript+conf ───┼─► (1) SIGNAL RECONCILIATION (§4) ─► one chosen transcript + fused confidence
  manual-confirmed ────────┘
                                       ↓
                          (2) VALIDITY GATE (inherited v1) ── invalid ─► no_score (counts_toward_score=false)
                                       ↓ valid
                          (3) CLEANING (§5): raw → cleaned; strip fillers/lead-ins/noise;
                              keep self-corrections as structured events
                                       ↓
                          (4) EVIDENCE EXTRACTION — task-type router:
                                 word task     → lemma/phon/semantic classify (§6)
                                 sentence task → CIU concept coverage (§7)
                                       ↓
                          (5) AXIS SCORING (§1): each axis emits {value, confidence, evidence[]}
                              + strategy classification
                                       ↓
                          (6) VERDICT + MEASUREMENT CONFIDENCE + REASON (§2, §8, §9)
                                       ↓
                              persist to schema (§10)
```

Both raw transcripts and the cleaned transcript persist (§10) — today the
cleaned/normalized transcript is discarded, a v1 gap this schema closes.

---

## 4. Signal reconciliation — browser / Azure / manual-confirmed

Three sources can describe one utterance. Reconciled **before** the validity
gate into one chosen transcript and one fused confidence, by fixed precedence
with disagreement handling.

**Precedence:**
1. **`manual_confirmed`** — always wins the *content*. Transcript = confirmed
   target, confidence = 1.0 for validity, but tagged so rollups apply the
   Phase-1B exclusion (participation yes, independent-ASR accuracy no).
2. **Azure STT** — preferred over browser when available; it returns a
   calibrated `Confidence` and `acousticMetrics`. Its confidence distribution is
   the one the gate is calibrated against.
3. **Browser Web Speech** — fallback when Azure returns `fallback:true`/empty
   (429/5xx/non-Success). Browser confidence is known-unreliable and is
   down-weighted, never trusted as a gate on its own.

**Fused confidence:**
- Azure succeeded → `confidence = azure.Confidence`; browser retained as
  corroboration.
- **Agreement bonus** — if browser and Azure agree on the content word
  (post-cleaning, homophone-aware), bump confidence (independent corroboration).
  Recovers from Azure's conservative confidence on disordered speech.
- **Disagreement** — if they disagree on the content word and Azure confidence is
  middling, lower verdict confidence and bias toward `no_score`/retry rather than
  a punitive miss. Disagreement is logged as evidence.
- Browser-only → `confidence = browser.confidence × BROWSER_TRUST_FACTOR`
  (discount); gate applies to the discounted value.

**The confidence gate — the v1 bug and its v2 form.** In v1,
`classifySpeechError` is called with `asrConfidence` **hardcoded to 0.8**, so the
`< 0.4 → uncertain` and `< 0.6 → lenient` gates are dead — the real
`whisperConfidence` is captured but never passed. v2 requires the *fused*
confidence to flow into scoring, with three rules:
- The gate operates on the **fused, source-appropriate** confidence.
- Thresholds are **calibrated per source** before going live — Azure and browser
  confidence are different distributions and cannot share a threshold.
  Calibration holds false-retry rate (making a patient repeat something they said
  fine) to a target, because a false retry is the more harmful error for this
  population.
- A low-confidence miss becomes `no_score`, **not** `retry`-scored-as-wrong.

---

## 5. Cleaning (raw transcript → cleaned transcript)

Reuses v1's `speechNormalizer` primitives, with one structural change:
**self-corrections and lead-ins are extracted as events, not silently deleted**,
because they are clinical signal.

1. Strip noise patterns (`[breathing]`, `(pause)`, `…`, multi-space) —
   `NOISE_PATTERNS`.
2. Strip fillers — `FILLER_WORDS` (um, uh, er, like, you know, well, so,
   actually, right, ok…). Record `filler_count` as a Fluency input rather than
   discarding the fact that fillers occurred.
3. Strip lead-in scaffolding ("I think it's…", "it's a…", "the…") —
   `LEAD_IN_PATTERNS` — but record that a carrier phrase was used (mild
   Independence signal).
4. **Detect and preserve self-correction structure.** "knife, no, fork" →
   `{ first_attempt: "knife", repair_marker: "no", final: "fork",
   self_corrected: true }`. The *final* token feeds Word Retrieval; the presence
   of repair feeds the `self_corrected` error type, the 0.85 retrieval band, and
   the `self_correction` strategy. Promotes `extractAnswerFromTranscript`'s
   SELF_CORRECT heuristic into a first-class record.
5. Output: `cleaned_transcript` **plus** `cleaning_events` (fillers removed,
   lead-in used, self-correction structure). Both persist.

Homophones (`areHomophones`, `HOMOPHONES`) and clue-word stripping
(`removeClueWords`, with `preserveTokens` for answer aliases) apply during
evidence extraction, not cleaning, so the cleaned transcript stays faithful to
what was said.

---

## 6. Word-level evidence extraction & circumlocution

For single-target tasks (Photo Naming, single-item Describe-and-Guess):

1. **Lemma match** — cleaned answer vs. target + aliases + homophones. Hit →
   Word Retrieval 1.0 (0.85 if `self_corrected`), Communication Success 1.0.
2. **Phonemic approximation** — `calculatePhonologicalSimilarity` ≥ 0.6 and not
   a real different word → phonemic paraphasia; Word Retrieval 0.4,
   Communication Success 1.0 if a listener would still gloss it to the target,
   else 0.75.
3. **Semantic classification** — if not the target: is it an in-category real
   word? `getSemanticSimilarity` (raw cosine + lexical guard, `NONSENSE_CAP
   0.45`) used **only to classify** (`semantic_paraphasia` vs `unrelated`), never
   to award Communication Success. In-category → Word Retrieval 0.0, Semantic
   Content moderate, Communication Success 0.5 (listener gets the category).
   Unrelated/neologism → Communication Success 0.0.

**Circumlocution — reclassified as a Communication Success pathway.** In v1 it is
a weak keyword sniff (`detectCircumlocution`: canned phrases OR ≥3 words AND
semanticSim>0.4). In v2 it is **not an error type competing with retrieval — it
is a route to communication success**:

> Circumlocution = "object **not retrieved** (Word Retrieval = 0.0) but **meaning
> conveyed** (Communication Success 0.5–1.0)."

Detection is concept-based, not phrase-based: run the utterance's content words
against the target's known attributes/functions (a small per-item concept set —
"knife": {cut, sharp, kitchen, utensil}). Covers enough defining attributes to
*uniquely* identify the target → Communication Success 1.0, error type
`circumlocution`, strategy `circumlocution`, and the reason says *"described it
successfully without naming it."* Covers function but not identity ("something
you use in the kitchen") → 0.5. This is precisely the case the axis split exists
to represent: **retrieval failed, communication succeeded** — and the patient
should feel successful, because functionally they were.

---

## 7. Sentence-level scoring — CIU / Main Concept Analysis (NOT embedding equivalence)

For Fix-the-Sentence, Describe-the-Scene, and any propositional target.

**Do NOT compute cosine similarity between the whole spoken sentence and the whole
target sentence.** That rewards fluent-but-wrong, punishes correct-but-reworded,
and is gameable by fillers (v1's `scoreVoiceRound` counts "um" as a word — §11).

Instead, score by **concept coverage**, following Correct Information Unit
(Nicholas & Brookshire 1993) and Main Concept Analysis. Every sentence item
authors three explicit concept tiers:

```
"The boy threw the red ball, quickly, outside."
  required:  [boy, throw, ball]     // absence => Communication Success capped
  optional:  [red]                  // presence => richer; absence => no penalty
  bonus:     [quickly, outside]     // presence => extra credit; never expected
```

Each concept has accepted lexical realizations + aliases.

1. **For each concept, ask: did the patient produce a token that realizes it?**
   This is the *only* place embeddings are permitted — a per-concept fuzzy match
   (produced token vs. that concept's accepted realizations) so "puppy"→dog,
   "tossed"→threw. **Embeddings match a concept slot; they never judge the whole
   sentence.** The lexical guard (`hasLexicalOverlap`, `NONSENSE_CAP`) applies
   per slot to block embedding noise.
2. **A Correct Information Unit** additionally requires the token to be accurate
   and relevant — a concept realized only by a filler ("throwing the… um…
   thing") counts agent+action but not object.
3. **Tier → axis mapping:**
   - **Communication Success** is driven by **required** only. All required
     covered → 0.75–1.0 (1.0 clean, 0.75 gist-but-halting per §1.1). Some
     required missing → 0.5 or below.
   - **Optional** concepts feed **Semantic Content completeness** — raise
     richness; their absence *never* lowers Communication Success. "boy threw
     ball" (no "red") communicated successfully.
   - **Bonus** is pure additive credit toward Semantic Content — surfaced as
     "added detail," never an expectation whose absence costs anything.
4. **Semantic Content (Axis E) at sentence level** =
   (weighted concepts covered) / (required + optional weight), with CIU density
   (correct info units / total words) as an efficiency metric.
5. **Word Retrieval at sentence level** rolls up as mean retrieval across covered
   concept slots.

Word order and grammatical completeness are **not** required for success —
agrammatic but informative telegraphic speech ("boy throw ball dog") is a
communicative success and often the therapeutic target. Grammar/syntax, if ever
scored, is a separate future advisory axis, explicitly out of V2.1 scope and
never a gate on informative content.

---

## 8. Measurement Confidence (per attempt)

One rollup banner per attempt — the honest-instrument principle made visible:

```
Measurement Confidence: High | Medium | Low
```

Computed deterministically from: the fused ASR confidence (§4) + the minimum
confidence across the **always-on** axes + whether the two ASR sources agreed.

- **Low** fires when we simply didn't hear enough. It short-circuits like
  `no_score`: shown as *"couldn't measure this one clearly — not counted,"*
  never as a miss.
- It **gates the Recovery Signature (§9):** a trend can't be drawn from
  Low-confidence attempts. We do not tell a recovery story out of noise we
  couldn't hear.

---

## 9. Clinician-facing explanation & Recovery Signature

### 9.1 Per-attempt reason line

Every attempt renders a **plain-language reason** plus an expandable evidence
panel. The reason is templated from evidence, never a raw number:

- ✅ *"Named it independently."*  (Retrieval 1.0, Independence 1.0)
- ✅ *"Got it after a false start — self-corrected 'fork' to 'knife'.
  Self-monitoring intact."*  (`self_corrected`, strategy self_correction)
- ✅ *"Described it successfully without naming it ('the sharp thing you cut
  with'). Communication succeeded; word retrieval did not."*  (circumlocution:
  CommSuccess 1.0, Retrieval 0.0)
- ⚠️ *"In-category substitution ('fork' for 'knife') — listener gets the
  category, not the item."*  (semantic paraphasia: CommSuccess 0.5)
- ⚠️ *"Recognizable attempt ('nife') — pronunciation off but the word was
  clear."*  (phonemic: CommSuccess 1.0, Pronunciation low — panel states the low
  pronunciation score **did not** lower the success verdict)
- ⓘ *"Couldn't score this one confidently — audio was unclear. Not counted."*
  (`no_score` / Low measurement confidence)

The evidence panel shows: chosen transcript + both raw transcripts (with the
winning source and why), cleaning events, each axis with value/confidence/
evidence (advisory axes tagged "advisory, not counted toward progress"), the
strategy label, and for sentence tasks the concept-coverage checklist
(✓ boy ✓ throw ✓ ball ○ red). It must be impossible to mistake an advisory
pronunciation/fluency penalty for a scored miss.

**Audience partitioning:** the patient surface shows only encouragement + the
coarse `primary` state; the full six-axis + strategy evidence panel is a
clinician/caregiver surface. Same record, two renderings.

### 9.2 Recovery Signature (per session / week)

Clinicians don't decide from one attempt. The Recovery Signature is a small set
of **templated, evidence-linked** natural-language statements derived from trend
math over the axis + strategy rollups:

```
This week
  Communication      strong and steady        (Comm Success ≥0.75 on 8/10)
  Self-correction    emerging                  (self_correction strategy 1→4 uses)
  Independence       improving                 (↑22%, fewer phonemic cues needed)
  Word retrieval     stable                    (flat; no regression)
  Pronunciation      improving slowly          (advisory ↑2%)
  Still leaning on   semantic cues             (5/10 successes needed a semantic cue)
```

Two guardrails (principle 6 turned into build rules):

1. **Deterministic and traceable, not generated.** Every line is a template
   filled by trend arithmetic over stored axis values, and every line drills
   down to the exact attempts behind it. "Independence ↑22%" expands to the
   attempts and cue-level deltas. No LLM writes this prose. Any future generative
   summary sits strictly above and *cites* the deterministic signature.
2. **Refuses to invent a trend it can't support.** Minimum-N and a baseline are
   required before any arrow is drawn; below that it says *"establishing
   baseline — N more sessions needed."* Advisory axes stay advisory in the
   signature. Low-measurement-confidence attempts are excluded from trend math.

### 9.3 Longitudinal Recovery Model (across weeks)

The same data at month/quarter scale. This is where the axes become *features*:
per-axis % deltas over time become the clinical dashboard and, eventually, input
features to the adaptive engine (raise difficulty where the trend is up and
independent; add scaffolding where it stalls):

```
Word retrieval    ⬆ 18%
Communication     ⬆ 11%
Independence      ⬆ 22%
Pronunciation     ⬆ 2%   (advisory)
Semantic          → stable
```

This distinctive artifact is an *emergent property of honest per-attempt
measurement* — which is why it sits at the end of the pipeline and is reached for
last, not first.

---

## 10. Data schema

Extends today's two-table design (`exercise_events` = clinical record,
`utterance_analyses` = clean analytics, joined on `attempt_id`/`session_id`).

**`utterance_analyses` (add):**
- `raw_transcript_browser`, `raw_transcript_azure` (verbatim)
- `chosen_transcript_source` ∈ {azure, browser, manual}
- `cleaned_transcript` — the normalized string v1 currently discards
- `cleaning_events` jsonb — `{ fillers_removed[], filler_count, lead_in_used,
  self_correction: {first, marker, final} }`
- `fused_confidence`, `source_confidences` jsonb `{browser, azure}`,
  `sources_agreed` bool
- `axis_scores` jsonb — the six-axis block, each
  `{value, confidence, evidence[], advisory?}`
- `strategy_used` (enum §1.3)
- `measurement_confidence` ∈ {high, medium, low}
- `concept_coverage` jsonb (sentence tasks) — `[{concept, tier, matched,
  matched_via: 'lexical'|'alias'|'embedding', is_ciu}]`
- `verdict_primary`, `verdict_reason`
- `engine_version` (distinguishes v1 and v2 records during rollout)

**`exercise_events` (add / confirm):**
- keeps `counts_toward_score`, `validity_label/confidence/reason/signals`,
  `manual_confirmed`, `cue_level`, `supportUsed`, `acoustic_metrics`, `gop_data`
  reference — all already present.
- add `communication_success`, `word_retrieval`, `independence` as first-class
  columns (the three always-on axis values) so progression/adaptation queries
  don't parse jsonb.

**Item authoring schema (new static content):**
- word items: `{ target_lemma, aliases[], homophones[], concept_attributes[] }`
  (concept_attributes powers §6 circumlocution).
- sentence items: `{ target_sentence, concepts: { required[], optional[],
  bonus[] }, realizations per concept }` (powers §7 CIU).

---

## 11. Voice Practice — quarantine (effective before v2 ships)

`voiceSessionController.scoreVoiceRound` is **quarantined now**:

- Its scoring is crude and gameable: word-count + substring keyword matching,
  `yes_no_why = wordCount/8`, and fillers pass the `w.length > 1` check ("um"
  counts as a word). It produces scores that look clinical but aren't, and it
  feeds progression.
- **Quarantine action for V2.1:** stop `scoreVoiceRound` output from writing to
  any scored/progression path. Keep the practice *experience* if desired, but
  relabel it explicitly as **unscored practice** (participation only,
  `counts_toward_score = false`), so patients still get conversational reps
  without a fabricated score influencing adaptation or dashboards.
- It is **not** patched in place — it is fenced off and rebuilt on the §7 CIU
  path when sentence scoring lands. No incremental tuning of the word-count
  heuristic; it's the wrong method, not a mis-tuned one.

---

## 12. Implementation plan

Ordering is by **measurement confidence** — build first what we can measure well
today. The flashy layers (Recovery Signature, longitudinal model) are *consumers*
of clean per-attempt data and are earned by the boring honest layer beneath them.

### V2.1 — axis framework, always-on axes (word-level), quarantine, schema, panel

**Phase 1 — Schema & plumbing (no behavior change)**
1. Add new `utterance_analyses` / `exercise_events` columns (§10). Backfill
   `engine_version = 'v1'`.
2. Persist `cleaned_transcript` + `cleaning_events` from existing normalizer
   output (pure capture) — closes the "cleaned transcript discarded" gap and
   yields calibration data.
3. Persist both raw transcripts + `source_confidences` (capture only).

**Phase 2 — Axis engine, always-on axes, word-level**
4. Introduce the `AttemptVerdict` / axis structure (§2) as a pure function over
   existing evidence. Compute **Independence (C)** first — no new signals needed.
   Ship computing in shadow (stored, compared to v1) before it gates.
5. Compute **Word Retrieval (A)** and **Communication Success (B)** on the
   word-level extractor (§6), including circumlocution-as-communication-success.
   Run in **shadow mode** alongside v1's `errorType`-based `correct` flag; log
   disagreements. Do not flip progression until the shadow diff is understood.
6. Compute **Strategy classification (§1.3)** and **Measurement Confidence (§8)**
   — both are relabelings/rollups of numbers Phase 2 already produces.
7. Reconciliation (§4) *content* selection goes live (manual → Azure → browser,
   agreement bonus). **The confidence gate stays effectively-off**; V2.1 only
   starts *collecting* fused confidence to calibrate it later.

**Phase 3 — Advisory axes (compute + display only)**
8. Wire Pronunciation (D) from `gop_data`, Fluency (F) from fluency metrics,
   Semantic Content (E, word-level classifier role). All `advisory: true`; none
   gate.

**Phase 4 — Clinician evidence panel & Voice Practice quarantine**
9. Build the §9.1 evidence panel (clinician surface) reading `axis_scores` +
   `verdict_reason` + strategy. Patient surface unchanged except it reads
   `verdict_primary`.
10. Execute the §11 quarantine: fence `scoreVoiceRound` off the scored path;
    relabel as unscored practice.

**Phase 5 — Flip & watch**
11. After the always-on shadow diff is reviewed and acceptable, flip
    progression/adaptation to consume the three always-on axis values. Keep
    `engine_version` so any regression is attributable and reversible.

### Deferred past V2.1 (named so they don't leak into scope)
- **V2.2:** sentence-level CIU scoring (§7) + Voice Practice rebuild;
  confidence-gate calibration + re-enable (§4); **Recovery Signature (§9.2)** —
  needs V2.1 logging clean, confidence-tagged, strategy-labeled attempts first.
- **V2.3+:** Longitudinal model + adaptive coupling (§9.3) — needs weeks of V2.2
  signatures; promotion of any advisory axis to always-on, each behind its own
  agreement study.
- **Unscheduled:** grammar/syntax axis.

---

## 13. Open questions before build

1. **Concept authoring cost.** §6 (attributes per word) and §7 (required/
   optional/bonus per sentence) need per-item content authoring. Who authors it,
   and do we seed from the existing item bank or start with a ~20-item pilot?
2. **Shadow-mode duration.** How long do always-on axes run in shadow before the
   Phase-5 flip — a fixed N attempts, or until an SLP signs off on the
   disagreement log?
3. **Manual-confirm UX.** Independence (C) and reconciliation precedence lean on
   `manual_confirmed`. Is the clinician/caregiver "yes they said it" affordance
   reliable enough to trust as top precedence, or does it need its own pass?
4. **Circumlocution success threshold.** For §6, how many defining attributes
   must a description cover for Communication Success 1.0 vs 0.5? An SLP call.
5. **Strategy taxonomy granularity.** Should `phonemic_search` vs
   `semantic_search` be asserted, or collapse to `self_cued` until measurable?
6. **Recovery Signature cadence.** Weekly, or a rolling 2–3 week window to avoid
   manufacturing false arrows from week-to-week noise in slow aphasia recovery?
```
