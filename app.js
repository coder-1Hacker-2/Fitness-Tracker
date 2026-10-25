const STORAGE_KEY = "form-function-exercise-tracker-v1";
const palette = ["#70977a", "#d88a61", "#8a9a63", "#678b91", "#b97d82"];
const defaultRoutines = [
  { id: "strength", name: "Full body strength", category: "STRENGTH", description: "A little bit of everything, built for balance.", duration: 45, color: palette[0] },
  { id: "run", name: "Easy run", category: "CARDIO", description: "Find your pace and let the miles unfold.", duration: 30, color: palette[1] },
  { id: "mobility", name: "Mobility reset", category: "RECOVERY", description: "Make space to move a little more freely.", duration: 20, color: palette[2] },
];
const today = new Date();
const state = loadState();
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.routines) && Array.isArray(saved.workouts)) return saved;
  } catch (error) {
    console.warn("Could not load saved workout data.", error);
  }
  return { routines: defaultRoutines.map((routine) => ({ ...routine })), workouts: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    showToast("Could not save data in this browser.");
    console.error("Could not save workout data.", error);
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString, options = { month: "short", day: "numeric" }) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, options);
}

function getWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function workoutsInRange(workouts, start, end) {
  return workouts.filter((workout) => {
    const date = new Date(`${workout.date}T12:00:00`);
    return date >= start && date <= end;
  });
}

function render() {
  renderDateLabels();
  renderWeek();
  renderStats();
  renderRoutines();
  renderRecent();
  renderHistory();
  renderProgress();
  updateRoutineOptions();
}

function renderDateLabels() {
  document.getElementById("todayLabel").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const start = getWeekStart(today);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  document.getElementById("weekDateRange").textContent = `${formatDate(localDateString(start))} – ${formatDate(localDateString(end), { month: "short", day: "numeric", year: "numeric" })}`;
}

function renderWeek() {
  const start = getWeekStart(today);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const weekWorkouts = workoutsInRange(state.workouts, start, new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59));
  document.getElementById("weekWorkoutCount").textContent = weekWorkouts.length;
  document.getElementById("weekDays").innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = localDateString(date);
    const isToday = dateKey === localDateString(today);
    const worked = weekWorkouts.some((workout) => workout.date === dateKey);
    return `<div class="day-cell${isToday ? " today" : ""}${worked ? " worked" : ""}" aria-label="${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${worked ? ", workout logged" : ""}"><span>${date.toLocaleDateString(undefined, { weekday: "short" })}</span><strong>${date.getDate()}</strong></div>`;
  }).join("");
}

function getBestStreak() {
  const dates = [...new Set(state.workouts.map((workout) => workout.date))].sort();
  let best = 0;
  let current = 0;
  let previous;
  dates.forEach((dateString) => {
    const date = new Date(`${dateString}T12:00:00`);
    if (previous && (date - previous) / 86400000 === 1) current += 1;
    else current = 1;
    best = Math.max(best, current);
    previous = date;
  });
  return best;
}

function renderStats() {
  const start = getWeekStart(today);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  const weekWorkouts = workoutsInRange(state.workouts, start, end);
  const minutes = weekWorkouts.reduce((total, workout) => total + Number(workout.duration), 0);
  const streak = getBestStreak();
  const cards = [
    { icon: "◷", label: "TIME THIS WEEK", value: `${minutes} min` },
    { icon: "↗", label: "SESSIONS THIS WEEK", value: weekWorkouts.length },
    { icon: "✳", label: "BEST STREAK", value: `${streak} ${streak === 1 ? "day" : "days"}` },
  ];
  document.getElementById("statsGrid").innerHTML = cards.map((card) => `<div class="stat-card"><div class="stat-icon" aria-hidden="true">${card.icon}</div><div class="stat-copy"><span>${card.label}</span><strong>${card.value}</strong></div></div>`).join("");
  document.getElementById("historySummary").textContent = `${state.workouts.length} ${state.workouts.length === 1 ? "session" : "sessions"} logged`;
}

