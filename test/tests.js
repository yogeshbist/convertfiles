/* tests.js — headless checks for the hand-written binary encoders and parsers. */
var PASS = 0, FAIL = [], REPORT = [];
function ok(name, cond, detail) {
  if (cond) { PASS++; REPORT.push('  ok   ' + name); }
  else { FAIL.push(name + (detail ? ' :: ' + detail : '')); REPORT.push('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'got ' + a + ', expected ' + b); }
function ascii(u8, off, len) {
  var s = ''; for (var i = 0; i < len; i++) s += String.fromCharCode(u8[off + i]); return s;
}

/* --------------------------------------------------- GIF: an LZW decoder */
function lzwDecode(minCode, data) {
  var clear = 1 << minCode, eoi = clear + 1, dict = [], out = [], prev = null;
  function reset() { dict = []; for (var i = 0; i < clear; i++) dict.push([i]); dict.push(null); dict.push(null); }
  reset();
  var codeSize = minCode + 1, bitPos = 0;
  function read() {
    var v = 0;
    for (var i = 0; i < codeSize; i++) {
      var bi = bitPos >> 3;
      if (bi >= data.length) return -1;
      v |= ((data[bi] >> (bitPos & 7)) & 1) << i;
      bitPos++;
    }
    return v;
  }
  for (;;) {
    var code = read();
    if (code < 0 || code === eoi) break;
    if (code === clear) { reset(); codeSize = minCode + 1; prev = null; continue; }
    var entry;
    if (code < dict.length && dict[code]) entry = dict[code];
    else if (prev) entry = prev.concat([prev[0]]);
    else throw new Error('corrupt LZW stream at code ' + code);
    for (var k = 0; k < entry.length; k++) out.push(entry[k]);
    if (prev) dict.push(prev.concat([entry[0]]));
    if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
    prev = entry;
  }
  return out;
}

function gifParse(u8) {
  var sig = ascii(u8, 0, 6);
  if (sig !== 'GIF89a') throw new Error('bad signature: ' + sig);
  var w = u8[6] | (u8[7] << 8), h = u8[8] | (u8[9] << 8), packed = u8[10];
  if (!(packed & 0x80)) throw new Error('no global colour table');
  var gctSize = 1 << ((packed & 7) + 1), p = 13, gct = [];
  for (var i = 0; i < gctSize; i++) { gct.push([u8[p], u8[p + 1], u8[p + 2]]); p += 3; }
  var frames = [], delay = 0, trans = -1, loops = null;
  for (;;) {
    if (p >= u8.length) throw new Error('ran off the end without a trailer');
    var b = u8[p++];
    if (b === 0x3B) break;
    if (b === 0x21) {
      var lbl = u8[p++], size = u8[p++];
      if (lbl === 0xF9) {
        var flags = u8[p];
        delay = u8[p + 1] | (u8[p + 2] << 8);
        trans = (flags & 1) ? u8[p + 3] : -1;
        p += size;
        if (u8[p++] !== 0) throw new Error('unterminated graphic control extension');
      } else {
        if (lbl === 0xFF) loops = ascii(u8, p, 11);
        p += size;
        while (u8[p] !== 0) p += u8[p] + 1;
        p++;
      }
      continue;
    }
    if (b === 0x2C) {
      var iw = u8[p + 4] | (u8[p + 5] << 8), ih = u8[p + 6] | (u8[p + 7] << 8), lp = u8[p + 8];
      p += 9;
      if (lp & 0x80) p += 3 * (1 << ((lp & 7) + 1));
      var minCode = u8[p++], data = [];
      while (u8[p] !== 0) { var n = u8[p++]; for (var k = 0; k < n; k++) data.push(u8[p++]); }
      p++;
      frames.push({ w: iw, h: ih, delay: delay, trans: trans, indices: lzwDecode(minCode, data) });
      continue;
    }
    throw new Error('unknown block 0x' + b.toString(16));
  }
  return { w: w, h: h, gct: gct, frames: frames, loops: loops };
}

function makeImage(w, h, fn) {
  var d = new Uint8ClampedArray(w * h * 4);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var c = fn(x, y), o = (y * w + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c.length > 3 ? c[3] : 255;
  }
  return new ImageData(d, w, h);
}

/* ============================================================== GIF tests */
(function () {
  var COLORS = [[255, 0, 0], [0, 200, 0], [16, 16, 220], [250, 250, 250]];
  var img = makeImage(8, 8, function (x, y) { return COLORS[((x >> 1) + (y >> 1)) % 4]; });
  var g = gifParse(Blob.bytes(Enc.gif([{ imageData: img, delayMs: 100 }], { dither: false })));
  eq('gif still: width', g.w, 8);
  eq('gif still: height', g.h, 8);
  eq('gif still: one frame', g.frames.length, 1);
  eq('gif still: pixel count', g.frames[0].indices.length, 64);
  var exact = true, worst = 0;
  for (var i = 0; i < 64; i++) {
    var want = COLORS[(((i % 8) >> 1) + ((i >> 3) >> 1)) % 4], got = g.gct[g.frames[0].indices[i]];
    for (var c = 0; c < 3; c++) { var d = Math.abs(want[c] - got[c]); if (d) exact = false; if (d > worst) worst = d; }
  }
  ok('gif still: 4-colour image round-trips exactly', exact, 'worst channel error ' + worst);
  ok('gif still: no loop block on a single frame', g.loops === null, 'found ' + g.loops);
})();

(function () {
  var img = makeImage(48, 48, function (x, y) { return [x * 5, y * 5, (x + y) * 2]; });
  var g = gifParse(Blob.bytes(Enc.gif([{ imageData: img }], { dither: false })));
  eq('gif gradient: pixel count', g.frames[0].indices.length, 48 * 48);
  var worst = 0;
  for (var i = 0; i < g.frames[0].indices.length; i++) {
    var x = i % 48, y = (i / 48) | 0, want = [x * 5, y * 5, (x + y) * 2], got = g.gct[g.frames[0].indices[i]];
    for (var c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(Math.min(255, want[c]) - got[c]));
  }
  ok('gif gradient: quantisation error stays small', worst <= 24, 'worst channel error ' + worst);
})();

(function () {
  var a = makeImage(16, 16, function (x) { return [x * 16, 0, 0]; });
  var b = makeImage(16, 16, function (x, y) { return [0, y * 16, 0]; });
  var g = gifParse(Blob.bytes(Enc.gif([{ imageData: a, delayMs: 80 }, { imageData: b, delayMs: 80 }], { dither: false })));
  eq('gif animation: two frames', g.frames.length, 2);
  eq('gif animation: netscape loop block', g.loops, 'NETSCAPE2.0');
  eq('gif animation: frame delay in 1/100s', g.frames[0].delay, 8);
  eq('gif animation: frame 2 pixel count', g.frames[1].indices.length, 256);
})();

(function () {
  var img = makeImage(8, 8, function (x) { return x < 4 ? [200, 30, 30, 255] : [0, 0, 0, 0]; });
  var g = gifParse(Blob.bytes(Enc.gif([{ imageData: img }], { dither: false })));
  ok('gif alpha: transparent index declared', g.frames[0].trans >= 0, 'trans=' + g.frames[0].trans);
  var allClear = true;
  for (var y = 0; y < 8; y++) for (var x = 4; x < 8; x++) {
    if (g.frames[0].indices[y * 8 + x] !== g.frames[0].trans) allClear = false;
  }
  ok('gif alpha: transparent pixels use that index', allClear);
})();

(function () {
  var img = makeImage(64, 64, function (x, y) { return [(x * 4) % 256, (y * 4) % 256, ((x * y) % 256)]; });
  var out = Enc.gif([{ imageData: img }], { dither: true });
  var g = gifParse(Blob.bytes(out));
  eq('gif dithered: still decodes', g.frames[0].indices.length, 64 * 64);
})();

/* ============================================================== BMP tests */
(function () {
  var img = makeImage(3, 2, function (x, y) { return y === 0 ? [10, 20, 30] : [200, 100, 50]; });
  var u8 = Blob.bytes(Enc.bmp(img));
  eq('bmp: signature', ascii(u8, 0, 2), 'BM');
  eq('bmp: file size field', u8[2] | (u8[3] << 8), 78);
  eq('bmp: actual byte length', u8.length, 78);
  eq('bmp: pixel data offset', u8[10], 54);
  eq('bmp: width', u8[18], 3);
  eq('bmp: height', u8[22], 2);
  eq('bmp: bit depth', u8[28], 24);
  // rows are bottom-up: first stored row is source row 1 -> BGR of [200,100,50]
  eq('bmp: first stored pixel B', u8[54], 50);
  eq('bmp: first stored pixel G', u8[55], 100);
  eq('bmp: first stored pixel R', u8[56], 200);
  eq('bmp: second stored row R', u8[54 + 12 + 2], 10);
})();

(function () {
  var img = makeImage(1, 1, function () { return [255, 0, 0, 0]; });   // fully transparent red
  var u8 = Blob.bytes(Enc.bmp(img));
  ok('bmp: transparent pixel composites onto white', u8[54] === 255 && u8[55] === 255 && u8[56] === 255,
     'got ' + u8[54] + ',' + u8[55] + ',' + u8[56]);
})();

/* ============================================================== WAV tests */
(function () {
  var left = new Float32Array([0, 0.5, -0.5, 1]), right = new Float32Array([1, -1, 0, 0.25]);
  var u8 = Blob.bytes(Enc.wav([left, right], 44100));
  eq('wav: RIFF tag', ascii(u8, 0, 4), 'RIFF');
  eq('wav: WAVE tag', ascii(u8, 8, 4), 'WAVE');
  eq('wav: fmt tag', ascii(u8, 12, 4), 'fmt ');
  eq('wav: data tag', ascii(u8, 36, 4), 'data');
  eq('wav: total length', u8.length, 44 + 4 * 2 * 2);
  eq('wav: channel count', u8[22], 2);
  eq('wav: sample rate', u8[24] | (u8[25] << 8) | (u8[26] << 16), 44100);
  eq('wav: bits per sample', u8[34], 16);
  var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  eq('wav: first left sample', dv.getInt16(44, true), 0);
  eq('wav: first right sample is full scale', dv.getInt16(46, true), 32767);
  eq('wav: second left sample', dv.getInt16(48, true), Math.trunc(0.5 * 32767));  // Int16 conversion truncates
  eq('wav: second right sample is full negative', dv.getInt16(50, true), -32768);
})();

/* ============================================================== TAR tests */
(function () {
  var a = new Uint8Array([1, 2, 3, 4, 5]);
  var b = new Uint8Array(600);
  for (var i = 0; i < 600; i++) b[i] = i & 0xff;
  var blob = Enc.tar([{ name: 'first.bin', data: a, mtime: 1700000000000 },
                      { name: 'nested/dir/second.bin', data: b, mtime: 1700000000000 }]);
  var u8 = Blob.bytes(blob);
  eq('tar: ustar magic', ascii(u8, 257, 5), 'ustar');
  eq('tar: size is a multiple of 512', u8.length % 512, 0);
  var back = Enc.untar(u8);
  eq('tar: entry count', back.length, 2);
  eq('tar: first name', back[0].name, 'first.bin');
  eq('tar: first size', back[0].data.length, 5);
  eq('tar: second name', back[1].name, 'nested/dir/second.bin');
  eq('tar: second size', back[1].data.length, 600);
  var same = true;
  for (var j = 0; j < 600; j++) if (back[1].data[j] !== b[j]) same = false;
  ok('tar: payload survives the round trip', same);
  // header checksum must be self-consistent
  var sum = 0;
  for (var k = 0; k < 512; k++) sum += (k >= 148 && k < 156) ? 32 : u8[k];
  eq('tar: header checksum', parseInt(ascii(u8, 148, 6), 8), sum);
})();

/* ============================================================= mesh tests */
(function () {
  var P = Convert._pure;
  var obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nv 1 1 0\nf 1 2 3\nf 2 4 3\n';
  var mesh = P.parseObj(obj);
  eq('obj: vertex count', mesh.pos.length, 4);
  eq('obj: triangle count', mesh.tris.length, 2);

  var stlBytes = Blob.bytes(P.writeStl(mesh));
  eq('stl: byte length', stlBytes.length, 84 + 2 * 50);
  var dv = new DataView(stlBytes.buffer, stlBytes.byteOffset, stlBytes.byteLength);
  eq('stl: triangle count field', dv.getUint32(80, true), 2);
  var back = P.parseStl(stlBytes.buffer.slice(stlBytes.byteOffset, stlBytes.byteOffset + stlBytes.byteLength));
  eq('stl: round-trips to 6 vertices', back.pos.length, 6);
  eq('stl: round-trips to 2 triangles', back.tris.length, 2);
  ok('stl: first vertex preserved', back.pos[0][0] === 0 && back.pos[1][0] === 1, JSON.stringify(back.pos.slice(0, 2)));
  eq('stl: computed normal points along +z', dv.getFloat32(80 + 4 + 8, true), 1);

  var plyText = Blob.bytes(P.writePly(mesh));
  var plyBack = P.parsePly(plyText.buffer.slice(plyText.byteOffset, plyText.byteOffset + plyText.byteLength));
  eq('ply: vertex count round-trips', plyBack.pos.length, 4);
  eq('ply: triangle count round-trips', plyBack.tris.length, 2);
  ok('ply: last vertex preserved', plyBack.pos[3][0] === 1 && plyBack.pos[3][1] === 1);

  var objBack = P.parseObj(new TextDecoder().decode(Blob.bytes(P.writeObj(mesh, 'm'))));
  eq('obj: writer/parser round trip vertices', objBack.pos.length, 4);
  eq('obj: writer/parser round trip triangles', objBack.tris.length, 2);

  var neg = P.parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n');
  ok('obj: negative face indices resolve', neg.tris[0][0] === 0 && neg.tris[0][2] === 2, JSON.stringify(neg.tris));
  var quad = P.parseObj('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1/1/1 2/2/2 3/3/3 4/4/4\n');
  eq('obj: quads are triangulated', quad.tris.length, 2);
})();

/* ======================================================== glTF / GLB tests */
(function () {
  var P = Convert._pure;
  var payload = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11]);   // 11 bytes: forces padding
  var gltf = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: payload.length, uri: 'data:application/octet-stream;base64,' + P.b64FromBytes(payload) }],
    meshes: [{ name: 'ring' }]
  };
  var glbBytes = Blob.bytes(P.gltfToGlb(JSON.stringify(gltf)));
  var dv = new DataView(glbBytes.buffer, glbBytes.byteOffset, glbBytes.byteLength);
  eq('glb: magic', dv.getUint32(0, true), 0x46546C67);
  eq('glb: version', dv.getUint32(4, true), 2);
  eq('glb: declared length matches actual', dv.getUint32(8, true), glbBytes.length);
  eq('glb: total length is 4-byte aligned', glbBytes.length % 4, 0);
  eq('glb: JSON chunk type', dv.getUint32(16, true), 0x4E4F534A);

  var backBlob = P.glbToGltf(glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength));
  var back = JSON.parse(new TextDecoder().decode(Blob.bytes(backBlob)));
  eq('gltf: mesh name survives the round trip', back.meshes[0].name, 'ring');
  eq('gltf: buffer byteLength restored', back.buffers[0].byteLength, payload.length);
  var restored = P.bytesFromB64(back.buffers[0].uri.split(',')[1]);
  var same = restored.length === payload.length;
  for (var i = 0; same && i < payload.length; i++) if (restored[i] !== payload[i]) same = false;
  ok('gltf: buffer bytes survive the round trip', same, 'got ' + restored.length + ' bytes');

  var threw = '';
  try { P.gltfToGlb(JSON.stringify({ asset: {}, buffers: [{ uri: 'scene.bin', byteLength: 4 }] })); }
  catch (e) { threw = e.message; }
  ok('gltf: external .bin is rejected with a clear message', /external/.test(threw), threw || 'no error thrown');
})();

