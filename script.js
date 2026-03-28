const canvas = document.getElementById("bg-canvas");

if (canvas) {
  const ctx = canvas.getContext("2d");

  let width = 0;
  let height = 0;
  const particles = [];
  const particleCount = 90;

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function createParticle() {
    const palette = [
      "rgba(159,139,255,0.9)",
      "rgba(122,92,255,0.9)",
      "rgba(98,185,255,0.85)",
      "rgba(213,133,255,0.8)"
    ];

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      color: palette[Math.floor(Math.random() * palette.length)]
    };
  }

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < particleCount; i += 1) {
      particles.push(createParticle());
    }
  }

  function drawBackground() {
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.3,
      0,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.85
    );

    gradient.addColorStop(0, "#17142b");
    gradient.addColorStop(0.45, "#0c0c17");
    gradient.addColorStop(1, "#050507");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function animate() {
    drawBackground();

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = p.color;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    requestAnimationFrame(animate);
  }

  resizeCanvas();
  initParticles();
  animate();

  window.addEventListener("resize", () => {
    resizeCanvas();
    initParticles();
  });
}

const musicBtn = document.getElementById("musicBtn");
const bgMusic = document.getElementById("bgMusic");

if (musicBtn && bgMusic) {
  musicBtn.addEventListener("click", () => {
    bgMusic.volume = 0.45;
    bgMusic.play();
  });
}

document.querySelectorAll(".copyBtn").forEach((button) => {
  button.addEventListener("click", () => {
    const code = button.closest(".skill-card")?.querySelector("code");
    if (!code) return;

    navigator.clipboard.writeText(code.textContent || "");
    const original = button.textContent;
    button.textContent = "Copiado!";
    setTimeout(() => {
      button.textContent = original;
    }, 1400);
  });
});
