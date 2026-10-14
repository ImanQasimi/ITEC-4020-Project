/* =========================================================
   QuizStack front-end mockup
   Everything under "MOCK SERVER" stands in for the Express API:
     GET  /api/quizzes          -> list quizzes
     GET  /api/quizzes/:id      -> questions (no correct answers!)
     POST /api/quizzes/:id/submit -> { score, total, results[], feedback }
   Swap each mock function for a fetch() call later; the UI code
   below doesn't need to change.
   ========================================================= */

/* ---------------- MOCK SERVER ---------------- */
const MOCK_DB = [
  {
    id: 1, title: "JavaScript Basics", subject: "Web Development", difficulty: "easy",
    description: "Variables, types and core language behaviour.",
    questions: [
      { id: 101, type: "multiple-choice", text: "Which keyword declares a block-scoped variable that can be reassigned?",
        options: ["var", "let", "const", "static"], answer: "let",
        explanation: "let is block-scoped and reassignable; const is block-scoped but cannot be reassigned." },
      { id: 102, type: "true-false", text: "In JavaScript, '5' === 5 evaluates to true.",
        options: ["True", "False"], answer: "False",
        explanation: "=== compares type and value. A string and a number are different types." },
      { id: 103, type: "multiple-choice", text: "What does Array.prototype.map() return?",
        options: ["The original array, modified", "A new array", "A single value", "undefined"], answer: "A new array",
        explanation: "map() builds and returns a new array without changing the original." },
      { id: 104, type: "short-answer", text: "What built-in function converts a JSON string into a JavaScript object?",
        answer: ["JSON.parse", "JSON.parse()"],
        explanation: "JSON.parse() turns JSON text into an object; JSON.stringify() does the reverse." },
    ],
  },
  {
    id: 2, title: "HTTP & Servers", subject: "Client-Server", difficulty: "medium",
    description: "Requests, responses and how a server handles them.",
    questions: [
      { id: 201, type: "multiple-choice", text: "Which HTTP status code means 'Not Found'?",
        options: ["200", "301", "404", "500"], answer: "404",
        explanation: "404 means the server can't find the requested resource." },
      { id: 202, type: "true-false", text: "A GET request should be used to submit sensitive data in the URL.",
        options: ["True", "False"], answer: "False",
        explanation: "URLs are logged and cached. Sensitive data belongs in a POST body over HTTPS." },
      { id: 203, type: "short-answer", text: "Which Node.js framework is used to define routes like app.get('/quiz')?",
        answer: ["express", "express.js", "expressjs"],
        explanation: "Express.js is a minimal Node framework for routing and middleware." },
      { id: 204, type: "multiple-choice", text: "Which HTTP method is most appropriate for submitting quiz answers?",
        options: ["GET", "POST", "HEAD", "OPTIONS"], answer: "POST",
        explanation: "POST sends data in the request body for the server to process." },
      { id: 205, type: "true-false", text: "The server should send correct answers to the client before the quiz is submitted.",
        options: ["True", "False"], answer: "False",
        explanation: "Scoring happens server-side so students can't read answers from the network tab." },
    ],
  },
  {
    id: 3, title: "SQL Fundamentals", subject: "Databases", difficulty: "hard",
    description: "Querying, joining and designing MySQL tables.",
    questions: [
      { id: 301, type: "multiple-choice", text: "Which clause filters rows after GROUP BY?",
        options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], answer: "HAVING",
        explanation: "WHERE filters rows before grouping; HAVING filters the groups." },
      { id: 302, type: "short-answer", text: "What SQL keyword removes duplicate rows from a SELECT result?",
        answer: ["distinct", "select distinct"],
        explanation: "SELECT DISTINCT returns only unique rows." },
      { id: 303, type: "true-false", text: "A PRIMARY KEY column can contain NULL values.",
        options: ["True", "False"], answer: "False",
        explanation: "Primary keys must be unique and non-null." },
    ],
  },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

async function mockFailIfRequested() {
  if ($("#sim-error").checked) throw new Error("Server error (500). The database could not be reached.");
}

async function apiGetQuizzes() {
  await delay(350); await mockFailIfRequested();
  return MOCK_DB.map(({ questions, ...q }) => ({ ...q, questionCount: questions.length }));
}

async function apiGetQuiz(id) {
  await delay(350); await mockFailIfRequested();
  const quiz = clone(MOCK_DB.find((q) => q.id === id));
  // The real server would never send answers/explanations here.
  quiz.questions.forEach((q) => { delete q.answer; delete q.explanation; });
  return quiz;
}

