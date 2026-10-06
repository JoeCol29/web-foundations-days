const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// ── Update counters & classes ──────────────────────────
function updateCounts() {
  const text = noteText.value;
  const chars = text.length;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  charCount.textContent = `${chars} / 200 characters`;
  wordCount.textContent = `${words} word${words !== 1 ? "s" : ""}`;

  // Remove existing classes first
  charCount.classList.remove("warning", "over");

  if (chars > 200) {
    charCount.classList.add("over");
  } else if (chars > 180) {
    charCount.classList.add("warning");
  }
}

// ── Save / load draft ──────────────────────────────────
function saveDraft() {
  localStorage.setItem("note-draft", noteText.value);
}

function loadDraft() {
  const draft = localStorage.getItem("note-draft");
  if (draft !== null) {
    noteText.value = draft;
  }
}

function removeDraft() {
  localStorage.removeItem("note-draft");
}

// ── Theme toggle ───────────────────────────────────────
function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  themeToggle.textContent = dark ? "Light mode" : "Dark mode";
  localStorage.setItem("note-theme", dark ? "dark" : "light");
}

function loadTheme() {
  const theme = localStorage.getItem("note-theme");
  if (theme === "dark") {
    setTheme(true);
  } else {
    setTheme(false);
  }
}

// ── Clear everything ───────────────────────────────────
function clearAll() {
  noteText.value = "";
  removeDraft();
  updateCounts();
}

// ── Event listeners ────────────────────────────────────

// Input: update counts, save draft
noteText.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

// Escape key inside textarea: clear
noteText.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    clearAll();
  }
});

// Clear button
clearBtn.addEventListener("click", clearAll);

// Theme toggle button
themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark");
  setTheme(!isDark);
});

// ── On page load ───────────────────────────────────────
loadDraft();
loadTheme();
updateCounts();
