#!/usr/bin/env node
/*
 * Builds ONE self-contained file you can send to anyone:  node tools/build-single.js

 * -> dist/zor.html and ../docs/index.html for GitHub Pages  (CSS, JS and all character images inlined; only the Google font is fetched when online,
 *    with system-font fallbacks, so it also works offline).
 */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');

// images: inline every file registered in the manifest as a data URI
let manifest = read('assets/characters/manifest.js');
manifest = manifest.replace(/"(assets\/characters\/[^"]+\.(?:jpe?g|png|webp))"/g, (m, f) => {
  const ext = path.extname(f).slice(1).replace('jpg', 'jpeg');
  return '"data:image/' + ext + ';base64,' + fs.readFileSync(path.join(root, f)).toString('base64') + '"';
});

// stylesheet (card frames referenced as url(../assets/frames/x.webp) are inlined as data URIs)
const css = read('ui/style.css').replace(/url\((?:\.\.\/)?(assets\/frames\/[^)'"]+\.webp)\)/g, (m, f) => 'url(data:image/webp;base64,' + fs.readFileSync(path.join(root, f)).toString('base64') + ')');
html = html.replace(/<link rel="stylesheet" href="ui\/style\.css">/, () => '<style>\n' + css + '\n</style>');
// scripts, in page order
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = src === 'assets/characters/manifest.js' ? manifest : read(src);
  return '<script>\n' + code.replace(/<\/script>/gi, '<\\/script>') + '\n</script>';
});
// build id: a hash of the final game; the page carries it and publishes it as version.json so an open game can update itself (ui/update-ui.js)
const crypto = require('crypto');
const buildId = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="zor-build" content="' + buildId + '">');
const versionJson = JSON.stringify({ v: buildId, built: new Date().toISOString() });
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'version.json'), versionJson);
fs.writeFileSync(path.join(root, 'dist', 'zor.html'), html);
// GitHub Pages: <repo>/docs/index.html
// standalone repo (this folder has its own .git): publish from <repo>/docs; inside the old studio repo: ../docs
const docs = fs.existsSync(path.join(root, '.git')) ? path.join(root, 'docs') : path.join(root, '..', 'docs');
fs.mkdirSync(docs, { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), html);
fs.writeFileSync(path.join(docs, '.nojekyll'), '');
fs.writeFileSync(path.join(docs, 'version.json'), versionJson);

// installable app (PWA): manifest + icons + a service worker (network first, so updates always win; the cache only serves offline play)
const webManifest = { name: 'ZOR — مناطق الصدع', short_name: 'ZOR', description: 'لعبة بطاقات استراتيجية بقتال تلقائي', lang: 'ar', dir: 'rtl',
  start_url: './', scope: './', id: './', display: 'standalone', orientation: 'any', background_color: '#121010', theme_color: '#121010',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
fs.writeFileSync(path.join(docs, 'manifest.webmanifest'), JSON.stringify(webManifest, null, 2));
['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].forEach((f) => fs.copyFileSync(path.join(root, 'assets', 'icons', f), path.join(docs, f)));
fs.writeFileSync(path.join(docs, 'sw.js'), `// ZOR service worker (build ${buildId}). Network first: a new version is always fetched when online; the cache is only the offline fallback.
const CACHE = 'zor-${buildId}';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png']).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-store' }).then((res) => { if (res.ok && !u.pathname.endsWith('version.json')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r.mode === 'navigate' ? './' : r, copy)); } return res; })
    .catch(() => caches.match(r.mode === 'navigate' ? './' : r, { ignoreSearch: true }).then((m) => m || caches.match('./'))));
});
`);
console.log('build', buildId);
console.log('docs/index.html (GitHub Pages)');
console.log('dist/zor.html', (html.length / 1048576).toFixed(2) + ' MB');
