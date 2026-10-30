// Regenerates data/*.js mirrors from data/*.json. Run after hand-editing any data JSON:
//   node tools/sync-data.mjs
import { DATA_FILES, writeMirror } from './node-env.mjs';

for (const name of DATA_FILES) {
  writeMirror(name);
  console.log(`data/${name}.js updated`);
}
