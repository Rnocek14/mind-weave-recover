# Dockerfile
FROM mmcauliffe/montreal-forced-aligner:latest

# MFA image includes conda; we'll install our worker deps cleanly.
SHELL ["/bin/bash", "-lc"]

# Create a working directory
WORKDIR /app

# Install system utilities we need (ffmpeg for audio conversion)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python deps into the conda python
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

# Copy worker code
COPY worker.py /app/worker.py

# Create runtime dirs
RUN mkdir -p /data/jobs /data/tmp

ENV PYTHONUNBUFFERED=1

# Optional: expose health port if you add a tiny health server later
EXPOSE 8080

CMD ["python", "/app/worker.py"]
