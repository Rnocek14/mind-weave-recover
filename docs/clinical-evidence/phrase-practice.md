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
