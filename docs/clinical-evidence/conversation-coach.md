# Conversation Coach — graded early functional communication

## Current branch status: Structural, L1–L3 playable; L4–L8 planned

There are now two patient-facing paths within Conversation Coach:

1. **Guided clinical practice**, which selects a real functional communication task using a saved patient-specific level. It does **not** activate the large Smart Coach's drill/pop-up/strategy-switching pipeline.
2. **Full Conversation Coach**, which preserves the original integrated Smart Coach interaction but is **not** treated as evidence of completed eight-stage clinical progression.

| Level | Implemented task | Patient support | Stored clinical-practice evidence |
| --- | --- | --- | --- |
| L1 | One practical modeled message (“I need water,” “Please help me”). Patient speaks after hearing it. A single meaningful word may convey the request. | Visible and spoken model; model use logged as `carrier_or_full_model` | A confirmed spoken transcript with an accepted raw event and qualifying LLM on-topic assessment |
| L2 | Patient sees options for an adult functional choice and **speaks** the choice. A tap alone never completes therapy. | Choice-supported, `choice_based` | One separately confirmed, spoken choice; a tap is only assistance |
| L3 | Patient makes an open functional request on a familiar situation. | No default model or choices; an optional semantic clue is logged as `semantic_cue`. Independent evidence needs no clue. | Confirmed independent spoken request; a cued attempt is practice credit, not independent mastery |

Five adult functional situations ship: asking for water or other drink, a break, a ride, help, or food. The patient sees one large main action at each stage. Maya reads the task; the microphone opens only after Maya finishes. A clue stops the microphone before TTS. After a patient speaks, the **recognized transcript must be confirmed** or retried before evaluation, reducing but not removing ASR mis-scoring.

Clinical state is loaded through the existing patient/profile-exercise row and saved only after the raw event is acknowledged. The scorer's local fallback can continue practice but cannot establish a progress milestone. The progression adapter caps advancement at **L3**, and a failed saved-level read cannot overwrite historical progress. The existing expressive mastery allowlist stays unchanged.

## Evidence and clinical limits

Supported Conversation for Adults with Aphasia (Kagan), Promoting Aphasic Communicative Effectiveness (Davis & Wilcox), and conversation therapy/communication-partner training motivate functional messages with progressively less help. The task sequence and four-session weight are provisional **product defaults**, not clinically calibrated therapy dosage or performance standards.

The current application does not establish a verified aphasic-ASR accuracy estimate, functional message transfer in the patient's daily environment, spontaneous word retrieval, multi-turn topic maintenance, communication repair or clinical improvement. LLM on-topic scores are practice proxies. Higher stages—independent multi-turn topics, patient-led topic shift, repair, and cross-context conversation—remain **L4–L8 planned** rather than silently reusing L3 content.

The guided mode logs text/audio availability as observed; optional audio recording or upload failure does not falsely produce an audio asset reference. Clinician review, representative aphasic-speech calibration, physical device audio lifecycle tests, isolated authenticated write/read and RLS validation remain prerequisites for any patient or hospital release. Public browser tests use controlled services, not a live clinical backend.