/* ========================================================= misc utilities */
(function () {
  var P = Convert._pure;
  eq('xml writer: nests objects', P.objToXml({ a: 1, b: { c: 'x' } }, 'root'), '<root><a>1</a><b><c>x</c></b></root>');
  eq('xml writer: escapes markup', P.objToXml({ a: '<&>' }, 'r'), '<r><a>&lt;&amp;&gt;</a></r>');
  eq('xml writer: repeats arrays under one tag', P.objToXml({ i: [1, 2] }, 'r'), '<r><i>1</i><i>2</i></r>');
  eq('rowsOf: array passes through', P.rowsOf([1, 2, 3]).length, 3);
  eq('rowsOf: finds the array inside an object', P.rowsOf({ meta: 1, items: [1, 2] }).length, 2);
  eq('rowsOf: wraps a bare object', P.rowsOf({ a: 1 }).length, 1);

  eq('graph: png reaches pdf', !!Convert.rule('png', 'pdf'), true);
  eq('graph: docx reaches pdf', !!Convert.rule('docx', 'pdf'), true);
  eq('graph: pdf reaches docx', !!Convert.rule('pdf', 'docx'), true);
  eq('graph: xlsx reaches csv', !!Convert.rule('xlsx', 'csv'), true);
  eq('graph: csv reaches xlsx', !!Convert.rule('csv', 'xlsx'), true);
  eq('graph: glb reaches gltf', !!Convert.rule('glb', 'gltf'), true);
  eq('graph: mp4 reaches gif', !!Convert.rule('mp4', 'gif'), true);
  eq('graph: every source can be zipped', !!Convert.rule('heic', 'zip'), true);
  eq('graph: no bogus mp4 to docx pair', !!Convert.rule('mp4', 'docx'), false);
  eq('graph: no self pair', !!Convert.rule('png', 'png'), false);
  ok('graph: image rules keep quality/width controls',
     (Convert.rule('png', 'jpg').ui || []).indexOf('quality') > -1);
})();

