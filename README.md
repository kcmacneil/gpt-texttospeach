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
