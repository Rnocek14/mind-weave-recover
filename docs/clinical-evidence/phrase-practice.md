# Phrase Practice — Speech-evidence integrity and clinical progression status

## Therapeutic purpose

Phrase Practice trains functional scripted expressions intended for everyday communication. Script training, functional conversational therapy and supported communication provide a rationale for **practicing useful phrases**, but they do not establish NeuroSpark's exact eight-stage progression, word-match cutoff or level-up schedule.

Relevant references:
- [ASHA Aphasia Practice Portal](https://www.asha.org/practice-portal/clinical-topics/aphasia/)
- [Canadian Stroke Best Practices — Language and Communication](https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/7-language-and-communication)
- [Script training research (2026)](https://pubmed.ncbi.nlm.nih.gov/42821294/)
- [Big CACTUS, computerized word-retrieval therapy trial](https://www.ncbi.nlm.nih.gov/books/NBK556719/)

## Current executable behavior (draft PR #106)

- The game has a **five-tier phrase content bank**, mapped from the existing generic 1–10 adaptation engine. The eight proposed *clinical* stages in the evidence audit are NOT operational or independently persisted for this game.
- The target words are visually visible during every phrase trial. They count as visual support, including after **Next** or **Restart**. Pronouncing a displayed target is not evidence of independent functional script initiation.
- A phrase judged matched by browser speech recognition can be recorded as a speech-practice success. Acoustic analysis can add descriptive detail where audio is available; a recognition match by itself does not establish a clinical outcome.
- The optional **I Said It!** self-report does not synthesize a transcript, report a word-match percentage, mark the scripted phrase as learned, or increase verified speech points. It stores `manual_confirmed`, counted toward practice participation but excluded from ASR/independent accuracy.
- Repeated attempts that partially resemble the phrase are not silently promoted to full-correct responses when the attempt limit is reached.
- Unrelated embedded exercises no longer expose a generic `I Said It!` button that could previously fabricate their scored trials.
- Day-level verified score summaries exclude flagged practice-only events.

## Still necessary for an eight-stage clinical implementation

1. Separate **script complexity** and situational flexibility from orthogonal visual, audio, semantic and phonemic help. Model exposure, text reading and echoing must not receive the same result as independent use.
2. Author enough clinically reviewed functional intents, script variants and unfamiliar scenarios at each planned stage to support multiple days of nonmemorized practice.
3. Track correct communicative intent, intelligibility/word-production uncertainty, meaningful alternative sentences, cued versus independent utterance and conversational repair.
4. Retain typed/manual confirmations for engagement without allowing them to advance independent spoken clinical progression.
5. Reserve held-out scripts and untrained conversational scenarios. A realistic in-app roleplay does not prove successful communication outside the app.
6. Obtain an appropriately qualified speech-language pathologist's review of the per-stage construct and progression criteria, and test real aphasic speech, patient accessibility, and persistence on an isolated backend.
7. Measure and report improvements in trained scripts, untrained phrases and independent real-world communication **separately**.

Clinical research supports the overall treatment ingredients at varying strengths. The proposed clinical stages, automated thresholds and any functional improvement inferred from the app still require dedicated evaluation.

## November 2, 2026 — Runtime training-mode implementation (draft PR #122)

This development wave introduces real supported script practice in the existing game, with **three distinct scripted task presentations**, independently of its generic 1–10 in-session adaptation:

- **Practice Stage 1:** the full tier-1 phrase is displayed and the existing audio player attempts a full spoken model. A model/repetition trial is always cued practice.
- **Practice Stage 2:** the first word and blanks are shown for a tier-1 phrase. A patient can reveal the full script using one large button. This is partial-script support, not independent functional speaking.
- **Practice Stage 3:** a tier-2 functional phrase is prompted with existing bank-authored key words instead of automatically showing the full target. The patient can reveal the full script at any time. Key words are still lexical support, so a browser ASR match remains **assisted phrase practice**, not proof of unprompted conversational initiation.

The runtime loads the active patient's existing `clinical_progression_state` before selecting a script bank; missing/failed reads do not create or reset a profile's stage. It keeps the practice bank locked to the selected stage even if in-session hints change. Spoken, model, manual and reveal provenance remains separate from clinical mastery; event telemetry includes actual stage, support and full-target reveal. An account with a saved L4–L8 state can still perform clearly labeled general practice rather than being shown a fake upper-stage implementation.

**No automatic clinical promotion or per-level mastery is enabled.** The numerical thresholds for eight distinct stages and the held-out functional scripts/novel communication situations remain unvalidated. This is an engineering training-mode implementation, not a verified clinical outcome instrument. Tests are synthetic and do not establish actual aphasic speech accuracy or authenticated database durability.
