#!/usr/bin/env node
/*
 * Çekmece — bağımlılıksız Node sunucusu.
 *   node server/server.js            -> http://localhost:4173
 *   PORT=8080 node server/server.js
 *
 * Statik dosyaları (index.html, assets/) sunar ve /api/* isteklerini
 * assets/js/core.js içindeki ortak iş mantığına yönlendirir.
 * Veri server/data/db.json dosyasında tutulur.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('../assets/js/core.js');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT) || 4173;

const hashSync = (pw, salt) => crypto.scryptSync(String(pw), String(salt), 32).toString('hex');
const deps = {
  hash: (pw, salt) => new Promise((ok, no) =>
    crypto.scrypt(String(pw), String(salt), 32, (e, k) => (e ? no(e) : ok(k.toString('hex'))))),
  token: () => crypto.randomBytes(24).toString('hex')
};

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    const db = core.seed(hashSync);
    saveDb(db);
    console.log('  Yeni defter açıldı: ' + path.relative(ROOT, DB_FILE));
    return db;
  }
}

function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}

let db = loadDb();
let queue = Promise.resolve(); // istekleri sırayla işle: JSON dosyası için yeterli kilit

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json'
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT + path.sep) || rel.includes('/server/') || rel.includes('/.git')) return send(res, 403, 'Yasak', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Bulunamadı', 'text/plain; charset=utf-8');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': file.includes(path.sep + 'fonts' + path.sep) ? 'public, max-age=604800' : 'no-cache'
    });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise((ok, no) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) { no(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return ok({});
      try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { ok({}); }
    });
    req.on('error', no);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Yöntem yok', 'text/plain');
    return serveStatic(req, res, url.pathname);
  }

  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 413, { error: 'İstek çok büyük.' }); }

  const auth = req.headers.authorization || '';
  const request = {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body,
    token: auth.startsWith('Bearer ') ? auth.slice(7) : null
  };

  queue = queue.then(async () => {
    try {
      const out = await core.handle(db, request, deps);
      if (out.changed) saveDb(db);
      send(res, out.status, out.data);
    } catch (e) {
      console.error(e);
      send(res, 500, { error: 'Masada bir şeyler ters gitti. Birazdan tekrar deneyin.' });
    }
  });
});

if (process.argv.includes('--reset')) {
  db = core.seed(hashSync);
  saveDb(db);
  console.log('  Defter sıfırlandı.');
}

server.listen(PORT, () => {
  console.log('\n  ÇEKMECE · mahalle alet kütüphanesi');
  console.log('  http://localhost:' + PORT + '\n');
  console.log('  Görevli girişi : masa@cekmece.local / masa1234');
  console.log('  Deneme üyesi   : komsu@cekmece.local / komsu123\n');
});
