"""
Speech Analysis Worker for Fly.io
Processes utterance analysis jobs using Montreal Forced Aligner (MFA)

V1.1 improvements:
- Proper audio format detection from Content-Type
- Raw + normalized transcript preservation
- Progress stage heartbeats
- Accurate speech_ratio calculation (sum of speech intervals, not span)
- Proxy GOP scoring based on alignment features

Environment variables required:
- DATABASE_URL: Postgres connection string to Supabase DB
- EDGE_BASE_URL: Supabase functions URL (e.g., https://<project-ref>.supabase.co)
- SPEECH_WORKER_SECRET: Shared secret for Edge function authentication
- WORKER_ID: Unique identifier for this worker instance
"""

import os
import time
import json
import shutil
import tempfile
import subprocess
import statistics
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import requests
import psycopg
from psycopg.rows import dict_row
from praatio import textgrid

EDGE_GET_AUDIO_PATH = "/functions/v1/get-audio-signed-url"

# Silence tokens that MFA uses (excluded from speech duration)
SILENCE_TOKENS = {"sp", "sil", "spn", "", "<unk>"}

# Expected phone durations (in seconds) - rough averages for English
# Used for GOP proxy scoring - deviations from these indicate pronunciation issues
EXPECTED_PHONE_DURATIONS = {
    # Vowels (longer)
    "AA": 0.12, "AE": 0.11, "AH": 0.08, "AO": 0.12, "AW": 0.15,
    "AY": 0.15, "EH": 0.10, "ER": 0.12, "EY": 0.14, "IH": 0.08,
    "IY": 0.10, "OW": 0.14, "OY": 0.16, "UH": 0.09, "UW": 0.11,
    # Consonants (shorter)
    "B": 0.07, "CH": 0.10, "D": 0.06, "DH": 0.05, "F": 0.10,
    "G": 0.07, "HH": 0.08, "JH": 0.09, "K": 0.08, "L": 0.07,
    "M": 0.08, "N": 0.07, "NG": 0.08, "P": 0.08, "R": 0.07,
    "S": 0.11, "SH": 0.12, "T": 0.07, "TH": 0.09, "V": 0.07,
    "W": 0.06, "Y": 0.06, "Z": 0.10, "ZH": 0.10,
}
DEFAULT_PHONE_DURATION = 0.08


@dataclass
class Job:
    """
    Matches the return type of claim_speech_analysis_jobs():
    RETURNS TABLE(attempt_id uuid, audio_storage_path text, target_word text, transcript text, analysis_version text)
    """
    attempt_id: str
    audio_storage_path: str
    target_word: str
    transcript: Optional[str]
    analysis_version: str


@dataclass
class TranscriptPair:
    """Store both raw and normalized transcripts for debugging."""
    raw: str
    normalized: str


def env_required(name: str) -> str:
    """Get required environment variable or raise error."""
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing required env var: {name}")
    return v


def log(msg: str) -> None:
    """Print with flush for immediate log visibility."""
    print(msg, flush=True)


