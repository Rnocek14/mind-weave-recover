# Dual-Load Naming — Clinical Evidence

## Purpose
Confrontation naming under a concurrent verbal working-memory load. The
patient memorises 3 words, names 6 pictures, then recalls the 3 words.
Targets executive-function load tolerance + interference recovery in
service of word retrieval — a known bottleneck in anomic / mild
non-fluent aphasia and in cognitive-communication impairment after TBI.

## Current implementation: a mixed cognitive-linguistic task

Naming images uses browser-recognized **speech**. The memory-recall portion
uses **typed text fields**, not recorded spoken recall. The combined result
must therefore use `trialMode: 'mixed'` and must **not** enter the global
independent expressive-language mastery denominator. It may enter its own
per-game dual-task clinical ladder only when all naming attempts contain
scorable non-filler recognized speech, internal naming accuracy matches the
recorded attempts, and recall metrics are valid.

The game and page now use the **same preexisting dual-domain gate**:
naming accuracy at least 0.60 **and** memory recall at least 0.67.
Previously the page accepted recall at least 0.33 even when naming was
zero, despite the game itself requiring both components. Those earlier
clinical records require a separately documented historical-data audit,
not silent rewriting.

**Threshold caveat:** `2/3` recall is approximately `0.6667`, which falls
below the existing `0.67` threshold. The exact stored threshold was
preserved to avoid an unreviewed change in clinical outcomes; an SLP
should decide whether future versions should treat 2 of 3 as sufficient.
The numerical criteria and eight clinical stages have not undergone
clinical outcome evaluation.

The memory portion may still improve practice engagement, but it is never
presented as independent spoken recall. If all naming answers were skipped,
filler-only, or internally inconsistent, the attempt remains auditable
practice without driving automatic dual-task progression or adaptation.
`counts_toward_score` is false for unclassified mixed-mode trial records
even when their per-game progression is eligible.

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
