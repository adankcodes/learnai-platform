const tabs = document.querySelectorAll(".tab-btn");
const forms = { login: document.getElementById("login-form"), register: document.getElementById("register-form") };

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(forms).forEach((f) => f.classList.add("hidden"));
    forms[btn.dataset.tab].classList.remove("hidden");
  });
});

function handleAuthSuccess(data) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("student", JSON.stringify(data.student));
  localStorage.setItem("institute", JSON.stringify(data.institute));
  window.location.href = "/dashboard.html";
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed.");
    handleAuthSuccess(data);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());

  try {
    const res = await fetch("/api/auth/register-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed.");
    handleAuthSuccess(data);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