async function apiSubmit(id, answers) {
  await delay(1400); await mockFailIfRequested();
  if (!answers || typeof answers !== "object") throw new Error("Invalid submission (400).");
  const quiz = MOCK_DB.find((q) => q.id === id);
  const norm = (s) => String(s ?? "").trim().toLowerCase();

  const results = quiz.questions.map((q) => {
    const given = answers[q.id];
    const answered = given !== undefined && norm(given) !== "";
    const accepted = Array.isArray(q.answer) ? q.answer : [q.answer];
    const correct = answered && accepted.map(norm).includes(norm(given));
    return {
      id: q.id, text: q.text, type: q.type, answered, correct,
      yourAnswer: answered ? given : null,
      correctAnswer: accepted[0], explanation: q.explanation,
    };
  });

  const score = results.filter((r) => r.correct).length;
  const missed = results.filter((r) => !r.correct);
  const pct = Math.round((score / results.length) * 100);

  // Stand-in for the OpenAI call the real server will make.
  const feedback = {
    summary:
      pct === 100 ? "Perfect score. You clearly know this material well."
      : pct >= 70 ? "Solid work. You have a good grasp of most of this quiz."
      : pct >= 40 ? "A decent start, but a few core ideas need another look."
      : "This topic is still new to you, and that's okay. Let's build it up step by step.",
    tips: missed.slice(0, 3).map((r) => `Review: "${r.text}" — ${r.explanation}`),
    next: pct === 100 ? "Try a harder quiz to keep stretching yourself."
      : "Retake the quiz after reviewing the points above and aim to beat your score.",
  };

  return { score, total: results.length, results, feedback };
}

/* ---------------- UI ---------------- */
const $ = (s) => document.querySelector(s);
const state = { quizzes: [], quiz: null, answers: {}, index: 0, retry: null };
const TYPE_LABEL = { "multiple-choice": "Multiple choice", "true-false": "True / False", "short-answer": "Short answer" };

function show(view) {
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  window.scrollTo(0, 0);
}
function setLoading(on, text = "Loading…") {
  $("#loading").hidden = !on; $("#loading-text").textContent = text;
}
function showError(msg, retryFn) {
  $("#error-text").textContent = msg; state.retry = retryFn; $("#error-banner").hidden = false;
}
function clearError() { $("#error-banner").hidden = true; }

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  kids.flat().forEach((k) => n.append(k));
  return n;
}

/* ----- Home ----- */
async function loadHome() {
  clearError(); show("home"); setLoading(true, "Loading quizzes…");
  try {
    state.quizzes = await apiGetQuizzes();
    renderHome();
  } catch (e) { showError(e.message, loadHome); }
  finally { setLoading(false); }
}

function renderHome() {
  const grid = $("#quiz-grid"); grid.replaceChildren();
  state.quizzes.forEach((q) => {
    grid.append(
      el("article", { class: "quiz-card" },
        el("div", { class: "meta" },
          el("span", { class: `chip ${q.difficulty}` }, q.difficulty),
          el("span", { class: "chip" }, `${q.questionCount} questions`)),
        el("h3", {}, q.title),
        el("p", {}, q.description),
        el("button", { class: "btn", type: "button", onclick: () => startQuiz(q.id) }, "Start quiz →"))
    );
  });
}

/* ----- Quiz ----- */
async function startQuiz(id) {
  clearError(); setLoading(true, "Loading quiz…");
  try {
    state.quiz = await apiGetQuiz(id);
    state.answers = {}; state.index = 0;
    $("#quiz-title").textContent = state.quiz.title;
    $("#quiz-subject").textContent = state.quiz.subject;
    show("quiz"); renderQuestion();
  } catch (e) { showError(e.message, () => startQuiz(id)); }
  finally { setLoading(false); }
}

function renderQuestion() {
  const { quiz, index, answers } = state;
  const q = quiz.questions[index];
  const total = quiz.questions.length;
  const card = $("#question-card"); card.replaceChildren();

  card.append(
    el("span", { class: "chip qtype" }, TYPE_LABEL[q.type]),
    el("h3", {}, `${index + 1}. ${q.text}`)
  );

  if (q.type === "short-answer") {
    const input = el("input", { class: "short-answer", type: "text", placeholder: "Type your answer…", autocomplete: "off", "aria-label": "Your answer" });
    input.value = answers[q.id] ?? "";
    input.addEventListener("input", () => { setAnswer(q.id, input.value); updateChrome(); });
    card.append(input, el("p", { class: "hint" }, "Capitalization doesn't matter."));
  } else {
    const wrap = el("div", { class: "options", role: "radiogroup" });
    q.options.forEach((opt, i) => {
      const input = el("input", { type: "radio", name: `q${q.id}`, value: opt });
      input.checked = answers[q.id] === opt;
      input.addEventListener("change", () => { setAnswer(q.id, opt); updateChrome(); });
      wrap.append(el("label", { class: "option" }, input, el("span", { class: "key" }, String.fromCharCode(65 + i)), el("span", {}, opt)));
    });
    card.append(wrap);
  }
  updateChrome();
}

