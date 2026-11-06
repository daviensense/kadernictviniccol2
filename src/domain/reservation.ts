export interface OpeningDay {
  key: string;
  day: string;
  open?: string;
  close?: string;
  note?: string;
  closed?: string;
  heroLabel?: string;
  heroValue?: string;
}

export interface Reservation {
  id: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  note: string;
  created: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const RESERVATION_FIELDS = [
  "id",
  "date",
  "time",
  "name",
  "phone",
  "email",
  "service",
  "note",
  "created",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): value is Record<string, string> {
  return fields.every(
    (field) => typeof value[field] === "string" && value[field].length <= 1000,
  );
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function validateOpeningHours(value: unknown): OpeningDay[] {
  if (!Array.isArray(value) || value.length !== 7) {
    throw new Error("Otevírací doba musí obsahovat všech sedm dnů.");
  }

  const days = value.map((item, index): OpeningDay => {
    if (
      !isRecord(item) ||
      typeof item.key !== "string" ||
      typeof item.day !== "string"
    ) {
      throw new Error(`Neplatný záznam otevírací doby (${index + 1}).`);
    }

    if (WEEKDAY_INDEX[item.key] === undefined || !item.day.trim()) {
      throw new Error(`Neplatný den otevírací doby (${index + 1}).`);
    }

    const day: OpeningDay = { key: item.key, day: item.day };
    for (const property of [
      "note",
      "closed",
      "heroLabel",
      "heroValue",
    ] as const) {
      const field = item[property];
      if (field !== undefined) {
        if (typeof field !== "string" || field.length > 120) {
          throw new Error(`Neplatná hodnota ${property} u dne ${item.day}.`);
        }
        day[property] = field;
      }
    }

    if (item.closed !== undefined) {
      if (typeof item.closed !== "string" || item.closed.length > 120) {
        throw new Error(`Neplatná informace o uzavření dne ${item.day}.`);
      }
      return day;
    }

    if (
      !isTime(item.open) ||
      !isTime(item.close) ||
      timeToMinutes(item.open) >= timeToMinutes(item.close)
    ) {
      throw new Error(`Neplatný čas otevírací doby u dne ${item.day}.`);
    }

    day.open = item.open;
    day.close = item.close;
    return day;
  });

  if (new Set(days.map((day) => day.key)).size !== 7) {
    throw new Error("Otevírací doba obsahuje duplicitní den.");
  }
  return days;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function createSchedule(days: OpeningDay[]): Record<number, string[]> {
  return Object.fromEntries(
    days.map((day) => {
      const weekday = WEEKDAY_INDEX[day.key];
      const slots: string[] = [];
      if (day.open && day.close) {
        const start = timeToMinutes(day.open);
        const end = timeToMinutes(day.close);
        for (let minute = start; minute + 30 <= end; minute += 30) {
          slots.push(
            `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
          );
        }
      }
      return [weekday, slots];
    }),
  );
}

export function parseReservations(value: unknown): Reservation[] {
  if (!Array.isArray(value)) {
    throw new Error("Seznam místních rezervací nemá správný formát.");
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Neplatná místní rezervace (${index + 1}).`);
    }
    if (!hasStringFields(item, RESERVATION_FIELDS)) {
      throw new Error(`Neplatné pole v místní rezervaci (${index + 1}).`);
    }
    if (
      !/^[\w-]{1,40}$/.test(item.id) ||
      !isValidDateKey(item.date) ||
      !isTime(item.time)
    ) {
      throw new Error(`Neplatný termín místní rezervace (${index + 1}).`);
    }
    return {
      id: item.id,
      date: item.date,
      time: item.time,
      name: item.name,
      phone: item.phone,
      email: item.email,
      service: item.service,
      note: item.note,
      created: item.created,
    };
  });
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDateCz(value: string): string {
  if (!isValidDateKey(value)) throw new Error("Nelze zobrazit neplatné datum.");
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function createReservationId(): string {
  return `NC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function validateContact(
  name: string,
  phone: string,
  email: string,
): string | null {
  if (!name.trim()) return "Vyplňte prosím jméno.";
  if (name.length > 100) return "Jméno může mít nejvýše 100 znaků.";
  if (!phone.trim()) return "Vyplňte prosím telefonní číslo.";
  if (!/^[+()\d\s.-]{6,30}$/.test(phone.trim()))
    return "Zkontrolujte prosím telefonní číslo.";
  if (email.length > 254) return "E-mail může mít nejvýše 254 znaků.";
  return null;
}
