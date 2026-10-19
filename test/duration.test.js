const test = require('node:test');
const assert = require('node:assert');
const { toIsoDuration } = require('../src/duration');

test('parses common free-text durations', () => {
  const cases = {
    '15 min': 'PT15M', '1 hr 30 min': 'PT1H30M', '2 hours': 'PT2H', '1h': 'PT1H', '45 minutes': 'PT45M',
    '1:30': 'PT1H30M', '1 1/2 hours': 'PT1H30M', '1½ hours': 'PT1H30M', 'PT20M': 'PT20M', '1 day': 'PT24H',
  };
  for (const [k, v] of Object.entries(cases)) assert.strictEqual(toIsoDuration(k), v, k);
});

test('returns null for unparseable input', () => {
  for (const s of ['overnight', '', null, '10-15 minutes', '15', 'a while']) assert.strictEqual(toIsoDuration(s), null, String(s));
});
