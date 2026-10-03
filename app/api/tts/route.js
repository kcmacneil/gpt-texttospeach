const VOICE_ID = "SZoOD4blOn3AcaCWHdwZ"; // Kevin Mac
const MODEL_ID = "eleven_v3";
const MAX_CHARS = 5000;

export async function POST(request) {
  let text;
  try {
    const body = await request.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: "Text is required." }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return Response.json(
      { error: `Text must be ${MAX_CHARS} characters or fewer.` },
      { status: 400 }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Text-to-speech service is not configured." },
      { status: 500 }
    );
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
    return Response.json(
      { error: "Could not reach the speech service. Please try again." },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(
      "ElevenLabs request failed:",
      upstream.status,
      detail.slice(0, 500)
    );
    return Response.json(
      { error: "Speech generation failed. Please try again." },
      { status: 502 }
    );
  }

  const audio = await upstream.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