/* ========================================================= new encoders */
(function () {
  var img = makeImage(5, 3, function (x, y) { return [x * 50, y * 100, 7, x === 0 ? 0 : 255]; });
  var u8 = Blob.bytes(Enc.tga(img));
  eq('tga: byte length', u8.length, 18 + 5 * 3 * 4);
  eq('tga: image type = uncompressed truecolour', u8[2], 2);
  eq('tga: width', u8[12] | (u8[13] << 8), 5);
  eq('tga: height', u8[14] | (u8[15] << 8), 3);
  eq('tga: 32 bpp', u8[16], 32);
  eq('tga: descriptor top-left + 8 alpha bits', u8[17], 0x28);
  ok('tga: pixel (1,0) stored BGRA', u8[18 + 4] === 7 && u8[18 + 5] === 0 && u8[18 + 6] === 50 && u8[18 + 7] === 255);
})();

(function () {
  var img = makeImage(6, 4, function (x, y) { return [x * 40, y * 60, 128]; });
  var ppmBytes = Blob.bytes(Enc.ppm(img));
  eq('ppm: header', ascii(ppmBytes, 0, 3), 'P6\n');
  var back = Enc.pnmParse(ppmBytes);
  eq('ppm: parse width', back.width, 6);
  eq('ppm: parse height', back.height, 4);
  var same = true;
  for (var i = 0; i < img.data.length; i++) if (img.data[i] !== back.data[i]) same = false;
  ok('ppm: exact round trip', same);
  var pgmBack = Enc.pnmParse(Blob.bytes(Enc.pgm(img)));
  eq('pgm: greyscale pixel is the luma', pgmBack.data[0], Math.round(0.299 * 0 + 0.587 * 0 + 0.114 * 128));
  var bw = makeImage(9, 2, function (x) { return x < 4 ? [0, 0, 0] : [255, 255, 255]; });
  var pbmBytes = Blob.bytes(Enc.pbm(bw));
  eq('pbm: header', ascii(pbmBytes, 0, 2), 'P4');
  var pbmBack = Enc.pnmParse(pbmBytes);
  ok('pbm: black pixels come back black, white white', pbmBack.data[0] === 0 && pbmBack.data[4 * 4] === 255 && pbmBack.data[8 * 4] === 255);
  var ascii3 = new TextEncoder().encode('P3\n# comment\n2 1\n255\n255 0 0  0 0 255\n');
  var a3 = Enc.pnmParse(ascii3);
  ok('pnm: ASCII P3 with a comment parses', a3.width === 2 && a3.data[0] === 255 && a3.data[6] === 255);
})();

