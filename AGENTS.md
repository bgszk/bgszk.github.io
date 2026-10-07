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
| `index.html` | Hero Monolith, Project Matrix, Timeline, Contact |
| `projetos.html` | Executable tools (L-01/L-02) + archive (P-01…P-09) + capability pillars |
| `processo.html` | Career phases + working method + principles |
| `codes.html` | Language samples with copy-to-clipboard (kept at this URL on purpose) |
| `game.html` | Embedded NES emulator |
| `contato.html` | Contact route — real channels (e-mail, WhatsApp, GitHub) + mailto form |
| `style.css` | The entire design system (tokens, layout, motion, a11y) |
| `lab.css` | Styles for the executable tools; loaded only by `projetos.html` |
| `background.js` | `window.KineticField` — domain-warped Perlin field + marching-squares contours |
| `script.js` | Reveal observers, drag/wheel matrix, cursor badge, magnetic links, form, music |
| `lab.js` | ELF/PE header reader (L-01) + strings/hex dump (L-02) + entropy map (L-03), only on `projetos.html` |

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

The `field` buffer is allocated **inside `resize()`**, sized from `rows`, which
follows the viewport's aspect ratio. It used to be a fixed `(COLS + 1) * 160`
array: on a phone (~373×665 needs 300 rows) every row past the 160th was written
out of bounds, read back as `undefined`, and the lower half of the surface
rendered black while the top half looked fine. Re-allocate it whenever `rows`
changes — never pin it to a constant.

### The lab tools are real (and stay that way)

`lab.js` parses the file the visitor picks **inside the browser**: ELF and PE
headers, section tables and per-section Shannon entropy (L-01), ASCII string
extraction and an addressed hex dump (L-02), and a windowed entropy map over the
whole file (L-03: 512 windows, each one's entropy drawn as a canvas strip).
Everything is read with `File.arrayBuffer()`; nothing is uploaded. Never route a file through a server or
an external API, and never replace the parsers with canned output — the point is
that the numbers come from the real bytes. All file-derived text is written with
`textContent` (a binary can contain markup), and every read goes through
`field()`, which returns `null` out of range instead of throwing.

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
- `.site-shell` is a flex column and `main` is the child allowed to grow, so
  `.terminal` still reaches the bottom of the viewport on a short page. Dropping
  `main { flex: 1 0 auto }` makes the footer on `contato.html` float above a band
  of empty background.
- `script.js` calls `window.KineticField.setTurbulence()` on portrait hover — the
  guard already allows the global to be absent, but renaming the API breaks the effect.
- The contact block is back on `index.html` and `contato.html` with the owner's real
  channels: `.magnetic-list` (items are `.magnetic[data-magnetic]`) plus the
  `.contact-form`, whose `data-mailto` is the owner's address. `script.js` composes a
  `mailto:` draft from those fields — there is **no backend**, so never add a
  success state and never send anything yourself. `.terminal-inner--single` /
  `.terminal--compact` are the channel-less variants kept in `style.css` for the
  case the list has to come out again.

## Placeholder content to replace (not code defects)

- Palette: `--accent` (#8b5cf6) is the *readable* violet for text, lines and focus
  rings on obsidian (≈4.6:1). `--accent-deep` (#5b21b6) is the dark violet for
  **fills that carry white text** (buttons, cursor badge, selection), where it reaches
  ≈9:1. Don't swap them: the dark purple fails as text on obsidian, and the light one
  fails as a fill under white text.
- `--slate` (#7d7d7d) is the muted neutral for the mono micro-labels (dates, tags,
  offsets, table headers). #666 measured 3.4:1 on obsidian and failed AA for small
  text — don't darken it back. `--slate-2` (#8d8d8d) stays the body-copy grey.
- `assets/retrato.jpg` — the real portrait, tracked in the repo. It appears **only**
  as the small circular `.hero-about-avatar` beside the hero intro line: the owner
  asked for a small icon elsewhere, not a hero centrepiece, and refused any colour
  grade on the photo. Treatment is therefore neutral — `grayscale(1)`, 58px, thin
  border, no violet overlay, no radial mask, no blend mode. The `onerror` fallback to
  `assets/retrato-placeholder.svg` is only a safety net for a missing file. Swapping
  the file needs no other change.
- Copy voice: the owner asked for **direct, technical copy** and rejected the
  slogan register ("parece IA", e.g. "Escrevo software onde o controle é total").
  Keep sentences short, name the real mechanism, and never invent clients, dates
  or metrics.
- Contact channels are real now: `rodriguesjorhdam@gmail.com` and
  `+55 79 99605-1780`, the latter linked as WhatsApp (`https://wa.me/5579996051780`),
  on `index.html` and `contato.html`, plus the footer link to
  `https://github.com/bgszk`. No LinkedIn. If the number turns out not to be a
  WhatsApp line, point that entry at `tel:+5579996051780`.
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
