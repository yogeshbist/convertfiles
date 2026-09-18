/* shims.js — enough of the browser for headless testing of the pure encoders.
   Run with:  test/run.sh                                                     */
var window = this;

function Blob(parts, opts) {
  this.parts = parts || [];
  this.type = (opts && opts.type) || '';
  this.size = Blob.bytes(this).length;
}
Blob.bytes = function (b) {
  var out = [];
  (b.parts || []).forEach(function (p) {
    if (p instanceof Blob) { var inner = Blob.bytes(p); for (var i = 0; i < inner.length; i++) out.push(inner[i]); return; }
    if (typeof p === 'string') { for (var s = 0; s < p.length; s++) out.push(p.charCodeAt(s) & 0xff); return; }
    var u8 = p instanceof ArrayBuffer ? new Uint8Array(p)
           : (p.buffer ? new Uint8Array(p.buffer, p.byteOffset || 0, p.byteLength) : new Uint8Array(p));
    for (var j = 0; j < u8.length; j++) out.push(u8[j]);
  });
  return new Uint8Array(out);
};

function ImageData(data, w, h) {
  if (typeof data === 'number') { h = w; w = data; data = new Uint8ClampedArray(w * h * 4); }
  this.data = data; this.width = w; this.height = h;
}

function TextEncoder() {}
TextEncoder.prototype.encode = function (s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
};
function TextDecoder() {}
TextDecoder.prototype.decode = function (u8) {
  if (!u8) return '';
  var a = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8.buffer || u8), s = '', i = 0;
  while (i < a.length) {
    var c = a[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xE0) s += String.fromCharCode(((c & 31) << 6) | (a[i++] & 63));
    else s += String.fromCharCode(((c & 15) << 12) | ((a[i++] & 63) << 6) | (a[i++] & 63));
  }
  return s;
};

var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function btoa(s) {
  var out = '', i = 0;
  while (i < s.length) {
    var c1 = s.charCodeAt(i++), c2 = s.charCodeAt(i++), c3 = s.charCodeAt(i++);
    out += B64[c1 >> 2] + B64[((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)]
        + (isNaN(c2) ? '=' : B64[((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6)])
        + (isNaN(c3) ? '=' : B64[c3 & 63]);
  }
  return out;
}
function atob(s) {
  s = String(s).replace(/[^A-Za-z0-9+/]/g, '');
  var out = '', i = 0;
  while (i < s.length) {
    var e1 = B64.indexOf(s[i++]), e2 = B64.indexOf(s[i++]), e3 = B64.indexOf(s[i++]), e4 = B64.indexOf(s[i++]);
    out += String.fromCharCode((e1 << 2) | (e2 >> 4));
    if (e3 >= 0) out += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 >= 0) out += String.fromCharCode(((e3 & 3) << 6) | e4);
  }
  return out;
}

var document = { createElement: function () { throw new Error('DOM not available headlessly'); }, head: { appendChild: function () {} }, dispatchEvent: function () {} };
var Event = function (n) { this.type = n; };
var navigator = { storage: null };
var crypto = { randomUUID: function () { return 'test-uuid'; } };
var DOMParser = function () {};
var URL = { createObjectURL: function () { return 'blob:test'; }, revokeObjectURL: function () {} };
