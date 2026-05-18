let lbItems = [];
let lbIdx = 0;
let overlay;
let closeBtn;
let prevBtn;
let nextBtn;
let img;
let caption;
let counter;

function show(index) {
  if (!lbItems.length) return;
  lbIdx = (index + lbItems.length) % lbItems.length;
  const item = lbItems[lbIdx];

  img.style.opacity = "0";
  img.src = item.getAttribute("data-lb-src") || "";
  img.alt = item.getAttribute("data-lb-cap") || "";
  img.onload = () => {
    img.style.transition = "opacity .3s";
    img.style.opacity = "1";
  };

  caption.textContent = item.getAttribute("data-lb-cap") || "";
  counter.textContent = `${lbIdx + 1} / ${lbItems.length}`;
}

function close() {
  overlay.classList.remove("open");
  const galleryOverlay = document.getElementById("galleryOverlay");
  if (galleryOverlay?.classList.contains("open")) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}

function nav(dir) {
  show(lbIdx + dir);
}

export function setLightboxItems(items) {
  lbItems = items;
}

export function openLightboxAt(index) {
  if (!overlay || !lbItems.length) return;
  show(index);
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

export function openLightboxFromElement(el) {
  if (!overlay || !lbItems.length) return;
  const idx = lbItems.indexOf(el);
  if (idx < 0) return;
  openLightboxAt(idx);
}

export function initLightbox() {
  overlay = document.getElementById("lbOverlay");
  closeBtn = overlay?.querySelector(".lb-close");
  prevBtn = overlay?.querySelector(".lb-prev");
  nextBtn = overlay?.querySelector(".lb-next");
  img = document.getElementById("lbImg");
  caption = document.getElementById("lbCaption");
  counter = document.getElementById("lbCounter");

  if (!overlay || !closeBtn || !prevBtn || !nextBtn || !img || !caption || !counter) return;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    nav(-1);
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    nav(1);
  });

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "ArrowRight") nav(1);
    else if (e.key === "ArrowLeft") nav(-1);
    else if (e.key === "Escape") close();
  });

  let startX = 0;
  let startY = 0;
  let moved = false;

  overlay.addEventListener(
    "touchstart",
    (e) => {
      if (!overlay.classList.contains("open")) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
    },
    { passive: true }
  );

  overlay.addEventListener(
    "touchmove",
    (e) => {
      if (!overlay.classList.contains("open")) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > 10 && Math.abs(dy) < 75) moved = true;
    },
    { passive: true }
  );

  overlay.addEventListener("touchend", (e) => {
    if (!overlay.classList.contains("open") || !moved) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 100) {
      if (dx < 0) nav(1);
      else nav(-1);
    }
  });
}
