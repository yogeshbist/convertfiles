/* dump-graph.js — print the conversion graph as JSON, with browser capabilities
   stubbed as "supported" so the dump matches what a current Chrome offers.
   Run through test/dump-graph.sh; the result is committed as content/pairs.json
   so build.py (which must run on Linux CI) never needs a JS engine.          */
var fakeCanvas = {
  width: 1, height: 1,
  getContext: function () { return { drawImage: function () {}, fillRect: function () {}, getImageData: function () { return { data: [], width: 1, height: 1 }; }, putImageData: function () {} }; },
  toDataURL: function (mime) { return 'data:' + (mime || 'image/png') + ';base64,'; },
  toBlob: function () {}
};
document.createElement = function (tag) { return tag === 'canvas' ? fakeCanvas : { style: {}, setAttribute: function () {}, appendChild: function () {} }; };
var CompressionStream = function () {};
var DecompressionStream = function () {};
var AudioEncoder = function () {};
AudioEncoder.isConfigSupported = function () { return Promise.resolve({ supported: true }); };
var VideoEncoder = function () {};
VideoEncoder.isConfigSupported = function () { return Promise.resolve({ supported: true }); };
var MessageChannel = function () { this.port1 = { onmessage: null }; this.port2 = { postMessage: function () {} }; };
