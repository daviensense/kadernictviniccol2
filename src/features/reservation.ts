import hoursData from "../../data/hours.json";
import {
  createReservationId,
  createSchedule,
  dateKey,
  formatDateCz,
  timeToMinutes,
  validateContact,
  validateOpeningHours,
  type Reservation,
} from "../domain/reservation";
import {
  readReservations,
  saveReservations,
} from "../services/reservation-store";

const DAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const MONTHS = new Intl.DateTimeFormat("cs-CZ", { month: "long" });
const DAYS = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

let year = new Date().getFullYear();
let month = new Date().getMonth();
let selectedDate: string | null = null;
let selectedTime: string | null = null;
let schedule: Record<number, string[]> = {};

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function displayError(message: string): void {
  const error = byId("res-error");
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
  error.focus();
}

function clearError(): void {
  const error = byId("res-error");
  if (!error) return;
  error.hidden = true;
  error.textContent = "";
}

function reservations(): Reservation[] | null {
  try {
    return readReservations();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Místní rezervace nelze načíst.";
    displayError(message);
    return null;
  }
}

function currentDateKey(): string {
  return dateKey(new Date());
}

function buildCalendar(): void {
  const title = byId("calTitle");
  const grid = byId("calGrid");
  const live = byId("calendarLive");
  if (!title || !grid || !live) return;

  const saved = reservations();
  if (!saved) {
    title.textContent = `${MONTHS.format(new Date(year, month, 1))} ${year}`;
    grid.replaceChildren();
    live.textContent =
      "Kalendář nelze zobrazit, dokud není možné přečíst místní data.";
    return;
  }

  title.textContent = `${MONTHS.format(new Date(year, month, 1))} ${year}`;
  const content = document.createDocumentFragment();
  DAY_LABELS.forEach((label) => {
    const heading = document.createElement("span");
    heading.className = "cal-day-name";
    heading.textContent = label;
    heading.setAttribute("aria-hidden", "true");
    content.append(heading);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  for (let index = 0; index < offset; index += 1) {
    const empty = document.createElement("span");
    empty.className = "cal-day empty";
    empty.setAttribute("aria-hidden", "true");
    content.append(empty);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayKey = dateKey(now);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const available = schedule[date.getDay()] ?? [];
    const booked = new Set(
      saved.filter((item) => item.date === key).map((item) => item.time),
    );
    const freeCount = available.filter(
      (slot) =>
        !booked.has(slot) &&
        (key !== todayKey || timeToMinutes(slot) > currentMinutes),
    ).length;
    const isPast = date < today;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cal-day";
    button.textContent = String(day);
    const availability = isPast
      ? "minulý den"
      : !available.length
        ? "zavřeno"
        : `volných časů: ${freeCount}`;
    button.setAttribute("aria-label", `${DAYS.format(date)}, ${availability}`);
    button.setAttribute("aria-pressed", String(selectedDate === key));

    if (isPast) {
      button.classList.add("disabled");
      button.disabled = true;
    } else if (!available.length) {
      button.classList.add("closed");
      button.disabled = true;
    } else {
      button.classList.add(freeCount ? "has-free" : "full");
      if (dateKey(date) === currentDateKey()) button.classList.add("today");
      if (selectedDate === key) button.classList.add("selected");
      button.addEventListener("click", () => selectDate(key));
    }
    content.append(button);
  }
  grid.replaceChildren(content);
  live.textContent = selectedDate
    ? `Vybráno datum ${formatDateCz(selectedDate)}.`
    : "Vyberte datum.";
}

function renderSlots(): void {
  const wrap = byId("slotsWrap");
  const live = byId("calendarLive");
  if (!wrap || !live) return;
  if (!selectedDate) {
    wrap.replaceChildren();
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Nejprve vyberte datum v kalendáři.";
    wrap.append(message);
    return;
  }

  const saved = reservations();
  if (!saved) return;
  const [selectedYear, selectedMonth, selectedDay] = selectedDate
    .split("-")
    .map(Number);
  const weekday = new Date(
    selectedYear,
    selectedMonth - 1,
    selectedDay,
  ).getDay();
  const daySlots = schedule[weekday] ?? [];
  const booked = new Set(
    saved.filter((item) => item.date === selectedDate).map((item) => item.time),
  );
  const now = new Date();
  const today = dateKey(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (
    selectedTime &&
    (booked.has(selectedTime) ||
      (selectedDate === today && timeToMinutes(selectedTime) <= currentMinutes))
  ) {
    selectedTime = null;
  }
  const content = document.createDocumentFragment();

  const label = document.createElement("p");
  label.className = "s-label slot-date";
  label.textContent = formatDateCz(selectedDate);
  content.append(label);
  if (!daySlots.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "V tento den je zavřeno.";
    content.append(empty);
    wrap.replaceChildren(content);
    return;
  }

  const slotGrid = document.createElement("div");
  slotGrid.className = "slots-grid";
  let freeCount = 0;
  daySlots.forEach((time) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot";
    button.textContent = time;
    button.setAttribute("aria-pressed", String(selectedTime === time));
    const isTaken = booked.has(time);
    const isPast =
      selectedDate === today && timeToMinutes(time) <= currentMinutes;
    if (isTaken) {
      button.classList.add("slot-taken");
      button.disabled = true;
      button.setAttribute("aria-label", `${time}, obsazeno`);
    } else if (isPast) {
      button.classList.add("slot-past");
      button.disabled = true;
      button.setAttribute("aria-label", `${time}, tento čas již uplynul`);
    } else {
      freeCount += 1;
      if (selectedTime === time) button.classList.add("slot-selected");
      button.addEventListener("click", () => selectTime(time));
    }
    slotGrid.append(button);
  });
  content.append(slotGrid);

  if (!freeCount) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Pro tento den již nejsou dostupné žádné časy.";
    content.append(empty);
  }
  if (selectedTime) {
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn-main slot-continue";
    next.textContent = "Pokračovat";
    next.addEventListener("click", () => goToStep(2));
    content.append(next);
  }
  wrap.replaceChildren(content);
  live.textContent = selectedTime
    ? `Vybrán čas ${selectedTime}.`
    : `Časy pro ${formatDateCz(selectedDate)}.`;
}

function selectDate(value: string): void {
  selectedDate = value;
  selectedTime = null;
  clearError();
  buildCalendar();
  renderSlots();
}

function selectTime(value: string): void {
  selectedTime = value;
  buildCalendar();
  renderSlots();
}

function goToStep(step: number): void {
  if (step === 2) {
    if (!selectedDate || !selectedTime) {
      displayError("Vyberte prosím datum a čas.");
      return;
    }
    const dateSummary = byId("ss-date");
    const timeSummary = byId("ss-time");
    if (dateSummary) dateSummary.textContent = formatDateCz(selectedDate);
    if (timeSummary) timeSummary.textContent = selectedTime;
  }

  document
    .querySelectorAll<HTMLElement>(".step-panel")
    .forEach((panel, index) => {
      panel.hidden = index + 1 !== step;
    });
  [1, 2, 3].forEach((index) => {
    const indicator = byId(`step-ind-${index}`);
    if (!indicator) return;
    indicator.classList.toggle("active", index === step);
    indicator.classList.toggle("done", index < step);
    if (index === step) indicator.setAttribute("aria-current", "step");
    else indicator.removeAttribute("aria-current");
  });
  const focusTarget =
    step === 3
      ? byId("conf-title")
      : byId(`sp${step}`)?.querySelector<HTMLElement>("h3, h2");
  focusTarget?.focus();
  byId("localPlanner")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}

function createRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "confirm-row";
  const key = document.createElement("span");
  key.textContent = label;
  const detail = document.createElement("span");
  detail.textContent = value;
  row.append(key, detail);
  return row;
}

