/* app.js — UI: pick a file, choose from/to, convert, download, browse My files. */
(function (root) {
  'use strict';
  var F = root.Formats, C = root.Convert, DB = root.DB;
  var $ = function (s) { return document.querySelector(s); };
  var state = { files: [], from: 'png', to: 'jpg', last: null, fresh: null, batch: null };
  var TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  var uid = 0;
  var FAM_VAR = { image: 'var(--f-image)', doc: 'var(--f-doc)', table: 'var(--f-table)', data: 'var(--f-data)',
                  audio: 'var(--f-audio)', video: 'var(--f-video)', archive: 'var(--f-archive)', model3d: 'var(--f-model3d)', any: 'var(--f-any)' };
  var IMG_PREVIEW = /^(png|jpg|jpeg|jfif|webp|gif|bmp|svg|ico|avif)$/;

  /* ------------------------------------------------------------- helpers */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function icon(name) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }
  function btn(label, cls, ic) {
    var b = el('button', 'btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    if (ic) b.appendChild(icon(ic));
    b.appendChild(el('span', null, label));
    return b;
  }
  function toast(msg, ic) {
    var t = $('#toast');
    t.innerHTML = '';
    if (ic) t.appendChild(icon(ic));
    t.appendChild(el('span', null, msg));
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 2400);
  }
  function when(ts) {
    var diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = el('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Downloading ' + name, 'download');
  }
  function famOf(ext) { return ext === '*' ? 'any' : F.meta(ext).family; }
  function chip(ext) {
    var c = el('span', 'chip', '.' + ext);
    c.style.setProperty('--fam', FAM_VAR[famOf(ext)]);
    return c;
  }
  function badge(ext, small) {
    var b = el('div', 'badge' + (small ? ' sm' : ''), '.' + ext);
    b.style.setProperty('--fam', FAM_VAR[famOf(ext)]);
    return b;
  }
  var liveUrls = [];
  function preview(rec, small) {
    var ext = rec.targetExt;
    if (IMG_PREVIEW.test(ext)) {
      var url = URL.createObjectURL(rec.blob);
      liveUrls.push(url);
      var img = el('img');
      img.src = url; img.alt = rec.name;
      return img;
    }
    return badge(ext, small);
  }
  function revokeAll() { liveUrls.forEach(function (u) { URL.revokeObjectURL(u); }); liveUrls = []; }

  /* --------------------------------------------------------------- views */
  function isHome() {
    return location.pathname === '/' || /index\.html$/.test(location.pathname);
  }
  function show(name, keepScroll) {
    ['convert', 'files', 'formats', 'guides'].forEach(function (v) {
      if (v === name) $('#nav-' + v).setAttribute('aria-current', 'page'); else $('#nav-' + v).removeAttribute('aria-current');
      $('#view-' + v).hidden = v !== name;
    });
    if (name === 'files') renderFiles();
    if (name === 'formats') renderFormats();
    if (name === 'guides') renderGuides();
    if (name === 'convert') renderHome();
    if (!keepScroll) window.scrollTo({ top: 0 });
  }
  // Preset the converter to a pair (from a popular tile or a guide) and ask for a file.
  function preset(from, to) {
    if (!C.rule(from, to)) return;
    state.from = from; state.to = to;
    refreshTargets();
    show('convert');
    closeGuide();
    $('#file').click();
  }

  /* ---------------------------------------------------- format pickers */
  // Search terms people actually type, beyond the extension and format name.
  var ALIAS = {
    docx: 'word microsoft office', doc: 'word', xlsx: 'excel spreadsheet', xls: 'excel', xlsm: 'excel macro', xlsb: 'excel binary',
    csv: 'comma excel table', tsv: 'tab table', ods: 'libreoffice openoffice calc', odt: 'libreoffice openoffice writer',
    pdf: 'acrobat document print', jpg: 'jpeg photo picture', jpeg: 'photo picture', png: 'picture transparent',
    heic: 'iphone apple photo', heif: 'apple photo', webp: 'google web picture', avif: 'av1 picture', jxl: 'jpeg xl picture',
    gif: 'animated animation', svg: 'vector', ico: 'icon favicon windows', icns: 'icon mac apple app', bmp: 'bitmap windows',
    tga: 'targa game texture', ppm: 'netpbm', pgm: 'netpbm grey', pbm: 'netpbm bitmap', tif: 'scan', tiff: 'scan',
    md: 'markdown readme', markdown: 'readme', html: 'web page website', htm: 'web page', txt: 'plain text notes',
    rtf: 'rich text wordpad', epub: 'ebook kindle reader', tex: 'latex', json: 'javascript api data', yaml: 'config',
    yml: 'config', toml: 'config rust', xml: 'data markup', sql: 'database mysql postgres sqlite insert',
    mp3: 'music song audio', wav: 'audio lossless', m4a: 'apple itunes aac audio', aac: 'audio', ogg: 'opus vorbis audio',
    opus: 'ogg voice audio', flac: 'lossless audio', mp4: 'video movie h264', mov: 'quicktime apple video', webm: 'video vp9 web',
    m4v: 'apple video', ogv: 'ogg video', zip: 'archive compress', tar: 'archive unix', gz: 'gzip compress', tgz: 'gzip tar',
    obj: '3d model mesh', stl: '3d print mesh', ply: '3d mesh point cloud', glb: '3d ar model android scene viewer', gltf: '3d ar model',
    ttf: 'font truetype', otf: 'font opentype', woff: 'font web'
  };
  var picker = { open: null, items: [], active: -1 };

  function famOfExt(e) { return e === '*' ? 'any' : F.meta(e).family; }
  function sourceItems() {
    return C.sourcesList().map(function (e) {
      var n = C.targetsFor(e).filter(function (t) { return t !== '*'; }).length;
      return { ext: e, fam: famOfExt(e), name: e === '*' ? 'Any other file' : F.meta(e).name, extra: n + ' target' + (n === 1 ? '' : 's'), count: n };
    }).filter(function (it) { return it.count > 0; });
  }
  function targetItems() {
    var src = state.files.length > 1 ? sourceExts()[0] : state.from;
    return currentTargets().map(function (t) {
      var r = C.rule(src, t);
      return { ext: t, fam: famOfExt(t), name: F.meta(t).name, extra: r && r.note ? r.note : '' };
    });
  }
  function haystack(it) { return (it.ext + ' ' + it.name + ' ' + F.FAMILY[it.fam].label + ' ' + (ALIAS[it.ext] || '')).toLowerCase(); }

  function openPicker(which) {
    var tile = $('#tile-' + which);
    if (tile.classList.contains('locked')) { if (which === 'from') toast('Each file keeps its own type — remove files to change this'); return; }
    closePicker();
    picker.open = which;
    picker.items = which === 'from' ? sourceItems() : targetItems();
    tile.setAttribute('aria-expanded', 'true');
    var box = $('#picker'), r = tile.getBoundingClientRect();
    box.hidden = false;
    if (sheetMode()) { box.style.left = box.style.width = box.style.top = box.style.bottom = ''; }
    else {
      var w = Math.min(440, window.innerWidth - 32), left = Math.min(Math.max(16, r.left), window.innerWidth - w - 16);
      var below = r.bottom + 8, spaceBelow = window.innerHeight - below;
      box.style.left = left + 'px';
      box.style.width = w + 'px';
      if (spaceBelow < 320 && r.top > 360) { box.style.top = 'auto'; box.style.bottom = (window.innerHeight - r.top + 8) + 'px'; }
      else { box.style.bottom = 'auto'; box.style.top = below + 'px'; }
    }
    $('#picker-q').value = '';
    $('#picker-q').placeholder = which === 'from' ? 'Search ' + picker.items.length + ' source formats' : 'Search ' + picker.items.length + ' targets for .' + state.from;
    paintPicker();
    if (!TOUCH) $('#picker-q').focus();
  }
  function closePicker() {
    if (!picker.open) return;
    $('#tile-' + picker.open).setAttribute('aria-expanded', 'false');
    picker.open = null; picker.active = -1;
    $('#picker').hidden = true;
  }
  function paintPicker() {
    var q = $('#picker-q').value.trim().toLowerCase(), list = $('#picker-list');
    var terms = q.split(/\s+/).filter(Boolean);
    var current = picker.open === 'from' ? state.from : state.to;
    if (picker.open === 'to') picker.items = targetItems();
    var shown = picker.items.filter(function (it) {
      if (!terms.length) return true;
      var h = haystack(it);
      return terms.every(function (t) { return h.indexOf(t.replace(/^\./, '')) > -1; });
    });
    // exact extension match floats to the top
    shown.sort(function (a, b) {
      var ea = a.ext === q.replace(/^\./, '') ? -1 : 0, eb = b.ext === q.replace(/^\./, '') ? -1 : 0;
      return ea - eb;
    });
    picker.visible = shown;
    picker.active = shown.length ? Math.max(0, shown.findIndex(function (it) { return it.ext === current; })) : -1;
    if (terms.length && shown.length) picker.active = 0;
    list.innerHTML = '';
    $('#picker-hint').textContent = shown.length ? shown.length + ' of ' + picker.items.length : '';
    if (!shown.length) {
      var e = el('div', 'picker-empty');
      e.appendChild(el('b', null, 'No format matches "' + q + '"'));
      e.appendChild(el('div', null, picker.open === 'to' ? 'Not every pair is possible — see the Formats tab for what .' + state.from + ' can become.' : 'Try the extension, e.g. "docx", or a word like "photo" or "excel".'));
      list.appendChild(e);
      return;
    }
    var lastFam = null;
    shown.forEach(function (it, i) {
      if (!terms.length && it.fam !== lastFam) { list.appendChild(el('div', 'picker-g', F.FAMILY[it.fam].label)); lastFam = it.fam; }
      var row = el('div', 'picker-i' + (i === picker.active ? ' active' : '') + (it.ext === current ? ' selected' : ''));
      row.setAttribute('role', 'option'); row.dataset.i = i;
      row.appendChild(chip(it.ext));
      row.appendChild(el('span', 'pname', it.name));
      if (it.extra) row.appendChild(el('span', 'pn', it.extra));
      row.onmousedown = function (e) { e.preventDefault(); choose(it.ext); };
      row.onmouseenter = function () { setActive(i); };
      list.appendChild(row);
    });
    scrollActiveIntoView();
  }
  function setActive(i) {
    picker.active = i;
    Array.prototype.forEach.call($('#picker-list').querySelectorAll('.picker-i'), function (r) { r.classList.toggle('active', +r.dataset.i === i); });
  }
  // scroll the list itself, never the page (scrolling the page would close the picker)
  function scrollActiveIntoView() {
    var list = $('#picker-list'), r = list.querySelector('.picker-i.active');
    if (!r) return;
    var top = r.offsetTop - list.offsetTop, bottom = top + r.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 6;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 6;
  }
  function sheetMode() { return window.innerWidth <= 600; }
  function choose(ext) {
    var which = picker.open;
    closePicker();
    state.preset = null;
    if (which === 'from') {
      state.from = ext;
      state.to = C.defaultTarget(ext);
      refreshTargets();
      } else {
      state.to = ext;
      paintTiles();
      syncOptions();
    }
    $('#tile-' + which).focus();
  }
  function fileExt(f) { var e = F.extOf(f.name); return C.targetsFor(e).length ? e : '*'; }
  function sourceExts() {
    var seen = {}, out = [];
    state.files.forEach(function (f) { var e = fileExt(f); if (!seen[e]) { seen[e] = 1; out.push(e); } });
    return out;
  }
  // With one file the From tile can be overridden; with several, each file uses its own type
  // and only targets every type can reach are offered.
  function currentTargets() {
    if (state.files.length < 2) return C.targetsFor(state.from).filter(function (t) { return t !== '*'; });
    return sourceExts().map(function (e) { return C.targetsFor(e).filter(function (t) { return t !== '*'; }); })
      .reduce(function (a, b) { return a.filter(function (t) { return b.indexOf(t) > -1; }); });
  }
  function refreshTargets() {
    var targets = currentTargets();
    var tile = $('#tile-to');
    tile.classList.toggle('locked', !targets.length);
    $('#tile-from').classList.toggle('locked', state.files.length > 1);
    if (!targets.length) state.to = '';
    else if (targets.indexOf(state.to) < 0) state.to = C.defaultTarget(state.files.length > 1 ? sourceExts()[0] : state.from) || targets[0];
    if (state.to && targets.indexOf(state.to) < 0) state.to = targets[0];
    $('#target-count').textContent = targets.length ? targets.length + ' possible target' + (targets.length === 1 ? '' : 's') : (state.files.length > 1 ? 'no format all these files can become' : 'no targets');
    paintTiles();
    syncOptions();
  }
  function paintTiles() {
    var exts = sourceExts(), n = state.files.length;
    if (n > 1) {
      $('#from-ext').textContent = exts.map(function (e) { return e === '*' ? 'other' : '.' + e; }).slice(0, 3).join(' + ') + (exts.length > 3 ? ' …' : '');
      $('#from-name').textContent = n + ' files' + (exts.length > 1 ? ', ' + exts.length + ' types' : '');
    } else {
      $('#from-ext').textContent = state.from === '*' ? 'Any' : '.' + state.from;
      $('#from-name').textContent = state.from === '*' ? 'any other file type' : F.meta(state.from).name;
    }
    $('#to-ext').textContent = state.to ? '.' + state.to : '—';
    $('#to-name').textContent = state.to ? F.meta(state.to).name : (n > 1 ? 'no common format' : 'nothing available');
    var label = !n ? (TOUCH ? 'Choose files to start' : 'Choose a file to start')
      : !state.to ? 'These files share no target format'
      : (n === 1 ? 'Convert to .' + state.to : 'Convert ' + n + ' files to .' + state.to);
    $('#go-label').textContent = label;
    $('#sticky-label').textContent = label;
    $('#go').disabled = !n || !state.to || state.files.some(function (f) { return f.size > F.capFor(fileExt(f)); });
    $('#sticky').hidden = !(n && TOUCH);
  }

  /* ------------------------------------------------------------- options */
  var OPT_IDS = ['width', 'quality', 'scale', 'fps', 'maxSeconds', 'time', 'bitrate', 'pageSize', 'dither', 'allPages'];
  function syncOptions() {
    var r = C.rule(state.from, state.to), ui = (r && r.ui) || [], shown = 0;
    var videoOut = /^(mp4|webm)$/.test(state.to);
    OPT_IDS.forEach(function (id) {
      var on = ui.indexOf(id) > -1;
      if (id === 'quality') on = on && (/^(jpg|jpeg|webp|avif|jxl)$/.test(state.to) || videoOut);
      if (id === 'dither') on = on && state.to === 'gif';
      if (id === 'pageSize') on = on && state.to === 'pdf';
      $('#opt-' + id).hidden = !on;
      if (on) shown++;
    });
    // the frame-rate box serves both GIF sampling (few fps) and video re-encoding (real fps)
    var fps = $('#o-fps');
    if (videoOut && fps.dataset.mode !== 'video') { fps.dataset.mode = 'video'; fps.max = 60; fps.value = 30; }
    if (!videoOut && fps.dataset.mode !== 'gif') { fps.dataset.mode = 'gif'; fps.max = 24; fps.value = 10; }
    $('#o-width-hint').textContent = videoOut ? 'px · 0 keeps original, up to 1920' : 'px · 0 keeps original';
    $('#opts').hidden = shown === 0;
    var note = $('#rulenote');
    note.hidden = !(r && r.note);
    note.textContent = r && r.note ? 'This ' + r.note + '.' : '';
  }
  function readOptions() {
    return {
      width: parseInt($('#o-width').value, 10) || 0,
      quality: parseInt($('#o-quality').value, 10) / 100,
      dither: $('#o-dither').checked,
      fps: parseInt($('#o-fps').value, 10) || 10,
      maxSeconds: parseFloat($('#o-maxSeconds').value) || 5,
      time: parseFloat($('#o-time').value) || 0,
      bitrate: parseInt($('#o-bitrate').value, 10) || 192,
      pageSize: $('#o-pageSize').value,
      scale: parseFloat($('#o-scale').value) || 2,
      allPages: $('#o-allPages').checked
    };
  }

  /* ---------------------------------------------------------- the files */
  function addFiles(list, replace) {
    var incoming = Array.prototype.slice.call(list || []);
    if (!incoming.length) return;
    if (replace) state.files = [];
    incoming.forEach(function (f) {
      if (state.files.some(function (g) { return g.name === f.name && g.size === f.size && g.lastModified === f.lastModified; })) return;
      f._id = ++uid;
      state.files.push(f);
    });
    if (state.files.length > 200) { state.files = state.files.slice(0, 200); toast('Up to 200 files at a time'); }
    if (state.files.length === 1) {
      state.from = fileExt(state.files[0]);
      // On a /x-to-y/ page, picking an .x file should keep .y as the target
      // rather than snapping back to that format's usual default.
      var pre = state.preset;
      state.to = (pre && pre.from === state.from && C.rule(state.from, pre.to)) ? pre.to : C.defaultTarget(state.from);
    }
    else if (state.files.length > 1 && !state.to) state.to = C.defaultTarget(sourceExts()[0]);
    refreshTargets();
    paintPicked();
    $('#done').hidden = true;
    $('#progress').hidden = true;
  }
  function removeFile(id) {
    state.files = state.files.filter(function (f) { return f._id !== id; });
    if (state.files.length === 1) { state.from = fileExt(state.files[0]); }
    refreshTargets();
    paintPicked();
  }
  function paintPicked() {
    var box = $('#picked');
    box.innerHTML = '';
    box.hidden = !state.files.length;
    $('#warn').hidden = true;
    if (!state.files.length) { paintTiles(); return; }
    var over = [], big = 0;
    state.files.forEach(function (f) { var cap = F.capFor(fileExt(f)); if (f.size > cap) over.push(f); else if (f.size > 100 * 1024 * 1024) big++; });
    var list = el('div', 'picked-list' + (state.files.length > 4 ? ' many' : ''));
    state.files.forEach(function (f) {
      var row = el('div', 'picked-row');
      var th = el('div', 'thumb');
      if (/^image\//.test(f.type) && !/svg|hei[cf]/.test(f.type) && !/\.hei[cf]$/i.test(f.name)) {
        var img = el('img'); img.src = URL.createObjectURL(f); img.onload = function () { URL.revokeObjectURL(img.src); }; th.appendChild(img);
      } else th.appendChild(badge(fileExt(f) === '*' ? 'file' : fileExt(f), true));
      row.appendChild(th);
      var info = el('div', 'info');
      info.appendChild(el('div', 'name', f.name));
      var bad = f.size > F.capFor(fileExt(f));
      var meta = el('div', 'meta' + (bad ? ' bad' : ''), F.bytes(f.size) + (bad ? '  —  over the ' + F.bytes(F.capFor(fileExt(f))) + ' limit' : ''));
      info.appendChild(meta);
      row.appendChild(info);
      var rm = el('button', 'btn icon'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + f.name); rm.title = 'Remove'; rm.appendChild(icon('trash'));
      rm.onclick = function () { removeFile(f._id); };
      row.appendChild(rm);
      list.appendChild(row);
    });
    box.appendChild(list);
    var foot = el('div', 'picked-foot');
    foot.appendChild(el('span', 'meta', state.files.length + ' file' + (state.files.length === 1 ? '' : 's') + ' · ' + F.bytes(state.files.reduce(function (a, f) { return a + f.size; }, 0))));
    var add = btn('Add more', 'sm'); add.onclick = function () { $('#file').click(); };
    var clear = btn('Clear', 'sm'); clear.onclick = function () { state.files = []; refreshTargets(); paintPicked(); };
    foot.appendChild(add); foot.appendChild(clear);
    box.appendChild(foot);
    var warn = $('#warn');
    if (over.length) {
      warn.hidden = false; warn.className = 'warn';
      warn.textContent = (over.length === 1 ? over[0].name + ' is' : over.length + ' files are') + ' over the size limit — remove ' + (over.length === 1 ? 'it' : 'them') + ' to continue. Everything runs inside this browser tab, so very large files cannot be held in memory.';
    } else if (big) {
      warn.hidden = false; warn.className = 'warn soft';
      warn.textContent = big + ' large file' + (big === 1 ? '' : 's') + ' — this will work, but it may take a while since everything runs in your browser.';
    }
    paintTiles();
  }

  /* ------------------------------------------------------------- convert */
  function setStatus(msg) { $('#status').textContent = msg; }
  function convertOne(file, from, to, opts, onProgress) {
    var started = Date.now();
    return C.run(file, from, to, opts, { log: onProgress, progress: function (p, m) { if (m) onProgress(m); } }).then(function (res) {
      var rec = {
        name: res.name, sourceName: file.name, sourceExt: from, targetExt: res.ext,
        sourceSize: file.size, size: res.blob.size, mime: res.blob.type || F.meta(res.ext).mime,
        durationMs: Date.now() - started, options: opts, createdAt: Date.now(), blob: res.blob
      };
      return DB.put(rec).then(function (id) { rec.id = id; return rec; }, function () { return rec; });
    });
  }
  function convert() {
    if (!state.files.length || !state.to) return;
    var opts = readOptions(), to = state.to, files = state.files.slice(), total = files.length, results = [];
    $('#go').disabled = true; $('#sticky-go').disabled = true;
    $('#done').hidden = true;
    $('#progress').hidden = false;
    $('#bar').style.width = '4%';
    var i = 0;
    function step() {
      if (i >= total) return finish();
      var f = files[i], from = total === 1 ? state.from : fileExt(f), n = i + 1;
      var prefix = total > 1 ? n + ' of ' + total + ' — ' : '';
      setStatus(prefix + 'Converting ' + f.name + ' to .' + to + '…');
      $('#bar').style.width = Math.max(4, Math.round((i / total) * 100)) + '%';
      return convertOne(f, from, to, opts, function (m) { setStatus(prefix + m); }).then(function (rec) {
        results.push({ file: f, rec: rec });
        track({ t: 'convert', from: from, to: rec.targetExt, ms: rec.durationMs });
        bumpCounter();
        if (globalTotals) globalTotals.conv++;
      }, function (e) {
        results.push({ file: f, error: e.message || String(e) });
        track({ t: 'fail', from: from, to: to });
      }).then(function () { i++; return step(); });
    }
    function finish() {
      $('#bar').style.width = '100%';
      var ok = results.filter(function (r) { return r.rec; });
      state.fresh = ok.length ? ok[ok.length - 1].rec.id || null : null;
      if (total === 1) {
        if (ok.length) { state.last = ok[0].rec; paintDone(ok[0].rec); adUnit('ad-result', 'result'); toast(ok[0].rec.id ? 'Saved to My files' : 'Converted', 'check'); }
        else paintError(results[0].error);
      } else {
        state.batch = results;
        paintDoneMulti(results, to);
        adUnit('ad-result', 'result');
        toast(ok.length + ' of ' + total + ' converted', 'check');
      }
      refreshCount();
      renderHome();
      $('#go').disabled = false; $('#sticky-go').disabled = false;
      setTimeout(function () { $('#progress').hidden = true; $('#bar').style.width = '0'; }, 400);
    }
    step();
  }

  // Every result in one card, each with its own Download, plus one zip of them all.
  function paintDoneMulti(results, to) {
    revokeAll();
    var box = $('#done'), ok = results.filter(function (r) { return r.rec; }), failed = results.length - ok.length;
    box.className = 'done multi'; box.hidden = false; box.innerHTML = '';
    var body = el('div', 'done-body');
    var k = el('span', 'done-k' + (ok.length ? '' : ' bad'));
    k.appendChild(icon(ok.length ? 'check' : 'bolt'));
    k.appendChild(el('span', null, ok.length === results.length ? 'All done' : (ok.length ? 'Done, with ' + failed + ' failed' : 'Could not convert')));
    body.appendChild(k);
    body.appendChild(el('div', 'done-name', ok.length + ' of ' + results.length + ' files converted to .' + to));
    var meta = el('div', 'done-meta');
    meta.appendChild(el('span', null, F.bytes(ok.reduce(function (a, r) { return a + r.rec.size; }, 0)) + ' in total  ·  ' + (ok.reduce(function (a, r) { return a + r.rec.durationMs; }, 0) / 1000).toFixed(1) + ' s'));
    body.appendChild(meta);
    var acts = el('div', 'done-acts');
    if (ok.length > 1) {
      var zipBtn = btn('Download all as .zip', 'primary lg', 'download');
      zipBtn.onclick = function () {
        zipBtn.disabled = true; zipBtn.querySelector('span').textContent = 'Zipping…';
        F.need('jszip').then(function (JSZip) {
          var z = new JSZip(), names = {};
          ok.forEach(function (r) { var nm = r.rec.name; if (names[nm]) nm = nm.replace(/(\.[^.]+)$/, '-' + (++names[r.rec.name]) + '$1'); else names[nm] = 1; z.file(nm, r.rec.blob); });
          return z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        }).then(function (blob) { download(blob, 'converted-' + to + '-' + ok.length + '-files.zip'); })
          .catch(function (e) { toast('Could not build the zip: ' + e.message); })
          .then(function () { zipBtn.disabled = false; zipBtn.querySelector('span').textContent = 'Download all as .zip'; });
      };
      acts.appendChild(zipBtn);
    } else if (ok.length === 1) {
      var one = btn('Download ' + ok[0].rec.name, 'primary lg', 'download'); one.onclick = function () { download(ok[0].rec.blob, ok[0].rec.name); }; acts.appendChild(one);
    }
    var again = btn('Convert more', 'lg'); again.onclick = function () { $('#file').click(); }; acts.appendChild(again);
    body.appendChild(acts);
    var list = el('div', 'done-list');
    results.forEach(function (r) {
      var row = el('div', 'done-row' + (r.rec ? '' : ' failed'));
      var th = el('div', 'thumb');
      th.appendChild(r.rec ? preview(r.rec, true) : badge(fileExt(r.file) === '*' ? 'file' : fileExt(r.file), true));
      row.appendChild(th);
      var info = el('div', 'info');
      info.appendChild(el('div', 'name', r.rec ? r.rec.name : r.file.name));
      info.appendChild(el('div', 'meta' + (r.rec ? '' : ' bad'), r.rec ? F.bytes(r.rec.size) + ' · from ' + r.file.name : r.error));
      row.appendChild(info);
      if (r.rec) { var d = btn('Download', 'sm primary', 'download'); d.onclick = function () { download(r.rec.blob, r.rec.name); }; row.appendChild(d); }
      list.appendChild(row);
    });
    body.appendChild(list);
    var saved = el('div', 'done-saved');
    saved.appendChild(document.createTextNode('Also kept in '));
    var a = el('a', null, 'My files'); a.href = '#'; a.onclick = function (e) { e.preventDefault(); show('files'); }; saved.appendChild(a);
    saved.appendChild(document.createTextNode(' so you can download them again later. '));
    var tip = el('a', 'tip-link'); tip.href = '#support'; tip.appendChild(icon('heart')); tip.appendChild(el('span', null, 'Found it useful? Leave a tip'));
    tip.onclick = function (e) { e.preventDefault(); goSupport(); }; saved.appendChild(tip);
    body.appendChild(saved);
    if (feedbackDue()) body.appendChild(feedbackForm({ compact: true, page: location.pathname }));
    box.appendChild(body);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function paintDone(rec) {
    revokeAll();
    var box = $('#done');
    box.className = 'done'; box.hidden = false; box.innerHTML = '';
    var prev = el('div', 'done-prev');
    prev.appendChild(preview(rec));
    box.appendChild(prev);

    var body = el('div', 'done-body');
    var k = el('span', 'done-k'); k.appendChild(icon('check')); k.appendChild(el('span', null, 'Ready'));
    body.appendChild(k);
    body.appendChild(el('div', 'done-name', rec.name));
    var meta = el('div', 'done-meta');
    meta.appendChild(chip(rec.sourceExt)); meta.appendChild(el('span', null, '→')); meta.appendChild(chip(rec.targetExt));
    meta.appendChild(el('span', null, '·  ' + F.bytes(rec.size) + '  ·  ' + (rec.durationMs / 1000).toFixed(1) + ' s'));
    body.appendChild(meta);

    var acts = el('div', 'done-acts');
    var dl = btn('Download ' + rec.name, 'primary lg', 'download');
    dl.onclick = function () { download(rec.blob, rec.name); };
    var again = btn('Convert another', 'lg');
    again.onclick = function () { $('#file').click(); };
    acts.appendChild(dl); acts.appendChild(again);
    body.appendChild(acts);

    var saved = el('div', 'done-saved');
    if (rec.id) {
      saved.appendChild(document.createTextNode('Also kept in '));
      var a = el('a', null, 'My files'); a.href = '#';
      a.onclick = function (e) { e.preventDefault(); show('files'); };
      saved.appendChild(a);
      saved.appendChild(document.createTextNode(' so you can download it again later. '));
      var tip = el('a', 'tip-link'); tip.href = '#support'; tip.appendChild(icon('heart')); tip.appendChild(el('span', null, 'Found it useful? Leave a tip'));
      tip.onclick = function (e) { e.preventDefault(); goSupport(); };
      saved.appendChild(tip);
    } else {
      saved.textContent = 'Download it now — this browser could not keep a copy.';
    }
    body.appendChild(saved);
    if (feedbackDue()) body.appendChild(feedbackForm({ compact: true, page: location.pathname }));
    box.appendChild(body);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function paintError(msg) {
    var box = $('#done');
    box.className = 'done bad'; box.hidden = false; box.innerHTML = '';
    var body = el('div', 'done-body');
    var k = el('span', 'done-k', 'Could not convert');
    body.appendChild(k);
    body.appendChild(el('div', 'done-name', msg));
    var acts = el('div', 'done-acts');
    var again = btn('Try another file', 'lg');
    again.onclick = function () { $('#file').click(); };
    acts.appendChild(again);
    body.appendChild(acts);
    box.appendChild(body);
  }

  /* ---------------------------------------------------------- your files */
  var cache = [];
  function refreshCount() {
    DB.all().then(function (rows) { $('#files-count').textContent = rows.length ? String(rows.length) : ''; }, function () {});
  }
  function renderFiles() {
    DB.estimate().then(function (est) {
      $('#files-usage').textContent = est.usage == null ? '' : F.bytes(est.usage) + ' used of ' + F.bytes(est.quota) + ' available';
    });
    return DB.all().then(function (rows) {
      cache = rows;
      $('#files-count').textContent = rows.length ? String(rows.length) : '';
      paintCards();
    }, function (e) {
      cache = [];
      paintCards();
      toast('Could not open storage: ' + e.message);
    });
  }
  function paintCards() {
    revokeAll();
    var q = $('#files-q').value.trim().toLowerCase();
    var rows = cache.filter(function (r) {
      return !q || (r.name + ' ' + r.sourceName + ' ' + r.sourceExt + ' ' + r.targetExt).toLowerCase().indexOf(q) > -1;
    });
    var grid = $('#files-grid');
    grid.innerHTML = '';
    $('#files-empty').hidden = cache.length > 0;
    $('#files-clear').hidden = cache.length === 0;
    if (cache.length && !rows.length) {
      var none = el('p', 'usage', 'Nothing matches "' + q + '".');
      none.style.gridColumn = '1 / -1';
      grid.appendChild(none);
    }
    rows.forEach(function (r) {
      var card = el('article', 'card' + (r.id === state.fresh ? ' fresh' : ''));
      var pv = el('div', 'card-prev');
      pv.appendChild(preview(r));
      // every card opens a preview; what it can show depends on the format
      pv.classList.add('openable');
      pv.title = 'Preview ' + r.name;
      pv.setAttribute('role', 'button');
      pv.tabIndex = 0;
      pv.onclick = function () { openPreview(r); };
      pv.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(r); } };
      card.appendChild(pv);

      var body = el('div', 'card-body');
      body.appendChild(el('div', 'card-name', r.name));
      var meta = el('div', 'card-meta');
      meta.appendChild(chip(r.sourceExt)); meta.appendChild(el('span', null, '→')); meta.appendChild(chip(r.targetExt));
      meta.appendChild(el('span', 'sep', '·')); meta.appendChild(el('span', null, F.bytes(r.size)));
      meta.appendChild(el('span', 'sep', '·')); meta.appendChild(el('span', null, when(r.createdAt)));
      body.appendChild(meta);

      var acts = el('div', 'card-acts');
      var dl = btn('Download', 'primary sm', 'download');
      dl.onclick = function () { download(r.blob, r.name); };
      var del = el('button', 'btn icon');
      del.type = 'button'; del.setAttribute('aria-label', 'Delete ' + r.name); del.title = 'Delete';
      del.appendChild(icon('trash'));
      del.onclick = function () {
        DB.remove(r.id).then(function () {
          if (state.fresh === r.id) state.fresh = null;
          toast('Deleted ' + r.name, 'trash');
          renderFiles();
        });
      };
      acts.appendChild(dl); acts.appendChild(del);
      body.appendChild(acts);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------- formats */
  var formatsBuilt = false;
  function renderFormats() {
    if (formatsBuilt) return;
    formatsBuilt = true;
    var sources = C.sourcesList(), allTargets = {};
    sources.forEach(function (f) { C.targetsFor(f).forEach(function (t) { if (t !== '*') allTargets[t] = 1; }); });
    $('#m-pairs').textContent = C.pairCount();
    $('#m-sources').textContent = sources.length;
    $('#m-targets').textContent = Object.keys(allTargets).length;
    var wrap = $('#matrix');
    wrap.innerHTML = '';
    sources.forEach(function (f) {
      var targets = C.targetsFor(f).filter(function (t) { return t !== '*'; });
      if (!targets.length) return;
      var row = el('div', 'mx-row');
      row.dataset.k = (f + ' ' + (f === '*' ? 'any' : F.meta(f).name) + ' ' + targets.join(' ')).toLowerCase();
      var top = el('div', 'top');
      top.appendChild(el('span', 'ext', f === '*' ? 'Any other file' : '.' + f));
      var fam = el('span', 'fam', F.FAMILY[famOf(f)].label);
      fam.style.setProperty('--fam', FAM_VAR[famOf(f)]);
      top.appendChild(fam);
      row.appendChild(top);
      var tos = el('div', 'tos');
      targets.forEach(function (t) { tos.appendChild(chip(t)); });
      row.appendChild(tos);
      wrap.appendChild(row);
    });
  }
  function filterFormats() {
    var q = $('#formats-q').value.trim().toLowerCase();
    Array.prototype.forEach.call($('#matrix').children, function (row) {
      row.hidden = !!q && row.dataset.k.indexOf(q) < 0;
    });
  }

  /* ---------------------------------------------------- preview overlay */
  // Browsers block window.open on blob: URLs, so previews open in the page.
  var TEXTY = /^(txt|md|markdown|html|htm|json|jsonl|ndjson|yaml|yml|xml|toml|sql|csv|tsv|prn|dif|slk|svg|obj|ply|stl|gltf|tex|rtf|log)$/;
  var modalUrls = [];
  function closePreview() {
    $('#modal').hidden = true;
    $('#modal-body').innerHTML = '';
    modalUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    modalUrls = [];
    document.body.style.overflow = '';
  }
  function objectUrl(blob) { var u = URL.createObjectURL(blob); modalUrls.push(u); return u; }
  function note(title, text) {
    var n = el('div', 'modal-note');
    n.appendChild(el('b', null, title));
    n.appendChild(el('span', null, text));
    return n;
  }
  function openPreview(rec) {
    var box = $('#modal'), body = $('#modal-body');
    modalUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    modalUrls = [];
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#modal-name').textContent = rec.name;
    $('#modal-meta').textContent = F.bytes(rec.size) + '  ·  ' + (rec.mime || F.meta(rec.targetExt).mime) + '  ·  from ' + rec.sourceName;
    $('#modal-dl').onclick = function () { download(rec.blob, rec.name); };
    body.innerHTML = '';
    var ext = rec.targetExt;

    if (IMG_PREVIEW.test(ext) || ext === 'tif' || ext === 'tiff' || ext === 'jxl') {
      var img = el('img');
      img.alt = rec.name;
      img.onerror = function () { body.innerHTML = ''; body.appendChild(note('This browser cannot display ' + ext.toUpperCase(), 'The file is fine — your browser just has no decoder for it. Download it to open in an image app.')); };
      img.src = objectUrl(rec.blob);
      body.appendChild(img);
      return;
    }
    if (ext === 'pdf') {
      var f = el('iframe');
      f.title = rec.name;
      f.src = objectUrl(rec.blob);
      body.appendChild(f);
      return;
    }
    if (/^(mp3|wav|m4a|aac|ogg|opus|flac|weba)$/.test(ext)) {
      var a = document.createElement('audio');
      a.controls = true; a.src = objectUrl(rec.blob);
      body.appendChild(a);
      return;
    }
    if (/^(mp4|webm|m4v|mov|ogv)$/.test(ext)) {
      var v = document.createElement('video');
      v.controls = true; v.src = objectUrl(rec.blob);
      body.appendChild(v);
      return;
    }
    if (ext === 'html' || ext === 'htm') { showHtml(body, rec.blob); return; }
    if (TEXTY.test(ext)) {
      var pre = el('pre', null, 'Reading…');
      body.appendChild(pre);
      rec.blob.slice(0, 300000).text().then(function (t) {
        pre.textContent = t + (rec.blob.size > 300000 ? '\n\n… truncated at 300 KB' : '');
      });
      return;
    }
    // Word, Excel, EPUB and friends: no browser viewer, but this app can render
    // them as HTML with the same engine it uses to convert them.
    if (C.rule(ext, 'html')) {
      var spin = el('div', 'modal-spin');
      spin.appendChild(el('i'));
      spin.appendChild(el('span', null, 'Building a preview of this ' + ext.toUpperCase() + '…'));
      body.appendChild(spin);
      var file = new File([rec.blob], rec.name, { type: rec.mime || F.meta(ext).mime });
      C.run(file, ext, 'html', {}, { log: function () {}, progress: function () {} }).then(function (res) {
        if (box.hidden) return;
        body.innerHTML = '';
        showHtml(body, res.blob);
      }, function (e) {
        if (box.hidden) return;
        body.innerHTML = '';
        body.appendChild(note('No preview for .' + ext, 'This format has no viewer in the browser, and the preview could not be built (' + e.message + '). Download it to open in its own app.'));
      });
      return;
    }
    body.appendChild(note('No preview for .' + ext, 'Browsers cannot display this format. Download it to open in the app it belongs to.'));
  }
  // Rendered in a sandboxed frame: no scripts, no navigation away from the page.
  function showHtml(body, blob) {
    blob.text().then(function (html) {
      var f = el('iframe');
      f.setAttribute('sandbox', '');
      f.title = 'Preview';
      f.srcdoc = html;
      body.appendChild(f);
    });
  }

  /* -------------------------------------------- editorial: home sections */
  var K = root.Content;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function bumpCounter() {
    lsSet('cf.converted', String((parseInt(lsGet('cf.converted'), 10) || 0) + 1));
    if (!lsGet('cf.since')) lsSet('cf.since', String(Date.now()));
  }
  function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // A real link, so a search engine can follow it to that conversion's own page.
  function popTile(from, to, label, count) {
    var b = el('a');
    b.href = '/' + from + '-to-' + to + '/';
    b.appendChild(chip(from));
    var arr = el('span', null, '→'); arr.style.color = 'var(--pop)'; b.appendChild(arr);
    b.appendChild(chip(to));
    b.appendChild(el('span', 'lbl', label));
    if (count) b.appendChild(el('span', 'cnt', count + '×'));
    return b;
  }
  function guideCard(gd) {
    var c = el('a', 'gcard');
    c.href = '/guides/' + gd.slug + '/';
    var cat = el('span', 'cat', gd.cat); cat.style.setProperty('--fam', FAM_VAR[gd.fam] || 'var(--accent)');
    c.appendChild(cat);
    c.appendChild(el('h3', null, gd.title));
    c.appendChild(el('p', null, gd.teaser));
    c.appendChild(el('span', 'rt', readTime(gd) + ' min read'));
    return c;
  }
  function readTime(gd) {
    var words = gd.body.join(' ').replace(/<[^>]+>/g, '').split(/\s+/).length;
    return Math.max(2, Math.round(words / 200));
  }
  var homeStatic = false, globalTotals = null, askedTotals = false;
  // The public counter: how many files everyone has converted, from the API.
  function loadTotals() {
    if (askedTotals || !SITE.api) return;
    askedTotals = true;
    fetch(SITE.api + '/public', { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (t) { if (t && typeof t.conv === 'number') { globalTotals = t; renderHome(); orderRail(t.tools); } })
      .catch(function () {});
  }
  // The tools list beside the converter: most used first, by the site's own
  // counters. Ties keep the built-in order, so nothing jumps around on a new site.
  function orderRail(counts) {
    var list = $('#tools-rail .rail-list');
    if (!list || !counts) return;
    var items = Array.prototype.slice.call(list.children);
    items.forEach(function (li, i) { li._n = counts[li.firstElementChild.getAttribute('data-tool')] || 0; li._i = i; });
    items.sort(function (a, b) { return (b._n - a._n) || (a._i - b._i); });
    items.forEach(function (li) {
      var c = li.querySelector('.cnt');
      if (c) { c.hidden = !li._n; c.textContent = li._n ? ' \u00b7 ' + fmtInt(li._n) + ' uses' : ''; }
      list.appendChild(li);
    });
  }
  // The banner rotates through the site's services — one every two seconds,
  // paused while the pointer is over it, still when reduced motion is on.
  function promo() {
    var box = $('#promo');
    if (!box) return;
    var slides = box.querySelectorAll('.promo-slide'), count = $('#promo-count'), bar = $('#promo-bar'), i = 0, timer = null;
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches, STEP = 2000;
    function go(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
      if (count) count.textContent = (i + 1) + ' / ' + slides.length;
      if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = still ? 'none' : 'promo-fill ' + STEP + 'ms linear'; }
    }
    function restart() { clearInterval(timer); if (!still) timer = setInterval(function () { go(i + 1); }, STEP); }
    box.addEventListener('mouseenter', function () { clearInterval(timer); if (bar) bar.style.animationPlayState = 'paused'; });
    box.addEventListener('mouseleave', function () { if (bar) bar.style.animationPlayState = 'running'; restart(); });
    var next = $('#promo-next');
    if (next) next.onclick = function () { go(i + 1); restart(); };
    go(0); restart();
    var more = $('#rail-more');
    if (more) more.onclick = function () {
      var open = $('#tools-rail').classList.toggle('open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Show fewer' : 'View all ' + $('#tools-rail .rail-list').children.length + ' tools';
    };
  }
  function renderHome() {
    // Generated landing and guide pages carry the converter but not the home
    // page's editorial blocks, so there is nothing here to paint.
    var kp = $('#kpis');
    if (!kp) return;
    kp.innerHTML = '';
    var here = parseInt(lsGet('cf.converted'), 10) || 0, since = parseInt(lsGet('cf.since'), 10);
    var sources = C.sourcesList(), targets = {};
    sources.forEach(function (f) { C.targetsFor(f).forEach(function (t) { if (t !== '*') targets[t] = 1; }); });
    // Prefer the real worldwide total; fall back to this device's count offline.
    var convTile = globalTotals
      ? [fmtInt(globalTotals.conv), 'files converted', here ? fmtInt(here) + ' of them by you on this device' : 'by everyone using Convert Files']
      : [fmtInt(here), 'files converted here', since ? 'on this device since ' + new Date(since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'on this device'];
    [[fmtInt(C.pairCount()), 'conversions available', 'in this browser, right now'],
     [fmtInt(sources.length - 1) + ' / ' + fmtInt(Object.keys(targets).length), 'formats in / out', 'plus any file to zip, tar or gz'],
     convTile,
     ['0', 'files uploaded', 'everything runs on your computer']
    ].forEach(function (k) {
      var d = el('div', 'kpi');
      d.appendChild(el('b', null, k[0])); d.appendChild(el('span', null, k[1])); d.appendChild(el('small', null, k[2]));
      kp.appendChild(d);
    });
    // most used, from the stored records
    DB.all().then(function (rows) {
      var counts = {};
      rows.forEach(function (r) { var k = r.sourceExt + '>' + r.targetExt; counts[k] = (counts[k] || 0) + 1; });
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
      var box = $('#recent'); box.innerHTML = '';
      $('#home-recent').hidden = top.length === 0;
      top.forEach(function (k) {
        var pr = k.split('>');
        if (C.rule(pr[0], pr[1])) box.appendChild(popTile(pr[0], pr[1], F.meta(pr[0]).name.split(' ')[0] + ' to ' + pr[1].toUpperCase(), counts[k]));
      });
    }, function () {});
    if (homeStatic) return;
    homeStatic = true;
    var st = $('#steps');
    K.STEPS.forEach(function (sd, i) {
      var d = el('div', 'stepc');
      d.appendChild(el('div', 'num', String(i + 1))); d.appendChild(el('h3', null, sd[0])); d.appendChild(el('p', null, sd[1]));
      st.appendChild(d);
    });
    var pop = $('#popular');
    if (!pop.children.length) K.POPULAR.forEach(function (pr) { if (C.rule(pr[0], pr[1])) pop.appendChild(popTile(pr[0], pr[1], pr[2])); });
    var hg = $('#home-guides');
    if (!hg.children.length) K.GUIDES.filter(function (g) { return g.lang !== 'hi'; }).slice(0, 3).forEach(function (gd) { hg.appendChild(guideCard(gd)); });
    var ab = $('#about-box'), left = el('div'), right = el('ul');
    K.ABOUT.intro.forEach(function (t) { left.appendChild(el('p', null, t)); });
    K.ABOUT.points.forEach(function (t) { var li = el('li'); li.appendChild(icon('check')); li.appendChild(el('span', null, t)); right.appendChild(li); });
    ab.appendChild(left); ab.appendChild(right);
    renderSupport();
    var fq = $('#faq');
    K.FAQ.forEach(function (qa) {
      var d = el('details'); d.appendChild(el('summary', null, qa[0])); d.appendChild(el('p', null, qa[1])); fq.appendChild(d);
    });
  }

  /* ------------------------------------------------- support & sponsor */
  function isPhone() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function renderSupport() {
    var S = K.SUPPORT, box = $('#support-box');
    box.innerHTML = '';
    var left = el('div');
    S.blurb.forEach(function (t) { left.appendChild(el('p', null, t)); });
    var upi = el('div', 'upi');
    upi.appendChild(el('span', 'upi-k', 'UPI ID'));
    upi.appendChild(el('span', 'upi-id', S.upiId));
    var copy = btn('Copy', 'sm', 'copy');
    copy.onclick = function () {
      var done = function () { toast('UPI ID copied', 'check'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(S.upiId).then(done, done); else done();
    };
    upi.appendChild(copy);
    if (isPhone()) {
      var pay = btn('Open in UPI app', 'primary sm', 'heart');
      pay.onclick = function () {
        location.href = 'upi://pay?pa=' + encodeURIComponent(S.upiId) + '&pn=' + encodeURIComponent(S.payeeName) + '&cu=INR';
      };
      upi.appendChild(pay);
    }
    left.appendChild(upi);
    left.appendChild(el('div', 'apps', 'Works with Google Pay, PhonePe, Paytm, BHIM and every other UPI app.'));
    box.appendChild(left);
    var qr = el('div', 'qr'), frame = el('div', 'frame'), img = el('img');
    img.src = S.qr; img.alt = 'UPI QR code for ' + S.upiId; img.width = 200; img.height = 200;
    frame.appendChild(img); qr.appendChild(frame);
    qr.appendChild(el('div', 'cap', 'Scan with any UPI app'));
    box.appendChild(qr);

    var SP = K.SPONSOR, sp = $('#sponsor-box');
    sp.innerHTML = '';
    if (SP.name) {
      sp.classList.add('live');
      sp.appendChild(el('span', 'sk', 'Sponsored by'));
      var nm = SP.url ? el('a', 'sn', SP.name) : el('span', 'sn', SP.name);
      if (SP.url) { nm.href = SP.url; nm.rel = 'sponsored noopener'; nm.target = '_blank'; }
      sp.appendChild(nm);
      if (SP.tagline) sp.appendChild(el('span', 'st', SP.tagline));
    } else {
      sp.appendChild(el('span', 'sk', 'Sponsor slot'));
      sp.appendChild(el('span', 'st', 'One sponsor, one line, seen by every visitor. No tracking, no pop-ups \u2014 just a name and a link here.'));
      if (SP.contact) { var c = el('a', 'tip-link', 'Get in touch'); c.href = 'mailto:' + SP.contact; sp.appendChild(c); }
    }
  }
  function goSupport() {
    var t = $('#support');
    if (!t) { location.href = '/#support'; return; }
    show('convert', true);
    closeGuide();
    t.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ------------------------------------------------------------- guides */
  var guidesBuilt = false;
  function renderGuides() {
    if (guidesBuilt) return;
    guidesBuilt = true;
    var grid = $('#guides-grid');
    K.GUIDES.filter(function (g) { return g.lang !== 'hi'; }).forEach(function (gd) { grid.appendChild(guideCard(gd)); });
  }
  function openGuide(slug) {
    var gd = K.GUIDES.filter(function (g) { return g.slug === slug; })[0];
    if (!gd) return;
    show('guides');
    $('#guides-list').hidden = true;
    var a = $('#article'); a.hidden = false; a.innerHTML = '';
    var hindi = gd.lang === 'hi';
    var back = el('a', 'btn sm nav-back'); back.href = hindi ? '/hi/guides/' : '/guides/'; back.appendChild(el('span', null, hindi ? 'सभी गाइड' : 'All guides')); a.appendChild(back);
    var cat = el('div', 'cat', gd.cat); cat.style.setProperty('--fam', FAM_VAR[gd.fam] || 'var(--accent)'); a.appendChild(cat);
    a.appendChild(el('h1', null, gd.title));
    a.appendChild(el('div', 'meta', hindi ? (readTime(gd) + ' मिनट में पढ़ें · Convert Files') : (readTime(gd) + ' min read · Convert Files guides')));
    var body = el('div', 'body');
    gd.body.forEach(function (line) {
      var kind = line.slice(0, 1), text = line.slice(2);
      if (kind === 'h') body.appendChild(el('h2', null, text));
      else if (kind === 'ul') { var ul = el('ul'); text.split('|').forEach(function (t) { var li = el('li'); li.innerHTML = t; ul.appendChild(li); }); body.appendChild(ul); }
      else { var pp = el('p'); pp.innerHTML = text; body.appendChild(pp); }
    });
    a.appendChild(body);
    if (ADS && ADS.slots && ADS.slots.article) {
      var paras = body.querySelectorAll('p');
      if (paras.length > 1) {
        var slot = el('div', 'ad'); slot.id = 'ad-article'; slot.hidden = true;
        paras[1].insertAdjacentElement('afterend', slot);
        adUnit('ad-article', 'article');
      }
    }
    if (gd.tryTool) {
      var tt = el('div', 'try');
      tt.appendChild(el('span', 't', gd.tryLabel || 'Try it — free, in your browser.'));
      var tgo = el('a', 'btn primary'); tgo.href = '/' + gd.tryTool + '/'; tgo.appendChild(icon('bolt')); tgo.appendChild(el('span', null, gd.tryLabel || gd.tryTool)); tt.appendChild(tgo);
      a.appendChild(tt);
    } else if (gd.tryFrom && C.rule(gd.tryFrom, gd.tryTo)) {
      var t = el('div', 'try');
      t.appendChild(el('span', 't', gd.tryLabel || ('Try it: convert a .' + gd.tryFrom + ' to .' + gd.tryTo + ' — free, in your browser.')));
      var go = btn('Convert .' + gd.tryFrom + ' to .' + gd.tryTo, 'primary', 'bolt');
      go.onclick = function () { preset(gd.tryFrom, gd.tryTo); };
      t.appendChild(go);
      a.appendChild(t);
    }
    if (location.hash !== '#guide:' + slug) history.replaceState(null, '', '#guide:' + slug);
    window.scrollTo({ top: 0 });
  }
  function closeGuide() {
    $('#article').hidden = true;
    $('#guides-list').hidden = false;
    if (/^#guide:/.test(location.hash)) history.replaceState(null, '', '#guides');
  }
  function route() {
    var h = location.hash;
    if (/^#guide:/.test(h)) openGuide(h.slice(7));
    else if (h === '#files') show('files');
    else if (h === '#about') { show('convert', true); var t = $('#about'); if (t) t.scrollIntoView({ block: 'start' }); }
    else if (h === '#support') goSupport();
    else if (h === '#feedback') { show('convert', true); var fbt = $('#feedback'); if (fbt) fbt.scrollIntoView({ block: 'start' }); }
  }

  /* ------------------------------------------------ ads (site.json) */
  var SITE = root.SITE || {};
  var ADS = (SITE.ads && SITE.ads.client) ? SITE.ads : null;
  // Render one responsive AdSense unit into a container, if a slot id is configured.
  function adUnit(containerId, slotKey) {
    var box = $('#' + containerId);
    if (!box || !ADS || !ADS.slots || !ADS.slots[slotKey] || box.dataset.filled) return;
    box.dataset.filled = '1';
    box.hidden = false;
    box.innerHTML = '';
    box.appendChild(el('span', 'ad-label', 'Advertisement'));
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.setAttribute('data-ad-client', ADS.client);
    ins.setAttribute('data-ad-slot', ADS.slots[slotKey]);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    box.appendChild(ins);
    try { (root.adsbygoogle = root.adsbygoogle || []).push({}); } catch (e) {}
  }
  // Static landing pages and guide pages tell the app what to open.
  function pagePreset() {
    var m = document.querySelector('meta[name="cf-preset"]');
    if (m && /^[a-z0-9]+>[a-z0-9]+$/.test(m.content)) {
      var pr = m.content.split('>');
      if (C.rule(pr[0], pr[1])) { state.preset = { from: pr[0], to: pr[1] }; state.from = pr[0]; state.to = pr[1]; refreshTargets(); }
    }
    var g = document.querySelector('meta[name="cf-guide"]');
    if (g && g.content) openGuide(g.content);
  }

  /* ------------------------------------------- anonymous usage counts */
  // Two events, both without file names, contents, sizes or anything personal:
  // a page was viewed, and a conversion from X to Y finished (or failed).
  // Sent only when site.json has an api_base; skipped when Do Not Track is on.
  function trackingOff() {
    return !SITE.api || navigator.doNotTrack === '1' || root.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  }
  // A device that has signed into the admin panel (or opened /?stats=off) is
  // one of the owner's; its traffic is counted apart from real visitors.
  function ownerDevice() { return lsGet('cf.owner') === '1'; }
  function track(ev) {
    if (trackingOff()) return;
    if (ownerDevice()) ev.own = 1;
    try {
      // text/plain keeps it a "simple" request (no CORS preflight, works with keepalive)
      fetch(SITE.api + '/event', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(ev), keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) {}
  }
  // Time the page is actually visible, reported in increments. Nothing identifies
  // the visitor: the server only adds the seconds up and counts sessions.
  var seenSince = Date.now(), pending = 0, reportedOnce = false;
  function flushTime() {
    if (!document.hidden) { pending += Date.now() - seenSince; seenSince = Date.now(); }
    if (pending < 1000 || trackingOff()) { pending = 0; return; }
    var body = JSON.stringify(ownerDevice() ? { t: 'time', ms: pending, first: !reportedOnce, own: 1 } : { t: 'time', ms: pending, first: !reportedOnce });
    pending = 0; reportedOnce = true;
    try {
      // sendBeacon survives the page being closed; fetch is the fallback
      if (navigator.sendBeacon) navigator.sendBeacon(SITE.api + '/event', new Blob([body], { type: 'text/plain' }));
      else fetch(SITE.api + '/event', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: body, keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) {}
  }
  function watchTime() {
    if (trackingOff()) return;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) flushTime();
      else seenSince = Date.now();
    });
    window.addEventListener('pagehide', flushTime);
    // long reads still get counted, in case the tab is never hidden or closed cleanly
    setInterval(function () { if (!document.hidden) flushTime(); }, 60000);
  }

  function trackView() {
    var today = new Date().toISOString().slice(0, 10), first = lsGet('cf.lastVisit') !== today;
    lsSet('cf.lastVisit', today);
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (ref === location.hostname.replace(/^www\./, '')) ref = '';
    track({ t: 'view', p: location.pathname, first: first, ref: ref, d: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop' });
  }

  /* ---------------------------------------------------------------- wire */
  /* ------------------------------------------------------------ feedback */
  // Ratings go to the site's own API: the stars, optional words, an optional
  // name and the page. The home page shows them as they come in.
  var FB = { data: null };
  function feedbackDue() { var last = parseInt(lsGet('cf.fb.t'), 10) || 0; return Date.now() - last > 7 * 86400000; }
  function starRow(n, cls) {
    var w = el('span', 'stars' + (cls ? ' ' + cls : '')); w.setAttribute('aria-label', n + ' out of 5');
    for (var i = 1; i <= 5; i++) { var s = icon('star'); if (i <= Math.round(n)) s.classList.add('on'); w.appendChild(s); }
    return w;
  }
  function feedbackForm(ctx) {
    ctx = ctx || {};
    var box = el('div', 'fb-form' + (ctx.compact ? ' compact' : ''));
    var head = el('div', 'fb-q', ctx.compact ? 'How did it go?' : 'Rate Convert Files');
    box.appendChild(head);
    var picker = el('div', 'fb-pick'); picker.setAttribute('role', 'group'); picker.setAttribute('aria-label', 'Your rating');
    var chosen = 0, labels = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent'], btns = [];
    var hint = el('span', 'fb-hint', '');
    function paint(n) { btns.forEach(function (b, k) { b.classList.toggle('on', k < n); }); }
    for (var i = 1; i <= 5; i++) (function (i) {
      var b = el('button', 'fb-star'); b.type = 'button'; b.setAttribute('aria-label', i + (i === 1 ? ' star' : ' stars')); b.appendChild(icon('star'));
      b.onmouseenter = function () { paint(i); hint.textContent = labels[i]; };
      b.onmouseleave = function () { paint(chosen); hint.textContent = labels[chosen]; };
      b.onclick = function () { chosen = i; paint(i); hint.textContent = labels[i]; more.hidden = false; send.disabled = false; if (!TOUCH) ta.focus(); };
      btns.push(b); picker.appendChild(b);
    })(i);
    picker.appendChild(hint);
    box.appendChild(picker);
    var more = el('div', 'fb-more'); more.hidden = true;
    var ta = el('textarea', 'fb-text'); ta.maxLength = 300; ta.placeholder = 'What worked, what did not? (optional)'; ta.rows = ctx.compact ? 2 : 3; ta.setAttribute('aria-label', 'Your comment');
    var name = el('input', 'fb-name'); name.type = 'text'; name.maxLength = 40; name.placeholder = 'Your name (optional)'; name.setAttribute('aria-label', 'Your name');
    var hp = el('input', 'fb-hp'); hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
    var send = btn('Send', 'primary sm', 'check'); send.disabled = true;
    more.appendChild(ta);
    var row = el('div', 'fb-row'); row.appendChild(name); row.appendChild(hp); row.appendChild(send); more.appendChild(row);
    box.appendChild(more);
    var thanks = el('div', 'fb-thanks'); thanks.hidden = true; box.appendChild(thanks);
    send.onclick = function () {
      if (!chosen || !SITE.api) return;
      send.disabled = true;
      var payload = { stars: chosen, text: ta.value, name: name.value, page: ctx.page || location.pathname, website: hp.value };
      fetch(SITE.api + '/feedback', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(payload), credentials: 'omit' })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'could not send'); return j; }); })
        .then(function (j) {
          lsSet('cf.fb.t', String(Date.now()));
          head.hidden = true; picker.hidden = true; more.hidden = true;
          thanks.hidden = false;
          thanks.textContent = j.hidden ? 'Thank you. Comments with links are checked before they appear.' : 'Thank you — that helps.';
          if (FB.data && !j.hidden) {
            FB.data.count++; FB.data.dist[chosen] = (FB.data.dist[chosen] || 0) + 1;
            FB.data.avg = Math.round(((FB.data.avg * (FB.data.count - 1)) + chosen) / FB.data.count * 10) / 10;
            if (ta.value.trim()) FB.data.recent.unshift({ stars: chosen, text: ta.value.trim(), name: name.value.trim(), ts: Date.now(), page: payload.page });
            renderFeedback();
          }
        }, function (e) { send.disabled = false; toast(e.message, 'lock'); });
    };
    return box;
  }
  function pageLabel(p) { return (p || '').replace(/^\/|\/$/g, '').replace(/-/g, ' ') || 'home page'; }
  function loadFeedback() {
    var box = $('#fb-summary');
    if (!box || !SITE.api) return;
    $('#fb-form').appendChild(feedbackForm({ page: '/' }));
    fetch(SITE.api + '/feedback', { credentials: 'omit' }).then(function (r) { return r.json(); })
      .then(function (d) { FB.data = d; renderFeedback(); }, function () { box.innerHTML = ''; box.appendChild(el('p', 'fb-empty', 'Ratings are not available right now.')); });
  }
  function renderFeedback() {
    var d = FB.data, box = $('#fb-summary'), list = $('#fb-list'), cnt = $('#fb-count');
    if (!d || !box) return;
    box.innerHTML = ''; list.innerHTML = '';
    if (!d.count) { box.appendChild(el('p', 'fb-empty', 'No ratings yet — be the first.')); cnt.textContent = ''; return; }
    var big = el('div', 'fb-big');
    big.appendChild(el('b', null, d.avg.toFixed(1)));
    var side = el('div', 'fb-side'); side.appendChild(starRow(d.avg, 'lg')); side.appendChild(el('span', 'u', 'from ' + fmtInt(d.count) + ' rating' + (d.count === 1 ? '' : 's'))); big.appendChild(side);
    box.appendChild(big);
    var bars = el('div', 'fb-bars');
    for (var st = 5; st >= 1; st--) {
      var row = el('div', 'fb-bar'); row.appendChild(el('span', 'k', st + '★'));
      var track = el('span', 'track'), fill = el('i'); fill.style.width = Math.round((d.dist[st] || 0) / d.count * 100) + '%'; track.appendChild(fill);
      row.appendChild(track); row.appendChild(el('span', 'n', fmtInt(d.dist[st] || 0))); bars.appendChild(row);
    }
    box.appendChild(bars);
    cnt.textContent = d.avg.toFixed(1) + ' ★ · ' + fmtInt(d.count) + ' rating' + (d.count === 1 ? '' : 's');
    (d.recent || []).forEach(function (r) {
      var card = el('article', 'fb-card'); card.appendChild(starRow(r.stars));
      card.appendChild(el('p', null, r.text));
      var meta = el('div', 'fb-meta'); meta.appendChild(el('b', null, r.name || 'Anonymous'));
      meta.appendChild(el('span', null, when(r.ts) + (r.page && r.page !== '/' ? ' · ' + pageLabel(r.page) : '')));
      card.appendChild(meta); list.appendChild(card);
    });
    // the average joins the page's structured data, so search results can show it
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].textContent.indexOf('"WebApplication"') < 0) continue;
      try {
        var ld = JSON.parse(scripts[i].textContent);
        ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: d.avg, ratingCount: d.count, bestRating: 5, worstRating: 1 };
        scripts[i].textContent = JSON.stringify(ld);
      } catch (e) {}
      break;
    }
  }

  /* ------------------------------------------------ install as an app */
  // The service worker caches the shell and the libraries a format needed, so
  // the converter keeps working with no connection; the manifest lets Chrome
  // and Safari install it, and puts it in Android's share sheet.
  function installApp() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.search.indexOf('sw=1') > -1) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
    // No install button on the site. Swallowing the browser's own prompt also
    // keeps Android's "add to home screen" bar from popping up on its own.
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); });
  }
  function takeSharedFiles() {
    if (location.search.indexOf('shared=1') < 0 || !root.indexedDB) return;
    var r = indexedDB.open('cf-share', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('files', { autoIncrement: true }); };
    r.onsuccess = function () {
      var db = r.result, tx = db.transaction('files', 'readwrite'), st = tx.objectStore('files'), got = st.getAll();
      got.onsuccess = function () {
        var files = (got.result || []).filter(function (f) { return f && f.size !== undefined; });
        st.clear();
        if (files.length && !document.querySelector('meta[name="cf-tool"]')) { show('convert'); addFiles(files, false); toast(files.length + ' file' + (files.length === 1 ? '' : 's') + ' received', 'check'); }
      };
      tx.oncomplete = function () { history.replaceState(null, '', location.pathname); };
    };
  }

  function init() {
    state.to = C.defaultTarget(state.from);
    refreshTargets();
    document.addEventListener('formats-changed', function () { refreshTargets(); if (picker.open === 'to') { picker.items = targetItems(); paintPicker(); } });

    // Convert goes to the converter itself. On the home page that is just a
    // view switch; from a hub, guide or landing page it is a real navigation.
    $('#nav-convert').onclick = function (e) {
      if (!isHome()) return;
      e.preventDefault(); show('convert');
    };
    $('#nav-files').onclick = function () { show('files'); };
    $('#brand').onclick = function (e) { if (isHome()) { e.preventDefault(); show('convert'); } };
    $('#f-about').onclick = function (e) {
      var t = $('#about');
      if (!t) return;            // not the home page: follow the href to /#about
      e.preventDefault(); show('convert', true); t.scrollIntoView({ block: 'start' });
    };
    $('#f-support').onclick = function (e) { e.preventDefault(); goSupport(); };
    $('#f-feedback').onclick = function (e) {
      var t = $('#feedback');
      if (!t) return;                       // not the home page: the href goes to /#feedback
      e.preventDefault(); show('convert', true); t.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    window.addEventListener('hashchange', route);
    // seed the on-device counter for people who converted before it existed
    if (lsGet('cf.converted') === null) DB.all().then(function (rows) { if (rows.length && lsGet('cf.converted') === null) { lsSet('cf.converted', String(rows.length)); lsSet('cf.since', String(rows[rows.length - 1].createdAt || Date.now())); renderHome(); } }, function () {});
    C.ready.then(renderHome);
    renderHome();
    loadTotals();
    adUnit('ad-home', 'home');
    route();
    pagePreset();
    // /?stats=off marks this device as the owner's, /?stats=on undoes it
    if (/[?&]stats=off\b/.test(location.search)) { lsSet('cf.owner', '1'); toast('This device is now left out of the statistics', 'check'); history.replaceState(null, '', location.pathname); }
    else if (/[?&]stats=on\b/.test(location.search)) { try { localStorage.removeItem('cf.owner'); } catch (e) {} toast('This device counts as a visitor again', 'check'); history.replaceState(null, '', location.pathname); }
    trackView();
    watchTime();
    installApp();
    takeSharedFiles();
    loadFeedback();
    promo();
    $('#files-go').onclick = function () { if (!isHome() && document.querySelector('meta[name="cf-tool"]')) { location.href = '/'; return; } show('convert'); $('#file').click(); };

    // On a tool page (/compress-image/ and friends) tools.js owns the drop
    // zone and the file input; the converter's own wiring must stay out.
    if (!document.querySelector('meta[name="cf-tool"]')) {
    var drop = $('#drop');
    drop.onclick = function () { $('#file').click(); };
    drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } };
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files, false); });
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) { e.preventDefault(); });
    $('#file').onchange = function (e) { addFiles(e.target.files, false); e.target.value = ''; };
    $('#sticky-go').onclick = function () { $('#go').scrollIntoView({ block: 'center' }); convert(); };
    if (TOUCH) { $('#drop h2').textContent = 'Choose files'; $('#drop p').innerHTML = 'Tap to pick one or more files &mdash; images, documents, spreadsheets, audio, video, archives, 3D models'; }

    $('#tile-from').onclick = function () { picker.open === 'from' ? closePicker() : openPicker('from'); };
    $('#tile-to').onclick = function () { picker.open === 'to' ? closePicker() : openPicker('to'); };
    ['from', 'to'].forEach(function (w) {
      $('#tile-' + w).onkeydown = function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); openPicker(w); } };
    });
    var q = $('#picker-q');
    q.oninput = paintPicker;
    q.onkeydown = function (e) {
      var n = (picker.visible || []).length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { setActive((picker.active + 1) % n); scrollActiveIntoView(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { setActive((picker.active - 1 + n) % n); scrollActiveIntoView(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (n && picker.active >= 0) choose(picker.visible[picker.active].ext); }
      else if (e.key === 'Escape') { e.preventDefault(); var w = picker.open; closePicker(); if (w) $('#tile-' + w).focus(); }
      else if (e.key === 'Tab') { closePicker(); }
    };
    document.addEventListener('mousedown', function (e) {
      if (!picker.open) return;
      if ($('#picker').contains(e.target) || $('#tile-' + picker.open).contains(e.target)) return;
      closePicker();
    });
    // Only a width change (rotation, or a resized desktop window) invalidates the
    // picker's position. Opening the on-screen keyboard changes the height only,
    // and must not close it.
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      closePicker();
    });
    // on desktop the popover is anchored to the tile, so page scroll closes it; on phones it is a fixed bottom sheet
    window.addEventListener('scroll', function () { if (picker.open && !sheetMode()) closePicker(); }, { passive: true });
    $('#o-quality').oninput = function (e) { $('#o-quality-v').textContent = e.target.value + '%'; };
    $('#o-scale').oninput = function (e) { $('#o-scale-v').textContent = e.target.value + 'x'; };
    $('#go').onclick = convert;
    }

    $('#modal-close').onclick = closePreview;
    $('#modal').onclick = function (e) { if (e.target === $('#modal')) closePreview(); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closePreview(); });
    $('#files-q').oninput = paintCards;
    $('#files-clear').onclick = function () {
      if (!cache.length) return;
      if (!confirm('Remove all ' + cache.length + ' converted files from this browser?')) return;
      DB.clear().then(function () { state.fresh = null; renderFiles(); toast('Cleared', 'trash'); });
    };
    $('#formats-q').oninput = filterFormats;
    refreshCount();
  }

  root.UI = { el: el, icon: icon, btn: btn, toast: toast, download: download, chip: chip, when: when, show: show, track: track, feedbackForm: feedbackForm, feedbackDue: feedbackDue };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
