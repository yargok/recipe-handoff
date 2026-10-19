// Plain schema.org Recipe JSON-LD passthrough (a .json/.jsonld file).

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => (typeof v === 'string' ? v : v && (v.text || v.name)) || '';

function findRecipe(j) {
  if (Array.isArray(j)) return j.map(findRecipe).find(Boolean);
  if (!j || typeof j !== 'object') return null;
  const types = asArray(j['@type']);
  if (types.includes('Recipe')) return j;
  return findRecipe(j['@graph']);
}

function steps(v) {
  const out = [];
  for (const s of asArray(v)) {
    if (typeof s === 'string') out.push({ type: 'step', text: s });
    else if (s && s['@type'] === 'HowToSection') {
      out.push({ type: 'section', title: s.name || '' });
      out.push(...steps(s.itemListElement));
    } else if (s) {
      const t = text(s);
      if (t) out.push({ type: 'step', text: t, ...(s.name && s.text ? { name: s.name } : {}) });
    }
  }
  return out;
}

function convert(r) {
  const images = asArray(r.image)
    .map((i) => (typeof i === 'string' ? i : i && i.url))
    .filter((u) => /^https?:\/\//i.test(u || ''))
    .map((url) => ({ url }));
  const keywords = typeof r.keywords === 'string' ? r.keywords.split(',').map((k) => k.trim()) : asArray(r.keywords);
  return {
    sourceId: r['@id'] || r.url || '',
    title: String(r.name || 'Untitled recipe'),
    description: r.description || '',
    images,
    categories: [...asArray(r.recipeCategory), ...keywords].filter(Boolean),
    yield: asArray(r.recipeYield).join(', '),
    prepTime: r.prepTime || '',
    cookTime: r.cookTime || '',
    totalTime: r.totalTime || '',
    ingredients: asArray(r.recipeIngredient).map((t) => ({ type: 'item', text: String(t) })),
    instructions: steps(r.recipeInstructions),
    notes: '',
    nutrition: '',
    link: (r.isBasedOn && (r.isBasedOn.url || r.isBasedOn)) || '',
  };
}

function load(buf) {
  try {
    return findRecipe(JSON.parse(buf.toString('utf8')));
  } catch {
    return null;
  }
}

module.exports = {
  name: 'jsonld',
  detect: (buf) => !!load(buf),
  parse(buf) {
    return [convert(load(buf))];
  },
};
