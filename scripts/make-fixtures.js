// Regenerates binary fixtures from the JSON ones: node scripts/make-fixtures.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { zipSync, strToU8 } = require('fflate');

const dir = path.join(__dirname, '..', 'test', 'fixtures');
const mela = fs.readFileSync(path.join(dir, 'tikka.melarecipe'));
const mela2 = JSON.stringify({ id: 'example.com/pancakes', title: 'Pancakes', ingredients: '2 cups flour\n1 egg', instructions: 'Mix.\nFry.', link: 'Grandma' });
fs.writeFileSync(
  path.join(dir, 'bulk.melarecipes'),
  zipSync({ 'Chicken Tikka.melarecipe': mela, 'Pancakes.melarecipe': strToU8(mela2) }),
);

const paprika = {
  uid: 'ABC-123', name: 'Paprika Stew', ingredients: '1 onion\n2 tbsp paprika', directions: 'Chop.\nSimmer 20 minutes.',
  prep_time: '10 min', cook_time: '1 hour', total_time: '', servings: '4', categories: ['Dinner'], source_url: 'https://example.com/stew', notes: 'Better next day.',
};
fs.writeFileSync(
  path.join(dir, 'stew.paprikarecipes'),
  zipSync({ 'Paprika Stew.paprikarecipe': zlib.gzipSync(JSON.stringify(paprika)) }),
);
