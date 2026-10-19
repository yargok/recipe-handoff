// Each adapter: { name, detect(buf, filename) -> bool, parse(buf) -> internalRecipe[] }.
// Internal recipe: see docs in render.js. Add a format = one file here + a fixture in test/fixtures.
const adapters = [require('./mela'), require('./paprika'), require('./crouton'), require('./jsonld')];

function importRecipes(buf, filename = '') {
  for (const a of adapters) {
    if (a.detect(buf, filename)) {
      const recipes = a.parse(buf);
      if (!recipes.length) throw new Error(`No recipes found in ${a.name} file`);
      return { format: a.name, recipes };
    }
  }
  throw new Error('Unrecognized recipe format');
}

module.exports = { importRecipes, adapters };
