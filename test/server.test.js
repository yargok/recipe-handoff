const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build } = require('../src/server');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n));
const mk = () =>
  build({
    logger: false,
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rh-')),
    shortcutDir: path.join(os.tmpdir(), 'nonexistent-shortcut-dir'),
    currentShortcutVersion: 2,
    maxUploadBytes: 10e6,
    pruneDays: 7,
    maxRecipes: 0,
    baseUrl: '',
    shortcutIcloudUrl: '',
  });

test('share, render, reshare, prune', async () => {
  const app = mk();
  const post = (body, headers = {}) =>
    app.inject({ method: 'POST', url: '/api/recipes?shortcutVersion=1', payload: body, headers: { 'content-type': 'application/octet-stream', ...headers } });

  const res = await post(fx('tikka.melarecipe'));
  assert.strictEqual(res.statusCode, 200);
  const j = res.json();
  assert.strictEqual(j.updateAvailable, true);
  assert.match(j.updateUrl, /\/setup$/);
  assert.match(j.url, /\/r\/chicken-tikka-masala-[0-9a-f]{4}$/);

  const page = await app.inject({ url: new URL(j.url).pathname + '?handoff=1' });
  assert.strictEqual(page.statusCode, 200);
  assert.match(page.body, /application\/ld\+json/);
  assert.match(page.body, /Chicken Tikka &lt;Masala&gt;/);
  assert.ok(!page.body.includes('<Masala>'));
  const ld = JSON.parse(page.body.match(/ld\+json">(.*?)<\/script>/)[1]);
  assert.match(ld.image[0], /^http:\/\/localhost:80\/img\/|^http:\/\/.+\/img\/[0-9a-f]+-0\.png$/);

  assert.match(ld.datePublished, /^\d{4}-\d{2}-\d{2}T/);

  const img = await app.inject({ url: new URL(ld.image[0]).pathname });
  assert.strictEqual(img.statusCode, 200);
  assert.strictEqual(img.headers['content-type'], 'image/png');
  assert.strictEqual((await app.inject({ url: '/img/..%2F..%2Fetc%2Fpasswd' })).statusCode, 404);

  // Re-share overwrites rather than duplicating.
  await post(fx('tikka.melarecipe'));
  assert.strictEqual(app.store.index.size, 1);

  // Bulk
  const bulk = (await post(fx('bulk.melarecipes'))).json();
  assert.strictEqual(bulk.urls.length, 2);
  assert.strictEqual(app.store.index.size, 2);

  assert.strictEqual((await app.inject({ url: '/latest' })).statusCode, 200);
  assert.strictEqual((await app.inject({ url: '/latest?go' })).statusCode, 302);
  assert.strictEqual((await app.inject({ url: '/api/latest' })).json().title.length > 0, true);

  // Prune: nothing fresh is removed; backdate and it goes.
  assert.strictEqual(app.store.prune({ pruneDays: 7, maxRecipes: 0 }), 0);
  for (const r of app.store.index.values()) r.lastShared -= 8 * 864e5;
  assert.strictEqual(app.store.prune({ pruneDays: 7, maxRecipes: 0 }), 2);
  assert.strictEqual(app.store.index.size, 0);
});

test('bad uploads and misc endpoints', async () => {
  const app = mk();
  const bad = await app.inject({ method: 'POST', url: '/api/recipes', payload: 'nope', headers: { 'content-type': 'text/plain' } });
  assert.strictEqual(bad.statusCode, 422);
  assert.strictEqual((await app.inject({ url: '/r/missing-abcd' })).statusCode, 404);
  assert.strictEqual((await app.inject({ url: '/version' })).json().shortcut, 2);
  const setup = await app.inject({ url: '/setup' });
  assert.match(setup.body, /<svg/);
});

test('multipart upload', async () => {
  const app = mk();
  const boundary = 'XBOUNDARY';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="shortcutVersion"\r\n\r\n2\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="t.melarecipe"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    fx('tikka.melarecipe'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json().updateAvailable, false);
  assert.strictEqual('updateUrl' in res.json(), false);
});

test('recipe without photo gets placeholder image in markup only', async () => {
  const app = mk();
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fx('stew.paprikarecipes'), headers: { 'content-type': 'application/octet-stream' } });
  const page = await app.inject({ url: new URL(res.json().url).pathname });
  const ld = JSON.parse(page.body.match(/ld\+json">(.*?)<\/script>/)[1]);
  assert.match(ld.image[0], /\/img\/placeholder\.png$/);
  assert.ok(!page.body.includes('class="hero"'));
  const img = await app.inject({ url: '/img/placeholder.png' });
  assert.strictEqual(img.headers['content-type'], 'image/png');
  assert.strictEqual(img.rawPayload.subarray(1, 4).toString(), 'PNG');
});
