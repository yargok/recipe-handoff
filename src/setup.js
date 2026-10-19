const QRCode = require('qrcode');
const fs = require('fs');
const { escapeHtml: e } = require('./markdown');

function shortcutFile(dir) {
  try {
    return fs.readdirSync(dir).find((f) => f.endsWith('.shortcut')) || null;
  } catch {
    return null;
  }
}

async function renderSetup({ origin, config }) {
  const setupUrl = `${origin}/setup`;
  const qr = await QRCode.toString(setupUrl, { type: 'svg', margin: 1, width: 200 });
  const file = shortcutFile(config.shortcutDir);
  const addHref = config.shortcutIcloudUrl || (file ? `/shortcut/${encodeURIComponent(file)}` : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Set up Send to HomeView</title>
<style>
:root{color-scheme:light dark;--accent:#ff9500;--card:rgba(120,120,128,.14);--muted:#6e6e73}
@media(prefers-color-scheme:dark){:root{--muted:#9a9aa0}}
body{margin:0;font:17px/1.45 -apple-system,system-ui,sans-serif;padding:24px 18px;max-width:560px;margin:0 auto}
h1{font-size:1.7rem} .card{background:var(--card);border-radius:18px;padding:18px;margin:18px 0}
.addr{font:600 1.5rem/1.2 ui-monospace,Menlo,monospace;word-break:break-all}
button,.btn{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:12px;padding:12px 20px;font:600 1rem system-ui;text-decoration:none;cursor:pointer}
.btn[aria-disabled=true]{opacity:.45}
small{color:var(--muted)} .qr{background:#fff;border-radius:12px;display:inline-block;padding:6px;line-height:0}
</style></head><body>
<h1>Send to HomeView</h1>
<p>Share a recipe from your recipe app to a Shortcut, and keep cooking on HomeView.</p>
<div class="card"><h2>1. Add the Shortcut</h2>
${addHref ? `<a class="btn" href="${e(addHref)}">Add Shortcut</a>` : '<span class="btn" aria-disabled="true">Add Shortcut</span><p><small>No Shortcut is published on this server yet (set SHORTCUT_ICLOUD_URL or add a signed .shortcut under shortcut/).</small></p>'}
</div>
<div class="card"><h2>2. Server address</h2>
<p>When asked for the server address during install, enter:</p>
<div class="addr" id="addr">${e(origin)}</div>
<p><button type="button" id="copy">Copy</button></p>
<small>The Shortcut file can&rsquo;t embed this address (Shortcuts must be signed on macOS), so the install question stays.</small></div>
<div class="card"><h2>Open on iPhone</h2>
<div class="qr">${qr}</div><p><small>${e(setupUrl)}</small></p></div>
<p><small>For home networks only. Do not expose this server to the internet.</small></p>
<script>
document.getElementById('copy').onclick=function(){var t=document.getElementById('addr').textContent,b=this;
(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(function(){var r=document.createRange();r.selectNode(document.getElementById('addr'));getSelection().removeAllRanges();getSelection().addRange(r);document.execCommand('copy')}).then(function(){b.textContent='Copied'});};
</script></body></html>`;
}

module.exports = { renderSetup, shortcutFile };
