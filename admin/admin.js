/* admin.js — sign in, dashboard, and editors for every content file. */
(function () {
  'use strict';
  var SITE = window.SITE || {}, API = SITE.api || '';
  var $ = function (s) { return document.querySelector(s); };
  var token = null, days = 30, cache = {};
  try { token = sessionStorage.getItem('cf.admin.token'); } catch (e) {}

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  function fmt(n) { return String(n == null ? 0 : n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function dur(sec) {
    sec = Math.round(sec || 0);
    if (!sec) return '—';
    if (sec < 60) return sec + 's';
    var m = Math.floor(sec / 60), s2 = sec % 60;
    if (m < 60) return m + 'm ' + (s2 ? s2 + 's' : '').trim();
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }
  // a 2-letter code maps to its flag by offsetting into the regional-indicator block
  function flag(cc) {
    if (!/^[A-Za-z]{2}$/.test(cc || '')) return '🏳';
    return String.fromCodePoint.apply(null, cc.toUpperCase().split('').map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; }));
  }
  var names = null;
  function countryName(cc) {
    if (!cc) return 'Unknown';
    try {
      if (!names && typeof Intl !== 'undefined' && Intl.DisplayNames) names = new Intl.DisplayNames(['en'], { type: 'region' });
      return (names && names.of(cc)) || cc;
    } catch (e) { return cc; }
  }
  function api(path, opts) {
    opts = opts || {};
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(API + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { if (r.status === 401) signOut(); throw new Error(j.error || ('HTTP ' + r.status)); } return j; }); });
  }

  /* ------------------------------------------------------------ views */
  function show(v) {
    ['login', 'dash', 'content', 'settings'].forEach(function (x) { $('#v-' + x).hidden = x !== v; });
    document.querySelectorAll('#adm-tabs .tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.v === v)); });
    $('#adm-tabs').hidden = v === 'login'; $('#logout').hidden = v === 'login';
    if (v === 'dash') loadDash();
    if (v === 'content') renderFiles();
    if (v === 'settings') openFile('site', $('#s-editor'));
  }
  function signOut() { token = null; try { sessionStorage.removeItem('cf.admin.token'); } catch (e) {} show('login'); }

  /* ------------------------------------------------------------ login */
  $('#login-api').textContent = API ? 'API: ' + API : 'No API configured yet — set api_base in site.json and rebuild.';
  $('#login-form').onsubmit = function (e) {
    e.preventDefault();
    $('#login-err').hidden = true; $('#login-btn').disabled = true;
    api('/login', { method: 'POST', body: { password: $('#pw').value } }).then(function (r) {
      token = r.token; try { sessionStorage.setItem('cf.admin.token', token); } catch (x) {}
      $('#pw').value = ''; show('dash');
    }).catch(function (err) { $('#login-err').textContent = err.message; $('#login-err').hidden = false; })
      .then(function () { $('#login-btn').disabled = false; });
  };
  $('#logout').onclick = signOut;
  document.querySelectorAll('#adm-tabs .tab').forEach(function (t) { t.onclick = function () { show(t.dataset.v); }; });

  /* -------------------------------------------------------- dashboard */
  function loadDash() {
    $('#dash-sub').textContent = 'Loading…';
    api('/stats?days=' + days).then(function (s) {
      $('#dash-sub').textContent = 'Live counts from the site, updated ' + new Date(s.generated).toLocaleTimeString() + '. Nothing personal is collected.';
      var k = $('#d-kpis'); k.innerHTML = '';
      var dw = s.dwell || { avg: 0, sessions: 0 };
      [[fmt(s.today.views), 'views today', fmt(s.today.uniq) + ' visitors · ' + fmt(s.today.conv) + ' conversions'],
       [fmt(s.last7.views), 'views, last 7 days', fmt(s.last7.uniq) + ' visitors · ' + fmt(s.last7.conv) + ' conversions'],
       [fmt(s.last30.views), 'views, last 30 days', fmt(s.last30.uniq) + ' visitors · ' + fmt(s.last30.conv) + ' conversions'],
       [fmt(s.totals.conv), 'files converted, all time', fmt(s.totals.views) + ' views · ' + fmt(s.totals.uniq) + ' visitors · ' + fmt(s.totals.fail) + ' failed'],
       [dur(dw.avg), 'average time on the site', fmt(dw.sessions) + ' sessions measured · ' + dur(dw.seconds) + ' in total']
      ].forEach(function (x) { var d = el('div', 'kpi'); d.appendChild(el('b', null, x[0])); d.appendChild(el('span', null, x[1])); d.appendChild(el('small', null, x[2])); k.appendChild(d); });
      chart($('#d-chart'), s.daily);
      table($('#d-pairs'), s.pairs, function (r) { return r.key.replace('>', ' → '); });
      table($('#d-pages'), s.pages, function (r) { return r.key; });
      table($('#d-countries'), s.countries, function (r) { return flag(r.key) + '  ' + countryName(r.key); }, 'No visits recorded yet');
      table($('#d-regions'), s.regions, function (r) { return r.region + (r.country ? ', ' + countryName(r.country) : ''); }, 'No visits recorded yet');
      table($('#d-refs'), s.referrers, function (r) { return r.key; }, 'Only direct visits so far');
      table($('#d-devices'), s.devices, function (r) { return r.key; });
      table($('#d-fails'), s.failures, function (r) { return r.key.replace('>', ' → '); }, 'No failures — good');
    }).catch(function (e) { $('#dash-sub').textContent = 'Could not load stats: ' + e.message; });
  }
  function table(t, rows, label, emptyText) {
    t.innerHTML = '';
    if (!rows || !rows.length) { var tr = el('tr'); var td = el('td', 'empty', emptyText || 'Nothing yet'); tr.appendChild(td); t.appendChild(tr); return; }
    var max = rows[0].n || 1;
    rows.forEach(function (r) {
      var tr = el('tr'), a = el('td'), b = el('td', null, fmt(r.n));
      a.appendChild(el('div', null, label(r)));
      var bar = el('div', 'bar'), i = el('i'); i.style.width = Math.round(r.n / max * 100) + '%'; bar.appendChild(i); a.appendChild(bar);
      tr.appendChild(a); tr.appendChild(b); t.appendChild(tr);
    });
  }
  function chart(box, daily) {
    var W = 800, H = 220, P = 28, n = daily.length, max = Math.max(1, Math.max.apply(null, daily.map(function (d) { return d.views; })));
    var bw = (W - P * 2) / n, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    [0.25, 0.5, 0.75, 1].forEach(function (f) { var y = H - P - (H - P * 2) * f; s += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>'; s += '<text x="' + (P - 4) + '" y="' + (y + 4) + '" font-size="10" text-anchor="end" fill="var(--muted)">' + Math.round(max * f) + '</text>'; });
    daily.forEach(function (d, i) {
      var x = P + i * bw, vh = (H - P * 2) * d.views / max, ch = (H - P * 2) * d.conv / max;
      s += '<rect x="' + (x + bw * 0.15) + '" y="' + (H - P - vh) + '" width="' + (bw * 0.7) + '" height="' + vh + '" rx="2" fill="var(--accent-soft)"><title>' + d.day + ': ' + d.views + ' views, ' + d.conv + ' conversions</title></rect>';
      s += '<rect x="' + (x + bw * 0.15) + '" y="' + (H - P - ch) + '" width="' + (bw * 0.7) + '" height="' + ch + '" rx="2" fill="var(--accent)"/>';
      if (n <= 31 || i % 7 === 0) s += '<text x="' + (x + bw / 2) + '" y="' + (H - P + 14) + '" font-size="9" text-anchor="middle" fill="var(--muted)">' + d.day.slice(5) + '</text>';
    });
    s += '<text x="' + (W - P) + '" y="14" font-size="10" text-anchor="end" fill="var(--muted)">light = views · dark = conversions</text></svg>';
    box.innerHTML = s;
  }
  document.querySelectorAll('.adm-range [data-days]').forEach(function (b) {
    b.onclick = function () { days = +b.dataset.days; document.querySelectorAll('.adm-range [data-days]').forEach(function (x) { x.classList.toggle('primary', x === b); }); loadDash(); };
  });
  $('#refresh').onclick = loadDash;

  /* ---------------------------------------------------------- content */
  var FILES = [
    ['popular', 'Popular conversions', 'The tiles on the home page. Each needs a from-extension, a to-extension and a label.'],
    ['guides', 'Guides', 'Articles. Body lines: start a line with "h:" for a heading, "p:" for a paragraph, "ul:" for a bullet list with items separated by |.'],
    ['faq', 'FAQ', 'Questions and answers on the home page.'],
    ['about', 'About', 'Intro paragraphs and the bullet points.'],
    ['steps', 'How it works', 'The three steps.'],
    ['support', 'Support / UPI', 'UPI id, payee name, the tip text.'],
    ['sponsor', 'Sponsor', 'Fill in name, url and tagline to show "Sponsored by"; leave name empty for the open slot.']
  ];
  function renderFiles() {
    var nav = $('#c-files'); nav.innerHTML = '';
    FILES.forEach(function (f) {
      var b = el('button', null, f[1]); b.dataset.name = f[0];
      b.onclick = function () { nav.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); openFile(f[0], $('#c-editor'), f); };
      nav.appendChild(b);
    });
  }
  function openFile(name, box, meta) {
    box.innerHTML = ''; box.appendChild(el('p', 'sub', 'Loading ' + name + '…'));
    api('/content/' + name).then(function (r) {
      cache[name] = r;
      box.innerHTML = '';
      box.appendChild(el('h2', null, meta ? meta[1] : 'Site settings'));
      box.appendChild(el('p', 'hint', meta ? meta[2] : 'Changes here affect every page. The domain is fixed by the hosting setup.'));
      var form = editorFor(name, r.data);
      box.appendChild(form.node);
      var acts = el('div', 'adm-acts'), save = el('button', 'btn primary', 'Save & publish'), st = el('span', 'adm-status');
      save.type = 'button';
      save.onclick = function () {
        var data;
        try { data = form.read(); } catch (e) { st.className = 'adm-status err'; st.textContent = e.message; return; }
        save.disabled = true; st.className = 'adm-status'; st.textContent = 'Saving…';
        api('/content/' + name, { method: 'PUT', body: { data: data } }).then(function (res) {
          st.className = 'adm-status ok'; st.textContent = 'Saved. The site rebuilds in about a minute.';
          if (res.commit) { var a = el('a', null, ' view commit'); a.href = res.commit; a.target = '_blank'; st.appendChild(a); }
          toast('Published');
        }).catch(function (e) { st.className = 'adm-status err'; st.textContent = e.message; }).then(function () { save.disabled = false; });
      };
      acts.appendChild(save); acts.appendChild(st); box.appendChild(acts);
    }).catch(function (e) { box.innerHTML = ''; box.appendChild(el('p', 'adm-err', e.message)); });
  }

  // Generic editors: a list of objects becomes repeatable cards; an object becomes fields.
  function field(label, value, opts) {
    opts = opts || {};
    var w = el('div', 'adm-field'), l = el('label', 'adm-l', label), inp;
    if (opts.multiline) { inp = el('textarea'); inp.value = value == null ? '' : (Array.isArray(value) ? value.join('\n') : String(value)); }
    else if (typeof value === 'boolean') { inp = el('select'); ['true', 'false'].forEach(function (v) { var o = el('option', null, v); o.value = v; inp.appendChild(o); }); inp.value = String(value); }
    else { inp = el('input'); inp.type = 'text'; inp.value = value == null ? '' : String(value); }
    w.appendChild(l); w.appendChild(inp);
    if (opts.help) w.appendChild(el('small', null, opts.help));
    w.read = function () {
      if (opts.multiline && opts.lines) return inp.value.split('\n').map(function (s) { return s.replace(/\s+$/, ''); }).filter(Boolean);
      if (typeof value === 'boolean') return inp.value === 'true';
      if (typeof value === 'number') { var n = parseFloat(inp.value); if (isNaN(n)) throw new Error(label + ' must be a number'); return n; }
      return inp.value;
    };
    return w;
  }
  var HELP = { popular: { from: 'extension without the dot, e.g. heic', to: 'e.g. jpg', label: 'shown on the tile, e.g. HEIC to JPG' },
               guides: { slug: 'URL part: /guides/<slug>/ — letters, numbers and dashes', cat: 'small label above the title', fam: 'colour: image, doc, table, data, audio, video, archive, model3d', body: 'one block per line: h:Heading · p:Paragraph (simple HTML allowed) · ul:item|item', tryFrom: 'the "try it" pair', tryTo: '' },
               support: { upiId: 'e.g. name@bank', payeeName: 'must match the name registered on the UPI id', qr: 'path of the QR image', blurb: 'one paragraph per line' },
               about: { intro: 'one paragraph per line', points: 'one bullet per line' },
               site: { domain: 'do not change — set by hosting', contact_email: 'shown on Contact and legal pages', adsense_client: 'ca-pub-… from AdSense; blank = no ads', ga4_measurement_id: 'G-… from Google Analytics; blank = none', api_base: 'the analytics API URL (this admin panel talks to it)' } };
  function objectEditor(name, obj) {
    var node = el('div'), fields = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k], help = (HELP[name] || {})[k] || '';
      if (Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; })) fields[k] = field(k, v, { multiline: true, lines: true, help: help });
      else if (v && typeof v === 'object' && !Array.isArray(v)) { var sub = objectEditor(name, v); var w = el('div', 'adm-item'); w.appendChild(el('div', 'adm-item-h')).appendChild(el('b', null, k)); w.appendChild(sub.node); fields[k] = { read: sub.read }; node.appendChild(w); return; }
      else fields[k] = field(k, v, { multiline: typeof v === 'string' && v.length > 90, help: help });
      node.appendChild(fields[k]);
    });
    return { node: node, read: function () { var o = {}; Object.keys(fields).forEach(function (k) { o[k] = fields[k].read(); }); return o; } };
  }
  function listEditor(name, list) {
    var node = el('div'), items = [];
    var template = list[0] || {};
    function addItem(obj, atTop) {
      var w = el('div', 'adm-item'), h = el('div', 'adm-item-h'), title = el('b', null, (obj.label || obj.title || obj.q || obj.from || 'item'));
      var rm = el('button', 'btn sm danger', 'Remove'); rm.type = 'button';
      h.appendChild(title); h.appendChild(rm); w.appendChild(h);
      var ed = objectEditor(name, obj); w.appendChild(ed.node);
      var rec = { node: w, read: ed.read };
      rm.onclick = function () { w.remove(); items.splice(items.indexOf(rec), 1); };
      items.push(rec);
      if (atTop) node.insertBefore(w, node.firstChild); else node.appendChild(w);
    }
    list.forEach(function (o) { addItem(o); });
    var add = el('button', 'btn', 'Add new'); add.type = 'button';
    add.onclick = function () { var blank = {}; Object.keys(template).forEach(function (k) { blank[k] = Array.isArray(template[k]) ? [] : (typeof template[k] === 'boolean' ? false : ''); }); addItem(blank, true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    var wrap = el('div'); wrap.appendChild(add); wrap.appendChild(node);
    return { node: wrap, read: function () { return items.map(function (i) { return i.read(); }); } };
  }
  function editorFor(name, data) {
    if (Array.isArray(data)) return listEditor(name, data);
    return objectEditor(name, data);
  }

  /* ------------------------------------------------------------ start */
  if (!API) { $('#login-btn').disabled = true; }
  show(token ? 'dash' : 'login');
})();
