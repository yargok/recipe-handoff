const Fastify = require('fastify');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const { Store } = require('./store');
const { importRecipes } = require('./adapters');
const { renderRecipe } = require('./render');
const { renderSetup, shortcutFile } = require('./setup');
const { escapeHtml: e } = require('./markdown');
const { PLACEHOLDER_PATH, placeholderPng } = require('./placeholder');

const MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

function build(config) {
  const app = Fastify({ logger: config.logger ?? true, bodyLimit: config.maxUploadBytes });
  const store = new Store(config.dataDir);
  app.decorate('store', store);

  app.register(require('@fastify/multipart'), { limits: { fileSize: config.maxUploadBytes, files: 1 } });
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => done(null, body));

  const originOf = (req) => config.baseUrl || `${req.protocol}://${req.headers.host}`;

  app.post('/api/recipes', async (req, reply) => {
    let buf;
    let filename = req.headers['x-filename'] || '';
    let shortcutVersion = req.headers['x-shortcut-version'] || req.query.shortcutVersion;
    if (req.isMultipart()) {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          buf = await part.toBuffer();
          filename = part.filename || filename;
        } else if (part.fieldname === 'shortcutVersion') {
          shortcutVersion = part.value;
        }
      }
    } else {
      buf = req.body;
    }
    if (!Buffer.isBuffer(buf) || !buf.length) return reply.code(400).send({ error: 'No recipe file received' });

    let result;
    try {
      result = importRecipes(buf, String(filename));
    } catch (err) {
      req.log.warn({ err: err.message }, 'import failed');
      return reply.code(422).send({ error: err.message });
    }
    const origin = originOf(req);
    const saved = result.recipes.map((r) => store.save(r));
    const urls = saved.map((r) => `${origin}/r/${r.slug}`);
    const v = parseInt(shortcutVersion, 10);
    const updateAvailable = Number.isFinite(v) && v < config.currentShortcutVersion;
    return {
      url: urls[0],
      urls,
      format: result.format,
      updateAvailable,
      // Only present when an update exists, so Shortcuts can test it with "has any value".
      ...(updateAvailable ? { updateUrl: `${origin}/setup` } : {}),
    };
  });

  app.get('/r/:slug', async (req, reply) => {
    const rec = store.bySlug(req.params.slug);
    if (!rec) return reply.code(404).type('text/html').send('<h1>Recipe not found</h1>');
    if (rec.slug !== req.params.slug) {
      const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return reply.redirect(301, `/r/${rec.slug}${q}`);
    }
    return reply
      .header('Cache-Control', 'no-cache')
      .type('text/html; charset=utf-8')
      .send(renderRecipe(rec, { origin: originOf(req) }));
  });

  // Bookmark icon for /latest only. Deliberately not /apple-touch-icon.png, which Safari would
  // request for every page and use instead of a recipe's own photo.
  const assetsDir = path.join(config.root || path.join(__dirname, '..'), 'assets');
  for (const [route, file, type] of [
    ['/latest-hero.png', 'latest-hero.png', 'image/png'], // big image on the page; Safari uses it as the history thumbnail
    ['/latest-bookmark-icon.png', 'latest-touch-icon.png', 'image/png'], // apple-touch-icon / icon link
    ['/latest-icon.svg', 'latest-icon.svg', 'image/svg+xml'],
  ]) {
    const body = fs.readFileSync(path.join(assetsDir, file));
    app.get(route, async (req, reply) => reply.header('Cache-Control', 'public, max-age=86400').type(type).send(body));
  }

  const placeholder = placeholderPng();
  app.get(PLACEHOLDER_PATH, async (req, reply) =>
    reply.header('Cache-Control', 'public, max-age=86400').type('image/png').send(placeholder),
  );

  app.get('/img/:file', async (req, reply) => {
    const p = store.imagePath(req.params.file);
    if (!p) return reply.code(404).send('Not found');
    return reply
      .header('Cache-Control', 'public, max-age=86400')
      .type(MIME[path.extname(p).slice(1)])
      .send(fs.createReadStream(p));
  });

  const latestInfo = (req) => {
    const r = store.latest();
    return r ? { url: `${originOf(req)}/r/${r.slug}`, title: r.title, lastShared: r.lastShared } : null;
  };

  app.get('/api/latest', async (req) => latestInfo(req) || {});

  // Server-sent events: pushes {url, title, lastShared} whenever a recipe is shared.
  app.get('/events', (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (rec) =>
      res.write(`data: ${JSON.stringify({ url: `${originOf(req)}/r/${rec.slug}`, title: rec.title, lastShared: rec.lastShared })}\n\n`);
    res.write('retry: 3000\n\n');
    const onShared = (rec) => send(rec);
    store.on('shared', onShared);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.raw.on('close', () => {
      clearInterval(ping);
      store.off('shared', onShared);
    });
  });

  // Leave open on HomeView: waits, then does a full navigation to each newly shared recipe.
  app.get('/latest', async (req, reply) => {
    const rec = store.latest();
    if (req.query.go !== undefined && rec) return reply.redirect(302, `/r/${rec.slug}`);
    const since = rec ? rec.lastShared : 0;
    return reply.header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Waiting for a recipe</title>
<link rel="apple-touch-icon" href="/latest-bookmark-icon.png">
<link rel="icon" type="image/png" href="/latest-bookmark-icon.png">
<link rel="icon" type="image/svg+xml" href="/latest-icon.svg">
<meta property="og:title" content="Waiting for a recipe">
<meta property="og:image" content="${originOf(req)}/latest-hero.png">
<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Waiting for a recipe',
      image: `${originOf(req)}/latest-hero.png`,
      primaryImageOfPage: { '@type': 'ImageObject', url: `${originOf(req)}/latest-hero.png`, width: 512, height: 512 },
    }).replace(/</g, '\\u003c')}</script>
