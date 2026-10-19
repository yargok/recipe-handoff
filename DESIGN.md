# recipe-handoff - design notes

Share a recipe from a recipe app on iPhone, get a clean web page with schema.org Recipe markup served from a small home server, and continue on Apple HomeView (or any browser) using Safari's built-in cooking mode.

## Why this works
- HomeView's Safari has a "Start Cooking" mode that parses recipes formatted to Google's recipe structured data (schema.org `Recipe` as JSON-LD): ingredients, step-by-step view, tappable inline timers.
- Safari on iPhone hands off the open page to HomeView when the phone is held near it.
- Recipe apps (e.g. Mela) can't run on HomeView: there is no App Store, and only CarPlay-style audio/video apps project from iPhone. A web page is the way in.

## Flow
1. User shares a recipe file from the recipe app's share sheet to the "Send to HomeView" Shortcut.
2. Shortcut POSTs the file to the server, gets back a recipe URL, opens it in Safari with `?handoff=1`.
3. Page shows a "Continue on HomeView" banner (iPhone only), user holds iPhone near HomeView.
4. Alternative: a `/latest` page left open on HomeView jumps to the newest shared recipe automatically.

## Stack
- Node, small HTTP server (Express or Fastify), run under PM2 with `ecosystem.config.js`.
- Config via `.env` (commit `.env.example` only): `PORT` (default 8765), `HOST` (default 0.0.0.0), `DATA_DIR`, `PRUNE_DAYS` (default 7, 0 = never prune), optional `MAX_RECIPES`.
- Log to file with rotation (pm2-logrotate).
- Intended for home networks only. Document that it should not be exposed to the internet.

## Endpoints
- `POST /api/recipes` - accepts a recipe file (multipart or raw body). Detects format, converts, stores, returns `{ url }`. Also accepts `shortcutVersion` and returns `{ updateAvailable }` when a newer Shortcut exists.
- `GET /r/:slug` - recipe page with JSON-LD.
- `GET /latest` - most recently shared recipe. Open on HomeView, it should navigate to new recipes as they arrive (SSE or polling, then a full navigation so Safari re-detects the recipe).
- `GET /img/:file` - recipe images.
- `GET /version` - server and current Shortcut version.
- `GET /setup` - Shortcut install page (see Shortcut section).

## Storage and identity
- One page per recipe, keyed by a hash of the source app's recipe id (Mela's `id` can be a URL); fall back to a hash of the title.
- Slug: readable title slug plus short id fragment, e.g. `/r/chicken-tikka-3f9a`.
- Re-sharing overwrites the page (picks up edits) and updates `lastShared`.
- Nightly sweep deletes recipes not shared in `PRUNE_DAYS`.
- `.gitignore` the data directory so nobody commits their recipes or photos.

## Importer architecture
Each format is one adapter that converts into a single internal recipe shape; the renderer only knows the internal shape. Adding a format = one file + a test fixture.

Planned adapters, in order:
1. Mela: `.melarecipe` (single JSON) and `.melarecipes` (bulk export)
2. Paprika: `.paprikarecipes` (zip of gzipped JSON)
3. Crouton: `.crumb`
4. Plain JSON-LD passthrough

### Mela format (official spec: https://mela.recipes/fileformat/index.html)
- `.melarecipe` is a single JSON file. `.melarecipes` is a plain ZIP containing one `.melarecipe` per recipe.
- `id` (string): a UUID, or for web-imported recipes the source URL without scheme. Never use it raw in a URL path - hash it for the slug fragment and storage key.
- `title` (string).
- `text` (string): short description, Markdown links only. Map to schema.org `description`.
- `images` ([string]): base64-encoded images. Write to files, reference by URL.
- `categories` ([string]): category names (no commas allowed). Map to `recipeCategory` / `keywords`.
- `yield`, `prepTime`, `cookTime`, `totalTime` (strings, free text). Convert times to ISO 8601 durations (`PT15M`); leave out of markup if unparseable, still show on page. `totalTime` need not equal prep + cook.
- `ingredients` (string): `\n`-separated lines. Markdown: links, and `#` lines are group titles. Recipe markup has no ingredient groups: drop `#` lines from `recipeIngredient`, keep them as headings on the visible page. Strip link Markdown to plain text in markup.
- `instructions` (string): `\n`-separated steps. Markdown: `#` (section titles), `*`, `**`, links. `#` lines start a `HowToSection`; other lines are `HowToStep`s. A leading `**Bold title:**` becomes the step's `name`, the rest its `text`. Strip Markdown in markup, render it on the page.
- `notes`, `nutrition` (strings, Markdown `#` `*` `**` links): show on page. Skip nutrition in markup (free text, schema wants structured fields).
- `link` (string): the recipe's source, which may or may not be a URL. Use as `isBasedOn` only when it parses as a URL; otherwise show as plain text "Source: ...".
- Export-only fields, ignored on import: `favorite`, `wantToCook` (bools), `date` (seconds since 2001-01-01 UTC, Apple reference date).

### Schema.org mapping
`name`, `image` (URLs), `recipeIngredient`, `recipeInstructions` (HowToStep), `prepTime`, `cookTime`, `totalTime`, `recipeYield`, `recipeCategory` / `keywords`, `isBasedOn` (source link). Validate output with Google's Rich Results Test (code mode) and the schema.org validator.

## Page design
- Clean, readable on iPhone and on HomeView's small square display. System font, light/dark mode.
- Leave room at the bottom: HomeView overlays its Ingredients / Start Cooking buttons there.
- Handoff banner, shown only when `?handoff=1` is present, then removed from the URL with `history.replaceState` so HomeView receives the clean URL:
  - **Continue on HomeView**
  - Hold iPhone near HomeView to pick up this recipe in the kitchen.
- Dismiss button. Outlined phone icon in orange, translucent gray card.

## Shortcut
- Share Sheet input: files. Import question for the server address on install.
- POST file, read `url`, open in Safari with `?handoff=1`.
- Send `shortcutVersion`; show an alert if `updateAvailable` ("A newer version of this shortcut is available."), linking to `/setup`.
- Distribute via iCloud link in the README, plus a signed `.shortcut` file committed under `shortcut/`. Later: RoutineHub.

### Setup page (`GET /setup`)
Served by the server itself, meant to be opened on iPhone:
- "Add Shortcut" button: opens the iCloud link, or downloads the signed `.shortcut` file (served from `shortcut/`) so Safari offers to open it in Shortcuts.
- QR code for the setup page, so it can be scanned from another screen.
- The server's own address in large type with a copy button, ready for the Shortcut's import question.
- Limitation: the server can't embed its address in the Shortcut file. Shortcut files must be signed, and `shortcuts sign` only runs on macOS. The import question stays.

## Repo
- MIT license, README with a short setup, `.env.example`, `ecosystem.config.js`, sample recipe fixtures, tests for each adapter.
- Name avoids Apple trademarks; the pages work in any browser.

## Open questions (resolve when HomeView ships, Nov 13 2026)
- Does HomeView Safari detect recipes on plain HTTP LAN pages, or require HTTPS? (Fallback: reverse proxy with a local cert.)
- Does `/latest` navigating to a new recipe trigger Start Cooking the same way a normal page load does?
- Which phrasings in step text become tappable timers?
