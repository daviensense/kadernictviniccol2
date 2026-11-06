import { describe, expect, it } from "vitest";
import hoursData from "../data/hours.json";
import {
  createSchedule,
  dateKey,
  formatDateCz,
  parseReservations,
  validateContact,
  validateOpeningHours,
} from "../src/domain/reservation";
import {
  readReservations,
  saveReservations,
} from "../src/services/reservation-store";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("rezervační doména", () => {
  it("odvozuje půlhodinové časy z ověřené otevírací doby", () => {
    const schedule = createSchedule(validateOpeningHours(hoursData));
    expect(schedule[1]).toHaveLength(10);
    expect(schedule[1]?.[0]).toBe("13:00");
    expect(schedule[1]?.at(-1)).toBe("17:30");
    expect(schedule[2]).toHaveLength(12);
    expect(schedule[2]?.at(-1)).toBe("13:30");
    expect(schedule[0]).toEqual([]);
    expect(schedule[6]).toEqual([]);
  });

  it("odmítne neúplná nebo neplatná data rozvrhu", () => {
    expect(() => validateOpeningHours([])).toThrow("všech sedm dnů");
    expect(() =>
      validateOpeningHours(
        hoursData.map((day) =>
          day.key === "mon" ? { ...day, open: "18:00", close: "13:00" } : day,
        ),
      ),
    ).toThrow("Neplatný čas");
  });

  it("formátuje datum místním kalendářním dnem bez posunu časového pásma", () => {
    const date = new Date(2026, 5, 1, 0, 0);
    expect(dateKey(date)).toBe("2026-06-01");
    expect(formatDateCz("2026-06-01")).toContain("pondělí");
  });

  it("validuje kontaktní údaje a délky polí", () => {
    expect(validateContact("", "123456", "")).toMatch(/jméno/i);
    expect(validateContact("Jana", "abc", "")).toMatch(/telefon/i);
    expect(
      validateContact("Jana", "+420 722 294 800", "jana@example.cz"),
    ).toBeNull();
    expect(validateContact("x".repeat(101), "+420 722 294 800", "")).toMatch(
      /100 znaků/,
    );
  });

  it("odmítne poškozené záznamy místo jejich tichého smazání", () => {
    expect(() => parseReservations({})).toThrow("správný formát");
    expect(() =>
      parseReservations([
        {
          id: "NC-123",
          date: "2026-02-31",
          time: "13:00",
          name: "Jana",
          phone: "123456",
          email: "",
          service: "Střih",
          note: "",
          created: new Date().toISOString(),
        },
      ]),
    ).toThrow("Neplatný termín");
  });

  it("ukládá a čte lokální rezervace přes oddělené úložiště", () => {
    const storage = new MemoryStorage();
    const reservation = {
      id: "NC-12345678",
      date: "2026-06-01",
      time: "13:00",
      name: "<img src=x onerror=alert(1)>",
      phone: "+420 722 294 800",
      email: "",
      service: "Dámský střih",
      note: "",
      created: "2026-05-01T10:00:00.000Z",
    };
    saveReservations([reservation], storage);
    expect(readReservations(storage)).toEqual([reservation]);
    storage.setItem("niccol_res", "{");
    expect(() => readReservations(storage)).toThrow("nelze načíst");
  });
});
