# GPT Text to Speech

Simple Next.js app that converts text to speech with the ElevenLabs "Kevin Mac" voice (`SZoOD4blOn3AcaCWHdwZ`).

The browser never calls ElevenLabs directly — it posts to `/api/tts`, a server-side route that holds the API key and returns `audio/mpeg`.

## Setup

```bash
npm install
npm run dev
```

Set `ELEVENLABS_API_KEY` in `.env.local` for local development, or in the Vercel project environment variables for production. The key is never exposed to the client.

## Deploy

Push to `main`; Vercel builds and deploys automatically.

## API

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `POST /api/tts` | same-origin only | Browser UI (no token; rejects cross-origin requests) |
| `POST /api/generate-speech` | `Authorization: Bearer <TTS_API_KEY>` | External API for AI agents — returns JSON with a signed `audio_url` (expires in 1 h) |
| `GET /api/audio?d&e&s` | HMAC signature | Serves the MP3 for URLs issued by `/api/generate-speech` (stateless — regenerates on demand, no storage) |
| `GET /api/health` | none | `{"status":"ok","service":"gpt-texttospeach","voice":"Kevin Mac"}` |
| `GET /openapi.json` | none | OpenAPI 3.1 spec for the external API (`operationId: generateSpeech`) |

### Environment variables

- `ELEVENLABS_API_KEY` — server-side ElevenLabs credential (required)
- `TTS_API_KEY` — shared secret authorizing `/api/generate-speech`; generate one with `openssl rand -hex 32` and set it in Vercel (Production). Never committed.
- `VERCEL_PROJECT_PRODUCTION_URL` — set automatically by Vercel; used to build `audio_url`.

### External example

```powershell
$key = "<TTS_API_KEY>"
$body = @{ text = "Blablabla" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://gpt-texttospeach.vercel.app/api/generate-speech" `
    -Method Post -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $key" } -Body $body
```

Response:

```json
{
  "success": true,
  "voice": "Kevin Mac",
  "voice_id": "SZoOD4blOn3AcaCWHdwZ",
  "audio_url": "https://gpt-texttospeach.vercel.app/api/audio?d=...&e=...&s=...",
  "audio_format": "mp3",
  "expires_in": 3600
}
```

### ChatGPT (GPT Action)

1. Create/edit a Custom GPT → Actions → paste the contents of `https://gpt-texttospeach.vercel.app/openapi.json` as the schema.
2. Set Authentication → "API Key" → Bearer, and paste the `TTS_API_KEY` value.
3. ChatGPT calls `generateSpeech`, gets `audio_url`, and can link the user to the MP3.

## Example: ChatGPT → PowerShell → MP3

Use ChatGPT to write the script text, then pipe it into the API to get an MP3.

**1. ChatGPT prompt example**

> Write a warm, friendly 30-second welcome message for visitors arriving at a wellness retreat. Keep it to plain sentences — no markdown, no bullet points — so it can be read aloud by a text-to-speech voice.

Copy ChatGPT's output (or save it to a file, e.g. `speech.txt`).

**2. PowerShell script**

Save as `tts.ps1`:

```powershell
param(
    [string]$TextFile = "speech.txt",
    [string]$OutFile  = "speech.mp3",
    [string]$BaseUrl  = "https://gpt-texttospeach.vercel.app"
)

$apiKey = $env:TTS_API_KEY
if (-not $apiKey) {
    Write-Error "Set the TTS_API_KEY environment variable first."
    exit 1
}

$text = (Get-Content $TextFile -Raw).Trim()
if ([string]::IsNullOrEmpty($text)) {
    Write-Error "$TextFile is empty."
    exit 1
}
if ($text.Length -gt 5000) {
    Write-Error "Text exceeds the 5,000 character limit."
    exit 1
}

$body = @{ text = $text } | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/api/generate-speech" -Method Post `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $apiKey" } -Body $body
    Invoke-RestMethod -Uri $result.audio_url -OutFile $OutFile
    Write-Host "Saved $OutFile"
} catch {
    Write-Error "Generation failed: $($_.Exception.Message)"
    exit 1
}
```

Run it:

```powershell
$env:TTS_API_KEY = "<your TTS_API_KEY>"
.\tts.ps1 -TextFile speech.txt -OutFile welcome.mp3
```

For local development use `-BaseUrl "http://localhost:3000"`.
