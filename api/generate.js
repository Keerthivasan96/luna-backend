// ============================================
// api/generate.js - OPTIMIZED FOR GROQ LLaMA
// Ultra-low latency / Full responses
// ============================================

export default async function handler(req, res) {
  // --------------------
  // CORS
  // --------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --------------------
  // HEALTH CHECK
  // --------------------
  if (req.method === "GET") {
    return res.json({
      ok: true,
      provider: "groq",
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      endpoint: "generate",
      status: "ready",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // --------------------
  // INPUT
  // --------------------
  const prompt = req.body?.prompt;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }

  const temperature = req.body?.temperature ?? 0.8;
  const maxTokens = req.body?.max_tokens ?? 400;

  console.log(`📥 Prompt: ${prompt.substring(0, 60)}...`);
  console.log(`⚙️ temp=${temperature}, max=${maxTokens}`);

  // --------------------
  // ENV
  // --------------------
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GROQ_MODEL =
    process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  if (!GROQ_API_KEY) {
    console.error("❌ Missing GROQ_API_KEY");
    return res.status(500).json({ ok: false, error: "API key missing" });
  }

  // --------------------
  // GROQ API CALL
  // --------------------
  try {
    console.log(`🚀 Calling Groq (${GROQ_MODEL})`);

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: temperature,
          max_tokens: maxTokens,
          top_p: 0.95,
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Groq error ${response.status}:`, errText);
      return res.status(response.status).json({
        ok: false,
        error: `Groq API error ${response.status}`,
      });
    }

    const data = await response.json();
    const choice = data?.choices?.[0];

    if (!choice || !choice.message?.content) {
      console.error("❌ Empty Groq response");
      return res.status(500).json({
        ok: false,
        error: "Empty response from model",
      });
    }

    const reply = choice.message.content.trim();
    const finishReason = choice.finish_reason;

    if (!reply) {
      console.error("❌ Blank reply text");
      return res.status(500).json({
        ok: false,
        error: "Blank response",
      });
    }

    // --------------------
    // METRICS
    // --------------------
    const wordCount = reply.split(/\s+/).length;

    console.log(`✅ Response: ${wordCount} words`);
    console.log(`📝 "${reply.substring(0, 80)}..."`);

    return res.json({
      ok: true,
      reply,
      metadata: {
        model: GROQ_MODEL,
        wordCount,
        finishReason,
        tokensUsed: data.usage?.total_tokens || 0,
      },
    });

  } catch (err) {
    console.error("❌ Handler exception:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      message: err.message,
    });
  }
}
