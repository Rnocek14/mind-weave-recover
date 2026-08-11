# Fix Sentence — Mixed Morphology (L6) Implementation Spec

**Status:** PROPOSED — no code. Follows the change process that shipped L5
(spec → review → bank + gated selector → game/scoring → gate flip).
**Gate (to be added):** `MORPHOLOGY_GAME_READY` in
`src/lib/progression/fixSentenceContentSelector.ts` — starts `false`.

## 1. What already exists

- `FIX_SENTENCE_LEVELS[6]` defines the clinical bar: open response,
  ≥5 on-target attempts at ≥80%, trialWeight 1.7, tierKey
  `mixed_morphology`, `implemented: false`.
- The selector skips L6 honestly (`morphology_tier_not_implemented`).
- The shipped L5 vertical established the pattern to copy: a separate
  bank so lower tiers can never serve the cohort, computed-index integrity
  tests, a readiness gate, and honest fallback below `MIN_TIER_POOL_SIZE`.

## 2. Clinical intent

L6 targets *grammatical morphology repair* — the patient finds and fixes an
inflection error rather than a lexical substitution: tense (`Yesterday she
walk to the store`), subject–verb agreement (`He are happy`), plural number
(`She bought three apple`), irregular past (`He goed home`), comparative
(`This box is more heavy`). Mapping/TUF-style sentence work motivates the
tier (see `docs/clinical-evidence/fix-sentence.md`).

**Key insight: the game loop needs ZERO changes.** A morphology repair is
still "one wrong word at one position with a closed fix set" — the existing
single-error engine plays it as-is. What the old NOT-IMPLEMENTED note
actually meant is that nothing *distinguished* a morphological repair from
a lexical one for cohort selection and telemetry. That is a schema + data
problem, not an engine problem — which makes L6 the cheapest remaining
Fix Sentence tier.

## 3. Changes required

### 3.1 Schema (`src/data/fixSentenceBank.ts`)

Optional block on `FixSentenceTrial`:

```ts
morphology?: {
  errorClass: 'tense' | 'agreement' | 'plural' | 'irregular_past' | 'comparative';
  baseForm: string;      // lemma, e.g. 'walk'
  erroneousForm: string; // must === wrongWord
  requiredForm: string;  // must be included in acceptedFixes
};
```

### 3.2 Content — `FIX_SENTENCE_MORPHOLOGY_BANK` (separate const)

- ≥8 trials (gate needs ≥`MIN_TIER_POOL_SIZE` = 6), difficulty 3,
  sentence length in the L4/L5 register (8–14 words).
- "Mixed" is honest only if the cohort spans **≥3 errorClass values**;
  pin this in the integrity test.
- Errors must be unambiguous: exactly one grammatical repair site per
  sentence, and the sentence must contain the temporal/number anchor that
  forces the repair (`Yesterday…`, `three…`) so the fix is closed-set,
  not stylistic.
- AI-authored content goes on the SLP-review pile like every other bank.

### 3.3 Scoring (one guard, no loop change)

Spoken-mode risk: ASR routinely drops exactly the suffixes this tier
tests (`walks`→`walk`, `walked`→`walk`), and the semantic-similarity
fallback would score base and inflected forms as equivalent — silently
passing the patient on the very contrast being treated. Therefore, for
trials carrying `morphology`:

1. **Disable the semantic fallback** (same rule the L5 two-error branch
   already applies). Exact/alias matching only.
2. `fixAliases` may include *spelled-out* scaffolds ("walks with an s")
   but never the bare base form.
3. Typed input needs no special handling.

### 3.4 Selector (`fixSentenceContentSelector.ts`)

Mirror the L5 branch: behind `MORPHOLOGY_GAME_READY`, L6 serves
`selectMorphologyCandidates()` (filter `morphology != null`) when the pool
≥ `MIN_TIER_POOL_SIZE`, else the existing honest skip. Flip
`FIX_SENTENCE_LEVELS[6].contentSelector.implemented` in the same change,
raising the ceiling L5 → L6.

### 3.5 Tests

- Integrity suite mirroring `twoErrorBankIntegrity.test.ts`: computed
  `wrongWordIndex`, `erroneousForm === wrongWord`, `requiredForm ∈
  acceptedFixes`, ≥3 error classes, no leak into `FIX_SENTENCE_BANK`,
  honest-skip while the gate is off, serves-cohort when on.
- Selector + tier-status + spec-mirror updates (same three files the L5
  flip touched: `fixSentenceContentSelector.test.ts`,
  `clinicalIntegrity.test.ts`, level-spec mirror).

## 4. Explicitly out of scope

- L7 embedded clauses and L8 open-ended repair (own specs later).
- Morpheme-level *partial credit* (e.g. right lemma, wrong inflection
  scores 0.5) — needs SLP guidance before we encode it.
- Any change to the spoken-mode ASR pipeline itself.
