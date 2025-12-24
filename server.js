/**
 * server.js — FINAL STABLE VERSION
 * Express backend for Luna / Kids3D Teacher
 * Groq (LLaMA) backend — browser + Vercel compatible
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

// =======================================================
// ✅ CORS — SIMPLE + BULLETPROOF (DO NOT OVERTHINK)
// =======================================================
// IMPORTANT:
// - Browser preflight MUST succeed
// - Do NOT restrict origins while stabilizing
// - Old backend effectively behaved like this

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🔥 REQUIRED for browser preflight on Vercel
app.options("*", cors());

// =======================================================
// BODY PARSERS
// =======================================================
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// =======================================================
// HEALTH CHECK (ROOT)
// =======================================================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Luna backend is running",
    provider: "groq",
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  });
});

// =======================================================
// SAFE RESPONSE TEXT EXTRACTOR
// =======================================================
function extractTextFromResponse(obj) {
  try {
    const msg = obj?.choices?.[0]?.message?.content;
    if (msg?.trim()) return msg.trim();
  } catch {}

  try {
    const txt = obj?.choices?.[0]?.text;
    if (txt?.trim()) return txt.trim();
  } catch {}

  return "";
}

// =======================================================
// SHARED CHAT HANDLER
// (/api/chat + /api/generate)
// =======================================================
async function handleChatRequest(req, res) {
  const prompt = req.body?.prompt ?? req.body?.text;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Missing 'prompt' in request body",
    });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "GROQ_API_KEY not configured",
    });
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.85,
          max_tokens: 900,
          top_p: 0.95,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Groq API error",
        status: response.status,
        body: data,
      });
    }

    const reply = extractTextFromResponse(data);

    if (!reply) {
      return res.status(500).json({
        ok: false,
        error: "Empty response from model",
      });
    }

    return res.json({
      ok: true,
      reply,
    });

  } catch (err) {
    console.error("Groq request failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error calling Groq",
      details: String(err),
    });
  }
}

// =======================================================
// ROUTES
// =======================================================
app.post("/api/chat", handleChatRequest);
app.post("/api/generate", handleChatRequest);

// =======================================================
// TTS STUB (UNCHANGED)
// =======================================================
app.post("/api/tts", (req, res) => {
  res.status(501).json({
    ok: false,
    error: "TTS not implemented on backend",
    suggestion: "Use browser speechSynthesis",
  });
});

// =======================================================
// STATIC FILES (OPTIONAL)
// =======================================================
app.use("/audio", express.static(path.join(process.cwd(), "audio")));

// =======================================================
// EXPORT FOR VERCEL + LOCAL DEV
// =======================================================
export default app;

if (process.env.VERCEL === undefined) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
