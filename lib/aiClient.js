// AI provider chain, tried in order until one succeeds:
//   1. Groq primary model    (free, fast, best quality of the three)
//   2. Groq fallback model   (smaller model, often a separate rate-limit
//                             pool, tried only if #1 was specifically
//                             rate-limited)
//   3. Local model            (your own machine, e.g. Ollama running a 7B
//                             model, reached through a tunnel URL) - tried
//                             if either Groq call fails for ANY reason,
//                             since it's a completely separate provider
//
// Groq's API is OpenAI-compatible (/chat/completions, system prompt inside
// the messages array, reply at choices[0].message.content). Ollama exposes
// the same OpenAI-compatible shape, so both providers share one request
// function below.
 
const GROQ_PRIMARY_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
 
// LOCAL_MODEL_URL is the public tunnel URL pointing at your local Ollama
// server (e.g. a Cloudflare Tunnel address), NOT localhost - Render can't
// reach your machine's localhost. Leave unset to disable this tier entirely.
const LOCAL_MODEL_URL = process.env.LOCAL_MODEL_URL; // e.g. https://your-tunnel.trycloudflare.com
const LOCAL_MODEL_NAME = process.env.LOCAL_MODEL_NAME || "qwen2.5:7b";
const LOCAL_MODEL_TIMEOUT_MS = 20000; // don't hang forever if the PC is off
 
const MOCK_MODE = !GROQ_API_KEY;
if (MOCK_MODE) {
  console.warn(
    "[aiClient] No GROQ_API_KEY set — running in MOCK MODE. " +
      "Responses are canned placeholders so you can see the product flow. " +
      "Set GROQ_API_KEY in .env for real tutoring responses."
  );
}
if (!LOCAL_MODEL_URL) {
  console.warn(
    "[aiClient] No LOCAL_MODEL_URL set — local model fallback tier is disabled. " +
      "Set it to your Ollama tunnel URL to enable a third fallback tier."
  );
}
 
// Strips the <profile_update>{...}</profile_update> block the system prompt
// asks the model to append, and parses it into an object the caller can use
// to update the student's stored learning profile.
function extractProfileUpdate(rawText) {
  const match = rawText.match(/<profile_update>([\s\S]*?)<\/profile_update>/);
  if (!match) return { studentText: rawText.trim(), profileUpdate: null };
 
  const studentText = rawText.slice(0, match.index).trim();
  let profileUpdate = null;
  try {
    profileUpdate = JSON.parse(match[1].trim());
  } catch (e) {
    console.warn("[aiClient] Could not parse profile_update block:", e.message);
  }
  return { studentText, profileUpdate };
}
 
// A rate-limit error (HTTP 429) means "try again / try something lighter."
class RateLimitedError extends Error {}
 
async function requestChatCompletion({ baseUrl, apiKey, model, systemPrompt, messages, timeoutMs }) {
  const controller = timeoutMs ? new AbortController() : null;
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
 
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
      signal: controller ? controller.signal : undefined,
    });
 
    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        throw new RateLimitedError(`Rate limited (model: ${model}): ${errText}`);
      }
      throw new Error(`API error ${response.status} (model: ${model}): ${errText}`);
    }
 
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    if (timer) clearTimeout(timer);
  }
}
 
async function requestFromGroq(model, systemPrompt, messages) {
  return requestChatCompletion({
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: GROQ_API_KEY,
    model,
    systemPrompt,
    messages,
  });
}
 
async function requestFromLocal(systemPrompt, messages) {
  return requestChatCompletion({
    baseUrl: `${LOCAL_MODEL_URL}/v1`,
    apiKey: process.env.LOCAL_MODEL_API_KEY || null, // optional, most local setups don't need one
    model: LOCAL_MODEL_NAME,
    systemPrompt,
    messages,
    timeoutMs: LOCAL_MODEL_TIMEOUT_MS,
  });
}
 
async function tryLocalOrThrow(originalErr, systemPrompt, messages) {
  if (!LOCAL_MODEL_URL) throw originalErr;
 
  console.warn(`[aiClient] Groq unavailable (${originalErr.message}) — trying local fallback model...`);
  try {
    const rawText = await requestFromLocal(systemPrompt, messages);
    return extractProfileUpdate(rawText);
  } catch (localErr) {
    console.warn(`[aiClient] Local fallback also failed: ${localErr.message}`);
    throw originalErr; // surface the original, more informative Groq error
  }
}
 
async function callTutor({ systemPrompt, messages }) {
  if (MOCK_MODE) {
    return mockResponse(messages);
  }
 
  try {
    const rawText = await requestFromGroq(GROQ_PRIMARY_MODEL, systemPrompt, messages);
    return extractProfileUpdate(rawText);
  } catch (err) {
    if (err instanceof RateLimitedError) {
      // Same provider, different (lighter) model - worth a direct retry.
      try {
        const rawText = await requestFromGroq(GROQ_FALLBACK_MODEL, systemPrompt, messages);
        return extractProfileUpdate(rawText);
      } catch (err2) {
        return await tryLocalOrThrow(err2, systemPrompt, messages);
      }
    }
    // Non-rate-limit error (auth issue, malformed request, Groq outage) -
    // retrying Groq's own smaller model won't help, so go straight to the
    // local tier instead.
    return await tryLocalOrThrow(err, systemPrompt, messages);
  }
}
 
// A deterministic canned response so the full product flow (UI, profile
// updates, memory) can be demoed/tested with zero API cost or key.
function mockResponse(messages) {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const topic = lastUserMsg ? lastUserMsg.content.slice(0, 60) : "this topic";
 
  const studentText =
    `[MOCK MODE — set GROQ_API_KEY for real responses]\n\n` +
    `Before we dive into "${topic}", quick check: on a scale of "never seen it" to "I can mostly do it," where are you right now?\n\n` +
    `Once I know that, I'll pitch the explanation at the right level instead of re-covering things you already know.\n\n` +
    `Next step: reply with where you're at, and we'll go from there.`;
 
  return {
    studentText,
    profileUpdate: null,
  };
}
 
module.exports = { callTutor, GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL, LOCAL_MODEL_URL, MOCK_MODE };
 