def run(cmd: List[str], cwd: Optional[str] = None) -> None:
    """Run a shell command with logging."""
    log(f"🛠️  Running: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, check=True)


def db_connect() -> psycopg.Connection:
    """Create a database connection."""
    db_url = env_required("DATABASE_URL")
    return psycopg.connect(db_url, row_factory=dict_row)


def claim_jobs(conn: psycopg.Connection, worker_id: str, batch_size: int) -> List[Job]:
    """Claim pending speech analysis jobs from the database."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM public.claim_speech_analysis_jobs(%s, %s);",
            (worker_id, batch_size)
        )
        rows = cur.fetchall()

    jobs: List[Job] = []
    for r in rows:
        jobs.append(Job(
            attempt_id=str(r.get("attempt_id")),
            audio_storage_path=r.get("audio_storage_path") or "",
            target_word=r.get("target_word") or "",
            transcript=r.get("transcript"),
            analysis_version=r.get("analysis_version") or "v1.0",
        ))
    return jobs


def get_signed_url(
    edge_base_url: str,
    worker_secret: str,
    attempt_id: str,
    worker_id: str
) -> Tuple[str, int]:
    """Request a signed URL from the Edge function."""
    url = edge_base_url.rstrip("/") + EDGE_GET_AUDIO_PATH
    headers = {
        "content-type": "application/json",
        "x-worker-secret": worker_secret,
    }
    payload = {"attempt_id": attempt_id, "worker_id": worker_id}
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Signed URL request failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    return data["signed_url"], int(data.get("expires_in_seconds", 180))


def infer_extension_from_content_type(content_type: str) -> str:
    """Map Content-Type to file extension."""
    mapping = {
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mp4": ".m4a",
        "audio/m4a": ".m4a",
        "audio/aac": ".aac",
        "audio/flac": ".flac",
        "video/webm": ".webm",  # Sometimes audio is served as video/webm
    }
    # Handle content-type with charset or other params
    base_type = content_type.split(";")[0].strip().lower()
    return mapping.get(base_type, ".bin")


def download_file(url: str, out_dir: str) -> Tuple[str, str]:
    """
    Download audio file, preserving format information.
    Returns (file_path, content_type).
    """
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        content_type = r.headers.get("Content-Type", "application/octet-stream")
        ext = infer_extension_from_content_type(content_type)
        out_path = os.path.join(out_dir, f"audio_input{ext}")
        
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
    
    return out_path, content_type


def ensure_wav(in_path: str, out_wav_path: str) -> None:
    """Convert audio to 16kHz mono WAV for MFA alignment stability."""
    run([
        "ffmpeg", "-y",
        "-i", in_path,
        "-ac", "1",
        "-ar", "16000",
        "-vn",
        out_wav_path
    ])


def normalize_transcript(raw: str) -> TranscriptPair:
    """
    Normalize transcript for MFA while preserving raw version.
    V1: Conservative normalization - lowercase only.
    TODO: Handle contractions, numbers, abbreviations properly.
    """
    raw = raw.strip()
    # Keep contractions intact, just lowercase
    normalized = raw.lower()
    return TranscriptPair(raw=raw, normalized=normalized)


def write_transcript(transcript: str, out_txt_path: str) -> None:
    """Write transcript to file for MFA."""
    with open(out_txt_path, "w", encoding="utf-8") as f:
        f.write(transcript + "\n")


def mfa_align_single(
    wav_path: str,
    transcript_path: str,
    out_dir: str,
) -> str:
    """
    Run MFA alignment for a single wav+txt pair.
    Returns path to output TextGrid file.
    """
    corpus_dir = os.path.join(out_dir, "corpus")
    align_dir = os.path.join(out_dir, "aligned")
    os.makedirs(corpus_dir, exist_ok=True)
    os.makedirs(align_dir, exist_ok=True)

    # MFA expects paired files with same basename
    base = "utt"
    wav_dst = os.path.join(corpus_dir, f"{base}.wav")
    txt_dst = os.path.join(corpus_dir, f"{base}.txt")
    shutil.copyfile(wav_path, wav_dst)
    shutil.copyfile(transcript_path, txt_dst)

    acoustic_model = os.getenv("MFA_ACOUSTIC_MODEL", "english_mfa")
    dictionary = os.getenv("MFA_DICTIONARY", "english_mfa")

    run([
        "mfa", "align",
        corpus_dir,
        dictionary,
        acoustic_model,
        align_dir,
        "--clean",
        "--single_speaker",
        "--verbose"
    ])

    tg_path = os.path.join(align_dir, f"{base}.TextGrid")
    if not os.path.exists(tg_path):
        raise RuntimeError("MFA did not produce TextGrid output")
    return tg_path


def parse_textgrid(tg_path: str) -> Dict[str, Any]:
    """
    Parse TextGrid to word/phoneme segments.
    Returns alignment_data JSON structure with accurate speech duration calculation.
    """
    tg = textgrid.openTextgrid(tg_path, includeEmptyIntervals=False)

    tiers = tg.tierNames
    word_tier_name = None
    phone_tier_name = None

    for name in tiers:
        low = name.lower()
        if word_tier_name is None and "word" in low:
            word_tier_name = name
        if phone_tier_name is None and "phone" in low:
            phone_tier_name = name

    if word_tier_name is None and tiers:
        word_tier_name = tiers[0]
    if phone_tier_name is None and len(tiers) > 1:
        phone_tier_name = tiers[1]

    words = []
    phones = []

    if word_tier_name:
        tier = tg.getTier(word_tier_name)
        for (start, end, label) in tier.entries:
            label = label.strip()
            if label and label.lower() not in SILENCE_TOKENS:
                words.append({
                    "word": label,
                    "start": round(float(start), 3),
                    "end": round(float(end), 3),
                    "duration": round(float(end) - float(start), 3)
                })

    if phone_tier_name:
        tier = tg.getTier(phone_tier_name)
        for (start, end, label) in tier.entries:
            label = label.strip()
            if label:
                is_silence = label.lower() in SILENCE_TOKENS
                phones.append({
                    "phone": label,
                    "start": round(float(start), 3),
                    "end": round(float(end), 3),
                    "duration": round(float(end) - float(start), 3),
                    "is_silence": is_silence
                })

    # Calculate ACTUAL speech duration (sum of non-silence intervals)
    speech_duration = sum(p["duration"] for p in phones if not p.get("is_silence", False))
    
    # Calculate total span for context
    total_span = 0
    if phones:
        total_span = phones[-1]["end"] - phones[0]["start"]

    alignment_quality = {
        "word_count": len(words),
        "phone_count": len(phones),
        "speech_phone_count": sum(1 for p in phones if not p.get("is_silence", False)),
        "silence_phone_count": sum(1 for p in phones if p.get("is_silence", False)),
        "has_words": len(words) > 0,
        "has_phones": len(phones) > 0,
        "speech_duration_sec": round(speech_duration, 3),
        "total_span_sec": round(total_span, 3),
    }

    return {
        "word_segments": words,
        "phone_segments": phones,
        "alignment_quality": alignment_quality
    }


def compute_proxy_gop(alignment_data: Dict[str, Any], audio_duration: float) -> Dict[str, Any]:
    """
    Compute proxy GOP (Goodness of Pronunciation) scores based on alignment features.
    
    V1 proxy metrics:
    - duration_deviation: How much phone durations deviate from expected
    - speech_ratio: Actual speech time vs total audio
    - articulation_rate: Phones per second of speech
    - pause_ratio: Proportion of silence
    - phone_coverage: Whether all expected phones are present
    
    These don't require Kaldi posteriors but provide useful pronunciation indicators.
    """
    phones = alignment_data.get("phone_segments", [])
    quality = alignment_data.get("alignment_quality", {})
    
    speech_phones = [p for p in phones if not p.get("is_silence", False)]
    silence_phones = [p for p in phones if p.get("is_silence", False)]
    
    # 1. Duration deviation score (0-1, higher is better)
    duration_deviations = []
    for p in speech_phones:
        phone_label = p["phone"].upper().rstrip("0123456789")  # Remove stress markers
        expected = EXPECTED_PHONE_DURATIONS.get(phone_label, DEFAULT_PHONE_DURATION)
        actual = p["duration"]
        if expected > 0:
            # Ratio of how close to expected (capped at 2x deviation)
            ratio = min(actual / expected, expected / actual) if actual > 0 else 0
            duration_deviations.append(ratio)
    
    duration_score = statistics.mean(duration_deviations) if duration_deviations else 0.5
    
    # 2. Speech ratio (actual speech / total audio)
    speech_duration = quality.get("speech_duration_sec", 0)
    speech_ratio = speech_duration / audio_duration if audio_duration > 0 else 0
    
    # 3. Articulation rate (phones per second of speech)
    articulation_rate = len(speech_phones) / speech_duration if speech_duration > 0 else 0
    # Normal articulation is ~10-15 phones/sec; normalize to 0-1
    articulation_score = min(articulation_rate / 15.0, 1.0) if articulation_rate > 0 else 0
    
    # 4. Pause analysis
    total_silence = sum(p["duration"] for p in silence_phones)
    pause_ratio = total_silence / audio_duration if audio_duration > 0 else 0
    # Excessive pausing (>50%) indicates difficulty
    fluency_score = max(0, 1 - (pause_ratio * 2)) if pause_ratio < 0.5 else 0
    
    # 5. Overall proxy GOP score (weighted combination)
    weights = {
        "duration": 0.3,
        "articulation": 0.25,
        "fluency": 0.25,
        "coverage": 0.2
    }
    
    # Coverage: did we get phoneme data at all?
    coverage_score = 1.0 if len(speech_phones) > 0 else 0.0
    
    overall_score = (
        duration_score * weights["duration"] +
        articulation_score * weights["articulation"] +
        fluency_score * weights["fluency"] +
        coverage_score * weights["coverage"]
    )
    
    # Per-phone scores (for detailed analysis)
    phone_scores = []
    for p in speech_phones:
        phone_label = p["phone"].upper().rstrip("0123456789")
        expected = EXPECTED_PHONE_DURATIONS.get(phone_label, DEFAULT_PHONE_DURATION)
        actual = p["duration"]
        ratio = min(actual / expected, expected / actual) if actual > 0 and expected > 0 else 0
        phone_scores.append({
            "phone": p["phone"],
            "start": p["start"],
            "end": p["end"],
            "duration": p["duration"],
            "expected_duration": round(expected, 3),
            "duration_score": round(ratio, 3)
        })
    
    return {
        "version": "proxy_v1",
        "overall_score": round(overall_score, 3),
        "subscores": {
            "duration_accuracy": round(duration_score, 3),
            "articulation_rate": round(articulation_score, 3),
            "fluency": round(fluency_score, 3),
            "coverage": round(coverage_score, 3)
        },
        "metrics": {
            "speech_ratio": round(speech_ratio, 3),
            "pause_ratio": round(pause_ratio, 3),
            "articulation_rate_phonemes_per_sec": round(articulation_rate, 2),
            "total_speech_phones": len(speech_phones),
            "total_silence_intervals": len(silence_phones),
        },
        "phone_scores": phone_scores,
        "interpretation": interpret_gop_score(overall_score)
    }


def interpret_gop_score(score: float) -> str:
    """Provide human-readable interpretation of GOP score."""
    if score >= 0.8:
        return "excellent"
    elif score >= 0.6:
        return "good"
    elif score >= 0.4:
        return "fair"
    elif score >= 0.2:
        return "needs_improvement"
    else:
        return "poor"


def get_audio_duration(wav_path: str) -> float:
    """Get duration of WAV file in seconds."""
    import wave
    with wave.open(wav_path, 'r') as wav_file:
        frames = wav_file.getnframes()
        rate = wav_file.getframerate()
        return frames / rate if rate > 0 else 0


def submit_result(
    conn: psycopg.Connection,
    attempt_id: str,
    worker_id: str,
    success: bool,
    alignment_data: Optional[Dict[str, Any]] = None,
    gop_data: Optional[Dict[str, Any]] = None,
    asr_warning_flags: Optional[List[str]] = None,
    speech_ratio: Optional[float] = None,
    error_message: Optional[str] = None,
) -> bool:
    """Submit analysis results to the database."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT public.submit_speech_analysis_result(%s, %s, %s, %s, %s, %s, %s, %s);",
            (
                attempt_id,
                worker_id,
                success,
                json.dumps(alignment_data) if alignment_data else None,
                json.dumps(gop_data) if gop_data else None,
                asr_warning_flags,
                speech_ratio,
                error_message,
            )
        )
        row = cur.fetchone()
        if row is None:
            return False
        return bool(list(row.values())[0])