(function () {
  var png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2, 3]).buffer;
  var u8 = Blob.bytes(Enc.icns([{ type: 'icp4', png: png }, { type: 'ic07', png: png }]));
  eq('icns: magic', ascii(u8, 0, 4), 'icns');
  eq('icns: total length field', (u8[4] << 24 | u8[5] << 16 | u8[6] << 8 | u8[7]) >>> 0, u8.length);
  eq('icns: first entry type', ascii(u8, 8, 4), 'icp4');
  eq('icns: first entry length includes its 8-byte header', u8[15], 8 + 7);
  eq('icns: second entry type', ascii(u8, 8 + 8 + 7, 4), 'ic07');
})();

(function () {
  var pk = function (n, v) { var d = new Uint8Array(n); for (var i = 0; i < n; i++) d[i] = v; return { data: d, samples: 960 }; };
  var u8 = Blob.bytes(Enc.oggOpus([pk(100, 1), pk(300, 2), pk(255, 3)], { channels: 1, preSkip: 312, inputSampleRate: 44100 }));
  eq('ogg: capture pattern', ascii(u8, 0, 4), 'OggS');
  eq('ogg: first page is beginning-of-stream', u8[5], 0x02);
  eq('ogg: OpusHead packet on page 1', ascii(u8, 28, 8), 'OpusHead');
  eq('ogg: OpusHead channel count', u8[28 + 9], 1);
  eq('ogg: OpusHead pre-skip', u8[28 + 10] | (u8[28 + 11] << 8), 312);
  // walk the pages, verifying each CRC recomputes to itself
  var p = 0, pages = 0, crcOk = true, lastFlags = -1, lastGranule = -1, lacings = null;
  while (p < u8.length) {
    var segs = u8[p + 26], bodyLen = 0;
    for (var i = 0; i < segs; i++) bodyLen += u8[p + 27 + i];
    var len = 27 + segs + bodyLen, page = u8.slice(p, p + len);
    var stored = (page[22] | page[23] << 8 | page[24] << 16 | page[25] << 24) >>> 0;
    page[22] = page[23] = page[24] = page[25] = 0;
    if (Enc.oggCrc(page) !== stored) crcOk = false;
    lastFlags = u8[p + 5];
    lastGranule = u8[p + 6] | u8[p + 7] << 8 | u8[p + 8] << 16;
    lacings = Array.prototype.slice.call(u8, p + 27, p + 27 + segs);
    pages++; p += len;
  }
  eq('ogg: page count (head, tags, audio)', pages, 3);
  ok('ogg: every page CRC verifies', crcOk);
  eq('ogg: last page is end-of-stream', lastFlags, 0x04);
  eq('ogg: final granule = total samples', lastGranule, 960 * 3);
  eq('ogg: 300-byte packet laces as 255 + 45, 255-byte as 255 + 0', JSON.stringify(lacings), JSON.stringify([100, 255, 45, 255, 0]));
})();