function routineCard(routine) {
  const count = state.workouts.filter((workout) => workout.routineId === routine.id).length;
  return `<article class="routine-card" style="--routine-color:${escapeHTML(routine.color)}"><div class="routine-top"><span class="routine-category"><i></i>${escapeHTML(routine.category)}</span><button class="more-button" data-delete-routine="${escapeHTML(routine.id)}" aria-label="Delete ${escapeHTML(routine.name)}" title="Delete routine">···</button></div><h3>${escapeHTML(routine.name)}</h3><p>${escapeHTML(routine.description || "A routine you made for yourself.")}</p><div class="routine-meta"><span>◷ ${Number(routine.duration) || 30} min</span><span>↗ ${count} ${count === 1 ? "session" : "sessions"}</span><button class="routine-start" data-start-routine="${escapeHTML(routine.id)}">Start →</button></div></article>`;
}

function renderRoutines() {
  const markup = state.routines.length ? state.routines.map(routineCard).join("") : `<div class="empty-state"><strong>No routines yet</strong>Create your first routine to plan your next session.</div>`;
  document.getElementById("dashboardRoutines").innerHTML = markup;
  document.getElementById("allRoutines").innerHTML = markup;
  document.getElementById("routineNav").innerHTML = state.routines.slice(0, 5).map((routine) => `<button class="routine-nav-button" data-start-routine="${escapeHTML(routine.id)}"><i class="routine-dot" style="--routine-color:${escapeHTML(routine.color)}"></i>${escapeHTML(routine.name)}</button>`).join("");
}

function workoutRow(workout) {
  const routine = state.routines.find((item) => item.id === workout.routineId);
  return `<div class="activity-row"><div class="activity-mark" aria-hidden="true">↗</div><div class="activity-details"><strong>${escapeHTML(workout.name)}</strong><span>${escapeHTML(routine?.name || workout.routineName || "Personal workout")}${workout.notes ? ` · ${escapeHTML(workout.notes)}` : ""}</span></div><span class="activity-duration">${Number(workout.duration)} min</span></div>`;
}

function renderRecent() {
  const recent = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 4);
  document.getElementById("recentActivity").innerHTML = recent.length ? `<div class="activity-list">${recent.map(workoutRow).join("")}</div>` : `<div class="empty-state"><strong>Your story starts here.</strong>Log your first workout and it will show up right here.</div>`;
}