def download_mfa_models() -> None:
    """Download MFA models if configured."""
    if os.getenv("MFA_DOWNLOAD_MODELS", "false").lower() != "true":
        return

    acoustic = os.getenv("MFA_ACOUSTIC_MODEL", "english_mfa")
    dictionary = os.getenv("MFA_DICTIONARY", "english_mfa")

    log(f"📦 Downloading MFA models: {acoustic}, {dictionary}")

    try:
        run(["mfa", "models", "download", "acoustic", acoustic])
    except Exception as e:
        log(f"⚠️ Acoustic model download skipped/failed: {e}")

    try:
        run(["mfa", "models", "download", "dictionary", dictionary])
    except Exception as e:
        log(f"⚠️ Dictionary download skipped/failed: {e}")


def process_job(
    job: Job,
    conn: psycopg.Connection,
    worker_id: str,
    edge_base_url: str,
    worker_secret: str
) -> None:
    """Process a single speech analysis job with progress tracking."""
    attempt_id = job.attempt_id
    progress_stages = []

    def log_progress(stage: str) -> None:
        progress_stages.append(stage)
        log(f"  📍 {attempt_id[:8]}... → {stage}")

    try:
        log_progress("started")
        
        # Get transcript - prefer provided, fallback to target_word
        raw_transcript = (job.transcript or "").strip()
        if not raw_transcript:
            raw_transcript = job.target_word
            if not raw_transcript:
                raise RuntimeError("No transcript or target_word available for alignment")
        
        transcript_pair = normalize_transcript(raw_transcript)
        log_progress("transcript_normalized")

        # Get signed URL
        signed_url, _expires = get_signed_url(
            edge_base_url, worker_secret, attempt_id, worker_id
        )
        log_progress("signed_url_obtained")

        with tempfile.TemporaryDirectory(dir="/data/tmp") as tmp:
            # Download with format detection
            audio_path, content_type = download_file(signed_url, tmp)
            log_progress(f"downloaded_audio ({content_type})")
            
            wav_path = os.path.join(tmp, "audio.wav")
            txt_path = os.path.join(tmp, "transcript.txt")
            out_dir = os.path.join(tmp, "mfa")

            # Convert to WAV
            ensure_wav(audio_path, wav_path)
            log_progress("converted_to_wav")
            
            # Get audio duration for metrics
            audio_duration = get_audio_duration(wav_path)
            
            # Write normalized transcript for MFA
            write_transcript(transcript_pair.normalized, txt_path)

            # Run MFA alignment
            tg_path = mfa_align_single(wav_path, txt_path, out_dir)
            log_progress("mfa_aligned")
            
            # Parse alignment
            alignment_data = parse_textgrid(tg_path)
            log_progress("textgrid_parsed")
            
            # Store transcript info in alignment data for debugging
            alignment_data["transcript_info"] = {
                "raw": transcript_pair.raw,
                "normalized": transcript_pair.normalized,
                "source": "provided" if job.transcript else "target_word_fallback"
            }

            # Compute speech ratio from ACTUAL speech duration
            speech_duration = alignment_data["alignment_quality"]["speech_duration_sec"]
            speech_ratio = round(speech_duration / audio_duration, 3) if audio_duration > 0 else None
            
            # Compute proxy GOP scores
            gop_data = compute_proxy_gop(alignment_data, audio_duration)
            log_progress("gop_computed")

            # Determine warning flags
            asr_warning_flags = []
            quality = alignment_data.get("alignment_quality", {})
            
            if not quality.get("has_words"):
                asr_warning_flags.append("no_words_aligned")
            if not quality.get("has_phones"):
                asr_warning_flags.append("no_phones_aligned")
            if speech_ratio is not None and speech_ratio < 0.1:
                asr_warning_flags.append("low_speech_ratio")
            if gop_data["overall_score"] < 0.3:
                asr_warning_flags.append("low_gop_score")
            if gop_data["subscores"]["fluency"] < 0.3:
                asr_warning_flags.append("low_fluency")

            # Submit success
            ok = submit_result(
                conn, attempt_id, worker_id, True,
                alignment_data=alignment_data,
                gop_data=gop_data,
                asr_warning_flags=asr_warning_flags if asr_warning_flags else None,
                speech_ratio=speech_ratio,
            )
            log_progress("submitted")
            log(f"✅ attempt {attempt_id} complete (GOP: {gop_data['overall_score']}, flags: {asr_warning_flags or 'none'})")

    except Exception as e:
        err = str(e)
        log(f"❌ attempt {attempt_id} failed at {progress_stages[-1] if progress_stages else 'init'}: {err}")
        try:
            submit_result(
                conn, attempt_id, worker_id, False,
                error_message=f"Failed at {progress_stages[-1] if progress_stages else 'init'}: {err}"
            )
        except Exception as e2:
            log(f"❌ submit failure for {attempt_id}: {e2}")


