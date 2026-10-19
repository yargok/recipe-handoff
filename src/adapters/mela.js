// Mela: .melarecipe (single JSON) and .melarecipes (ZIP of .melarecipe files).
// Spec: https://mela.recipes/fileformat/index.html
const { unzipSync, strFromU8 } = require('fflate');
const { sniffImage } = require('./util');

const lines = (s) => (typeof s === 'string' ? s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []);

function parseInstructions(text) {
  return lines(text).map((line) => {
    const h = line.match(/^#+\s*(.*)$/);
    if (h) return { type: 'section', title: h[1] };
    const stripped = line.replace(/^[*-]\s+(?=\*\*)/, '');
    const b = stripped.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (b && b[2]) {
      return { type: 'step', name: b[1].replace(/[:：]\s*$/, '').trim(), text: b[2] };
    }
    return { type: 'step', text: line };
  });
}

function parseIngredients(text) {
  return lines(text).map((line) => {
    const h = line.match(/^#+\s*(.*)$/);
    return h ? { type: 'heading', text: h[1] } : { type: 'item', text: line };
  });
}

function convert(j) {
  if (!j || typeof j !== 'object' || typeof j.title !== 'string') {
    throw new Error('Not a Mela recipe (missing title)');
  }
  const images = (Array.isArray(j.images) ? j.images : [])
    .filter((b) => typeof b === 'string' && b)
    .map((b) => {
      const buffer = Buffer.from(b, 'base64');
      return { buffer, ext: sniffImage(buffer) };
    })
    .filter((i) => i.buffer.length);
  return {
    sourceId: typeof j.id === 'string' ? j.id : '',
    title: j.title.trim() || 'Untitled recipe',
    description: j.text || '',
    images,
    categories: Array.isArray(j.categories) ? j.categories.filter(Boolean) : [],
    yield: j.yield || '',
    prepTime: j.prepTime || '',
    cookTime: j.cookTime || '',
    totalTime: j.totalTime || '',
    ingredients: parseIngredients(j.ingredients),
    instructions: parseInstructions(j.instructions),
    notes: j.notes || '',
    nutrition: j.nutrition || '',
    link: j.link || '',
  };
}

const isZip = (b) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;

module.exports = {
  name: 'mela',
  detect(buf, filename = '') {
    if (isZip(buf)) {
      try {
        return Object.keys(unzipSync(buf)).some((n) => n.endsWith('.melarecipe'));
      } catch {
        return false;
      }
    }
    if (/\.melarecipe$/i.test(filename)) return true;
    try {
      const j = JSON.parse(buf.toString('utf8'));
      return !!j && !Array.isArray(j) && typeof j.title === 'string' && typeof j.ingredients === 'string';
    } catch {
      return false;
    }
  },
  parse(buf) {
    if (isZip(buf)) {
      const files = unzipSync(buf);
      return Object.entries(files)
        .filter(([n]) => n.endsWith('.melarecipe') && !n.startsWith('__MACOSX'))
        .map(([, data]) => convert(JSON.parse(strFromU8(data))));
    }
    return [convert(JSON.parse(buf.toString('utf8')))];
  },
};
