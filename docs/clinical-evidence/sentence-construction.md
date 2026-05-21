# Sentence Construction — Clinical Evidence

## Status: Structural ladder (Phase 2, Wave 2)

L1–L5 ready. L6–L7 thin. L8 aspirational (open-production runtime mode not yet shipped). Ceiling clamp blocks live promotion past L7.

## Clinical basis

Sentence-level production training is supported by multiple aphasia treatment programs:

- **Mapping Therapy** (Schwartz et al.) — explicit thematic-role assignment in sentence frames.
- **Treatment of Underlying Forms (TUF)** — Thompson and colleagues; training syntactically more complex structures (e.g., object-extracted wh-movement, passives) generalizes to simpler forms ("Complexity Account of Treatment Efficacy", CATE).
- **VNeST** — Edmonds et al. (2009); verb-centered sentence training that generalizes to lexical retrieval and connected discourse.

Common to these programs is a **structured complexity progression** — basic SVO → morphology (articles, tense) → embedded structures → passive/complex — paired with **scaffold fading** (model → choice → independent production).

## What is calibration, not literature

- The specific grammar-tier ordering shipped here (SVO → articles → tense → pronouns → prepositions → conjunctions → compound → relative clauses → passive → open) is a **clinically motivated calibration default**, not a head-to-head proven hierarchy. CATE actually predicts benefits from training **more** complex forms first; we sequence canonically by clinical convention and ease of patient onboarding.
- Per-level accuracy bars (`minOnTargetAccuracy`) and `minOnTargetAttempts` mirror PhotoNaming/FixSentence numerics — tunable, not evidence-based constants.
- The Clinical Level → engine tier floor mapping (1→1, 5→6, 7→8, 8→10) is a sensible packing default given the bank's 1–10 difficulty spread; revisit when bank content shifts.

## Support ladder (executive/grammar axis)

Shared with Fix Sentence:

```
highlight_plus_choice  <  choice_based  <  open_response
(model + tiles)            (tiles only)     (spontaneous)
```

In-game mapping:

- `hintUsed === true` → `highlight_plus_choice` (clinician played the model audio for this trial)
- `hintUsed === false` → `choice_based` (tile-based production without model)

`open_response` is the **L8 target** but is not directly observable from the current game UI (tiles are always presented). L8 stays aspirational until a tile-suppressed open-production runtime mode ships.

## Mastery routing

- `submitTrial` emits `trialMode: 'production'` on every call.
- Canonical slug `sentence_construction` IS added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials route into expressive mastery — same path as PhotoNaming / FixSentence / SemanticFeatures / TwoClues / CategoryFluency.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L5 | ready | Bank covers SVO → compound across difficulty 1–6. |
| L6 | thin | Relative clauses (bank diff 7) — rotation only. |
| L7 | thin | Passive / complex embedding (bank diff 8). |
| L8 | aspirational | No tile-suppressed open-production UI yet. Ceiling clamp blocks live promotion. |

## Out of scope for this ship

- A tile-suppressed open-production runtime mode (would unlock L8).
- Per-grammar-focus mastery rows (e.g., separate ladders for tense vs. embedding).
- VNeST-style verb-anchor training as its own ladder.
