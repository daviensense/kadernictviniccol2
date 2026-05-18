const DAYS_OF_WEEK = ["Ne", "Po", "Ut", "St", "Ct", "Pa", "So"];
const DAY_NAMES = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];
const MONTH_NAMES = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec"
];

const SCHEDULE = {
  0: [],
  1: ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
  2: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"],
  3: ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
  4: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"],
  5: ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
  6: []
};

let calYear;
let calMonth;
let selectedDate = null;
let selectedTime = null;
let currentStep = 1;
let refreshCursorTargets = () => {};

function getReservations() {
  try {
    return JSON.parse(localStorage.getItem("niccol_res") || "[]");
  } catch (_error) {
    return [];
  }
}

function saveReservations(list) {
  localStorage.setItem("niccol_res", JSON.stringify(list));
}

function getBookedSlots(dateStr) {
  return getReservations()
    .filter((r) => r.date === dateStr)
    .map((r) => r.time);
}

function genId() {
  return `NC-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

function toDateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateCZ(str) {
  const [y, m, d] = str.split("-");
  const dow = new Date(Number(y), Number(m) - 1, Number(d)).getDay();
  return `${DAY_NAMES[dow]} ${parseInt(d, 10)}. ${parseInt(m, 10)}. ${y}`;
}

function showErr(msg) {
  const el = document.getElementById("res-error");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}

function row(key, value) {
  return `<div class="confirm-row"><span>${key}</span><span>${value}</span></div>`;
}

function renderCal() {
  const title = document.getElementById("calTitle");
  const grid = document.getElementById("calGrid");
  if (!title || !grid) return;

  title.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
  grid.innerHTML = "";

  DAYS_OF_WEEK.slice(1)
    .concat(DAYS_OF_WEEK[0])
    .forEach((d) => {
      const el = document.createElement("div");
      el.className = "cal-day-name";
      el.textContent = d;
      grid.appendChild(el);
    });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < offset; i += 1) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    grid.appendChild(empty);
  }

  const reservations = getReservations();

  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(calYear, calMonth, d);
    const dow = date.getDay();
    const dateStr = toDateStr(calYear, calMonth + 1, d);
    const slots = SCHEDULE[dow] || [];
    const booked = reservations.filter((r) => r.date === dateStr).map((r) => r.time);
    const freeSlots = slots.filter((s) => !booked.includes(s));
    const isPast = date < today;
    const isClosed = slots.length === 0;

    const el = document.createElement("div");
    el.textContent = String(d);

    if (isPast) {
      el.className = "cal-day disabled";
    } else if (isClosed) {
      el.className = "cal-day closed";
    } else {
      el.className = "cal-day";
      if (date.getTime() === today.getTime()) el.classList.add("today");
      if (freeSlots.length === 0) el.classList.add("full");
      else el.classList.add("has-free");
      if (selectedDate === dateStr) el.classList.add("selected");
      el.addEventListener("click", () => selectDate(dateStr, dow));
    }

    grid.appendChild(el);
  }

  refreshCursorTargets();
}

function selectDate(dateStr, dow) {
  selectedDate = dateStr;
  selectedTime = null;
  renderCal();
  renderSlots(dateStr, dow);
}

function renderSlots(dateStr, dow) {
  const wrap = document.getElementById("slotsWrap");
  if (!wrap) return;

  const slots = SCHEDULE[dow] || [];
  const booked = getBookedSlots(dateStr);

  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const nowMins = now.getHours() * 60 + now.getMinutes();

  wrap.innerHTML = `<p class="s-label" style="margin-bottom:16px">${formatDateCZ(dateStr)}</p>`;

  if (!slots.length) {
    wrap.innerHTML += '<p style="font-size:.95rem;font-weight:300;color:var(--muted)">Tento den je zavreno.</p>';
    return;
  }

  const grid = document.createElement("div");
  grid.className = "slots-grid";

  slots.forEach((time) => {
    const btn = document.createElement("button");
    btn.className = "slot";
    btn.type = "button";

    const [hh, mm] = time.split(":").map(Number);
    const slotMins = hh * 60 + mm;
    const isPast = dateStr === todayStr && slotMins <= nowMins;
    const isTaken = booked.includes(time);

    if (isTaken) {
      btn.classList.add("slot-taken");
      btn.innerHTML = `${time}<span class="slot-taken-label">Obsazeno</span>`;
      btn.disabled = true;
    } else if (isPast) {
      btn.classList.add("slot-past");
      btn.textContent = time;
      btn.disabled = true;
    } else {
      btn.textContent = time;
      if (selectedTime === time) btn.classList.add("slot-selected");
      btn.addEventListener("click", () => selectSlot(time, btn));
    }

    grid.appendChild(btn);
  });

  wrap.appendChild(grid);

  if (selectedTime) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "btn-main";
    nextBtn.style.marginTop = "24px";
    nextBtn.type = "button";
    nextBtn.textContent = "Pokračovat ->";
    nextBtn.addEventListener("click", () => goStep(2));
    wrap.appendChild(nextBtn);
  }

  refreshCursorTargets();
}

function selectSlot(time, btn) {
  selectedTime = time;
  document.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("slot-selected"));
  btn.classList.add("slot-selected");

  const dow = new Date(selectedDate).getDay();
  renderSlots(selectedDate, dow);
}

function goStep(step) {
  if (step === 2) {
    if (!selectedDate || !selectedTime) {
      alert("Vyberte prosím datum a čas.");
      return;
    }

    const ssDate = document.getElementById("ss-date");
    const ssTime = document.getElementById("ss-time");
    if (ssDate) ssDate.textContent = formatDateCZ(selectedDate);
    if (ssTime) ssTime.textContent = selectedTime;
  }

  currentStep = step;

  document.querySelectorAll(".step-panel").forEach((panel, index) => {
    panel.classList.toggle("active", index + 1 === step);
  });

  [1, 2, 3].forEach((i) => {
    const ind = document.getElementById(`step-ind-${i}`);
    if (!ind) return;
    ind.classList.remove("active", "done");
    if (i === step) ind.classList.add("active");
    else if (i < step) ind.classList.add("done");
  });

  document.getElementById("rezervace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAdminList() {
  const list = getReservations();
  const el = document.getElementById("adminList");
  if (!el) return;

  if (!list.length) {
    el.innerHTML = '<div class="admin-empty">Zadne rezervace.</div>';
    return;
  }

  const sorted = [...list].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));

  el.innerHTML = sorted
    .map(
      (r) => `
      <div class="admin-res-item">
        <div>
          <div class="admin-res-info">${r.date} ${r.time} - <strong>${r.name}</strong> (${r.service})</div>
          <div class="admin-res-meta">${r.phone}${r.email ? ` · ${r.email}` : ""}${r.note ? ` · ${r.note}` : ""} · ${r.id}</div>
        </div>
        <button class="admin-res-del" data-res-id="${r.id}" title="Smazat">X</button>
      </div>
      `
    )
    .join("");

  el.querySelectorAll(".admin-res-del").forEach((btn) => {
    btn.addEventListener("click", () => deleteRes(btn.getAttribute("data-res-id")));
  });

  refreshCursorTargets();
}

function deleteRes(id) {
  const list = getReservations().filter((r) => r.id !== id);
  saveReservations(list);
  renderAdminList();
  renderCal();
  if (selectedDate) {
    const dow = new Date(selectedDate.replace(/-/g, "/")).getDay();
    renderSlots(selectedDate, dow);
  }
}

function clearAll() {
  if (!confirm("Opravdu smazat všechny rezervace?")) return;
  saveReservations([]);
  renderAdminList();
  renderCal();
}

function submitReservation() {
  const name = document.getElementById("rf-name")?.value.trim() || "";
  const phone = document.getElementById("rf-phone")?.value.trim() || "";
  const service = document.getElementById("rf-service")?.value || "";
  const email = document.getElementById("rf-email")?.value.trim() || "";
  const note = document.getElementById("rf-note")?.value.trim() || "";
  const errEl = document.getElementById("res-error");
  if (errEl) errEl.style.display = "none";

  if (!name) return showErr("Vyplňte prosím jméno.");
  if (!phone) return showErr("Vyplňte prosím telefonní číslo.");
  if (!service) return showErr("Vyberte prosím službu.");

  const booked = getBookedSlots(selectedDate);
  if (booked.includes(selectedTime)) {
    showErr("Tento termín byl právě obsazen. Vyberte prosím jiný čas.");
    goStep(1);
    return;
  }

  const id = genId();
  const reservation = {
    id,
    date: selectedDate,
    time: selectedTime,
    name,
    phone,
    email,
    service,
    note,
    created: new Date().toISOString()
  };

  const list = getReservations();
  list.push(reservation);
  saveReservations(list);

  const confId = document.getElementById("conf-id");
  if (confId) confId.textContent = `Číslo rezervace: ${id}`;

  const confDetail = document.getElementById("conf-detail");
  if (confDetail) {
    confDetail.innerHTML =
      row("Jméno", name) +
      row("Datum", formatDateCZ(selectedDate)) +
      row("Čas", selectedTime) +
      row("Služba", service) +
      (phone ? row("Telefon", phone) : "") +
      (email ? row("E-mail", email) : "") +
      (note ? row("Poznámka", note) : "");
  }

  goStep(3);
  renderAdminList();
  renderCal();

  if (selectedDate) {
    const dow = new Date(selectedDate.replace(/-/g, "/")).getDay();
    renderSlots(selectedDate, dow);
  }
}

function newReservation() {
  selectedDate = null;
  selectedTime = null;

  ["rf-name", "rf-phone", "rf-email", "rf-service", "rf-note"].forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;
    if (field.tagName === "SELECT") field.value = "";
    else field.value = "";
  });

  const err = document.getElementById("res-error");
  if (err) err.style.display = "none";

  renderCal();
  const slotsWrap = document.getElementById("slotsWrap");
  if (slotsWrap) {
    slotsWrap.innerHTML = '<p style="font-size:.95rem;font-weight:300;color:var(--muted)">← Nejprve vyberte datum v kalendari</p>';
  }

  goStep(1);
}

function initCal() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCal();
}

function bindEvents() {
  document.getElementById("calPrev")?.addEventListener("click", () => {
    calMonth -= 1;
    if (calMonth < 0) {
      calMonth = 11;
      calYear -= 1;
    }
    renderCal();
  });

  document.getElementById("calNext")?.addEventListener("click", () => {
    calMonth += 1;
    if (calMonth > 11) {
      calMonth = 0;
      calYear += 1;
    }
    renderCal();
  });

  document.getElementById("resBackBtn")?.addEventListener("click", () => goStep(1));
  document.getElementById("submitReservationBtn")?.addEventListener("click", submitReservation);
  document.getElementById("newReservationBtn")?.addEventListener("click", newReservation);

  document.getElementById("toggleAdminBtn")?.addEventListener("click", () => {
    const panel = document.getElementById("adminPanel");
    if (!panel) return;
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) renderAdminList();
  });

  document.getElementById("clearAllBtn")?.addEventListener("click", clearAll);

  document.getElementById("sendMsgBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Děkujeme za zprávu. Ozveme se vám co nejdříve.");
  });
}

export function initReservation(options = {}) {
  refreshCursorTargets = options.refreshCursorTargets || refreshCursorTargets;
  initCal();
  renderAdminList();
  bindEvents();
}
