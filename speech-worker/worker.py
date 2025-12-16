"""
Speech Analysis Worker for Fly.io
Processes utterance analysis jobs using Montreal Forced Aligner (MFA)

Environment variables required:
- DATABASE_URL: Postgres connection string to Supabase DB
- EDGE_BASE_URL: Supabase functions URL (e.g., https://<project-ref>.supabase.co)
- SPEECH_WORKER_SECRET: Shared secret for Edge function authentication
- WORKER_ID: Unique identifier for this worker instance

Optional:
- BATCH_SIZE: Number of jobs to claim per poll (default: 5)
- POLL_INTERVAL_SECONDS: Seconds between polls (default: 3)
- MFA_ACOUSTIC_MODEL: MFA acoustic model name (default: english_mfa)
- MFA_DICTIONARY: MFA dictionary name (default: english_mfa)
- MFA_DOWNLOAD_MODELS: Set to "true" to download models on startup
"""

import os
import time
import json
import shutil
import tempfile
import subprocess
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import requests
import psycopg
from psycopg.rows import dict_row
from praatio import textgrid

EDGE_GET_AUDIO_PATH = "/functions/v1/get-audio-signed-url"


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
    """
    Claim pending speech analysis jobs from the database.
    Uses claim_speech_analysis_jobs(p_worker_id, p_batch_size) which returns:
    - attempt_id, audio_storage_path, target_word, transcript, analysis_version
    """
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
    """
    Request a signed URL from the Edge function for secure audio download.
    """
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


def download_file(url: str, out_path: str) -> None:
    """Download a file from URL to local path."""
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)


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


