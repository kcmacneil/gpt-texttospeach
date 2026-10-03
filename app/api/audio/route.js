import {
  audioResponse,
  clientIp,
  generateSpeech,
  rateLimitOk,
  validateText,
  verifyAudioRequest,
} from "../../../lib/eleven";

// Serves MP3 for signed URLs issued by POST /api/generate-speech.
// Stateless: the signature proves the text was authorized; the audio is
// generated on demand so nothing needs persistent storage.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const encoded = searchParams.get("d");
  const expiresAt = Number(searchParams.get("e"));
  const signature = searchParams.get("s") || "";

  if (!encoded || !Number.isFinite(expiresAt) || !signature) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  let text;
  try {
    text = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const invalid = validateText(text);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  if (!verifyAudioRequest(text, expiresAt, signature)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!rateLimitOk(`audio:${clientIp(request)}`)) {
    return Response.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const result = await generateSpeech(text);
  if (result.error) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return audioResponse(result.audio);
}
