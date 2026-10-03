"use client";

import { useRef, useState } from "react";

const DEFAULT_TEXT =
  "Welcome to Hippocrates Wellness. We hope you have an amazing day filled with health, happiness, and transformation.";
const MAX_CHARS = 5000;

export default function Home() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  async function generate() {
    setError("");
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }
    if (text.length > MAX_CHARS) {
      setError(`Text must be ${MAX_CHARS} characters or fewer.`);
      return;
    }
    setLoading(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Speech generation failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>GPT Text to Speech</h1>
      <p className="voice">
        Voice: <strong>Kevin Mac</strong>
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={MAX_CHARS}
        placeholder="Type or paste the text you want to hear..."
        aria-label="Text to convert to speech"
      />
      <div className="meta">
        <span>
          {text.length} / {MAX_CHARS}
        </span>
      </div>

      <button onClick={generate} disabled={loading}>
        {loading ? "Generating…" : "Generate Audio"}
      </button>

      {loading && <div className="spinner" role="status" aria-live="polite" />}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {audioUrl && (
        <div className="result">
          <audio ref={audioRef} controls src={audioUrl}>
            Your browser does not support the audio element.
          </audio>
          <a className="download" href={audioUrl} download="kevin-mac-speech.mp3">
            Download MP3
          </a>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif;
          background: #0f172a;
          color: #e2e8f0;
        }
        .container {
          max-width: 720px;
          margin: 0 auto;
          padding: 48px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        h1 {
          margin: 0;
          font-size: 1.9rem;
        }
        .voice {
          margin: 0;
          color: #94a3b8;
        }
        textarea {
          width: 100%;
          padding: 14px;
          font-size: 1rem;
          border-radius: 10px;
          border: 1px solid #334155;
          background: #1e293b;
          color: #f1f5f9;
          resize: vertical;
        }
        textarea:focus {
          outline: 2px solid #38bdf8;
          border-color: transparent;
        }
        .meta {
          display: flex;
          justify-content: flex-end;
          font-size: 0.8rem;
          color: #64748b;
        }
        button {
          padding: 12px 18px;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          background: #38bdf8;
          color: #082f49;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .spinner {
          width: 22px;
          height: 22px;
          border: 3px solid #334155;
          border-top-color: #38bdf8;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .error {
          color: #fca5a5;
          margin: 0;
        }
        .result {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          border-radius: 10px;
          background: #1e293b;
          border: 1px solid #334155;
        }
        audio {
          width: 100%;
        }
        .download {
          display: inline-block;
          text-align: center;
          padding: 10px 16px;
          border-radius: 10px;
          background: #22c55e;
          color: #052e16;
          font-weight: 600;
          text-decoration: none;
        }
        @media (max-width: 480px) {
          .container {
            padding: 32px 14px;
          }
          h1 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </main>
  );
}
