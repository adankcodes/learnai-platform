const token = localStorage.getItem("token");
if (!token) window.location.href = "/index.html";

const student = JSON.parse(localStorage.getItem("student") || "{}");
const institute = JSON.parse(localStorage.getItem("institute") || "{}");

const ACTION_LABELS = {
  learn: "Learn a Topic",
  doubt: "Solve a Doubt",
  notes: "Revision Notes",
  practice: "Practice Questions",
  test: "Test Yourself",
};

const ACTION_PLACEHOLDER = {
  learn: "e.g. Quadratic Equations",
  doubt: "Describe what you're stuck on, e.g. 'I don't get why we flip the inequality sign'",
  notes: "e.g. Photosynthesis",
  practice: "e.g. Trigonometric Identities",
  test: "e.g. Newton's Laws of Motion",
};

let currentAction = null;
let conversation = []; // [{role: 'user'|'assistant', content: string}]

// ---------- Setup ----------

function applyBranding() {
  if (institute.brandColor) {
    document.documentElement.style.setProperty("--brand", institute.brandColor);
  }
  document.getElementById("institute-name").textContent = institute.name || "Your Institute";
  document.getElementById("institute-badge").textContent = (institute.logoText || "AI").slice(0, 2).toUpperCase();
  document.getElementById("student-name").textContent = student.name || "Student";
  document.getElementById("student-meta").textContent = `Class ${student.class || "-"} · ${student.board || "-"} · ${student.exam || "-"}`;
}

async function loadProfile() {
  const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const data = await res.json();
  renderProfile(data.profile);
}

function renderProfile(profile) {
  const strengthsEl = document.getElementById("strengths-list");
  const weaknessesEl = document.getElementById("weaknesses-list");
  const completedEl = document.getElementById("completed-list");

  strengthsEl.innerHTML = profile.strengths.length
    ? profile.strengths.map((s) => `<span class="chip strong">${escapeHtml(s)}</span>`).join("")
    : `<span class="empty">None yet</span>`;

  weaknessesEl.innerHTML = profile.weaknesses.length
    ? profile.weaknesses.map((w) => `<span class="chip weak">${escapeHtml(w)}</span>`).join("")
    : `<span class="empty">None yet</span>`;

  completedEl.innerHTML = profile.completedTopics.length
    ? profile.completedTopics.map((t) => `<span class="chip">${escapeHtml(t.topic)}</span>`).join("")
    : `<span class="empty">None yet</span>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Action selection ----------

document.querySelectorAll(".action-card").forEach((card) => {
  card.addEventListener("click", () => openSession(card.dataset.action));
});

document.getElementById("back-btn").addEventListener("click", closeSession);
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/index.html";
});

function openSession(action) {
  currentAction = action;
  conversation = [];

  document.getElementById("action-select").classList.add("hidden");
  document.getElementById("session-view").classList.remove("hidden");
  document.getElementById("session-title").textContent = ACTION_LABELS[action];
  document.getElementById("topic-input").value = "";
  document.getElementById("topic-input").placeholder = ACTION_PLACEHOLDER[action];

  document.getElementById("setup-form").classList.remove("hidden");
  document.getElementById("chat-thread").classList.add("hidden");
  document.getElementById("chat-thread").innerHTML = "";
  document.getElementById("chat-form").classList.add("hidden");

  document.getElementById("difficulty-row").classList.toggle("hidden", !(action === "practice" || action === "test"));
}

function closeSession() {
  document.getElementById("action-select").classList.remove("hidden");
  document.getElementById("session-view").classList.add("hidden");
  currentAction = null;
  conversation = [];
}

// ---------- Session flow ----------

document.getElementById("start-session-btn").addEventListener("click", async () => {
  const topic = document.getElementById("topic-input").value.trim();
  if (!topic) {
    document.getElementById("topic-input").focus();
    return;
  }

  document.getElementById("setup-form").classList.add("hidden");
  document.getElementById("chat-thread").classList.remove("hidden");
  document.getElementById("chat-form").classList.remove("hidden");

  const openingMessage = buildOpeningMessage(currentAction, topic);
  conversation.push({ role: "user", content: openingMessage });
  renderMessage("student", displayTextForOpening(currentAction, topic));

  await sendToTutor(topic);
});

document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  conversation.push({ role: "user", content: text });
  renderMessage("student", text);

  const topic = document.getElementById("topic-input").value.trim();
  await sendToTutor(topic);
});

function buildOpeningMessage(action, topic) {
  switch (action) {
    case "learn":
      return `I want to learn: ${topic}`;
    case "doubt":
      return topic;
    case "notes":
      return `Please generate revision notes for: ${topic}`;
    case "practice":
      return `Give me practice questions on: ${topic}`;
    case "test":
      return `I want to test myself on: ${topic}`;
    default:
      return topic;
  }
}

function displayTextForOpening(action, topic) {
  // Slightly friendlier text shown in the chat bubble than what's sent to the model.
  return buildOpeningMessage(action, topic);
}

async function sendToTutor(topic) {
  const difficulty = document.getElementById("difficulty-input").value;
  const count = document.getElementById("count-input").value;

  showTyping();
  try {
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: currentAction,
        topic,
        difficulty,
        count: Number(count),
        messages: conversation,
      }),
    });
    const data = await res.json();
    hideTyping();

    if (!res.ok) {
      renderMessage("system", data.error || "Something went wrong.");
      return;
    }

    conversation.push({ role: "assistant", content: data.reply });
    renderMessage("tutor", data.reply);

    if (data.profileUpdated) {
      loadProfile();
    }
  } catch (err) {
    hideTyping();
    renderMessage("system", "Network error — is the server running?");
  }
}

function renderMessage(role, text) {
  const thread = document.getElementById("chat-thread");
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

let typingEl = null;
function showTyping() {
  const thread = document.getElementById("chat-thread");
  typingEl = document.createElement("div");
  typingEl.className = "typing-indicator";
  typingEl.textContent = "Tutor is thinking...";
  thread.appendChild(typingEl);
  thread.scrollTop = thread.scrollHeight;
}
function hideTyping() {
  if (typingEl) {
    typingEl.remove();
    typingEl = null;
  }
}

// ---------- Init ----------

applyBranding();
loadProfile();
