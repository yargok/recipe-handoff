// Paprika: .paprikarecipes = ZIP of gzipped JSON (.paprikarecipe) entries.
const { unzipSync, gunzipSync, strFromU8 } = require('fflate');

const lines = (s) => (typeof s === 'string' ? s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []);

function convert(j) {
  if (!j || typeof j.name !== 'string') throw new Error('Not a Paprika recipe (missing name)');
  const images = [];
  if (typeof j.photo_data === 'string' && j.photo_data) {
    const buffer = Buffer.from(j.photo_data, 'base64');
    if (buffer.length) images.push({ buffer, ext: buffer[0] === 0x89 ? 'png' : 'jpg' });
  }
  return {
    sourceId: j.uid || '',
    title: j.name.trim() || 'Untitled recipe',
    description: j.description || '',
    images,
    categories: Array.isArray(j.categories) ? j.categories.filter(Boolean) : [],
    yield: j.servings || '',
    prepTime: j.prep_time || '',
    cookTime: j.cook_time || '',
    totalTime: j.total_time || '',
    ingredients: lines(j.ingredients).map((text) => ({ type: 'item', text })),
    instructions: lines(j.directions).map((text) => ({ type: 'step', text })),
    notes: j.notes || '',
    nutrition: j.nutritional_info || '',
    link: j.source_url || j.source || '',
  };
}

module.exports = {
  name: 'paprika',
  detect(buf, filename = '') {
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) return false;
    if (/\.paprikarecipes$/i.test(filename)) return true;
    try {
      return Object.keys(unzipSync(buf)).some((n) => n.endsWith('.paprikarecipe'));
    } catch {
      return false;
    }
  },
  parse(buf) {
    const files = unzipSync(buf);
    return Object.entries(files)
      .filter(([n]) => n.endsWith('.paprikarecipe'))
      .map(([, data]) => convert(JSON.parse(strFromU8(gunzipSync(data)))));
  },
};