def write_transcript(transcript: str, out_txt_path: str) -> None:
    """Write transcript to file for MFA. Basic normalization applied."""
    # Basic normalization - MFA is sensitive to formatting
    normalized = transcript.strip().lower()
    with open(out_txt_path, "w", encoding="utf-8") as f:
        f.write(normalized + "\n")


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

    # MFA expects paired files with same basename inside corpus_dir
    base = "utt"
    wav_dst = os.path.join(corpus_dir, f"{base}.wav")
    txt_dst = os.path.join(corpus_dir, f"{base}.txt")
    shutil.copyfile(wav_path, wav_dst)
    shutil.copyfile(transcript_path, txt_dst)

    # Get model names from environment
    acoustic_model = os.getenv("MFA_ACOUSTIC_MODEL", "english_mfa")
    dictionary = os.getenv("MFA_DICTIONARY", "english_mfa")

    # Run MFA align
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
    Returns alignment_data JSON structure.
    """
    tg = textgrid.openTextgrid(tg_path, includeEmptyIntervals=False)

    tiers = tg.tierNames
    word_tier_name = None
    phone_tier_name = None

    # Common tier names from MFA: "words", "phones"
    for name in tiers:
        low = name.lower()
        if word_tier_name is None and "word" in low:
            word_tier_name = name
        if phone_tier_name is None and "phone" in low:
            phone_tier_name = name

    # Fallback: pick first interval tier as words if unknown
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
            if label:
                words.append({
                    "word": label,
                    "start": round(float(start), 3),
                    "end": round(float(end), 3)
                })

    if phone_tier_name:
        tier = tg.getTier(phone_tier_name)
        for (start, end, label) in tier.entries:
            label = label.strip()
            if label:
                phones.append({
                    "phone": label,
                    "start": round(float(start), 3),
                    "end": round(float(end), 3)
                })

    # Compute alignment quality metrics
    total_duration = 0
    if words:
        total_duration = words[-1]["end"] - words[0]["start"]

    alignment_quality = {
        "word_count": len(words),
        "phone_count": len(phones),
        "has_words": len(words) > 0,
        "has_phones": len(phones) > 0,
        "total_duration_sec": round(total_duration, 3),
    }

    return {
        "word_segments": words,
        "phone_segments": phones,
        "alignment_quality": alignment_quality
    }


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
    """
    Submit analysis results to the database.
    Matches submit_speech_analysis_result(
        p_attempt_id uuid,
        p_worker_id text,
        p_success boolean,
        p_alignment_data jsonb,
        p_gop_data jsonb,
        p_asr_warning_flags text[],
        p_speech_ratio double precision,
        p_error_message text
    )
    """
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
        # Function returns boolean
        return bool(list(row.values())[0])


def download_mfa_models() -> None:
    """Download MFA models if configured to do so on startup."""
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
    """Process a single speech analysis job."""
    attempt_id = job.attempt_id

    try:
        # Need transcript for alignment
        transcript = (job.transcript or "").strip()
        if not transcript:
            # Fall back to target word if no transcript available
            transcript = job.target_word
            if not transcript:
                raise RuntimeError("No transcript or target_word available for alignment")

        # Get signed URL for audio download
        signed_url, _expires = get_signed_url(
            edge_base_url, worker_secret, attempt_id, worker_id
        )

        with tempfile.TemporaryDirectory(dir="/data/tmp") as tmp:
            raw_path = os.path.join(tmp, "audio.bin")
            wav_path = os.path.join(tmp, "audio.wav")
            txt_path = os.path.join(tmp, "transcript.txt")
            out_dir = os.path.join(tmp, "mfa")

            # Download and prepare files
            download_file(signed_url, raw_path)
            ensure_wav(raw_path, wav_path)
            write_transcript(transcript, txt_path)

            # Run MFA alignment
            tg_path = mfa_align_single(wav_path, txt_path, out_dir)
            alignment_data = parse_textgrid(tg_path)

            # Compute speech ratio (speech time / total audio duration)
            speech_ratio = None
            if alignment_data.get("alignment_quality", {}).get("total_duration_sec", 0) > 0:
                # Get audio duration from wav file
                import wave
                with wave.open(wav_path, 'r') as wav_file:
                    audio_duration = wav_file.getnframes() / wav_file.getframerate()
                    speech_duration = alignment_data["alignment_quality"]["total_duration_sec"]
                    if audio_duration > 0:
                        speech_ratio = round(speech_duration / audio_duration, 3)

            # Check for warning conditions
            asr_warning_flags = []
            quality = alignment_data.get("alignment_quality", {})
            if not quality.get("has_words"):
                asr_warning_flags.append("no_words_aligned")
            if not quality.get("has_phones"):
                asr_warning_flags.append("no_phones_aligned")
            if speech_ratio is not None and speech_ratio < 0.1:
                asr_warning_flags.append("low_speech_ratio")

            # GOP is optional in V1 - set to None
            gop_data = None

            # Submit success result
            ok = submit_result(
                conn, attempt_id, worker_id, True,
                alignment_data=alignment_data,
                gop_data=gop_data,
                asr_warning_flags=asr_warning_flags if asr_warning_flags else None,
                speech_ratio=speech_ratio,
            )
            log(f"✅ attempt {attempt_id} submitted: {ok}")

    except Exception as e:
        err = str(e)
        log(f"❌ attempt {attempt_id} failed: {err}")
        try:
            submit_result(
                conn, attempt_id, worker_id, False,
                error_message=err
            )
        except Exception as e2:
            log(f"❌ submit failure for {attempt_id}: {e2}")


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

    # Download models if configured
    download_mfa_models()

    log("🔄 Entering main loop...")

    while True:
        try:
            with db_connect() as conn:
                jobs = claim_jobs(conn, worker_id, batch_size)

                if not jobs:
                    time.sleep(poll_interval)
                    continue

                log(f"📥 Claimed {len(jobs)} job(s)")

                for job in jobs:
                    process_job(job, conn, worker_id, edge_base_url, worker_secret)

        except Exception as outer:
            log(f"🔥 Worker loop error: {outer}")
            time.sleep(2)


if __name__ == "__main__":
    main()
