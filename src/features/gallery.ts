import galleryData from "../../data/gallery.json";
import {
  galleryAsset,
  preferredGalleryAsset,
} from "../services/gallery-assets";
import { openLightboxAt, setLightboxItems } from "./lightbox";
import { observeReveal, syncModalState } from "../ui";

const MAX_VISIBLE_IMAGES = 12;

interface GalleryPhoto {
  src: string;
  label: string;
}

function photoLabel(fileName: string): string {
  return fileName
    .replace(/^\d+[-_]/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .trim();
}

function validateManifest(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((file: unknown): file is string => typeof file === "string")
  ) {
    throw new Error("Seznam fotografií má neplatný formát.");
  }
  return value;
}

function createPhoto(
  photo: GalleryPhoto,
  index: number,
  tall: boolean,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `gallery-item${tall ? " tall" : ""} r`;
  button.setAttribute("aria-label", `Zobrazit fotografii: ${photo.label}`);
  button.style.transitionDelay = `${((index % 4) * 0.08).toFixed(2)}s`;

  const image = document.createElement("img");
  image.src = photo.src;
  image.alt = photo.label;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener(
    "error",
    () => {
      button.classList.add("image-unavailable");
      button.setAttribute(
        "aria-label",
        `Fotografie není dostupná: ${photo.label}`,
      );
    },
    { once: true },
  );

  const label = document.createElement("span");
  label.className = "gallery-item-label";
  label.textContent = photo.label;
  button.append(image, label);
  button.addEventListener("click", () => openLightboxAt(index, button));
  return button;
}

export function initGallery(): void {
  const grid = document.getElementById("galleryGrid");
  const status = document.getElementById("galleryStatus");
  const showAllWrap = document.getElementById("galleryShowAllWrap");
  const showAllButton = document.getElementById("galleryShowAllBtn");
  const dialog = document.getElementById("galleryOverlay");
  const dialogGrid = document.getElementById("galleryOverlayGrid");
  const closeButton = document.getElementById("galleryOverlayClose");
  if (
    !grid ||
    !status ||
    !showAllWrap ||
    !showAllButton ||
    !dialog ||
    !dialogGrid ||
    !closeButton
  )
    return;

  try {
    const files = validateManifest(galleryData);
    if (!files.length) {
      status.textContent = "Fotografie nyní nejsou k dispozici.";
      status.hidden = false;
      return;
    }

    const fileNames = new Set(files.map((file) => file.toLowerCase()));
    const photos = [...files].reverse().map((fileName): GalleryPhoto => {
      const preferred = preferredGalleryAsset(fileName, fileNames);
      return {
        src: galleryAsset(preferred),
        label: photoLabel(fileName) || "Fotografie kadeřnictví",
      };
    });

    const fullSizeItems = photos.map((photo) => {
      const reference = document.createElement("span");
      reference.dataset.lbSrc = photo.src;
      reference.dataset.lbCap = photo.label;
      return reference;
    });
    setLightboxItems(fullSizeItems);

    const visible = document.createDocumentFragment();
    photos.slice(0, MAX_VISIBLE_IMAGES).forEach((photo, index) => {
      const item = createPhoto(photo, index, index % 3 === 0);
      visible.append(item);
      observeReveal(item);
    });
    grid.replaceChildren(visible);
    status.hidden = true;

    if (photos.length > MAX_VISIBLE_IMAGES) {
      const expanded = document.createDocumentFragment();
      photos.forEach((photo, index) => {
        const item = createPhoto(photo, index, false);
        item.classList.remove("r");
        expanded.append(item);
      });
      dialogGrid.replaceChildren(expanded);
      showAllWrap.hidden = false;

      let returnFocus: HTMLElement | null = null;
      const closeDialog = () => {
        dialog.classList.remove("open");
        dialog.setAttribute("aria-hidden", "true");
        syncModalState();
        returnFocus?.focus();
      };
      showAllButton.addEventListener("click", () => {
        returnFocus = showAllButton;
        dialog.classList.add("open");
        dialog.setAttribute("aria-hidden", "false");
        syncModalState();
        closeButton.focus();
      });
      closeButton.addEventListener("click", closeDialog);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog();
      });
      dialog.addEventListener("keydown", (event) => {
        if (!dialog.classList.contains("open")) return;
        if (
          event.key === "Escape" &&
          !document.getElementById("lbOverlay")?.classList.contains("open")
        ) {
          closeDialog();
        }
        if (event.key === "Tab") {
          const controls = [
            ...dialog.querySelectorAll<HTMLElement>("button:not([disabled])"),
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
    } else {
      showAllWrap.hidden = true;
      dialogGrid.replaceChildren();
    }
  } catch (error) {
    status.textContent =
      error instanceof Error
        ? `Galerii se nepodařilo načíst. ${error.message}`
        : "Galerii se nepodařilo načíst.";
    status.hidden = false;
    console.error("Galerii se nepodařilo načíst.", error);
  }
}
