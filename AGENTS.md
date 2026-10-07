# Project notes

## What this is
A dependency-free static site: `index.html`, `game.html`, `codes.html`, `style.css`,
`script.js`, plus `lain.mp3` (background audio). There is no package.json, no build
step, no bundler, no backend and no database.

## Running it (Base44 dev environment)
```
docker compose -f docker-compose.base44.yml up -d --build
```
- Single service `web`: plain `node:22` image with the repo bind-mounted at `/app`,
  running `live-server` on host port **3000** (live reload, so HTML/CSS/JS edits
  appear in the preview without any restart).
- The global `live-server` install happens on every container start; it needs
  outbound npm access. If npm is unreachable, swap the command for
  `python3 -m http.server 3000` (no live reload — call `reload_preview` after edits).
- No secrets or `.env` file are involved; nothing is read from `/run/base44/app.env`.

## Quirks
- `game.html` embeds an external iframe (`retrogames.cc`); it will only render where
  the browser can reach that third party. The avatars on the pages are also external
  images (pinterest CDN) and Google Fonts is loaded from the network.
- `script.js` drives a canvas particle background and the "Iniciar música" button on
  `index.html`; audio autoplay is blocked until the user clicks that button.

## Verifying it works
- `curl -sS http://localhost:3000/` should return the home page HTML (title `Jordan`).
- `http://localhost:3000/game.html` and `http://localhost:3000/codes.html` should each
  return their own titles, and `/style.css`, `/script.js`, `/lain.mp3` must return 200.
- Browser-side: the particle canvas paints, the music button starts `lain.mp3`, and the
  "Copiar" buttons on `codes.html` copy the adjacent snippet.
