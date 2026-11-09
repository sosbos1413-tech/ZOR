#!/usr/bin/env node
/*
 * Builds the game:  node tools/build-single.js
 *
 * docs/  (GitHub Pages, the published game; served from a sub-path such as /ZOR/, so every URL is relative)
 *   index.html                small page: markup + <link> to the CSS bundle + <script> of the JS bundle
 *   app.<hash>.js / .css      every script / stylesheet (fonts included) in one file each
 *   assets/<dir>/<name>.<hash>.<ext>   every image and font as its own file, name = content hash,
 *                             so it can be cached forever and is only downloaded when the screen needs it
 *   sw.js                     service worker: hashed files cache-first, index.html network-first,
 *                             version.json never cached (updates still arrive), offline play after one visit
 *   version.json, manifest.webmanifest, icons
 * dist/zor.html  optional single file with everything inlined (images as data URIs) to send to someone / play offline
 *                from disk. Not published.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', woff2: 'font/woff2' };

const docs = fs.existsSync(path.join(root, '.git')) ? path.join(root, 'docs') : path.join(root, '..', 'docs');   // standalone repo: <repo>/docs; inside the old studio repo: ../docs
const dist = path.join(root, 'dist');

// ---------- sources ----------
const page = read('index.html');
const scripts = [...page.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const manifestSrc = read('assets/characters/manifest.js');
// the stylesheet points at ../assets/... (relative to ui/); the fonts sheet at files next to it
const cssSrc = read('assets/fonts/fonts.css').replace(/url\(([^)'"/]+\.woff2)\)/g, (m, f) => 'url(assets/fonts/' + f + ')')
  + '\n' + read('ui/style.css').replace(/url\((?:\.\.\/)?(assets\/[^)'"]+)\)/g, (m, f) => 'url(' + f + ')');

// every asset the game references: portraits (manifest) and css url()s (frames, ui, fonts)
const assetRefs = new Set();
manifestSrc.replace(/"(assets\/characters\/[^"]+\.(?:jpe?g|png|webp))"/g, (m, f) => assetRefs.add(f));
cssSrc.replace(/url\((assets\/[^)'"]+)\)/g, (m, f) => assetRefs.add(f));

// ---------- docs/: split build ----------
// fresh output folders (old hashed files go away; the service worker drops them from its cache too)
fs.rmSync(path.join(docs, 'assets'), { recursive: true, force: true });
fs.mkdirSync(docs, { recursive: true });
fs.readdirSync(docs).filter((f) => /^app\.[0-9a-f]{10}\.(js|css)$/.test(f)).forEach((f) => fs.unlinkSync(path.join(docs, f)));

const hashed = {};   // 'assets/frames/tide.webp' -> 'assets/frames/tide.<hash>.webp'
for (const f of assetRefs) {
  const buf = fs.readFileSync(path.join(root, f));
  const ext = path.extname(f), out = f.slice(0, -ext.length) + '.' + hash(buf) + ext;
  fs.mkdirSync(path.join(docs, path.dirname(out)), { recursive: true });
  fs.writeFileSync(path.join(docs, out), buf);
  hashed[f] = out;
}
const toHashed = (s) => s.replace(/assets\/[A-Za-z0-9_\-/]+\.(?:jpe?g|png|webp|woff2)/g, (f) => hashed[f] || f);

const css = toHashed(cssSrc);
const js = scripts.map((src) => '/* ' + src + ' */\n' + (src === 'assets/characters/manifest.js' ? toHashed(manifestSrc) : read(src))).join('\n;\n');
const cssName = 'app.' + hash(css) + '.css', jsName = 'app.' + hash(js) + '.js';
fs.writeFileSync(path.join(docs, cssName), css);
fs.writeFileSync(path.join(docs, jsName), js);

// the page itself: no fonts CDN, local bundle files, the published manifest/icons that live next to it
let html = page
  .replace('<link rel="stylesheet" href="assets/fonts/fonts.css">\n', '')
  .replace('<link rel="stylesheet" href="ui/style.css">', '<link rel="stylesheet" href="' + cssName + '">')
  .replace('<link rel="icon" href="assets/icons/icon-192.png">', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">')
  .replace('<link rel="apple-touch-icon" href="assets/icons/icon-192.png">', '<link rel="apple-touch-icon" href="icon-192.png">');
// preload the two fonts every screen uses, so text does not swap late
const pre = ['assets/fonts/readex-pro-arabic-400-normal.woff2', 'assets/fonts/lalezar-arabic-400-normal.woff2'].map((f) => `<link rel="preload" href="${hashed[f]}" as="font" type="font/woff2" crossorigin>`).join('\n');
html = html.replace('<link rel="stylesheet" href="' + cssName + '">', pre + '\n<link rel="stylesheet" href="' + cssName + '">');
let first = true;
html = html.replace(/\n?<script src="([^"]+)"><\/script>/g, () => { if (!first) return ''; first = false; return '\n<script src="' + jsName + '"></script>'; });
// build id = hash of the page (which names the bundles, which name the assets): any change anywhere gives a new id
const buildId = hash(html);
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="zor-build" content="' + buildId + '">');
const versionJson = JSON.stringify({ v: buildId, built: new Date().toISOString() });
fs.writeFileSync(path.join(docs, 'index.html'), html);
fs.writeFileSync(path.join(docs, '.nojekyll'), '');
fs.writeFileSync(path.join(docs, 'version.json'), versionJson);

