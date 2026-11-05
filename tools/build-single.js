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

// stylesheet
html = html.replace(/<link rel="stylesheet" href="ui\/style\.css">/, () => '<style>\n' + read('ui/style.css') + '\n</style>');
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
console.log('build', buildId);
console.log('docs/index.html (GitHub Pages)');
console.log('dist/zor.html', (html.length / 1048576).toFixed(2) + ' MB');
