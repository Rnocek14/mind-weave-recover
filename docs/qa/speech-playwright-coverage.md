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

- **Phrase Practice, Fix the Sentence:** production speech components have
  new exact-phrase/correct-replacement WAV, pronunciation and utterance
  Playwright journeys (pending the required CI).
- **Two Clues, Dual Load Naming:** production lexical components now have
  microphone-to-pronunciation/utterance Playwright journeys with actual native
  WAV capture and controlled recognition/HTTP fixtures (new tests require CI).
- **Category Fluency, Synonym Generator, Detective Mind:** controlled
  Web Speech browser-event tests execute actual game components and their
  answer callbacks, without pretending that these games capture a WAV.
  These are browser-recognition tests, *not* native audio/ASR-quality tests.

Other speech-enabled games **must not be described as having passed the
Photo Naming-style browser mic test until their own selected Playwright
journeys exist and execute**:

| Game | Input evidence | Mic/audio Playwright coverage |
|---|---|---|
| Phrase Practice | Speech + recorded audio + pronunciation | **NEW Playwright test (pending exact-SHA CI)** |
| Two Clues | Speech + recorded audio + pronunciation | **NEW Playwright test (pending exact-SHA CI)** |
| Describe & Guess | Speech + recorded audio | **NOT YET RUN** |
| Fix the Sentence | Spoken or typed, pronunciation | **NEW spoken-response Playwright test (pending exact-SHA CI); tile/typing parity pending** |
| Thought Continuation | Discourse recording | **NOT YET RUN** |
| Dual Load Naming | Naming audio + pronunciation | **NEW Playwright test (pending exact-SHA CI)** |
| Conversation Partner | Spoken discourse + AI dialogue | **NEW press-to-talk Playwright (pending CI)** |
| Conversation Coach | Spoken discourse + AI coaching | **NOT YET RUN** |
| Category Fluency | Browser recognition, no recorder | **NEW Playwright test (pending exact-SHA CI)** |
| Synonym Generator | Browser recognition, no recorder | **NEW Playwright test (pending exact-SHA CI)** |
| Detective Mind | Spoken selection, no recorder | **NEW Playwright test (pending exact-SHA CI)** |
| Sentence Construction | Spoken or tiles, no recorder | **NEW voice and non-spoken tile Playwright (pending CI); persisted mode validation remains open** |
| Minimal Pairs | Optional spoken echo after receptive choice | **NEW echo Playwright (pending CI), explicitly not ASR-scored** |

**Release gate:** These missing cases remain hospital-readiness blockers. Add
representative valid speech, disfluency, silence, noise, mic-denied, pause/stop,
unscorable results, and retry tests appropriate to each game's actual input
modality. Tests should verify attempt ID, patient/session ownership, trial mode,
ASR/score denominators, and read-back through the isolated backend when a real
persistence claim is made. A page-entry test alone is not a speech test.

Physical mobile Safari/Android, Bluetooth devices, clinically disordered
speech, model performance, therapist agreement, informed consent and regulatory
requirements remain separate gates.
