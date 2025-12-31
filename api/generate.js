/**
 * server.js - GROQ VERSION (STABLE)
 * Express backend for Luna / Kids3D Teacher
 * Gemini/OpenAI removed, Groq LLaMA added
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

// =========================
// CORS CONFIG (UNCHANGED)
// =========================
app.use(
  cors({
    origin: [
      "https://public-speaking-for-kids-v21.vercel.app",
      "https://public-speaking-for-kids2.vercel.app",
      "https://luna-frontend.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// Explicit preflight handlers
app.options("/api/chat", cors());
app.options("/api/generate", cors());
app.options("/api/tts", cors());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// =========================
// HEALTH CHECK (UNCHANGED)
// =========================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Luna backend is running",
    providers: {
      groq: !!process.env.GROQ_API_KEY,
    },
  });
});

// =========================
// TEXT EXTRACTION (UNCHANGED)
// =========================
function extractTextFromResponse(obj) {
  try {
    const msg = obj?.choices?.[0]?.message?.content;
    if (msg?.trim()) return msg.trim();
  } catch {}

  try {
    const txt = obj?.choices?.[0]?.text;
    if (txt?.trim()) return txt.trim();
  } catch {}

  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

// =========================
// SHARED CHAT HANDLER
// =========================
async function handleChatRequest(req, res) {
  const prompt = req.body?.prompt ?? req.body?.text;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Missing 'prompt' in request body.",
    });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "GROQ_API_KEY not configured",
    });
  }

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

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
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.75,
          max_tokens: 150, // 🔥 Reduced to enforce brevity
          top_p: 0.95,
        }),
      }
    );

    const json = await response.json().catch(() => null);
    console.log("📥 GROQ RAW RESPONSE:", JSON.stringify(json, null, 2));

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Groq API error",
        status: response.status,
        body: json,
      });
    }

    const reply = extractTextFromResponse(json);
    return res.json({ ok: true, reply: String(reply) });

  } catch (err) {
    console.error("Error calling Groq:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error calling Groq",
      details: String(err),
    });
  }
}

// =========================
// ROUTES (UNCHANGED)
// =========================
app.post("/api/chat", handleChatRequest);
app.post("/api/generate", handleChatRequest);

// =========================
// TTS ENDPOINT (UNCHANGED)
// =========================
app.post("/api/tts", async (req, res) => {
  const text = req.body?.text;
  if (!text) {
    return res.status(400).json({
      ok: false,
      error: "Missing 'text' in request body.",
    });
  }

  return res.status(501).json({
    ok: false,
    error: "TTS not implemented yet.",
    suggestion:
      "Use frontend speechSynthesis.speak() for MVP.",
  });
});

// =========================
// STATIC AUDIO (UNCHANGED)
// =========================
app.use("/audio", express.static(path.join(process.cwd(), "audio")));

// =========================
// VERCEL + LOCAL COMPAT
// =========================
export default app;

if (process.env.VERCEL === undefined) {
  app.listen(PORT, () => {
    console.log(
      `Server listening on http://localhost:${PORT}`
    );
  });
}