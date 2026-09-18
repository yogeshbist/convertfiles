/* formats.js — extension metadata, family size caps, lazy CDN library loader. */
(function (root) {
  'use strict';

  // family -> { label, maxBytes }  (caps chosen for what a browser tab can hold in memory)
  var FAMILY = {
    image:   { label: 'Image',       max: 80  * 1024 * 1024 },
    doc:     { label: 'Document',    max: 60  * 1024 * 1024 },
    table:   { label: 'Spreadsheet', max: 60  * 1024 * 1024 },
    data:    { label: 'Data',        max: 120 * 1024 * 1024 },
    audio:   { label: 'Audio',       max: 250 * 1024 * 1024 },
    video:   { label: 'Video',       max: 600 * 1024 * 1024 },
    archive: { label: 'Archive',     max: 800 * 1024 * 1024 },
    model3d: { label: '3D / AR',     max: 250 * 1024 * 1024 },
    font:    { label: 'Font',        max: 40  * 1024 * 1024 },
    any:     { label: 'Any file',    max: 800 * 1024 * 1024 }
  };

  // ext -> [family, human name, mime]
  var EXT = {
    // ---- image
    png:['image','PNG image','image/png'], jpg:['image','JPEG image','image/jpeg'],
    jpeg:['image','JPEG image','image/jpeg'], jfif:['image','JPEG (JFIF)','image/jpeg'],
    webp:['image','WebP image','image/webp'], gif:['image','GIF image','image/gif'],
    bmp:['image','Windows bitmap','image/bmp'], dib:['image','Device-independent bitmap','image/bmp'],
    avif:['image','AVIF image','image/avif'], svg:['image','SVG vector','image/svg+xml'],
    ico:['image','Windows icon','image/x-icon'], tif:['image','TIFF image','image/tiff'],
    tiff:['image','TIFF image','image/tiff'], heic:['image','HEIC image (iPhone)','image/heic'],
    heif:['image','HEIF image','image/heif'], jxl:['image','JPEG XL image','image/jxl'],
    tga:['image','Truevision TGA','image/x-targa'], ppm:['image','Netpbm colour (PPM)','image/x-portable-pixmap'],
    pgm:['image','Netpbm greyscale (PGM)','image/x-portable-graymap'], pbm:['image','Netpbm bitmap (PBM)','image/x-portable-bitmap'],
    icns:['image','Apple icon set (ICNS)','image/icns'],
    // ---- documents
    txt:['doc','Plain text','text/plain'], md:['doc','Markdown','text/markdown'],
    markdown:['doc','Markdown','text/markdown'], html:['doc','HTML document','text/html'],
    htm:['doc','HTML document','text/html'], docx:['doc','Word document','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    odt:['doc','OpenDocument Text','application/vnd.oasis.opendocument.text'],
    rtf:['doc','Rich Text Format','application/rtf'], pdf:['doc','PDF document','application/pdf'],
    epub:['doc','EPUB publication','application/epub+zip'], log:['doc','Log file','text/plain'],
    tex:['doc','LaTeX source','application/x-tex'],
    // ---- spreadsheets
    xlsx:['table','Excel workbook','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    xls:['table','Excel 97–2003','application/vnd.ms-excel'],
    xlsm:['table','Excel macro-enabled','application/vnd.ms-excel.sheet.macroEnabled.12'],
    xlsb:['table','Excel binary workbook','application/vnd.ms-excel.sheet.binary.macroEnabled.12'],
    ods:['table','OpenDocument Spreadsheet','application/vnd.oasis.opendocument.spreadsheet'],
    fods:['table','Flat-XML spreadsheet','application/vnd.oasis.opendocument.spreadsheet'],
    csv:['table','Comma-separated values','text/csv'], tsv:['table','Tab-separated values','text/tab-separated-values'],
    dif:['table','Data Interchange Format','text/plain'], dbf:['table','dBase table','application/x-dbf'],
    prn:['table','Formatted print-to-file','text/plain'], slk:['table','SYLK','text/plain'],
    // ---- data
    json:['data','JSON','application/json'], jsonl:['data','JSON Lines','application/jsonl'],
    ndjson:['data','Newline-delimited JSON','application/x-ndjson'],
    yaml:['data','YAML','application/yaml'], yml:['data','YAML','application/yaml'],
    xml:['data','XML','application/xml'], toml:['data','TOML','application/toml'],
    sql:['data','SQL insert script','application/sql'],
    // ---- fonts
    ttf:['font','TrueType font','font/ttf'], otf:['font','OpenType font','font/otf'],
    woff:['font','Web Open Font Format','font/woff'],
    // ---- audio
    mp3:['audio','MP3 audio','audio/mpeg'], wav:['audio','WAV audio','audio/wav'],
    m4a:['audio','MPEG-4 audio (AAC)','audio/mp4'], aac:['audio','AAC audio (ADTS)','audio/aac'],
    ogg:['audio','Ogg Opus audio','audio/ogg'], oga:['audio','Ogg audio','audio/ogg'],
    opus:['audio','Opus audio','audio/opus'], flac:['audio','FLAC audio','audio/flac'],
    weba:['audio','WebM audio','audio/webm'], aiff:['audio','AIFF audio','audio/aiff'],
    // ---- video
    mp4:['video','MPEG-4 video (H.264)','video/mp4'], m4v:['video','Apple MPEG-4 video','video/x-m4v'],
    webm:['video','WebM video (VP9)','video/webm'], mov:['video','QuickTime movie','video/quicktime'],
    ogv:['video','Ogg video','video/ogg'],
    // ---- archives
    zip:['archive','ZIP archive','application/zip'], tar:['archive','Tape archive','application/x-tar'],
    gz:['archive','gzip','application/gzip'], tgz:['archive','gzipped tar','application/gzip'],
    // ---- 3D / AR
    obj:['model3d','Wavefront OBJ','model/obj'], stl:['model3d','STL mesh','model/stl'],
    ply:['model3d','Stanford PLY','application/octet-stream'],
    gltf:['model3d','glTF (JSON)','model/gltf+json'], glb:['model3d','glTF (binary)','model/gltf-binary']
  };

  function meta(ext) {
    var e = EXT[String(ext || '').toLowerCase().replace(/^\./, '')];
    return e ? { family: e[0], name: e[1], mime: e[2] } : { family: 'any', name: 'Unknown format', mime: 'application/octet-stream' };
  }
  function capFor(ext) { return FAMILY[meta(ext).family].max; }
  function extOf(filename) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(filename || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function bytes(n) {
    if (n === 0) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(n) / Math.log(1024));
    i = Math.min(i, u.length - 1);
    return (n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : (n / Math.pow(1024, i) < 10 ? 2 : 1)) + ' ' + u[i];
  }

  // ---- lazy library loader (primary CDN + fallback) --------------------------
  var LIBS = {
    pdfjs: { g: 'pdfjsLib',
      u: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'],
      after: function () {
        root.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      } },
    jspdf:    { g: 'jspdf',   u: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
                                  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'] },
    xlsx:     { g: 'XLSX',    u: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
                                  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'] },
    jszip:    { g: 'JSZip',   u: ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
                                  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'] },
    mammoth:  { g: 'mammoth', u: ['https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
                                  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'] },
    marked:   { g: 'marked',  u: ['https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js',
                                  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js'] },
    turndown: { g: 'TurndownService', u: ['https://cdn.jsdelivr.net/npm/turndown@7.1.2/dist/turndown.js',
                                  'https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.js'] },
    jsyaml:   { g: 'jsyaml',  u: ['https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js',
                                  'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js'] },
    utif:     { g: 'UTIF',    u: ['https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js'] },
    lamejs:   { g: 'lamejs',  u: ['https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js'] },
    // libheif compiled to WebAssembly (~1.3 MB); only fetched when the browser
    // itself cannot decode HEIC, i.e. Chrome, Edge and Firefox.
    heic2any: { g: 'heic2any', u: ['https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
                                   'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js'] },
    // ES modules, loaded with a dynamic import()
    toml:      { esm: 'https://cdn.jsdelivr.net/npm/smol-toml@1.3.1/+esm' },
    mp4muxer:  { esm: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.5/+esm' },
    webmmuxer: { esm: 'https://cdn.jsdelivr.net/npm/webm-muxer@5.0.2/+esm' },
    avif:      { esm: 'https://cdn.jsdelivr.net/npm/@jsquash/avif@2.1.1/+esm' },
    jxl:       { esm: 'https://cdn.jsdelivr.net/npm/@jsquash/jxl@1.2.0/+esm' }
  };
  var loaded = {};

  function inject(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function need(name) {
    var spec = LIBS[name];
    if (!spec) return Promise.reject(new Error('unknown library ' + name));
    if (loaded[name]) return loaded[name];
    if (spec.esm) {
      loaded[name] = import(spec.esm).catch(function () {
        delete loaded[name];
        throw new Error(name + ' module is unavailable — check your internet connection');
      });
      return loaded[name];
    }
    loaded[name] = (function () {
      if (root[spec.g]) { if (spec.after) spec.after(); return Promise.resolve(root[spec.g]); }
      var i = 0;
      function attempt() {
        if (i >= spec.u.length) return Promise.reject(new Error(name + ' is unavailable — check your internet connection'));
        return inject(spec.u[i++]).then(function () {
          if (!root[spec.g]) throw new Error('loaded but missing global');
          if (spec.after) spec.after();
          return root[spec.g];
        }, attempt);
      }
      return attempt();
    })();
    return loaded[name];
  }

  root.Formats = { FAMILY: FAMILY, EXT: EXT, meta: meta, capFor: capFor, extOf: extOf, bytes: bytes, need: need };
})(window);
