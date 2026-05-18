let isTouchDevice = false;
let cursorDot;
let cursorRing;
let observer;

function cursorIn() {
  if (!cursorDot || !cursorRing) return;
  cursorDot.style.transform = "translate(-50%,-50%) scale(2.2)";
  cursorRing.style.transform = "translate(-50%,-50%) scale(1.7)";
  cursorRing.style.opacity = "1";
}

function cursorOut() {
  if (!cursorDot || !cursorRing) return;
  cursorDot.style.transform = "translate(-50%,-50%) scale(1)";
  cursorRing.style.transform = "translate(-50%,-50%) scale(1)";
  cursorRing.style.opacity = ".5";
}

export function refreshCursorTargets() {
  if (isTouchDevice) return;
  document.querySelectorAll("a,button,.svc,.cal-day,.slot,.gallery-item").forEach((el) => {
    el.removeEventListener("mouseenter", cursorIn);
    el.removeEventListener("mouseleave", cursorOut);
    el.addEventListener("mouseenter", cursorIn);
    el.addEventListener("mouseleave", cursorOut);
  });
}

export function observeReveal(el) {
  if (observer && el) observer.observe(el);
}

export function initUI() {
  isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  cursorDot = document.getElementById("c");
  cursorRing = document.getElementById("cr");

  if (isTouchDevice) {
    if (cursorDot) cursorDot.style.display = "none";
    if (cursorRing) cursorRing.style.display = "none";
  } else {
    document.addEventListener("mousemove", (e) => {
      if (!cursorDot || !cursorRing) return;
      cursorDot.style.left = `${e.clientX}px`;
      cursorDot.style.top = `${e.clientY}px`;
      setTimeout(() => {
        cursorRing.style.left = `${e.clientX}px`;
        cursorRing.style.top = `${e.clientY}px`;
      }, 70);
    });
  }

  if (isTouchDevice) {
    document.querySelectorAll(".svc").forEach((svc) => svc.classList.remove("hover-touch"));

    document.querySelectorAll(".svc").forEach((svc) => {
      svc.addEventListener(
        "touchstart",
        function handleTouchStart(e) {
          if (this.classList.contains("hover-touch")) return;
          document.querySelectorAll(".svc.hover-touch").forEach((x) => x.classList.remove("hover-touch"));
          this.classList.add("hover-touch");
          e.stopPropagation();
        },
        { passive: true }
      );
    });

    document.addEventListener(
      "touchstart",
      () => {
        document.querySelectorAll(".svc.hover-touch").forEach((x) => x.classList.remove("hover-touch"));
      },
      { passive: true }
    );
  }

  const nav = document.getElementById("nav");
  window.addEventListener("scroll", () => {
    if (nav) nav.classList.toggle("s", window.scrollY > 50);
  });

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("v");
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll(".r").forEach((el) => observer.observe(el));
  refreshCursorTargets();
}
