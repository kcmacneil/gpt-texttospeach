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
    Invoke-RestMethod -Uri "$BaseUrl/api/tts" -Method Post `
        -ContentType "application/json" -Body $body -OutFile $OutFile
    Write-Host "Saved $OutFile"
} catch {
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Error "Generation failed: $($reader.ReadToEnd())"
    exit 1
}
```

Run it:

```powershell
.\tts.ps1 -TextFile speech.txt -OutFile welcome.mp3
```

Or with inline text instead of a file:

```powershell
$body = @{ text = "Welcome to Hippocrates Wellness." } | ConvertTo-Json
Invoke-RestMethod -Uri "https://gpt-texttospeach.vercel.app/api/tts" `
    -Method Post -ContentType "application/json" -Body $body -OutFile welcome.mp3
```

For local development use `-BaseUrl "http://localhost:3000"`.
