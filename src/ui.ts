import { galleryAsset } from "./services/gallery-assets";

let revealObserver: IntersectionObserver | null = null;

export function observeReveal(element: Element): void {
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add("v");
}

export function syncModalState(): void {
  const isOpen = Boolean(
    document.querySelector(".gallery-overlay.open, .lb-overlay.open"),
  );
  document.body.classList.toggle("modal-open", isOpen);
  const background = [
    document.querySelector("nav"),
    ...document.querySelectorAll(
      "main > :not(.gallery-overlay):not(.lb-overlay)",
    ),
    document.querySelector("footer"),
  ];
  background.forEach((element) => {
    if (element instanceof HTMLElement) element.inert = isOpen;
  });
}

function initNavigation(): void {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("main-navigation");
  const updateScroll = () => nav?.classList.toggle("s", window.scrollY > 50);
  updateScroll();
  window.addEventListener("scroll", updateScroll, { passive: true });

  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    links?.classList.toggle("open", open);
  });
  links?.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.addEventListener("click", () => {
      toggle?.setAttribute("aria-expanded", "false");
      links.classList.remove("open");
    });
  });
}

function initReveal(): void {
  const items = document.querySelectorAll(".r");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("v"));
    return;
  }
  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("v");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 },
  );
  items.forEach((item) => revealObserver?.observe(item));
}

function applyLocalBackground(element: HTMLElement): void {
  try {
    const url = galleryAsset(element.dataset.image ?? "");
    element.style.backgroundImage = `url("${url}")`;
  } catch (error) {
    console.error("Místní obrázek se nepodařilo načíst.", error);
  }
}

function initLocalBackgrounds(): void {
  document
    .querySelectorAll<HTMLElement>(".hero-slide[data-image]")
    .forEach(applyLocalBackground);
  const serviceImages = document.querySelectorAll<HTMLElement>(
    ".svc-img[data-image]",
  );
  if (!("IntersectionObserver" in window)) {
    serviceImages.forEach(applyLocalBackground);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
          return;
        applyLocalBackground(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "200px", threshold: 0.01 },
  );
  serviceImages.forEach((element) => observer.observe(element));
}

function initOfflineStatus(): void {
  const status = document.getElementById("networkStatus");
  if (!status) return;
  const update = () => {
    status.hidden = navigator.onLine;
    status.textContent = navigator.onLine
      ? ""
      : "Jste offline. Rezervace se ukládají jen v tomto prohlížeči; některé obrázky nemusí být dostupné.";
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function loadWhenVisible(selector: string, load: () => Promise<void>): void {
  const target = document.querySelector(selector);
  if (!target || !("IntersectionObserver" in window)) {
    void load();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void load();
    },
    { rootMargin: "250px", threshold: 0.01 },
  );
  observer.observe(target);
}

function reportFeatureError(
  selector: string,
  message: string,
  error: unknown,
): void {
  const target = document.querySelector<HTMLElement>(selector);
  if (target) {
    const status = document.createElement("p");
    status.className = "feature-error";
    status.setAttribute("role", "alert");
    status.textContent = message;
    target.prepend(status);
  }
  console.error(message, error);
}

function initContactForm(): void {
  const form = document.getElementById("contactForm") as HTMLFormElement | null;
  const status = document.getElementById("contactStatus");
  if (!form || !status) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const subject = `Dotaz z webu NICCOL – ${String(fields.get("name") ?? "").trim()}`;
    const message = [
      `Jméno: ${String(fields.get("name") ?? "").trim()}`,
      `Telefon: ${String(fields.get("phone") ?? "").trim()}`,
      `Služba: ${String(fields.get("service") ?? "").trim()}`,
      `Preferovaný den: ${String(fields.get("date") ?? "").trim()}`,
      `Čas: ${String(fields.get("time") ?? "").trim()}`,
      "",
      String(fields.get("message") ?? "").trim(),
    ].join("\n");
    window.location.href = `mailto:n.smolikova@seznam.cz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    status.textContent =
      "Otevíráme vaši e-mailovou aplikaci. Zprávu je potřeba v ní odeslat; pokud se aplikace neotevře, zavolejte nám.";
    status.hidden = false;
  });
}

export function init(): void {
  initNavigation();
  initReveal();
  initLocalBackgrounds();
  initOfflineStatus();
  initContactForm();

  loadWhenVisible("#hodiny", async () => {
    try {
      const feature = await import("./features/hours");
      feature.initHours();
    } catch (error) {
      reportFeatureError("#hodiny", "Otevírací dobu nelze načíst.", error);
    }
  });
  loadWhenVisible("#galerie", async () => {
    try {
      const feature = await import("./features/gallery");
      feature.initGallery();
    } catch (error) {
      reportFeatureError("#galerie", "Galerii nelze načíst.", error);
    }
  });
  loadWhenVisible("#rezervace", async () => {
    try {
      const feature = await import("./features/reservation");
      feature.initReservation();
    } catch (error) {
      reportFeatureError(
        "#rezervace",
        "Rezervační formulář nelze načíst.",
        error,
      );
    }
  });
}
