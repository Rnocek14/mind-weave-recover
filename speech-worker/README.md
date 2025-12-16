# Speech Analysis Worker (Fly.io)

A Python worker that processes speech analysis jobs using Montreal Forced Aligner (MFA).

## Architecture

```
utterance_analyses (pending) 
    → Worker claims jobs via claim_speech_analysis_jobs()
    → Worker requests signed URL from Edge function
    → Worker downloads audio, runs MFA alignment
    → Worker submits results via submit_speech_analysis_result()
```

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

Or set `MFA_DOWNLOAD_MODELS=true` to download on each startup (slower).

## Job Flow

1. **Claim**: Worker calls `claim_speech_analysis_jobs(worker_id, batch_size)`
   - Returns jobs where `analysis_status = 'pending'` and `next_retry_at <= now()`
   - Sets `analysis_status = 'processing'`, `locked_by = worker_id`

2. **Process**:
   - Request signed URL from Edge function
   - Download audio file
   - Convert to 16kHz mono WAV
   - Run MFA alignment
   - Parse TextGrid output

3. **Submit**: Call `submit_speech_analysis_result(...)`
   - Success: Sets `analysis_status = 'complete'`, stores alignment_data
   - Failure: Increments retry_count, sets next_retry_at with exponential backoff

## Output Schema

### alignment_data (JSONB)

```json
{
  "word_segments": [
    { "word": "hello", "start": 0.2, "end": 0.5 },
    { "word": "world", "start": 0.6, "end": 1.0 }
  ],
  "phone_segments": [
    { "phone": "HH", "start": 0.2, "end": 0.25 },
    { "phone": "EH", "start": 0.25, "end": 0.35 },
    ...
  ],
  "alignment_quality": {
    "word_count": 2,
    "phone_count": 8,
    "has_words": true,
    "has_phones": true,
    "total_duration_sec": 0.8
  }
}
```

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

## Scaling

To run multiple workers:

```bash
# Scale to 2 machines
fly scale count 2

# Or use different worker IDs
fly secrets set WORKER_ID="worker-2" -c fly.toml
```
