const express = require("express");
const store = require("../db/store");
const { buildSystemPrompt } = require("../lib/systemPrompt");
const { callTutor } = require("../lib/aiClient");

const router = express.Router();

const VALID_ACTIONS = new Set(["learn", "doubt", "notes", "practice", "test"]);

// Applies the model's structured profile_update block onto the student's
// stored learning profile. This is what makes the platform "remember."
function applyProfileUpdate(studentId, update) {
  if (!update) return;

  store.updateProfile(studentId, (profile) => {
    if (update.learningStyle) {
      profile.learningStyle = update.learningStyle;
    }

    if (Array.isArray(update.newStrengths)) {
      for (const s of update.newStrengths) {
        if (s && !profile.strengths.includes(s)) profile.strengths.push(s);
      }
    }

    if (Array.isArray(update.newWeaknesses)) {
      for (const w of update.newWeaknesses) {
        if (w && !profile.weaknesses.includes(w)) profile.weaknesses.push(w);
      }
    }

    if (update.completedTopic && update.completedTopic.topic) {
      const already = profile.completedTopics.some(
        (t) => t.topic === update.completedTopic.topic && t.subject === update.completedTopic.subject
      );
      if (!already) {
        profile.completedTopics.push({
          subject: update.completedTopic.subject || "General",
          topic: update.completedTopic.topic,
          confidence: update.completedTopic.confidence || "medium",
          completedAt: new Date().toISOString(),
        });
      }
    }

    if (update.topicMastery && typeof update.topicMastery === "object") {
      for (const [key, delta] of Object.entries(update.topicMastery)) {
        const existing = profile.topicMastery[key] || { attempts: 0, correct: 0, confidence: 0.5 };
        const attempts = existing.attempts + (delta.delta_attempts || 0);
        const correct = existing.correct + (delta.delta_correct || 0);
        profile.topicMastery[key] = {
          attempts,
          correct,
          // Prefer the model's own confidence estimate if given; otherwise
          // derive it from the running accuracy so it stays sane.
          confidence:
            typeof delta.confidence === "number"
              ? delta.confidence
              : attempts > 0
              ? correct / attempts
              : existing.confidence,
          lastSeen: new Date().toISOString(),
        };
      }
    }

    return profile;
  });
}

router.post("/", async (req, res) => {
  const { action, topic, difficulty, count, messages } = req.body;

  if (!VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(", ")}` });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array (conversation so far) is required." });
  }

  const student = req.student;
  const institute = req.institute;
  const profile = store.getProfile(student.id);

  const systemPrompt = buildSystemPrompt({
    action,
    student,
    institute,
    profile,
    params: { topic, difficulty, count },
  });

  try {
    const { studentText, profileUpdate } = await callTutor({ systemPrompt, messages });
    applyProfileUpdate(student.id, profileUpdate);

    res.json({
      reply: studentText,
      profileUpdated: !!profileUpdate,
    });
  } catch (err) {
    console.error("[tutor route] error:", err);
    res.status(502).json({ error: "The AI tutor is temporarily unavailable. Please try again." });
  }
});

module.exports = router;
