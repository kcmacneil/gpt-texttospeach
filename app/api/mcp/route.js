import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import crypto from "node:crypto";
import {
  AUDIO_URL_TTL_SECONDS,
  buildAudioUrl,
  clientIp,
  rateLimitOk,
  validateText,
  VOICE_ID,
  VOICE_NAME,
} from "../../../lib/eleven";

// Remote MCP endpoint (Streamable HTTP) for AI clients such as ChatGPT.
// Auth: Authorization: Bearer <TTS_API_KEY> — same secret as the REST API.

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "generateSpeech",
      {
        description:
          "Convert text to spoken audio (MP3) using the ElevenLabs 'Kevin Mac' voice. Use this whenever the user asks to say, speak, narrate, read aloud, or convert text to speech with Kevin Mac. Returns a temporary URL where the MP3 can be played or downloaded.",
        inputSchema: z.object({
          text: z
            .string()
            .min(1)
            .max(5000)
            .describe("The text to convert to speech (max 5,000 characters)."),
        }),
      },
      async ({ text }, ctx) => {
        const trimmed = typeof text === "string" ? text.trim() : "";
        const invalid = validateText(trimmed);
        if (invalid) {
          return {
            isError: true,
            content: [{ type: "text", text: invalid }],
          };
        }
        const httpReq = ctx.requestInfo ?? ctx.request ?? null;
        if (!rateLimitOk(`mcp:${httpReq ? clientIp(httpReq) : "local"}`)) {
          return {
            isError: true,
            content: [
              { type: "text", text: "Too many requests. Please wait a moment." },
            ],
          };
        }

        const baseUrl =
          process.env.MCP_PUBLIC_BASE_URL ||
          (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : httpReq
              ? new URL(httpReq.url).origin
              : "http://localhost:3000");
        const { url, expiresAt } = buildAudioUrl(baseUrl, trimmed);
        const expiresAtIso = new Date(expiresAt * 1000).toISOString();

        return {
          structuredContent: {
            success: true,
            voice: VOICE_NAME,
            voice_id: VOICE_ID,
            audio_url: url,
            audio_format: "mp3",
            expires_at: expiresAtIso,
            expires_in: AUDIO_URL_TTL_SECONDS,
          },
          content: [
            {
              type: "text",
              text: `Speech generated with the ${VOICE_NAME} voice. Play or download the MP3 here (link expires ${expiresAtIso}):\n${url}`,
            },
          ],
        };
      }
    );
  },
  {},
  { basePath: "/api" }
);

function verifyToken(_req, bearerToken) {
  const expected = process.env.TTS_API_KEY;
  if (!expected || !bearerToken) return undefined;
  const a = Buffer.from(bearerToken);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return undefined;
  return { token: "tts", clientId: "tts-api-key", scopes: [] };
}

const handler = withMcpAuth(baseHandler, verifyToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
