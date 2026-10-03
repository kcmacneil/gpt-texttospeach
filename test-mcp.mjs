const BASE = process.env.MCP_URL || "http://localhost:3100/api/mcp";
const KEY = process.env.TTS_API_KEY || "localtestkey123";

async function rpc(method, params, key = KEY) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const ct = res.headers.get("content-type") || "";
  let payload;
  if (ct.includes("text/event-stream")) {
    const raw = await res.text();
    const dataLine = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    payload = JSON.parse(dataLine);
  } else {
    payload = await res.json().catch(() => null);
  }
  return { status: res.status, payload };
}

const initParams = {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "test-client", version: "0.0.1" },
};

function report(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

// 1. Unauthorized: no token
let r = await rpc("initialize", initParams, null);
report("initialize without token rejected", r.status === 401 || r.status === 403, `status=${r.status}`);

// 2. Unauthorized: bad token
r = await rpc("initialize", initParams, "wrong-key");
report("initialize with bad token rejected", r.status === 401 || r.status === 403, `status=${r.status}`);

// 3. initialize with token
r = await rpc("initialize", initParams);
report("initialize with token", r.status === 200 && r.payload?.result?.serverInfo, `status=${r.status}`);

// notifications/initialized
const headers = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  Authorization: `Bearer ${KEY}`,
};
await fetch(BASE, {
  method: "POST",
  headers,
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
});

// 4. tools/list
r = await rpc("tools/list", {});
const tools = r.payload?.result?.tools || [];
const gen = tools.find((t) => t.name === "generateSpeech");
report("tools/list exposes generateSpeech", !!gen, gen ? `schema required: ${JSON.stringify(gen.inputSchema?.required)}` : JSON.stringify(tools.map((t) => t.name)));

// 5. valid call
r = await rpc("tools/call", { name: "generateSpeech", arguments: { text: "hello" } });
const sc = r.payload?.result?.structuredContent;
report(
  "generateSpeech('hello') returns audio_url",
  !!sc?.audio_url && sc.voice_id === "SZoOD4blOn3AcaCWHdwZ",
  sc ? `voice=${sc.voice} expires_in=${sc.expires_in}` : JSON.stringify(r.payload).slice(0, 200)
);
const textContent = r.payload?.result?.content?.find((c) => c.type === "text");
report("text content includes the audio URL", !!textContent?.text?.includes(sc?.audio_url || "\u0000"));

// 6. audio_url fetchable (will hit ElevenLabs; locally expect 502 without key, 200 in prod)
if (sc?.audio_url) {
  const audioRes = await fetch(sc.audio_url, { redirect: "manual" });
  const ct = audioRes.headers.get("content-type");
  // 200 = MP3 served; 500/502 = signature accepted, upstream unavailable (e.g. no ELEVENLABS_API_KEY locally)
  report(
    "audio_url reachable and signature accepted",
    [200, 500, 502].includes(audioRes.status),
    `status=${audioRes.status} content-type=${ct}`
  );
}

// 7. invalid input: empty text
r = await rpc("tools/call", { name: "generateSpeech", arguments: { text: "" } });
report(
  "empty text returns error result",
  r.payload?.result?.isError === true || r.payload?.error,
  JSON.stringify(r.payload).slice(0, 160)
);

// 8. invalid input: missing text
r = await rpc("tools/call", { name: "generateSpeech", arguments: {} });
report("missing text rejected", r.payload?.result?.isError === true || r.payload?.error != null);

// 9. call with bad token
r = await rpc("tools/call", { name: "generateSpeech", arguments: { text: "hi" } }, "wrong-key");
report("tools/call with bad token rejected", r.status === 401 || r.status === 403, `status=${r.status}`);
