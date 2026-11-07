/*
 * İstemci API katmanı.
 * - Sayfa node sunucusundan açıldıysa gerçek HTTP /api uçlarına gider.
 * - index.html dosyadan (file://) açıldıysa ya da sunucu yoksa, aynı
 *   iş mantığını (core.js) tarayıcı içinde çalıştırır; veri localStorage'da.
 */
(function () {
  'use strict';
  var Core = window.CekmeceCore;
  var TOKEN_KEY = 'cekmece.token';
  var DB_KEY = 'cekmece.db.v1';

  /* --- küçük, senkron SHA-256 (yalnızca tarayıcı modu için) --- */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), result = '', words = [], i, j;
    var bitLen = ascii.length * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [];
    var primeCounter = k.length, isComposite = {};
    for (var cand = 2; primeCounter < 64; cand++) {
      if (!isComposite[cand]) {
        for (i = 0; i < 313; i += cand) isComposite[i] = cand;
        hash[primeCounter] = (Math.pow(cand, .5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(cand, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((bitLen / maxWord) | 0);
    words[words.length] = (bitLen);
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
    return result;
  }
  function utf8(s) { return unescape(encodeURIComponent(s)); }
  function hashSync(pw, salt) {
    var h = utf8(salt + ':' + pw);
    for (var i = 0; i < 500; i++) h = sha256(h + salt);
    return h;
  }
  function randomToken() {
    var a = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  /* --- güvenli localStorage --- */
  var memory = {};
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return memory[k] || null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memory[k] = v; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { delete memory[k]; } }

  /* --- yerel (tarayıcı içi) arka uç --- */
  var localDb = null;
  function getLocalDb() {
    if (localDb) return localDb;
    var raw = lsGet(DB_KEY);
    if (raw) { try { localDb = JSON.parse(raw); } catch (e) { localDb = null; } }
    if (!localDb) { localDb = Core.seed(hashSync); lsSet(DB_KEY, JSON.stringify(localDb)); }
    return localDb;
  }
  var localDeps = {
    hash: function (pw, salt) { return Promise.resolve(hashSync(pw, salt)); },
    token: randomToken
  };

  var mode = null; // 'server' | 'local'
  var ready = (function detect() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') { mode = 'local'; return Promise.resolve(mode); }
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 2500);
    return fetch('api/ping', { signal: ctl ? ctl.signal : undefined, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { mode = j && j.ok ? 'server' : 'local'; })
      .catch(function () { mode = 'local'; })
      .then(function () { clearTimeout(timer); return mode; });
  })();

  function splitQuery(path) {
    var i = path.indexOf('?'), query = {};
    if (i > -1) {
      path.slice(i + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        query[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      });
      path = path.slice(0, i);
    }
    return { path: path, query: query };
  }

  function request(method, path, body) {
    return ready.then(function () {
      var token = lsGet(TOKEN_KEY);
      if (mode === 'server') {
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = 'Bearer ' + token;
        return fetch('api/' + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; });
          });
      }
      var sq = splitQuery(path);
      var db = getLocalDb();
      // ağ gecikmesi hissi: anlık değişiklikler insanı şüphelendirir
      return new Promise(function (ok) { setTimeout(ok, 120 + Math.random() * 160); }).then(function () {
        return Core.handle(db, { method: method, path: '/api/' + sq.path, query: sq.query, body: body, token: token }, localDeps);
      }).then(function (out) {
        if (out.changed) lsSet(DB_KEY, JSON.stringify(db));
        return { status: out.status, data: JSON.parse(JSON.stringify(out.data == null ? null : out.data)) };
      });
    }).then(function (res) {
      if (res.status === 401 && lsGet(TOKEN_KEY) && path !== 'auth/login') lsDel(TOKEN_KEY);
      if (res.status >= 400) {
        var err = new Error((res.data && res.data.error) || 'Bir şeyler ters gitti.');
        err.status = res.status;
        throw err;
      }
      return res.data;
    });
  }

  window.Api = {
    ready: ready,
    mode: function () { return mode; },
    get: function (p) { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b || {}); },
    token: function () { return lsGet(TOKEN_KEY); },
    setToken: function (t) { if (t) lsSet(TOKEN_KEY, t); else lsDel(TOKEN_KEY); },
    resetLocal: function () { lsDel(DB_KEY); lsDel(TOKEN_KEY); localDb = null; }
  };
})();
