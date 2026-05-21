# Dual-Load Naming — Clinical Evidence

## Purpose
Confrontation naming under a concurrent verbal working-memory load. The
patient memorises 3 words, names 6 pictures, then recalls the 3 words.
Targets executive-function load tolerance + interference recovery in
service of word retrieval — a known bottleneck in anomic / mild
non-fluent aphasia and in cognitive-communication impairment after TBI.

## Trial mode
**Expressive** — every trial requires spoken naming (whisper / speech
recognition with typing fallback). `submitTrial` emits
`trialMode: 'production'` and `dual_load_naming` IS in
`ADOPTED_TRIAL_MODE_SLUGS`. Trials route into the expressive mastery
track alongside photo-naming, semantic-features, two-clues,
sentence-construction, multi-step-planning, and synonym-generator.

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
The current game UI has no in-trial scaffold control — there is no hint
button, no phonemic cue button, no carrier prompt. The patient simply
speaks under the load. Every trial is `open_response`. The ladder
advances on combined naming + recall accuracy at progressively harder
content tiers, not on scaffold fading. This matches the task's clinical
reality (dual-task interference IS the manipulation).

## Phase 1 readiness
- L1–L4 → ready (bank tier 1 — familiar high-frequency targets, 3-word load)
- L5–L6 → ready (bank tier 2 — mixed-frequency targets)
- L7 → thin (bank tier 3 — low-frequency + longer naming sequences, sparse)
- L8 → aspirational (no constrained-output runtime mode that lengthens
  the memory list beyond 3 or adds a distractor task; ceiling clamp blocks)
