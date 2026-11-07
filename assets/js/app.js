/* Çekmece — istemci uygulaması (hash yönlendirmeli, bağımlılıksız) */
(function () {
  'use strict';

  var Api = window.Api, Core = window.CekmeceCore;
  var $main = document.getElementById('main');
  var $nav = document.getElementById('nav');
  var state = { me: null, unread: 0 };
  var DAY = 86400000;
  var AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  /* ---------- küçük yardımcılar ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) { return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + esc(name) + '"/></svg>'; }
  function d(ts) { var x = new Date(ts); return x.getDate() + ' ' + AYLAR[x.getMonth()]; }
  function dLong(ts) { var x = new Date(ts); return x.getDate() + ' ' + AYLAR[x.getMonth()] + ' ' + x.getFullYear(); }
  function hm(ts) { var x = new Date(ts); return ('0' + x.getHours()).slice(-2) + '.' + ('0' + x.getMinutes()).slice(-2); }
  function ago(ts) {
    var diff = Date.now() - ts, m = Math.round(diff / 60000);
    if (m < 2) return 'az önce';
    if (m < 60) return m + ' dk önce';
    var h = Math.round(m / 60);
    if (h < 24) return h + ' saat önce';
    var g = Math.round(h / 24);
    if (g === 1) return 'dün';
    if (g < 7) return g + ' gün önce';
    return d(ts);
  }
  function left(due) {
    var days = Math.ceil((due - Date.now()) / DAY);
    if (days < 0) return { late: true, text: Math.abs(days) + ' gün gecikti' };
    if (days === 0) return { late: false, text: 'bugün getirilmeli' };
    if (days === 1) return { late: false, text: 'yarın getirilmeli' };
    return { late: false, text: days + ' gün kaldı' };
  }
  function toolHref(id) { return '#/alet/' + encodeURIComponent(id); }
  function tilt(seed) { var n = 0; for (var i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) % 997; return ((n % 13) - 6) / 10; }

  function stampToast(word, text, err) {
    var layer = document.getElementById('stampLayer');
    var el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.innerHTML = '<span class="stamp ' + (err ? 'out' : 'in') + '">' + esc(word) + '</span><span>' + esc(text) + '</span>';
    layer.appendChild(el);
    setTimeout(function () { el.classList.add('bye'); setTimeout(function () { el.remove(); }, 320); }, err ? 4200 : 3000);
  }
  function oops(e) { stampToast('Olmadı', e.message || String(e), true); }

  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '…'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  function barcode(seed) {
    var s = String(seed || '0000') + 'ÇKM', out = '';
    for (var i = 0; i < 46; i++) {
      var c = s.charCodeAt(i % s.length) * (i + 7);
      out += '<i style="width:' + (1 + (c % 3)) + 'px;height:' + (70 + (c % 31)) + '%"></i>';
    }
    return '<span class="bars" aria-hidden="true">' + out + '</span>';
  }

  function memberCard(u, preview) {
    var name = u && u.name ? u.name : (preview ? 'Adınız Soyadınız' : '');
    return '<div class="mcard" aria-label="Üye kartı">' +
      '<span class="hole" aria-hidden="true"></span>' +
      '<div class="mcard-top"><b>Çekmece</b><span>Ödünç kartı</span></div>' +
      '<div class="mcard-body"><div class="mcard-name" data-card="name">' + esc(name) + '</div>' +
      '<div class="mcard-meta"><span>No<b data-card="no">' + esc(u && u.memberNo ? u.memberNo : '— — — —') + '</b></span>' +
      '<span>Mahalle<b data-card="hood">' + esc(u && u.hood ? u.hood : '…') + '</b></span>' +
      '<span>Sınır<b>' + Core.MAX_ACTIVE + ' alet</b></span></div></div>' +
      '<div class="mcard-foot">' + barcode(u && u.memberNo) + '<small>' + (u && u.createdAt ? 'Kayıt ' + dLong(u.createdAt) : 'Henüz basılmadı') + '</small></div>' +
      '</div>';
  }

  /* ---------- şerit metre ---------- */

  (function tape() {
    var nums = document.getElementById('tapeNums'), html = '';
    for (var i = 1; i <= 80; i++) html += '<span class="' + (i % 10 === 0 ? 'red' : '') + '" style="left:' + (i * 40) + 'px">' + i + '</span>';
    nums.innerHTML = html;
    var hook = document.getElementById('tapeHook');
    function onScroll() {
      var max = document.documentElement.scrollHeight - innerHeight;
      var p = max > 0 ? scrollY / max : 0;
      hook.style.transform = 'translateX(' + Math.round(p * (innerWidth - 2)) + 'px)';
    }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
  })();

  /* ---------- gezinme ---------- */

  function renderNav(route) {
    var items = [
      ['katalog', 'Raf'],
      ['kurallar', 'Nasıl?'],
      ['bagis', 'Bağışla']
    ];
    if (state.me) {
      items.push(['hesap', 'Kartım' + (state.unread ? '<span class="count">' + state.unread + '</span>' : '')]);
      if (state.me.role === 'admin') items.push(['masa', 'Masa']);
    } else {
      items.push(['giris', 'Giriş']);
    }
    $nav.innerHTML = items.map(function (it) {
      var cur = route === it[0] || (route === 'alet' && it[0] === 'katalog') || (route === 'uye-ol' && it[0] === 'giris');
      return '<a class="holder" href="#/' + it[0] + '"' + (cur ? ' aria-current="page"' : '') + '>' + it[1] + '</a>';
    }).join('');
  }

  function refreshMe() {
    if (!Api.token()) { state.me = null; state.unread = 0; return Promise.resolve(null); }
    return Api.get('me').then(function (r) {
      state.me = r.user;
      state.unread = r.notices.filter(function (n) { return !n.read; }).length;
      return r;
    }).catch(function () { state.me = null; state.unread = 0; return null; });
  }

  /* ---------- sayfalar ---------- */

  var pages = {};

  pages[''] = function () {
    return Promise.all([Api.get('stats'), Api.get('tools'), Api.get('log')]).then(function (r) {
      var stats = r[0], tools = r[1], log = r[2];
      var board = pickBoard(tools);
      var outN = board.filter(function (t) { return !t.available; }).length;
      return '' +
        '<section class="hero">' +
          '<div>' +
            '<p class="kicker">Defter no. 001 — Yeldeğirmeni, bodrum kat</p>' +
            '<h1>Söylenene göre bir matkap ömrü boyunca <em>13 dakika</em> çalışır.</h1>' +
            '<p class="lede">Kalanını bir dolabın dibinde geçirir. Burada ise duvardaki çivisinde sıradaki komşuyu bekler. Çekmece, komşuların bağışladığı ' + stats.tools + ' aletle çalışan, ücretsiz bir ödünç rafı.</p>' +
            '<div class="hero-actions"><a class="btn" href="#/katalog">Rafa bak →</a>' +
            (state.me ? '<a class="link" href="#/hesap">Kartım</a>' : '<a class="link" href="#/uye-ol">Kart çıkar, ücretsiz</a>') + '</div>' +
            '<p class="hero-note">Satın almadan önce sor: bu alete bir hafta mı, on yıl mı ihtiyacın var?</p>' +
          '</div>' +
          '<figure class="pegboard">' +
            board.map(function (t) {
              return '<a class="peg' + (t.available ? '' : ' out') + '" href="' + toolHref(t.id) + '" title="' + esc(t.name) + '">' +
                '<svg class="shadow" aria-hidden="true"><use href="#i-' + esc(t.icon) + '"/></svg>' +
                '<svg class="real" aria-hidden="true"><use href="#i-' + esc(t.icon) + '"/></svg>' +
                (t.available ? '' : '<span class="tag">' + (t.overdue ? 'Gecikti' : 'Dışarıda') + '<br>' + d(t.due) + '</span>') +
                '<span class="peg-name">' + esc(shortName(t.name)) + '</span></a>';
            }).join('') +
            '<figcaption>Gölge tahtası: boyalı izi görünen alet şu an bir komşuda. Bu panodan ' + outN + ' tanesi dışarıda.</figcaption>' +
          '</figure>' +
        '</section>' +

        '<section class="counter" aria-label="Sayaç">' +
          counterCell(stats.tools, 'Rafta kayıtlı alet') +
          counterCell(stats.out, 'Şu an dışarıda') +
          counterCell(stats.members, 'Kart sahibi') +
          counterCell(stats.lentTotal, 'Toplam ödünç') +
        '</section>' +

        '<section class="section">' +
          '<div class="section-head"><span class="num">§ 1 · İŞLEYİŞ</span><div><h2>Üç adım, bir fiş.</h2><p>Para yok, depozito yok. Karşılığında tek bir şey istiyoruz: aleti bulduğunuz gibi, zamanında getirmeniz.</p></div></div>' +
          '<div class="slip"><div class="slip-head"><span>Ödünç fişi</span><span>No. ' + String(stats.lentTotal + 1).padStart(5, '0') + '</span></div>' +
            '<ol>' +
              '<li><h3>Kart çıkarın.</h3><p>Adınız, e-postanız ve mahalleniz. Kimliği masada bir kez görürüz, o kadar.</p></li>' +
              '<li><h3>Aleti ayırın.</h3><p>Raftan seçin, kaç gün lazım olduğunu işaretleyin. En fazla ' + Core.LOAN_DAYS + ' gün, aynı anda ' + Core.MAX_ACTIVE + ' alet.</p></li>' +
              '<li><h3>Getirin, çiviye asın.</h3><p>Temiz, şarjı dolu, eksiksiz. Biri bekliyorsa ona haber gider.</p></li>' +
            '</ol></div>' +
        '</section>' +

        '<section class="section">' +
          '<div class="section-head"><span class="num">§ 2 · DOLAP</span><div><h2>Sekiz çekmece.</h2><p>Kategoriler bir gece çay içerken belirlendi; mantığını sormayın.</p></div></div>' +
          '<div class="cabinet">' + stats.categories.map(function (c) {
            return '<a class="drawer" href="#/katalog?cat=' + c.id + '"><span class="n">' + String(c.count).padStart(2, '0') + '</span>' +
              '<span class="card-label">' + esc(c.name) + '</span>' + icon(catIcon(c.id)) + '<span class="pull" aria-hidden="true"></span></a>';
          }).join('') + '</div>' +
        '</section>' +

        '<section class="section duo">' +
          '<div><div class="section-head" style="grid-template-columns:1fr"><span class="num" style="width:max-content">§ 3 · DEFTER</span><h2>Son el değiştirenler</h2></div>' +
            '<div class="ledger">' + log.map(ledgerRow).join('') + '</div></div>' +
          '<aside class="door-note"><h3>Kapıya asılı not</h3>' +
            '<dl><dt>Sal–Cum</dt><dd>18.00 – 21.00</dd><dt>Cumartesi</dt><dd>10.00 – 16.00</dd><dt>Paz, Pzt</dt><dd>Kapalı</dd></dl>' +
            '<p>Zil çalışmıyor. Cama iki kere vurun.</p>' +
            '<p>Merdiven ve masa gibi büyük aletleri getirirken arkadaş getirin, bodrum basamağı dik.</p>' +
            '<p class="scrawl">— Bağış kutusu kapının hemen solunda. Kırık alet bırakmayın lütfen!</p></aside>' +
        '</section>';
    });
  };

  function counterCell(n, label) {
    var s = String(n).padStart(3, '0');
    return '<div><div class="digits">' + s.split('').map(function (c) { return '<b>' + c + '</b>'; }).join('') + '</div><p class="label">' + label + '</p></div>';
  }
  function shortName(n) { return n.split(',')[0].replace(/\(.*?\)/g, '').trim(); }
  function catIcon(id) { return { delme: 'drill', kesme: 'saw', olcme: 'level', erisim: 'ladder', bahce: 'shears', temizlik: 'vacuum', mutfak: 'pot', etkinlik: 'projector' }[id] || 'bits'; }
  function pickBoard(tools) {
    var seen = {}, out = [];
    tools.forEach(function (t) { if (!seen[t.icon] && out.length < 12) { seen[t.icon] = 1; out.push(t); } });
    return out;
  }
  function ledgerRow(l) {
    var k = { borrow: 'ÇIKTI', 'return': 'DÖNDÜ', tool: 'YENİ' }[l.kind] || '•';
    return '<div class="ledger-row"><time datetime="' + new Date(l.at).toISOString() + '">' + d(l.at) + '<br>' + hm(l.at) + '</time>' +
      '<div><span class="k ' + l.kind + '">' + k + '</span><a href="' + toolHref(l.toolId) + '">' + esc(l.tool) + '</a> <span class="who">' + esc(l.who) + '</span></div></div>';
  }

  /* katalog */
  pages.katalog = function (params) {
    var cat = params.cat || 'hepsi', q = params.q || '', avail = params.avail === '1';
    return Promise.all([Api.get('stats'), Api.get('tools?cat=' + encodeURIComponent(cat) + '&q=' + encodeURIComponent(q) + (avail ? '&avail=1' : ''))]).then(function (r) {
      var stats = r[0], tools = r[1];
      var cats = [{ id: 'hepsi', name: 'Hepsi', count: stats.tools }].concat(stats.categories);
      var curName = cats.filter(function (c) { return c.id === cat; })[0];
      return '<div class="page-head"><div><p class="kicker">Raf · fiş dolabı</p><h1>' + esc(curName ? curName.name : 'Raf') + '</h1>' +
        '<p>Her fiş bir alet. Yeşil mühür rafta, kırmızı mühür bir komşuda demek. Dışarıdakiler için sıraya girebilirsiniz.</p></div></div>' +
        '<div class="catalog"><nav class="cat-list" aria-label="Çekmeceler">' +
          cats.map(function (c) {
            return '<a href="' + catHref(c.id, q, avail) + '"' + (c.id === cat ? ' aria-current="true"' : '') + '>' + esc(c.name) + '<small>' + c.count + '</small></a>';
          }).join('') +
        '</nav><div>' +
          '<form class="search-row" id="searchForm" role="search">' +
            '<div class="typed-field"><label for="q">Ara:</label><input id="q" name="q" value="' + esc(q) + '" placeholder="matkap, kazan, merdiven…" autocomplete="off"></div>' +
            '<label class="check"><input type="checkbox" id="avail"' + (avail ? ' checked' : '') + '> Yalnız raftakiler</label>' +
          '</form>' +
          (tools.length ? '<div class="cards">' + tools.map(indexCard).join('') + '</div>' :
            '<p class="empty">Bu çekmece boş çıktı. Aradığınız alet bizde yoksa <a href="#/bagis">bağış fişine</a> “istek” olarak yazın; biri dolabında bulur.</p>') +
        '</div></div>';
    });
  };
  pages.katalog.after = function (params) {
    var form = document.getElementById('searchForm'), input = document.getElementById('q'), box = document.getElementById('avail');
    var t;
    function go() { location.hash = catHref(params.cat || 'hepsi', input.value.trim(), box.checked).slice(1); }
    form.addEventListener('submit', function (e) { e.preventDefault(); go(); });
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(go, 380); });
    box.addEventListener('change', go);
    if (params.q) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  };
  function catHref(cat, q, avail) {
    var p = [];
    if (cat && cat !== 'hepsi') p.push('cat=' + encodeURIComponent(cat));
    if (q) p.push('q=' + encodeURIComponent(q));
    if (avail) p.push('avail=1');
    return '#/katalog' + (p.length ? '?' + p.join('&') : '');
  }
  function statusStamp(t) {
    if (t.available) return '<span class="stamp in">Rafta</span>';
    return '<span class="stamp ' + (t.overdue ? 'late' : 'out') + '">' + (t.overdue ? 'Gecikmede' : 'Dışarıda') + '<small>' + (t.overdue ? d(t.due) + "'den beri" : d(t.due) + "'e kadar") + '</small></span>';
  }
  function indexCard(t) {
    return '<a class="icard" style="--tilt:' + tilt(t.id) + 'deg" href="' + toolHref(t.id) + '">' +
      '<div class="code"><span>' + esc(t.id) + '</span><span>' + esc(t.categoryName) + '</span></div>' +
      icon(t.icon) + '<h3>' + esc(t.name) + '</h3><p>' + esc(t.note) + '</p>' + statusStamp(t) + '</a>';
  }

  /* alet detayı */
  pages.alet = function (params, rest) {
    var id = rest[0];
    return Api.get('tools/' + encodeURIComponent(id)).then(function (t) {
      var hist = t.history.length ? t.history.map(function (h) {
        return '<tr><td>' + d(h.start) + '</td><td>' + esc(h.who || '—') + '</td><td>' +
          (h.returnedAt ? '<span class="ds ok">' + d(h.returnedAt) + '</span>' : '<span class="ds">' + (h.due < Date.now() ? 'GECİKTİ' : d(h.due) + ' ?') + '</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="3">Henüz kimse almadı. İlk siz olun.</td></tr>';
      var pad = Math.max(0, 7 - t.history.length), blanks = '';
      for (var i = 0; i < pad; i++) blanks += '<tr><td>&nbsp;</td><td></td><td></td></tr>';

      return '<a class="back" href="#/katalog?cat=' + esc(t.category) + '">← ' + esc(t.categoryName) + '</a>' +
        '<div class="detail"><article class="icard bigcard">' +
          '<div class="code"><span>' + esc(t.id) + '</span><span>' + esc(t.categoryName) + '</span></div>' +
          icon(t.icon) + '<h1>' + esc(t.name) + '</h1><p>' + esc(t.note) + '</p>' +
          '<dl><dt>Durumu</dt><dd>' + esc(t.condition) + '</dd>' +
          (t.weight ? '<dt>Ağırlık</dt><dd>' + String(t.weight).replace('.', ',') + ' kg</dd>' : '') +
          '<dt>Bağışlayan</dt><dd>' + esc(t.donor) + '</dd>' +
          '<dt>El değiştirdi</dt><dd>' + t.timesLent + ' kez</dd>' +
          (t.queue ? '<dt>Sırada</dt><dd>' + t.queue + ' komşu</dd>' : '') + '</dl>' +
          statusStamp(t) +
        '</article>' +
        '<div><section class="pocket"><header><h3>İade tarih kartı</h3><p>Son el değiştirmeler. Kimin aldığını değil, hangi mahalleye gittiğini yazıyoruz.</p></header>' +
          '<table><thead><tr><th>Aldı</th><th>Mahalle</th><th>Getirdi</th></tr></thead><tbody>' + hist + blanks + '</tbody></table></section>' +
          actionBox(t) + '</div></div>';
    });
  };
  function actionBox(t) {
    if (!state.me) {
      return '<div class="actions-box"><h3>Bunu almak için kart lazım.</h3><p>Kart ücretsiz ve iki dakika sürüyor.</p>' +
        '<div class="row"><a class="btn" href="#/uye-ol?next=' + encodeURIComponent(toolHref(t.id)) + '">Kart çıkar</a><a class="link" href="#/giris?next=' + encodeURIComponent(toolHref(t.id)) + '">Kartım var</a></div></div>';
    }
    if (t.mine) {
      return '<div class="actions-box"><h3>Bu alet sizde.</h3><p>' + esc(left(t.due).text) + '. Getirdiğinizde masaya bırakın, buradan da işaretleyin.</p>' +
        '<div class="row"><button class="btn" data-act="return" data-id="' + esc(t.myLoanId) + '">Getirdim</button><a class="link" href="#/hesap">Kartıma git</a></div></div>';
    }
    if (t.available) {
      var days = '';
      for (var i = 1; i <= Core.LOAN_DAYS; i++) {
        var dt = new Date(Date.now() + i * DAY);
        days += '<button type="button" data-days="' + i + '" aria-pressed="' + (i === Core.LOAN_DAYS ? 'true' : 'false') + '">' + i + '<small>' + GUNLER[dt.getDay()] + '</small></button>';
      }
      return '<div class="actions-box"><h3>Kaç gün lazım?</h3><p>Ne kadar kısa, o kadar çok komşu. Seçtiğiniz günün akşamı masaya getirin.</p>' +
        '<div class="days" role="group" aria-label="Gün sayısı">' + days + '</div>' +
        '<div class="row"><button class="btn" data-act="borrow" data-id="' + esc(t.id) + '">Ayır ve al</button><span class="label" id="dueText" style="margin:0"></span></div></div>';
    }
    return '<div class="actions-box"><h3>Şu an başka bir komşuda.</h3><p>' + (t.overdue ? 'İade tarihi geçti; hatırlatma gitti.' : d(t.due) + ' tarihinde dönmesi gerekiyor.') +
      ' Sıraya girerseniz rafa döndüğünde önce size haber veririz.' + (t.queue ? ' Şu an sırada ' + t.queue + ' kişi var.' : '') + '</p>' +
      '<button class="btn ' + (t.inQueue ? 'ghost' : '') + '" data-act="queue" data-id="' + esc(t.id) + '">' + (t.inQueue ? 'Sıradan çık' : 'Sıraya gir') + '</button></div>';
  }
  pages.alet.after = function () {
    var chosen = Core.LOAN_DAYS;
    var dueText = document.getElementById('dueText');
    function showDue() { if (dueText) dueText.textContent = 'Getiriş: ' + dLong(Date.now() + chosen * DAY); }
    showDue();
    $main.querySelectorAll('[data-days]').forEach(function (b) {
      b.addEventListener('click', function () {
        chosen = +b.dataset.days;
        $main.querySelectorAll('[data-days]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        showDue();
      });
    });
    $main.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.dataset.act, id = b.dataset.id, p;
        busy(b, true);
        if (act === 'borrow') p = Api.post('tools/' + encodeURIComponent(id) + '/borrow', { days: chosen }).then(function () { stampToast('Alındı', 'Masadan teslim alabilirsiniz. ' + dLong(Date.now() + chosen * DAY) + ' akşamı bekliyoruz.'); });
        if (act === 'queue') p = Api.post('tools/' + encodeURIComponent(id) + '/queue').then(function (r) { stampToast(r.inQueue ? 'Sırada' : 'Çıktınız', r.inQueue ? r.position + '. sıradasınız. Rafa dönünce haber vereceğiz.' : 'Sıradan çıkardık.'); });
        if (act === 'return') p = Api.post('loans/' + encodeURIComponent(id) + '/return').then(function () { stampToast('Teslim', 'Teşekkürler. Çivisine asıldı.'); });
        p.then(function () { return refreshMe(); }).then(render).catch(function (e) { busy(b, false); oops(e); });
      });
    });
  };

  /* giriş */
  pages.giris = function (params) {
    if (state.me) { location.hash = params.next ? params.next.slice(1) : '/hesap'; return Promise.resolve(''); }
    return Promise.resolve('<div class="formpage"><form class="form" id="loginForm" novalidate>' +
      '<p class="kicker">Kart sahipleri</p><h1>Kartınızı gösterin.</h1><p>Ödünç almak, sıraya girmek ve bağış fişi yazmak için.</p>' +
      '<div class="field"><label for="em">E-posta</label><input id="em" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="pw">Parola</label><input id="pw" name="password" type="password" autocomplete="current-password" required></div>' +
      '<p class="form-error" id="err" role="alert"></p>' +
      '<button class="btn" type="submit">Gir</button>' +
      '<p class="form-foot">Kartınız yok mu? <a href="#/uye-ol' + (params.next ? '?next=' + encodeURIComponent(params.next) : '') + '">Bir tane çıkaralım</a>.</p>' +
      '<div class="demo-keys"><b>Deneme anahtarları</b> — siteyi gezmek için:<br>Üye: komsu@cekmece.local / komsu123<br>Masa görevlisi: masa@cekmece.local / masa1234<br>' +
      '<button type="button" class="btn small ghost" data-fill="komsu@cekmece.local|komsu123">Üye olarak doldur</button><button type="button" class="btn small ghost" data-fill="masa@cekmece.local|masa1234">Görevli olarak doldur</button></div>' +
      '</form><div>' + memberCard(null, true) + '</div></div>');
  };
  pages.giris.after = function (params) {
    var f = document.getElementById('loginForm');
    if (!f) return;
    f.querySelectorAll('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () { var p = b.dataset.fill.split('|'); f.email.value = p[0]; f.password.value = p[1]; f.querySelector('[type=submit]').focus(); });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('[type=submit]'); busy(btn, true);
      Api.post('auth/login', { email: f.email.value, password: f.password.value }).then(function (r) {
        Api.setToken(r.token);
        return refreshMe().then(function () {
          stampToast('Hoş geldin', r.user.name.split(' ')[0] + ', kartın okundu.');
          location.hash = params.next ? params.next.slice(1) : (r.user.role === 'admin' ? '/masa' : '/hesap');
        });
      }).catch(function (e2) { busy(btn, false); document.getElementById('err').textContent = e2.message; });
    });
  };

  /* üyelik */
  pages['uye-ol'] = function (params) {
    if (state.me) { location.hash = '/hesap'; return Promise.resolve(''); }
    return Promise.resolve('<div class="formpage"><form class="form" id="regForm" novalidate>' +
      '<p class="kicker">Yeni kart</p><h1>Ödünç kartı çıkaralım.</h1><p>Ücretsiz. Kartınız sağda, siz yazdıkça basılıyor.</p>' +
      '<div class="field"><label for="nm">Ad soyad</label><input id="nm" name="name" autocomplete="name" maxlength="60" required></div>' +
      '<div class="field"><label for="em">E-posta</label><input id="em" name="email" type="email" autocomplete="email" required><p class="hint">İade hatırlatması dışında yazmayacağız.</p></div>' +
      '<div class="field"><label for="hd">Mahalle</label><select id="hd" name="hood" required><option value="">Seçin…</option>' +
        Core.NEIGHBORHOODS.map(function (h) { return '<option>' + esc(h) + '</option>'; }).join('') + '</select><p class="hint">Aletin nereye gittiğini bu satırdan biliyoruz.</p></div>' +
      '<div class="field"><label for="pw">Parola</label><input id="pw" name="password" type="password" autocomplete="new-password" minlength="6" required><p class="hint">En az 6 karakter.</p></div>' +
      '<p class="form-error" id="err" role="alert"></p>' +
      '<button class="btn" type="submit">Kartı bas</button>' +
      '<p class="form-foot">Zaten kartınız var mı? <a href="#/giris">Giriş yapın</a>.</p>' +
      '</form><div id="cardPreview">' + memberCard(null, true) + '</div></div>');
  };
  pages['uye-ol'].after = function (params) {
    var f = document.getElementById('regForm');
    if (!f) return;
    var nameEl = document.querySelector('[data-card=name]'), hoodEl = document.querySelector('[data-card=hood]');
    f.name.addEventListener('input', function () { nameEl.textContent = f.name.value || 'Adınız Soyadınız'; });
    f.hood.addEventListener('change', function () { hoodEl.textContent = f.hood.value || '…'; });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('[type=submit]'); busy(btn, true);
      Api.post('auth/register', { name: f.name.value, email: f.email.value, hood: f.hood.value, password: f.password.value }).then(function (r) {
        Api.setToken(r.token);
        return refreshMe().then(function () {
          stampToast('Basıldı', 'Kart no. ' + r.user.memberNo + '. Hoş geldiniz.');
          location.hash = params.next ? params.next.slice(1) : '/hesap';
        });
      }).catch(function (e2) { busy(btn, false); document.getElementById('err').textContent = e2.message; });
    });
  };

  /* hesabım */
  pages.hesap = function () {
    if (!Api.token()) { location.hash = '/giris?next=' + encodeURIComponent('#/hesap'); return Promise.resolve(''); }
    return Api.get('me').then(function (r) {
      var active = r.loans.filter(function (l) { return !l.returnedAt; });
      var past = r.loans.filter(function (l) { return l.returnedAt; });
      return '<div class="account"><aside>' + memberCard(r.user) +
        '<button class="btn ghost small" id="logout">Kartı cebe koy (çıkış)</button></aside><div>' +

        '<section class="panel"><h2>Üzerimdekiler <small>' + active.length + ' / ' + r.limit + '</small></h2>' +
          (active.length ? active.map(function (l) {
            var lf = left(l.due);
            return '<div class="loan">' + icon(l.icon) + '<div><h3><a href="' + toolHref(l.toolId) + '">' + esc(l.toolName) + '</a></h3>' +
              '<p>' + esc(l.toolId) + ' · ' + d(l.start) + ' alındı · <span class="' + (lf.late ? 'due-late' : '') + '">' + d(l.due) + ' — ' + lf.text + '</span>' + (l.extended ? ' · uzatıldı' : '') + '</p></div>' +
              '<div class="row">' + (l.canExtend ? '<button class="btn ghost small" data-loan="' + esc(l.id) + '" data-do="extend">+7 gün</button>' : '') +
              '<button class="btn small" data-loan="' + esc(l.id) + '" data-do="return">Getirdim</button></div></div>';
          }).join('') : '<p class="empty" style="padding:14px 0">Üzerinizde alet yok. <a href="#/katalog">Rafa bakın</a>.</p>') +
        '</section>' +

        (r.notices.length ? '<section class="panel"><h2>Panodaki notlar <small>' + r.notices.filter(function (n) { return !n.read; }).length + ' okunmamış</small>' +
          (r.notices.some(function (n) { return !n.read; }) ? '<button class="link" id="readAll" style="margin-left:auto;font-size:12px">Hepsini okudum</button>' : '') + '</h2>' +
          '<div class="notes">' + r.notices.map(function (n) {
            return '<div class="note' + (n.read ? ' read' : '') + '" style="--tilt:' + tilt(n.id) + 'deg">' + esc(n.text) + '<time>' + ago(n.at) + '</time></div>';
          }).join('') + '</div></section>' : '') +

        (r.waitlist.length ? '<section class="panel"><h2>Sırada beklediklerim</h2><table class="mini-table"><thead><tr><th>Alet</th><th>Sıra</th><th>Durum</th></tr></thead><tbody>' +
          r.waitlist.map(function (w) {
            return '<tr><td><a href="' + toolHref(w.toolId) + '">' + esc(w.toolName) + '</a></td><td class="mono">' + w.position + '.</td><td>' +
              (w.available && w.position === 1 ? '<span class="pill approved">Rafta — sıra sizde</span>' : '<span class="pill pending">Bekleniyor</span>') + '</td></tr>';
          }).join('') + '</tbody></table></section>' : '') +

        (r.donations.length ? '<section class="panel"><h2>Bağış fişlerim</h2><table class="mini-table"><thead><tr><th>Alet</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>' +
          r.donations.map(function (dn) {
            var lbl = { pending: 'Masada bekliyor', approved: 'Rafta', rejected: 'Alınamadı' }[dn.status];
            return '<tr><td>' + (dn.toolId ? '<a href="' + toolHref(dn.toolId) + '">' + esc(dn.name) + '</a>' : esc(dn.name)) + '</td><td class="mono">' + d(dn.at) + '</td><td><span class="pill ' + dn.status + '">' + lbl + '</span></td></tr>';
          }).join('') + '</tbody></table></section>' : '') +

        '<section class="panel"><h2>Geçmiş <small>' + past.length + ' ödünç</small></h2>' +
          (past.length ? past.map(function (l) {
            return '<div class="loan past">' + icon(l.icon) + '<div><h3><a href="' + toolHref(l.toolId) + '">' + esc(l.toolName) + '</a></h3><p>' + d(l.start) + ' → ' + d(l.returnedAt) + (l.returnedAt > l.due ? ' · geç getirildi' : '') + '</p></div><span></span></div>';
          }).join('') : '<p class="empty" style="padding:14px 0">Henüz bir şey getirmediniz.</p>') +
        '</section></div></div>';
    });
  };
  pages.hesap.after = function () {
    var lo = document.getElementById('logout');
    if (lo) lo.addEventListener('click', function () {
      Api.post('auth/logout').catch(function () {}).then(function () {
        Api.setToken(null); state.me = null; state.unread = 0;
        stampToast('Görüşürüz', 'Kart cebinizde.');
        location.hash = '/';
      });
    });
    var ra = document.getElementById('readAll');
    if (ra) ra.addEventListener('click', function () { Api.post('notices/all/read').then(refreshMe).then(render).catch(oops); });
    $main.querySelectorAll('[data-loan]').forEach(function (b) {
      b.addEventListener('click', function () {
        busy(b, true);
        Api.post('loans/' + encodeURIComponent(b.dataset.loan) + '/' + b.dataset.do).then(function (r) {
          if (b.dataset.do === 'extend') stampToast('Uzatıldı', 'Yeni tarih: ' + dLong(r.due) + '.');
          else stampToast('Teslim', 'Teşekkürler. Çivisine asıldı.');
          return refreshMe();
        }).then(render).catch(function (e) { busy(b, false); oops(e); });
      });
    });
  };

  /* bağış */
  var WISH = [['Kaynak makinesi', 'çok soruluyor'], ['Fayans kesici', 'masada bekliyor'], ['Mangal (sokak iftarı)', 'mevsimlik'], ['Tekerlekli el arabası', 'bostan için'], ['Dikiş makinesi', 'çok soruluyor'], ['Çadır, 4 kişilik', 'yaz'], ['Boya tabancası', ''], ['Uzatma kablosu, 25 m', 'iki tane']];
  pages.bagis = function () {
    return Promise.resolve('<div class="page-head"><div><p class="kicker">Bağış fişi</p><h1>Dolabınızda yatan bir şey mi var?</h1>' +
      '<p>Fişi doldurun, masa görevlisi bakıp onaylasın, sonra cumartesi getirin. Kırık, eksik parçalı ya da tehlikeli aleti alamıyoruz; onun dışında hemen her şey olur.</p></div></div>' +
      '<div class="formpage" style="padding-top:0"><div>' +
      (state.me ? '<form class="form carbon" id="donForm" novalidate>' +
        '<div class="field"><label for="dn">Alet</label><input id="dn" name="name" maxlength="80" placeholder="ör. Fayans kesici, 60 cm" required></div>' +
        '<div class="field"><label for="dc">Hangi çekmeceye?</label><select id="dc" name="category" required><option value="">Seçin…</option>' +
          Core.CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><span class="label">Durumu</span><div class="radios">' +
          ['Çok iyi', 'İyi', 'Yıpranmış ama sağlam'].map(function (c, i) { return '<label><input type="radio" name="condition" value="' + c + '"' + (i === 1 ? ' checked' : '') + '><span>' + c + '</span></label>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="dno">Bilinmesi gerekenler</label><textarea id="dno" name="note" maxlength="400" placeholder="Eksik parça, garip huy, kullanım ipucu…"></textarea></div>' +
        '<p class="form-error" id="err" role="alert"></p>' +
        '<button class="btn" type="submit">Fişi masaya bırak</button></form>'
      : '<div class="carbon"><h3>Fişi yazmak için kart gerekiyor.</h3><p style="margin:8px 0 18px">Kim getirdiğini bilelim ki teşekkür edebilelim.</p><div class="row"><a class="btn" href="#/uye-ol?next=' + encodeURIComponent('#/bagis') + '">Kart çıkar</a><a class="link" href="#/giris?next=' + encodeURIComponent('#/bagis') + '">Kartım var</a></div></div>') +
      '</div><aside><p class="label">Masanın istek listesi</p><ul class="wish">' + WISH.map(function (w) { return '<li>' + esc(w[0]) + '<span>' + esc(w[1]) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="hero-note">Elektrikli aletlerin kablosunu kontrol ediyoruz. Bıçaklı aletleri kılıfıyla getirin.</p></aside></div>');
  };
  pages.bagis.after = function () {
    var f = document.getElementById('donForm');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('[type=submit]'); busy(btn, true);
      var cond = f.querySelector('[name=condition]:checked');
      Api.post('donations', { name: f.name.value, category: f.category.value, condition: cond ? cond.value : '', note: f.note.value }).then(function () {
        stampToast('Fiş alındı', 'Masa görevlisi onaylayınca kartınıza not düşeceğiz.');
        location.hash = '/hesap';
      }).catch(function (e2) { busy(btn, false); document.getElementById('err').textContent = e2.message; });
    });
  };

  /* masa (yönetim) */
  pages.masa = function () {
    if (!state.me) { location.hash = '/giris?next=' + encodeURIComponent('#/masa'); return Promise.resolve(''); }
    return Api.get('admin/overview').then(function (r) {
      return '<div class="page-head"><div><p class="kicker">Görevli masası</p><h1>Bugünkü defter</h1><p>Dışarıdaki aletler, bekleyen bağışlar, kart sahipleri.</p></div></div>' +
        '<section class="panel"><h2>Dışarıdakiler <small>' + r.active.length + ' alet · ' + r.active.filter(function (a) { return a.overdue; }).length + ' gecikmede</small></h2><div class="table-wrap"><table class="mini-table"><thead><tr><th>No</th><th>Alet</th><th>Kimde</th><th>Getiriş</th><th></th></tr></thead><tbody>' +
          (r.active.map(function (a) {
            return '<tr><td class="mono">' + esc(a.toolId) + '</td><td><a href="' + toolHref(a.toolId) + '">' + esc(a.toolName) + '</a></td><td>' + esc(a.who) + '</td><td class="mono">' +
              (a.overdue ? '<span class="pill late">' + d(a.due) + ' · gecikti</span>' : d(a.due)) + '</td><td><div class="row">' +
              (a.overdue ? '<button class="btn ghost small" data-adm="remind/' + esc(a.id) + '">Hatırlat</button>' : '') +
              '<button class="btn small" data-adm="return/' + esc(a.id) + '">Teslim al</button></div></td></tr>';
          }).join('') || '<tr><td colspan="5">Her şey rafta.</td></tr>') + '</tbody></table></div></section>' +

        '<section class="panel"><h2>Bekleyen bağış fişleri <small>' + r.donations.length + '</small></h2><div class="table-wrap"><table class="mini-table"><thead><tr><th>Alet</th><th>Getiren</th><th>Durum</th><th>Not</th><th></th></tr></thead><tbody>' +
          (r.donations.map(function (dn) {
            var cat = Core.CATEGORIES.filter(function (c) { return c.id === dn.category; })[0];
            return '<tr><td><b>' + esc(dn.name) + '</b><br><small class="mono">' + esc(cat ? cat.name : '') + '</small></td><td>' + esc(dn.who) + '</td><td class="mono">' + esc(dn.condition) + '</td><td>' + esc(dn.note || '—') + '</td><td><div class="row">' +
              '<button class="btn ghost small" data-adm="reject/' + esc(dn.id) + '">Geri çevir</button><button class="btn small" data-adm="approve/' + esc(dn.id) + '">Rafa koy</button></div></td></tr>';
          }).join('') || '<tr><td colspan="5">Bekleyen fiş yok.</td></tr>') + '</tbody></table></div></section>' +

        '<section class="panel"><h2>Kart sahipleri <small>' + r.members.length + '</small></h2><div class="table-wrap"><table class="mini-table"><thead><tr><th>No</th><th>Ad</th><th>Mahalle</th><th>E-posta</th><th>Kayıt</th></tr></thead><tbody>' +
          r.members.map(function (m) {
            return '<tr><td class="mono">' + esc(m.memberNo) + '</td><td>' + esc(m.name) + (m.role === 'admin' ? ' <span class="pill approved">görevli</span>' : '') + '</td><td>' + esc(m.hood) + '</td><td class="mono">' + esc(m.email) + '</td><td class="mono">' + d(m.createdAt) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>';
    });
  };
  pages.masa.after = function () {
    $main.querySelectorAll('[data-adm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.dataset.adm.split('/'), act = p[0], id = p[1], call;
        if (act === 'return') call = Api.post('loans/' + encodeURIComponent(id) + '/return');
        else if (act === 'remind') call = Api.post('admin/remind/' + encodeURIComponent(id));
        else if (act === 'approve') call = Api.post('admin/donations/' + encodeURIComponent(id) + '/approve');
        else {
          var reason = window.prompt('Kısa bir gerekçe (bağışçıya gidecek):', 'Şu an yerimiz yok.');
          if (reason === null) return;
          call = Api.post('admin/donations/' + encodeURIComponent(id) + '/reject', { reason: reason });
        }
        busy(b, true);
        call.then(function (r) {
          var msg = { 'return': ['Teslim', 'Alet rafa döndü.'], remind: ['Gönderildi', 'Komşunun panosuna not düştük.'], approve: ['Rafta', 'Yeni numara: ' + (r && r.toolId)], reject: ['Kapandı', 'Bağışçıya not gitti.'] }[act];
          stampToast(msg[0], msg[1]);
          render();
        }).catch(function (e) { busy(b, false); oops(e); });
      });
    });
  };

  /* kurallar */
  pages.kurallar = function () {
    var rules = [
      ['Bir hafta, üç alet.', 'Her ödünç en fazla ' + Core.LOAN_DAYS + ' gün. Aynı anda en fazla ' + Core.MAX_ACTIVE + ' alet. Bekleyen yoksa bir kez +7 gün uzatabilirsiniz.'],
      ['Geciken alet, kapanan kart.', 'İade tarihi geçince yeni ödünç alamazsınız. Ceza yok; sadece ayıp ve sıradaki komşunun bakışı var.'],
      ['Bulduğunuz gibi getirin.', 'Temiz, şarjı dolu, uçları ve aparatları eksiksiz. Toz torbası boş, kazan yıkanmış.'],
      ['Bozulursa söyleyin.', 'Aletler bozulur, sorun değil. Saklamak sorun. Masaya söyleyin, tamir gününe ekleriz.'],
      ['Sıra adildir.', 'Dışarıdaki alet için sıraya girin. Rafa dönünce ilk sıradakine haber gider; 48 saat içinde almazsa sıra ilerler.'],
      ['Satmak yok, kiralamak yok.', 'Çekmeceden alınan bir aletle para kazanmak isterseniz önce masaya gelin, konuşalım. Genelde cevap hayır.']
    ];
    var faq = [
      ['Ücretli mi?', 'Hayır. Masa kirasını bağış kutusu ve yılda bir yapılan kermes ödüyor.'],
      ['Kadıköy dışında oturuyorum, üye olabilir miyim?', 'Şu an listede olmayan mahalleler için kart basamıyoruz; büyük aletleri taşımak zor ve geri dönüşleri takip edemiyoruz. Kendi mahallenizde bir çekmece açmak isterseniz defterimizi seve seve paylaşırız.'],
      ['Aleti bozarsam ne olur?', 'Kullanımdan kaynaklı aşınma bizim sorunumuz. Belirgin bir hor kullanım varsa tamir parasını bölüşmeyi konuşuruz.'],
      ['Bu site verimi ne yapıyor?', 'Adınız, e-postanız ve mahalleniz defterde durur. Başkasıyla paylaşılmaz. Alet sayfalarında sizin adınız değil, yalnızca mahalleniz görünür.'],
      ['Gönüllü olabilir miyim?', 'Masa her akşam iki kişiyle açılıyor. Cumartesi tamir gününe gelin, çayı biz koyarız.']
    ];
    return Promise.resolve('<div class="page-head"><div><p class="kicker">Kapının iç yüzüne vidalı levha</p><h1>Altı kural, beş soru.</h1><p>Uzun bir sözleşme yok. Bu kadar.</p></div></div>' +
      '<div class="rules">' + rules.map(function (r) { return '<div class="rule"><div><h3>' + esc(r[0]) + '</h3><p>' + esc(r[1]) + '</p></div></div>'; }).join('') + '</div>' +
      '<div class="faq"><p class="label">Sık sorulanlar</p>' + faq.map(function (f) { return '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>'; }).join('') + '</div>');
  };

  pages.notfound = function () {
    return Promise.resolve('<div class="page-head"><div><p class="kicker">404</p><h1>Bu çekmece boş.</h1><p>Aradığınız sayfa ya hiç olmadı ya da biri ödünç aldı. <a href="#/">Ön kapağa dönün</a>.</p></div></div>');
  };

  /* ---------- yönlendirici ---------- */

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?'), qs = qi > -1 ? h.slice(qi + 1) : '', path = qi > -1 ? h.slice(0, qi) : h;
    var params = {};
    qs.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); try { params[decodeURIComponent(p[0])] = decodeURIComponent(p.slice(1).join('=')); } catch (e) {} });
    var seg = path.split('/').filter(Boolean).map(function (s) { try { return decodeURIComponent(s); } catch (e) { return s; } });
    return { name: seg[0] || '', rest: seg.slice(1), params: params };
  }

  var renderSeq = 0, lastName = null;
  function render() {
    var r = parseHash(), seq = ++renderSeq;
    var page = pages.hasOwnProperty(r.name) ? pages[r.name] : pages.notfound;
    renderNav(r.name);
    var keepScroll = lastName === r.name;
    lastName = r.name;
    page(r.params, r.rest).then(function (html) {
      if (seq !== renderSeq || html === '') return;
      $main.innerHTML = html;
      if (page.after) page.after(r.params, r.rest);
      if (!keepScroll) { window.scrollTo(0, 0); $main.focus({ preventScroll: true }); }
      var t = $main.querySelector('h1');
      document.title = (t && r.name ? t.textContent + ' — ' : '') + 'Çekmece';
    }).catch(function (e) {
      if (seq !== renderSeq) return;
      $main.innerHTML = '<div class="page-head"><div><p class="kicker">Hata</p><h1>Çekmece sıkıştı.</h1><p>' + esc(e.message) + '</p><p><a href="#/">Ön kapağa dönün</a>.</p></div></div>';
    });
  }

  function footerMode() {
    var el = document.getElementById('modeNote');
    if (Api.mode() === 'server') {
      el.innerHTML = 'Sunucuda tutuluyor (<code>server/data/db.json</code>). Herkes aynı rafı görür.';
    } else {
      el.innerHTML = 'Bu tarayıcıda tutuluyor — sayfa dosyadan açıldı. Ortak defter için <code>node server/server.js</code>.<br><button class="btn ghost small" id="resetLocal">Defteri baştan yaz</button>';
      document.getElementById('resetLocal').addEventListener('click', function () {
        if (!confirm('Bu tarayıcıdaki tüm ödünçler, kartlar ve bağışlar silinip örnek veriye dönülecek. Emin misiniz?')) return;
        Api.resetLocal(); state.me = null; state.unread = 0;
        stampToast('Sıfırlandı', 'Defter ilk günündeki hâline döndü.');
        location.hash = '/'; render();
      });
    }
  }

  addEventListener('hashchange', render);
  Api.ready.then(function () { footerMode(); return refreshMe(); }).then(render);
})();
