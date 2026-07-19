// Talks to Groq (https://groq.com) instead of Anthropic's API.
// Groq exposes an OpenAI-compatible /chat/completions endpoint, which is a
// different request/response shape than Anthropic's /v1/messages — notably:
//   - the system prompt goes IN the messages array (role: "system"), not as
//     a separate top-level field
//   - the reply comes back at data.choices[0].message.content, not
//     data.content[array of blocks]
// Everything else about the product (the pedagogy in systemPrompt.js, the
// profile_update memory mechanism) is provider-agnostic and unchanged.
//
// FALLBACK MODEL: if the primary model is rate-limited, we automatically
// retry once with a smaller/faster model. Different Groq models often draw
// from separate rate-limit pools, so this genuinely improves availability
// for students during heavy usage, without needing any new provider,
// account, or local machine — it stays live on the same deployed server
// everyone is already using.

const PRIMARY_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
const API_KEY = process.env.GROQ_API_KEY;

const MOCK_MODE = !API_KEY;
if (MOCK_MODE) {
  console.warn(
    "[aiClient] No GROQ_API_KEY set — running in MOCK MODE. " +
      "Responses are canned placeholders so you can see the product flow. " +
      "Set GROQ_API_KEY in .env for real tutoring responses."
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
// Any other error (auth failure, malformed request, Groq outage) won't be
// fixed by switching models, so we don't waste a second call on those.
class RateLimitedError extends Error {}

async function requestFromGroq(model, systemPrompt, messages) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) {
      throw new RateLimitedError(`Groq API rate limited (model: ${model}): ${errText}`);
    }
    throw new Error(`Groq API error ${response.status} (model: ${model}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callTutor({ systemPrompt, messages }) {
  if (MOCK_MODE) {
    return mockResponse(messages);
  }

  try {
    const rawText = await requestFromGroq(PRIMARY_MODEL, systemPrompt, messages);
    return extractProfileUpdate(rawText);
  } catch (err) {
    if (!(err instanceof RateLimitedError)) {
      throw err; // not a rate-limit issue — a fallback model won't help
    }
    console.warn(
      `[aiClient] Primary model rate-limited, retrying with fallback model "${FALLBACK_MODEL}"...`
    );
    const rawText = await requestFromGroq(FALLBACK_MODEL, systemPrompt, messages);
    return extractProfileUpdate(rawText);
    // If the fallback model ALSO fails, that error propagates up to the
    // route handler as-is, which already responds with a graceful
    // "temporarily unavailable" message instead of crashing.
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

module.exports = { callTutor, PRIMARY_MODEL, FALLBACK_MODEL, MOCK_MODE };