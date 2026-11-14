The signed `Send_Recipe_to_HomeView.shortcut` in this folder is what `/setup` offers on the "Add Shortcut" button (the first `*.shortcut` file here is served). Shortcuts must be signed on macOS (`shortcuts sign`).

## Sharing it
- **Users of this repo:** nothing to do. Each server serves the file from its own `/setup` page, and the shortcut asks for that server's address when it is added.
- **Direct download:** the file can also be attached to a GitHub release. On iPhone, opening it from Safari or Files offers "Add Shortcut".
- **iCloud link:** https://www.icloud.com/shortcuts/1b76ea79550c47749e56d5971b0301cb (linked from the main README). To make your own, open the shortcut in the Shortcuts app, tap Share, then Copy iCloud Link. Set `SHORTCUT_ICLOUD_URL` to a link to have `/setup` use it instead of the bundled file.

When publishing a new version, bump `currentShortcutVersion` in `src/config.js` so older installs are told an update exists.

## What the shortcut does
1. Receives **Files** from the share sheet.
2. Import question: server address (e.g. `http://192.168.1.20:8765`).
3. **Get Contents of URL**: `<address>/api/recipes`, POST, request body = the shared file, with headers `X-Shortcut-Version: 1` and `X-Filename: <File Name>`.
4. Reads `url` and `updateAvailable` from the reply; if an update exists, alerts and opens `<address>/setup`.
5. **Open URLs**: `<url>?handoff=1`.
