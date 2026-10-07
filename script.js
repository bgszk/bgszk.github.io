/* ============================================================
   JORDAN — interaction layer
   ============================================================ */

(function () {
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- scroll reveal ---------- */

  const revealTargets = document.querySelectorAll("[data-reveal], .tl-item");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-in"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- timeline progress line ---------- */

  const timeline = document.querySelector(".timeline");

  if (timeline) {
    const progress = document.createElement("span");
    progress.className = "timeline-progress";
    timeline.appendChild(progress);

    const paintProgress = () => {
      const rect = timeline.getBoundingClientRect();
      const anchor = window.innerHeight * 0.62;
      const travelled = anchor - rect.top;
      const ratio = Math.min(1, Math.max(0, travelled / rect.height));
      progress.style.height = `${ratio * 100}%`;
    };

    paintProgress();
    window.addEventListener("scroll", paintProgress, { passive: true });
    window.addEventListener("resize", paintProgress);
    if (reduceMotion) {
      progress.style.height = "100%";
    }
  }

  /* ---------- forced horizontal matrix ---------- */

  document.querySelectorAll(".matrix-track").forEach((track) => {
    let dragging = false;
    let startX = 0;
    let startScroll = 0;

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") {
        return; // native touch scrolling stays intact
      }
      dragging = true;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    });

    track.addEventListener("pointermove", (event) => {
      if (!dragging) {
        return;
      }
      track.scrollLeft = startScroll - (event.clientX - startX);
    });

    const endDrag = (event) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      track.classList.remove("is-dragging");
      if (track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
    };

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);

    // vertical wheel advances the horizontal track while it can still move
    track.addEventListener(
      "wheel",
      (event) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
          return;
        }
        const max = track.scrollWidth - track.clientWidth;
        const next = track.scrollLeft + event.deltaY;
        if (next > 0 && next < max) {
          event.preventDefault();
          track.scrollLeft = next;
        }
      },
      { passive: false }
    );
  });

  /* ---------- "Ver caso" cursor badge ---------- */

  const badge = document.createElement("div");
  badge.className = "cursor-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = "Ver caso";
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    document.body.appendChild(badge);

    let badgeX = 0;
    let badgeY = 0;
    let targetX = 0;
    let targetY = 0;
    let badgeVisible = false;

    const follow = () => {
      badgeX += (targetX - badgeX) * 0.16;
      badgeY += (targetY - badgeY) * 0.16;
      badge.style.transform = `translate(${badgeX}px, ${badgeY}px) translate(-50%, -50%) scale(${
        badgeVisible ? 1 : 0.4
      })`;
      requestAnimationFrame(follow);
    };

    document.addEventListener(
      "pointermove",
      (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
      },
      { passive: true }
    );

    document.querySelectorAll(".case-card").forEach((card) => {
      card.addEventListener("pointerenter", () => {
        badgeVisible = true;
        badge.classList.add("is-on");
      });
      card.addEventListener("pointerleave", () => {
        badgeVisible = false;
        badge.classList.remove("is-on");
      });
    });

    requestAnimationFrame(follow);
  }

  /* ---------- magnetic links ---------- */

  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (event) => {
        const rect = el.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        el.style.transform = `translate(${dx * 0.14}px, ${dy * 0.28}px)`;
      });

      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ---------- portrait raises field turbulence ---------- */

  const portrait = document.querySelector(".hero-portrait");

  if (portrait && window.KineticField) {
    portrait.addEventListener("pointerenter", () => window.KineticField.setTurbulence(true));
    portrait.addEventListener("pointerleave", () => window.KineticField.setTurbulence(false));
  }

  /* ---------- background music ---------- */

  const musicBtn = document.getElementById("musicBtn");
  const music = document.getElementById("bgMusic");

  if (musicBtn && music) {
    music.volume = 0.45;
    const label = musicBtn.textContent;

    musicBtn.addEventListener("click", () => {
      if (music.paused) {
        music
          .play()
          .then(() => {
            musicBtn.textContent = "Pausar trilha";
          })
          .catch(() => {
            musicBtn.textContent = "Trilha indisponível";
          });
      } else {
        music.pause();
        musicBtn.textContent = label;
      }
    });
  }

  /* ---------- code copy ---------- */

  document.querySelectorAll(".copyBtn").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".skill-card");
      const code = card ? card.querySelector("code") : null;
      if (!code || !navigator.clipboard) {
        return;
      }

      const original = button.textContent;
      navigator.clipboard.writeText(code.textContent || "").then(() => {
        button.textContent = "Copiado";
        setTimeout(() => {
          button.textContent = original;
        }, 1400);
      });
    });
  });

  /* ---------- contact terminal — composes a real mail draft ---------- */

  const form = document.querySelector(".contact-form");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const to = form.dataset.mailto;
      const subject = encodeURIComponent(
        `Contato via portfolio — ${data.get("name") || "sem nome"}`
      );
      const body = encodeURIComponent(
        `${data.get("message") || ""}\n\n— ${data.get("name") || ""}\n${data.get("email") || ""}`
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }
})();
