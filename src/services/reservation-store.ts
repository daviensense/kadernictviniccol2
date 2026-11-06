import { parseReservations, type Reservation } from "../domain/reservation";

export const RESERVATION_STORAGE_KEY = "niccol_res";

export function readReservations(storage?: Storage): Reservation[] {
  try {
    const raw = (storage ?? window.localStorage).getItem(
      RESERVATION_STORAGE_KEY,
    );
    return parseReservations(raw ? JSON.parse(raw) : []);
  } catch (error) {
    throw new Error(
      "Místní rezervace nelze načíst. Zkontrolujte úložiště prohlížeče; data nebyla změněna.",
      { cause: error },
    );
  }
}

export function saveReservations(
  reservations: Reservation[],
  storage?: Storage,
): void {
  try {
    (storage ?? window.localStorage).setItem(
      RESERVATION_STORAGE_KEY,
      JSON.stringify(reservations),
    );
  } catch (error) {
    throw new Error(
      "Místní rezervaci se nepodařilo uložit. Zkontrolujte volné místo a oprávnění úložiště.",
      { cause: error },
    );
  }
}