def write_heartbeat(conn: psycopg.Connection, worker_id: str, status: str = "ok", meta: Optional[Dict[str, Any]] = None) -> None:
    """Write worker heartbeat to database."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT public.upsert_worker_heartbeat(%s, %s, %s::jsonb);",
                (worker_id, status, json.dumps(meta or {}))
            )
            conn.commit()
    except Exception as e:
        log(f"⚠️ Failed to write heartbeat: {e}")


def main() -> None:
    """Main worker loop."""
    worker_id = env_required("WORKER_ID")
    edge_base_url = env_required("EDGE_BASE_URL")
    worker_secret = env_required("SPEECH_WORKER_SECRET")
    batch_size = int(os.getenv("BATCH_SIZE", "5"))
    poll_interval = float(os.getenv("POLL_INTERVAL_SECONDS", "3"))

    log(f"🚀 Speech worker starting: {worker_id}")
    log(f"   Edge URL: {edge_base_url}")
    log(f"   Batch size: {batch_size}, Poll interval: {poll_interval}s")

    download_mfa_models()

    log("🔄 Entering main loop...")

    last_heartbeat = 0.0
    heartbeat_interval = 30.0  # Write heartbeat every 30 seconds
    jobs_processed = 0
    jobs_failed = 0

    while True:
        try:
            with db_connect() as conn:
                # Write heartbeat periodically
                now = time.time()
                if now - last_heartbeat >= heartbeat_interval:
                    write_heartbeat(conn, worker_id, "ok", {
                        "version": "mfa-worker@2025-12-16",
                        "batch_size": batch_size,
                        "poll_interval": poll_interval,
                        "jobs_processed_session": jobs_processed,
                        "jobs_failed_session": jobs_failed
                    })
                    last_heartbeat = now

                jobs = claim_jobs(conn, worker_id, batch_size)

                if not jobs:
                    time.sleep(poll_interval)
                    continue

                log(f"📥 Claimed {len(jobs)} job(s)")

                for job in jobs:
                    try:
                        process_job(job, conn, worker_id, edge_base_url, worker_secret)
                        jobs_processed += 1
                    except Exception as job_err:
                        jobs_failed += 1
                        log(f"🔥 Job processing error: {job_err}")

        except Exception as outer:
            log(f"🔥 Worker loop error: {outer}")
            time.sleep(2)


if __name__ == "__main__":
    main()