(function () {
  var P = Convert._pure;
  var sql = new TextDecoder().decode(Blob.bytes(P.toSql([{ sku: 'R1', price: 420, gold: true, note: "it's" }, { sku: 'R2', price: 9.5, gold: false, note: null }], 'stock list')));
  ok('sql: table name sanitised', /CREATE TABLE IF NOT EXISTS "stock_list"/.test(sql), sql.slice(0, 80));
  ok('sql: numeric column widened to REAL', /"price" REAL/.test(sql));
  ok('sql: boolean column typed', /"gold" BOOLEAN/.test(sql));
  ok('sql: quotes escaped', /'it''s'/.test(sql));
  ok('sql: null written as NULL', /, NULL\)/.test(sql));
  ok('sql: numbers unquoted', /\('R1', 420, TRUE/.test(sql));
})();

(function () {
  var P = Convert._pure;
  var mesh = P.parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nv 1 1 0\nf 1 2 3\nf 2 4 3\n');
  var text = P.meshToGltfText(mesh, 'ring');
  var json = JSON.parse(text);
  eq('gltf build: one primitive', json.meshes[0].primitives.length, 1);
  eq('gltf build: position count', json.accessors[0].count, 4);
  eq('gltf build: index count', json.accessors[1].count, 6);
  ok('gltf build: bounds', json.accessors[0].min[0] === 0 && json.accessors[0].max[1] === 1);
  eq('gltf build: index view is 4-byte aligned', json.bufferViews[1].byteOffset % 4, 0);
  var back = P.gltfToMesh(json, null);
  eq('gltf parse: vertices round-trip', back.pos.length, 4);
  eq('gltf parse: triangles round-trip', back.tris.length, 2);
  ok('gltf parse: last vertex preserved', back.pos[3][0] === 1 && back.pos[3][1] === 1);
  // node transform applied
  json.nodes[0].translation = [10, 0, 0]; json.nodes[0].scale = [2, 2, 2];
  var moved = P.gltfToMesh(json, null);
  ok('gltf parse: node translation + scale applied', moved.pos[1][0] === 12 && moved.pos[3][1] === 2, JSON.stringify(moved.pos[3]));
  // through GLB
  var glbBytes = Blob.bytes(P.gltfToGlb(P.meshToGltfText(mesh, 'ring')));
  var g = P.glbParse(glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength));
  var fromGlb = P.gltfToMesh(g.json, g.bin);
  eq('glb parse: triangles from BIN chunk', fromGlb.tris.length, 2);
  var u16 = P.gltfToMesh({ asset: {}, scenes: [{ nodes: [0] }], scene: 0, nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }],
    buffers: [{ byteLength: 42, uri: 'data:application/octet-stream;base64,' + P.b64FromBytes((function () { var b = new ArrayBuffer(42), dv = new DataView(b); [0,0,0, 1,0,0, 0,1,0].forEach(function (v, i) { dv.setFloat32(i * 4, v, true); }); dv.setUint16(36, 0, true); dv.setUint16(38, 1, true); dv.setUint16(40, 2, true); return new Uint8Array(b); })()) }] }, null);
  eq('gltf parse: uint16 indices', u16.tris.length, 1);
})();

