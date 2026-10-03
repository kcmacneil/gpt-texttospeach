import {
  audioResponse,
  clientIp,
  generateSpeech,
  rateLimitOk,
  validateText,
} from "../../../lib/eleven";

// Browser UI endpoint. Not a public API: same-origin requests only, so
// external tools must use POST /api/generate-speech with Bearer auth.
function isSameOrigin(request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!rateLimitOk(`ui:${clientIp(request)}`)) {
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

  const result = await generateSpeech(text);
  if (result.error) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return audioResponse(result.audio);
}