function setAnswer(id, val) {
  if (String(val).trim() === "") delete state.answers[id]; else state.answers[id] = val;
}

function updateChrome() {
  const { quiz, index, answers } = state;
  const total = quiz.questions.length;
  const done = quiz.questions.filter((q) => answers[q.id] !== undefined).length;

  $("#progress-bar").style.width = `${(done / total) * 100}%`;
  $("#progress-label").textContent = `Question ${index + 1} of ${total} · ${done} answered`;

  const nav = $("#qnav"); nav.replaceChildren();
  quiz.questions.forEach((q, i) => {
    const cls = ["qdot", answers[q.id] !== undefined ? "answered" : "", i === index ? "current" : ""].join(" ").trim();
    nav.append(el("button", { class: cls, type: "button", "aria-label": `Go to question ${i + 1}`, onclick: () => { state.index = i; renderQuestion(); } }, String(i + 1)));
  });

  $("#prev-btn").disabled = index === 0;
  $("#next-btn").textContent = index === total - 1 ? "Submit quiz ✓" : "Next →";
}

async function onNext() {
  const total = state.quiz.questions.length;
  if (state.index < total - 1) { state.index++; renderQuestion(); return; }
  const unanswered = state.quiz.questions.filter((q) => state.answers[q.id] === undefined).length;
  if (unanswered > 0) {
    $("#confirm-text").textContent = `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. They'll be marked incorrect.`;
    const dlg = $("#confirm-dialog");
    dlg.addEventListener("close", () => { if (dlg.returnValue === "ok") submit(); }, { once: true });
    dlg.showModal();
  } else submit();
}

async function submit() {
  clearError(); setLoading(true, "Scoring your answers and writing feedback…");
  try {
    const res = await apiSubmit(state.quiz.id, state.answers);
    renderResults(res);
  } catch (e) { showError(e.message, submit); }
  finally { setLoading(false); }
}

/* ----- Results ----- */
function renderResults({ score, total, results, feedback }) {
  const pct = Math.round((score / total) * 100);
  const ring = $("#score-ring");
  ring.className = "score-ring" + (pct < 40 ? " low" : pct < 70 ? " mid" : "");
  ring.style.setProperty("--pct", pct);
  $("#score-pct").textContent = `${pct}%`;
  $("#score-frac").textContent = `${score} / ${total} correct`;
  $("#results-title").textContent = state.quiz.title;
  $("#results-summary").textContent = pct >= 70 ? "Nice work!" : "Keep going, you're learning.";

  const ai = $("#ai-feedback"); ai.replaceChildren(el("p", {}, feedback.summary));
  if (feedback.tips.length) ai.append(el("ul", {}, feedback.tips.map((t) => el("li", {}, t))));
  ai.append(el("p", {}, feedback.next));

  const list = $("#breakdown"); list.replaceChildren();
  results.forEach((r, i) => {
    const status = !r.answered ? "skipped" : r.correct ? "right" : "wrong";
    const label = !r.answered ? "Unanswered" : r.correct ? "Correct" : "Incorrect";
    const dl = el("dl", {},
      el("dt", {}, "Your answer"), el("dd", {}, r.yourAnswer ?? "—"));
    if (!r.correct) dl.append(el("dt", {}, "Correct answer"), el("dd", {}, r.correctAnswer));
    list.append(el("article", { class: `result-item ${status}` },
      el("h4", {}, `${i + 1}. ${r.text}`, el("span", { class: "tag" }, label)),
      dl,
      el("p", { class: "why" }, r.explanation)));
  });
  show("results");
}

/* ----- Wiring ----- */
$("#next-btn").addEventListener("click", onNext);
$("#prev-btn").addEventListener("click", () => { if (state.index > 0) { state.index--; renderQuestion(); } });
$("#quit-btn").addEventListener("click", () => { if (confirm("Exit this quiz? Your answers will be lost.")) loadHome(); });
$("#retake-btn").addEventListener("click", () => startQuiz(state.quiz.id));
$("#home-btn").addEventListener("click", loadHome);
$("#brand").addEventListener("click", (e) => { e.preventDefault(); loadHome(); });
$("#error-retry").addEventListener("click", () => { clearError(); state.retry && state.retry(); });

loadHome();