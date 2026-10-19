// Renderer: knows only the internal recipe shape.
//
// Internal recipe:
//   { title, description, images: [url], categories: [str], yield, prepTime, cookTime, totalTime,
//     ingredients: [{type:'heading'|'item', text}],
//     instructions: [{type:'section', title} | {type:'step', name?, text}],
//     notes, nutrition, link }
// Text fields may contain the Markdown subset in markdown.js.
const { escapeHtml: e, stripMarkdown, inlineHtml, blockHtml } = require('./markdown');
const { toIsoDuration } = require('./duration');

const isUrl = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

function buildJsonLd(r, abs) {
  const ld = { '@context': 'https://schema.org', '@type': 'Recipe', name: r.title };
  if (r.description) ld.description = stripMarkdown(r.description);
  if (r.images.length) ld.image = r.images.map(abs);
  const items = r.ingredients.filter((i) => i.type === 'item').map((i) => stripMarkdown(i.text));
  if (items.length) ld.recipeIngredient = items;

  const toStep = (s) => {
    const o = { '@type': 'HowToStep', text: stripMarkdown(s.text) };
    if (s.name) o.name = stripMarkdown(s.name);
    return o;
  };
  const out = [];
  let section = null;
  for (const s of r.instructions) {
    if (s.type === 'section') {
      section = { '@type': 'HowToSection', name: stripMarkdown(s.title), itemListElement: [] };
      out.push(section);
    } else if (section) section.itemListElement.push(toStep(s));
    else out.push(toStep(s));
  }
  const nonEmpty = out.filter((s) => s['@type'] !== 'HowToSection' || s.itemListElement.length);
  if (nonEmpty.length) ld.recipeInstructions = nonEmpty;

  for (const k of ['prepTime', 'cookTime', 'totalTime']) {
    const d = toIsoDuration(r[k]);
    if (d) ld[k] = d;
  }
  if (r.yield) ld.recipeYield = String(r.yield);
  if (r.categories.length) {
    ld.recipeCategory = r.categories[0];
    ld.keywords = r.categories.join(', ');
  }
  if (r.link && isUrl(r.link)) ld.isBasedOn = r.link;
  return ld;
}

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1c1c1e;--muted:#6e6e73;--line:#e5e5ea;--accent:#ff9500;--card:rgba(120,120,128,.14)}
@media(prefers-color-scheme:dark){:root{--bg:#000;--fg:#f2f2f7;--muted:#9a9aa0;--line:#2c2c2e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:720px;margin:0 auto;padding:16px 18px 160px}
h1{font-size:1.9rem;line-height:1.15;margin:.3em 0 .2em}
h2{font-size:1.2rem;margin:1.6em 0 .5em}
h3{font-size:1rem;margin:1.1em 0 .3em;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
a{color:var(--accent)}
.hero{width:100%;max-height:50vh;object-fit:cover;border-radius:14px;display:block}
.meta{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--muted);font-size:.9rem;margin:.6em 0}
.meta b{color:var(--fg);font-weight:600}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:.6em 0}
.tags span{background:var(--card);border-radius:999px;padding:2px 10px;font-size:.8rem}
ul.ing{list-style:none;padding:0;margin:0}
ul.ing li{padding:7px 0;border-bottom:1px solid var(--line)}
ol.steps{padding-left:1.4em;margin:0}
ol.steps li{padding:6px 0 6px 4px}
ol.steps li::marker{color:var(--accent);font-weight:700}
.notes p,.notes ul{margin:.4em 0}
.src{color:var(--muted);font-size:.9rem;margin-top:1.6em}
#handoff{position:fixed;left:12px;right:12px;top:12px;max-width:560px;margin:0 auto;z-index:10;display:none;gap:12px;align-items:center;padding:14px;border-radius:18px;background:var(--card);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);box-shadow:0 4px 24px rgba(0,0,0,.15)}
#handoff.show{display:flex}
#handoff svg{flex:none;width:34px;height:34px;stroke:var(--accent);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#handoff strong{display:block}
#handoff small{color:var(--muted);display:block;line-height:1.3}
#handoff button{margin-left:auto;border:0;background:transparent;color:var(--muted);font-size:1.5rem;line-height:1;padding:4px 8px;cursor:pointer}
`;

const BANNER = `
<div id="handoff" role="status">
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/></svg>
  <div><strong>Continue on HomeView</strong><small>Hold iPhone near HomeView to pick up this recipe in the kitchen.</small></div>
  <button type="button" aria-label="Dismiss" onclick="this.parentNode.classList.remove('show')">&times;</button>
</div>
<script>
(function(){
  var u=new URL(location.href);
  if(!u.searchParams.has('handoff'))return;
  if(/iPhone/.test(navigator.userAgent))document.getElementById('handoff').classList.add('show');
  u.searchParams.delete('handoff');
  history.replaceState(null,'',u.pathname+u.search+u.hash);
})();
</script>`;

function renderRecipe(r, { origin = '' } = {}) {
  const abs = (u) => (/^https?:\/\//i.test(u) ? u : origin + u);
  const ld = buildJsonLd(r, abs);
  const jsonLd = JSON.stringify(ld).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

  const meta = [];
  for (const [label, key] of [['Prep', 'prepTime'], ['Cook', 'cookTime'], ['Total', 'totalTime']]) {
    if (r[key]) meta.push(`<span>${label} <b>${e(r[key])}</b></span>`);
  }
  if (r.yield) meta.push(`<span>Yield <b>${e(r.yield)}</b></span>`);

  const ing = r.ingredients
    .map((i) => (i.type === 'heading' ? `</ul><h3>${inlineHtml(i.text)}</h3><ul class="ing">` : `<li>${inlineHtml(i.text)}</li>`))
    .join('\n');

  let steps = '';
  let open = false;
  for (const s of r.instructions) {
    if (s.type === 'section') {
      if (open) steps += '</ol>';
      steps += `<h3>${inlineHtml(s.title)}</h3><ol class="steps">`;
      open = true;
    } else {
      if (!open) {
        steps += '<ol class="steps">';
        open = true;
      }
      steps += `<li>${s.name ? `<strong>${inlineHtml(s.name)}:</strong> ` : ''}${inlineHtml(s.text)}</li>`;
    }
  }
  if (open) steps += '</ol>';

  const source = r.link
    ? `<p class="src">Source: ${isUrl(r.link) ? `<a href="${e(r.link)}">${e(r.link)}</a>` : e(r.link)}</p>`
    : '';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${e(r.title)}</title>
<meta name="robots" content="noindex">
<style>${CSS}</style>
<script type="application/ld+json">${jsonLd}</script>
</head><body>
${BANNER}
<main>
${r.images[0] ? `<img class="hero" src="${e(r.images[0])}" alt="">` : ''}
<h1>${e(r.title)}</h1>
${r.description ? `<div class="notes">${blockHtml(r.description)}</div>` : ''}
${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
${r.categories.length ? `<div class="tags">${r.categories.map((c) => `<span>${e(c)}</span>`).join('')}</div>` : ''}
${ing ? `<h2>Ingredients</h2><ul class="ing">${ing}</ul>` : ''}
${steps ? `<h2>Instructions</h2>${steps}` : ''}
${r.notes ? `<h2>Notes</h2><div class="notes">${blockHtml(r.notes)}</div>` : ''}
${r.nutrition ? `<h2>Nutrition</h2><div class="notes">${blockHtml(r.nutrition)}</div>` : ''}
${source}
</main>
</body></html>`;
}

module.exports = { renderRecipe, buildJsonLd };
