/* encoders.js — hand-written binary writers: BMP, ICO, GIF89a (median-cut + LZW), WAV, TAR. */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ BMP  */
  // 24-bit uncompressed, bottom-up, rows padded to 4 bytes.
  function bmp(imageData) {
    var w = imageData.width, h = imageData.height, src = imageData.data;
    var rowRaw = w * 3, pad = (4 - (rowRaw % 4)) % 4, rowSize = rowRaw + pad;
    var pixels = rowSize * h, size = 54 + pixels;
    var buf = new ArrayBuffer(size), dv = new DataView(buf), u8 = new Uint8Array(buf);
    dv.setUint8(0, 0x42); dv.setUint8(1, 0x4D);          // "BM"
    dv.setUint32(2, size, true); dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true);                            // BITMAPINFOHEADER
    dv.setInt32(18, w, true); dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true); dv.setUint16(28, 24, true);
    dv.setUint32(34, pixels, true);
    dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true);
    var o = 54;
    for (var y = h - 1; y >= 0; y--) {
      var s = y * w * 4;
      for (var x = 0; x < w; x++, s += 4) {
        var a = src[s + 3] / 255;                          // composite onto white
        u8[o++] = Math.round(src[s + 2] * a + 255 * (1 - a));
        u8[o++] = Math.round(src[s + 1] * a + 255 * (1 - a));
        u8[o++] = Math.round(src[s]     * a + 255 * (1 - a));
      }
      o += pad;
    }
    return new Blob([buf], { type: 'image/bmp' });
  }

  /* ------------------------------------------------------------------ ICO  */
  // ICO directory wrapping one PNG image (valid since Windows Vista).
  function ico(pngArrayBuffers, sizes) {
    var n = pngArrayBuffers.length;
    var head = new ArrayBuffer(6 + 16 * n), dv = new DataView(head);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, n, true);
    var offset = 6 + 16 * n, parts = [head];
    for (var i = 0; i < n; i++) {
      var b = 6 + 16 * i, s = sizes[i], data = pngArrayBuffers[i];
      dv.setUint8(b, s >= 256 ? 0 : s);
      dv.setUint8(b + 1, s >= 256 ? 0 : s);
      dv.setUint8(b + 2, 0); dv.setUint8(b + 3, 0);
      dv.setUint16(b + 4, 1, true); dv.setUint16(b + 6, 32, true);
      dv.setUint32(b + 8, data.byteLength, true);
      dv.setUint32(b + 12, offset, true);
      offset += data.byteLength;
      parts.push(data);
    }
    return new Blob(parts, { type: 'image/x-icon' });
  }

  /* ------------------------------------------------------------------ WAV  */
  function wav(channels, sampleRate) {         // channels: array of Float32Array
    var ch = channels.length, frames = channels[0].length;
    var dataLen = frames * ch * 2, buf = new ArrayBuffer(44 + dataLen), dv = new DataView(buf);
    function tag(off, s) { for (var i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); }
    tag(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); tag(8, 'WAVE');
    tag(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, ch, true); dv.setUint32(24, sampleRate, true);
    dv.setUint32(28, sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true);
    dv.setUint16(34, 16, true); tag(36, 'data'); dv.setUint32(40, dataLen, true);
    var o = 44;
    for (var i = 0; i < frames; i++) {
      for (var c = 0; c < ch; c++) {
        var v = Math.max(-1, Math.min(1, channels[c][i]));
        dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
        o += 2;
      }
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  /* ------------------------------------------------------------------ TAR  */
  function tarHeader(name, size, mtime) {
    var h = new Uint8Array(512);
    function put(off, str, len) {
      for (var i = 0; i < len && i < str.length; i++) h[off + i] = str.charCodeAt(i) & 0xff;
    }
    function oct(off, val, len) { put(off, val.toString(8).padStart(len - 1, '0') + '\0', len); }
    var prefix = '';
    if (name.length > 100) { var cut = name.lastIndexOf('/', name.length - 100); if (cut > 0) { prefix = name.slice(0, cut); name = name.slice(cut + 1); } }
    put(0, name.slice(0, 100), 100);
    oct(100, 0o644, 8); oct(108, 0, 8); oct(116, 0, 8);
    oct(124, size, 12); oct(136, Math.floor(mtime / 1000), 12);
    put(148, '        ', 8);              // checksum placeholder
    h[156] = 0x30;                        // typeflag '0'
    put(257, 'ustar\0', 6); put(263, '00', 2);
    put(345, prefix.slice(0, 155), 155);
    var sum = 0; for (var i = 0; i < 512; i++) sum += h[i];
    put(148, sum.toString(8).padStart(6, '0') + '\0 ', 8);
    return h;
  }
  function tar(entries) {                  // [{name, data:Uint8Array, mtime}]
    var parts = [];
    entries.forEach(function (e) {
      parts.push(tarHeader(e.name, e.data.length, e.mtime || Date.now()));
      parts.push(e.data);
      var pad = (512 - (e.data.length % 512)) % 512;
      if (pad) parts.push(new Uint8Array(pad));
    });
    parts.push(new Uint8Array(1024));      // two empty blocks
    return new Blob(parts, { type: 'application/x-tar' });
  }
  function untar(u8) {
    var out = [], off = 0;
    function str(o, len) {
      var s = '';
      for (var i = 0; i < len; i++) { var c = u8[o + i]; if (!c) break; s += String.fromCharCode(c); }
      return s;
    }
    while (off + 512 <= u8.length) {
      var name = str(off, 100);
      if (!name) { off += 512; if (off + 512 > u8.length || !u8[off]) break; continue; }
      var prefix = str(off + 345, 155);
      var size = parseInt(str(off + 124, 12).trim(), 8) || 0;
      var type = String.fromCharCode(u8[off + 156] || 0x30);
      off += 512;
      if (type === '0' || type === '\0') out.push({ name: prefix ? prefix + '/' + name : name, data: u8.subarray(off, off + size) });
      off += size + ((512 - (size % 512)) % 512);
    }
    return out;
  }

  /* ------------------------------------------------------- GIF89a encoder  */
  // Median-cut quantiser -> palette of <=256 colours.
  function medianCut(pixels, maxColors) {     // pixels: Uint8ClampedArray RGBA
    var samples = [], step = Math.max(4, Math.floor(pixels.length / 4 / 40000) * 4);
    for (var i = 0; i < pixels.length; i += step) {
      if (pixels[i + 3] < 128) continue;
      samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
    }
    if (!samples.length) return [[0, 0, 0]];
    var boxes = [samples];
    while (boxes.length < maxColors) {
      var idx = -1, best = -1;
      for (var b = 0; b < boxes.length; b++) {
        if (boxes[b].length < 2) continue;
        var r = ranges(boxes[b]), spread = Math.max(r[0], r[1], r[2]) * boxes[b].length;
        if (spread > best) { best = spread; idx = b; }
      }
      if (idx < 0) break;
      var box = boxes[idx], rg = ranges(box);
      var ch = rg[0] >= rg[1] && rg[0] >= rg[2] ? 0 : (rg[1] >= rg[2] ? 1 : 2);
      box.sort(function (a, c) { return a[ch] - c[ch]; });
      var mid = box.length >> 1;
      boxes.splice(idx, 1, box.slice(0, mid), box.slice(mid));
    }
    return boxes.map(function (box) {
      var r = 0, g = 0, bl = 0;
      for (var i = 0; i < box.length; i++) { r += box[i][0]; g += box[i][1]; bl += box[i][2]; }
      return [Math.round(r / box.length), Math.round(g / box.length), Math.round(bl / box.length)];
    });
    function ranges(box) {
      var mn = [255, 255, 255], mx = [0, 0, 0];
      for (var i = 0; i < box.length; i++) for (var c = 0; c < 3; c++) {
        if (box[i][c] < mn[c]) mn[c] = box[i][c];
        if (box[i][c] > mx[c]) mx[c] = box[i][c];
      }
      return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    }
  }

  function nearestFinder(palette) {
    var cache = new Int16Array(32768).fill(-1);
    return function (r, g, b) {
      var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      var hit = cache[key];
      if (hit >= 0) return hit;
      var best = 0, bd = Infinity;
      for (var i = 0; i < palette.length; i++) {
        var dr = r - palette[i][0], dg = g - palette[i][1], db = b - palette[i][2];
        var d = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
        if (d < bd) { bd = d; best = i; }
      }
      cache[key] = best;
      return best;
    };
  }

  // Quantise one frame -> Uint8Array of palette indices (transparent -> transIndex).
  function quantiseFrame(imageData, palette, transIndex, dither) {
    var w = imageData.width, h = imageData.height, d = imageData.data;
    var near = nearestFinder(palette), out = new Uint8Array(w * h);
    var work = dither ? new Float32Array(d.length) : null;
    if (dither) for (var i = 0; i < d.length; i++) work[i] = d[i];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4, q = y * w + x;
        if (d[p + 3] < 128 && transIndex >= 0) { out[q] = transIndex; continue; }
        var r, g, b;
        if (dither) {
          r = Math.max(0, Math.min(255, work[p]));
          g = Math.max(0, Math.min(255, work[p + 1]));
          b = Math.max(0, Math.min(255, work[p + 2]));
        } else { r = d[p]; g = d[p + 1]; b = d[p + 2]; }
        var idx = near(r | 0, g | 0, b | 0);
        out[q] = idx;
        if (dither) {
          var er = r - palette[idx][0], eg = g - palette[idx][1], eb = b - palette[idx][2];
          spread(work, w, h, x + 1, y,     p, er, eg, eb, 7 / 16);
          spread(work, w, h, x - 1, y + 1, p, er, eg, eb, 3 / 16);
          spread(work, w, h, x,     y + 1, p, er, eg, eb, 5 / 16);
          spread(work, w, h, x + 1, y + 1, p, er, eg, eb, 1 / 16);
        }
      }
    }
    return out;
    function spread(buf, W, H, x, y, _p, er, eg, eb, f) {
      if (x < 0 || x >= W || y >= H) return;
      var o = (y * W + x) * 4;
      buf[o] += er * f; buf[o + 1] += eg * f; buf[o + 2] += eb * f;
    }
  }

  // LZW variable-code compressor, following the GIF spec's code-size schedule.
  function lzw(minCodeSize, indices) {
    var clear = 1 << minCodeSize, eoi = clear + 1;
    var codeSize = minCodeSize + 1, next = eoi + 1, table = new Map();
    var bits = 0, acc = 0, bytes = [];
    function emit(code) {
      acc |= code << bits; bits += codeSize;
      while (bits >= 8) { bytes.push(acc & 0xff); acc >>= 8; bits -= 8; }
    }
    emit(clear);
    var cur = indices[0];
    for (var i = 1; i < indices.length; i++) {
      var k = indices[i], key = (cur << 8) | k, got = table.get(key);
      if (got !== undefined) { cur = got; continue; }
      emit(cur);
      if (next === 4096) { emit(clear); table.clear(); next = eoi + 1; codeSize = minCodeSize + 1; }
      else { if (next >= (1 << codeSize)) codeSize++; table.set(key, next++); }
      cur = k;
    }
    emit(cur); emit(eoi);
    if (bits > 0) bytes.push(acc & 0xff);
    // pack into sub-blocks of at most 255 bytes
    var out = [minCodeSize];
    for (var o = 0; o < bytes.length; o += 255) {
      var chunk = bytes.slice(o, o + 255);
      out.push(chunk.length);
      out = out.concat(chunk);
    }
    out.push(0);
    return new Uint8Array(out);
  }

  // frames: [{imageData, delayMs}] — a single frame produces a still GIF.
  function gif(frames, opts) {
    opts = opts || {};
    var loop = opts.loop !== false, dither = opts.dither !== false;
    var w = frames[0].imageData.width, h = frames[0].imageData.height;

    // build one global palette from a sample across all frames
    var pool = [], budget = 40000, per = Math.max(1, Math.ceil(budget / frames.length));
    var wantsAlpha = false;
    frames.forEach(function (f) {
      var d = f.imageData.data, step = Math.max(4, Math.floor(d.length / 4 / per) * 4);
      for (var i = 0; i < d.length; i += step) {
        if (d[i + 3] < 128) { wantsAlpha = true; continue; }
        pool.push(d[i], d[i + 1], d[i + 2], 255);
      }
    });
    if (!wantsAlpha) {
      for (var fi = 0; fi < frames.length && !wantsAlpha; fi++) {
        var dd = frames[fi].imageData.data;
        for (var j = 3; j < dd.length; j += 4) if (dd[j] < 128) { wantsAlpha = true; break; }
      }
    }
    var maxColors = wantsAlpha ? 255 : 256;
    var palette = medianCut(new Uint8ClampedArray(pool), maxColors);
    var transIndex = -1;
    if (wantsAlpha) { transIndex = palette.length; palette = palette.concat([[0, 0, 0]]); }

    var bitsNeeded = Math.max(1, Math.ceil(Math.log2(Math.max(2, palette.length))));
    var gctSize = 1 << bitsNeeded;                  // 2,4,8,...,256
    var minCodeSize = Math.max(2, bitsNeeded);

    var parts = [], bytes = [];
    function push() { for (var i = 0; i < arguments.length; i++) bytes.push(arguments[i]); }
    function u16(v) { push(v & 0xff, (v >> 8) & 0xff); }
    function flush() { if (bytes.length) { parts.push(new Uint8Array(bytes)); bytes = []; } }

    'GIF89a'.split('').forEach(function (c) { push(c.charCodeAt(0)); });
    u16(w); u16(h);
    push(0x80 | ((bitsNeeded - 1) & 0x07), 0, 0);   // GCT present, colour resolution, sort=0
    for (var i = 0; i < gctSize; i++) {
      var c = palette[i] || [0, 0, 0];
      push(c[0], c[1], c[2]);
    }
    if (frames.length > 1 && loop) {
      push(0x21, 0xFF, 0x0B);
      'NETSCAPE2.0'.split('').forEach(function (ch) { push(ch.charCodeAt(0)); });
      push(0x03, 0x01); u16(0); push(0x00);
    }
    frames.forEach(function (f) {
      var delay = Math.max(2, Math.round((f.delayMs || 100) / 10));
      var disposal = frames.length > 1 ? 2 : 0;
      push(0x21, 0xF9, 0x04, (disposal << 2) | (transIndex >= 0 ? 1 : 0));
      u16(delay);
      push(transIndex >= 0 ? transIndex : 0, 0x00);
      push(0x2C); u16(0); u16(0); u16(w); u16(h); push(0x00);
      flush();
      parts.push(lzw(minCodeSize, quantiseFrame(f.imageData, palette, transIndex, dither)));
    });
    push(0x3B);
    flush();
    return new Blob(parts, { type: 'image/gif' });
  }

  /* ------------------------------------------------------------------ TGA  */
  // Uncompressed 32-bit BGRA, top-left origin.
  function tga(imageData) {
    var w = imageData.width, h = imageData.height, src = imageData.data;
    var buf = new ArrayBuffer(18 + w * h * 4), dv = new DataView(buf), u8 = new Uint8Array(buf);
    dv.setUint8(2, 2);                                   // image type: uncompressed true-colour
    dv.setUint16(12, w, true); dv.setUint16(14, h, true);
    dv.setUint8(16, 32); dv.setUint8(17, 0x28);          // 32 bpp, 8 alpha bits, top-left
    for (var i = 0, o = 18; i < src.length; i += 4, o += 4) {
      u8[o] = src[i + 2]; u8[o + 1] = src[i + 1]; u8[o + 2] = src[i]; u8[o + 3] = src[i + 3];
    }
    return new Blob([buf], { type: 'image/x-targa' });
  }

  /* --------------------------------------------------------------- Netpbm  */
  function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }
  function overWhite(src, i) {                          // composite one RGBA pixel onto white
    var a = src[i + 3] / 255;
    return [Math.round(src[i] * a + 255 * (1 - a)), Math.round(src[i + 1] * a + 255 * (1 - a)), Math.round(src[i + 2] * a + 255 * (1 - a))];
  }
  function ppm(imageData) {
    var w = imageData.width, h = imageData.height, src = imageData.data;
    var head = new TextEncoder().encode('P6\n' + w + ' ' + h + '\n255\n');
    var body = new Uint8Array(w * h * 3);
    for (var i = 0, o = 0; i < src.length; i += 4, o += 3) {
      var c = overWhite(src, i); body[o] = c[0]; body[o + 1] = c[1]; body[o + 2] = c[2];
    }
    return new Blob([head, body], { type: 'image/x-portable-pixmap' });
  }
  function pgm(imageData) {
    var w = imageData.width, h = imageData.height, src = imageData.data;
    var head = new TextEncoder().encode('P5\n' + w + ' ' + h + '\n255\n');
    var body = new Uint8Array(w * h);
    for (var i = 0, o = 0; i < src.length; i += 4, o++) { var c = overWhite(src, i); body[o] = Math.round(luma(c[0], c[1], c[2])); }
    return new Blob([head, body], { type: 'image/x-portable-graymap' });
  }
  function pbm(imageData) {                             // 1 = black, rows padded to whole bytes
    var w = imageData.width, h = imageData.height, src = imageData.data;
    var head = new TextEncoder().encode('P4\n' + w + ' ' + h + '\n');
    var rowBytes = Math.ceil(w / 8), body = new Uint8Array(rowBytes * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4, c = overWhite(src, i);
      if (luma(c[0], c[1], c[2]) < 128) body[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
    return new Blob([head, body], { type: 'image/x-portable-bitmap' });
  }
  // Reads P1–P6 (ASCII and binary), 8- or 16-bit, into RGBA.
  function pnmParse(u8) {
    var pos = 0, magic, w, h, maxval = 1;
    function token() {
      for (;;) {
        while (pos < u8.length && (u8[pos] === 0x20 || u8[pos] === 0x0A || u8[pos] === 0x0D || u8[pos] === 0x09)) pos++;
        if (u8[pos] === 0x23) { while (pos < u8.length && u8[pos] !== 0x0A) pos++; continue; }
        break;
      }
      var s = pos;
      while (pos < u8.length && u8[pos] > 0x20 && u8[pos] !== 0x23) pos++;
      return String.fromCharCode.apply(null, u8.subarray(s, pos));
    }
    magic = token();
    if (!/^P[1-6]$/.test(magic)) throw new Error('not a Netpbm image (expected P1–P6, found "' + magic + '")');
    w = parseInt(token(), 10); h = parseInt(token(), 10);
    var bitmap = magic === 'P1' || magic === 'P4';
    if (!bitmap) maxval = parseInt(token(), 10);
    if (!(w > 0 && h > 0)) throw new Error('bad Netpbm dimensions');
    pos++;                                               // single whitespace before raster
    var out = new Uint8ClampedArray(w * h * 4), n = w * h, wide = maxval > 255;
    function val() { return wide ? ((u8[pos++] << 8) | u8[pos++]) : u8[pos++]; }
    function scale(v) { return Math.round(v * 255 / maxval); }
    var i, v;
    if (magic === 'P6') for (i = 0; i < n; i++) { out[i * 4] = scale(val()); out[i * 4 + 1] = scale(val()); out[i * 4 + 2] = scale(val()); out[i * 4 + 3] = 255; }
    else if (magic === 'P5') for (i = 0; i < n; i++) { v = scale(val()); out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255; }
    else if (magic === 'P4') {
      var rowBytes = Math.ceil(w / 8);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var bit = (u8[pos + y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1, o = (y * w + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = bit ? 0 : 255; out[o + 3] = 255;
      }
    } else {                                             // ASCII variants
      pos--;
      for (i = 0; i < n; i++) {
        if (magic === 'P3') { out[i * 4] = scale(+token()); out[i * 4 + 1] = scale(+token()); out[i * 4 + 2] = scale(+token()); }
        else if (magic === 'P2') { v = scale(+token()); out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; }
        else { v = +token() ? 0 : 255; out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; }
        out[i * 4 + 3] = 255;
      }
    }
    return { width: w, height: h, data: out };
  }

  /* ----------------------------------------------------------------- ICNS  */
  // entries: [{ type: 'ic07', png: ArrayBuffer }]
  function icns(entries) {
    var total = 8;
    entries.forEach(function (e) { total += 8 + e.png.byteLength; });
    var out = new Uint8Array(total), dv = new DataView(out.buffer);
    function tag(off, s) { for (var i = 0; i < 4; i++) out[off + i] = s.charCodeAt(i); }
    tag(0, 'icns'); dv.setUint32(4, total);
    var o = 8;
    entries.forEach(function (e) {
      tag(o, e.type); dv.setUint32(o + 4, 8 + e.png.byteLength);
      out.set(new Uint8Array(e.png), o + 8);
      o += 8 + e.png.byteLength;
    });
    return new Blob([out], { type: 'image/icns' });
  }
  var ICNS_TYPES = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };

  /* --------------------------------------------------------- Ogg / Opus  */
  // Ogg's CRC-32 is the plain MSB-first 0x04C11DB7 polynomial, no reflection.
  var OGG_CRC = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var r = i << 24;
      for (var j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04C11DB7) : (r << 1);
      t[i] = r >>> 0;
    }
    return t;
  })();
  function oggCrc(bytes) {
    var crc = 0;
    for (var i = 0; i < bytes.length; i++) crc = ((crc << 8) ^ OGG_CRC[((crc >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
    return crc;
  }
  function oggPage(serial, seq, granule, headerType, packets) {
    var lacing = [], bodyLen = 0;
    packets.forEach(function (p) {
      var n = p.length; bodyLen += n;
      while (n >= 255) { lacing.push(255); n -= 255; }
      lacing.push(n);
    });
    if (lacing.length > 255) throw new Error('too many packets for one Ogg page');
    var page = new Uint8Array(27 + lacing.length + bodyLen), dv = new DataView(page.buffer);
    page[0] = 0x4F; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53;   // OggS
    page[4] = 0; page[5] = headerType;
    dv.setUint32(6, granule % 4294967296, true); dv.setUint32(10, Math.floor(granule / 4294967296), true);
    dv.setUint32(14, serial, true); dv.setUint32(18, seq, true);
    page[26] = lacing.length;
    for (var i = 0; i < lacing.length; i++) page[27 + i] = lacing[i];
    var o = 27 + lacing.length;
    packets.forEach(function (p) { page.set(p, o); o += p.length; });
    dv.setUint32(22, oggCrc(page), true);
    return page;
  }
  // packets: [{ data: Uint8Array, samples: n (at 48 kHz) }]
  function oggOpus(packets, opts) {
    var channels = opts.channels || 2, preSkip = opts.preSkip == null ? 312 : opts.preSkip;
    var serial = (Math.random() * 0xFFFFFFFF) >>> 0, seq = 0, pages = [];
    var head = new Uint8Array(19), hv = new DataView(head.buffer);
    'OpusHead'.split('').forEach(function (c, i) { head[i] = c.charCodeAt(0); });
    head[8] = 1; head[9] = channels;
    hv.setUint16(10, preSkip, true); hv.setUint32(12, opts.inputSampleRate || 48000, true);
    hv.setInt16(16, 0, true); head[18] = 0;
    pages.push(oggPage(serial, seq++, 0, 0x02, [head]));
    var vendor = new TextEncoder().encode('Convert Files'), tags = new Uint8Array(8 + 4 + vendor.length + 4), tv = new DataView(tags.buffer);
    'OpusTags'.split('').forEach(function (c, i) { tags[i] = c.charCodeAt(0); });
    tv.setUint32(8, vendor.length, true); tags.set(vendor, 12); tv.setUint32(12 + vendor.length, 0, true);
    pages.push(oggPage(serial, seq++, 0, 0x00, [tags]));
    var granule = 0, group = [], groupSamples = 0;
    function flush(last) {
      if (!group.length) return;
      granule += groupSamples;
      pages.push(oggPage(serial, seq++, granule, last ? 0x04 : 0x00, group));
      group = []; groupSamples = 0;
    }
    packets.forEach(function (p, i) {
      group.push(p.data); groupSamples += p.samples;
      if (group.length >= 50 || i === packets.length - 1) flush(i === packets.length - 1);
    });
    return new Blob(pages, { type: 'audio/ogg' });
  }

  root.Enc = { bmp: bmp, ico: ico, wav: wav, tar: tar, untar: untar, gif: gif, medianCut: medianCut,
               tga: tga, ppm: ppm, pgm: pgm, pbm: pbm, pnmParse: pnmParse, icns: icns, ICNS_TYPES: ICNS_TYPES,
               oggOpus: oggOpus, oggCrc: oggCrc, oggPage: oggPage };
})(window);
