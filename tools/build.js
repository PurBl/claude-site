#!/usr/bin/env node
/*
 * src/index.html + assets/ -> tek parça index.html
 * CSS, JS ve fontlar (base64) dosyanın içine gömülür; çıkan index.html
 * başka hiçbir dosyaya ihtiyaç duymadan çift tıklamayla açılır.
 *   node tools/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('src/index.html');

const fontDir = path.join(ROOT, 'assets/fonts');
const fonts = read('assets/fonts/fonts.css').replace(/url\('([^']+\.woff2)'\)/g, (m, f) =>
  "url(data:font/woff2;base64," + fs.readFileSync(path.join(fontDir, f)).toString('base64') + ")");

const inlineStyle = (css) => '<style>\n' + css.replace(/<\/style/gi, '<\\/style') + '\n</style>';
const inlineScript = (js) => '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';

function swap(needle, replacement) {
  if (!html.includes(needle)) throw new Error('Bulunamadı: ' + needle);
  html = html.split(needle).join(replacement);
}
swap('<link rel="stylesheet" href="assets/fonts/fonts.css">', inlineStyle(fonts));
swap('<link rel="stylesheet" href="assets/css/style.css">', inlineStyle(read('assets/css/style.css')));
['core', 'api', 'app'].forEach((n) => swap('<script src="assets/js/' + n + '.js"></script>', inlineScript(read('assets/js/' + n + '.js'))));

if (/(?:src|href)="assets\//.test(html)) throw new Error('Dışarıya bağlı bir dosya kaldı.');
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- Bu dosya tools/build.js ile üretildi. Düzenlemek için src/ ve assets/ altındakileri değiştirip yeniden derleyin. -->');
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('index.html yazıldı: ' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB, tek parça.');
