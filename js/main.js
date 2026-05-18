import { initUI, observeReveal, refreshCursorTargets } from "./ui.js";
import { initLightbox } from "./lightbox.js";
import { initGallery } from "./gallery.js";
import { initHours } from "./hours.js";
import { initReservation } from "./reservation.js";

function whenVisible(targetSelector, callback, rootMargin = "250px") {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      callback();
    },
    { rootMargin, threshold: 0.01 }
  );

  observer.observe(target);
}

function deferTask(task, timeout = 1200) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(task, { timeout });
  } else {
    setTimeout(task, 0);
  }
}

function initHeroBackgrounds() {
  const slides = document.querySelectorAll(".hero-slide[data-bg]");
  if (!slides.length) return;

  const applyBg = (slide) => {
    const url = slide.getAttribute("data-bg");
    if (!url || slide.style.backgroundImage) return;
    slide.style.backgroundImage = `url('${url}')`;
  };

  // Paint only the first slide eagerly, then warm up the rest off the critical path.
  applyBg(slides[0]);
  slides.forEach((slide, index) => {
    if (index === 0) return;
    deferTask(() => applyBg(slide), 3000);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  let hoursInitialized = false;
  let galleryInitialized = false;
  let reservationInitialized = false;

  const initHoursOnce = () => {
    if (hoursInitialized) return;
    hoursInitialized = true;
    initHours();
  };

  const initGalleryOnce = () => {
    if (galleryInitialized) return;
    galleryInitialized = true;
    initGallery({ observeReveal, refreshCursorTargets });
  };

  const initReservationOnce = () => {
    if (reservationInitialized) return;
    reservationInitialized = true;
    initReservation({ refreshCursorTargets });
  };

  initUI();
  initLightbox();
  initHeroBackgrounds();

  whenVisible("#rezervace", initReservationOnce);
  whenVisible("#hodiny", initHoursOnce);
  whenVisible("#galerie", initGalleryOnce);

  // Safety net for fast scrolling and anchor links.
  deferTask(initHoursOnce, 2500);
  deferTask(initGalleryOnce, 2800);
  deferTask(initReservationOnce, 3200);
});
