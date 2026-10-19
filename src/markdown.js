// Tiny Markdown subset used by recipe apps: links, **bold**, *italic*, # headings, * bullets.

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LINK = /\[([^\]]*)\]\(([^)\s]*)\)/g;
const isSafeUrl = (u) => /^https?:\/\//i.test(u);

/** Markdown -> plain text (for schema.org markup). */
function stripMarkdown(s) {
  return String(s)
    .replace(LINK, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2')
    .replace(/^\s*#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Inline Markdown -> safe HTML. */
function inlineHtml(s) {
  let out = '';
  let last = 0;
  const str = String(s);
  str.replace(LINK, (m, text, url, idx) => {
    out += format(str.slice(last, idx));
    out += isSafeUrl(url)
      ? `<a href="${escapeHtml(url)}">${format(text)}</a>`
      : format(text);
    last = idx + m.length;
    return m;
  });
  out += format(str.slice(last));
  return out;

  function format(t) {
    return escapeHtml(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
  }
}

/** Block Markdown (notes, nutrition) -> safe HTML. */
function blockHtml(s) {
  const lines = String(s).split(/\r?\n/);
  const out = [];
  let list = false;
  const closeList = () => {
    if (list) out.push('</ul>');
    list = false;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    const h = line.match(/^#+\s*(.*)$/);
    const li = line.match(/^[*-]\s+(.*)$/);
    if (h) {
      closeList();
      out.push(`<h3>${inlineHtml(h[1])}</h3>`);
    } else if (li) {
      if (!list) out.push('<ul>');
      list = true;
      out.push(`<li>${inlineHtml(li[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inlineHtml(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

module.exports = { escapeHtml, stripMarkdown, inlineHtml, blockHtml };
