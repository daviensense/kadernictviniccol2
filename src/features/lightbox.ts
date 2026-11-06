let items: HTMLElement[] = [];
let currentIndex = 0;
let overlay: HTMLElement | null = null;
let image: HTMLImageElement | null = null;
let caption: HTMLElement | null = null;
let counter: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;

function update(index: number): void {
  if (!items.length || !image || !caption || !counter) return;
  currentIndex = (index + items.length) % items.length;
  const item = items[currentIndex];
  image.src = item.dataset.lbSrc ?? "";
  image.alt = item.dataset.lbCap ?? "Fotografie kadeřnictví";
  caption.textContent = item.dataset.lbCap ?? "";
  counter.textContent = `${currentIndex + 1} / ${items.length}`;
}

function close(): void {
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  syncModalState();
  returnFocus?.focus();
}

export function setLightboxItems(nextItems: HTMLElement[]): void {
  items = nextItems;
}

export function openLightboxAt(index: number, trigger: HTMLElement): void {
  if (!overlay || !items.length) return;
  returnFocus = trigger;
  update(index);
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  syncModalState();
  overlay.querySelector<HTMLButtonElement>(".lb-close")?.focus();
}

export function initLightbox(): void {
  overlay = document.getElementById("lbOverlay");
  image = document.getElementById("lbImg") as HTMLImageElement | null;
  caption = document.getElementById("lbCaption");
  counter = document.getElementById("lbCounter");
  const closeButton = overlay?.querySelector<HTMLButtonElement>(".lb-close");
  const previous = overlay?.querySelector<HTMLButtonElement>(".lb-prev");
  const next = overlay?.querySelector<HTMLButtonElement>(".lb-next");
  if (
    !overlay ||
    !image ||
    !caption ||
    !counter ||
    !closeButton ||
    !previous ||
    !next
  )
    return;

  closeButton.addEventListener("click", close);
  previous.addEventListener("click", () => update(currentIndex - 1));
  next.addEventListener("click", () => update(currentIndex + 1));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", (event) => {
    if (!overlay?.classList.contains("open")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") update(currentIndex - 1);
    if (event.key === "ArrowRight") update(currentIndex + 1);
    if (event.key === "Tab") {
      const controls = [
        ...overlay!.querySelectorAll<HTMLElement>("button:not([disabled])"),
      ].filter((control) => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  let startX = 0;
  overlay.addEventListener(
    "touchstart",
    (event) => {
      startX = event.changedTouches[0]?.clientX ?? 0;
    },
    { passive: true },
  );
  overlay.addEventListener(
    "touchend",
    (event) => {
      if (!overlay?.classList.contains("open")) return;
      const delta = (event.changedTouches[0]?.clientX ?? startX) - startX;
      if (Math.abs(delta) > 50) update(currentIndex + (delta < 0 ? 1 : -1));
    },
    { passive: true },
  );
}
import { syncModalState } from "../ui";
