// Crouton: .crumb = single UTF-8 JSON recipe (schema: https://gist.github.com/au5ton/55cd284e51cee3307cc2aff537211cf9).
// Ingredients are structured (amount + unit + name) and are turned back into readable lines.
const { sniffImage } = require('./util');

const UNITS = {
  ITEM: '', TEASPOON: 'tsp', TABLESPOON: 'Tbsp', CUP: 'cup', FLUID_OUNCE: 'fl oz', MILLS: 'ml',
  CENTILITER: 'cl', DECILITER: 'dl', LITRES: 'L', PINCH: 'pinch', OUNCE: 'oz', POUND: 'lb',
  GRAMS: 'g', KGS: 'kg', BOTTLE: 'bottle', CAN: 'can', BUNCH: 'bunch', PACKET: 'packet',
};

const FRACTIONS = [[1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']];

function formatAmount(n) {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.01) return String(whole);
  const hit = FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.02);
  if (hit) return whole ? `${whole} ${hit[1]}` : hit[1];
  return String(Math.round(n * 100) / 100);
}

const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

function ingredientLine(entry) {
  // The app appends cost annotations like " ($0.16)" to names.
  const name = String(entry.ingredient.name).replace(/\s*\(\$[\d.,]+\)\s*$/, '').trim();
  const q = entry.quantity || {};
  const unit = UNITS[q.quantityType] ?? '';
  return [typeof q.amount === 'number' ? formatAmount(q.amount) : '', unit, name].filter(Boolean).join(' ');
}

const minutes = (n) => (Number.isFinite(n) && n > 0 ? `${n} min` : '');

function convert(j) {
  if (!j || typeof j.name !== 'string') throw new Error('Not a Crouton recipe (missing name)');
  const images = (Array.isArray(j.images) ? j.images : [])
    .filter((b) => typeof b === 'string' && b)
    .map((b) => {
      const buffer = Buffer.from(b, 'base64');
      return { buffer, ext: sniffImage(buffer) };
    })
    .filter((i) => i.buffer.length);
  return {
    sourceId: j.uuid || '',
    title: j.name.trim() || 'Untitled recipe',
    description: '',
    images,
    categories: (Array.isArray(j.tags) ? j.tags : []).filter((t) => typeof t === 'string' && t),
    yield: j.serves ? `${j.serves} servings` : '',
    prepTime: minutes(j.duration),
    cookTime: minutes(j.cookingDuration),
    totalTime: '',
    ingredients: (Array.isArray(j.ingredients) ? [...j.ingredients].sort(byOrder) : [])
      .filter((e) => e && e.ingredient && e.ingredient.name)
      .map((e) =>
        e.quantity && e.quantity.quantityType === 'SECTION'
          ? { type: 'heading', text: String(e.ingredient.name).trim() }
          : { type: 'item', text: ingredientLine(e) },
      ),
    instructions: (Array.isArray(j.steps) ? [...j.steps].sort(byOrder) : [])
      .filter((s) => s && typeof s.step === 'string' && s.step.trim())
      .map((s) => (s.isSection ? { type: 'section', title: s.step.trim() } : { type: 'step', text: s.step.trim() })),
    notes: typeof j.notes === 'string' ? j.notes : '',
    // Stored as "Label: value,\nLabel: value"; drop the trailing commas.
    nutrition: typeof j.neutritionalInfo === 'string' ? j.neutritionalInfo.replace(/,\s*$/gm, '') : '',
    link: j.webLink || j.sourceName || '',
  };
}

function load(buf) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  name: 'crouton',
  detect(buf, filename = '') {
    if (/\.crumb$/i.test(filename)) return true;
    const j = load(buf);
    return !!j && typeof j.name === 'string' && typeof j.uuid === 'string' && Array.isArray(j.steps) && Array.isArray(j.ingredients);
  },
  parse(buf) {
    const j = load(buf);
    if (!j) throw new Error('Crouton file is not valid JSON');
    return [convert(j)];
  },
};
