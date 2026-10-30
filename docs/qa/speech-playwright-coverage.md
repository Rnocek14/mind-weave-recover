# Speech-game Playwright clinical QA inventory (2026-10-30)

## What is *actually* covered

The existing speech-browser harness runs **native Chromium getUserMedia and
MediaRecorder using generated WAV audio**. The browser Web Speech recognizer is
controlled via explicit events and HTTP speech/analysis endpoints are supplied
with transport fixtures. It is **not** a native automatic speech recognition
quality or patient-speech evaluation.

Tests currently include:
- **Photo Naming:** full WAV transport, conversion, recognition-event handling,
  transcript/attempt matching, analysis and pronunciation envelopes, saved
  utterance payload with missing/zero metrics, delayed responses, silence,
  interrupted/late callbacks, failed upload and recorder cleanup.
- **Narrative Retell, Abstract Compare, Multi-Step Plan:** separate, real
  production component tests in `clear-discourse.speech.ts` for mic acquisition,
  event-to-completion, one attempt-scoped utterance, captured audio upload,
  transcript and meaningful metrics. This *does not* by itself validate real
  persistence in exercise_events, native ASR, story scoring quality or mobile
  hardware.

Other speech-enabled games **must not be described as having passed the
Photo Naming-style browser mic test until their own selected Playwright
journeys exist and execute**:

| Game | Input evidence | Mic/audio Playwright coverage |
|---|---|---|
| Phrase Practice | Speech + recorded audio + pronunciation | **NOT YET RUN** |
| Two Clues | Speech + recorded audio + pronunciation | **NOT YET RUN** |
| Describe & Guess | Speech + recorded audio | **NOT YET RUN** |
| Fix the Sentence | Spoken or typed, pronunciation | **NOT YET RUN** |
| Thought Continuation | Discourse recording | **NOT YET RUN** |
| Dual Load Naming | Naming audio + pronunciation | **NOT YET RUN** |
| Conversation Partner | Spoken discourse + AI dialogue | **NOT YET RUN** |
| Conversation Coach | Spoken discourse + AI coaching | **NOT YET RUN** |
| Category Fluency | Browser recognition, no recorder | **NOT YET RUN** |
| Synonym Generator | Browser recognition, no recorder | **NOT YET RUN** |
| Detective Mind | Spoken selection, no recorder | **NOT YET RUN** |
| Sentence Construction | Spoken or tiles, no recorder | **NOT YET RUN** |
| Minimal Pairs | Optional spoken echo after receptive choice | **NOT YET RUN** |

**Release gate:** These missing cases remain hospital-readiness blockers. Add
representative valid speech, disfluency, silence, noise, mic-denied, pause/stop,
unscorable results, and retry tests appropriate to each game's actual input
modality. Tests should verify attempt ID, patient/session ownership, trial mode,
ASR/score denominators, and read-back through the isolated backend when a real
persistence claim is made. A page-entry test alone is not a speech test.

Physical mobile Safari/Android, Bluetooth devices, clinically disordered
speech, model performance, therapist agreement, informed consent and regulatory
requirements remain separate gates.
