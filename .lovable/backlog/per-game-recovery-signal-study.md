# Per-Game Recovery Signal — Study Note (STUDY, NOT BUILD)

**Status:** Investigation prompt, not an implementation task. Freeze-safe (analysis only).
**Why it exists:** The intervention-exposure dataset needs *outcome variables*. Before you can learn *"what caused improvement,"* you must define *"what exactly improved"* per game. Accuracy / completion rate is usually the wrong primary signal.

---

## The question to answer for EACH game

> What is the true recovery signal for this game — the variable that, when it moves, reflects real language recovery rather than task familiarity?

Accuracy and completion rate are confounded by repetition, item ease, and cue scaffolding. The real signal is almost always a *combination* and usually includes an independence or generalization term.

## Working hypotheses (to validate, not assume)

| Game | Likely true signal | NOT the signal |
|---|---|---|
| Photo Naming | cue independence + generalization to untrained probes | raw accuracy |
| Fix Sentence | syntactic independence + sentence complexity handled | completion rate |
| Minimal Pairs | phonological discrimination + retention over delay | correct taps |
| Conversation Coach | functional transfer + reduced cue reliance | turn count |
| Category Fluency | retrieval rate + cluster/switch structure | raw word count |

These mirror the clinical-evidence docs already in `docs/clinical-evidence/` and the FROZEN progression archetype layer (dominant axis per game). Use those as the starting vocabulary — do not invent new dimensions.

## Method (when studied)

1. For each game, list candidate signals already captured in existing tables (cue independence, probe deltas, retention snapshots, mastery confidence, graded score).
2. Once real rows exist, check which signal correlates with *untrained-probe* improvement (the generalization anchor) rather than trained-item accuracy.
3. Promote the validated signal to the **outcome variable** joined against `intervention_exposure` for cohort analysis.

## Relationship to other specs

```text
intervention_exposure   →  WHO the patient was + WHAT therapy happened   (independent vars)
stimulus_metadata       →  HOW hard the items were                       (controls)
per-game recovery signal →  WHAT actually improved                       (dependent var)
```

All three are needed before *"Patient like this → received this therapy → produced this outcome → over this time"* becomes answerable.

## DO-NOT (this freeze)

- Do NOT change any scorer or engine signal based on these hypotheses.
- Do NOT redefine the frozen archetype/dimension vocabulary.
- This is a measurement-definition study, gated on real data + lifted freeze.
