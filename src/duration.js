// Free-text duration -> ISO 8601 ("1 hr 30 min" -> "PT1H30M"). Returns null if unparseable.

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

function num(tok) {
  let t = tok.trim();
  let extra = 0;
  for (const [ch, v] of Object.entries(FRACTIONS)) {
    if (t.includes(ch)) {
      extra = v;
      t = t.replace(ch, '').trim();
    }
  }
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return +frac[1] / +frac[2];
  if (t === '' && extra) return extra;
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n + extra : NaN;
}

function toIsoDuration(text) {
  if (!text) return null;
  const s = String(text).toLowerCase().trim();
  if (s.length > 2 && /^p(\d+d)?(t(\d+h)?(\d+m)?(\d+s)?)?$/.test(s)) return s.toUpperCase();

  const clock = s.match(/^(\d+):(\d{2})$/);
  if (clock) return build(+clock[1] * 60 + +clock[2]);

  const re = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g;
  let minutes = 0;
  let matched = 0;
  let rest = s;
  let m;
  while ((m = re.exec(s))) {
    const n = num(m[1]);
    if (Number.isNaN(n)) return null;
    const u = m[2][0];
    if (u === 'd') minutes += n * 1440;
    else if (u === 'h') minutes += n * 60;
    else if (u === 'm') minutes += n;
    else minutes += n / 60;
    matched++;
    rest = rest.replace(m[0], '');
  }
  if (!matched) return null;
  // Ranges like "10-15 minutes" or leftover digits are ambiguous; skip them.
  if (/\d/.test(rest)) return null;
  return build(minutes);

  function build(total) {
    total = Math.round(total);
    if (total <= 0) return null;
    const h = Math.floor(total / 60);
    const mm = total % 60;
    return 'PT' + (h ? `${h}H` : '') + (mm ? `${mm}M` : '');
  }
}

module.exports = { toIsoDuration };