function renderAdminList(): void {
  const list = byId("adminList");
  const status = byId("adminStatus");
  if (!list || !status) return;
  try {
    const entries = readReservations().sort((left, right) =>
      left.date === right.date
        ? left.time.localeCompare(right.time)
        : left.date.localeCompare(right.date),
    );
    status.hidden = true;
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "admin-empty";
      empty.textContent =
        "V tomto prohlížeči zatím nejsou uložené žádné rezervace.";
      list.replaceChildren(empty);
      return;
    }

    const content = document.createDocumentFragment();
    entries.forEach((entry) => {
      const item = document.createElement("article");
      item.className = "admin-res-item";
      const details = document.createElement("div");
      const primary = document.createElement("div");
      primary.className = "admin-res-info";
      primary.append(document.createTextNode(`${entry.date} ${entry.time} – `));
      const name = document.createElement("strong");
      name.textContent = entry.name;
      primary.append(name, document.createTextNode(` (${entry.service})`));
      const secondary = document.createElement("div");
      secondary.className = "admin-res-meta";
      secondary.textContent = [entry.phone, entry.email, entry.note, entry.id]
        .filter(Boolean)
        .join(" · ");
      details.append(primary, secondary);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "admin-res-del";
      remove.textContent = "×";
      remove.setAttribute(
        "aria-label",
        `Odstranit místní rezervaci ${entry.id}`,
      );
      remove.addEventListener("click", () => deleteReservation(entry.id));
      item.append(details, remove);
      content.append(item);
    });
    list.replaceChildren(content);
  } catch (error) {
    status.textContent =
      error instanceof Error
        ? error.message
        : "Místní rezervace nelze zobrazit.";
    status.hidden = false;
    list.replaceChildren();
    console.error("Přehled místních rezervací nelze zobrazit.", error);
  }
}

