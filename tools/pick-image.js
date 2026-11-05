#!/usr/bin/env node
/* Choose a candidate:  node tools/pick-image.js <id> <n>
 * Converts it to assets/characters/<id>.jpg (768x768, needs Python + Pillow) — or copies the png if Python is missing —
 * then registers it in the game. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const [id, n] = process.argv.slice(2);
if (!id || !n) { console.error('usage: node tools/pick-image.js <id> <n>'); process.exit(1); }
const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'characters', 'candidates', `${id}_${n}.png`);
if (!fs.existsSync(src)) { console.error('not found: ' + src); process.exit(1); }
let ok = false;
for (const py of ['python3', 'python']) {
  const r = cp.spawnSync(py, [path.join(__dirname, 'prep-image.py'), src, id], { encoding: 'utf8' });
  if (r.status === 0) { process.stdout.write(r.stdout); ok = true; break; }
}
if (!ok) { fs.copyFileSync(src, path.join(root, 'assets', 'characters', `${id}.png`)); console.log('python/Pillow not found — copied the png as is'); }
process.stdout.write(cp.spawnSync('node', [path.join(__dirname, 'scan-images.js')], { encoding: 'utf8' }).stdout);
