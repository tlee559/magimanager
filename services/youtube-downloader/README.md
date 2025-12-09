# YouTube Downloader Service

A FastAPI service that wraps yt-dlp for downloading YouTube videos. Designed to run on Railway or any Docker-compatible platform.

## Why?

YouTube blocks requests from serverless environments (Vercel, AWS Lambda, etc.) due to IP reputation issues. This service runs on a dedicated server with better IP reputation.

## Endpoints

- `GET /health` - Health check
- `POST /info` - Get video metadata (title, description, formats)
- `POST /download-url` - Get direct stream URL
- `POST /download` - Download video and return file

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python server.py
```

Server starts at http://localhost:8080

## Test Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Get video info
curl -X POST http://localhost:8080/info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "api_key": "dev-key-change-me"}'

# Get download URL
curl -X POST http://localhost:8080/download-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "api_key": "dev-key-change-me", "quality": "720p"}'
```

## Deploy to Railway

1. Create account at https://railway.app
2. Install Railway CLI: `npm install -g @railway/cli`
3. Login: `railway login`
4. Initialize project: `railway init`
5. Set environment variable:
   ```bash
   railway variables set YOUTUBE_SERVICE_API_KEY=your-secure-key-here
   ```
6. Deploy: `railway up`

## Environment Variables

- `YOUTUBE_SERVICE_API_KEY` - API key for authentication (required)
- `PORT` - Server port (default: 8080)
- `HOST` - Server host (default: 0.0.0.0)
