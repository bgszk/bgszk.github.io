# AGENTS.md — working notes for this repository

## What this is

A plain static portfolio: hand-written HTML, one stylesheet, one interaction
script, one background engine. **There is no build step, no package manager, no
framework, no dependency install.** Never introduce a bundler to make a change
here — edit the files directly.

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d      # http://localhost:3000
docker compose -f docker-compose.base44.yml logs -f web
docker compose -f docker-compose.base44.yml down
```

The dev server is `nginx:1.27-alpine` serving the repo bind-mounted read-only.
Because there is no compile step, a source edit is live on the next page load;
call `reload_preview` after edits so the preview iframe picks it up.

## Non-obvious setup facts

- **The repo root is mode `0700`.** nginx's default workers (`user nginx`) cannot
  traverse the bind mount and every request returns 403 (directories) or 404
  (files). `nginx.base44.conf` is therefore a **full main config mounted at
  `/etc/nginx/nginx.conf`** (not a `conf.d` drop-in) and sets `user root;`. Do not
  "simplify" it back to a `conf.d/default.conf` drop-in — that reintroduces the
  403/404 failure. The alternative (chmod-ing the repo) is worse: it loosens
  permissions on the repository itself.
- The whole repo is mounted at the web root, so `nginx.base44.conf` denies dotfiles
  and `.yml/.md/.json/.lock/.conf` requests. Re-check those rules when adding files
  that should not be publicly served.
- No environment variables, no secrets, no database. The app needs nothing beyond
  the container itself.

## Architecture

| File | Role |
| --- | --- |
| `index.html` | Hero Monolith, Project Matrix, Timeline, Contact Terminal |
| `projetos.html` | Project archive (P-01…P-09) + capability pillars |
| `processo.html` | Career phases + working method + principles |
| `codes.html` | Language samples with copy-to-clipboard (kept at this URL on purpose) |
| `game.html` | Embedded NES emulator |
| `contato.html` | Contact terminal on its own route |
| `style.css` | The entire design system (tokens, layout, motion, a11y) |
| `background.js` | `window.KineticField` — domain-warped Perlin field + marching-squares contours |
| `script.js` | Reveal observers, drag/wheel matrix, cursor badge, magnetic links, form, music |

### The background is not a particle system

`background.js` deliberately contains **no particles and no dot-network**. It samples
domain-warped Perlin fBm on a ~168×N grid, upscales it as a smoothed "liquid"
surface, then draws topographic contour lines over it with marching squares, plus a
tiled grain pass. The pointer magnetically displaces the sample coordinates, so the
surface bends around the cursor. If you ever replace this with floating dots, you
have reintroduced exactly what the design brief rejected.

`prefers-reduced-motion` is honoured: the field renders one static frame, the
marquee stops, and reveals resolve immediately.

### Cross-file contracts (easy to break)

- The hero name is two identical `.hero-marquee` layers: one behind the portrait,
  one in front clipped with `clip-path`. Both must keep the **same animation
  duration** or the front slice desynchronises from the layer behind it.
- `script.js` looks up `.timeline` and injects `.timeline-progress`; the CSS
  expects `.timeline::before` to draw the rail.
- `script.js` calls `window.KineticField.setTurbulence()` on portrait hover — the
  guard already allows the global to be absent, but renaming the API breaks the effect.
- The contact form has **no backend**. It composes a `mailto:` draft from
  `data-mailto`. Don't add a fake success state.

## Placeholder content to replace (not code defects)

- `assets/retrato.jpg` — the real portrait. Drop the file in and it is picked up
  automatically; until then `onerror` falls back to
  `assets/retrato-placeholder.svg`. Portrait treatment is `grayscale(1)` with a
  radial mask, so any well-lit photo blends in without pre-processing.
- Contact channels in `index.html` / `contato.html`: `contato@example.com`,
  `https://wa.me/`, `https://www.linkedin.com/` (GitHub already points at the real
  profile). Replace the `mailto:` href **and** the form's `data-mailto`.
- Timeline phases use `Fase 01…04` rather than dates, and project entries describe
  technical scope without invented clients or metrics. Add real dates and outcomes
  when available.

## Verifying a change

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/            # 200
curl -s http://localhost:3000/ | grep -c 'bg-canvas'                       # 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/.git/config # 403
```

Then check the browser: the field should show moving contour topography (not
dots), and the hero marquee should be legible in front of the lower part of the
portrait. Keyboard: `Tab` must show a 2px cobalt outline on every link, tab and
form field.
