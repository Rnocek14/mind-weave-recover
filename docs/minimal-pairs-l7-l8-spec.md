# Minimal Pairs — Degraded Signal (L7) + Triplet/RT (L8) Implementation Spec

**Status:** PROPOSED — no code. Same change process as the shipped Fix
Sentence L5 vertical (spec → review → gated implementation → flip).
**Gates (to be added):** `DEGRADED_SIGNAL_READY` and `TRIPLET_RT_READY`
in `src/lib/progression/minimalPairsContentSelector.ts` — both start
`false`. The two tiers are independent gates; L7 ships first so the
ladder fills bottom-up.

## 1. What already exists

- `minimalPairsContentSelector.ts` already types `SignalCondition =
  'quiet' | 'noise_snr_low' | 'low_pass'` and skips L7/L8 honestly
  (`signal_condition_not_implemented`, `triplet_mode_not_implemented`).
- `MINIMAL_PAIRS_LEVELS` L7/L8 carry the clinical bars (L7: ≥6 attempts
  @ 80%; L8: ≥6 @ 85%) with `readiness: 'aspirational'`.
- Audio today: `useTextToSpeech` plays TTS through a shared
  `HTMLAudioElement` with blob URLs (`src/hooks/useTextToSpeech.ts`).
- `phonological_awareness` L8 declares the same `degraded_signal` tierKey —
  the L7 audio chain below is built to be reused there verbatim.

## 2. L7 — degraded signal

### 2.1 Clinical intent

Discrimination that survives adverse listening conditions is the
functional endpoint (phones, restaurants, TV). L7 = any contrast class
the patient has already mastered in quiet, presented under degradation.

### 2.2 Audio chain (client-only, no new assets)

Wrap the *existing* element rather than replacing the pipeline:

```
HTMLAudioElement ── MediaElementAudioSourceNode ─┬─ BiquadFilter(lowpass) ─┐
                                                 │                          ├─ destination
              noise buffer ── GainNode (SNR mix) ┘──────────────────────────┘
```

- Blob URLs are same-origin, so `MediaElementAudioSourceNode` is CORS-safe.
- Two conditions, one active per trial (never stacked):
  `noise_snr_low` — pink-noise mix at a fixed SNR band; `low_pass` —
  cutoff 1.5 kHz. **Both values are calibration defaults, tunable, not
  literature-derived** (same honesty stance as the ladder docs).
- Entry band SNR +10 dB; after ≥80% over a rolling 6 degraded trials,
  step to +5 dB. Persist the band alongside the game's other progression
  state; regression follows the ladder's normal soft-regression rules.
- The replay button replays *degraded* audio — replays already count via
  `audioReplayCount`, no change.

### 2.3 Honest fallback (the load-bearing part)

Degradation can fail at runtime (no `AudioContext`, autoplay-unlock
failure, Safari quirks). If the chain cannot be constructed **before**
the first degraded trial: serve quiet, report fallback
`signal_condition_not_implemented` in diagnostics, and do **not** count
those trials as L7 evidence. Every trial result gains
`signalCondition: 'quiet' | 'noise_snr_low' | 'low_pass'` so the
progression engine counts only genuinely-degraded trials toward the L7
bar — the same "selector skips honestly" contract, enforced at scoring
time rather than selection time.

## 3. L8 — triplet discrimination + RT band

### 3.1 Content: `MINIMAL_TRIPLETS` (separate const)

A triplet needs a third phonological neighbor (`cat / hat / bat`). Do not
overload `MinimalPair` — a new bank const with computed integrity:

```ts
interface MinimalTriplet {
  id: string;
  words: [string, string, string];   // pairwise minimal or near-minimal
  target: number;                     // index of the spoken word
  contrastTypes: string[];            // per-pair contrast labels
  difficulty: number;
}
```

≥8 triplets to open the tier (mirror `MIN_PAIR_TIER_POOL_SIZE` semantics);
integrity tests verify pairwise single-phoneme (or documented
near-minimal) contrasts and that `target` indexes are distributed.

### 3.2 Trial + scoring

3-AFC: hear one word, choose among three. RT measured from audio *end*
(not tap-to-play) to selection. Bands — correct-fast ≤ 2500 ms,
correct-slow > 2500 ms, incorrect; **thresholds are calibration defaults,
tunable**. L8 evidence = accuracy ≥85% (per the ladder) **and** median RT
inside the fast band across the evidence window; correct-slow trials count
toward accuracy but hold the RT criterion back. Replays reset the RT clock
and are logged (replays beyond the first mark the trial correct-slow at
best).

### 3.3 UI

Three photo/word tiles instead of two — the existing 2-AFC layout extends;
no new interaction primitives. Reduced-motion and text-scale settings apply
as everywhere else.

## 4. Rollout order & flips

1. Build the audio chain + `signalCondition` telemetry; flip
   `DEGRADED_SIGNAL_READY` + `MINIMAL_PAIRS_LEVELS[7]`
   (`readiness: 'thin'`, `implemented: true`) in the same change, with
   selector/tier-status/mirror test updates (the L5-flip checklist).
2. Reuse the chain for `phonological_awareness` L8 (own small change).
3. Author `MINIMAL_TRIPLETS` + integrity tests; build 3-AFC + RT scoring;
   flip `TRIPLET_RT_READY` + L8 spec the same way.

## 5. Explicitly out of scope

- Speech-shaped or multi-talker babble noise (pink noise is v1; upgrade is
  a calibration change, not an architecture change).
- Server-side pre-mixed degraded audio.
- Adaptive SNR staircases (2-down-1-up etc.) — v1 uses the two fixed bands;
  a staircase is a future calibration upgrade with SLP input.
- Any change to quiet-condition L4–L6 behavior.
