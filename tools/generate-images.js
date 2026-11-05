#!/usr/bin/env node
/*
 * Generates candidate images for the characters from assets/characters/PROMPTS.md
 * using an image-generation API that follows the common "/images/generations" shape.
 *
 *   node tools/generate-images.js wave_caller mist_witch      # specific characters
 *   node tools/generate-images.js --all                       # all 20 units
 *   node tools/generate-images.js --all --variants 2          # fewer variants (default 4)
 *   node tools/generate-images.js wave_caller --dry           # print the prompt, call nothing
 *   node tools/generate-images.js --index                     # rebuild the review page only
 *
 * Settings (environment variables — never commit your key):
 *   IMAGE_API_KEY   (required)  your API key
 *   IMAGE_API_BASE  default https://api.openai.com/v1
 *   IMAGE_MODEL     default gpt-image-1
 *   IMAGE_SIZE      default 1024x1024
 *
 * Output: assets/characters/candidates/<id>_<n>.png and candidates/index.html (open it to review).
 * Then choose:  node tools/pick-image.js <id> <n>
 * NOTE: every image costs money on paid services. Use --dry first and start with one character.
 */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const cdir = path.join(root, 'assets', 'characters', 'candidates');

// ---- read the prompt kit
const md = fs.readFileSync(path.join(root, 'assets', 'characters', 'PROMPTS.md'), 'utf8');
const blocks = (re) => [...md.matchAll(re)];
const style = (md.match(/## الأسلوب الثابت[^\n]*\n```\n([\s\S]*?)\n```/) || [])[1];
const negative = (md.match(/## الأمر السلبي[^\n]*\n```\n([\s\S]*?)\n```/) || [])[1];
const chars = {};
for (const m of blocks(/### (.+?) — `([a-z_]+)`[^\n]*\n```\n([\s\S]*?)\n```/g)) chars[m[2]] = { name: m[1], desc: m[3] };
if (!style || !Object.keys(chars).length) { console.error('could not read assets/characters/PROMPTS.md'); process.exit(1); }
const promptFor = (id) => `${style}. ${chars[id].desc}. Avoid: ${negative}.`;

// ---- args
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const variants = +val('--variants', 4);
const ids = flag('--all') ? Object.keys(chars) : args.filter((a) => chars[a]);
const unknown = args.filter((a) => !a.startsWith('--') && !chars[a] && isNaN(+a));

function buildIndex() {
  if (!fs.existsSync(cdir)) return;
  const files = fs.readdirSync(cdir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  const byId = {};
  files.forEach((f) => { const m = f.match(/^(.+)_(\d+)\./); if (m) (byId[m[1]] = byId[m[1]] || []).push([m[2], f]); });
  const html = `<!doctype html><meta charset="utf-8"><title>مراجعة الصور</title><body style="font-family:sans-serif;background:#1d1815;color:#f3ead6;direction:rtl;padding:20px">
<h2>اختر أفضل نسخة لكل شخصية</h2><p>ثم شغّل: <code>node tools/pick-image.js &lt;المعرّف&gt; &lt;الرقم&gt;</code></p>` +
    Object.entries(byId).map(([id, list]) => `<h3>${(chars[id] || {}).name || id} — <code>${id}</code></h3><div style="display:flex;gap:10px;flex-wrap:wrap">` +
      list.map(([n, f]) => `<figure style="margin:0"><img src="${f}" width="240" style="border:3px solid #000"><figcaption>${id} ${n}</figcaption></figure>`).join('') + '</div>').join('') + '</body>';
  fs.writeFileSync(path.join(cdir, 'index.html'), html);
}

(async () => {
  if (flag('--index')) { buildIndex(); console.log('review page: assets/characters/candidates/index.html'); return; }
  if (unknown.length) console.log('unknown ids ignored:', unknown.join(', '));
  if (!ids.length) { console.log('give character ids or --all. Available:\n  ' + Object.keys(chars).join(', ')); process.exit(1); }
  if (flag('--dry')) { ids.forEach((id) => console.log(`\n[${id}] ${chars[id].name}\n${promptFor(id)}`)); console.log(`\n(dry run) would request ${ids.length * variants} images`); return; }

  const key = process.env.IMAGE_API_KEY;
  if (!key) { console.error('set IMAGE_API_KEY first (see the header of this file)'); process.exit(1); }
  const base = (process.env.IMAGE_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.IMAGE_MODEL || 'gpt-image-1';
  const size = process.env.IMAGE_SIZE || '1024x1024';
  fs.mkdirSync(cdir, { recursive: true });
  console.log(`requesting ${ids.length * variants} images from ${base} (model ${model}, ${size})`);

  for (const id of ids) {
    for (let n = 1; n <= variants; n++) {
      const out = path.join(cdir, `${id}_${n}.png`);
      if (fs.existsSync(out) && !flag('--force')) { console.log(`skip ${id}_${n} (exists)`); continue; }
      let res;
      try {
        res = await fetch(`${base}/images/generations`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, prompt: promptFor(id), size, n: 1 }),
        });
      } catch (e) { console.error(`${id}_${n}: network error — ${e.message}`); process.exit(1); }
      const text = await res.text();
      let body; try { body = JSON.parse(text); } catch (e) { body = null; }
      if (!res.ok) {
        console.error(`${id}_${n}: HTTP ${res.status} ${text.slice(0, 300)}`);
        if ([401, 403, 404].includes(res.status)) process.exit(1);   // wrong key / model / endpoint: stop spending
        continue;
      }
      const item = body && body.data && body.data[0];
      let buf = null;
      if (item && item.b64_json) buf = Buffer.from(item.b64_json, 'base64');
      else if (item && item.url) buf = Buffer.from(await (await fetch(item.url)).arrayBuffer());
      if (!buf) { console.error(`${id}_${n}: response had no image: ${text.slice(0, 200)}`); continue; }
      fs.writeFileSync(out, buf);
      console.log(`saved ${id}_${n}.png`);
    }
  }
  buildIndex();
  console.log('\nreview: open assets/characters/candidates/index.html\nchoose: node tools/pick-image.js <id> <n>');
})();