<style>
html,body{margin:0;height:100%;background:#1c1c1e;color:#f2f2f7;font:17px/1.35 -apple-system,system-ui,sans-serif}
.hero{display:block;width:100%;height:100vh;height:100dvh;object-fit:contain}
.box{position:fixed;left:14px;right:14px;bottom:14px;max-width:520px;margin:0 auto;padding:14px 16px;border-radius:18px;text-align:center;background:rgba(120,120,128,.32);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
h1{font-size:1.25rem;margin:0 0 .2em}p{margin:.2em 0}a{color:#ff9500}small{opacity:.75}
</style></head>
<body><img class="hero" src="/latest-hero.png" alt="">
<div class="box"><h1>Waiting for a recipe&hellip;</h1>
<p>Share one from your iPhone and it will open here.</p>
${rec ? `<p><small>Last shared: <a href="/latest?go">${e(rec.title)}</a></small></p>` : ''}</div>
<script>
var since=${since};
function go(d){if(d&&d.url&&d.lastShared>since)location.href=d.url}
if(window.EventSource){var es=new EventSource('/events');es.onmessage=function(m){go(JSON.parse(m.data))}}
setInterval(function(){fetch('/api/latest',{cache:'no-store'}).then(function(r){return r.json()}).then(go).catch(function(){})},5000);
</script></body></html>`);
  });

  app.get('/version', async () => ({
    server: pkg.version,
    shortcut: config.currentShortcutVersion,
  }));

  app.get('/setup', async (req, reply) =>
    reply.type('text/html; charset=utf-8').send(await renderSetup({ origin: originOf(req), config })),
  );

  app.get('/shortcut/:file', async (req, reply) => {
    const f = shortcutFile(config.shortcutDir);
    if (!f || f !== req.params.file) return reply.code(404).send('Not found');
    return reply
      .header('Content-Disposition', `attachment; filename="${f}"`)
      .type('application/octet-stream')
      .send(fs.createReadStream(path.join(config.shortcutDir, f)));
  });

  app.get('/', async (req, reply) => reply.redirect(302, '/setup'));

  return app;
}

module.exports = { build };
