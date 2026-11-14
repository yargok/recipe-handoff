// File-backed recipe store. Layout under DATA_DIR:
//   recipes/<key>.json   internal recipe + meta (slug, lastShared)
//   img/<key>-<n>.<ext>  images
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function slugify(title) {
  const s = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return s || 'recipe';
}

class Store extends EventEmitter {
  constructor(dataDir) {
    super();
    this.recipeDir = path.join(dataDir, 'recipes');
    this.imgDir = path.join(dataDir, 'img');
    fs.mkdirSync(this.recipeDir, { recursive: true });
    fs.mkdirSync(this.imgDir, { recursive: true });
    this.index = new Map(); // key -> record
    for (const f of fs.readdirSync(this.recipeDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(this.recipeDir, f), 'utf8'));
        this.index.set(rec.key, rec);
      } catch {
        /* skip corrupt file */
      }
    }
  }

  // Never use the source id raw: hash it. Fall back to the title.
  static keyFor(recipe) {
    return sha(recipe.sourceId ? `id:${recipe.sourceId}` : `title:${recipe.title.toLowerCase()}`);
  }

  _fragment(key) {
    for (let n = 4; n < key.length; n++) {
      const frag = key.slice(0, n);
      const clash = [...this.index.values()].some((r) => r.key !== key && r.key.startsWith(frag));
      if (!clash) return frag;
    }
    return key;
  }

  save(recipe) {
    const key = Store.keyFor(recipe);
    const old = this.index.get(key);
    if (old) this._removeImages(key);

    const images = recipe.images.map((img, i) => {
      if (img.url) return img.url;
      const name = `${key.slice(0, 16)}-${i}.${img.ext}`;
      fs.writeFileSync(path.join(this.imgDir, name), img.buffer);
      return `/img/${name}`;
    });
    const { sourceId, ...rest } = recipe;
    const rec = {
      ...rest,
      images,
      key,
      slug: `${slugify(recipe.title)}-${this._fragment(key)}`,
      createdAt: old ? old.createdAt : Date.now(),
      lastShared: Date.now(),
    };
    const tmp = path.join(this.recipeDir, `${key}.json.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(rec));
    fs.renameSync(tmp, path.join(this.recipeDir, `${key}.json`));
    this.index.set(key, rec);
    this.emit('shared', rec);
    return rec;
  }

  /** Match the exact slug, else by trailing id fragment (so a retitled recipe's old URL still resolves). */
  bySlug(slug) {
    for (const r of this.index.values()) if (r.slug === slug) return r;
    const frag = slug.slice(slug.lastIndexOf('-') + 1);
    if (/^[0-9a-f]{4,}$/.test(frag)) {
      for (const r of this.index.values()) if (r.key.startsWith(frag)) return r;
    }
    return null;
  }

  latest() {
    let best = null;
    for (const r of this.index.values()) if (!best || r.lastShared > best.lastShared) best = r;
    return best;
  }

  /** All live recipes, newest shared first. */
  list() {
    return [...this.index.values()].sort((a, b) => b.lastShared - a.lastShared);
  }

  imagePath(file) {
    if (!/^[0-9a-f]+-\d+\.(jpg|png|gif|webp)$/.test(file)) return null;
    const p = path.join(this.imgDir, file);
    return fs.existsSync(p) ? p : null;
  }

  _removeImages(key) {
    const prefix = `${key.slice(0, 16)}-`;
    for (const f of fs.readdirSync(this.imgDir)) {
      if (f.startsWith(prefix)) fs.rmSync(path.join(this.imgDir, f), { force: true });
    }
  }

  remove(key) {
    this._removeImages(key);
    fs.rmSync(path.join(this.recipeDir, `${key}.json`), { force: true });
    this.index.delete(key);
  }

  prune({ pruneDays, maxRecipes }) {
    let removed = 0;
    if (pruneDays > 0) {
      const cutoff = Date.now() - pruneDays * 864e5;
      for (const r of [...this.index.values()]) {
        if (r.lastShared < cutoff) {
          this.remove(r.key);
          removed++;
        }
      }
    }
    if (maxRecipes > 0 && this.index.size > maxRecipes) {
      const oldest = [...this.index.values()].sort((a, b) => a.lastShared - b.lastShared);
      for (const r of oldest.slice(0, this.index.size - maxRecipes)) {
        this.remove(r.key);
        removed++;
      }
    }
    return removed;
  }
}

module.exports = { Store, slugify };
