import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// =======================
// CORS (same behavior)
// =======================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
  })
);

app.use(express.json());

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Luna Your AI companion backend is running",
    providers: {
      groq: !!process.env.GROQ_API_KEY,
    },
  });
});

// =======================
// /api/generate (Groq)
// =======================
app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({
      ok: false,
      error: "Missing prompt",
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
        }),
      }
    );

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content || "No response";

    res.json({ ok: true, reply });

  } catch (error) {
    console.error("Groq error:", error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

export default app;