(function () {
  var P = Convert._pure;
  var b = new ArrayBuffer(12 + 16 * 2), dv = new DataView(b);
  dv.setUint32(0, 0x00010000); dv.setUint16(4, 2);
  dv.setUint32(12, 0x68656164); dv.setUint32(20, 44); dv.setUint32(24, 54);     // 'head' @44, 54 bytes
  dv.setUint32(28, 0x676C7966); dv.setUint32(36, 100); dv.setUint32(40, 8);     // 'glyf' @100, 8 bytes
  var info = P.sfntTables(b);
  eq('sfnt: flavor', info.flavor, 0x00010000);
  eq('sfnt: two tables', info.tables.length, 2);
  eq('sfnt: head length', info.tables[0].length, 54);
  var threw = '';
  try { P.sfntTables(new ArrayBuffer(12)); } catch (e) { threw = e.message; }
  ok('sfnt: rejects a non-font', /not a TrueType/.test(threw));
  eq('avc: 720p uses Main 3.1', P.avcCodecFor(1280, 720), 'avc1.4d001f');
  eq('avc: 1080p uses High 4.0', P.avcCodecFor(1920, 1080), 'avc1.640028');
  eq('avc: 4K uses High 5.1', P.avcCodecFor(3840, 2160), 'avc1.640033');
})();

