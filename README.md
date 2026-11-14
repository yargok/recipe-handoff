# recipe-handoff

Send a recipe from your recipe app to the kitchen display. Share it from your iPhone and recipe-handoff turns it into a clean web page with schema.org `Recipe` markup, so Safari's cooking mode (Start Cooking, step-by-step view, tappable timers) works on Apple HomeView or any browser.

> **Home networks only.** There is no authentication. Do not expose this server to the internet.

## What it does
- Accepts the recipe files your app already exports: **Mela** (`.melarecipe`, `.melarecipes`), **Paprika** (`.paprikarecipes`), **Crouton** (`.crumb`), or plain schema.org **JSON-LD**.
- Serves each recipe as a fast, readable page: photo, ingredients with group headings, steps, notes, source link. Light and dark mode, sized for iPhone and a small square display.
- Re-sharing a recipe updates its page, so edits carry over.
- Cleans up after itself: recipes not shared for 7 days are removed (configurable).

## Using it
1. **Share the recipe** from your recipe app's share sheet and choose the **Send Recipe to HomeView** shortcut. The app should share the recipe as a file (Mela, Paprika or Crouton's native export), not as text or a link.
2. The recipe opens in Safari on your phone. Now get it onto the kitchen display, either way:
   - **Handoff:** hold your iPhone near HomeView. A "Continue on HomeView" banner appears on the phone; handoff picks up the same page.
   - **Waiting page:** bookmark `http://<server>:8765/latest` on HomeView and leave it open. It shows "Waiting for a recipe" and jumps to each recipe the moment you share one, with nothing to touch in the kitchen. Open `/latest?go` to jump to the most recent recipe immediately.
3. Tap **Start Cooking** on HomeView.

## Install the server
Run it on any always-on machine on your home network (a Raspberry Pi, NAS, or mini PC). Pick one.

### PM2
Needs Node 18+.
```bash
git clone https://github.com/yargok/recipe-handoff.git
cd recipe-handoff
npm install
cp .env.example .env        # optional; edit settings
pm2 start ecosystem.config.js
pm2 save && pm2 startup
pm2 install pm2-logrotate   # rotates logs/out.log and logs/error.log
```
Plain `npm start` also works.

### Docker
Save [`compose.yaml`](compose.yaml) on the server, adjust the settings in it, and run:
```bash
docker compose up -d
```
The image (`ghcr.io/yargok/recipe-handoff`, amd64 and arm64) keeps recipes in a named volume. To build it yourself, swap the `image:` line for `build: .` in a clone of this repo.

## Install the shortcut on your iPhone
**Quickest:** open the [Send Recipe to HomeView shortcut](https://www.icloud.com/shortcuts/1b76ea79550c47749e56d5971b0301cb) on your iPhone and tap **Add Shortcut**. When asked for the server address, enter yours, e.g. `http://192.168.1.20:8765`.

**From your own server:** open `http://<server>:8765/setup` on your iPhone (or scan the QR code on that page from another screen). Tap **Add Shortcut**, and when asked for the server address, enter the one shown on the page, e.g. `http://192.168.1.20:8765`.

The shortcut is a signed file in [`shortcut/`](shortcut/), which your server hands out, so everyone running their own server gets it from their own `/setup` page. You can also set `SHORTCUT_ICLOUD_URL` to your own iCloud share link and the button will use that instead.

## Settings
Set as environment variables: in the `environment:` block of `compose.yaml`, or in `.env` when running with PM2 or `npm start`.

| Variable | Default | |
|---|---|---|
| `PORT` | 8765 | |
| `HOST` | 0.0.0.0 | |
| `DATA_DIR` | ./data | recipes and images (`/data` in Docker) |
| `PRUNE_DAYS` | 7 | delete recipes not shared in N days; 0 = never |
| `MAX_RECIPES` | unset | cap; oldest by last share go first |
| `BASE_URL` | derived | address used in links and the QR code |
| `SHORTCUT_ICLOUD_URL` | unset | iCloud link for the "Add Shortcut" button |

The nightly cleanup runs at 03:00 server time (set `TZ` in Docker).

## HTTP API
- `POST /api/recipes`: multipart (`file`) or raw body (`X-Filename` header). Returns `{ url, urls, format, updateAvailable }`. Handy for scripting without the shortcut:
  ```bash
  curl -X POST http://<server>:8765/api/recipes -H 'X-Filename: dinner.melarecipe' --data-binary @dinner.melarecipe
  ```
- `GET /r/:slug`: recipe page. `GET /latest`: waiting page. `GET /setup`: shortcut install page. `GET /version`.

## Development
```bash
npm test
```
Adding a recipe format is one file in `src/adapters/` that returns the internal recipe shape (see `src/render.js`), registered in `src/adapters/index.js`, plus a fixture and test. See [DESIGN.md](DESIGN.md) for background.

MIT licensed.
