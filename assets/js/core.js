/*
 * Çekmece — paylaşılan iş mantığı.
 * Aynı dosya hem Node sunucusunda (server/server.js) hem de tarayıcıda
 * (index.html doğrudan dosyadan açıldığında) çalışır. Veritabanı düz bir
 * JSON nesnesidir; depolama (dosya ya da localStorage) dışarıda kalır.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CekmeceCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;
  var LOAN_DAYS = 7;
  var MAX_ACTIVE = 3;

  var CATEGORIES = [
    { id: 'delme', name: 'Delme & Vidalama' },
    { id: 'kesme', name: 'Kesme & Zımpara' },
    { id: 'olcme', name: 'Ölçme & Hizalama' },
    { id: 'erisim', name: 'Merdiven & Erişim' },
    { id: 'bahce', name: 'Bahçe & Balkon' },
    { id: 'temizlik', name: 'Temizlik' },
    { id: 'mutfak', name: 'Kalabalık Mutfak' },
    { id: 'etkinlik', name: 'Sokak Etkinliği' }
  ];

  var NEIGHBORHOODS = ['Yeldeğirmeni', 'Moda', 'Rasimpaşa', 'Osmanağa', 'Caferağa', 'Hasanpaşa', 'Fikirtepe', 'Koşuyolu'];

  function ApiError(status, message) {
    this.status = status;
    this.message = message;
  }

  function fail(status, message) { throw new ApiError(status, message); }

  function clean(s, max) {
    s = (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
    return max ? s.slice(0, max) : s;
  }

  function firstName(name) { return clean(name).split(' ')[0] || 'Bir komşu'; }

  /* ---------- tohum veri ---------- */

  var SEED_TOOLS = [
    ['delme', 'drill', 'Darbeli matkap, 750 W', 'Beton duvara dübel için. Mandren biraz sıkı, iki elle çevirin.', 'İyi', 2.4, 'Selim Usta'],
    ['delme', 'driver', 'Şarjlı vidalama, iki bataryalı', 'Mobilya kurulumunun tek gerçek kahramanı. Bataryalar ayrı çantada.', 'Çok iyi', 1.3, 'Nesrin H.'],
    ['delme', 'drill', 'Kırıcı-delici (SDS)', 'Banyo fayansı sökenler için. Gürültülü; komşulara önceden haber verin.', 'Yıpranmış ama sağlam', 4.8, 'Eski kiracı'],
    ['delme', 'bits', 'Uç seti, 48 parça', 'Torx, yıldız, düz, alyan. Eksik parça yok — sayıp teslim ediyoruz.', 'Çok iyi', 0.6, 'Çekmece'],
    ['kesme', 'saw', 'Dekupaj testere', 'Eğri kesim için. Ahşap ve metal bıçağı yanında.', 'İyi', 2.1, 'Barış K.'],
    ['kesme', 'sander', 'Titreşimli zımpara', '80, 120 ve 240 kum kâğıtları dahil. Toz torbasını boşaltıp getirin.', 'İyi', 1.5, 'Ayla & Cem'],
    ['kesme', 'saw', 'Gönye testere (elle)', 'Süpürgelik ve çerçeve kesimi için. Elektrik istemez, sabır ister.', 'Eski ama keskin', 3.0, 'Rıza Bey'],
    ['kesme', 'clamp', 'İşkence, 4 adet', 'İki büyük, iki küçük. Tutkal kururken bekleyen eller.', 'Çok iyi', 2.2, 'Çekmece'],
    ['olcme', 'level', 'Su terazisi, 120 cm', 'Raf ve tablo asarken. Kabarcık hâlâ dürüst.', 'İyi', 0.9, 'Deniz Ö.'],
    ['olcme', 'laser', 'Lazer hizalama cihazı', 'Kendinden terazili çapraz çizgi. Pilini biz takıyoruz.', 'Çok iyi', 0.5, 'Bağış kutusu'],
    ['olcme', 'detector', 'Duvar tarayıcı', 'Delmeden önce kablo ve boru arayın. Ciddiyiz.', 'İyi', 0.3, 'Hüseyin A.'],
    ['erisim', 'ladder', 'Alüminyum merdiven, 7 basamak', 'Taşıması kolay, iki kişi önerilir. Apartman merdiveninde dönüşü dar.', 'İyi', 7.5, 'Apartman yönetimi'],
    ['erisim', 'ladder', 'Katlanır tabure merdiven', 'Üst dolaplar ve ampuller için. Kedi üstünde uyumayı seviyor.', 'Çok iyi', 3.2, 'Melek T.'],
    ['bahce', 'shears', 'Budama makası', 'Balkondaki asma için ideal. Yağlayıp kılıfına koyduk.', 'Çok iyi', 0.4, 'Nermin Teyze'],
    ['bahce', 'shovel', 'Kürek ve çapa takımı', 'Sokak ağaçlarının çanağını açarken kullandık. Çamurlu dönebilir, sorun değil.', 'Yıpranmış ama sağlam', 3.6, 'Bostan grubu'],
    ['bahce', 'hose', 'Bahçe hortumu, 25 m', 'Makaralı. Musluk adaptörleri cepte.', 'İyi', 4.0, 'Okan B.'],
    ['temizlik', 'vacuum', 'Islak-kuru elektrik süpürgesi', 'Tadilat tozu ve su baskını için. Ev süpürgenizi bununla kurtarın.', 'İyi', 6.2, 'Çekmece'],
    ['temizlik', 'steam', 'Buharlı temizleyici', 'Derz araları ve fırın camı. Su deposunu boş getirin.', 'Çok iyi', 2.8, 'Gül S.'],
    ['temizlik', 'washer', 'Basınçlı yıkama makinesi', 'Balkon zemini ve bisikletler. Kediyi yıkamayın.', 'İyi', 5.5, 'Tarık E.'],
    ['mutfak', 'pot', 'Kazan, 40 litre', 'Aşure, reçel, imece yemeği. Kapağı ve kepçesi yanında.', 'Yıpranmış ama sağlam', 5.0, 'Fatma Hanım'],
    ['mutfak', 'pot', 'Mantı & hamur açma makinesi', 'Elle çevirmeli. Unu iyice silip getirin lütfen.', 'İyi', 3.4, 'Zeynep & annesi'],
    ['mutfak', 'urn', 'Semaver, 10 litre', 'Elektrikli. Toplantı, cenaze, düğün — hepsini gördü.', 'Çok iyi', 2.9, 'Sokak derneği'],
    ['etkinlik', 'table', 'Katlanır masa, 2 adet', 'Sokak kahvaltısı ve kermes için. Her biri 6 kişilik.', 'İyi', 14, 'Çekmece'],
    ['etkinlik', 'projector', 'Projektör ve perde', 'Avluda film gecesi. HDMI kablosu ve uzatma dahil.', 'İyi', 3.8, 'Sinema kulübü'],
    ['etkinlik', 'speaker', 'Taşınabilir hoparlör', 'Mikrofon girişi var. Saat 22:00 sonrası kısık sesle.', 'Çok iyi', 4.1, 'Mert Y.']
  ];

  function eveningOf(ts, k) {
    var x = new Date(ts);
    x.setHours(18 + (k % 3), (k * 17) % 60, 0, 0);
    return x.getTime();
  }

  function seed(hashSync) {
    var now = Date.now();
    var db = {
      version: 1,
      seq: { tool: SEED_TOOLS.length, user: 0, loan: 0, donation: 0, log: 0, notice: 0 },
      tools: [],
      users: [],
      sessions: {},
      loans: [],
      waitlist: [],
      donations: [],
      notices: [],
      log: []
    };

    SEED_TOOLS.forEach(function (t, i) {
      db.tools.push({
        id: 'ÇK-' + String(i + 1).padStart(3, '0'),
        category: t[0], icon: t[1], name: t[2], note: t[3], condition: t[4],
        weight: t[5], donor: t[6], timesLent: 3 + ((i * 7) % 23),
        addedAt: now - (400 - i * 9) * DAY, retired: false
      });
    });

    function addUser(name, email, pw, hood, role) {
      var salt = 'seed' + email;
      var u = {
        id: 'U' + (++db.seq.user), name: name, email: email, hood: hood,
        role: role, salt: salt, hash: hashSync(pw, salt),
        memberNo: String(1000 + db.seq.user * 37), createdAt: now - 200 * DAY
      };
      db.users.push(u);
      return u;
    }

    var admin = addUser('Sevgi Görevli', 'masa@cekmece.local', 'masa1234', 'Yeldeğirmeni', 'admin');
    var demo = addUser('Deneme Komşu', 'komsu@cekmece.local', 'komsu123', 'Moda', 'member');
    var others = [
      addUser('Kerem A.', 'kerem@cekmece.local', 'x' + Math.random(), 'Rasimpaşa', 'member'),
      addUser('Lale D.', 'lale@cekmece.local', 'x' + Math.random(), 'Osmanağa', 'member'),
      addUser('Hakan Ç.', 'hakan@cekmece.local', 'x' + Math.random(), 'Caferağa', 'member')
    ];

    function loan(toolIdx, user, startDaysAgo, returnedDaysAgo) {
      var l = {
        id: 'L' + (++db.seq.loan), toolId: db.tools[toolIdx].id, userId: user.id,
        start: now - startDaysAgo * DAY, due: now - (startDaysAgo - LOAN_DAYS) * DAY,
        returnedAt: returnedDaysAgo == null ? null : now - returnedDaysAgo * DAY, extended: false
      };
      db.loans.push(l);
      return l;
    }

    // biraz geçmiş: defter boş görünmesin
    loan(0, others[0], 30, 24); loan(0, others[1], 18, 12); loan(0, others[2], 4, null);
    loan(11, others[1], 9, null); // gecikmiş
    loan(19, others[2], 12, 6); loan(22, others[0], 3, null);
    loan(1, demo, 2, null); loan(8, demo, 20, 15);
    loan(16, others[0], 6, 1); loan(23, others[1], 5, 2);

    db.waitlist.push({ toolId: db.tools[0].id, userId: others[1].id, at: now - DAY });

    db.donations.push({
      id: 'B' + (++db.seq.donation), userId: others[2].id, name: 'Fayans kesici, 60 cm',
      category: 'kesme', condition: 'İyi', note: 'Bir banyo gördü, bir tane daha görebilir.',
      status: 'pending', at: now - 2 * DAY
    });

    var logs = [
      [7, 'tool', 24, 'Moda\'dan Mert'],
      [6, 'return', 19, 'Caferağa\'dan Hakan'],
      [5, 'borrow', 23, 'Osmanağa\'dan Lale'],
      [4, 'borrow', 0, 'Caferağa\'dan Hakan'],
      [3, 'borrow', 22, 'Rasimpaşa\'dan Kerem'],
      [2, 'return', 23, 'Osmanağa\'dan Lale'],
      [1, 'return', 16, 'Rasimpaşa\'dan Kerem']
    ];
    logs.forEach(function (l) {
      var t = db.tools[l[2]];
      db.log.push({ id: ++db.seq.log, at: eveningOf(now - l[0] * DAY, l[0]), kind: l[1], toolId: t.id, tool: t.name, who: l[3] });
    });
    void admin;
    return db;
  }

  /* ---------- yardımcılar ---------- */

  function toolById(db, id) {
    for (var i = 0; i < db.tools.length; i++) if (db.tools[i].id === id) return db.tools[i];
    return null;
  }
  function userById(db, id) {
    for (var i = 0; i < db.users.length; i++) if (db.users[i].id === id) return db.users[i];
    return null;
  }
  function activeLoanFor(db, toolId) {
    for (var i = 0; i < db.loans.length; i++) {
      var l = db.loans[i];
      if (l.toolId === toolId && !l.returnedAt) return l;
    }
    return null;
  }
  function queueFor(db, toolId) {
    return db.waitlist.filter(function (w) { return w.toolId === toolId; }).sort(function (a, b) { return a.at - b.at; });
  }

  function publicTool(db, t) {
    var loan = activeLoanFor(db, t.id);
    var cat = CATEGORIES.filter(function (c) { return c.id === t.category; })[0];
    return {
      id: t.id, name: t.name, note: t.note, category: t.category, categoryName: cat ? cat.name : t.category,
      icon: t.icon, condition: t.condition, weight: t.weight, donor: t.donor, timesLent: t.timesLent,
      available: !loan, due: loan ? loan.due : null, overdue: loan ? loan.due < Date.now() : false,
      queue: queueFor(db, t.id).length
    };
  }

  function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, hood: u.hood, role: u.role, memberNo: u.memberNo, createdAt: u.createdAt };
  }

  function addLog(db, kind, toolId, who) {
    var t = toolById(db, toolId);
    db.log.push({ id: ++db.seq.log, at: Date.now(), kind: kind, toolId: toolId, tool: t ? t.name : toolId, who: who });
    if (db.log.length > 200) db.log.splice(0, db.log.length - 200);
  }

  function notify(db, userId, text) {
    db.notices.push({ id: 'N' + (++db.seq.notice), userId: userId, text: text, at: Date.now(), read: false });
  }

  function hoodPhrase(u) {
    var h = u.hood || 'Mahalle';
    var suf = /[aıou][^aeıioöuü]*$/i.test(h) ? (/[çfhkpsşt]$/i.test(h) ? '\'tan' : '\'dan') : (/[çfhkpsşt]$/i.test(h) ? '\'ten' : '\'den');
    return h + suf + ' ' + firstName(u.name);
  }

  /* ---------- istek yönlendirme ---------- */

  /*
   * handle(db, req, deps) -> Promise<{status, data, changed}>
   * req: {method, path, query, body, token}
   * deps: {hash(pw, salt) -> Promise<string>, token() -> string}
   */
  function handle(db, req, deps) {
    return Promise.resolve().then(function () {
      return route(db, req, deps);
    }).then(function (res) {
      return { status: res.status || 200, data: res.data, changed: !!res.changed };
    }, function (err) {
      if (err instanceof ApiError) return { status: err.status, data: { error: err.message }, changed: false };
      throw err;
    });
  }

  function route(db, req, deps) {
    var m = req.method.toUpperCase();
    var parts = req.path.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    var body = req.body || {};
    var q = req.query || {};
    var userId = req.token && db.sessions[req.token];
    var me = userId ? userById(db, userId) : null;

    function needUser() { if (!me) fail(401, 'Önce giriş yapmalısınız.'); return me; }
    function needAdmin() { needUser(); if (me.role !== 'admin') fail(403, 'Bu sayfa yalnızca masa görevlileri için.'); return me; }

    var key = (parts[0] === 'auth' || parts[0] === 'admin')
      ? m + ' ' + parts.slice(0, 2).join('/')
      : m + ' ' + (parts[0] || '') + (parts[1] ? '/:id' : '');

    switch (key) {
      case 'GET ping':
        return { data: { ok: true, mode: 'server' } };

      case 'GET stats': {
        var out = db.loans.filter(function (l) { return !l.returnedAt; }).length;
        var shelf = db.tools.filter(function (t) { return !t.retired; }).length;
        return {
          data: {
            tools: shelf, out: out, members: db.users.length,
            lentTotal: db.tools.reduce(function (s, t) { return s + t.timesLent; }, 0),
            categories: CATEGORIES.map(function (c) {
              return { id: c.id, name: c.name, count: db.tools.filter(function (t) { return !t.retired && t.category === c.id; }).length };
            })
          }
        };
      }

      case 'GET log':
        return { data: db.log.slice(-12).reverse() };

      case 'GET tools': {
        var term = clean(q.q).toLocaleLowerCase('tr');
        var list = db.tools.filter(function (t) {
          if (t.retired) return false;
          if (q.cat && q.cat !== 'hepsi' && t.category !== q.cat) return false;
          if (term && (t.name + ' ' + t.note + ' ' + t.id).toLocaleLowerCase('tr').indexOf(term) === -1) return false;
          return true;
        }).map(function (t) { return publicTool(db, t); });
        if (q.avail === '1') list = list.filter(function (t) { return t.available; });
        return { data: list };
      }

      case 'GET tools/:id': {
        var t = toolById(db, parts[1]);
        if (!t || t.retired) fail(404, 'Bu numarada bir alet yok. Çekmece boş.');
        var pt = publicTool(db, t);
        pt.history = db.loans.filter(function (l) { return l.toolId === t.id; })
          .sort(function (a, b) { return b.start - a.start; }).slice(0, 8)
          .map(function (l) {
            var u = userById(db, l.userId);
            return { start: l.start, due: l.due, returnedAt: l.returnedAt, who: u ? (u.hood || '') : '' };
          });
        if (me) {
          var al = activeLoanFor(db, t.id);
          pt.mine = !!(al && al.userId === me.id);
          pt.myLoanId = pt.mine ? al.id : null;
          pt.inQueue = db.waitlist.some(function (w) { return w.toolId === t.id && w.userId === me.id; });
        }
        return { data: pt };
      }

      case 'GET categories':
        return { data: CATEGORIES };

      case 'POST auth/register': {
        var name = clean(body.name, 60), email = clean(body.email, 120).toLowerCase(), pw = String(body.password || '');
        var hood = clean(body.hood, 40);
        if (name.length < 2) fail(400, 'Adınızı yazın; kartın üstüne basacağız.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'E-posta adresi eksik ya da hatalı görünüyor.');
        if (pw.length < 6) fail(400, 'Parola en az 6 karakter olmalı.');
        if (NEIGHBORHOODS.indexOf(hood) === -1) fail(400, 'Mahallenizi listeden seçin.');
        if (db.users.some(function (u) { return u.email === email; })) fail(409, 'Bu e-postayla açılmış bir kart zaten var.');
        var salt = deps.token().slice(0, 16);
        return deps.hash(pw, salt).then(function (h) {
          var u = {
            id: 'U' + (++db.seq.user), name: name, email: email, hood: hood, role: 'member',
            salt: salt, hash: h, memberNo: String(1000 + db.seq.user * 37), createdAt: Date.now()
          };
          db.users.push(u);
          var tok = deps.token();
          db.sessions[tok] = u.id;
          notify(db, u.id, 'Kartınız hazır. İlk ödüncünüzde kimliğinizi masaya göstermeyi unutmayın.');
          return { status: 201, data: { token: tok, user: publicUser(u) }, changed: true };
        });
      }

      case 'POST auth/login': {
        var em = clean(body.email).toLowerCase();
        var u2 = db.users.filter(function (u) { return u.email === em; })[0];
        if (!u2) fail(401, 'E-posta ya da parola tutmadı.');
        return deps.hash(String(body.password || ''), u2.salt).then(function (h) {
          if (h !== u2.hash) fail(401, 'E-posta ya da parola tutmadı.');
          var tok = deps.token();
          db.sessions[tok] = u2.id;
          return { data: { token: tok, user: publicUser(u2) }, changed: true };
        });
      }

      case 'POST auth/logout':
        if (req.token) delete db.sessions[req.token];
        return { data: { ok: true }, changed: true };

      case 'GET me': {
        needUser();
        var loans = db.loans.filter(function (l) { return l.userId === me.id; })
          .sort(function (a, b) { return b.start - a.start; })
          .map(function (l) {
            var t = toolById(db, l.toolId);
            return {
              id: l.id, toolId: l.toolId, toolName: t ? t.name : '—', icon: t ? t.icon : 'bits',
              start: l.start, due: l.due, returnedAt: l.returnedAt, extended: l.extended,
              canExtend: !l.returnedAt && !l.extended && queueFor(db, l.toolId).length === 0
            };
          });
        return {
          data: {
            user: publicUser(me),
            loans: loans,
            waitlist: db.waitlist.filter(function (w) { return w.userId === me.id; }).map(function (w) {
              var t = toolById(db, w.toolId);
              var qq = queueFor(db, w.toolId);
              return { toolId: w.toolId, toolName: t ? t.name : '—', position: qq.indexOf(w) + 1, available: !activeLoanFor(db, w.toolId) };
            }),
            donations: db.donations.filter(function (d) { return d.userId === me.id; }).reverse(),
            notices: db.notices.filter(function (n) { return n.userId === me.id; }).reverse().slice(0, 10),
            limit: MAX_ACTIVE
          }
        };
      }

      case 'POST notices/:id': // notices/:id/read
        needUser();
        db.notices.forEach(function (n) { if (n.userId === me.id && (parts[1] === 'all' || n.id === parts[1])) n.read = true; });
        return { data: { ok: true }, changed: true };

      case 'POST tools/:id': { // tools/:id/borrow | tools/:id/queue
        needUser();
        var tool = toolById(db, parts[1]);
        if (!tool || tool.retired) fail(404, 'Alet bulunamadı.');
        var action = parts[2];
        if (action === 'borrow') {
          if (activeLoanFor(db, tool.id)) fail(409, 'Bu alet şu an başka bir komşuda. Sıraya girebilirsiniz.');
          var qd = queueFor(db, tool.id);
          if (qd.length && qd[0].userId !== me.id) fail(409, 'Sırada sizden önce bekleyen bir komşu var.');
          var mine = db.loans.filter(function (l) { return l.userId === me.id && !l.returnedAt; });
          if (mine.length >= MAX_ACTIVE) fail(409, 'Aynı anda en fazla ' + MAX_ACTIVE + ' alet. Önce birini iade edin.');
          if (mine.some(function (l) { return l.due < Date.now(); })) fail(409, 'Geciken bir iadeniz var. Onu getirmeden yeni ödünç yok.');
          var days = Math.max(1, Math.min(LOAN_DAYS, parseInt(body.days, 10) || LOAN_DAYS));
          var now = Date.now();
          var l = { id: 'L' + (++db.seq.loan), toolId: tool.id, userId: me.id, start: now, due: now + days * DAY, returnedAt: null, extended: false };
          db.loans.push(l);
          tool.timesLent++;
          db.waitlist = db.waitlist.filter(function (w) { return !(w.toolId === tool.id && w.userId === me.id); });
          addLog(db, 'borrow', tool.id, hoodPhrase(me));
          return { status: 201, data: { loan: l }, changed: true };
        }
        if (action === 'queue') {
          var idx = -1;
          db.waitlist.forEach(function (w, i) { if (w.toolId === tool.id && w.userId === me.id) idx = i; });
          if (idx > -1) { db.waitlist.splice(idx, 1); return { data: { inQueue: false }, changed: true }; }
          var al2 = activeLoanFor(db, tool.id);
          if (!al2) fail(409, 'Alet rafta; sıraya gerek yok, doğrudan alabilirsiniz.');
          if (al2.userId === me.id) fail(409, 'Alet zaten sizde.');
          db.waitlist.push({ toolId: tool.id, userId: me.id, at: Date.now() });
          return { data: { inQueue: true, position: queueFor(db, tool.id).length }, changed: true };
        }
        fail(404, 'Bilinmeyen işlem.');
        break;
      }

      case 'POST loans/:id': { // loans/:id/return | loans/:id/extend
        needUser();
        var loan = db.loans.filter(function (l) { return l.id === parts[1]; })[0];
        if (!loan) fail(404, 'Ödünç kaydı bulunamadı.');
        if (loan.userId !== me.id && me.role !== 'admin') fail(403, 'Bu ödünç size ait değil.');
        if (loan.returnedAt) fail(409, 'Bu alet zaten iade edilmiş.');
        var t3 = toolById(db, loan.toolId);
        if (parts[2] === 'return') {
          loan.returnedAt = Date.now();
          var borrower = userById(db, loan.userId);
          addLog(db, 'return', loan.toolId, hoodPhrase(borrower || me));
          var nq = queueFor(db, loan.toolId);
          if (nq.length) notify(db, nq[0].userId, (t3 ? t3.name : 'Beklediğiniz alet') + ' rafa döndü. Sıra sizde; 48 saat içinde alın.');
          return { data: { ok: true }, changed: true };
        }
        if (parts[2] === 'extend') {
          if (loan.extended) fail(409, 'Her ödünç yalnızca bir kez uzatılabilir.');
          if (queueFor(db, loan.toolId).length) fail(409, 'Bu aleti bekleyen bir komşu var; uzatamıyoruz.');
          loan.due = Math.max(loan.due, Date.now()) + LOAN_DAYS * DAY;
          loan.extended = true;
          return { data: { ok: true, due: loan.due }, changed: true };
        }
        fail(404, 'Bilinmeyen işlem.');
        break;
      }

      case 'POST donations': {
        needUser();
        var dn = clean(body.name, 80), dc = clean(body.category), dcond = clean(body.condition, 40), dnote = clean(body.note, 400);
        if (dn.length < 3) fail(400, 'Aletin adını biraz daha açık yazın.');
        if (!CATEGORIES.some(function (c) { return c.id === dc; })) fail(400, 'Bir çekmece (kategori) seçin.');
        if (!dcond) fail(400, 'Aletin durumunu seçin.');
        var d = { id: 'B' + (++db.seq.donation), userId: me.id, name: dn, category: dc, condition: dcond, note: dnote, status: 'pending', at: Date.now() };
        db.donations.push(d);
        return { status: 201, data: d, changed: true };
      }

      case 'GET admin/overview': {
        needAdmin();
        var now2 = Date.now();
        var active = db.loans.filter(function (l) { return !l.returnedAt; }).map(function (l) {
          var t = toolById(db, l.toolId), u = userById(db, l.userId);
          return { id: l.id, toolId: l.toolId, toolName: t ? t.name : '—', who: u ? u.name : '—', email: u ? u.email : '', due: l.due, overdue: l.due < now2 };
        }).sort(function (a, b) { return a.due - b.due; });
        return {
          data: {
            active: active,
            donations: db.donations.filter(function (d) { return d.status === 'pending'; }).map(function (d) {
              var u = userById(db, d.userId);
              var o = {}; for (var k in d) o[k] = d[k];
              o.who = u ? u.name : '—';
              return o;
            }),
            members: db.users.map(publicUser)
          }
        };
      }

      case 'POST admin/donations': { // admin/donations/:id/approve|reject (parts[2] id, parts[3] action)
        needAdmin();
        var don = db.donations.filter(function (d) { return d.id === parts[2]; })[0];
        if (!don) fail(404, 'Bağış kaydı bulunamadı.');
        if (don.status !== 'pending') fail(409, 'Bu bağış zaten işlenmiş.');
        var donor = userById(db, don.userId);
        if (parts[3] === 'approve') {
          don.status = 'approved';
          var nid = 'ÇK-' + String(++db.seq.tool).padStart(3, '0');
          var iconMap = { delme: 'drill', kesme: 'saw', olcme: 'level', erisim: 'ladder', bahce: 'shears', temizlik: 'vacuum', mutfak: 'pot', etkinlik: 'table' };
          db.tools.push({
            id: nid, category: don.category, icon: iconMap[don.category] || 'bits', name: don.name,
            note: don.note || 'Yeni geldi; henüz hikâyesi yok.', condition: don.condition, weight: null,
            donor: donor ? firstName(donor.name) : 'Bir komşu', timesLent: 0, addedAt: Date.now(), retired: false
          });
          don.toolId = nid;
          addLog(db, 'tool', nid, donor ? hoodPhrase(donor) : 'Bir komşu');
          if (donor) notify(db, donor.id, '"' + don.name + '" rafa kondu: ' + nid + '. Teşekkürler.');
          return { data: { ok: true, toolId: nid }, changed: true };
        }
        if (parts[3] === 'reject') {
          don.status = 'rejected';
          don.reason = clean(body.reason, 200) || 'Şu an yerimiz yok.';
          if (donor) notify(db, donor.id, '"' + don.name + '" için teşekkürler, ama alamıyoruz: ' + don.reason);
          return { data: { ok: true }, changed: true };
        }
        fail(404, 'Bilinmeyen işlem.');
        break;
      }

      case 'POST admin/remind': { // admin/remind/:loanId
        needAdmin();
        var rl = db.loans.filter(function (l) { return l.id === parts[2]; })[0];
        if (!rl || rl.returnedAt) fail(404, 'Aktif ödünç bulunamadı.');
        var rt = toolById(db, rl.toolId);
        notify(db, rl.userId, (rt ? rt.name : 'Aldığınız alet') + ' için iade tarihi geçti. Başka bir komşu bekliyor olabilir.');
        return { data: { ok: true }, changed: true };
      }
    }
    fail(404, 'Böyle bir adres yok: ' + m + ' /' + parts.join('/'));
  }

  return {
    seed: seed, handle: handle, CATEGORIES: CATEGORIES, NEIGHBORHOODS: NEIGHBORHOODS,
    LOAN_DAYS: LOAN_DAYS, MAX_ACTIVE: MAX_ACTIVE
  };
});
