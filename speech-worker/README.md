# Speech Analysis Worker (Fly.io)

A Python worker that processes speech analysis jobs using Montreal Forced Aligner (MFA) with proxy GOP (Goodness of Pronunciation) scoring.

## Architecture

```
utterance_analyses (pending) 
    → Worker claims jobs via claim_speech_analysis_jobs()
    → Worker requests signed URL from Edge function
    → Worker downloads audio, runs MFA alignment
    → Worker computes proxy GOP scores
    → Worker submits results via submit_speech_analysis_result()
```

## Features

### V1.1 Improvements
- **Format detection**: Preserves audio format from Content-Type header
- **Transcript preservation**: Stores both raw and normalized transcripts
- **Progress tracking**: Stage-by-stage logging for debugging
- **Accurate speech ratio**: Sums actual speech intervals (excludes silence)
- **Proxy GOP scoring**: Pronunciation quality metrics without Kaldi posteriors

## Prerequisites

1. **Supabase Edge Function deployed**: `get-audio-signed-url`
2. **Supabase secret configured**: `SPEECH_WORKER_SECRET`
3. **Database functions created**: `claim_speech_analysis_jobs`, `submit_speech_analysis_result`

## Deployment

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
```

### 2. Initialize (first time only)

```bash
cd speech-worker
fly auth login
fly launch --no-deploy
```

### 3. Set secrets

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres.wjedbpjaiqdxhmjzkcxo:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  EDGE_BASE_URL="https://wjedbpjaiqdxhmjzkcxo.supabase.co" \
  SPEECH_WORKER_SECRET="your-shared-secret"
```

### 4. Deploy

```bash
fly deploy
```

### 5. Monitor

```bash
fly logs
fly status
```

## Output Schema

### alignment_data (JSONB)

```json
{
  "word_segments": [
    { "word": "hello", "start": 0.2, "end": 0.5, "duration": 0.3 }
  ],
  "phone_segments": [
    { "phone": "HH", "start": 0.2, "end": 0.25, "duration": 0.05, "is_silence": false }
  ],
  "alignment_quality": {
    "word_count": 2,
    "phone_count": 8,
    "speech_phone_count": 6,
    "silence_phone_count": 2,
    "has_words": true,
    "has_phones": true,
    "speech_duration_sec": 0.6,
    "total_span_sec": 0.8
  },
  "transcript_info": {
    "raw": "Hello",
    "normalized": "hello",
    "source": "provided"
  }
}
```

### gop_data (JSONB) - Proxy GOP V1

```json
{
  "version": "proxy_v1",
  "overall_score": 0.72,
  "subscores": {
    "duration_accuracy": 0.85,
    "articulation_rate": 0.70,
    "fluency": 0.65,
    "coverage": 1.0
  },
  "metrics": {
    "speech_ratio": 0.75,
    "pause_ratio": 0.25,
    "articulation_rate_phonemes_per_sec": 10.5,
    "total_speech_phones": 6,
    "total_silence_intervals": 2
  },
  "phone_scores": [
    {
      "phone": "HH",
      "start": 0.2,
      "end": 0.25,
      "duration": 0.05,
      "expected_duration": 0.08,
      "duration_score": 0.625
    }
  ],
  "interpretation": "good"
}
```

### GOP Score Interpretation

| Score Range | Interpretation | Clinical Meaning |
|-------------|----------------|------------------|
| 0.8 - 1.0 | excellent | Clear, well-paced pronunciation |
| 0.6 - 0.8 | good | Minor pronunciation variations |
| 0.4 - 0.6 | fair | Noticeable pronunciation difficulties |
| 0.2 - 0.4 | needs_improvement | Significant pronunciation issues |
| 0.0 - 0.2 | poor | Severe pronunciation difficulties |

### Warning Flags

The worker sets `asr_warning_flags` based on analysis quality:

- `no_words_aligned`: MFA couldn't align any words
- `no_phones_aligned`: MFA couldn't produce phone-level alignment
- `low_speech_ratio`: Less than 10% of audio is speech
- `low_gop_score`: Overall GOP score below 0.3
- `low_fluency`: Excessive pausing detected

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | Postgres connection string |
| `EDGE_BASE_URL` | Yes | - | Supabase project URL |
| `SPEECH_WORKER_SECRET` | Yes | - | Shared secret for Edge auth |
| `WORKER_ID` | No | `worker-1` | Unique worker identifier |
| `BATCH_SIZE` | No | `5` | Jobs to claim per poll |
| `POLL_INTERVAL_SECONDS` | No | `3` | Seconds between polls |
| `MFA_ACOUSTIC_MODEL` | No | `english_mfa` | MFA acoustic model name |
| `MFA_DICTIONARY` | No | `english_mfa` | MFA dictionary name |
| `MFA_DOWNLOAD_MODELS` | No | `false` | Download models on startup |

## MFA Models

For faster cold starts, bake MFA models into the Docker image:

```dockerfile
# Add to Dockerfile after the base image
RUN mfa models download acoustic english_mfa
RUN mfa models download dictionary english_mfa
```

## Progress Stages

The worker logs progress through these stages for debugging:

1. `started` - Job processing begun
2. `transcript_normalized` - Transcript prepared for MFA
3. `signed_url_obtained` - Audio URL retrieved
4. `downloaded_audio` - Audio file downloaded (with Content-Type)
5. `converted_to_wav` - Audio converted to 16kHz mono WAV
6. `mfa_aligned` - MFA alignment complete
7. `textgrid_parsed` - TextGrid parsed to JSON
8. `gop_computed` - Proxy GOP scores calculated
9. `submitted` - Results written to database

## Troubleshooting

### No jobs being claimed

```sql
-- Check pending jobs
SELECT attempt_id, analysis_status, next_retry_at, locked_by 
FROM utterance_analyses 
WHERE analysis_status = 'pending' 
ORDER BY next_retry_at;
```

### Jobs stuck in processing

```sql
-- Release stale locks (older than 10 minutes)
SELECT public.release_stale_speech_locks();
```

### View worker activity

```bash
fly logs -a speech-worker
```

## Future Enhancements (V2)

- **Real GOP**: Kaldi or wav2vec2 posterior-based scoring
- **OOV handling**: G2P fallback for out-of-vocabulary words
- **Progress DB column**: Write stage to database for dashboard visibility
- **Transcript normalization**: Numbers, abbreviations, contractions
