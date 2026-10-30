// Loads the game's classic browser scripts into Node so tools and tests share the real code.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

export const root = new URL('../', import.meta.url);

export function loadScripts(...files) {
  for (const file of files) {
    vm.runInThisContext(readFileSync(new URL(file, root), 'utf8'), { filename: file });
  }
  return globalThis.OF;
}

export function readJson(file) {
  return JSON.parse(readFileSync(new URL(file, root), 'utf8'));
}

export const DATA_FILES = ['scenes', 'evidence', 'hotspots', 'graph', 'stages', 'answers'];

// The browser can't fetch() JSON from file://, so each data/X.json has a data/X.js
// mirror that the page loads with a plain <script> tag.
export function mirrorSource(name, json) {
  return `// Generated from data/${name}.json by tools/sync-data.mjs. Edit the JSON, then re-run it.\n` +
    `(globalThis.OF_DATA = globalThis.OF_DATA || {})[${JSON.stringify(name)}] = ${JSON.stringify(json, null, 2)};\n`;
}

export function writeMirror(name) {
  const json = readJson(`data/${name}.json`);
  writeFileSync(new URL(`data/${name}.js`, root), mirrorSource(name, json));
}
