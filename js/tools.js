/* tools.js — the stand-alone tools: compress to a size, resize/crop, passport
   photo, the PDF set (merge/split/rotate/organise/images-to-PDF/sign), OCR,
   video trim, audio cut, metadata, QR codes, unzip.

   Every tool runs in the browser like the converter does: nothing is uploaded.
   A tool page carries <meta name="cf-tool" content="slug">; app.js leaves the
   drop zone to us on those pages. Each tool is an object in TOOLS: what it
   accepts, how to build its options, and run(files) -> [{blob, name}]. */
(function (root) {
  'use strict';
  var F = root.Formats, C = root.Convert, K = C._kit, U = root.UI, DB = root.DB, Enc = root.Enc;
  var need = F.need;
  var $ = function (s) { return document.querySelector(s); };
  var el = U.el, icon = U.icon, btn = U.btn, toast = U.toast, download = U.download;

  var metaTool = document.querySelector('meta[name="cf-tool"]');
  if (!metaTool) return;
  var TOOL = metaTool.content;
  var PRESET = {};
  try { var pm = document.querySelector('meta[name="cf-tool-preset"]'); PRESET = pm ? JSON.parse(pm.content) : {}; } catch (e) {}
  var TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  /* ------------------------------------------------------------- helpers */
  var IMG = /^(png|jpe?g|jfif|webp|gif|bmp|hei[cf]|avif|tiff?|svg|jxl|ico)$/;
  function ext(f) { var m = /\.([a-z0-9]+)$/i.exec(f.name || ''); return m ? m[1].toLowerCase() : ''; }
  function isImg(f) { return IMG.test(ext(f)); }
  function isPdf(f) { return ext(f) === 'pdf' || f.type === 'application/pdf'; }
  function base(n) { return n.replace(/\.[^.]+$/, ''); }
  function noop() {}
  function decode(f, opts) { return K.decodeImage({ file: f, from: ext(f) === 'jpeg' ? 'jpg' : ext(f), opts: opts || {}, log: noop }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pct(a, b) { return b ? Math.round((1 - a / b) * 100) : 0; }
  function fmtTime(s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }
  function parseTime(v) { if (typeof v === 'number') return v; var p = String(v).trim().split(':'); return p.length === 2 ? parseFloat(p[0]) * 60 + parseFloat(p[1]) : parseFloat(v) || 0; }
  function ranges(str, n) {
    // "1-3, 5, 8-" -> zero-based page indices, in the order written, within 1..n
    var out = [], seen = {};
    String(str || '').split(/[,\s]+/).forEach(function (part) {
      if (!part) return;
      var m = /^(\d+)?\s*-\s*(\d+)?$/.exec(part), a, b;
      if (m) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : n; }
      else if (/^\d+$/.test(part)) { a = b = +part; }
      else return;
      if (a > b) { var t = a; a = b; b = t; }
      for (var i = Math.max(1, a); i <= Math.min(n, b); i++) if (!seen[i]) { seen[i] = 1; out.push(i - 1); }
    });
    return out;
  }
  var fieldSeq = 0;
  function field(label, input, unit) {
    // every control gets an id and a <label for>, so screen readers announce it
    var w = el('div', 'opt');
    if (!input.id) input.id = 't-f' + (++fieldSeq);
    var l = el('label', null, label); l.htmlFor = input.id;
    if (input.type === 'checkbox') { w.appendChild(input); w.appendChild(l); }
    else { w.appendChild(l); w.appendChild(input); if (unit) w.appendChild(el('span', 'u', unit)); }
    return w;
  }
  function num(v, min, max, step, width) { var i = el('input'); i.type = 'number'; i.value = v; if (min != null) i.min = min; if (max != null) i.max = max; if (step) i.step = step; if (width) i.style.width = width; return i; }
  function sel(opts, v) { var s = el('select'); opts.forEach(function (o) { var e = el('option', null, o[1]); e.value = o[0]; if (o[0] === v) e.selected = true; s.appendChild(e); }); return s; }
  function check(v) { var i = el('input'); i.type = 'checkbox'; i.checked = !!v; return i; }
  function range(v, min, max, step) { var i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = v; return i; }
  function chips(items, active, onPick) {
    var w = el('div', 't-chips');
    items.forEach(function (it) {
      var b = el('button', 't-chip' + (it.value === active ? ' on' : ''), it.label); b.type = 'button';
      b.onclick = function () { w.querySelectorAll('.t-chip').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); onPick(it.value, it); };
      w.appendChild(b);
    });
    return w;
  }
  function thumb(f) {
    var th = el('div', 'thumb');
    if (isImg(f) && !/svg|hei[cf]|tiff?|avif|jxl/.test(ext(f))) {
      var img = el('img'); img.src = URL.createObjectURL(f); img.onload = function () { URL.revokeObjectURL(img.src); }; th.appendChild(img);
    } else th.appendChild(el('span', 'tbadge', (ext(f) || 'file').toUpperCase()));
    return th;
  }
  function blobToCanvas(blob) { return K.loadImg(URL.createObjectURL(blob)).then(function (img) { var c = K.canvasOf(img.naturalWidth, img.naturalHeight); c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(img.src); return c; }); }
  function canvasToBlob(c, mime, q) { return K.toBlob(c, mime, q); }
  function scaleCanvas(src, w, h) {
    // stepwise downscale for quality on big reductions
    var c = src, cw = src.width, ch = src.height;
    while (cw / 2 > w && ch / 2 > h) {
      var n = K.canvasOf(cw / 2, ch / 2); n.getContext('2d').drawImage(c, 0, 0, n.width, n.height); c = n; cw = n.width; ch = n.height;
    }
    var out = K.canvasOf(w, h); var g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, w, h); return out;
  }
  function hasAlpha(c) {
    var g = c.getContext('2d'), w = c.width, h = c.height, step = Math.max(1, Math.floor(Math.sqrt(w * h / 4000)));
    var d = g.getImageData(0, 0, w, h).data;
    for (var y = 0; y < h; y += step) for (var x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] < 250) return true;
    return false;
  }
  function flatten(c, color) { var o = K.canvasOf(c.width, c.height), g = o.getContext('2d'); g.fillStyle = color || '#fff'; g.fillRect(0, 0, o.width, o.height); g.drawImage(c, 0, 0); return o; }
  function pdfDoc(file) {
    return need('pdfjs').then(function (pdfjsLib) { return file.arrayBuffer().then(function (ab) { return pdfjsLib.getDocument({ data: ab }).promise; }); });
  }
  function renderPage(doc, i, scale) {
    return doc.getPage(i + 1).then(function (page) {
      var vp = page.getViewport({ scale: scale });
      var c = K.canvasOf(vp.width, vp.height);
      return page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise.then(function () { return { canvas: c, page: page, viewport: vp }; });
    });
  }
  function pdfLib() { return need('pdflib'); }
  function saveRecord(blob, name, srcFile, ms) {
    var rec = { name: name, sourceName: srcFile ? srcFile.name : name, sourceExt: srcFile ? ext(srcFile) : '', targetExt: ext({ name: name }),
                sourceSize: srcFile ? srcFile.size : 0, size: blob.size, mime: blob.type || '', durationMs: ms || 0, options: { tool: TOOL },
                createdAt: Date.now(), blob: blob };
    return DB.put(rec).then(function (id) { rec.id = id; return rec; }, function () { return rec; });
  }

  /* ---------------------------------------------------- pan/zoom crop stage */
  // Shows an image behind a fixed-aspect frame; drag to move, slider to zoom;
  // export() returns the framed region at the requested pixel size.
  function CropStage(canvasSrc, aspect, opts) {
    opts = opts || {};
    var box = el('div', 't-stage-box');
    var stage = el('canvas', 't-stage-canvas'); box.appendChild(stage);
    var W = Math.min(560, (opts.maxWidth || 560)), H = Math.round(W * 0.68);
    stage.width = W; stage.height = H;
    var g = stage.getContext('2d');
    var img = canvasSrc, iw = img.width, ih = img.height;
    var frame = { w: 0, h: 0, x: 0, y: 0 }, zoom = 1, ox = 0, oy = 0, baseScale = 1;
    function layout() {
      var pad = 24, fw = W - pad * 2, fh = fw / aspect;
      if (fh > H - pad * 2) { fh = H - pad * 2; fw = fh * aspect; }
      frame.w = fw; frame.h = fh; frame.x = (W - fw) / 2; frame.y = (H - fh) / 2;
      baseScale = Math.max(fw / iw, fh / ih);
      center();
    }
    function scale() { return baseScale * zoom; }
    function clampOff() {
      var s = scale();
      ox = clamp(ox, frame.w - iw * s, 0); oy = clamp(oy, frame.h - ih * s, 0);
    }
    function center() { var s = scale(); ox = (frame.w - iw * s) / 2; oy = (frame.h - ih * s) / 2; clampOff(); draw(); }
    function draw() {
      var s = scale();
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#0b0f14'; g.fillRect(0, 0, W, H);
      g.drawImage(img, frame.x + ox, frame.y + oy, iw * s, ih * s);
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(0, 0, W, frame.y); g.fillRect(0, frame.y + frame.h, W, H - frame.y - frame.h);
      g.fillRect(0, frame.y, frame.x, frame.h); g.fillRect(frame.x + frame.w, frame.y, W - frame.x - frame.w, frame.h);
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2);
      if (opts.guides) {
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
        for (var i = 1; i < 3; i++) { g.beginPath(); g.moveTo(frame.x + frame.w * i / 3, frame.y); g.lineTo(frame.x + frame.w * i / 3, frame.y + frame.h); g.stroke();
                                      g.beginPath(); g.moveTo(frame.x, frame.y + frame.h * i / 3); g.lineTo(frame.x + frame.w, frame.y + frame.h * i / 3); g.stroke(); }
      }
      if (opts.headGuide) {
        // passport guidance: head should fill ~70% of the frame height
        g.strokeStyle = 'rgba(255,220,80,.8)'; g.setLineDash([6, 5]);
        var hh = frame.h * 0.72, hw = hh * 0.74;
        g.beginPath(); g.ellipse(frame.x + frame.w / 2, frame.y + frame.h * 0.46, hw / 2, hh / 2, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
    }
    var drag = null;
    stage.style.touchAction = 'none';
    stage.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, ox: ox, oy: oy }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) { if (!drag) return; var r = stage.getBoundingClientRect(), k = W / r.width; ox = drag.ox + (e.clientX - drag.x) * k; oy = drag.oy + (e.clientY - drag.y) * k; clampOff(); draw(); });
    stage.addEventListener('pointerup', function () { drag = null; });
    stage.addEventListener('pointercancel', function () { drag = null; });
    stage.addEventListener('wheel', function (e) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.06 : 0.94)); zoomIn.value = zoom; }, { passive: false });
    var zoomIn = range(1, 1, 4, 0.01);
    function setZoom(z) {
      var s0 = scale(); zoom = clamp(z, 1, 4); var s1 = scale();
      // zoom about the frame centre
      var cx = frame.w / 2, cy = frame.h / 2;
      ox = cx - (cx - ox) * (s1 / s0); oy = cy - (cy - oy) * (s1 / s0);
      clampOff(); draw();
    }
    zoomIn.oninput = function () { setZoom(parseFloat(zoomIn.value)); };
    var tools = el('div', 't-stage-tools');
    tools.appendChild(el('span', 'u', 'Drag to move'));
    zoomIn.setAttribute('aria-label', 'Zoom'); var zl = el('label', null, 'Zoom'); tools.appendChild(zl); tools.appendChild(zoomIn);
    var cb = btn('Centre', 'sm'); cb.onclick = function () { zoom = 1; zoomIn.value = 1; center(); }; tools.appendChild(cb);
    box.appendChild(tools);
    layout();
    return {
      el: box,
      setAspect: function (a) { aspect = a; zoom = 1; zoomIn.value = 1; layout(); },
      setImage: function (c) { img = c; iw = c.width; ih = c.height; zoom = 1; zoomIn.value = 1; layout(); },
      export: function (outW, outH) {
        var s = scale(), sx = -ox / s, sy = -oy / s, sw = frame.w / s, sh = frame.h / s;
        var out = K.canvasOf(outW, outH), og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
        og.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
        return out;
      },
      region: function () { var s = scale(); return { x: -ox / s, y: -oy / s, w: frame.w / s, h: frame.h / s }; }
    };
  }

  /* --------------------------------------------- compress an image to a size */
  // Binary-search JPEG/WebP quality at the current size; if the floor quality is
  // still too big, scale down and try again. Stops at the first result under target.
  function compressToTarget(canvas, targetBytes, o, prog) {
    var mime = o.mime || 'image/jpeg', minQ = o.minQ || 0.3, minSide = o.minSide || 160;
    var c = canvas, attempts = 0;
    if (mime === 'image/jpeg' && hasAlpha(c)) c = flatten(c, '#ffffff');
    function tryQuality(cv) {
      // highest quality that fits, by bisection on q
      var lo = minQ, hi = 0.95, best = null;
      function step() {
        if (hi - lo < 0.03) return best ? Promise.resolve(best) : canvasToBlob(cv, mime, lo).then(function (b) { return { blob: b, q: lo }; });
        var q = (lo + hi) / 2;
        attempts++;
        return canvasToBlob(cv, mime, q).then(function (b) {
          if (prog) prog(Math.min(0.95, attempts / 14), cv.width + '×' + cv.height + ' at ' + Math.round(q * 100) + '% → ' + F.bytes(b.size));
          if (b.size <= targetBytes) { best = { blob: b, q: q }; lo = q; } else hi = q;
          return step();
        });
      }
      return step();
    }
    function loop(cv) {
      return tryQuality(cv).then(function (r) {
        if (r.blob.size <= targetBytes || o.keepSize) return { blob: r.blob, q: r.q, width: cv.width, height: cv.height };
        // still too big at the floor quality: shrink and go again
        var k = Math.sqrt(targetBytes / r.blob.size) * 0.92;
        var w = Math.round(cv.width * k), h = Math.round(cv.height * k);
        if (w < minSide || h < minSide || k > 0.98) return { blob: r.blob, q: r.q, width: cv.width, height: cv.height, missed: true };
        return loop(scaleCanvas(cv, w, h));
      });
    }
    return loop(c);
  }

  /* ------------------------------------------------------------- metadata */
  function stripJpeg(u8) {
    // Drop APP1..APP15 and COM segments (EXIF, XMP, IPTC, thumbnails, comments); keep the picture and its colour profile.
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) throw new Error('not a JPEG');
    var out = [u8.subarray(0, 2)], i = 2, n = u8.length;
    while (i < n) {
      if (u8[i] !== 0xFF) { out.push(u8.subarray(i)); break; }
      var m = u8[i + 1];
      if (m === 0xD9) { out.push(u8.subarray(i, i + 2)); break; }             // EOI
      if (m === 0xDA) { out.push(u8.subarray(i)); break; }                    // SOS: entropy-coded data to the end
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { out.push(u8.subarray(i, i + 2)); i += 2; continue; }
      var len = (u8[i + 2] << 8) | u8[i + 3];
      var seg = u8.subarray(i, i + 2 + len);
      var isApp = m >= 0xE1 && m <= 0xEF, isCom = m === 0xFE;
      var icc = m === 0xE2 && String.fromCharCode.apply(null, u8.subarray(i + 4, i + 15)) === 'ICC_PROFILE';
      if (!(isApp || isCom) || icc) out.push(seg);
      i += 2 + len;
    }
    return new Blob(out, { type: 'image/jpeg' });
  }
  function stripPng(u8) {
    var sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (var k = 0; k < 8; k++) if (u8[k] !== sig[k]) throw new Error('not a PNG');
    var out = [u8.subarray(0, 8)], i = 8, dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var drop = { tEXt: 1, zTXt: 1, iTXt: 1, eXIf: 1, tIME: 1, daTE: 1 };
    while (i + 8 <= u8.length) {
      var len = dv.getUint32(i), type = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
      var chunk = u8.subarray(i, i + 12 + len);
      if (!drop[type]) out.push(chunk);
      i += 12 + len;
      if (type === 'IEND') break;
    }
    return new Blob(out, { type: 'image/png' });
  }
  function stripWebp(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'RIFF' || String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) !== 'WEBP') throw new Error('not a WebP');
    var parts = [], i = 12, hasX = false;
    while (i + 8 <= u8.length) {
      var fourcc = String.fromCharCode(u8[i], u8[i + 1], u8[i + 2], u8[i + 3]), size = dv.getUint32(i + 4, true), padded = size + (size & 1);
      var chunk = new Uint8Array(u8.subarray(i, i + 8 + padded));
      if (fourcc === 'VP8X') { hasX = true; chunk[8] &= ~0x0C; }           // clear the EXIF and XMP flags
      if (fourcc !== 'EXIF' && fourcc !== 'XMP ') parts.push(chunk);
      i += 8 + padded;
    }
    if (!hasX) return new Blob([u8], { type: 'image/webp' });               // simple format: nothing to strip
    var total = parts.reduce(function (n, p) { return n + p.length; }, 0);
    var head = new Uint8Array(12); head.set(u8.subarray(0, 12)); new DataView(head.buffer).setUint32(4, total + 4, true);
    return new Blob([head].concat(parts), { type: 'image/webp' });
  }

  /* -------------------------------------------------------- the tools */
  var TOOLS = {};

  // ---- compress image (and the /compress-image-to-NNkb/ pages)
  TOOLS['compress-image'] = {
    accept: 'image/*,.heic,.heif,.tif,.tiff,.avif,.jxl', kinds: 'image', multiple: true, hint: 'Drop images here',
    label: 'Compress',
    setup: function (panel, o) {
      o.kb = PRESET.kb || 100; o.keep = false; o.fmt = 'auto'; o.w = 0; o.h = 0;
      var kbIn = num(o.kb, 5, 50000, 5, '92px');
      kbIn.oninput = function () { o.kb = +kbIn.value || o.kb; };
      panel.appendChild(field('Target size', kbIn, 'KB — the result will be at or under this'));
      var quick = [20, 50, 100, 200, 500, 1024].map(function (k) { return { value: k, label: k >= 1024 ? (k / 1024) + ' MB' : k + ' KB' }; });
      panel.appendChild(chips(quick, o.kb, function (v) { o.kb = v; kbIn.value = v; }));
      var presets = el('div', 't-presets');
      presets.appendChild(el('span', 'u', 'Presets for forms: '));
      [{ l: 'Exam photo 3.5×4.5 cm · ≤50 KB', kb: 50, w: 413, h: 531 }, { l: 'Exam signature 4×2 cm · ≤20 KB', kb: 20, w: 472, h: 236 },
       { l: 'Passport 35×45 mm · ≤100 KB', kb: 100, w: 413, h: 531 }, { l: 'WhatsApp / email · 1 MB', kb: 1024, w: 0, h: 0 }].forEach(function (p) {
        var b = el('button', 't-chip', p.l); b.type = 'button';
        b.onclick = function () { o.kb = p.kb; kbIn.value = p.kb; o.w = p.w; o.h = p.h; dims.textContent = p.w ? 'Output ' + p.w + '×' + p.h + ' px (centre-cropped to that shape). ' : ''; toast('Preset applied: ' + p.l, 'check'); };
        presets.appendChild(b);
      });
      panel.appendChild(presets);
      var dims = el('p', 'u t-note', ''); panel.appendChild(dims);
      var keep = check(false); keep.onchange = function () { o.keep = keep.checked; };
      panel.appendChild(field('Keep pixel dimensions (quality only, may miss the target)', keep));
      var fmt = sel([['auto', 'Auto (JPG, or WebP if transparent)'], ['jpeg', 'JPG'], ['webp', 'WebP'], ['png', 'PNG (lossless: size only via resizing)']], 'auto');
      fmt.onchange = function () { o.fmt = fmt.value; };
      panel.appendChild(field('Output', fmt));
      panel.appendChild(el('p', 'u t-note', 'Check the exact requirement of the form you are filling in — sizes and dimensions vary. Many Indian exam forms want a JPG under 50 KB for the photo and under 20 KB for the signature.'));
    },
    run: function (files, o, prog) {
      var target = o.kb * 1024;
      return files.reduce(function (chain, f, idx) {
        return chain.then(function (acc) {
          prog(idx / files.length, f.name);
          return decode(f).then(function (c) {
            if (o.w && o.h) { // centre-crop to the preset shape
              var s = Math.max(o.w / c.width, o.h / c.height), cw = o.w / s, ch = o.h / s;
              var cut = K.canvasOf(o.w, o.h); cut.getContext('2d').drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, 0, 0, o.w, o.h); c = cut;
            }
            var alpha = hasAlpha(c);
            var mime = o.fmt === 'auto' ? (alpha ? 'image/webp' : 'image/jpeg') : 'image/' + o.fmt;
            if (mime === 'image/png') {
              // lossless: only dimensions can bring the size down
              var cv = c;
              function shrink() {
                return canvasToBlob(cv, 'image/png').then(function (b) {
                  if (b.size <= target || cv.width < 160) return { blob: b, width: cv.width, height: cv.height, missed: b.size > target };
                  var k = Math.sqrt(target / b.size) * 0.9; cv = scaleCanvas(cv, Math.round(cv.width * k), Math.round(cv.height * k)); return shrink();
                });
              }
              return shrink();
            }
            return compressToTarget(c, target, { mime: mime, keepSize: o.keep }, function (p, m) { prog((idx + p) / files.length, m); });
          }).then(function (r) {
            var e = r.blob.type === 'image/png' ? 'png' : r.blob.type === 'image/webp' ? 'webp' : 'jpg';
            acc.push({ blob: r.blob, name: base(f.name) + '-' + o.kb + 'kb.' + e, src: f,
                       note: F.bytes(f.size) + ' → ' + F.bytes(r.blob.size) + ' (−' + pct(r.blob.size, f.size) + '%) · ' + r.width + '×' + r.height + (r.missed ? ' · could not get under ' + o.kb + ' KB without going tiny; this is the smallest sensible result' : '') });
            return acc;
          });
        });
      }, Promise.resolve([]));
    }
  };

  // ---- compress PDF (and /compress-pdf-to-NNNkb/)
  TOOLS['compress-pdf'] = {
    accept: '.pdf,application/pdf', kinds: 'pdf', multiple: true, hint: 'Drop PDF files here', label: 'Compress PDF',
    setup: function (panel, o) {
      o.kb = PRESET.kb || 200; o.mode = 'image';
      var kbIn = num(o.kb, 20, 100000, 10, '96px'); kbIn.oninput = function () { o.kb = +kbIn.value || o.kb; };
      panel.appendChild(field('Target size', kbIn, 'KB'));
      panel.appendChild(chips([100, 200, 500, 1024, 2048].map(function (k) { return { value: k, label: k >= 1024 ? (k / 1024) + ' MB' : k + ' KB' }; }), o.kb, function (v) { o.kb = v; kbIn.value = v; }));
      var mode = sel([['image', 'Strong — pages become pictures (best for scans and photo PDFs)'], ['light', 'Light — keeps selectable text (smaller gains)']], 'image');
      mode.onchange = function () { o.mode = mode.value; };
      panel.appendChild(field('Method', mode));
      panel.appendChild(el('p', 'u t-note', 'Strong compression re-renders every page as a JPEG, so text can no longer be selected or searched. Light compression rewrites the file structure and keeps the text, but a PDF that is mostly pictures will not shrink much that way.'));
    },
    run: function (files, o, prog) {
      var target = o.kb * 1024;
      return files.reduce(function (chain, f, idx) {
        return chain.then(function (acc) {
          var note;
          var job = o.mode === 'light' ? pdfLib().then(function (PL) {
            return f.arrayBuffer().then(function (ab) { return PL.PDFDocument.load(ab, { ignoreEncryption: true, updateMetadata: false }); })
              .then(function (doc) { doc.setProducer('Convert Files'); doc.setCreator('Convert Files'); return doc.save({ useObjectStreams: true }); })
              .then(function (u8) { return new Blob([u8], { type: 'application/pdf' }); });
          }) : Promise.all([pdfDoc(f), need('jspdf')]).then(function (r) {
            var doc = r[0], jsPDF = r[1].jsPDF, n = doc.numPages;
            // quality ladder: render scale × JPEG quality, until the whole file fits
            var ladder = [[1.6, 0.8], [1.4, 0.7], [1.25, 0.6], [1.1, 0.5], [1.0, 0.45], [0.85, 0.4], [0.7, 0.35], [0.6, 0.3]];
            var step = 0;
            function attempt() {
              var sc = ladder[step][0], q = ladder[step][1], pdf = null;
              var chain2 = Promise.resolve();
              for (var i = 0; i < n; i++) (function (i) {
                chain2 = chain2.then(function () {
                  return renderPage(doc, i, sc).then(function (pg) {
                    var wpt = pg.viewport.width / sc, hpt = pg.viewport.height / sc;   // points at scale 1 = 72 dpi
                    if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [wpt, hpt], orientation: wpt > hpt ? 'l' : 'p', compress: true });
                    else pdf.addPage([wpt, hpt], wpt > hpt ? 'l' : 'p');
                    var flat = flatten(pg.canvas, '#fff');
                    pdf.addImage(flat.toDataURL('image/jpeg', q), 'JPEG', 0, 0, wpt, hpt, undefined, 'FAST');
                    prog((idx + (i + 1) / n) / files.length, 'page ' + (i + 1) + ' of ' + n + ' · pass ' + (step + 1));
                  });
                });
              })(i);
              return chain2.then(function () {
                var blob = pdf.output('blob');
                if (blob.size <= target || step >= ladder.length - 1) { note = blob.size > target ? ' · could not reach ' + o.kb + ' KB while keeping pages readable' : ''; return blob; }
                step++; return attempt();
              });
            }
            return attempt();
          });
          return job.then(function (blob) {
            acc.push({ blob: blob, name: base(f.name) + '-' + o.kb + 'kb.pdf', src: f, note: F.bytes(f.size) + ' → ' + F.bytes(blob.size) + ' (−' + pct(blob.size, f.size) + '%)' + (note || '') });
            return acc;
          });
        });
      }, Promise.resolve([]));
    }
  };

  // ---- passport photo
  var PASS_SIZES = [
    { id: 'in', label: 'India · 35×45 mm (passport, most forms)', w: 35, h: 45 },
    { id: 'us', label: 'USA · 2×2 in (51×51 mm)', w: 51, h: 51 },
    { id: 'uk', label: 'UK / EU / Schengen · 35×45 mm', w: 35, h: 45 },
    { id: 'ca', label: 'Canada · 50×70 mm', w: 50, h: 70 },
    { id: 'cn', label: 'China · 33×48 mm', w: 33, h: 48 },
    { id: 'stamp', label: 'Stamp size · 20×25 mm', w: 20, h: 25 },
    { id: 'custom', label: 'Custom (mm)', w: 35, h: 45 }
  ];
  TOOLS['passport-photo'] = {
    accept: 'image/*,.heic,.heif', kinds: 'image', multiple: false, hint: 'Drop a photo here', label: 'Make passport photo',
    stage: true,
    setup: function (panel, o) {
      o.size = PASS_SIZES[0]; o.dpi = 300; o.kb = 0; o.sheet = true; o.copies = 8;
      var s = sel(PASS_SIZES.map(function (p) { return [p.id, p.label]; }), 'in');
      var cw = num(35, 10, 100, 1, '70px'), chh = num(45, 10, 100, 1, '70px');
      var custom = field('Custom size', cw, 'mm wide ×'); chh.setAttribute('aria-label', 'Height in mm'); custom.appendChild(chh); custom.appendChild(el('span', 'u', 'mm high')); custom.hidden = true;
      function apply() {
        var p = PASS_SIZES.filter(function (x) { return x.id === s.value; })[0];
        o.size = s.value === 'custom' ? { id: 'custom', w: +cw.value || 35, h: +chh.value || 45 } : p;
        custom.hidden = s.value !== 'custom';
        if (o.stage) o.stage.setAspect(o.size.w / o.size.h);
      }
      s.onchange = apply; cw.oninput = apply; chh.oninput = apply;
      panel.appendChild(field('Size', s)); panel.appendChild(custom);
      var dpi = sel([['300', '300 dpi (print quality)'], ['600', '600 dpi'], ['200', '200 dpi (smaller file)']], '300'); dpi.onchange = function () { o.dpi = +dpi.value; };
      panel.appendChild(field('Resolution', dpi));
      var kb = num(0, 0, 5000, 5, '84px'); kb.oninput = function () { o.kb = +kb.value || 0; };
      panel.appendChild(field('Max file size', kb, 'KB · 0 = no limit (forms often want ≤ 50 KB)'));
      var sheet = check(true); sheet.onchange = function () { o.sheet = sheet.checked; };
      panel.appendChild(field('Also make a 4×6 inch print sheet with several copies', sheet));
      panel.appendChild(el('p', 'u t-note', 'Line the face up with the dotted guide: head roughly 70% of the frame height, eyes about a third from the top, looking straight ahead. The background is kept as it is — photograph against a plain light wall.'));
    },
    onFiles: function (files, o, stageBox) {
      return decode(files[0]).then(function (c) {
        o.src = c; stageBox.innerHTML = '';
        o.stage = CropStage(c, o.size.w / o.size.h, { headGuide: true, guides: false });
        stageBox.appendChild(o.stage.el); stageBox.hidden = false;
      });
    },
    run: function (files, o, prog) {
      var mmToPx = o.dpi / 25.4, W = Math.round(o.size.w * mmToPx), H = Math.round(o.size.h * mmToPx);
      var photo = o.stage.export(W, H), out = [];
      var one = o.kb ? compressToTarget(photo, o.kb * 1024, { mime: 'image/jpeg', keepSize: true, minQ: 0.4 }, prog).then(function (r) { return r.blob; }) : canvasToBlob(photo, 'image/jpeg', 0.92);
      return one.then(function (b) {
        out.push({ blob: b, name: 'passport-photo-' + o.size.w + 'x' + o.size.h + 'mm.jpg', src: files[0], note: W + '×' + H + ' px · ' + o.size.w + '×' + o.size.h + ' mm at ' + o.dpi + ' dpi · ' + F.bytes(b.size) });
        if (!o.sheet) return out;
        // 4×6 in (landscape) sheet, as many copies as fit with 2 mm gaps
        var sw = Math.round(6 * o.dpi), sh = Math.round(4 * o.dpi), gap = Math.round(2 * mmToPx);
        var cols = Math.floor((sw - gap) / (W + gap)), rows = Math.floor((sh - gap) / (H + gap));
        var sheet = K.canvasOf(sw, sh), g = sheet.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sw, sh);
        var x0 = Math.round((sw - (cols * W + (cols - 1) * gap)) / 2), y0 = Math.round((sh - (rows * H + (rows - 1) * gap)) / 2);
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) g.drawImage(photo, x0 + c * (W + gap), y0 + r * (H + gap), W, H);
        g.strokeStyle = '#bbb'; g.lineWidth = 1;
        for (var r2 = 0; r2 < rows; r2++) for (var c2 = 0; c2 < cols; c2++) g.strokeRect(x0 + c2 * (W + gap) + 0.5, y0 + r2 * (H + gap) + 0.5, W - 1, H - 1);
        return canvasToBlob(sheet, 'image/jpeg', 0.92).then(function (b2) {
          out.push({ blob: b2, name: 'passport-photo-sheet-4x6in.jpg', src: files[0], note: cols * rows + ' copies on a 4×6 in sheet · print at 100%, cut along the grey lines' });
          return out;
        });
      });
    }
  };

  // ---- resize image
  var SIZE_PRESETS = [
    { l: 'Instagram post 1080×1080', w: 1080, h: 1080 }, { l: 'Instagram story 1080×1920', w: 1080, h: 1920 },
    { l: 'YouTube thumbnail 1280×720', w: 1280, h: 720 }, { l: 'Full HD 1920×1080', w: 1920, h: 1080 },
    { l: 'Facebook cover 820×312', w: 820, h: 312 }, { l: 'LinkedIn profile 400×400', w: 400, h: 400 },
    { l: 'WhatsApp DP 500×500', w: 500, h: 500 }, { l: 'Twitter/X header 1500×500', w: 1500, h: 500 },
    { l: 'Passport 413×531 (35×45 mm)', w: 413, h: 531 }, { l: 'A4 at 150 dpi 1240×1754', w: 1240, h: 1754 }
  ];
  TOOLS['resize-image'] = {
    accept: 'image/*,.heic,.heif,.tif,.tiff,.avif', kinds: 'image', multiple: true, hint: 'Drop images here', label: 'Resize',
    setup: function (panel, o) {
      o.mode = 'px'; o.w = 1280; o.h = 0; o.pctv = 50; o.fit = 'fit'; o.fmt = 'same'; o.q = 0.9; o.rot = 0; o.flipH = false; o.lock = true;
      var mode = sel([['px', 'By pixels'], ['pct', 'By percentage'], ['preset', 'Preset size']], 'px');
      var w = num(1280, 1, 20000, 1, '92px'), h = num(0, 0, 20000, 1, '92px'), p = num(50, 1, 400, 1, '80px');
      var rowPx = field('Width', w, 'px'); h.id = 't-f-h'; var hl = el('label', null, 'Height'); hl.htmlFor = h.id; rowPx.appendChild(hl); rowPx.appendChild(h); rowPx.appendChild(el('span', 'u', 'px · 0 = keep proportions'));
      var rowPct = field('Scale', p, '% of the original'); rowPct.hidden = true;
      var presetSel = sel(SIZE_PRESETS.map(function (x, i) { return [String(i), x.l]; }), '0'); var rowPre = field('Preset', presetSel); rowPre.hidden = true;
      o.preset = 0;
      mode.onchange = function () { o.mode = mode.value; rowPx.hidden = o.mode !== 'px'; rowPct.hidden = o.mode !== 'pct'; rowPre.hidden = o.mode !== 'preset'; };
      w.oninput = function () { o.w = +w.value || 0; }; h.oninput = function () { o.h = +h.value || 0; }; p.oninput = function () { o.pctv = +p.value || 100; };
      presetSel.onchange = function () { o.preset = +presetSel.value; };
      panel.appendChild(field('Resize', mode)); panel.appendChild(rowPx); panel.appendChild(rowPct); panel.appendChild(rowPre);
      var fit = sel([['fit', 'Fit inside (keeps everything, may be smaller in one direction)'], ['fill', 'Fill exactly (crops the edges to the exact size)'], ['stretch', 'Stretch (distorts)']], 'fit');
      fit.onchange = function () { o.fit = fit.value; }; panel.appendChild(field('When both sizes are given', fit));
      var rot = sel([['0', 'None'], ['90', 'Rotate 90° right'], ['180', 'Rotate 180°'], ['270', 'Rotate 90° left']], '0'); rot.onchange = function () { o.rot = +rot.value; };
      var flip = check(false); flip.onchange = function () { o.flipH = flip.checked; };
      panel.appendChild(field('Rotate', rot)); panel.appendChild(field('Flip horizontally (mirror)', flip));
      var fmt = sel([['same', 'Same as the original'], ['jpeg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']], 'same'); fmt.onchange = function () { o.fmt = fmt.value; };
      var q = range(90, 50, 100, 1), qv = el('b', null, '90%'); q.oninput = function () { o.q = +q.value / 100; qv.textContent = q.value + '%'; };
      var qrow = field('Quality', q); qrow.appendChild(qv);
      panel.appendChild(field('Output', fmt)); panel.appendChild(qrow);
    },
    run: function (files, o, prog) {
      return files.reduce(function (chain, f, idx) {
        return chain.then(function (acc) {
          prog(idx / files.length, f.name);
          return decode(f).then(function (c) {
            if (o.rot || o.flipH) {
              var rw = o.rot % 180 ? c.height : c.width, rh = o.rot % 180 ? c.width : c.height;
              var rc = K.canvasOf(rw, rh), rg = rc.getContext('2d');
              rg.translate(rw / 2, rh / 2); rg.rotate(o.rot * Math.PI / 180); if (o.flipH) rg.scale(-1, 1); rg.drawImage(c, -c.width / 2, -c.height / 2); c = rc;
            }
            var tw, th, exact;
            if (o.mode === 'pct') { tw = Math.round(c.width * o.pctv / 100); th = Math.round(c.height * o.pctv / 100); }
            else if (o.mode === 'preset') { tw = SIZE_PRESETS[o.preset].w; th = SIZE_PRESETS[o.preset].h; }
            else { tw = o.w; th = o.h; if (!tw && !th) { tw = c.width; th = c.height; } if (!th) th = Math.round(c.height * tw / c.width); if (!tw) tw = Math.round(c.width * th / c.height); }
            exact = o.mode === 'preset' || (o.mode === 'px' && o.w && o.h);
            var out;
            if (exact) {
              if (o.fit === 'fit') { var k = Math.min(tw / c.width, th / c.height); out = scaleCanvas(c, Math.max(1, Math.round(c.width * k)), Math.max(1, Math.round(c.height * k))); }
              else if (o.fit === 'fill') { var s = Math.max(tw / c.width, th / c.height), cw = tw / s, ch = th / s; out = K.canvasOf(tw, th); var g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, 0, 0, tw, th); }
              else out = scaleCanvas(c, tw, th);
            } else out = scaleCanvas(c, Math.max(1, tw), Math.max(1, th));
            var e = ext(f) === 'jpeg' ? 'jpg' : ext(f);
            var fmt = o.fmt === 'same' ? (/^(jpg|png|webp)$/.test(e) ? e : (hasAlpha(out) ? 'png' : 'jpg')) : (o.fmt === 'jpeg' ? 'jpg' : o.fmt);
            var mime = fmt === 'jpg' ? 'image/jpeg' : 'image/' + fmt;
            if (mime === 'image/jpeg' && hasAlpha(out)) out = flatten(out, '#fff');
            return canvasToBlob(out, mime, mime === 'image/png' ? undefined : o.q).then(function (b) {
              acc.push({ blob: b, name: base(f.name) + '-' + out.width + 'x' + out.height + '.' + fmt, src: f, note: c.width + '×' + c.height + ' → ' + out.width + '×' + out.height + ' · ' + F.bytes(b.size) });
              return acc;
            });
          });
        });
      }, Promise.resolve([]));
    }
  };

  // ---- crop image
  TOOLS['crop-image'] = {
    accept: 'image/*,.heic,.heif,.tif,.tiff,.avif', kinds: 'image', multiple: false, hint: 'Drop an image here', label: 'Crop', stage: true,
    setup: function (panel, o) {
      o.aspect = 1; o.fmt = 'same'; o.q = 0.92; o.outW = 0;
      var asp = [{ value: 1, label: 'Square 1:1' }, { value: 4 / 3, label: '4:3' }, { value: 3 / 2, label: '3:2' }, { value: 16 / 9, label: '16:9' }, { value: 9 / 16, label: '9:16 (story)' }, { value: 3 / 4, label: '3:4' }, { value: 2 / 3, label: '2:3' }, { value: 35 / 45, label: '35:45 (passport)' }, { value: 0, label: 'Custom' }];
      var cw = num(4, 1, 100, 1, '64px'), ch = num(3, 1, 100, 1, '64px');
      var custom = field('Custom ratio', cw, ':'); ch.setAttribute('aria-label', 'Ratio height'); custom.appendChild(ch); custom.hidden = true;
      function setA(a) { o.aspect = a || ((+cw.value || 1) / (+ch.value || 1)); custom.hidden = !!a; if (o.stage) o.stage.setAspect(o.aspect); }
      panel.appendChild(chips(asp, 1, function (v) { setA(v); }));
      cw.oninput = function () { setA(0); }; ch.oninput = function () { setA(0); };
      panel.appendChild(custom);
      var ow = num(0, 0, 20000, 1, '92px'); ow.oninput = function () { o.outW = +ow.value || 0; };
      panel.appendChild(field('Output width', ow, 'px · 0 = keep the original pixels of the cropped area'));
      var fmt = sel([['same', 'Same as the original'], ['jpeg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']], 'same'); fmt.onchange = function () { o.fmt = fmt.value; };
      panel.appendChild(field('Output', fmt));
    },
    onFiles: function (files, o, stageBox) {
      return decode(files[0]).then(function (c) { o.src = c; stageBox.innerHTML = ''; o.stage = CropStage(c, o.aspect, { guides: true }); stageBox.appendChild(o.stage.el); stageBox.hidden = false; });
    },
    run: function (files, o) {
      var f = files[0], r = o.stage.region();
      var w = o.outW || Math.round(r.w), h = Math.round(w / o.aspect);
      var out = o.stage.export(w, h);
      var e = ext(f) === 'jpeg' ? 'jpg' : ext(f);
      var fmt = o.fmt === 'same' ? (/^(jpg|png|webp)$/.test(e) ? e : (hasAlpha(out) ? 'png' : 'jpg')) : (o.fmt === 'jpeg' ? 'jpg' : o.fmt);
      var mime = fmt === 'jpg' ? 'image/jpeg' : 'image/' + fmt;
      if (mime === 'image/jpeg' && hasAlpha(out)) out = flatten(out, '#fff');
      return canvasToBlob(out, mime, mime === 'image/png' ? undefined : o.q).then(function (b) { return [{ blob: b, name: base(f.name) + '-crop.' + fmt, src: f, note: w + '×' + h + ' · ' + F.bytes(b.size) }]; });
    }
  };

  // ---- merge PDF
  TOOLS['merge-pdf'] = {
    accept: '.pdf,application/pdf', kinds: 'pdf', multiple: true, hint: 'Drop two or more PDFs here — drag rows to set the order', label: 'Merge PDFs', orderable: true, min: 2,
    setup: function (panel, o) { panel.appendChild(el('p', 'u t-note', 'Files are joined in the order shown above. Use the arrows on each row to reorder.')); },
    run: function (files, o, prog) {
      return pdfLib().then(function (PL) {
        return PL.PDFDocument.create().then(function (out) {
          return files.reduce(function (chain, f, i) {
            return chain.then(function () {
              prog(i / files.length, f.name);
              return f.arrayBuffer().then(function (ab) { return PL.PDFDocument.load(ab, { ignoreEncryption: true }); })
                .then(function (src) { return out.copyPages(src, src.getPageIndices()); })
                .then(function (pages) { pages.forEach(function (p) { out.addPage(p); }); });
            });
          }, Promise.resolve()).then(function () { return out.save({ useObjectStreams: true }); });
        });
      }).then(function (u8) {
        var b = new Blob([u8], { type: 'application/pdf' });
        return [{ blob: b, name: 'merged.pdf', src: files[0], note: files.length + ' files → one PDF · ' + F.bytes(b.size) }];
      });
    }
  };

  // ---- split PDF
  TOOLS['split-pdf'] = {
    accept: '.pdf,application/pdf', kinds: 'pdf', multiple: false, hint: 'Drop a PDF here', label: 'Split PDF',
    setup: function (panel, o) {
      o.mode = 'each'; o.rangesStr = ''; o.every = 2; o.combine = false;
      var mode = sel([['each', 'Every page as its own PDF'], ['ranges', 'Page ranges I type'], ['every', 'Chunks of N pages']], 'each');
      var r = el('input'); r.type = 'text'; r.placeholder = 'e.g. 1-3, 5, 8-10'; r.style.width = '200px'; var rowR = field('Pages', r); rowR.hidden = true;
      var n = num(2, 1, 500, 1, '80px'); var rowN = field('Pages per file', n); rowN.hidden = true;
      var comb = check(false); var rowC = field('Put the chosen pages into one PDF instead of one file per range', comb); rowC.hidden = true;
      mode.onchange = function () { o.mode = mode.value; rowR.hidden = o.mode !== 'ranges'; rowC.hidden = o.mode !== 'ranges'; rowN.hidden = o.mode !== 'every'; };
      r.oninput = function () { o.rangesStr = r.value; }; n.oninput = function () { o.every = +n.value || 1; }; comb.onchange = function () { o.combine = comb.checked; };
      panel.appendChild(field('Split', mode)); panel.appendChild(rowR); panel.appendChild(rowC); panel.appendChild(rowN);
      panel.appendChild(el('p', 'u t-note', 'Several output files arrive together as a zip.'));
    },
    run: function (files, o, prog) {
      var f = files[0];
      return pdfLib().then(function (PL) {
        return f.arrayBuffer().then(function (ab) { return PL.PDFDocument.load(ab, { ignoreEncryption: true }); }).then(function (src) {
          var n = src.getPageCount(), groups = [];
          if (o.mode === 'each') for (var i = 0; i < n; i++) groups.push({ idx: [i], name: base(f.name) + '-page-' + (i + 1) + '.pdf' });
          else if (o.mode === 'every') for (var j = 0; j < n; j += o.every) { var idx = []; for (var k = j; k < Math.min(n, j + o.every); k++) idx.push(k); groups.push({ idx: idx, name: base(f.name) + '-pages-' + (j + 1) + '-' + Math.min(n, j + o.every) + '.pdf' }); }
          else {
            var parts = String(o.rangesStr).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            if (!parts.length) throw new Error('type the pages you want, e.g. 1-3, 5');
            if (o.combine) groups.push({ idx: ranges(o.rangesStr, n), name: base(f.name) + '-selected.pdf' });
            else parts.forEach(function (p) { var idx2 = ranges(p, n); if (idx2.length) groups.push({ idx: idx2, name: base(f.name) + '-' + p.replace(/\s+/g, '') + '.pdf' }); });
            if (!groups.length || !groups[0].idx.length) throw new Error('none of those pages exist — the file has ' + n + ' page' + (n === 1 ? '' : 's'));
          }
          return groups.reduce(function (chain, gp, gi) {
            return chain.then(function (acc) {
              prog(gi / groups.length, gp.name);
              return PL.PDFDocument.create().then(function (out) {
                return out.copyPages(src, gp.idx).then(function (pages) { pages.forEach(function (p) { out.addPage(p); }); return out.save({ useObjectStreams: true }); });
              }).then(function (u8) { acc.push({ blob: new Blob([u8], { type: 'application/pdf' }), name: gp.name, src: f, note: gp.idx.length + ' page' + (gp.idx.length === 1 ? '' : 's') }); return acc; });
            });
          }, Promise.resolve([]));
        });
      });
    }
  };

  // ---- rotate PDF
  TOOLS['rotate-pdf'] = {
    accept: '.pdf,application/pdf', kinds: 'pdf', multiple: true, hint: 'Drop PDF files here', label: 'Rotate PDF',
    setup: function (panel, o) {
      o.deg = 90; o.pages = '';
      panel.appendChild(chips([{ value: 90, label: '90° right' }, { value: 180, label: '180°' }, { value: 270, label: '90° left' }], 90, function (v) { o.deg = v; }));
      var r = el('input'); r.type = 'text'; r.placeholder = 'all pages'; r.style.width = '180px'; r.oninput = function () { o.pages = r.value; };
      panel.appendChild(field('Only pages', r, 'e.g. 2, 5-7 · empty = every page'));
    },
    run: function (files, o, prog) {
      return pdfLib().then(function (PL) {
        return files.reduce(function (chain, f, i) {
          return chain.then(function (acc) {
            prog(i / files.length, f.name);
            return f.arrayBuffer().then(function (ab) { return PL.PDFDocument.load(ab, { ignoreEncryption: true }); }).then(function (doc) {
              var n = doc.getPageCount(), which = o.pages.trim() ? ranges(o.pages, n) : doc.getPageIndices();
              which.forEach(function (i2) { var p = doc.getPage(i2); p.setRotation(PL.degrees((p.getRotation().angle + o.deg) % 360)); });
              return doc.save({ useObjectStreams: true }).then(function (u8) { acc.push({ blob: new Blob([u8], { type: 'application/pdf' }), name: base(f.name) + '-rotated.pdf', src: f, note: which.length + ' of ' + n + ' pages rotated ' + o.deg + '°' }); return acc; });
            });
          });
        }, Promise.resolve([]));
      });
    }
  };

  // ---- organise PDF: reorder, rotate and delete pages by thumbnail
  TOOLS['organize-pdf'] = {
    accept: '.pdf,application/pdf', kinds: 'pdf', multiple: false, hint: 'Drop a PDF here', label: 'Save the new PDF', stage: true,
    setup: function (panel, o) { panel.appendChild(el('p', 'u t-note', 'Move pages with the arrows, rotate them, or cross them out to delete. Nothing changes until you press the button.')); },
    onFiles: function (files, o, stageBox) {
      stageBox.innerHTML = ''; stageBox.hidden = false;
      var grid = el('div', 't-pages'); stageBox.appendChild(el('p', 'u', 'Rendering pages…')); stageBox.appendChild(grid);
      return pdfDoc(files[0]).then(function (doc) {
        o.order = []; o.doc = doc;
        var n = doc.numPages, chain = Promise.resolve();
        for (var i = 0; i < n; i++) (function (i) {
          chain = chain.then(function () {
            return renderPage(doc, i, 0.35).then(function (pg) {
              var item = { idx: i, rot: 0, del: false, canvas: pg.canvas };
              o.order.push(item); paint();
            });
          });
        })(i);
        function paint() {
          grid.innerHTML = '';
          o.order.forEach(function (it, pos) {
            var card = el('div', 't-page' + (it.del ? ' del' : ''));
            var th = el('div', 't-page-th'); th.appendChild(it.canvas); it.canvas.style.transform = 'rotate(' + it.rot + 'deg)'; card.appendChild(th);
            card.appendChild(el('div', 't-page-n', 'Page ' + (it.idx + 1)));
            var acts = el('div', 't-page-acts');
            var left = btn('', 'sm icon'); left.appendChild(el('span', null, '←')); left.title = 'Move left'; left.disabled = pos === 0; left.onclick = function () { o.order.splice(pos, 1); o.order.splice(pos - 1, 0, it); paint(); };
            var rot = btn('', 'sm icon'); rot.appendChild(el('span', null, '⟳')); rot.title = 'Rotate'; rot.onclick = function () { it.rot = (it.rot + 90) % 360; paint(); };
            var del = btn('', 'sm icon'); del.appendChild(el('span', null, it.del ? '↺' : '✕')); del.title = it.del ? 'Keep' : 'Delete'; del.onclick = function () { it.del = !it.del; paint(); };
            var right = btn('', 'sm icon'); right.appendChild(el('span', null, '→')); right.title = 'Move right'; right.disabled = pos === o.order.length - 1; right.onclick = function () { o.order.splice(pos, 1); o.order.splice(pos + 1, 0, it); paint(); };
            [left, rot, del, right].forEach(function (b) { acts.appendChild(b); });
            card.appendChild(acts); grid.appendChild(card);
          });
          stageBox.firstChild.textContent = o.order.length + ' of ' + n + ' pages loaded' + (o.order.length === n ? '' : '…');
        }
        return chain;
      });
    },
    run: function (files, o, prog) {
      var f = files[0], keep = o.order.filter(function (it) { return !it.del; });
      if (!keep.length) return Promise.reject(new Error('every page is deleted — keep at least one'));
      return pdfLib().then(function (PL) {
        return f.arrayBuffer().then(function (ab) { return PL.PDFDocument.load(ab, { ignoreEncryption: true }); }).then(function (src) {
          return PL.PDFDocument.create().then(function (out) {
            return out.copyPages(src, keep.map(function (it) { return it.idx; })).then(function (pages) {
              pages.forEach(function (p, i) { if (keep[i].rot) p.setRotation(PL.degrees((p.getRotation().angle + keep[i].rot) % 360)); out.addPage(p); });
              return out.save({ useObjectStreams: true });
            });
          });
        }).then(function (u8) { return [{ blob: new Blob([u8], { type: 'application/pdf' }), name: base(f.name) + '-organised.pdf', src: f, note: keep.length + ' pages kept of ' + o.order.length }]; });
      });
    }
  };
  TOOLS['delete-pdf-pages'] = TOOLS['organize-pdf'];

  // ---- images to one PDF
  TOOLS['images-to-pdf'] = {
    accept: 'image/*,.heic,.heif,.tif,.tiff,.avif', kinds: 'image', multiple: true, hint: 'Drop images here — one page each, in this order', label: 'Make PDF', orderable: true,
    setup: function (panel, o) {
      o.page = 'a4'; o.margin = 10; o.fitMode = 'fit'; o.q = 0.9;
      var pg = sel([['a4', 'A4'], ['letter', 'Letter'], ['fit', 'Same size as each image']], 'a4'); pg.onchange = function () { o.page = pg.value; };
      var m = num(10, 0, 50, 1, '72px'); m.oninput = function () { o.margin = +m.value || 0; };
      var q = range(90, 50, 100, 1), qv = el('b', null, '90%'); q.oninput = function () { o.q = +q.value / 100; qv.textContent = q.value + '%'; };
      var qrow = field('JPEG quality', q); qrow.appendChild(qv);
      panel.appendChild(field('Page size', pg)); panel.appendChild(field('Margin', m, 'mm')); panel.appendChild(qrow);
    },
    run: function (files, o, prog) {
      return need('jspdf').then(function (m) {
        var jsPDF = m.jsPDF, pdf = null;
        return files.reduce(function (chain, f, i) {
          return chain.then(function () {
            prog(i / files.length, f.name);
            return decode(f).then(function (c) {
              var flat = flatten(c, '#fff'), img = flat.toDataURL('image/jpeg', o.q);
              var landscape = c.width > c.height;
              var pw, ph;
              if (o.page === 'fit') { pw = c.width * 0.264583; ph = c.height * 0.264583; }          // px at 96 dpi → mm
              else { var sz = o.page === 'a4' ? [210, 297] : [215.9, 279.4]; pw = landscape ? sz[1] : sz[0]; ph = landscape ? sz[0] : sz[1]; }
              if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: pw > ph ? 'l' : 'p', compress: true }); else pdf.addPage([pw, ph], pw > ph ? 'l' : 'p');
              var mg = o.page === 'fit' ? 0 : o.margin, aw = pw - mg * 2, ah = ph - mg * 2;
              var k = Math.min(aw / c.width, ah / c.height), w = c.width * k, h = c.height * k;
              pdf.addImage(img, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST');
            });
          });
        }, Promise.resolve()).then(function () {
          var b = pdf.output('blob');
          return [{ blob: b, name: (files.length === 1 ? base(files[0].name) : 'images') + '.pdf', src: files[0], note: files.length + ' page' + (files.length === 1 ? '' : 's') + ' · ' + F.bytes(b.size) }];
        });
      });
    }
  };

  // ---- image / PDF to text (OCR)
  var OCR_LANGS = [['eng', 'English'], ['hin', 'Hindi (हिन्दी)'], ['eng+hin', 'English + Hindi'], ['mar', 'Marathi'], ['ben', 'Bengali'], ['tam', 'Tamil'], ['tel', 'Telugu'], ['guj', 'Gujarati'], ['kan', 'Kannada'], ['mal', 'Malayalam'], ['pan', 'Punjabi'], ['urd', 'Urdu'], ['ara', 'Arabic'], ['spa', 'Spanish'], ['fra', 'French'], ['deu', 'German'], ['por', 'Portuguese'], ['rus', 'Russian'], ['chi_sim', 'Chinese (simplified)'], ['jpn', 'Japanese']];
  TOOLS['image-to-text'] = {
    accept: 'image/*,.pdf,.heic,.heif,.tif,.tiff', kinds: 'ocr', multiple: true, hint: 'Drop images or scanned PDFs here', label: 'Read the text',
    setup: function (panel, o) {
      o.lang = 'eng';
      var l = sel(OCR_LANGS, 'eng'); l.onchange = function () { o.lang = l.value; };
      panel.appendChild(field('Language', l));
      panel.appendChild(el('p', 'u t-note', 'The first run downloads the recognition engine (about 4 MB) and a language file (2–15 MB) into your browser; after that it is cached. The text is read on your device — the image is never uploaded. Clear, straight, well-lit pictures read best.'));
    },
    run: function (files, o, prog) {
      return need('tesseract').then(function (T) {
        var worker;
        return T.createWorker(o.lang, 1, { logger: function (m) { if (m.status && typeof m.progress === 'number') prog(null, m.status.replace(/_/g, ' ') + ' ' + Math.round(m.progress * 100) + '%'); } })
          .then(function (w) { worker = w; })
          .then(function () {
            return files.reduce(function (chain, f, i) {
              return chain.then(function (acc) {
                var pieces = [];
                var pages = isPdf(f) ? pdfDoc(f).then(function (doc) {
                  var n = Math.min(doc.numPages, 50), ch2 = Promise.resolve();
                  for (var p = 0; p < n; p++) (function (p) { ch2 = ch2.then(function () { return renderPage(doc, p, 2).then(function (pg) { pieces.push({ canvas: pg.canvas, label: 'page ' + (p + 1) }); }); }); })(p);
                  return ch2;
                }) : decode(f).then(function (c) { pieces.push({ canvas: c, label: f.name }); });
                return pages.then(function () {
                  return pieces.reduce(function (ch3, pc, k) {
                    return ch3.then(function (text) {
                      prog((i + k / pieces.length) / files.length, 'reading ' + pc.label);
                      return worker.recognize(pc.canvas).then(function (r) { return text + (pieces.length > 1 ? '\n\n--- ' + pc.label + ' ---\n\n' : '') + (r.data.text || '').trim(); });
                    });
                  }, Promise.resolve(''));
                }).then(function (text) {
                  var b = new Blob([text.trim() + '\n'], { type: 'text/plain' });
                  acc.push({ blob: b, name: base(f.name) + '.txt', src: f, note: (text.trim().split(/\s+/).filter(Boolean).length) + ' words', text: text.trim() });
                  return acc;
                });
              });
            }, Promise.resolve([]));
          }).then(function (acc) { return worker.terminate().then(function () { return acc; }, function () { return acc; }); },
                  function (e) { if (worker) worker.terminate(); throw e; });
      });
    }
  };
  TOOLS['pdf-ocr'] = TOOLS['image-to-text'];

  // ---- trim video
  TOOLS['trim-video'] = {
    accept: 'video/*,.mp4,.mov,.webm,.m4v,.mkv', kinds: 'video', multiple: false, hint: 'Drop a video here', label: 'Trim & save', stage: true,
    setup: function (panel, o) {
      o.start = 0; o.end = 0; o.fmt = 'mp4'; o.width = 0; o.mute = false; o.q = 0.85;
      var fmt = sel([['mp4', 'MP4 (H.264) — plays everywhere'], ['webm', 'WebM (VP9)']], 'mp4'); fmt.onchange = function () { o.fmt = fmt.value; };
      var w = sel([['0', 'Keep the original'], ['1920', '1080p'], ['1280', '720p'], ['854', '480p']], '0'); w.onchange = function () { o.width = +w.value; };
      var mute = check(false); mute.onchange = function () { o.mute = mute.checked; };
      var q = range(85, 50, 100, 1), qv = el('b', null, '85%'); q.oninput = function () { o.q = +q.value / 100; qv.textContent = q.value + '%'; }; var qrow = field('Quality', q); qrow.appendChild(qv);
      panel.appendChild(field('Save as', fmt)); panel.appendChild(field('Size', w)); panel.appendChild(qrow); panel.appendChild(field('Remove the sound', mute));
      panel.appendChild(el('p', 'u t-note', 'The clip is re-encoded frame by frame on your device, so a long selection takes about as long as it lasts. Keep this tab in front while it works.'));
    },
    onFiles: function (files, o, stageBox) {
      stageBox.innerHTML = ''; stageBox.hidden = false;
      var v = el('video', 't-video'); v.controls = true; v.playsInline = true; v.src = URL.createObjectURL(files[0]); stageBox.appendChild(v);
      var row = el('div', 't-trim');
      var s = el('input'); s.type = 'text'; s.value = '0:00.0'; s.style.width = '84px';
      var e = el('input'); e.type = 'text'; e.value = '0:00.0'; e.style.width = '84px';
      var setS = btn('Start here', 'sm'), setE = btn('End here', 'sm'), prev = btn('Play selection', 'sm', 'bolt');
      s.setAttribute('aria-label', 'Start time'); e.setAttribute('aria-label', 'End time');
      row.appendChild(el('label', null, 'From')); row.appendChild(s); row.appendChild(setS);
      row.appendChild(el('label', null, 'To')); row.appendChild(e); row.appendChild(setE); row.appendChild(prev);
      var len = el('span', 'u', ''); row.appendChild(len);
      stageBox.appendChild(row);
      function sync() { o.start = parseTime(s.value); o.end = parseTime(e.value); len.textContent = 'selection ' + fmtTime(Math.max(0, o.end - o.start)); }
      v.onloadedmetadata = function () { K.trueDuration(v, files[0]).then(function (d) { e.value = fmtTime(d); sync(); }); };
      s.onchange = sync; e.onchange = sync;
      setS.onclick = function () { s.value = fmtTime(v.currentTime); sync(); };
      setE.onclick = function () { e.value = fmtTime(v.currentTime); sync(); };
      prev.onclick = function () { sync(); v.currentTime = o.start; v.play(); var stop = function () { if (v.currentTime >= o.end) { v.pause(); v.removeEventListener('timeupdate', stop); } }; v.addEventListener('timeupdate', stop); };
      return Promise.resolve();
    },
    run: function (files, o, prog) {
      if (o.end <= o.start) return Promise.reject(new Error('set an end time after the start'));
      var ctx = { file: files[0], from: ext(files[0]), to: o.fmt, opts: { start: o.start, end: o.end, width: o.width || 0, quality: o.q, mute: o.mute }, log: function (m) { prog(null, m); }, progress: prog };
      return K.transcodeVideo(ctx, o.fmt).then(function (b) { return [{ blob: b, name: base(files[0].name) + '-trim.' + o.fmt, src: files[0], note: fmtTime(o.start) + ' → ' + fmtTime(o.end) + ' · ' + F.bytes(b.size) }]; });
    }
  };

  // ---- cut audio / ringtone
  TOOLS['mp3-cutter'] = {
    accept: 'audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac,video/*', kinds: 'audio', multiple: false, hint: 'Drop an audio (or video) file here', label: 'Cut & save', stage: true,
    setup: function (panel, o) {
      o.start = 0; o.end = 0; o.fmt = 'mp3'; o.kbps = 192; o.fadeIn = 0; o.fadeOut = 0;
      var fmt = sel([['mp3', 'MP3'], ['wav', 'WAV (uncompressed)']], 'mp3'); fmt.onchange = function () { o.fmt = fmt.value; };
      var kb = sel([['128', '128 kbps'], ['192', '192 kbps'], ['256', '256 kbps'], ['320', '320 kbps']], '192'); kb.onchange = function () { o.kbps = +kb.value; };
      var fi = num(0, 0, 10, 0.5, '70px'), fo = num(0, 0, 10, 0.5, '70px'); fi.oninput = function () { o.fadeIn = +fi.value || 0; }; fo.oninput = function () { o.fadeOut = +fo.value || 0; };
      panel.appendChild(field('Save as', fmt)); panel.appendChild(field('Bitrate', kb)); panel.appendChild(field('Fade in', fi, 's')); panel.appendChild(field('Fade out', fo, 's'));
      panel.appendChild(el('p', 'u t-note', 'Ringtones: Android takes MP3 directly. iPhone wants a 30-second-or-shorter clip added through iTunes/Finder or GarageBand.'));
    },
    onFiles: function (files, o, stageBox) {
      stageBox.innerHTML = ''; stageBox.hidden = false;
      var note = el('p', 'u', 'Decoding…'); stageBox.appendChild(note);
      return K.decodeAudio(files[0]).then(function (buf) {
        o.buf = buf; o.end = buf.duration; note.remove();
        var W = 560, H = 120, cv = el('canvas', 't-wave'); cv.width = W; cv.height = H; stageBox.appendChild(cv);
        var g = cv.getContext('2d'), d = buf.getChannelData(0), per = Math.ceil(d.length / W), peaks = [];
        for (var x = 0; x < W; x++) { var mx = 0; for (var i = x * per; i < Math.min(d.length, (x + 1) * per); i += 4) { var a = Math.abs(d[i]); if (a > mx) mx = a; } peaks.push(mx); }
        function draw() {
          g.clearRect(0, 0, W, H); g.fillStyle = '#0b0f14'; g.fillRect(0, 0, W, H);
          var x0 = o.start / buf.duration * W, x1 = o.end / buf.duration * W;
          g.fillStyle = 'rgba(14,124,134,.25)'; g.fillRect(x0, 0, x1 - x0, H);
          for (var x = 0; x < W; x++) { g.fillStyle = (x >= x0 && x <= x1) ? '#2fd0dc' : '#3a4654'; var h = Math.max(1, peaks[x] * (H - 8)); g.fillRect(x, (H - h) / 2, 1, h); }
          g.fillStyle = '#ffd24d'; g.fillRect(x0 - 1, 0, 2, H); g.fillRect(x1 - 1, 0, 2, H);
        }
        var drag = null;
        cv.style.touchAction = 'none';
        cv.addEventListener('pointerdown', function (e) { var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; var x0 = o.start / buf.duration * W, x1 = o.end / buf.duration * W; drag = Math.abs(x - x0) < Math.abs(x - x1) ? 'start' : 'end'; cv.setPointerCapture(e.pointerId); move(e); });
        function move(e) { if (!drag) return; var r = cv.getBoundingClientRect(), t = clamp((e.clientX - r.left) / r.width, 0, 1) * buf.duration; if (drag === 'start') o.start = Math.min(t, o.end - 0.1); else o.end = Math.max(t, o.start + 0.1); s.value = fmtTime(o.start); en.value = fmtTime(o.end); draw(); len.textContent = 'selection ' + fmtTime(o.end - o.start); }
        cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', function () { drag = null; }); cv.addEventListener('pointercancel', function () { drag = null; });
        var row = el('div', 't-trim');
        var s = el('input'); s.type = 'text'; s.value = '0:00.0'; s.style.width = '84px';
        var en = el('input'); en.type = 'text'; en.value = fmtTime(buf.duration); en.style.width = '84px';
        var play = btn('Play selection', 'sm', 'bolt'), stop = btn('Stop', 'sm'), ring = btn('30 s ringtone from start', 'sm');
        var len = el('span', 'u', 'selection ' + fmtTime(buf.duration));
        s.setAttribute('aria-label', 'Start time'); en.setAttribute('aria-label', 'End time');
        row.appendChild(el('label', null, 'From')); row.appendChild(s); row.appendChild(el('label', null, 'To')); row.appendChild(en); row.appendChild(play); row.appendChild(stop); row.appendChild(ring); row.appendChild(len);
        stageBox.appendChild(row);
        function sync() { o.start = clamp(parseTime(s.value), 0, buf.duration); o.end = clamp(parseTime(en.value), o.start + 0.1, buf.duration); draw(); len.textContent = 'selection ' + fmtTime(o.end - o.start); }
        s.onchange = sync; en.onchange = sync;
        ring.onclick = function () { o.end = Math.min(buf.duration, o.start + 30); en.value = fmtTime(o.end); sync(); };
        var ac = null, srcNode = null;
        play.onclick = function () { sync(); var AC = root.AudioContext || root.webkitAudioContext; ac = ac || new AC(); if (srcNode) { try { srcNode.stop(); } catch (e) {} } srcNode = ac.createBufferSource(); srcNode.buffer = buf; srcNode.connect(ac.destination); srcNode.start(0, o.start, o.end - o.start); };
        stop.onclick = function () { if (srcNode) { try { srcNode.stop(); } catch (e) {} } };
        draw();
      });
    },
    run: function (files, o, prog) {
      var cut = K.sliceBuffer(o.buf, o.start, o.end);
      if (o.fadeIn || o.fadeOut) {
        var AC = root.OfflineAudioContext || root.webkitOfflineAudioContext, oc = new AC(cut.numberOfChannels, cut.length, cut.sampleRate);
        var copy = oc.createBuffer(cut.numberOfChannels, cut.length, cut.sampleRate);
        for (var c = 0; c < cut.numberOfChannels; c++) {
          var d = new Float32Array(cut.getChannelData(c)), n = d.length, fi = Math.min(n, Math.round(o.fadeIn * cut.sampleRate)), fo = Math.min(n, Math.round(o.fadeOut * cut.sampleRate));
          for (var i = 0; i < fi; i++) d[i] *= i / fi;
          for (var j = 0; j < fo; j++) d[n - 1 - j] *= j / fo;
          copy.copyToChannel(d, c);
        }
        cut = copy;
      }
      var job = o.fmt === 'wav' ? Promise.resolve(K.bufferToWav(cut)) : K.bufferToMp3(cut, o.kbps, function (m) { prog(null, m); });
      return job.then(function (b) { return [{ blob: b, name: base(files[0].name) + '-cut.' + o.fmt, src: files[0], note: fmtTime(o.start) + ' → ' + fmtTime(o.end) + ' · ' + F.bytes(b.size) }]; });
    }
  };
  TOOLS['ringtone-maker'] = TOOLS['mp3-cutter'];

  // ---- view & remove metadata
  TOOLS['remove-exif'] = {
    accept: 'image/*,.heic,.heif,.tif,.tiff', kinds: 'image', multiple: true, hint: 'Drop photos here', label: 'Remove metadata & save', stage: true,
    setup: function (panel, o) {
      panel.appendChild(el('p', 'u t-note', 'JPEG, PNG and WebP are cleaned without re-encoding, so the picture itself is untouched. Other formats are re-saved as JPEG. Colour profiles are kept so colours do not shift.'));
    },
    onFiles: function (files, o, stageBox) {
      stageBox.innerHTML = ''; stageBox.hidden = false;
      return need('exifr').then(function (exifr) {
        return files.reduce(function (chain, f) {
          return chain.then(function () {
            return exifr.parse(f, { tiff: true, xmp: true, iptc: true, gps: true, icc: false, interop: false, ifd1: false, mergeOutput: true }).then(function (m) { return m || {}; }, function () { return {}; }).then(function (m) {
              var card = el('div', 't-meta'); card.appendChild(el('h4', null, f.name));
              var keys = Object.keys(m);
              if (!keys.length) { card.appendChild(el('p', 'u', 'No metadata found — nothing to remove.')); stageBox.appendChild(card); return; }
              var tbl = el('table', 't-meta-table');
              var show = [['Make', 'Camera make'], ['Model', 'Camera model'], ['LensModel', 'Lens'], ['DateTimeOriginal', 'Taken'], ['CreateDate', 'Created'], ['Software', 'Software'], ['Artist', 'Artist'], ['Copyright', 'Copyright'], ['ExposureTime', 'Exposure'], ['FNumber', 'Aperture'], ['ISO', 'ISO'], ['FocalLength', 'Focal length'], ['Orientation', 'Orientation'], ['ImageDescription', 'Description']];
              show.forEach(function (k) { if (m[k[0]] !== undefined) { var tr = el('tr'); tr.appendChild(el('th', null, k[1])); var v = m[k[0]]; tr.appendChild(el('td', null, v instanceof Date ? v.toLocaleString() : String(v))); tbl.appendChild(tr); } });
              if (typeof m.latitude === 'number') {
                var tr2 = el('tr', 'gps'); tr2.appendChild(el('th', null, 'GPS location')); var td = el('td'); var a = el('a', null, m.latitude.toFixed(5) + ', ' + m.longitude.toFixed(5) + ' — this photo reveals where it was taken'); a.href = 'https://www.openstreetmap.org/?mlat=' + m.latitude + '&mlon=' + m.longitude + '#map=15/' + m.latitude + '/' + m.longitude; a.target = '_blank'; a.rel = 'noopener'; td.appendChild(a); tr2.appendChild(td); tbl.appendChild(tr2);
              }
              card.appendChild(tbl); card.appendChild(el('p', 'u', keys.length + ' metadata fields in total'));
              stageBox.appendChild(card);
              o.orient = o.orient || {}; o.orient[f.name] = m.Orientation;
            });
          });
        }, Promise.resolve());
      });
    },
    run: function (files, o, prog) {
      return files.reduce(function (chain, f, i) {
        return chain.then(function (acc) {
          prog(i / files.length, f.name);
          var e = ext(f) === 'jpeg' ? 'jpg' : ext(f), orient = o.orient && o.orient[f.name];
          var rotated = typeof orient === 'number' ? orient > 1 : typeof orient === 'string' && !/^Horizontal \(normal\)$/i.test(orient);
          var job;
          if (e === 'jpg' && !rotated) job = f.arrayBuffer().then(function (ab) { return { blob: stripJpeg(new Uint8Array(ab)), name: base(f.name) + '-clean.jpg', how: 'lossless' }; });
          else if (e === 'png') job = f.arrayBuffer().then(function (ab) { return { blob: stripPng(new Uint8Array(ab)), name: base(f.name) + '-clean.png', how: 'lossless' }; });
          else if (e === 'webp') job = f.arrayBuffer().then(function (ab) { return { blob: stripWebp(new Uint8Array(ab)), name: base(f.name) + '-clean.webp', how: 'lossless' }; });
          else job = decode(f).then(function (c) { return canvasToBlob(hasAlpha(c) ? c : flatten(c), hasAlpha(c) ? 'image/png' : 'image/jpeg', 0.95).then(function (b) { return { blob: b, name: base(f.name) + '-clean.' + (b.type === 'image/png' ? 'png' : 'jpg'), how: rotated ? 're-saved so the rotation stays correct without the orientation tag' : 're-saved as ' + (b.type === 'image/png' ? 'PNG' : 'JPEG') }; }); });
          return job.then(function (r) { acc.push({ blob: r.blob, name: r.name, src: f, note: F.bytes(f.size) + ' → ' + F.bytes(r.blob.size) + ' · ' + r.how }); return acc; });
        });
      }, Promise.resolve([]));
    }
  };
  TOOLS['view-metadata'] = TOOLS['remove-exif'];

  // ---- QR code generator (no file input)
  TOOLS['qr-code-generator'] = {
    nofile: true, label: 'Download PNG',
    setup: function (panel, o, stageBox) {
      o.kind = 'url'; o.size = 512; o.ecl = 'M'; o.fg = '#000000'; o.bg = '#ffffff'; o.margin = 2;
      var kinds = [{ value: 'url', label: 'Link / text' }, { value: 'upi', label: 'UPI payment' }, { value: 'wifi', label: 'Wi‑Fi' }, { value: 'vcard', label: 'Contact card' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'sms', label: 'SMS' }];
      var forms = {}, holder = el('div', 't-qr-forms');
      function text(ph, w) { var i = el('input'); i.type = 'text'; i.placeholder = ph; i.style.width = w || '260px'; i.oninput = render; return i; }
      forms.url = { text: text('https://example.com or any text', '340px') };
      forms.upi = { pa: text('UPI ID, e.g. name@bank'), pn: text('Payee name'), am: text('Amount (optional)', '120px'), tn: text('Note (optional)') };
      forms.wifi = { ssid: text('Network name (SSID)'), pass: text('Password'), type: sel([['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'No password']], 'WPA'), hidden: check(false) };
      forms.vcard = { n: text('Full name'), org: text('Company (optional)'), tel: text('Phone'), email: text('Email'), url: text('Website (optional)') };
      forms.email = { to: text('Email address'), sub: text('Subject (optional)'), body: text('Message (optional)', '340px') };
      forms.phone = { tel: text('Phone number, e.g. +91 98765 43210') };
      forms.sms = { tel: text('Phone number'), body: text('Message', '340px') };
      Object.keys(forms).forEach(function (k) { Object.keys(forms[k]).forEach(function (f) { var i = forms[k][f]; if (i.tagName === 'SELECT' || i.type === 'checkbox') i.onchange = render; }); });
      var labels = { pa: 'UPI ID', pn: 'Name', am: 'Amount ₹', tn: 'Note', ssid: 'Network', pass: 'Password', type: 'Security', hidden: 'Hidden network', n: 'Name', org: 'Company', tel: 'Phone', email: 'Email', url: 'Website', to: 'To', sub: 'Subject', body: 'Message', text: 'Content' };
      function showForm() {
        holder.innerHTML = '';
        Object.keys(forms[o.kind]).forEach(function (f) { holder.appendChild(field(labels[f] || f, forms[o.kind][f])); });
        render();
      }
      panel.appendChild(chips(kinds, 'url', function (v) { o.kind = v; showForm(); }));
      panel.appendChild(holder);
      var size = sel([['256', '256 px'], ['512', '512 px'], ['1024', '1024 px'], ['2048', '2048 px (print)']], '512'); size.onchange = function () { o.size = +size.value; render(); };
      var ecl = sel([['L', 'L — smallest'], ['M', 'M — standard'], ['Q', 'Q'], ['H', 'H — survives damage / logos']], 'M'); ecl.onchange = function () { o.ecl = ecl.value; render(); };
      var fg = el('input'); fg.type = 'color'; fg.value = '#000000'; fg.oninput = function () { o.fg = fg.value; render(); };
      var bg = el('input'); bg.type = 'color'; bg.value = '#ffffff'; bg.oninput = function () { o.bg = bg.value; render(); };
      var opts = el('div', 'opts'); opts.appendChild(field('Size', size)); opts.appendChild(field('Error correction', ecl)); opts.appendChild(field('Colour', fg)); opts.appendChild(field('Background', bg));
      panel.appendChild(opts);
      var preview = el('div', 't-qr-preview'); var pc = el('canvas'); preview.appendChild(pc); var pmsg = el('p', 'u', 'Type something to see the code'); preview.appendChild(pmsg);
      var svgBtn = btn('Download SVG', 'sm', 'download'); svgBtn.onclick = function () { var v = payload(); if (!v) return; need('qrcode').then(function (Q) { Q.toString(v, { type: 'svg', errorCorrectionLevel: o.ecl, margin: o.margin, color: { dark: o.fg, light: o.bg } }, function (err, str) { if (!err) download(new Blob([str], { type: 'image/svg+xml' }), 'qr-code.svg'); }); }); };
      preview.appendChild(svgBtn);
      stageBox.appendChild(preview); stageBox.hidden = false;
      function esc(s) { return String(s || '').replace(/([\\;,:"])/g, '\\$1'); }
      function payload() {
        var f = forms[o.kind], v = function (k) { return (f[k].value || '').trim(); };
        if (o.kind === 'url') return v('text');
        if (o.kind === 'upi') { if (!v('pa')) return ''; var q = 'upi://pay?pa=' + encodeURIComponent(v('pa')) + '&pn=' + encodeURIComponent(v('pn') || 'Payee') + '&cu=INR'; if (v('am')) q += '&am=' + encodeURIComponent(v('am')); if (v('tn')) q += '&tn=' + encodeURIComponent(v('tn')); return q; }
        if (o.kind === 'wifi') { if (!v('ssid')) return ''; return 'WIFI:T:' + f.type.value + ';S:' + esc(v('ssid')) + ';' + (f.type.value === 'nopass' ? '' : 'P:' + esc(v('pass')) + ';') + (f.hidden.checked ? 'H:true;' : '') + ';'; }
        if (o.kind === 'vcard') { if (!v('n')) return ''; return 'BEGIN:VCARD\nVERSION:3.0\nN:' + v('n') + '\nFN:' + v('n') + (v('org') ? '\nORG:' + v('org') : '') + (v('tel') ? '\nTEL;TYPE=CELL:' + v('tel') : '') + (v('email') ? '\nEMAIL:' + v('email') : '') + (v('url') ? '\nURL:' + v('url') : '') + '\nEND:VCARD'; }
        if (o.kind === 'email') { if (!v('to')) return ''; return 'mailto:' + v('to') + (v('sub') || v('body') ? '?' + (v('sub') ? 'subject=' + encodeURIComponent(v('sub')) : '') + (v('sub') && v('body') ? '&' : '') + (v('body') ? 'body=' + encodeURIComponent(v('body')) : '') : ''); }
        if (o.kind === 'phone') return v('tel') ? 'tel:' + v('tel').replace(/\s+/g, '') : '';
        if (o.kind === 'sms') return v('tel') ? 'SMSTO:' + v('tel').replace(/\s+/g, '') + ':' + v('body') : '';
        return '';
      }
      o.payload = payload;
      function render() {
        var v = payload();
        if (!v) { pc.width = pc.height = 0; pmsg.textContent = 'Type something to see the code'; return; }
        need('qrcode').then(function (Q) {
          Q.toCanvas(pc, v, { width: Math.min(320, o.size), errorCorrectionLevel: o.ecl, margin: o.margin, color: { dark: o.fg, light: o.bg } }, function (err) { pmsg.textContent = err ? String(err.message || err) : (v.length + ' characters · scan to test'); });
        }, function (e) { pmsg.textContent = e.message; });
      }
      showForm();
    },
    run: function (files, o) {
      var v = o.payload();
      if (!v) return Promise.reject(new Error('fill in the code first'));
      return need('qrcode').then(function (Q) {
        var c = K.canvasOf(o.size, o.size);
        return new Promise(function (res, rej) { Q.toCanvas(c, v, { width: o.size, errorCorrectionLevel: o.ecl, margin: o.margin, color: { dark: o.fg, light: o.bg } }, function (err) { if (err) rej(err); else res(c); }); });
      }).then(function (c) { return canvasToBlob(c, 'image/png').then(function (b) { return [{ blob: b, name: 'qr-code-' + o.kind + '.png', note: o.size + '×' + o.size + ' px · ' + F.bytes(b.size) }]; }); });
    }
  };

  // ---- unzip / open archives
  TOOLS['unzip'] = {
    accept: '.zip,.tar,.tgz,.gz,.tar.gz,application/zip', kinds: 'archive', multiple: false, hint: 'Drop a .zip, .tar, .tgz or .gz here', label: 'Download selected as zip', stage: true,
    setup: function (panel, o) { panel.appendChild(el('p', 'u t-note', 'Tick the files you want, then download them one by one or bundled. The archive is opened in your browser and never uploaded.')); },
    onFiles: function (files, o, stageBox) {
      stageBox.innerHTML = ''; stageBox.hidden = false;
      var f = files[0], e = ext(f), note = el('p', 'u', 'Opening…'); stageBox.appendChild(note);
      var entries;
      if (e === 'zip') entries = K.zipEntries(f);
      else if (e === 'tar') entries = f.arrayBuffer().then(function (ab) { return Enc.untar(new Uint8Array(ab)); });
      else if (e === 'tgz' || /\.tar\.gz$/i.test(f.name)) entries = K.gunzip(f).then(function (b) { return b.arrayBuffer(); }).then(function (ab) { return Enc.untar(new Uint8Array(ab)); });
      else if (e === 'gz') entries = K.gunzip(f).then(function (b) { return b.arrayBuffer(); }).then(function (ab) { return [{ name: f.name.replace(/\.gz$/i, ''), data: new Uint8Array(ab) }]; });
      else return Promise.reject(new Error('that is not an archive this tool opens'));
      return entries.then(function (list) {
        list = list.filter(function (x) { return x.data && x.data.length !== undefined && !/\/$/.test(x.name); });
        o.entries = list; o.sel = {};
        note.textContent = list.length + ' file' + (list.length === 1 ? '' : 's') + ' · ' + F.bytes(list.reduce(function (n, x) { return n + x.data.length; }, 0)) + ' unpacked';
        var tbl = el('table', 't-files'), head = el('tr'); var all = check(true); all.setAttribute('aria-label', 'Select all'); head.appendChild(el('th')).appendChild(all); head.appendChild(el('th', null, 'File')); head.appendChild(el('th', null, 'Size')); head.appendChild(el('th', null, '')); tbl.appendChild(head);
        list.forEach(function (x, i) {
          o.sel[i] = true;
          var tr = el('tr'), cb = check(true); cb.setAttribute('aria-label', 'Include ' + x.name); cb.onchange = function () { o.sel[i] = cb.checked; }; tr.appendChild(el('td')).appendChild(cb);
          tr.appendChild(el('td', 'name', x.name)); tr.appendChild(el('td', 'u', F.bytes(x.data.length)));
          var dl = btn('', 'sm icon', 'download'); dl.title = 'Download'; dl.onclick = function () { download(new Blob([x.data]), x.name.split('/').pop()); }; tr.appendChild(el('td')).appendChild(dl);
          tbl.appendChild(tr);
        });
        all.onchange = function () { tbl.querySelectorAll('tr td:first-child input').forEach(function (c, i) { c.checked = all.checked; o.sel[i] = all.checked; }); };
        stageBox.appendChild(tbl);
      });
    },
    run: function (files, o) {
      var picked = o.entries.filter(function (x, i) { return o.sel[i]; });
      if (!picked.length) return Promise.reject(new Error('tick at least one file'));
      if (picked.length === 1) return Promise.resolve([{ blob: new Blob([picked[0].data]), name: picked[0].name.split('/').pop(), src: files[0], note: F.bytes(picked[0].data.length) }]);
      return K.entriesToZip(picked).then(function (b) { return [{ blob: b, name: base(files[0].name) + '-selected.zip', src: files[0], note: picked.length + ' files · ' + F.bytes(b.size) }]; });
    }
  };

  // ---- sign a PDF
  TOOLS['sign-pdf'] = {
    accept: '.pdf,application/pdf', kinds: 'pdf', multiple: false, hint: 'Drop the PDF to sign here', label: 'Apply signature & save', stage: true,
    setup: function (panel, o) { o.addDate = false; var d = check(false); d.onchange = function () { o.addDate = d.checked; }; panel.appendChild(field("Write today's date under the signature", d)); },
    onFiles: function (files, o, stageBox) {
      stageBox.innerHTML = ''; stageBox.hidden = false;
      var f = files[0];
      // 1. signature source: draw / type / upload
      var sigBox = el('div', 't-sig'); stageBox.appendChild(el('h4', null, '1. Your signature'));
      var tabs = chips([{ value: 'draw', label: 'Draw' }, { value: 'type', label: 'Type' }, { value: 'upload', label: 'Upload image' }], 'draw', function (v) { showTab(v); });
      sigBox.appendChild(tabs);
      var pad = el('canvas', 't-sigpad'); pad.width = 600; pad.height = 200; pad.setAttribute('role', 'img'); pad.setAttribute('aria-label', 'Signature drawing area'); var pg = pad.getContext('2d'); pg.lineWidth = 3; pg.lineCap = 'round'; pg.lineJoin = 'round'; pg.strokeStyle = '#111';
      var drawing = false, last = null;
      pad.style.touchAction = 'none';
      function pos(e) { var r = pad.getBoundingClientRect(); return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height }; }
      pad.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); pad.setPointerCapture(e.pointerId); pg.beginPath(); pg.moveTo(last.x, last.y); pg.lineTo(last.x + 0.1, last.y); pg.stroke(); o.sigDirty = true; });
      pad.addEventListener('pointermove', function (e) { if (!drawing) return; var p = pos(e); pg.beginPath(); pg.moveTo(last.x, last.y); pg.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2); pg.lineTo(p.x, p.y); pg.stroke(); last = p; });
      pad.addEventListener('pointerup', function () { drawing = false; }); pad.addEventListener('pointercancel', function () { drawing = false; });
      var clear = btn('Clear', 'sm'); clear.onclick = function () { pg.clearRect(0, 0, pad.width, pad.height); o.sigDirty = false; };
      var color = el('input'); color.type = 'color'; color.value = '#111111'; color.setAttribute('aria-label', 'Ink colour'); color.oninput = function () { pg.strokeStyle = color.value; };
      var drawTab = el('div'); drawTab.appendChild(pad); var dt = el('div', 't-trim'); dt.appendChild(el('label', null, 'Ink')); dt.appendChild(color); dt.appendChild(clear); drawTab.appendChild(dt);
      var typeTab = el('div'); typeTab.hidden = true; var tin = el('input'); tin.type = 'text'; tin.placeholder = 'Type your name'; tin.setAttribute('aria-label', 'Your name'); tin.style.width = '280px'; var fontSel = sel([['"Snell Roundhand","Brush Script MT","Segoe Script",cursive', 'Script'], ['"Sora",sans-serif', 'Clean'], ['"Georgia",serif', 'Serif']], '"Snell Roundhand","Brush Script MT","Segoe Script",cursive'); fontSel.setAttribute('aria-label', 'Signature style');
      var tprev = el('canvas', 't-sigpad'); tprev.width = 600; tprev.height = 200; typeTab.appendChild(tprev); var tt = el('div', 't-trim'); tt.appendChild(tin); tt.appendChild(fontSel); typeTab.appendChild(tt);
      function drawTyped() { var g2 = tprev.getContext('2d'); g2.clearRect(0, 0, 600, 200); g2.fillStyle = '#111'; g2.font = 'italic 72px ' + fontSel.value; g2.textBaseline = 'middle'; g2.fillText(tin.value || '', 30, 100); }
      tin.oninput = drawTyped; fontSel.onchange = drawTyped;
      var upTab = el('div'); upTab.hidden = true; var up = el('input'); up.type = 'file'; up.accept = 'image/png,image/jpeg,image/webp'; up.setAttribute('aria-label', 'Upload a picture of your signature'); var upPrev = el('canvas', 't-sigpad'); upPrev.width = 600; upPrev.height = 200; upTab.appendChild(up); upTab.appendChild(upPrev);
      up.onchange = function () { if (!up.files[0]) return; blobToCanvas(up.files[0]).then(function (c) { var g3 = upPrev.getContext('2d'); g3.clearRect(0, 0, 600, 200); var k = Math.min(600 / c.width, 200 / c.height); g3.drawImage(c, (600 - c.width * k) / 2, (200 - c.height * k) / 2, c.width * k, c.height * k); o.upCanvas = c; }); };
      sigBox.appendChild(drawTab); sigBox.appendChild(typeTab); sigBox.appendChild(upTab); stageBox.appendChild(sigBox);
      o.sigTab = 'draw';
      function showTab(v) { o.sigTab = v; drawTab.hidden = v !== 'draw'; typeTab.hidden = v !== 'type'; upTab.hidden = v !== 'upload'; }
      o.signature = function () {
        // trimmed, transparent PNG canvas of whichever source is active
        var src = o.sigTab === 'draw' ? pad : o.sigTab === 'type' ? tprev : upPrev;
        if (o.sigTab === 'upload' && o.upCanvas) src = o.upCanvas;
        var g4 = src.getContext('2d'), d = g4.getImageData(0, 0, src.width, src.height).data, minX = src.width, minY = src.height, maxX = 0, maxY = 0, any = false;
        for (var y = 0; y < src.height; y++) for (var x = 0; x < src.width; x++) { var i = (y * src.width + x) * 4; var ink = d[i + 3] > 20 && (o.sigTab !== 'upload' || (d[i] + d[i + 1] + d[i + 2]) < 600); if (ink) { any = true; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; } }
        if (!any) return null;
        var w = maxX - minX + 1, h = maxY - minY + 1, out = K.canvasOf(w, h), og = out.getContext('2d');
        og.drawImage(src, minX, minY, w, h, 0, 0, w, h);
        if (o.sigTab === 'upload') { // knock out a white background
          var id = og.getImageData(0, 0, w, h), p = id.data;
          for (var k = 0; k < p.length; k += 4) if (p[k] > 235 && p[k + 1] > 235 && p[k + 2] > 235) p[k + 3] = 0;
          og.putImageData(id, 0, 0);
        }
        return out;
      };
      // 2. the page
      stageBox.appendChild(el('h4', null, '2. Where it goes — pick a page, then drag the signature into place'));
      var pagesStrip = el('div', 't-pages small'), stageWrap = el('div', 't-place'), pageCanvas = el('canvas', 't-page-canvas'), overlay = el('div', 't-sig-overlay');
      overlay.hidden = true; stageWrap.appendChild(pageCanvas); stageWrap.appendChild(overlay);
      stageBox.appendChild(pagesStrip); stageBox.appendChild(stageWrap);
      var sizeRow = el('div', 't-trim'); var sz = range(25, 8, 80, 1); sz.setAttribute('aria-label', 'Signature width'); sizeRow.appendChild(el('label', null, 'Signature width')); sizeRow.appendChild(sz); var szv = el('b', null, '25%'); sizeRow.appendChild(szv);
      var place = btn('Place signature on this page', 'sm', 'bolt'); sizeRow.appendChild(place); stageBox.appendChild(sizeRow);
      o.pageIdx = 0; o.pos = null; o.widthPct = 25;
      return pdfDoc(f).then(function (doc) {
        o.doc = doc; var n = doc.numPages, chain = Promise.resolve();
        for (var i = 0; i < Math.min(n, 60); i++) (function (i) {
          chain = chain.then(function () { return renderPage(doc, i, 0.2).then(function (pg) { var card = el('div', 't-page' + (i === 0 ? ' sel' : '')); var th = el('div', 't-page-th'); th.appendChild(pg.canvas); card.appendChild(th); card.appendChild(el('div', 't-page-n', String(i + 1))); card.onclick = function () { pagesStrip.querySelectorAll('.t-page').forEach(function (c) { c.classList.remove('sel'); }); card.classList.add('sel'); showPage(i); }; pagesStrip.appendChild(card); }); });
        })(i);
        function showPage(i) {
          o.pageIdx = i; overlay.hidden = true; o.pos = null;
          return doc.getPage(i + 1).then(function (page) {
            var vp1 = page.getViewport({ scale: 1 }), scale = Math.min(680, stageWrap.clientWidth || 680) / vp1.width, vp = page.getViewport({ scale: scale });
            pageCanvas.width = vp.width; pageCanvas.height = vp.height; o.stageScale = scale; o.pageW = vp1.width; o.pageH = vp1.height; o.pageRot = page.rotate || 0;
            return page.render({ canvasContext: pageCanvas.getContext('2d'), viewport: vp, intent: 'print' }).promise;
          });
        }
        sz.oninput = function () { o.widthPct = +sz.value; szv.textContent = sz.value + '%'; if (!overlay.hidden) sizeOverlay(); };
        function sizeOverlay() { var w = pageCanvas.width * o.widthPct / 100; overlay.style.width = w + 'px'; var sc = o.sigCanvas; overlay.style.height = (w * sc.height / sc.width) + 'px'; }
        place.onclick = function () {
          var sc = o.signature(); if (!sc) { toast('Draw, type or upload a signature first', 'lock'); return; }
          o.sigCanvas = sc; overlay.innerHTML = ''; var im = el('img'); im.src = sc.toDataURL('image/png'); overlay.appendChild(im);
          overlay.hidden = false; sizeOverlay();
          o.pos = o.pos || { x: pageCanvas.width * 0.55, y: pageCanvas.height * 0.8 };
          overlay.style.left = o.pos.x + 'px'; overlay.style.top = o.pos.y + 'px';
        };
        var drag = null;
        overlay.style.touchAction = 'none';
        overlay.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, px: o.pos.x, py: o.pos.y }; overlay.setPointerCapture(e.pointerId); e.preventDefault(); });
        overlay.addEventListener('pointermove', function (e) { if (!drag) return; var r = pageCanvas.getBoundingClientRect(), k = pageCanvas.width / r.width; o.pos.x = clamp(drag.px + (e.clientX - drag.x) * k, 0, pageCanvas.width - overlay.offsetWidth * k); o.pos.y = clamp(drag.py + (e.clientY - drag.y) * k, 0, pageCanvas.height - overlay.offsetHeight * k); overlay.style.left = o.pos.x + 'px'; overlay.style.top = o.pos.y + 'px'; });
        overlay.addEventListener('pointerup', function () { drag = null; }); overlay.addEventListener('pointercancel', function () { drag = null; });
        return chain.then(function () { return showPage(0); });
      });
    },
    run: function (files, o) {
      if (!o.pos || !o.sigCanvas) return Promise.reject(new Error('place the signature on the page first'));
      var f = files[0];
      return pdfLib().then(function (PL) {
        return Promise.all([f.arrayBuffer(), canvasToBlob(o.sigCanvas, 'image/png').then(function (b) { return b.arrayBuffer(); })]).then(function (r) {
          return PL.PDFDocument.load(r[0], { ignoreEncryption: true }).then(function (doc) {
            return doc.embedPng(r[1]).then(function (png) {
              var page = doc.getPage(o.pageIdx), size = page.getSize();
              var k = 1 / o.stageScale, w = pageCanvas_w() * k, h = w * o.sigCanvas.height / o.sigCanvas.width;
              var x = o.pos.x * k, yTop = o.pos.y * k;
              var rot = (page.getRotation().angle || 0) % 360;
              var pt = mapToPdf(x, yTop, w, h, size.width, size.height, rot);
              page.drawImage(png, { x: pt.x, y: pt.y, width: pt.w, height: pt.h, rotate: PL.degrees(rot) });
              if (o.addDate) {
                return doc.embedFont(PL.StandardFonts.Helvetica).then(function (font) {
                  var d = new Date(), ds = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
                  page.drawText(ds, { x: pt.x, y: pt.y - 12, size: 9, font: font, color: PL.rgb(0.1, 0.1, 0.1), rotate: PL.degrees(rot) });
                });
              }
            }).then(function () { return doc.save({ useObjectStreams: true }); });
          });
        });
      }).then(function (u8) { return [{ blob: new Blob([u8], { type: 'application/pdf' }), name: base(f.name) + '-signed.pdf', src: f, note: 'signed on page ' + (o.pageIdx + 1) }]; });
      function pageCanvas_w() { return $('#tool .t-page-canvas').width * o.widthPct / 100; }
      // stage coordinates are top-left in the *rotated* view; PDF wants bottom-left in the unrotated page
      function mapToPdf(x, yTop, w, h, W, H, rot) {
        if (rot === 90) return { x: yTop, y: x, w: w, h: h };
        if (rot === 180) return { x: W - x - w, y: yTop, w: w, h: h };
        if (rot === 270) return { x: H - yTop - h, y: W - x, w: w, h: h };
        return { x: x, y: H - yTop - h, w: w, h: h };
      }
    }
  };

  /* -------------------------------------------------------- the shell */
  var def = TOOLS[TOOL];
  var host = $('#tool');
  if (!def || !host) return;
  var state = { files: [] }, o = {};

  var drop = $('#drop'), fileIn = $('#file');
  if (def.nofile) { if (drop) drop.hidden = true; }
  else {
    if (drop) {
      var h2 = drop.querySelector('h2'), p = drop.querySelector('p');
      if (h2) h2.textContent = TOUCH ? 'Choose ' + (def.multiple ? 'files' : 'a file') : (def.hint || 'Drop files here');
      if (p) p.innerHTML = TOUCH ? 'Tap to pick' : 'or <span class="browse">browse your device</span>';
      drop.onclick = function () { fileIn.click(); };
      drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } };
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
      document.addEventListener('dragover', function (e) { e.preventDefault(); });
      document.addEventListener('drop', function (e) { e.preventDefault(); });
    }
    if (fileIn) { fileIn.accept = def.accept || ''; fileIn.multiple = !!def.multiple; fileIn.onchange = function (e) { addFiles(e.target.files); e.target.value = ''; }; }
  }

  var picked = el('div', 'picked t-picked'); picked.hidden = true;
  var stageBox = el('div', 't-stage'); stageBox.hidden = true;
  var optsBox = el('div', 'opts t-opts');
  var go = el('button', 'cta'); go.type = 'button'; go.appendChild(icon('bolt')); var goLabel = el('span', null, def.nofile ? def.label : 'Choose ' + (def.multiple ? 'files' : 'a file') + ' to start'); go.appendChild(goLabel); go.disabled = !def.nofile;
  var priv = el('p', 'private'); priv.appendChild(icon('lock')); priv.appendChild(el('span', null, 'Your file never leaves this device.'));
  var progress = el('div', 'progress'); progress.hidden = true; var bar = el('div', 'bar'); var barI = el('i'); bar.appendChild(barI); progress.appendChild(bar);
  var status = el('div', 'status'); status.appendChild(el('span', 'spin')); var statusT = el('span', null, 'Working…'); status.appendChild(statusT); progress.appendChild(status);
  var done = el('div', 'done multi t-done'); done.hidden = true;
  host.appendChild(picked); host.appendChild(stageBox); host.appendChild(optsBox); host.appendChild(go); host.appendChild(priv); host.appendChild(progress); host.appendChild(done);
  def.setup(optsBox, o, stageBox);
  if (!optsBox.children.length) optsBox.hidden = true;

  function accepts(f) {
    var e = ext(f);
    if (def.kinds === 'image') return isImg(f);
    if (def.kinds === 'pdf') return isPdf(f);
    if (def.kinds === 'ocr') return isImg(f) || isPdf(f);
    if (def.kinds === 'video') return /^(mp4|mov|webm|m4v|mkv|avi|ogv)$/.test(e) || /^video\//.test(f.type);
    if (def.kinds === 'audio') return /^(mp3|m4a|wav|aac|ogg|opus|flac|mp4|mov|webm|m4v)$/.test(e) || /^(audio|video)\//.test(f.type);
    if (def.kinds === 'archive') return /^(zip|tar|tgz|gz)$/.test(e);
    return true;
  }
  function addFiles(list) {
    var incoming = Array.prototype.slice.call(list), bad = incoming.filter(function (f) { return !accepts(f); });
    incoming = incoming.filter(accepts);
    if (bad.length) toast(bad.length + ' file' + (bad.length === 1 ? ' is' : 's are') + ' not the kind this tool takes', 'lock');
    if (!incoming.length) return;
    if (!def.multiple) state.files = [incoming[0]]; else incoming.forEach(function (f) { if (!state.files.some(function (g) { return g.name === f.name && g.size === f.size; })) state.files.push(f); });
    if (state.files.length > 200) { state.files = state.files.slice(0, 200); toast('Up to 200 files at a time'); }
    done.hidden = true; paintPicked();
    if (def.onFiles) {
      go.disabled = true; goLabel.textContent = 'Preparing…';
      Promise.resolve(def.onFiles(state.files, o, stageBox)).then(function () { go.disabled = false; goLabel.textContent = def.label; }, function (e) { toast(e.message || String(e), 'lock'); goLabel.textContent = 'Could not open that file'; });
    } else { go.disabled = state.files.length < (def.min || 1); goLabel.textContent = state.files.length < (def.min || 1) ? 'Add ' + ((def.min || 1) - state.files.length) + ' more' : def.label + (state.files.length > 1 ? ' (' + state.files.length + ' files)' : ''); }
  }
  function paintPicked() {
    picked.innerHTML = ''; picked.hidden = !state.files.length;
    var list = el('div', 'picked-list' + (state.files.length > 4 ? ' many' : ''));
    state.files.forEach(function (f, i) {
      var row = el('div', 'picked-row'); row.appendChild(thumb(f));
      var info = el('div', 'info'); info.appendChild(el('div', 'name', f.name)); info.appendChild(el('div', 'meta', F.bytes(f.size))); row.appendChild(info);
      if (def.orderable && state.files.length > 1) {
        var up = btn('', 'sm icon'); up.appendChild(el('span', null, '↑')); up.title = 'Move up'; up.disabled = i === 0; up.onclick = function () { state.files.splice(i, 1); state.files.splice(i - 1, 0, f); paintPicked(); };
        var dn = btn('', 'sm icon'); dn.appendChild(el('span', null, '↓')); dn.title = 'Move down'; dn.disabled = i === state.files.length - 1; dn.onclick = function () { state.files.splice(i, 1); state.files.splice(i + 1, 0, f); paintPicked(); };
        row.appendChild(up); row.appendChild(dn);
      }
      var rm = btn('', 'icon', 'trash'); rm.title = 'Remove'; rm.onclick = function () { state.files.splice(i, 1); paintPicked(); if (!state.files.length) { stageBox.hidden = true; go.disabled = true; goLabel.textContent = 'Choose ' + (def.multiple ? 'files' : 'a file') + ' to start'; } else if (!def.onFiles) { go.disabled = state.files.length < (def.min || 1); goLabel.textContent = def.label + (state.files.length > 1 ? ' (' + state.files.length + ' files)' : ''); } };
      row.appendChild(rm); list.appendChild(row);
    });
    picked.appendChild(list);
  }
  function setProgress(frac, msg) { if (typeof frac === 'number') barI.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%'; if (msg) statusT.textContent = msg; }
  go.onclick = function () {
    if (!def.nofile && !state.files.length) return;
    go.disabled = true; progress.hidden = false; done.hidden = true; barI.style.width = '0%'; statusT.textContent = 'Working…';
    var t0 = Date.now();
    Promise.resolve(def.run(state.files, o, setProgress)).then(function (results) {
      progress.hidden = true; go.disabled = false;
      paintDone(results, Date.now() - t0);
      results.forEach(function (r) { saveRecord(r.blob, r.name, r.src, Date.now() - t0); });
      U.track({ t: 'tool', tool: TOOL });
      toast(results.length === 1 ? 'Done — ' + results[0].name : results.length + ' files ready', 'check');
    }, function (e) {
      progress.hidden = true; go.disabled = false;
      var msg = (e && e.message) || String(e);
      done.hidden = false; done.innerHTML = ''; var w = el('div', 'warn'); w.textContent = 'Could not finish: ' + msg; done.appendChild(w);
      toast('Could not finish', 'lock');
    });
  };
  function paintDone(results, ms) {
    done.innerHTML = ''; done.hidden = false;
    var list = el('div', 'done-list');
    results.forEach(function (r) {
      var row = el('div', 'done-row');
      var th = el('div', 'thumb');
      if (/^image\//.test(r.blob.type)) { var img = el('img'); img.src = URL.createObjectURL(r.blob); th.appendChild(img); } else th.appendChild(el('span', 'tbadge', (ext({ name: r.name }) || 'file').toUpperCase()));
      row.appendChild(th);
      var info = el('div', 'info'); info.appendChild(el('div', 'name', r.name)); info.appendChild(el('div', 'meta', (r.note || F.bytes(r.blob.size)) + ' · ' + (ms / 1000).toFixed(1) + ' s')); row.appendChild(info);
      if (r.text !== undefined) { var ta = el('textarea', 't-text'); ta.value = r.text; ta.readOnly = true; info.appendChild(ta); var cp = btn('Copy text', 'sm', 'copy'); cp.onclick = function () { navigator.clipboard.writeText(r.text).then(function () { toast('Copied', 'check'); }); }; info.appendChild(cp); }
      var dl = btn('Download', 'primary sm', 'download'); dl.onclick = function () { download(r.blob, r.name); }; row.appendChild(dl);
      list.appendChild(row);
    });
    done.appendChild(list);
    var foot = el('div', 'picked-foot');
    if (results.length > 1) { var all = btn('Download all as zip', 'primary', 'download'); all.onclick = function () { K.entriesToZip(results.map(function (r) { return { name: r.name, data: r.blob }; })).then(function (b) { download(b, TOOL + '.zip'); }); }; foot.appendChild(all); }
    var again = btn('Start over', ''); again.onclick = function () { state.files = []; paintPicked(); done.hidden = true; stageBox.hidden = !!def.nofile ? false : true; if (!def.nofile) { go.disabled = true; goLabel.textContent = 'Choose ' + (def.multiple ? 'files' : 'a file') + ' to start'; } window.scrollTo({ top: 0, behavior: 'smooth' }); };
    foot.appendChild(again);
    foot.appendChild(el('span', 'meta', 'Also kept in My files so you can download it again later.'));
    done.appendChild(foot);
    if (U.feedbackDue && U.feedbackDue()) done.appendChild(U.feedbackForm({ compact: true, page: location.pathname }));
    done.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
})(window);
