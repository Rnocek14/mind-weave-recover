# Phonological Awareness — Clinical Evidence

## Purpose
Metalinguistic judgment of sub-lexical sound structure: the patient hears
two words and decides whether they share an onset, coda, vowel, or rhyme.
Targets phonological processing (input side) — the substrate for
auditory comprehension, reading decoding, and self-monitoring of speech
output in aphasia + apraxia.

## Trial mode (and why receptive-safe)
**Receptive** — every trial is a two-alternative auditory discrimination
(Same / Different, or Rhyme / No-rhyme). There is no spoken production.
`submitTrial` emits `trialMode: 'recognition'` and `phonological_awareness`
is **INTENTIONALLY NOT** in `ADOPTED_TRIAL_MODE_SLUGS` — routing this
metalinguistic-judgment task into the expressive mastery track would
conflate axes. Same precedent as minimal-pairs (auditory discrimination),
meaning-match (semantic recognition), and detective-mind (reading
comprehension). A receptive mastery track is the right home and is
explicitly deferred.

## Clinical basis (and honest scope)
- **Phonological treatment in aphasia** — Kendall et al. (2008); Brookshire
  et al. (2014): phoneme-level discrimination + manipulation drills support
  improved naming and reading in aphasia.
- **Phonemic awareness hierarchy** — Adams (1990); Anthony & Francis
  (2005) developmental sequence: rhyme/alliteration → onset-rime → full
  phoneme segmentation/manipulation. Adapted for adult aphasia rehab in
  Kiran & Bassetto (2008) and related work.
- **Auditory discrimination + minimal pairs** — Morris & Franklin (2017):
  perception training as a prerequisite for output therapy.

**Honest scope:** The mapping of the existing bank's `difficulty` field
(1–5) onto the 8-rung clinical ladder is a **clinically motivated
calibration default**, not a literature-proven hierarchy. The bank does
not yet include degraded-signal or 3-item discrimination trials, so L7
is thin and L8 is aspirational.

## Support axis (receptive)
Phonological Awareness has **no in-trial scaffold control** today — there
is no "play it slower" or "highlight the difference" hint button.
Every trial is `recognition_only`. The ladder advances on accuracy +
content complexity (rhyme → onset → coda → vowel → multi-phoneme
contrasts → nonword stimuli), not on scaffold fading.

## Phase 1 readiness
- L1–L4 → ready (bank difficulty 1–2 — rhyme + onset discrimination)
- L5–L6 → ready (bank difficulty 3–4 — coda + vowel + multi-phoneme)
- L7 → thin (bank difficulty 5 — nonword + low-frequency contrasts, sparse)
- L8 → aspirational (no runtime mode for degraded signal or triplet RT;
  ceiling clamp blocks promotion)
