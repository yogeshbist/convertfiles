/* imaging.js — the picture mathematics the scanner and the DPI tool need:
   finding the page in a photograph, straightening it, making it look like a
   scan, and writing a real resolution into the file.

   All of it runs on the device, like everything else here. Nothing in this
   file touches the network. */
(function (root) {
  'use strict';

  function canvasOf(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function ctxOf(c, readable) {
    return c.getContext('2d', readable ? { willReadFrequently: true } : undefined);
  }
  function dataOf(c) { return ctxOf(c, true).getImageData(0, 0, c.width, c.height); }

  /* ------------------------------------------------------ finding the page */

  // A smaller copy to think about; full resolution is only needed at the end.
  function shrink(src, to) {
    var s = Math.min(1, to / Math.max(src.width, src.height));
    var c = canvasOf(src.width * s, src.height * s);
    ctxOf(c).drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function luma(img) {
    var n = img.width * img.height, g = new Uint8ClampedArray(n), d = img.data;
    for (var i = 0, j = 0; i < n; i++, j += 4) {
      g[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000;
    }
    return g;
  }

  // Otsu: the brightness that best separates a picture into two groups. For a
  // document on a table that is almost always paper against everything else.
  function otsu(grey) {
    var hist = new Float64Array(256), i;
    for (i = 0; i < grey.length; i++) hist[grey[i]]++;
    var total = grey.length, sum = 0;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0, wB = 0, best = 0, cut = 127;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; cut = i; }
    }
    return cut;
  }

  /// The four corners of the largest pale shape, in page order: top-left,
  /// top-right, bottom-right, bottom-left, in the source image's own pixels.
  /// Returns null when nothing convincing is there, and the caller falls back
  /// to the whole frame — which the person can then drag into place.
  function detectQuad(src) {
    var small = shrink(src, 360), w = small.width, h = small.height;
    var grey = luma(dataOf(small));
    var cut = otsu(grey);
    var mask = new Uint8Array(w * h), i;
    for (i = 0; i < mask.length; i++) mask[i] = grey[i] > cut ? 1 : 0;

    // the biggest pale blob, found without recursion so a big photo cannot
    // blow the stack
    var seen = new Int32Array(w * h), label = 0, bestLabel = 0, bestSize = 0;
    var stack = new Int32Array(w * h);
    for (i = 0; i < mask.length; i++) {
      if (!mask[i] || seen[i]) continue;
      label++;
      var top = 0, size = 0;
      stack[top++] = i;
      seen[i] = label;
      while (top) {
        var p = stack[--top]; size++;
        var x = p % w, y = (p / w) | 0;
        if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = label; stack[top++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = label; stack[top++] = p + 1; }
        if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = label; stack[top++] = p - w; }
        if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = label; stack[top++] = p + w; }
      }
      if (size > bestSize) { bestSize = size; bestLabel = label; }
    }
    // too small to be the page someone photographed
    if (bestSize < w * h * 0.12) return null;

    // the extreme points of that blob along both diagonals are its corners
    var tl = null, tr = null, br = null, bl = null;
    var minSum = 1e9, maxSum = -1e9, minDiff = 1e9, maxDiff = -1e9;
    for (i = 0; i < seen.length; i++) {
      if (seen[i] !== bestLabel) continue;
      var px = i % w, py = (i / w) | 0;
      var s = px + py, d = px - py;
      if (s < minSum) { minSum = s; tl = [px, py]; }
      if (s > maxSum) { maxSum = s; br = [px, py]; }
      if (d > maxDiff) { maxDiff = d; tr = [px, py]; }
      if (d < minDiff) { minDiff = d; bl = [px, py]; }
    }
    if (!tl || !tr || !br || !bl) return null;

    var k = src.width / w;
    var quad = [tl, tr, br, bl].map(function (p) { return [p[0] * k, p[1] * k]; });

    // a quad that is basically the whole frame tells us nothing
    var area = polyArea(quad), full = src.width * src.height;
    if (area > full * 0.985 || area < full * 0.08) return null;
    return quad;
  }

  function polyArea(q) {
    var a = 0;
    for (var i = 0; i < q.length; i++) {
      var j = (i + 1) % q.length;
      a += q[i][0] * q[j][1] - q[j][0] * q[i][1];
    }
    return Math.abs(a) / 2;
  }

  function dist(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  /// How big the straightened page should be: the longest opposite edges,
  /// so nothing in the picture is squeezed.
  function sizeFor(quad, cap) {
    var w = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
    var h = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
    cap = cap || 2600;
    var s = Math.min(1, cap / Math.max(w, h));
    return { w: Math.max(16, Math.round(w * s)), h: Math.max(16, Math.round(h * s)) };
  }

  /* ------------------------------------------------- straightening the page */

  /// Pull a four-cornered shape out of a photograph and lay it flat.
  /// The mapping is projective — the far edge of a page photographed at an
  /// angle really is narrower, and simply cropping cannot undo that.
  function warpQuad(src, quad, outW, outH) {
    var out = canvasOf(outW, outH);
    var sctx = ctxOf(src, true);
    var simg = sctx.getImageData(0, 0, src.width, src.height);
    var sd = simg.data, sw = src.width, sh = src.height;
    var octx = ctxOf(out, true);
    var oimg = octx.createImageData(outW, outH), od = oimg.data;

    // unit square -> quad (Heckbert). x0..x3 run top-left, top-right,
    // bottom-right, bottom-left.
    var x0 = quad[0][0], y0 = quad[0][1], x1 = quad[1][0], y1 = quad[1][1];
    var x2 = quad[2][0], y2 = quad[2][1], x3 = quad[3][0], y3 = quad[3][1];
    var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    var a11, a21, a31, a12, a22, a32, a13, a23;
    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
      a11 = x1 - x0; a21 = x2 - x1; a31 = x0;
      a12 = y1 - y0; a22 = y2 - y1; a32 = y0;
      a13 = 0; a23 = 0;
    } else {
      var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
      var den = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(den) < 1e-9) den = 1e-9;
      a13 = (sx * dy2 - sy * dx2) / den;
      a23 = (dx1 * sy - dy1 * sx) / den;
      a11 = x1 - x0 + a13 * x1; a21 = x3 - x0 + a23 * x3; a31 = x0;
      a12 = y1 - y0 + a13 * y1; a22 = y3 - y0 + a23 * y3; a32 = y0;
    }

    for (var oy = 0; oy < outH; oy++) {
      var v = (oy + 0.5) / outH;
      for (var ox = 0; ox < outW; ox++) {
        var u = (ox + 0.5) / outW;
        var wgt = a13 * u + a23 * v + 1;
        var fx = (a11 * u + a21 * v + a31) / wgt;
        var fy = (a12 * u + a22 * v + a32) / wgt;
        var o = (oy * outW + ox) * 4;
        if (fx < 0 || fy < 0 || fx > sw - 1 || fy > sh - 1) {
          od[o] = od[o + 1] = od[o + 2] = 255; od[o + 3] = 255;
          continue;
        }
        // bilinear, so text edges do not turn to staircases
        var ix = fx | 0, iy = fy | 0;
        var tx = fx - ix, ty = fy - iy;
        var ix2 = Math.min(sw - 1, ix + 1), iy2 = Math.min(sh - 1, iy + 1);
        var p00 = (iy * sw + ix) * 4, p10 = (iy * sw + ix2) * 4;
        var p01 = (iy2 * sw + ix) * 4, p11 = (iy2 * sw + ix2) * 4;
        var w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty);
        var w01 = (1 - tx) * ty, w11 = tx * ty;
        for (var ch = 0; ch < 3; ch++) {
          od[o + ch] = sd[p00 + ch] * w00 + sd[p10 + ch] * w10 +
                       sd[p01 + ch] * w01 + sd[p11 + ch] * w11;
        }
        od[o + 3] = 255;
      }
    }
    octx.putImageData(oimg, 0, 0);
    return out;
  }

  /* ------------------------------------------------- making it look scanned */

  // running sums, so a box blur of any size costs the same
  function integral(grey, w, h) {
    var sum = new Float64Array((w + 1) * (h + 1));
    for (var y = 0; y < h; y++) {
      var row = 0;
      for (var x = 0; x < w; x++) {
        row += grey[y * w + x];
        sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
      }
    }
    return sum;
  }
  function boxMean(sum, w, h, x, y, r) {
    var x0 = Math.max(0, x - r), y0 = Math.max(0, y - r);
    var x1 = Math.min(w - 1, x + r), y1 = Math.min(h - 1, y + r);
    var area = (x1 - x0 + 1) * (y1 - y0 + 1);
    var s = sum[(y1 + 1) * (w + 1) + x1 + 1] - sum[y0 * (w + 1) + x1 + 1] -
            sum[(y1 + 1) * (w + 1) + x0] + sum[y0 * (w + 1) + x0];
    return s / area;
  }

  // where the bulk of the brightness sits, ignoring the darkest and brightest
  // 2% so one glare spot cannot set the range
  function stretchBounds(grey) {
    var hist = new Uint32Array(256), i;
    for (i = 0; i < grey.length; i++) hist[grey[i]]++;
    var lowCut = grey.length * 0.02, highCut = grey.length * 0.02;
    var acc = 0, lo = 0, hi = 255;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > lowCut) { lo = i; break; } }
    acc = 0;
    for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > highCut) { hi = i; break; } }
    if (hi - lo < 16) { lo = 0; hi = 255; }
    return [lo, hi];
  }

  /// Four ways to finish a scan, matching what people expect from a scanner
  /// app: leave the colour alone, lift it, drop to grey, or go to clean
  /// black and white.
  ///   'original'  nothing but the straightening
  ///   'colour'    shadows removed, colour kept — the everyday choice
  ///   'grey'      greyscale with the contrast opened up
  ///   'bw'        black and white by local threshold, like a real scanner
  function enhance(canvas, mode) {
    if (mode === 'original') return canvas;
    var w = canvas.width, h = canvas.height;
    var ctx = ctxOf(canvas, true);
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    var grey = luma(img), i, j;

    if (mode === 'bw') {
      var sum = integral(grey, w, h);
      var r = Math.max(8, Math.round(Math.min(w, h) / 24));
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          i = y * w + x;
          var mean = boxMean(sum, w, h, x, y, r);
          // a small bias keeps faint paper texture from turning into speckle
          var v = grey[i] < mean - 8 ? 0 : 255;
          j = i * 4;
          d[j] = d[j + 1] = d[j + 2] = v;
        }
      }
      ctx.putImageData(img, 0, 0);
      return canvas;
    }

    // divide by a heavily blurred copy: that background is the shadow and the
    // uneven lamp, and dividing it out is what makes a photo look scanned
    var bg = integral(grey, w, h);
    var br = Math.max(12, Math.round(Math.min(w, h) / 8));
    var flat = new Uint8ClampedArray(w * h);
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        i = yy * w + xx;
        var b = boxMean(bg, w, h, xx, yy, br) || 1;
        flat[i] = Math.min(255, grey[i] / b * 210);
      }
    }
    var bounds = stretchBounds(flat), lo = bounds[0], hi = bounds[1];
    var scale = 255 / (hi - lo);

    for (i = 0; i < flat.length; i++) {
      j = i * 4;
      var target = Math.min(255, Math.max(0, (flat[i] - lo) * scale));
      if (mode === 'grey') {
        d[j] = d[j + 1] = d[j + 2] = target;
      } else {
        // keep the hue, move the brightness: ink stays black, paper goes white
        var was = grey[i] || 1, gain = target / was;
        d[j] = Math.min(255, d[j] * gain);
        d[j + 1] = Math.min(255, d[j + 1] * gain);
        d[j + 2] = Math.min(255, d[j + 2] * gain);
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /* ------------------------------------------------------------ resolution */

  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes, from, to) {
    var c = 0xFFFFFFFF;
    for (var i = from; i < to; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /// What a file says its resolution is, or null when it does not say.
  /// A picture from a canvas never says, which is exactly why the DPI tool
  /// has to exist.
  function readDpi(bytes) {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      var i = 2;
      while (i < bytes.length - 4) {
        if (bytes[i] !== 0xFF) { i++; continue; }
        var marker = bytes[i + 1];
        if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
        var len = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker === 0xE0 && bytes[i + 4] === 0x4A && bytes[i + 5] === 0x46) {
          var units = bytes[i + 11];
          var x = (bytes[i + 12] << 8) | bytes[i + 13];
          var y = (bytes[i + 14] << 8) | bytes[i + 15];
          if (!units || !x) return null;                       // "aspect ratio only"
          return units === 2
            ? { x: Math.round(x * 2.54), y: Math.round(y * 2.54), unit: 'cm' }
            : { x: x, y: y, unit: 'in' };
        }
        if (marker === 0xDA) break;
        i += 2 + len;
      }
      return null;
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      var p = 8;
      while (p < bytes.length - 8) {
        var clen = (bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3]) >>> 0;
        var type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
        if (type === 'pHYs') {
          var ppuX = (bytes[p + 8] << 24 | bytes[p + 9] << 16 | bytes[p + 10] << 8 | bytes[p + 11]) >>> 0;
          var unit = bytes[p + 16];
          if (unit !== 1 || !ppuX) return null;
          return { x: Math.round(ppuX * 0.0254), y: Math.round(ppuX * 0.0254), unit: 'in' };
        }
        if (type === 'IDAT' || type === 'IEND') break;
        p += 12 + clen;
      }
      return null;
    }
    return null;
  }

  /// Write a real resolution into the bytes. A JPEG gets it in its JFIF
  /// header, a PNG in a pHYs chunk — the two places every form checker,
  /// print shop and photo editor actually reads.
  function setDpi(bytes, dpi) {
    dpi = Math.max(1, Math.min(65535, Math.round(dpi)));
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return jpegDpi(bytes, dpi);
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return pngDpi(bytes, dpi);
    return bytes;
  }

  function jpegDpi(bytes, dpi) {
    var i = 2;
    while (i < bytes.length - 4) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      var marker = bytes[i + 1];
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      var len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker === 0xE0 && bytes[i + 4] === 0x4A && bytes[i + 5] === 0x46) {
        var out = bytes.slice();
        out[i + 11] = 1;                       // units: dots per inch
        out[i + 12] = dpi >> 8; out[i + 13] = dpi & 0xFF;
        out[i + 14] = dpi >> 8; out[i + 15] = dpi & 0xFF;
        return out;
      }
      if (marker === 0xDA) break;
      i += 2 + len;
    }
    // no JFIF header at all: put one in, right after the start marker
    var app0 = [0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
                1, dpi >> 8, dpi & 0xFF, dpi >> 8, dpi & 0xFF, 0x00, 0x00];
    var res = new Uint8Array(bytes.length + app0.length);
    res.set(bytes.subarray(0, 2), 0);
    res.set(app0, 2);
    res.set(bytes.subarray(2), 2 + app0.length);
    return res;
  }

  function pngDpi(bytes, dpi) {
    var ppu = Math.round(dpi / 0.0254);
    var chunk = new Uint8Array(21);
    var dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9);
    chunk[4] = 0x70; chunk[5] = 0x48; chunk[6] = 0x59; chunk[7] = 0x73;   // pHYs
    dv.setUint32(8, ppu); dv.setUint32(12, ppu);
    chunk[16] = 1;                                                        // metres
    dv.setUint32(17, crc32(chunk, 4, 17));

    var p = 8, out;
    while (p < bytes.length - 8) {
      var clen = (bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3]) >>> 0;
      var type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      if (type === 'pHYs') {
        out = new Uint8Array(bytes.length);
        out.set(bytes.subarray(0, p), 0);
        out.set(chunk, p);
        out.set(bytes.subarray(p + 12 + clen), p + 21);
        return out.subarray(0, bytes.length - (12 + clen) + 21);
      }
      if (type === 'IDAT') {
        out = new Uint8Array(bytes.length + 21);
        out.set(bytes.subarray(0, p), 0);
        out.set(chunk, p);
        out.set(bytes.subarray(p), p + 21);
        return out;
      }
      if (type === 'IEND') break;
      p += 12 + clen;
    }
    return bytes;
  }

  /// Re-save a blob with the resolution written in.
  function blobWithDpi(blob, dpi) {
    return blob.arrayBuffer().then(function (ab) {
      var stamped = setDpi(new Uint8Array(ab), dpi);
      return new Blob([stamped], { type: blob.type });
    });
  }

  root.Imaging = {
    detectQuad: detectQuad, warpQuad: warpQuad, enhance: enhance,
    sizeFor: sizeFor, polyArea: polyArea, dist: dist,
    readDpi: readDpi, setDpi: setDpi, blobWithDpi: blobWithDpi,
    canvasOf: canvasOf
  };
})(window);
