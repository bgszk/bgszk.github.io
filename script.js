// script.js
// Fundo animado cyberpunk/neon
const canvas = document.getElementById('background');
const ctx = canvas.getContext('2d');

let w, h;
function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Partículas neon
const particles = [];
const particleCount = Math.floor(w * h / 8000);

for (let i = 0; i < particleCount; i++) {
  particles.push({
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 2 + 1,
    speedX: (Math.random() - 0.5) * 0.5,
    speedY: (Math.random() - 0.5) * 0.5,
    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
  });
}

// Animação
function animate() {
  ctx.clearRect(0, 0, w, h);

  // Fundo com gradiente radial sutil
  const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)/1.5);
  gradient.addColorStop(0, '#1a1333');
  gradient.addColorStop(1, '#050507');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Partículas
  particles.forEach(p => {
    p.x += p.speedX;
    p.y += p.speedY;

    if (p.x > w) p.x = 0;
    if (p.x < 0) p.x = w;
    if (p.y > h) p.y = 0;
    if (p.y < 0) p.y = h;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
  });

  requestAnimationFrame(animate);
}
animate();
