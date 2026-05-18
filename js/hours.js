export async function initHours() {
  if (initHours.initialized) return;
  initHours.initialized = true;

  const grid = document.querySelector("#hodiny .hours-grid");
  const heroInfoItems = document.querySelectorAll(".hero-info-item");
  if (!grid) return;

  try {
    let data = [];
    const cacheKey = "niccol_hours_v1";
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        data = JSON.parse(cached);
      } catch (_error) {
        data = [];
      }
    }

    if (!Array.isArray(data) || data.length === 0) {
      const response = await fetch("data/hours.json", { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      if (Array.isArray(data)) {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      }
    }

    if (!Array.isArray(data)) return;

    grid.innerHTML = data
      .map((item) => {
        const note = item.note ? `<div class="hours-note">${item.note}</div>` : "";
        const time = item.closed
          ? `<span class="hours-closed">${item.closed}</span>`
          : `${item.time}${note}`;

        return `
          <div class="hours-row">
            <div class="hours-day">${item.day}</div>
            <div class="hours-time">${time}</div>
          </div>
        `;
      })
      .join("");

    const withHeroLabel = data.filter((item) => item.heroLabel && item.heroValue);
    if (heroInfoItems.length >= 2 && withHeroLabel.length >= 2) {
      heroInfoItems[0].querySelector(".hii-label").textContent = withHeroLabel[0].heroLabel;
      heroInfoItems[0].querySelector(".hii-val").textContent = withHeroLabel[0].heroValue;
      heroInfoItems[1].querySelector(".hii-label").textContent = withHeroLabel[1].heroLabel;
      heroInfoItems[1].querySelector(".hii-val").textContent = withHeroLabel[1].heroValue;
    }
  } catch (error) {
    console.error("Hours loader error:", error);
  }
}
