# Speaker-playback adaptation test bank (engineering only)

These are **test stimuli**, not patient recordings. Record yourself saying the phrases, use any licensed text-to-speech voice, or use browser/OS text-to-speech and play through computer speakers into the app microphone. Do not use these recordings to validate aphasia recognition or clinical efficacy.

## Setup
1. Use a separate synthetic/test patient profile; do not use a real patient's account.
2. Record the app's initial game, level, cue setting, targeted phonemes, speech transcript, speech validity, and independent/scaffolded accuracy.
3. Use one speaker/voice consistently. Set speaker volume at a comfortable level; avoid feedback by separating speaker and microphone.
4. Present the **correct target word for the currently displayed prompt**. The items below are candidate target stimuli; do not play a word unrelated to the game's current prompt and expect credit.
5. For each test: record stimulus ID, actual game prompt, expected answer, played audio, recognized transcript, raw pronunciation/phoneme evidence, cue level, scored result, adaptation, next prompt, session summary and next-day level.
6. If speech is misrecognized, mark it as an ASR failure, not a true patient language error. Never use unknown speaker/low-quality evidence for mastery.
7. Run independent, cued, and no-response cases in separate sessions; don't mix them without logging.

## Stimulus bank (plain English, phoneme-mapped words)
| ID | Purpose | Play/record |
| --- | --- | --- |
| R01 | initial /r/ | red |
| R02 | initial /r/ | rain |
| R03 | initial /r/ | rose |
| R04 | initial /r/ | road |
| R05 | initial /r/ | room |
| R06 | initial /r/ | rope |
| R07 | initial /r/ | ring |
| R08 | initial /r/ | run |
| S01 | initial /s/ | sun |
| S02 | initial /s/ | soup |
| S03 | initial /s/ | sea |
| S04 | initial /s/ | soap |
| K01 | initial /k/ | cake |
| K02 | initial /k/ | coin |
| K03 | initial /k/ | coat |
| K04 | initial /k/ | kite |
| SH01 | /sh/ | ship |
| SH02 | /sh/ | shop |
| SH03 | /sh/ | sheep |
| SH04 | /sh/ | shell |
| MIX01 | mixed phrase | red rabbit runs |
| MIX02 | mixed phrase | the red car |
| MIX03 | mixed phrase | the sun is bright |
| MIX04 | mixed phrase | I see a red rose |
| MIX05 | mixed phrase | the cat is sleeping |

## Controlled variations
- Exact target: say target clearly, once, with no cue.
- Repeat: say target twice after one prompt; verify only one eligible response is counted.
- Wrong word: substitute a different word; verify no false mastery.
- Silence: play 2–3 seconds of silence; verify no speech score.
- Partial: speak only part of a phrase; verify independent accuracy does not falsely increase.
- Background: low-volume room noise, separately labeled; do not change stimulus wording.
- Cue: request/receive a hint before the correct response; verify scaffolded credit stays separate.
- Caregiver: second speaker says the answer; verify attribution, or flag as **not reliably separable** if the app has no speaker identity gate.

## Longitudinal test
- Days 1–5: low independent accuracy, cue use; expect difficulty/support adjustments without unsupported level promotion.
- Days 6–10: improved independent accuracy; check that phoneme difficulty trends are recalculated from eligible evidence.
- Days 11–15: sustained independent success; check mastery gates and implemented-level ceiling.
- Days 16–20: mixed success/fatigue; check no spurious advancement.
- Days 21–30: improvement in one phoneme and struggle in another; check target rotation and next lesson selection.

## Interpretation
- A passing recognition transcript alone does not prove phoneme assessment or in-game adaptation.
- A passing synthetic level replay alone does not prove that real microphone events feed the same pipeline.
- Speaker playback tests the **microphone → Azure → game** path, but acoustic mismatch from loudspeakers is not representative of natural patient speech.
- Preserve run logs and screen recordings for every failure. Never backfill fake clinical events.
