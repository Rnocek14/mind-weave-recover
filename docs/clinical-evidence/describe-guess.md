# Describe & Guess — Eight Clinical Practice Stages

## Status: Structural, L1–L8 playable (clinical review required)

The saved clinical level now selects an exact picture bank and changes the number of distinct features the patient must **say**, independently from the number of assistance chips tapped. The separate in-session engine may adjust UI assistance but cannot silently move the patient into a different clinical bank.

| Level | Content | Clinical target |
| --- | --- | --- |
| 1 | Familiar everyday objects | 1 spoken feature; help allowed |
| 2 | Familiar objects | 2 different spoken features; help allowed |
| 3 | Familiar objects | 3 different spoken features; limited help |
| 4 | Less familiar objects | 2 features; limited help |
| 5 | Less familiar objects | 3 features; unaided for mastery |
| 6 | Lower-frequency/less imageable items | 2 features; unaided |
| 7 | Lower-frequency/less imageable items | 3 features; unaided |
| 8 | Banked harder targets | 4 features; unaided |

Feature types are function, location, appearance, material, and category, using the game's existing deterministic speech detection. **Pressing hint chips never counts as producing a feature.** A successful AI guess, word repetition, or a typed answer can support practice without automatically satisfying a spoken-feature level.

The game retains its existing expression/word-retrieval coaching and raw-event logging. Clinical evidence is buffered only after a successful raw event write for a valid spoken answer; fail-closed reads do not overwrite a previously saved level.

## Clinical basis and limits

Semantic Feature Analysis (SFA; Boyle & Coelho and subsequent research) and PACE-style communicative success motivate the feature-production task. The new eight-stage ordering, thresholds and frequency bands are product defaults requiring SLP review. L6–L8 are thin relative to a comprehensive therapy corpus; the L8 target is not genuinely novel or spontaneous generalization. Keyword matching alone does not prove semantic accuracy or carry-over to conversation.

A missing/failed saved-level load permits L1 practice only, without clinical state writes. Spoken recognition, real-device TTS and authenticated database access require separate verification.
