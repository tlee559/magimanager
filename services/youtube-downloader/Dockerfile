FROM python:3.12-slim

# Install ffmpeg for audio extraction
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY server.py .

# Create temp directory
RUN mkdir -p /tmp/youtube-downloads

# Expose port
EXPOSE 8080

# Run the server
CMD ["python", "server.py"]
