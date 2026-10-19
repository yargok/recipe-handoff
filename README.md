# recipe-handoff

Share a recipe from a recipe app on iPhone, get a clean web page with schema.org `Recipe` markup served from a small home server, and continue on Apple HomeView (or any browser) using Safari's built-in cooking mode.

> **Home networks only.** There is no authentication. Do not expose this server to the internet.

## Quick start
```bash
npm install
cp .env.example .env     # edit if needed
npm start                # http://<host>:8765
```
Open `http://<host>:8765/setup` on your iPhone to install the Shortcut (button, QR code, and the server address to paste into the Shortcut's import question).

### Run under PM2
```bash
pm2 start ecosystem.config.js
pm2 save && pm2 startup
pm2 install pm2-logrotate   # rotates logs/out.log and logs/error.log
```

## Config (`.env`)
| Var | Default | |
|---|---|---|
| `PORT` | 8765 | |
| `HOST` | 0.0.0.0 | |
| `DATA_DIR` | ./data | recipes and images (git-ignored) |
| `PRUNE_DAYS` | 7 | delete recipes not shared in N days; 0 = never |
| `MAX_RECIPES` | unset | cap; oldest by last share go first |
| `BASE_URL` | derived | public address used in links/QR |
| `SHORTCUT_ICLOUD_URL` | unset | iCloud link for the "Add Shortcut" button |

## Endpoints
- `POST /api/recipes` – multipart (`file`, optional `shortcutVersion`) or raw body (`X-Filename`, `X-Shortcut-Version` headers). Returns `{ url, urls, format, updateAvailable }`.
- `GET /r/:slug` – recipe page with JSON-LD. `?handoff=1` shows the iPhone banner, then strips itself from the URL.
- `GET /latest` – leave open on HomeView; navigates to each newly shared recipe (SSE, with polling fallback). `/latest?go` jumps to the newest now.
- `GET /img/:file`, `GET /version`, `GET /setup`.

Re-sharing a recipe overwrites its page. A nightly sweep (03:00) removes recipes older than `PRUNE_DAYS`.

## Formats
| Format | Status |
|---|---|
| Mela `.melarecipe`, `.melarecipes` | supported |
| Paprika `.paprikarecipes` | supported |
| schema.org JSON-LD (`.json`) | supported |
| Crouton `.crumb` | supported |

Adding a format = one file in `src/adapters/` that returns the internal recipe shape (see `src/render.js`), registered in `src/adapters/index.js`, plus a fixture and test.

## Tests
```bash
npm test
```
Validate a page's markup with Google's Rich Results Test (code mode) and the schema.org validator.

## Open questions (verify when HomeView ships)
- Does HomeView Safari detect recipes on plain HTTP LAN pages, or require HTTPS?
- Does `/latest` navigating to a new recipe trigger Start Cooking like a normal load?
- Which step phrasings become tappable timers?

MIT licensed.
