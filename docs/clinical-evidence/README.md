# Clinical Evidence Basis — Progression Ladders

This folder documents the clinical rationale behind the per-level ladders in
`src/lib/progression/*Levels.ts`. The goal is to be **honest about what the
literature does and does not prove**:

- The **direction** of our design (cueing hierarchies exist, frequency
  affects retrieval, criterion-based mastery is standard) is well-supported.
- The **specific numeric thresholds** we ship (e.g. 70/75/80/85% accuracy
  bars, `SUPPORT_CREDIT` 1.0/0.6/0.4/0.2/0.0, per-level `trialWeight`) are
  **clinically motivated calibration defaults**, not values the literature
  proves to be correct. They are tunable starting points.

We do not claim the literature establishes a universal ordering of cue
effectiveness, nor that any single accuracy band is the "right" mastery
criterion for any individual patient.

## Per-ladder files

- [`photo-naming.md`](./photo-naming.md) — lexical retrieval; SFA/PCA-style
  cueing ladder.
- [`fix-sentence.md`](./fix-sentence.md) — sentence-repair independence;
  not lexical retrieval.
- [`minimal-pairs.md`](./minimal-pairs.md) — auditory phonemic
  discrimination.

## Language conventions

When updating these docs or the inline ladder file headers:

- ✅ "Clinically motivated default"
- ✅ "Design rationale anchored in X"
- ✅ "Consistent with the cueing-hierarchy literature"
- ❌ "Evidence-based threshold"
- ❌ "Literature confirms cue order X > Y > Z"
- ❌ "Proven mastery criterion"
