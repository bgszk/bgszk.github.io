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

`prefers-reduced-motion` is honoured: the field renders one static frame, the hero
name's entrance keyframes are dropped, and reveals resolve immediately.

`sampleField()` declares `nx` and `ny` **per sample**, because the magnetic
displacement mutates them. An earlier revision hoisted `ny` to the row loop as a
`const`, so the first pointer move threw "Assignment to constant variable", which
killed the animation frame and left a frozen field. Keep both declarations inside
the grid loop.

### Cross-file contracts (easy to break)

- The hero name is one monumental line: `.hero-name` (solid, z-index 2) with an
  outlined `.hero-name-echo` behind it (z-index 1), inside `.hero-stage`, over the
  violet bloom drawn by `.hero-stage::before` (z-index 0). Two earlier revisions
  failed and must not come back: a moving marquee band across the stage (the owner
  could not read the name) and a `clip-path` slice over the letters. Only the
  one-shot `name-rise`/`name-fade` keyframes animate it, and
  `prefers-reduced-motion` switches them off. Keep the echo's `font-size` and
  `letter-spacing` identical to `.hero-name`, or the outline drifts off the letters.
- `script.js` looks up `.timeline` and injects `.timeline-progress`; the CSS
  expects `.timeline::before` to draw the rail.
- `script.js` calls `window.KineticField.setTurbulence()` on portrait hover — the
  guard already allows the global to be absent, but renaming the API breaks the effect.
- The contact form has **no backend**. It composes a `mailto:` draft from
  `data-mailto`. Don't add a fake success state.

## Placeholder content to replace (not code defects)

- Palette: `--accent` (#8b5cf6) is the *readable* violet for text, lines and focus
  rings on obsidian (≈4.6:1). `--accent-deep` (#5b21b6) is the dark violet for
  **fills that carry white text** (buttons, cursor badge, selection), where it reaches
  ≈9:1. Don't swap them: the dark purple fails as text on obsidian, and the light one
  fails as a fill under white text.
- `assets/retrato.jpg` — the real portrait, tracked in the repo. It appears **only**
  as the small circular `.hero-about-avatar` beside the hero intro line: the owner
  asked for a small icon elsewhere, not a hero centrepiece, and refused any colour
  grade on the photo. Treatment is therefore neutral — `grayscale(1)`, 58px, thin
  border, no violet overlay, no radial mask, no blend mode. The `onerror` fallback to
  `assets/retrato-placeholder.svg` is only a safety net for a missing file. Swapping
  the file needs no other change.
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
dots) and must keep animating while the pointer moves over the page, and the hero
name has to be fully legible at every width with the small avatar beside the
intro line. Keyboard: `Tab` must show a 2px violet outline on every link, tab and
form field.
