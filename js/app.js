/* app.js — UI: pick a file, choose from/to, convert, download, browse Your files. */
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
  function show(name, keepScroll) {
    ['convert', 'files', 'formats', 'guides'].forEach(function (v) {
      $('#nav-' + v).setAttribute('aria-selected', String(v === name));
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
    $('#picker-q').focus();
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
    if (state.files.length === 1) { state.from = fileExt(state.files[0]); state.to = C.defaultTarget(state.from); }
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
        if (ok.length) { state.last = ok[0].rec; paintDone(ok[0].rec); adUnit('ad-result', 'result'); toast(ok[0].rec.id ? 'Saved to Your files' : 'Converted', 'check'); }
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
    var a = el('a', null, 'Your files'); a.href = '#'; a.onclick = function (e) { e.preventDefault(); show('files'); }; saved.appendChild(a);
    saved.appendChild(document.createTextNode(' so you can download them again later. '));
    var tip = el('a', 'tip-link'); tip.href = '#support'; tip.appendChild(icon('heart')); tip.appendChild(el('span', null, 'Found it useful? Leave a tip'));
    tip.onclick = function (e) { e.preventDefault(); goSupport(); }; saved.appendChild(tip);
    body.appendChild(saved);
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
      var a = el('a', null, 'Your files'); a.href = '#';
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
      if (IMG_PREVIEW.test(r.targetExt) || r.targetExt === 'pdf') {
        pv.classList.add('openable');
        pv.title = 'Open';
        pv.onclick = function () { window.open(URL.createObjectURL(r.blob), '_blank'); };
      }
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

  /* -------------------------------------------- editorial: home sections */
  var K = root.Content;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function bumpCounter() {
    lsSet('cf.converted', String((parseInt(lsGet('cf.converted'), 10) || 0) + 1));
    if (!lsGet('cf.since')) lsSet('cf.since', String(Date.now()));
  }
  function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function popTile(from, to, label, count) {
    var b = el('button'); b.type = 'button';
    b.appendChild(chip(from));
    var arr = el('span', null, '→'); arr.style.color = 'var(--pop)'; b.appendChild(arr);
    b.appendChild(chip(to));
    b.appendChild(el('span', 'lbl', label));
    if (count) b.appendChild(el('span', 'cnt', count + '×'));
    b.onclick = function () { preset(from, to); };
    return b;
  }
  function guideCard(gd) {
    var c = el('button', 'gcard'); c.type = 'button';
    var cat = el('span', 'cat', gd.cat); cat.style.setProperty('--fam', FAM_VAR[gd.fam] || 'var(--accent)');
    c.appendChild(cat);
    c.appendChild(el('h3', null, gd.title));
    c.appendChild(el('p', null, gd.teaser));
    c.appendChild(el('span', 'rt', readTime(gd) + ' min read'));
    c.onclick = function () { openGuide(gd.slug); };
    return c;
  }
  function readTime(gd) {
    var words = gd.body.join(' ').replace(/<[^>]+>/g, '').split(/\s+/).length;
    return Math.max(2, Math.round(words / 200));
  }
  var homeStatic = false;
  function renderHome() {
    // live numbers
    var kp = $('#kpis'); kp.innerHTML = '';
    var here = parseInt(lsGet('cf.converted'), 10) || 0, since = parseInt(lsGet('cf.since'), 10);
    var sources = C.sourcesList(), targets = {};
    sources.forEach(function (f) { C.targetsFor(f).forEach(function (t) { if (t !== '*') targets[t] = 1; }); });
    [[fmtInt(C.pairCount()), 'conversions available', 'in this browser, right now'],
     [fmtInt(sources.length - 1) + ' / ' + fmtInt(Object.keys(targets).length), 'formats in / out', 'plus any file to zip, tar or gz'],
     [fmtInt(here), 'files converted here', since ? 'on this device since ' + new Date(since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'on this device'],
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
    K.POPULAR.forEach(function (pr) { if (C.rule(pr[0], pr[1])) pop.appendChild(popTile(pr[0], pr[1], pr[2])); });
    var hg = $('#home-guides');
    K.GUIDES.slice(0, 3).forEach(function (gd) { hg.appendChild(guideCard(gd)); });
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
    show('convert', true);
    closeGuide();
    $('#support').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ------------------------------------------------------------- guides */
  var guidesBuilt = false;
  function renderGuides() {
    if (guidesBuilt) return;
    guidesBuilt = true;
    var grid = $('#guides-grid');
    K.GUIDES.forEach(function (gd) { grid.appendChild(guideCard(gd)); });
  }
  function openGuide(slug) {
    var gd = K.GUIDES.filter(function (g) { return g.slug === slug; })[0];
    if (!gd) return;
    show('guides');
    $('#guides-list').hidden = true;
    var a = $('#article'); a.hidden = false; a.innerHTML = '';
    var back = btn('All guides', 'sm nav-back'); back.onclick = closeGuide; a.appendChild(back);
    var cat = el('div', 'cat', gd.cat); cat.style.setProperty('--fam', FAM_VAR[gd.fam] || 'var(--accent)'); a.appendChild(cat);
    a.appendChild(el('h1', null, gd.title));
    a.appendChild(el('div', 'meta', readTime(gd) + ' min read · Convert Files guides'));
    var body = el('div', 'body');
    gd.body.forEach(function (line) {
      var kind = line.slice(0, 1), text = line.slice(2);
      if (kind === 'h') body.appendChild(el('h3', null, text));
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
    if (gd.tryFrom && C.rule(gd.tryFrom, gd.tryTo)) {
      var t = el('div', 'try');
      t.appendChild(el('span', 't', 'Try it: convert a .' + gd.tryFrom + ' to .' + gd.tryTo + ' — free, in your browser.'));
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
    else if (h === '#guides') { show('guides'); closeGuide(); }
    else if (h === '#formats') show('formats');
    else if (h === '#files') show('files');
    else if (h === '#about') { show('convert', true); var t = $('#about'); if (t) t.scrollIntoView({ block: 'start' }); }
    else if (h === '#support') goSupport();
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
      if (C.rule(pr[0], pr[1])) { state.from = pr[0]; state.to = pr[1]; refreshTargets(); }
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
  function track(ev) {
    if (trackingOff()) return;
    try {
      // text/plain keeps it a "simple" request (no CORS preflight, works with keepalive)
      fetch(SITE.api + '/event', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(ev), keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) {}
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
  function init() {
    state.to = C.defaultTarget(state.from);
    refreshTargets();
    document.addEventListener('formats-changed', function () { refreshTargets(); if (picker.open === 'to') { picker.items = targetItems(); paintPicker(); } });

    $('#nav-convert').onclick = function () { show('convert'); };
    $('#nav-files').onclick = function () { show('files'); };
    $('#nav-formats').onclick = function () { show('formats'); };
    $('#nav-guides').onclick = function () { show('guides'); closeGuide(); };
    $('#brand').onclick = function (e) { if (location.pathname === '/' || /index\.html$/.test(location.pathname)) { e.preventDefault(); show('convert'); } };
    $('#home-all-guides').onclick = function () { show('guides'); closeGuide(); };
    $('#f-guides').onclick = function (e) { e.preventDefault(); show('guides'); closeGuide(); };
    $('#f-formats').onclick = function (e) { e.preventDefault(); show('formats'); };
    $('#f-about').onclick = function (e) { e.preventDefault(); show('convert', true); $('#about').scrollIntoView({ block: 'start' }); };
    $('#f-support').onclick = function (e) { e.preventDefault(); goSupport(); };
    window.addEventListener('hashchange', route);
    // seed the on-device counter for people who converted before it existed
    if (lsGet('cf.converted') === null) DB.all().then(function (rows) { if (rows.length && lsGet('cf.converted') === null) { lsSet('cf.converted', String(rows.length)); lsSet('cf.since', String(rows[rows.length - 1].createdAt || Date.now())); renderHome(); } }, function () {});
    C.ready.then(renderHome);
    renderHome();
    adUnit('ad-home', 'home');
    route();
    pagePreset();
    trackView();
    $('#files-go').onclick = function () { show('convert'); $('#file').click(); };

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
    window.addEventListener('resize', closePicker);
    // on desktop the popover is anchored to the tile, so page scroll closes it; on phones it is a fixed bottom sheet
    window.addEventListener('scroll', function () { if (picker.open && !sheetMode()) closePicker(); }, { passive: true });
    $('#o-quality').oninput = function (e) { $('#o-quality-v').textContent = e.target.value + '%'; };
    $('#o-scale').oninput = function (e) { $('#o-scale-v').textContent = e.target.value + 'x'; };
    $('#go').onclick = convert;

    $('#files-q').oninput = paintCards;
    $('#files-clear').onclick = function () {
      if (!cache.length) return;
      if (!confirm('Remove all ' + cache.length + ' converted files from this browser?')) return;
      DB.clear().then(function () { state.fresh = null; renderFiles(); toast('Cleared', 'trash'); });
    };
    $('#formats-q').oninput = filterFormats;
    refreshCount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
