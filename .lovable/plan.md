## Phase 4 — Minimal Pairs content top-up

### What's actually broken vs. what looked broken

The audit's scary line `d4=0 d5=0` is a **reporting artifact**, not a real gap. The Minimal Pairs bank uses `difficulty: 1 | 2 | 3` (one number per cohort tier), so buckets d4/d5 will always read 0. The audit script just loops 1–5 generically.

The **real** gaps are in the playable (photo-backed) pool:

| Tier | Playable count | Target | Need |
|------|----------------|--------|------|
| T1 (distinct contrasts — clinical L1–L3) | 16 | 20 | **+4** |
| T2 (single-feature — clinical L4–L7) | 17 | 20 | **+3** |
| T3 (similar / fast — clinical L8, aspirational) | 15 | 20 | **+5** |

A patient *can* level into L4/L5 today — the bridge and ceiling let them — they just see a thinner rotation and faster recency repeats. Phase 4 fixes that.

### Scope (purely additive, no engine changes)

**File:** `src/data/minimalPairsBank.ts`

Add roughly **15 new `MinimalPair` entries** that are guaranteed photo-backed (both words exist in `PHOTO_BANK`), distributed across the categories the L4–L8 intensity ladder actually requests:

- **+4 tier_1 pairs** (`difficulty: 1`, category: `stop_fricative`) — initial-position, big acoustic distance. Feeds L1–L3.
- **+3 tier_2 pairs** (`difficulty: 2`) — mix of `fricative_affricate`, `voicing`, `final_voicing`; varied contrast positions (initial / medial / final) so L6–L7's "medial/final" intensity slices have material to pick from. Feeds L4–L7.
- **+5 tier_3 pairs** (`difficulty: 3`) — close-feature contrasts (e.g. `/θ/`–`/f/`, `/r/`–`/l/`, `/n/`–`/m/`, `/s/`–`/ʃ/`); placement and `confusable_triad`-friendly. Feeds L8 (aspirational stretch slice).

For each new pair I'll verify both `word1` and `word2` resolve in `PHOTO_BANK` before adding, otherwise it counts toward `MINIMAL_PAIRS.length` but not toward the playable pool (the exact problem we're solving).

### What stays untouched

- `useMinimalPairsProgression.ts` — no changes
- `minimalPairsIntensity.ts` ladder, replay budgets, response windows — no changes
- `minimalPairsLevels.ts` readiness flags — L1–L4 stay `ready`, L5–L7 stay `thin`, L8 stays `aspirational`
- `implementedCeiling` — still clamps at L7 (L8 aspirational), so leveling behavior is unchanged
- Soft-regression scaffold threshold and difficulty bridge — unchanged

### Verification

1. `bunx vitest run src/data/__tests__/contentDepthAudit.test.ts` — expect all three minimal-pairs (playable) tiers at ≥ 20.
2. Confirm `getMinimalPairStats().missingPhotos` is empty for the new entries.
3. Confirm `contentDistinctness.test.ts` still passes (no overlap regressions).

### Out of scope (deliberate)

- L7–L8 runtime infrastructure (SNR/noise, response-time gating, true triplet discrimination UI). Without that runtime, L8 stays aspirational regardless of content depth.
- Fixing the audit script's misleading `d4/d5` rows — cosmetic only.
- The 5 flaky `fixSentenceRecency` tests — already triaged in `.lovable/backlog/pr6-flaky-fix-sentence-recency-test.md`.

### After this

Remaining thin areas (not in this phase): `detective-mind` (T1/T2/T3 all at 15), `multi-step-plan` (same), `two-clues` T3 at 18. Each is a candidate for its own small content top-up later.