// installable app (PWA)
const webManifest = { name: 'ZOR — مناطق الصدع', short_name: 'ZOR', description: 'لعبة بطاقات استراتيجية بقتال تلقائي', lang: 'ar', dir: 'rtl',
  start_url: './', scope: './', id: './', display: 'standalone', orientation: 'any', background_color: '#121010', theme_color: '#121010',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
fs.writeFileSync(path.join(docs, 'manifest.webmanifest'), JSON.stringify(webManifest, null, 2));
['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].forEach((f) => fs.copyFileSync(path.join(root, 'assets', 'icons', f), path.join(docs, f)));

// service worker. Two caches:
//  zor-shell-<build>: the page ('./'), network first, so a new version always wins when online
//  zor-assets: content-hashed files (bundles, images, fonts), cache first, kept across builds; on activate,
//              files that are no longer part of this build are dropped
const keep = [jsName, cssName, ...Object.values(hashed)];
fs.writeFileSync(path.join(docs, 'sw.js'), `// ZOR service worker, build ${buildId} (generated by tools/build-single.js)
const SHELL = 'zor-shell-${buildId}', ASSETS = 'zor-assets';
const CORE = ${JSON.stringify([jsName, cssName])};
const KEEP = new Set(${JSON.stringify(keep)});
const HASHED = /\\.[0-9a-f]{10}\\.(?:js|css|webp|jpe?g|png|woff2)$/;
const rel = (u) => new URL(u, self.registration.scope).href;
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(Promise.all([
    caches.open(SHELL).then((c) => fetch('./', { cache: 'no-store' }).then((r) => r.ok && c.put('./', r))),
    caches.open(ASSETS).then((c) => c.addAll(CORE)),
  ]).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all([
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)))),
    caches.open(ASSETS).then((c) => c.keys().then((rs) => Promise.all(rs.filter((r) => !KEEP.has(r.url.slice(self.registration.scope.length))).map((r) => c.delete(r))))),
  ]).then(() => self.clients.claim()));
});
// the page tells us what it already loaded before this worker controlled it (it comes from the HTTP cache, no new download)
self.addEventListener('message', (e) => {
  const urls = (e.data && e.data.cache || []).filter((u) => u.startsWith(self.registration.scope) && HASHED.test(new URL(u).pathname));
  e.waitUntil(caches.open(ASSETS).then((c) => Promise.all(urls.map((u) => c.match(u).then((m) => m || fetch(u).then((r) => r.ok && c.put(u, r)).catch(() => {}))))));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !r.url.startsWith(self.registration.scope)) return;
  if (u.pathname.endsWith('/version.json') || u.pathname.endsWith('/sw.js')) return;   // always the network
  if (HASHED.test(u.pathname)) {   // content-hashed: never changes, cache first
    e.respondWith(caches.open(ASSETS).then((c) => c.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  const nav = r.mode === 'navigate' || u.href === rel('./') || u.href === rel('index.html');
  // the page and the rest: network first, cache only for offline (a navigation Request cannot be re-used with options: fetch its URL)
  e.respondWith(fetch(nav ? r.url : r, { cache: 'no-store', credentials: 'same-origin' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(nav ? './' : r, copy)); }
    return res;
  }).catch(() => caches.match(nav ? './' : r, { ignoreSearch: true }).then((m) => m || (nav ? caches.match('./') : Response.error()))));
});
`);

// ---------- dist/zor.html: single self-contained file (optional, not published) ----------
const dataUri = (f) => 'data:' + MIME[path.extname(f).slice(1)] + ';base64,' + fs.readFileSync(path.join(root, f)).toString('base64');
const inlineAssets = (s) => s.replace(/assets\/[A-Za-z0-9_\-/]+\.(?:jpe?g|png|webp|woff2)/g, (f) => assetRefs.has(f) ? dataUri(f) : f);
let single = page
  .replace('<link rel="stylesheet" href="assets/fonts/fonts.css">\n', '')
  .replace('<link rel="stylesheet" href="ui/style.css">', () => '<style>\n' + inlineAssets(cssSrc) + '\n</style>')
  .replace(/<link rel="(?:icon|apple-touch-icon)" href="assets\/icons\/icon-192\.png">\n?/g, '');
single = single.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = src === 'assets/characters/manifest.js' ? inlineAssets(manifestSrc) : read(src);
  return '<script>\n' + code.replace(/<\/script>/gi, '<\\/script>') + '\n</script>';
});
single = single.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="zor-build" content="' + buildId + '">');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'zor.html'), single);
fs.writeFileSync(path.join(dist, 'version.json'), versionJson);

const size = (p) => fs.statSync(p).size;
const assetBytes = Object.values(hashed).reduce((a, f) => a + size(path.join(docs, f)), 0);
console.log('build', buildId);
console.log('docs/index.html', (size(path.join(docs, 'index.html')) / 1024).toFixed(1) + ' KB;', jsName, (Buffer.byteLength(js) / 1024).toFixed(0) + ' KB;', cssName, (Buffer.byteLength(css) / 1024).toFixed(0) + ' KB;',
  Object.keys(hashed).length + ' assets', (assetBytes / 1048576).toFixed(2) + ' MB');
console.log('dist/zor.html', (Buffer.byteLength(single) / 1048576).toFixed(2) + ' MB (single file, not published)');
