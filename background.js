/* ============================================================
   KINETIC TOPOGRAPHY
   Domain-warped Perlin field rendered as fluid contour lines.
   Replaces the generic floating-particle field entirely:
   no dots, no dot-networks — a living topographic surface that
   deforms magnetically around the pointer.
   ============================================================ */

(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    return;
  }

  const motionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : { matches: false };

  /* ---------- Perlin noise (2D, seeded permutation) ---------- */

  const perm = new Uint8Array(512);

  (function buildPermutation() {
    const table = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) {
      table[i] = i;
    }

    let seed = 20261007;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 255; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const swap = table[i];
      table[i] = table[j];
      table[j] = swap;
    }

    for (let i = 0; i < 512; i += 1) {
      perm[i] = table[i & 255];
    }
  })();

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;

  function gradient(hash, x, y) {
    switch (hash & 7) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      case 3:
        return -x - y;
      case 4:
        return x;
      case 5:
        return -x;
      case 6:
        return y;
      default:
        return -y;
    }
  }

  function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const X = xi & 255;
    const Y = yi & 255;
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];

    const x1 = lerp(gradient(aa, xf, yf), gradient(ba, xf - 1, yf), u);
    const x2 = lerp(gradient(ab, xf, yf - 1), gradient(bb, xf - 1, yf - 1), u);

    return lerp(x1, x2, v);
  }

  function fbm(x, y, octaves) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;

    for (let o = 0; o < octaves; o += 1) {
      sum += noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }

    return sum / norm;
  }

  /* ---------- field configuration ---------- */

  const COLS = 168; // simulation grid; the visual gets upscaled and smoothed
  const CONTOUR_BANDS = 13;
  const FIELD_SCALE = 2.35;

  const field = new Float32Array((COLS + 1) * 160);
  let rows = 0;
  let colCount = COLS;

  let viewW = 0;
  let viewH = 0;
  let dpr = 1;

  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, force: 0, tForce: 0 };
  let turbulence = 0; // raised while the portrait is hovered
  let targetTurbulence = 0;
  let startTime = performance.now();
  let rafId = 0;

  const buffer = document.createElement("canvas");
  const bufferCtx = buffer.getContext("2d");
  const image = bufferCtx.createImageData(colCount, 1);

  /* ---------- sizing ---------- */

  function resize() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;

    rows = Math.max(64, Math.round((COLS * viewH) / viewW));
    buffer.width = colCount;
    buffer.height = rows + 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  /* ---------- field sampling ---------- */

  function sampleField(t) {
    const step = FIELD_SCALE / colCount;
    const warpAmp = 1.35 + turbulence * 0.85;
    const drift = motionQuery.matches ? 0 : t * 0.035;
    const px = pointer.x;
    const py = pointer.y;
    const influence = pointer.force * 170;
    const influenceSq = influence * influence;

    for (let gy = 0; gy <= rows; gy += 1) {
      const ny = gy * step * (viewH / viewW);
      for (let gx = 0; gx <= colCount; gx += 1) {
        let nx = gx * step;

        // magnetic displacement: the surface bends away from the pointer
        if (pointer.force > 0.001) {
          const dx = gx - px;
          const dy = gy - py;
          const distSq = dx * dx + dy * dy;
          if (distSq < influenceSq) {
            const falloff = 1 - distSq / influenceSq;
            const push = falloff * falloff * pointer.force;
            nx += dx * push * 0.075;
            ny -= dy * push * 0.02;
          }
        }

        // domain warp — this is what makes the surface read as fluid rather than noise
        const wx = nx + drift + warpAmp * fbm(nx * 0.62 + 11.3, ny * 0.62 + 4.7, 2);
        const wy = ny - drift * 0.6 + warpAmp * fbm(nx * 0.62 - 7.1, ny * 0.62 + 9.2, 2);

        field[gy * (colCount + 1) + gx] = fbm(wx, wy, 4) * 0.5 + 0.5;
      }
    }
  }

  /* ---------- fluid fill ---------- */

  function paintField() {
    const data = image.data;
    const width = colCount + 1;
    bufferCtx.clearRect(0, 0, buffer.width, buffer.height);

    for (let gy = 0; gy <= rows; gy += 1) {
      for (let gx = 0; gx < colCount; gx += 1) {
        const h = field[gy * width + gx];
        const i = (gx << 2);

        // obsidian body, lifted by cobalt in the crests of the surface
        const lift = Math.pow(Math.max(0, h - 0.42), 1.5);
        const base = 9 + h * 13;
        const blue = 12 + lift * 96;
        const green = 10 + lift * 34;
        const red = 8 + lift * 18;

        data[i] = red;
        data[i + 1] = base * 0.72 + green;
        data[i + 2] = base + blue;
        data[i + 3] = 255;
      }
      bufferCtx.putImageData(image, 0, gy);
    }

    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.drawImage(buffer, 0, 0, viewW, viewH);
  }

  /* ---------- contour lines (marching squares) ---------- */

  // marching-squares edge pairs per case: 0 = top, 1 = right, 2 = bottom, 3 = left
  const CONTOUR_CASES = {
    1: [3, 0],
    2: [0, 1],
    3: [3, 1],
    4: [1, 2],
    6: [0, 2],
    7: [3, 2],
    8: [2, 3],
    9: [2, 0],
    11: [2, 1],
    12: [1, 3],
    13: [0, 1],
    14: [0, 3]
  };

  function paintContours() {
    const width = colCount + 1;
    const cellW = viewW / colCount;
    const cellH = viewH / rows;
    const safe = 1e-6;

    for (let band = 1; band < CONTOUR_BANDS; band += 1) {
      const level = band / CONTOUR_BANDS;
      const highlight = band % 3 === 0;

      ctx.beginPath();

      for (let gy = 0; gy < rows; gy += 1) {
        const y0 = gy * cellH;
        const y1 = y0 + cellH;

        for (let gx = 0; gx < colCount; gx += 1) {
          const a = field[gy * width + gx]; // top-left
          const b = field[gy * width + gx + 1]; // top-right
          const c = field[(gy + 1) * width + gx]; // bottom-left
          const d = field[(gy + 1) * width + gx + 1]; // bottom-right

          let code = 0;
          if (a > level) code |= 1;
          if (b > level) code |= 2;
          if (d > level) code |= 4;
          if (c > level) code |= 8;

          const x0 = gx * cellW;
          const x1 = x0 + cellW;

          if (code === 5 || code === 10) {
            // saddle cells: route both lines through the cell centre
            ctx.moveTo(x0, lerp(y0, y1, (level - a) / (c - a || safe)));
            ctx.lineTo((x0 + x1) * 0.5, (y0 + y1) * 0.5);
            ctx.lineTo(x1, lerp(y0, y1, (level - b) / (d - b || safe)));
            continue;
          }

          const pair = CONTOUR_CASES[code];
          if (!pair) {
            continue;
          }

          const p1 = edgePoint(pair[0], x0, x1, y0, y1, level, a, b, c, d, safe);
          const p2 = edgePoint(pair[1], x0, x1, y0, y1, level, a, b, c, d, safe);

          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
        }
      }

      ctx.strokeStyle = highlight ? "rgba(46,91,255,0.5)" : "rgba(242,242,242,0.055)";
      ctx.lineWidth = highlight ? 1.1 : 0.7;
      ctx.stroke();
    }
  }

  function edgePoint(edge, x0, x1, y0, y1, level, a, b, c, d, safe) {
    if (edge === 0) {
      return [lerp(x0, x1, (level - a) / (b - a || safe)), y0];
    }
    if (edge === 1) {
      return [x1, lerp(y0, y1, (level - b) / (d - b || safe))];
    }
    if (edge === 2) {
      return [lerp(x0, x1, (level - c) / (d - c || safe)), y1];
    }
    return [x0, lerp(y0, y1, (level - a) / (c - a || safe))];
  }

  /* ---------- grain ---------- */

  const grain = document.createElement("canvas");
  let grainPattern = null;

  (function buildGrain() {
    grain.width = 128;
    grain.height = 128;
    const gctx = grain.getContext("2d");
    const gdata = gctx.createImageData(128, 128);
    let seed = 7919;

    for (let i = 0; i < gdata.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = (seed >> 16) & 255;
      gdata.data[i] = v;
      gdata.data[i + 1] = v;
      gdata.data[i + 2] = v;
      gdata.data[i + 3] = 26;
    }

    gctx.putImageData(gdata, 0, 0);
    grainPattern = ctx.createPattern(grain, "repeat");
  })();

  function paintGrain(t) {
    if (!grainPattern) {
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.5 + turbulence * 0.35;
    ctx.translate((t * 6) % 128, (t * 4) % 128);
    ctx.fillStyle = grainPattern;
    ctx.fillRect(-128, -128, viewW + 256, viewH + 256);
    ctx.restore();
  }

  /* ---------- frame ---------- */

  function frame(now) {
    const t = (now - startTime) / 1000;

    pointer.x += (pointer.tx - pointer.x) * 0.09;
    pointer.y += (pointer.ty - pointer.y) * 0.09;
    pointer.force += (pointer.tForce - pointer.force) * 0.08;
    turbulence += (targetTurbulence - turbulence) * 0.06;

    sampleField(t);
    paintField();
    paintContours();
    paintGrain(t);

    rafId = requestAnimationFrame(frame);
  }

  function still() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    pointer.force = pointer.tForce;
    turbulence = targetTurbulence;
    sampleField(0);
    paintField();
    paintContours();
    paintGrain(0);
  }

  function start() {
    if (motionQuery.matches) {
      still();
      return;
    }
    if (!rafId) {
      startTime = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  /* ---------- events ---------- */

  window.addEventListener("resize", () => {
    resize();
    if (motionQuery.matches) {
      still();
    }
  });

  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.tx = (event.clientX / viewW) * colCount;
      pointer.ty = (event.clientY / viewH) * rows;
      pointer.tForce = 1;
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerleave",
    () => {
      pointer.tForce = 0;
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    } else {
      start();
    }
  });

  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", (event) => {
      if (event.matches) {
        still();
      } else {
        start();
      }
    });
  }

  // paint one frame synchronously so the surface is there before the first
  // animation frame lands (and stays there if rAF is paused in a background tab)
  resize();
  sampleField(0);
  paintField();
  paintContours();
  paintGrain(0);

  start();

  /* public surface — the page raises turbulence over the portrait */
  window.KineticField = {
    setTurbulence(value) {
      targetTurbulence = value ? 1 : 0;
    }
  };
})();
