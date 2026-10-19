const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { importRecipes } = require('../src/adapters');
const { buildJsonLd } = require('../src/render');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n));

test('mela: single recipe', () => {
  const { format, recipes } = importRecipes(fx('tikka.melarecipe'), 'tikka.melarecipe');
  assert.strictEqual(format, 'mela');
  const r = recipes[0];
  assert.deepStrictEqual(r.ingredients.map((i) => i.type), ['heading', 'item', 'item', 'heading', 'item', 'item']);
  assert.deepStrictEqual(r.instructions[1], { type: 'step', name: 'Mix', text: 'Combine yogurt and spices.' });
  assert.deepStrictEqual(r.instructions[4], { type: 'step', name: 'Grill', text: 'the chicken for 10 minutes.' });
  assert.strictEqual(r.images[0].ext, 'png');
  assert.strictEqual(r.images[0].buffer[1], 0x50);
});

test('mela: json mapped to schema.org', () => {
  const r = importRecipes(fx('tikka.melarecipe'), 'x.melarecipe').recipes[0];
  const ld = buildJsonLd({ ...r, images: ['/img/a.png'] }, (u) => 'http://h' + u);
  assert.strictEqual(ld['@type'], 'Recipe');
  assert.strictEqual(ld.description, 'Smoky and creamy. See the original.');
  assert.deepStrictEqual(ld.recipeIngredient, ['1 cup yogurt', '2 tsp garam masala', '1 can tomatoes', '1 onion']);
  assert.strictEqual(ld.prepTime, 'PT20M');
  assert.strictEqual(ld.cookTime, 'PT1H15M');
  assert.strictEqual(ld.totalTime, undefined); // "overnight" is unparseable
  assert.strictEqual(ld.isBasedOn, 'https://example.com/tikka');
  assert.strictEqual(ld.recipeCategory, 'Dinner');
  assert.deepStrictEqual(ld.image, ['http://h/img/a.png']);
  assert.strictEqual(ld.nutrition, undefined);
  const [s1, s2] = ld.recipeInstructions;
  assert.strictEqual(s1['@type'], 'HowToSection');
  assert.deepStrictEqual(s1.itemListElement[0], { '@type': 'HowToStep', text: 'Combine yogurt and spices.', name: 'Mix' });
  assert.strictEqual(s2.name, 'Cook');
});

test('mela: bulk zip', () => {
  const { format, recipes } = importRecipes(fx('bulk.melarecipes'), 'bulk.melarecipes');
  assert.strictEqual(format, 'mela');
  assert.deepStrictEqual(recipes.map((r) => r.title).sort(), ['Chicken Tikka <Masala>', 'Pancakes']);
  const ld = buildJsonLd(recipes.find((r) => r.title === 'Pancakes'), (u) => u);
  assert.strictEqual(ld.isBasedOn, undefined); // non-URL link stays out of markup
});

test('paprika', () => {
  const { format, recipes } = importRecipes(fx('stew.paprikarecipes'), 'stew.paprikarecipes');
  assert.strictEqual(format, 'paprika');
  assert.strictEqual(recipes[0].title, 'Paprika Stew');
  assert.strictEqual(recipes[0].instructions.length, 2);
  assert.strictEqual(buildJsonLd(recipes[0], (u) => u).cookTime, 'PT1H');
});

test('json-ld passthrough', () => {
  const { format, recipes } = importRecipes(fx('lasagna.jsonld'), 'l.json');
  assert.strictEqual(format, 'jsonld');
  const ld = buildJsonLd({ ...recipes[0], images: recipes[0].images.map((i) => i.url) }, (u) => u);
  assert.strictEqual(ld.recipeInstructions[1].name, 'Bake');
  assert.strictEqual(ld.totalTime, 'PT1H');
  assert.deepStrictEqual(ld.image, ['https://example.com/l.jpg']);
});

test('rejects garbage', () => {
  assert.throws(() => importRecipes(Buffer.from('hello'), 'x.txt'), /Unrecognized/);
});

test('crouton .crumb', () => {
  const { format, recipes } = importRecipes(fx('risotto.crumb'), 'risotto.crumb');
  assert.strictEqual(format, 'crouton');
  const r = recipes[0];
  assert.deepStrictEqual(r.ingredients, [
    { type: 'heading', text: 'Base' },
    { type: 'item', text: '1 1/2 cup arborio rice' },
    { type: 'item', text: '1 yellow onion' },
    { type: 'item', text: '1/3 Tbsp butter' },
  ]);
  assert.deepStrictEqual(r.instructions.map((s) => s.type), ['section', 'step', 'step']);
  assert.strictEqual(r.nutrition, 'Calories: 555 kcal\nProtein: 27 g');
  assert.strictEqual(r.notes, 'Use good stock.');
  assert.strictEqual(r.images[0].ext, 'png');
  const ld = buildJsonLd(r, (u) => u);
  assert.strictEqual(ld.prepTime, 'PT15M');
  assert.strictEqual(ld.cookTime, 'PT35M');
  assert.strictEqual(ld.recipeYield, '4 servings');
  assert.strictEqual(ld.isBasedOn, 'https://example.com/risotto');
  assert.deepStrictEqual(ld.recipeIngredient[0], '1 1/2 cup arborio rice');
});

test('crouton detected without a filename', () => {
  assert.strictEqual(importRecipes(fx('risotto.crumb'), '').format, 'crouton');
});
