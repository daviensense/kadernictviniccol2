import hoursData from "../../data/hours.json";
import { validateOpeningHours } from "../domain/reservation";

function textElement(
  tag: string,
  className: string,
  text: string,
): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export function initHours(): void {
  const section = document.getElementById("hodiny");
  const grid = section?.querySelector(".hours-grid");
  const status = document.getElementById("hoursStatus");
  if (!section || !grid) return;

  try {
    const days = validateOpeningHours(hoursData);
    const fragment = document.createDocumentFragment();
    for (const day of days) {
      const row = document.createElement("div");
      row.className = "hours-row";
      row.append(textElement("div", "hours-day", day.day));

      const value = document.createElement("div");
      value.className = "hours-time";
      if (day.closed) {
        value.append(textElement("span", "hours-closed", day.closed));
      } else {
        value.append(document.createTextNode(`${day.open} – ${day.close}`));
        if (day.note) value.append(textElement("div", "hours-note", day.note));
      }
      row.append(value);
      fragment.append(row);
    }
    grid.replaceChildren(fragment);

    const heroDays = days.filter((day) => day.heroLabel && day.heroValue);
    const heroInfoItems =
      document.querySelectorAll<HTMLElement>(".hero-info-item");
    heroDays.slice(0, 2).forEach((day, index) => {
      const item = heroInfoItems[index];
      item
        ?.querySelector(".hii-label")
        ?.replaceChildren(document.createTextNode(day.heroLabel ?? ""));
      item
        ?.querySelector(".hii-val")
        ?.replaceChildren(document.createTextNode(day.heroValue ?? ""));
    });
  } catch (error) {
    if (status) {
      status.textContent =
        error instanceof Error
          ? `Otevírací dobu se nepodařilo načíst. ${error.message}`
          : "Otevírací dobu se nepodařilo načíst.";
      status.hidden = false;
    }
    console.error("Otevírací dobu se nepodařilo načíst.", error);
  }
}