(function () {
  var cases = [['png', 'docx'], ['png', 'icns'], ['png', 'tga'], ['jxl', 'png'], ['ppm', 'jpg'], ['docx', 'tex'], ['docx', 'png'],
               ['csv', 'pdf'], ['csv', 'docx'], ['csv', 'sql'], ['json', 'toml'], ['toml', 'json'], ['obj', 'glb'], ['glb', 'stl']];
  var missing = cases.filter(function (c) { return !Convert.rule(c[0], c[1]); }).map(function (c) { return c.join('->'); });
  ok('graph: new pairs registered', missing.length === 0, 'missing ' + missing.join(', '));
  // these depend on browser capabilities the headless shell lacks; they must be absent here (pruned, not broken)
  var gated = [['ttf', 'woff'], ['zip', 'tgz'], ['mp3', 'm4a'], ['mp4', 'webm'], ['mov', 'mp4'], ['mp4', 'ogg']];
  var leaked = gated.filter(function (c) { return !!Convert.rule(c[0], c[1]); }).map(function (c) { return c.join('->'); });
  ok('graph: capability-gated pairs pruned without CompressionStream/WebCodecs', leaked.length === 0, 'still offered: ' + leaked.join(', '));
  REPORT.push('  --   graph: ' + Convert.pairCount() + ' pairs across ' + Convert.sourcesList().length + ' source formats (headless: no webp/audio/video probes)');
})();


