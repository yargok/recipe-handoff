Place the signed `Send to HomeView.shortcut` here (`shortcuts sign` only runs on macOS).
The server offers the first `*.shortcut` file in this folder on `/setup`.
Bump `currentShortcutVersion` in `src/config.js` whenever a new version is published.

## Building the Shortcut (Shortcuts app)
1. Receive **Files** from the Share Sheet.
2. Import question: server address (e.g. `http://192.168.1.20:8765`).
3. **Get Contents of URL**: `<address>/api/recipes`, method POST, Request Body = **File** (the shared file),
   add headers `X-Shortcut-Version: 1` and `X-Filename: <File Name>`.
4. **Get Dictionary Value** `url`; **Get Dictionary Value** `updateAvailable`.
5. If `updateAvailable` is true: **Show Alert** "A newer version of this shortcut is available." and open `<address>/setup`.
6. **Open URLs**: `<url>?handoff=1`.
