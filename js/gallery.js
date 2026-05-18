import { setLightboxItems, openLightboxAt } from "./lightbox.js";

const MAX_VISIBLE_IMAGES = 12;
const GALLERY_CACHE_KEY = "niccol_gallery_files_v1";
let initialized = false;

function toLabel(fileName) {
  return fileName
    .replace(/^\d+[-_]/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .trim();
}

function createGalleryItem({ src, label, index, isTall = false, animateReveal = true }) {
  const div = document.createElement("div");
  div.className = `gallery-item${isTall ? " tall" : ""}${animateReveal ? " r" : ""}`;
  div.setAttribute("data-lb-src", src);
  div.setAttribute("data-lb-cap", label || "Fotografie");
  div.style.transitionDelay = `${((index % 4) * 0.08).toFixed(2)}s`;

  const img = document.createElement("img");
  img.src = src;
  img.alt = label || "Fotografie";
  img.loading = "lazy";

  const span = document.createElement("span");
  span.className = "gallery-item-label";
  span.textContent = label || "Fotografie";

  div.appendChild(img);
  div.appendChild(span);
  return div;
}

export async function initGallery({ observeReveal, refreshCursorTargets }) {
  if (initialized) return;
  initialized = true;

  const grid = document.getElementById("galleryGrid");
  const showAllWrap = document.getElementById("galleryShowAllWrap");
  const showAllBtn = document.getElementById("galleryShowAllBtn");
  const galleryOverlay = document.getElementById("galleryOverlay");
  const galleryOverlayGrid = document.getElementById("galleryOverlayGrid");
  const galleryOverlayClose = document.getElementById("galleryOverlayClose");
  const lbOverlay = document.getElementById("lbOverlay");
  if (!grid) return;

  grid.innerHTML = "";
  if (showAllWrap) showAllWrap.hidden = true;

  try {
    let files = [];
    const cached = sessionStorage.getItem(GALLERY_CACHE_KEY);
    if (cached) {
      try {
        files = JSON.parse(cached);
      } catch (_error) {
        files = [];
      }
    }

    if (!Array.isArray(files) || files.length === 0) {
      const response = await fetch("data/gallery.json", { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const latest = await response.json();
      if (Array.isArray(latest)) {
        files = latest;
        sessionStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(files));
      }
    }

    if (!Array.isArray(files) || files.length === 0) {
      grid.innerHTML = '<p style="color:var(--muted);font-family:Inter,sans-serif;grid-column:1/-1;text-align:center;padding:60px 0">Zadne fotografie nebyly nalezeny.</p>';
      return;
    }

    // gallery.json is treated as append-only; newest files are usually at the end.
    const orderedFiles = [...files].reverse();

    const fileSet = new Set(orderedFiles.map((name) => String(name).toLowerCase()));
    const items = orderedFiles.map((file) => {
      const preferred = String(file).replace(/\.(jpe?g|png)$/i, ".webp");
      const hasWebpTwin = fileSet.has(preferred.toLowerCase());
      const src = `gallery/${hasWebpTwin ? preferred : file}`;
      const label = toLabel(file);
      return { src, label };
    });

    const allLightboxItems = items.map((item) => {
      const ref = document.createElement("div");
      ref.setAttribute("data-lb-src", item.src);
      ref.setAttribute("data-lb-cap", item.label || "Fotografie");
      return ref;
    });

    const visibleItems = [];
    items.slice(0, MAX_VISIBLE_IMAGES).forEach((item, i) => {
      const div = createGalleryItem({
        src: item.src,
        label: item.label,
        index: i,
        isTall: i % 3 === 0,
      });

      div.addEventListener("click", () => {
        setLightboxItems(allLightboxItems);
        openLightboxAt(i);
      });

      grid.appendChild(div);
      visibleItems.push(div);
      observeReveal(div);
    });

    setLightboxItems(allLightboxItems);

    if (items.length > MAX_VISIBLE_IMAGES && showAllWrap && showAllBtn && galleryOverlay && galleryOverlayGrid && galleryOverlayClose) {
      showAllWrap.hidden = false;
      galleryOverlayGrid.innerHTML = "";

      const overlayItems = [];
      items.forEach((item, i) => {
        const div = createGalleryItem({
          src: item.src,
          label: item.label,
          index: i,
          isTall: false,
          animateReveal: false,
        });

        div.addEventListener("click", () => {
          setLightboxItems(allLightboxItems);
          openLightboxAt(i);
        });

        galleryOverlayGrid.appendChild(div);
        overlayItems.push(div);
      });

      const closeOverlay = () => {
        galleryOverlay.classList.remove("open");
        galleryOverlay.setAttribute("aria-hidden", "true");
        if (!lbOverlay || !lbOverlay.classList.contains("open")) {
          document.body.style.overflow = "";
        }
      };

      const openOverlay = () => {
        galleryOverlay.classList.add("open");
        galleryOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      };

      showAllBtn.addEventListener("click", openOverlay);
      galleryOverlayClose.addEventListener("click", closeOverlay);
      galleryOverlay.addEventListener("click", (e) => {
        if (e.target === galleryOverlay) closeOverlay();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!galleryOverlay.classList.contains("open")) return;
        if (lbOverlay && lbOverlay.classList.contains("open")) return;
        closeOverlay();
      });
    } else {
      if (showAllWrap) showAllWrap.hidden = true;
      if (galleryOverlay) {
        galleryOverlay.classList.remove("open");
        galleryOverlay.setAttribute("aria-hidden", "true");
      }
      if (galleryOverlayGrid) galleryOverlayGrid.innerHTML = "";
    }

    refreshCursorTargets();
  } catch (error) {
    grid.innerHTML = `<p style="color:#ff6b6b;font-family:Inter,sans-serif;grid-column:1/-1;text-align:center;padding:60px 0">Chyba pri nacitani fotek: ${error.message}</p>`;
    console.error("Gallery loader error:", error);
  }
}