/* the resolution a form checks for: it has to be in the bytes, not just on screen */
(function () {
  var I = this.Imaging || Imaging;

  // the smallest valid JPEG head: SOI + a JFIF APP0 that records nothing
  function jpegHead(units, dens) {
    return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00,
                           0x01, 0x01, units, dens >> 8, dens & 0xFF, dens >> 8, dens & 0xFF, 0x00, 0x00,
                           0xFF, 0xDA, 0x00, 0x02]);
  }
  eq('dpi: a canvas-style JPEG reports nothing', I.readDpi(jpegHead(0, 1)), null);
  eq('dpi: a JPEG that records 72 is read back', I.readDpi(jpegHead(1, 72)).x, 72);
  var stamped = I.setDpi(jpegHead(0, 1), 300);
  eq('dpi: writing 300 into a JPEG', I.readDpi(stamped).x, 300);
  eq('dpi: the JPEG keeps its length', stamped.length, jpegHead(0, 1).length);
  eq('dpi: centimetre units are converted to inches', I.readDpi(jpegHead(2, 118)).x, 300);

  // a JPEG with no JFIF header at all still ends up carrying one
  var bare = new Uint8Array([0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x02, 0xFF, 0xDA, 0x00, 0x02]);
  var fixed = I.setDpi(bare, 200);
  eq('dpi: a JFIF header is added when one is missing', I.readDpi(fixed).x, 200);
  ok('dpi: adding that header grew the file by 18 bytes', fixed.length === bare.length + 18,
     'grew by ' + (fixed.length - bare.length));

  // PNG: a pHYs chunk, in pixels per metre
  function png(chunks) {
    var head = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    return new Uint8Array(head.concat(chunks));
  }
  function chunk(type, len) {
    var out = [0, 0, 0, len];
    for (var i = 0; i < 4; i++) out.push(type.charCodeAt(i));
    for (i = 0; i < len; i++) out.push(0);
    return out.concat([0, 0, 0, 0]);
  }
  var p = png(chunk('IHDR', 13).concat(chunk('IDAT', 4), chunk('IEND', 0)));
  eq('dpi: a plain PNG reports nothing', I.readDpi(p), null);
  var pstamped = I.setDpi(p, 300);
  eq('dpi: writing 300 into a PNG', I.readDpi(pstamped).x, 300);
  ok('dpi: the pHYs chunk is 21 bytes', pstamped.length === p.length + 21,
     'grew by ' + (pstamped.length - p.length));
  var twice = I.setDpi(pstamped, 600);
  eq('dpi: rewriting a PNG replaces the chunk rather than adding one', twice.length, pstamped.length);
  eq('dpi: and the new number is the one read back', I.readDpi(twice).x, 600);

  // the shape of a straightened page
  var quad = [[0, 0], [400, 20], [390, 300], [10, 280]];
  var s = I.sizeFor(quad, 2600);
  ok('scan: the straightened page follows the longest edges', s.w >= 390 && s.h >= 280,
     s.w + 'x' + s.h);
  var capped = I.sizeFor([[0, 0], [8000, 0], [8000, 6000], [0, 6000]], 2600);
  ok('scan: an enormous photo is capped', Math.max(capped.w, capped.h) === 2600,
     capped.w + 'x' + capped.h);
  eq('scan: four points enclose the area they should', Math.round(I.polyArea([[0, 0], [10, 0], [10, 10], [0, 10]])), 100);
})();

REPORT.join('\n') + '\n\n' + (FAIL.length ? FAIL.length + ' FAILED, ' + PASS + ' passed' : 'all ' + PASS + ' checks passed');
