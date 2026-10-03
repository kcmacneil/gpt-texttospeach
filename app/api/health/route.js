import { VOICE_NAME } from "../../../lib/eleven";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "gpt-texttospeach",
    voice: VOICE_NAME,
  });
}
