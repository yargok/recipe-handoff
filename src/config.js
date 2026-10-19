const path = require('path');
require('dotenv').config({ quiet: true });

const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

const root = path.resolve(__dirname, '..');

module.exports = {
  root,
  port: int(process.env.PORT, 8765),
  host: process.env.HOST || '0.0.0.0',
  dataDir: path.resolve(root, process.env.DATA_DIR || './data'),
  pruneDays: int(process.env.PRUNE_DAYS, 7),
  maxRecipes: int(process.env.MAX_RECIPES, 0),
  baseUrl: (process.env.BASE_URL || '').replace(/\/+$/, ''),
  shortcutIcloudUrl: process.env.SHORTCUT_ICLOUD_URL || '',
  shortcutDir: path.join(root, 'shortcut'),
  // Bump when the Shortcut changes and a new .shortcut/iCloud link is published.
  currentShortcutVersion: 1,
  maxUploadBytes: 100 * 1024 * 1024,
};