function renderHistory() {
  const filter = document.getElementById("historyFilter").value;
  const now = new Date();
  let filtered = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (filter === "week") filtered = workoutsInRange(filtered, getWeekStart(now), new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
  if (filter === "month") filtered = filtered.filter((workout) => workout.date.slice(0, 7) === localDateString(now).slice(0, 7));
  if (!filtered.length) {
    document.getElementById("historyList").innerHTML = `<div class="empty-state"><strong>No workouts to show</strong>Log a session and your history will build itself.</div>`;
    return;
  }
  const groups = new Map();
  filtered.forEach((workout) => {
    if (!groups.has(workout.date)) groups.set(workout.date, []);
    groups.get(workout.date).push(workout);
  });
  document.getElementById("historyList").innerHTML = [...groups.entries()].map(([date, workouts]) => `<div class="history-day-label">${formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</div>${workouts.map(workoutRow).join("")}`).join("");
}

function renderProgress() {
  const period = document.getElementById("progressPeriod").value;
  const now = new Date();
  let workouts = [...state.workouts];
  if (period === "week") workouts = workoutsInRange(workouts, getWeekStart(now), new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
  if (period === "month") workouts = workouts.filter((workout) => workout.date.slice(0, 7) === localDateString(now).slice(0, 7));
  const minutes = workouts.reduce((total, workout) => total + Number(workout.duration), 0);
  const activeWeeks = new Set(workouts.map((workout) => localDateString(getWeekStart(new Date(`${workout.date}T12:00:00`))))).size;
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
  const periodLabel = period === "all" ? " all time" : period === "week" ? " this week" : " this month";
  document.getElementById("progressSummary").innerHTML = `<div class="progress-stat"><span>Sessions${periodLabel}</span><strong>${workouts.length}</strong></div><div class="progress-stat"><span>Time invested</span><strong>${time}</strong></div><div class="progress-stat"><span>Active weeks</span><strong>${activeWeeks}</strong></div>`;
  renderProgressChart(workouts, period, now);
  const counts = state.routines.map((routine) => ({ routine, count: workouts.filter((workout) => workout.routineId === routine.id).length })).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...counts.map((item) => item.count));
  document.getElementById("routineBreakdown").innerHTML = counts.length ? counts.map(({ routine, count }) => `<div class="breakdown-row"><span class="breakdown-name">${escapeHTML(routine.name)}</span><div class="breakdown-track"><div class="breakdown-fill" style="width:${count ? Math.max(4, count / max * 100) : 0}%;background:${escapeHTML(routine.color)}"></div></div><span class="breakdown-count">${count} ${count === 1 ? "session" : "sessions"}</span></div>`).join("") : `<div class="empty-state">Create a routine to see your training breakdown.</div>`;
}

function renderProgressChart(workouts, period, now) {
  const container = document.getElementById("progressChart");
  if (!workouts.length) {
    container.innerHTML = `<div class="chart-empty">Your sessions will shape this chart.</div>`;
    return;
  }
  const buckets = [];
  if (period === "week") {
    const start = getWeekStart(now);
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      buckets.push({ label: date.toLocaleDateString(undefined, { weekday: "short" }), key: localDateString(date) });
    }
  } else if (period === "month") {
    const numberOfDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let index = 1; index <= numberOfDays; index += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), index);
      buckets.push({ label: `${index}`, key: localDateString(date) });
    }
  } else {
    for (let offset = 7; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({ label: date.toLocaleDateString(undefined, { month: "short" }), key: localDateString(date).slice(0, 7), month: true });
    }
  }
  const values = buckets.map((bucket) => workouts.filter((workout) => bucket.month ? workout.date.slice(0, 7) === bucket.key : workout.date === bucket.key).length);
  const max = Math.max(3, ...values);
  const left = 25, right = 688, top = 16, bottom = 167;
  const step = buckets.length > 1 ? (right - left) / (buckets.length - 1) : 0;
  const points = values.map((value, index) => ({ x: left + index * step, y: bottom - (value / max) * (bottom - top), value }));
  const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const labels = buckets.map((bucket, index) => `<text x="${left + index * step}" y="195" text-anchor="middle">${escapeHTML(bucket.label)}</text>`).join("");
  const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#29694f" stroke="white" stroke-width="2"><title>${point.value} ${point.value === 1 ? "session" : "sessions"}</title></circle>`).join("");
  const grid = [0, 1, 2, 3].map((index) => {
    const y = top + index * ((bottom - top) / 3);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#edf0ec"/><text x="0" y="${y + 4}" text-anchor="start">${Math.round(max * (3 - index) / 3)}</text>`;
  }).join("");
  container.innerHTML = `<svg viewBox="0 0 700 205" role="img" aria-label="Workout sessions over time">${grid}<path d="${line}" fill="none" stroke="#29694f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

function updateRoutineOptions() {
  const select = document.getElementById("workoutType");
  const current = select.value;
  select.innerHTML = `<option value="">Personal workout</option>${state.routines.map((routine) => `<option value="${escapeHTML(routine.id)}">${escapeHTML(routine.name)}</option>`).join("")}`;
  if (state.routines.some((routine) => routine.id === current)) select.value = current;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openLogModal(routine) {
  const form = document.getElementById("workoutForm");
  form.reset();
  document.getElementById("workoutDate").value = localDateString(today);
  document.getElementById("formError").textContent = "";
  updateRoutineOptions();
  document.getElementById("modalTitle").textContent = routine ? `Log ${routine.name}` : "Log a workout";
  document.getElementById("workoutName").value = routine?.name || "";
  document.getElementById("workoutDuration").value = routine?.duration || "";
  document.getElementById("workoutType").value = routine?.id || "";
  document.getElementById("modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("workoutName").focus();
}

function closeLogModal() {
  document.getElementById("modalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

function createRoutine() {
  const name = window.prompt("What would you like to call this routine?");
  if (!name || !name.trim()) return;
  const cleanName = name.trim().slice(0, 50);
  if (state.routines.some((routine) => routine.name.toLowerCase() === cleanName.toLowerCase())) {
    showToast("You already have a routine with that name.");
    return;
  }
  state.routines.push({ id: `routine-${Date.now()}`, name: cleanName, category: "PERSONAL", description: "A routine you made for yourself.", duration: 30, color: palette[state.routines.length % palette.length] });
  saveState();
  render();
  showToast("Routine created.");
}

function deleteRoutine(id) {
  const routine = state.routines.find((item) => item.id === id);
  if (!routine || !window.confirm(`Delete "${routine.name}"? Logged workouts will stay in your history.`)) return;
  state.routines = state.routines.filter((item) => item.id !== id);
  saveState();
  render();
  showToast("Routine deleted.");
}

function navigate(viewName) {
  const names = { dashboard: "Dashboard", routines: "My routines", history: "Workout history", progress: "Progress" };
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
  document.getElementById(`${viewName}View`).classList.add("active-view");
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  document.getElementById("breadcrumbCurrent").textContent = names[viewName];
  document.getElementById("sidebar").classList.remove("open");
  if (viewName === "history") renderHistory();
  if (viewName === "progress") renderProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
document.querySelectorAll("[data-navigate]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.navigate)));
document.getElementById("logWorkoutButton").addEventListener("click", () => openLogModal());
document.querySelectorAll("[data-open-log]").forEach((button) => button.addEventListener("click", () => openLogModal()));
document.getElementById("focusStartButton").addEventListener("click", () => openLogModal());
document.getElementById("newRoutineButton").addEventListener("click", createRoutine);
document.getElementById("addRoutinePageButton").addEventListener("click", createRoutine);
document.getElementById("mobileMenuButton").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
document.getElementById("historyFilter").addEventListener("change", renderHistory);
document.getElementById("progressPeriod").addEventListener("change", renderProgress);
document.getElementById("closeModalButton").addEventListener("click", closeLogModal);
document.getElementById("cancelModalButton").addEventListener("click", closeLogModal);
document.getElementById("modalBackdrop").addEventListener("click", (event) => { if (event.target.id === "modalBackdrop") closeLogModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !document.getElementById("modalBackdrop").hidden) closeLogModal(); });

document.getElementById("workoutForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const date = String(formData.get("date"));
  if (date > localDateString(today)) {
    document.getElementById("formError").textContent = "Choose today or an earlier date.";
    return;
  }
  const routineId = String(formData.get("routine") || "");
  const routine = state.routines.find((item) => item.id === routineId);
  state.workouts.push({
    id: `workout-${Date.now()}`,
    name: String(formData.get("name")).trim(),
    date,
    duration: Number(formData.get("duration")),
    routineId,
    routineName: routine?.name || "",
    notes: String(formData.get("notes") || "").trim(),
    createdAt: Date.now(),
  });
  saveState();
  closeLogModal();
  render();
  showToast("Workout saved. Nice work showing up.");
});

document.addEventListener("click", (event) => {
  const startButton = event.target.closest("[data-start-routine]");
  if (startButton) {
    const routine = state.routines.find((item) => item.id === startButton.dataset.startRoutine);
    if (routine) openLogModal(routine);
  }
  const deleteButton = event.target.closest("[data-delete-routine]");
  if (deleteButton) deleteRoutine(deleteButton.dataset.deleteRoutine);
});

render();