function deleteReservation(id: string): void {
  const saved = reservations();
  if (!saved) return;
  try {
    saveReservations(saved.filter((entry) => entry.id !== id));
    renderAdminList();
    buildCalendar();
    renderSlots();
  } catch (error) {
    displayError(
      error instanceof Error
        ? error.message
        : "Místní rezervaci nelze odstranit.",
    );
  }
}

function clearReservations(): void {
  if (
    !window.confirm(
      "Opravdu smazat všechny místní rezervace v tomto prohlížeči?",
    )
  )
    return;
  try {
    saveReservations([]);
    clearError();
    renderAdminList();
    buildCalendar();
    renderSlots();
  } catch (error) {
    displayError(
      error instanceof Error
        ? error.message
        : "Místní rezervace nelze odstranit.",
    );
  }
}

function submitReservation(event: SubmitEvent): void {
  event.preventDefault();
  clearError();
  const form = byId<HTMLFormElement>("resForm");
  if (!form || !form.reportValidity()) return;

  const value = (id: string) =>
    byId<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      id,
    )?.value.trim() ?? "";
  const name = value("rf-name");
  const phone = value("rf-phone");
  const email = value("rf-email");
  const service = value("rf-service");
  const note = value("rf-note");
  const contactError = validateContact(name, phone, email);
  if (contactError) {
    displayError(contactError);
    return;
  }
  if (!selectedDate || !selectedTime || !service) {
    displayError("Vyberte prosím datum, čas a službu.");
    goToStep(1);
    return;
  }

  const stored = reservations();
  if (!stored) return;
  if (
    stored.some(
      (entry) => entry.date === selectedDate && entry.time === selectedTime,
    )
  ) {
    displayError(
      "Tento termín je již v místních rezervacích obsazen. Vyberte jiný čas.",
    );
    goToStep(1);
    buildCalendar();
    renderSlots();
    return;
  }

  const reservation: Reservation = {
    id: createReservationId(),
    date: selectedDate,
    time: selectedTime,
    name,
    phone,
    email,
    service,
    note,
    created: new Date().toISOString(),
  };
  try {
    saveReservations([...stored, reservation]);
  } catch (error) {
    displayError(
      error instanceof Error ? error.message : "Rezervaci nelze uložit.",
    );
    return;
  }

  const confirmationId = byId("conf-id");
  if (confirmationId)
    confirmationId.textContent = `Místní záznam: ${reservation.id}`;
  const details = byId("conf-detail");
  details?.replaceChildren(
    createRow("Jméno", name),
    createRow("Datum", formatDateCz(selectedDate)),
    createRow("Čas", selectedTime),
    createRow("Služba", service),
    createRow("Telefon", phone),
    ...(email ? [createRow("E-mail", email)] : []),
    ...(note ? [createRow("Poznámka", note)] : []),
  );
  goToStep(3);
  renderAdminList();
  buildCalendar();
  renderSlots();
}

function resetForm(): void {
  byId<HTMLFormElement>("resForm")?.reset();
  selectedDate = null;
  selectedTime = null;
  clearError();
  buildCalendar();
  renderSlots();
  goToStep(1);
}

export function initReservation(): void {
  const form = byId<HTMLFormElement>("resForm");
  if (!form) return;
  try {
    schedule = createSchedule(validateOpeningHours(hoursData));
  } catch (error) {
    displayError(
      error instanceof Error ? error.message : "Rozvrh nelze načíst.",
    );
    return;
  }

  byId("calPrev")?.addEventListener("click", () => {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    buildCalendar();
  });
  byId("calNext")?.addEventListener("click", () => {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    buildCalendar();
  });
  byId("resBackBtn")?.addEventListener("click", () => goToStep(1));
  byId("newReservationBtn")?.addEventListener("click", resetForm);
  form.addEventListener("submit", submitReservation);

  const adminButton = byId<HTMLButtonElement>("toggleAdminBtn");
  const adminPanel = byId("adminPanel");
  adminButton?.addEventListener("click", () => {
    if (!adminPanel || !adminButton) return;
    adminPanel.hidden = !adminPanel.hidden;
    adminButton.setAttribute("aria-expanded", String(!adminPanel.hidden));
    if (!adminPanel.hidden) renderAdminList();
  });
  byId("clearAllBtn")?.addEventListener("click", clearReservations);
  window.addEventListener("storage", (event) => {
    if (event.key !== "niccol_res") return;
    buildCalendar();
    renderSlots();
    renderAdminList();
  });

  buildCalendar();
  renderSlots();
  renderAdminList();
}
