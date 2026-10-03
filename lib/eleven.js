import crypto from "node:crypto";

export const VOICE_ID = "SZoOD4blOn3AcaCWHdwZ"; // Kevin Mac
export const VOICE_NAME = "Kevin Mac";
export const MODEL_ID = "eleven_v3";
export const MAX_CHARS = 5000;

export function validateText(text) {
  if (typeof text !== "string" || !text.trim()) {
    return "Text is required.";
  }
  if (text.length > MAX_CHARS) {
    return `Text must be ${MAX_CHARS} characters or fewer.`;
  }
  return null;
}

export async function generateSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { status: 500, error: "Text-to-speech service is not configured." };
  }

  let upstream;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            use_speaker_boost: true,
          },
        }),
      }
    );
  } catch {
    return {
      status: 502,
      error: "Could not reach the speech service. Please try again.",
    };
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(
      "ElevenLabs request failed:",
      upstream.status,
      detail.slice(0, 500)
    );
    return {
      status: 502,
      error: "Speech generation failed. Please try again.",
    };
  }

  return { status: 200, audio: await upstream.arrayBuffer() };
}

export function audioResponse(arrayBuffer) {
  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(arrayBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

// --- External API auth (Bearer TTS_API_KEY), timing-safe ---

export function isAuthorized(request) {
  const expected = process.env.TTS_API_KEY;
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const a = Buffer.from(match[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Signed temporary audio URLs (stateless; no storage needed) ---

export const AUDIO_URL_TTL_SECONDS = 3600;

export function signAudioRequest(text, expiresAt) {
  const key = process.env.TTS_API_KEY;
  return crypto
    .createHmac("sha256", key)
    .update(`${expiresAt}.${text}`)
    .digest("hex");
}

export function buildAudioUrl(baseUrl, text) {
  const expiresAt = Math.floor(Date.now() / 1000) + AUDIO_URL_TTL_SECONDS;
  const signature = signAudioRequest(text, expiresAt);
  const encoded = Buffer.from(text, "utf8").toString("base64url");
  const url = new URL("/api/audio", baseUrl);
  url.searchParams.set("d", encoded);
  url.searchParams.set("e", String(expiresAt));
  url.searchParams.set("s", signature);
  return { url: url.toString(), expiresAt };
}

export function verifyAudioRequest(text, expiresAt, signature) {
  if (Math.floor(Date.now() / 1000) > expiresAt) return false;
  const expected = signAudioRequest(text, expiresAt);
  const a = Buffer.from(signature || "");
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Best-effort in-memory rate limiting (per serverless instance) ---

const buckets = new Map();
const RATE_LIMIT = 30; // requests
const RATE_WINDOW_MS = 60_000;

export function rateLimitOk(key) {
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, reset: now + RATE_WINDOW_MS };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + RATE_WINDOW_MS;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (now > v.reset) buckets.delete(k);
    }
  }
  return bucket.count <= RATE_LIMIT;
}

export function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
