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

## All-game evidence audit

- [Clinical evidence and progression audit for 29 activities](./29-game-evidence-audit.md) — distinct skill construct, evidence-fit classification, task measure, measurement confound, independent generalization check and traceable references for every canonical game plus Command Scenes.
- `src/lib/clinicalEvidenceRegistry.ts` is the **machine-checkable design evidence contract** consumed by the Activity Library. The contract is reviewed by `clinicalEvidenceRegistry.test.ts`; adding a game without an evidence entry or changing its mastery track incorrectly fails the test.
- All 13 currently persisted clinical ladders have a documented **alignment review flag**. This is a required SLP/discipline-specific review queue, not a claim of completed clinical outcome evaluation.
- The 16 design-only games **do not** yet have persistent, clinically scoreable eight-stage ladders. Software regression green status does not change this.

**Research-fit categories are not clinical grades.** `direct-method` means the game resembles a studied treatment ingredient; `related` means a neighboring therapeutic principle is supported; `exploratory` means direct evidence for the mechanic is missing. None of these supports an assertion that NeuroSpark's stage thresholds or clinical efficacy have been established through clinical studies.

**Untrained transfer is not automatic.** The Big CACTUS RCT demonstrated that improvements in trained computer-based word retrieval need not generalize to untrained words or conversation. Track those outcomes separately and require clinician-reviewed evidence before hospital marketing claims. [Trial](https://www.ncbi.nlm.nih.gov/books/NBK556719/).

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
