# Conversation Partner — clinical progression evidence and limits

## Current implementation (draft PR): L1–L3 playable; L4–L8 planned

The first three levels now control **actual conversation content, how many related
turns the patient makes, support offered, and a separate per-patient saved
practice level**. The existing generic 1–5 in-session discourse-adaptation
indicator is separate from clinical levels.

| Level | Real task | Support | Measurable evidence |
| --- | --- | --- | --- |
| **1** | Choose a drink, food, outing or activity; answer **one familiar question**. One relevant word suffices. | Large audible “Hear choices” button; patient then **speaks** their own choice | One saved, LLM-scored on-topic spoken turn, with any choice use labeled `choice_based` |
| **2** | Answer **two related questions** about one functional topic, e.g., choice of meal + when to eat | Optional spoken semantic cue before or during an attempt (microphone stops before TTS); cue use labeled `semantic_cue` | Two distinct, saved and individually LLM-scored on-topic spoken turns |
| **3** | Answer **three related questions** within one practical topic without default cues | Help is still available, but an assisted turn will not qualify as **independent** progression evidence | Three distinct, saved, on-topic, independent spoken turns |

An accessible short-answer path is intentionally supported at all early stages.
One relevant word at L1 should **not** be rejected because it is not a sentence.
A preprogrammed follow-up stays on the current subject rather than changing to
an unrelated AI topic. The game does not require a typed answer, and a visible
choice prompt or spoken example alone does not count as a patient-spoken answer.

Four adult functional contexts are currently banked: choosing a drink, planning
a meal, planning an outing, and making an afternoon plan. The same topic is
held for the entire graded exchange.

## Persistence and progression integrity

- Load via `loadProgressionStateChecked` scoped to `user_id`,
  `profile_id` and `conversation-partner`. An unverified load offers
  practice but **cannot overwrite saved state**.
- The existing raw turn logger writes the graded task, support level, source,
  and on-topic signal to `exercise_events` and verifies an accepted insert.
  The scorer's separate event write is turned **off only in graded mode** to
  avoid two contradictory records per turn.
- LLM-scored, saved turns (including low-quality scored attempts) enter a
  unique-per-turn session buffer; local fallback/shortcircuit scores,
  unsaved turns, and repeated submissions cannot earn clinical credit.
- Session-end rollup uses the existing 1–8 progression state but **caps the
  implemented ceiling at L3**. It requires all stage turns to be present and
  on target before positive progress. A failed save does not optimistically
  show advancement. Session and patient identity are checked.
- The nominal four-successful-session progress weight is a **product calibration
  default**, not research establishing an appropriate rehabilitation dose.
  Scoring assists less than independently produced speech.

## Not implemented / not demonstrated

**L4–L8 are planned**, not repurposed L3 content. The registry and clinician
“About” pages should show those entries as planned. No automated promotion
to L4. Clinical stages are **not** added to global expressive-mastery routing,
which would require a validated classification model.

These scores are at most **language-practice proxies**, not a validated
conversation-independence index or aphasia assessment. LLM on-topic judgments
and ASR errors can bias the results. Real conversations, sustained topic
maintenance, successful message transfer, communication repair, unfamiliar
partners, multi-party interactions, generalization, and clinical improvement
are not demonstrated. These require SLP content/threshold review, audio trials
with aphasic speakers, device testing and real-world functional measures.

## Clinical rationale

Supported Conversation for Adults with Aphasia (SCA; Kagan), Promoting Aphasic
Communicative Effectiveness (PACE; Davis & Wilcox), communication-partner
training work (Simmons-Mackie et al.), and the Life Participation Approach to
Aphasia motivate patient-led, meaningful choices and gradually reduced
assistance. The exact stage ordering, topics, cue credit and advancement
weights are product design decisions, not calibrated clinical standards.

No production backend writes or live-patient tests are performed in this PR.
The required isolated authenticated persistence and RLS validation remain
separate release prerequisites.
