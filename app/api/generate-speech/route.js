import {
  AUDIO_URL_TTL_SECONDS,
  buildAudioUrl,
  clientIp,
  isAuthorized,
  rateLimitOk,
  validateText,
  VOICE_ID,
  VOICE_NAME,
} from "../../../lib/eleven";

// External API for AI agents (e.g. ChatGPT GPT Actions).
// Auth: Authorization: Bearer <TTS_API_KEY>
// Returns JSON with a signed, expiring audio URL (stateless — no storage).

export async function POST(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!rateLimitOk(`api:${clientIp(request)}`)) {
    return Response.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  let text;
  try {
    const body = await request.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const invalid = validateText(text);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : new URL(request.url).origin;
  const { url, expiresAt } = buildAudioUrl(baseUrl, text);

  return Response.json({
    success: true,
    voice: VOICE_NAME,
    voice_id: VOICE_ID,
    audio_url: url,
    audio_format: "mp3",
    expires_at: new Date(expiresAt * 1000).toISOString(),
    expires_in: AUDIO_URL_TTL_SECONDS,
  });
}

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
