
# Azure Pronunciation Assessment — Full Clinical Data Capture

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| A | NBest phoneme capture + gop_data enrichment | ✅ Done |
| B | Substitution pattern aggregation in compute-speech-profile | ⏳ Next |
| C | Pronunciation diagnostics parity (Two Clues + Phrase Practice) | ⏳ Planned |
| D | Prosody score surfacing | ⏳ Deferred |

## Phase A — What Changed

### 1. Edge Function (`analyze-pronunciation/index.ts`)
- **NBest phoneme extraction**: Each phoneme now includes `nbestPhonemes` array (top 5 candidates Azure returns for what was actually spoken)
- Each candidate has `{ phoneme: string, score: number }` — the `score` is Azure's confidence (0-1) that this phoneme was produced
- Only included when Azure returns NBest data (non-empty array)
- Word-level `errorType` (`None`/`Mispronunciation`/`Omission`/`Insertion`/`UnexpectedBreak`) was already captured

### 2. gop_data Schema (`useUtteranceLogger.ts`)
- Added `schemaVersion: 'azure-pa-v2'` to all new gop_data payloads
- This distinguishes enriched payloads from legacy ones forever
- NBest data flows through automatically since `words` array is stored verbatim from Azure response

### Example gop_data (azure-pa-v2)
```json
{
  "schemaVersion": "azure-pa-v2",
  "source": "azure",
  "pronunciationScore": 72,
  "accuracyScore": 68,
  "fluencyScore": 85,
  "completenessScore": 100,
  "prosodyScore": 55,
  "words": [
    {
      "word": "three",
      "accuracyScore": 68,
      "errorType": "Mispronunciation",
      "phonemes": [
        {
          "phoneme": "θ",
          "accuracyScore": 32,
          "duration": 0.12,
          "nbestPhonemes": [
            { "phoneme": "f", "score": 0.72 },
            { "phoneme": "θ", "score": 0.18 },
            { "phoneme": "v", "score": 0.05 }
          ]
        }
      ]
    }
  ]
}
```

## Phase B — Substitution Aggregation (Next)

Update `compute-speech-profile` edge function to:
1. Read `gop_data` where `schemaVersion = 'azure-pa-v2'`
2. For each phoneme with `nbestPhonemes`, if top candidate differs from expected and confidence ≥ 0.5, count as substitution
3. Aggregate into `common_substitutions` on `user_speech_profiles` table
4. Aggregate word-level `errorType` distribution (% Mispronunciation, % Omission, etc.)
5. Track prosody score average

**Validation**: Run on one test user first, manually inspect before enabling globally.

## Phase C — Diagnostics Parity

Ensure Two Clues and Phrase Practice log identical `pronunciationDiagnostics` metadata as Photo Naming:
- `pronRequestId`, `pronunciationStatus`, `pronunciationErrorStage`
- `pronunciationTimingsMs`, `audioMeta`

## Phase D — Prosody Surfacing (Deferred)

Store prosody scores now (already done), surface trends later once real distributions are understood.
Prosody is noisy early, varies by mic/environment, easy to misinterpret clinically.
