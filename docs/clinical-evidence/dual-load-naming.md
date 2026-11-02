# Dual-Load Naming — Clinical Evidence

## Purpose
Confrontation naming under a concurrent verbal working-memory load. The
patient memorises 3 words, names 6 pictures, then recalls the 3 words.
Targets executive-function load tolerance + interference recovery in
service of word retrieval — a known bottleneck in anomic / mild
non-fluent aphasia and in cognitive-communication impairment after TBI.

## Trial mode
**Mixed-modality composite** — six picture names are attempted through browser speech recognition while recall of three previously displayed words is **typed into text fields**. The combined trial now emits `trialMode:'mixed'` rather than claiming a purely independent spoken response. The slug remains adopted, but mixed results do **not** advance the expressive mastery shadow. Game-specific dual-task progression still considers valid mixed-task attempts, with naming and recall percentages recorded separately.

## Clinical basis (and honest scope)
- **Dual-task naming under cognitive load** — Murray & Lenz (2001),
  Murray, Holland & Beeson (1998) and replications: aphasic naming
  accuracy degrades as concurrent attentional/working-memory load
  increases. Training under load is hypothesised to build interference
  resistance.
- **Working-memory training in aphasia** — Eom & Sung (2016); Salis et
  al. (2017) reviews: practising under working-memory demand can
  generalise to functional discourse when the load is calibrated.
- **SFA / cueing hierarchies** — Boyle (2010), Maddy et al. (2014):
  confrontation-naming substrate is well-supported; the dual-load
  overlay is the novel piece.

**Honest scope:** The 3-tier bank collapse (familiar concrete →
mixed-frequency → low-frequency + longer memory list) shipped here is a
**clinically motivated calibration default** against the existing
`DUAL_LOAD_SETS` bank, not a literature-proven head-to-head hierarchy.
Per-level accuracy bars are tunable.

## Support axis
The current game UI has no naming hint button or phonemic-cue button, and the naming phase is open response. However the **recall phase requires typing**, so a full-game result is not independent expressive speech. The game and exercise page now use the same **pre-existing combined success rule: naming accuracy ≥60% AND recall accuracy ≥67%**. Previously the page accepted recall ≥33% regardless of naming accuracy, inflating clinical success. If every naming response was blank/filler, the attempt is logged as practice and does not alter the clinical progression ladder or adaptive task difficulty. Scorable browser transcription still does not establish speaker identity or recognition reliability for aphasia.

## Measurement limitations and independent transfer

- The naming and memory-task outcome measurements are separate. The game-specific eight-level framework is a proposed clinical progression, not a validated assessment of speech recovery.
- The current `interferenceIndex` uses a heuristic 0.9 naming baseline, NOT a measured personal no-load comparator. Do not present that index as patient-specific clinically observed interference until baseline measurement is added.
- The current memory list is fixed at three words and recall is typed. Level 8 is not implemented; no claims of independent spoken recall or advanced dual-task generalization are appropriate.
- Verification needs clinician adjudication of genuine aphasic naming, matched task demands, untrained interference probes, accessible non-text recall modes and a standardized patient outcome measure. Software tests do not establish these.

## Phase 1 readiness
- L1–L4 → ready (bank tier 1 — familiar high-frequency targets, 3-word load)
- L5–L6 → ready (bank tier 2 — mixed-frequency targets)
- L7 → thin (bank tier 3 — low-frequency + longer naming sequences, sparse)
- L8 → aspirational (no constrained-output runtime mode that lengthens
  the memory list beyond 3 or adds a distractor task; ceiling clamp blocks)
