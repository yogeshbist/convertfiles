/* convert.js — the conversion graph. Rules register from-set -> to-set; first
   registration for a pair wins, so specific rules go before catch-alls.      */
(function (root) {
  'use strict';
  var need = root.Formats.need, Enc = root.Enc, DM = root.DocModel;

  var G = {};                 // from -> { to -> rule }
  function add(froms, tos, run, ui, note) {
    froms.forEach(function (f) {
      G[f] = G[f] || {};
      tos.forEach(function (t) {
        if (f === t || G[f][t]) return;
        G[f][t] = { run: run, ui: ui || [], note: note || '' };
      });
    });
  }

  /* ---------------------------------------------------------------- utils */
  function baseName(name) { return String(name).replace(/\.[A-Za-z0-9]+$/, '') || 'converted'; }
  function blobText(b) { return b.text ? b.text() : new Response(b).text(); }
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('the browser could not decode this image')); };
      img.src = src;
    });
  }
  function canvasOf(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function toBlob(canvas, mime, q) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) {
        if (!b) return rej(new Error('this browser cannot write ' + mime));
        if (b.type && mime && b.type !== mime) return rej(new Error('this browser cannot write ' + mime));
        res(b);
      }, mime, q);
    });
  }
  function imageDataOf(canvas) { return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height); }
  function concatBytes(parts) {
    var n = 0; parts.forEach(function (p) { n += p.length; });
    var out = new Uint8Array(n), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }
  function chunkBytes(chunk) { var u8 = new Uint8Array(chunk.byteLength); chunk.copyTo(u8); return u8; }
  function even(n) { return Math.max(2, Math.round(n / 2) * 2); }

  /* ------------------------------------------------------- image decoding */
  function decodeImage(ctx) {
    var file = ctx.file, ext = ctx.from;
    if (ext === 'tif' || ext === 'tiff') {
      return need('utif').then(function (UTIF) {
        return file.arrayBuffer().then(function (ab) {
          var ifds = UTIF.decode(ab);
          if (!ifds.length) throw new Error('no image found in this TIFF');
          UTIF.decodeImage(ab, ifds[0], ifds);
          var rgba = UTIF.toRGBA8(ifds[0]), w = ifds[0].width, h = ifds[0].height;
          var c = canvasOf(w, h);
          c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
          return c;
        });
      });
    }
    if (ext === 'ppm' || ext === 'pgm' || ext === 'pbm') {
      return file.arrayBuffer().then(function (ab) {
        var im = Enc.pnmParse(new Uint8Array(ab)), c = canvasOf(im.width, im.height);
        c.getContext('2d').putImageData(new ImageData(im.data, im.width, im.height), 0, 0);
        return c;
      });
    }
    if (ext === 'jxl') {
      return nativeDecode(file).catch(function () {
        ctx.log('decoding JPEG XL with the WebAssembly decoder');
        return need('jxl').then(function (m) { return file.arrayBuffer().then(function (ab) { return m.decode(ab); }); })
          .then(function (im) {
            var c = canvasOf(im.width, im.height);
            c.getContext('2d').putImageData(im, 0, 0);
            return c;
          });
      });
    }
    if (ext === 'svg') {
      return blobText(file).then(function (svg) {
        var box = /viewBox\s*=\s*["']([\d.\-\s]+)["']/.exec(svg);
        var wAttr = /\swidth\s*=\s*["']([\d.]+)/.exec(svg), hAttr = /\sheight\s*=\s*["']([\d.]+)/.exec(svg);
        var w = wAttr ? parseFloat(wAttr[1]) : 0, h = hAttr ? parseFloat(hAttr[1]) : 0;
        if ((!w || !h) && box) { var p = box[1].trim().split(/[\s,]+/).map(Number); w = p[2]; h = p[3]; }
        if (!w || !h) { w = 1024; h = 1024; }
        var target = ctx.opts.width || Math.min(2048, Math.round(w));
        var scale = target / w;
        var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        return loadImg(url).then(function (img) {
          var c = canvasOf(w * scale, h * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          return c;
        }, function (e) { URL.revokeObjectURL(url); throw e; });
      });
    }
    if (ext === 'heic' || ext === 'heif') {
      // Safari decodes HEIC natively; every other browser needs the wasm decoder.
      return nativeDecode(file).catch(function () {
        if (!root.heic2any) ctx.log('this browser has no built-in HEIC decoder — fetching one (1.3 MB, first time only)');
        return need('heic2any').then(function (heic2any) {
          ctx.log('decoding HEIC');
          return heic2any({ blob: file, toType: 'image/png' });
        }).then(function (out) {
          var png = Array.isArray(out) ? out[0] : out;      // bursts / live photos: first frame
          return nativeDecode(png);
        }).catch(function (e) {
          var why = e && e.message ? String(e.message) : '';
          throw new Error('could not decode this HEIC file' + (why ? ' — ' + why : ''));
        });
      });
    }
    return nativeDecode(file).catch(function () {
      throw new Error('this browser cannot decode ' + ext.toUpperCase() + ' images');
    });
  }

  // createImageBitmap first, <img> as the fallback; rejects if neither can read it.
  function nativeDecode(blob) {
    var p = (root.createImageBitmap ? createImageBitmap(blob) : Promise.reject())
      .then(function (bmp) {
        var c = canvasOf(bmp.width, bmp.height);
        c.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close && bmp.close();
        return c;
      });
    return p.catch(function () {
      var url = URL.createObjectURL(blob);
      return loadImg(url).then(function (img) {
        var c = canvasOf(img.naturalWidth || img.width, img.naturalHeight || img.height);
        c.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        return c;
      }, function (e) {
        URL.revokeObjectURL(url);
        throw e;
      });
    });
  }

  function resize(canvas, width) {
    if (!width || width >= canvas.width) return canvas;
    var c = canvasOf(width, canvas.height * (width / canvas.width));
    var g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(canvas, 0, 0, c.width, c.height);
    return c;
  }
  function flatten(canvas, bg) {
    var c = canvasOf(canvas.width, canvas.height), g = c.getContext('2d');
    g.fillStyle = bg || '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(canvas, 0, 0);
    return c;
  }
  function squareCanvas(canvas, side) {
    var c = canvasOf(side, side), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    var s = Math.min(side / canvas.width, side / canvas.height), w = canvas.width * s, h = canvas.height * s;
    g.drawImage(canvas, (side - w) / 2, (side - h) / 2, w, h);
    return c;
  }

  /* ---------------------------------------------------- image re-encoding */
  function encodeCanvas(canvas, to, opts) {
    var q = typeof opts.quality === 'number' ? opts.quality : 0.92;
    if (to === 'png') return toBlob(canvas, 'image/png');
    if (to === 'jpg' || to === 'jpeg' || to === 'jfif') return toBlob(flatten(canvas, opts.matte), 'image/jpeg', q);
    if (to === 'webp') return toBlob(canvas, 'image/webp', q);
    if (to === 'avif') {
      return need('avif').then(function (m) { return m.encode(imageDataOf(canvas), { quality: Math.round(q * 100), speed: 6 }); })
        .then(function (ab) { return new Blob([ab], { type: 'image/avif' }); });
    }
    if (to === 'jxl') {
      return need('jxl').then(function (m) { return m.encode(imageDataOf(canvas), { quality: Math.round(q * 100) }); })
        .then(function (ab) { return new Blob([ab], { type: 'image/jxl' }); });
    }
    if (to === 'bmp' || to === 'dib') return Promise.resolve(Enc.bmp(imageDataOf(canvas)));
    if (to === 'tga') return Promise.resolve(Enc.tga(imageDataOf(canvas)));
    if (to === 'ppm') return Promise.resolve(Enc.ppm(imageDataOf(canvas)));
    if (to === 'pgm') return Promise.resolve(Enc.pgm(imageDataOf(canvas)));
    if (to === 'pbm') return Promise.resolve(Enc.pbm(imageDataOf(canvas)));
    if (to === 'gif') {
      var g = resize(canvas, Math.min(canvas.width, opts.width || canvas.width));
      return Promise.resolve(Enc.gif([{ imageData: imageDataOf(g), delayMs: 100 }], { dither: opts.dither !== false }));
    }
    if (to === 'ico') {
      // don't upscale: a 32px source stays 32px, a photo caps at the 256px max.
      var side = Math.min(256, opts.iconSize || Math.max(canvas.width, canvas.height));
      return toBlob(squareCanvas(canvas, side), 'image/png').then(function (png) {
        return png.arrayBuffer().then(function (ab) { return Enc.ico([ab], [side]); });
      });
    }
    if (to === 'icns') {
      var biggest = Math.max(canvas.width, canvas.height);
      var sizes = [16, 32, 64, 128, 256, 512, 1024].filter(function (s) { return s <= Math.max(128, biggest); });
      return Promise.all(sizes.map(function (s) {
        return toBlob(squareCanvas(canvas, s), 'image/png').then(function (b) { return b.arrayBuffer(); })
          .then(function (ab) { return { type: Enc.ICNS_TYPES[s], png: ab }; });
      })).then(Enc.icns);
    }
    if (to === 'tif' || to === 'tiff') {
      return need('utif').then(function (UTIF) {
        var d = imageDataOf(canvas);
        return new Blob([UTIF.encodeImage(d.data.buffer, canvas.width, canvas.height)], { type: 'image/tiff' });
      });
    }
    if (to === 'svg') {
      return toBlob(canvas, 'image/png').then(function (png) {
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () {
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvas.width + '" height="' + canvas.height +
              '" viewBox="0 0 ' + canvas.width + ' ' + canvas.height + '">' +
              '<image width="' + canvas.width + '" height="' + canvas.height + '" href="' + fr.result + '"/></svg>';
            res(new Blob([svg], { type: 'image/svg+xml' }));
          };
          fr.readAsDataURL(png);
        });
      });
    }
    return Promise.reject(new Error('no encoder for .' + to));
  }

  function canvasesToPdf(canvases, opts) {
    return need('jspdf').then(function (ns) {
      var JsPDF = ns.jsPDF || ns.default || ns, pdf = null;
      canvases.forEach(function (c) {
        var landscape = c.width > c.height;
        if (!pdf) pdf = new JsPDF({ unit: 'pt', format: opts.pageSize || 'a4', orientation: landscape ? 'l' : 'p', compress: true });
        else pdf.addPage(opts.pageSize || 'a4', landscape ? 'l' : 'p');
        var W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), M = 24;
        var s = Math.min((W - M * 2) / c.width, (H - M * 2) / c.height);
        var w = c.width * s, h = c.height * s;
        pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', (W - w) / 2, (H - h) / 2, w, h);
      });
      return pdf.output('blob');
    });
  }

  // Rasterise a PDF blob: one image, or a zip of page images.
  function renderPdf(pdfBlob, name, ctx) {
    return need('pdfjs').then(function (pdfjsLib) {
      return pdfBlob.arrayBuffer().then(function (ab) { return pdfjsLib.getDocument({ data: ab }).promise; });
    }).then(function (pdf) {
      var total = Math.min(pdf.numPages, 300);
      var pages = ctx.opts.allPages === false ? 1 : total;
      var scale = Math.max(0.5, Math.min(4, ctx.opts.scale || 2));
      var jobs = [], chain = Promise.resolve();
      for (var i = 1; i <= pages; i++) {
        (function (n) {
          chain = chain.then(function () {
            return pdf.getPage(n).then(function (page) {
              var vp = page.getViewport({ scale: scale });
              var c = canvasOf(vp.width, vp.height);
              // intent 'print' keeps pdf.js off requestAnimationFrame, so a page
              // still rasterises while this tab is in the background.
              return page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise.then(function () {
                ctx.progress(n / pages, 'rendered page ' + n + ' of ' + pages);
                return encodeCanvas(resize(c, ctx.opts.width), ctx.to, ctx.opts).then(function (b) {
                  jobs.push({ name: name + '-p' + String(n).padStart(3, '0') + '.' + ctx.to, blob: b });
                });
              });
            });
          });
        })(i);
      }
      return chain.then(function () {
        if (jobs.length === 1) return { blob: jobs[0].blob };
        ctx.log(jobs.length + ' pages rendered — bundling as a zip');
        return Promise.all(jobs.map(function (j) { return j.blob.arrayBuffer().then(function (a) { return { name: j.name, data: new Uint8Array(a) }; }); }))
          .then(entriesToZip).then(function (b) { return { blob: b, ext: 'zip' }; });
      });
    });
  }

  /* ------------------------------------------------------------ documents */
  var DOC_IN = ['txt', 'log', 'md', 'markdown', 'html', 'htm', 'docx', 'odt', 'rtf', 'pdf', 'epub'];
  var DOC_OUT = ['txt', 'md', 'html', 'pdf', 'docx', 'odt', 'rtf', 'epub', 'tex'];

  function loadDoc(ctx) {
    var f = ctx.file, base = baseName(f.name);
    switch (ctx.from) {
      case 'txt': case 'log': return blobText(f).then(function (t) { return DM.fromText(t, base); });
      case 'md': case 'markdown': return blobText(f).then(function (t) { return DM.fromMarkdown(t, base); });
      case 'html': case 'htm': return blobText(f).then(function (t) { return DM.fromHTML(t); });
      case 'rtf': return blobText(f).then(function (t) { return DM.fromRtf(t, base); });
      case 'docx': return DM.fromDocx(f, base);
      case 'odt': return DM.fromOdt(f, base);
      case 'epub': return DM.fromEpub(f, base);
      case 'pdf': return DM.fromPdf(f, base, ctx.progress);
      default: return blobText(f).then(function (t) { return DM.fromText(t, base); });
    }
  }
  function saveDoc(doc, to, opts) {
    return DM.prepareImages(doc).then(function () {
      switch (to) {
        case 'txt': return DM.toText(doc);
        case 'md': return DM.toMarkdown(doc);
        case 'html': return DM.toHTML(doc);
        case 'rtf': return DM.toRtf(doc);
        case 'tex': return DM.toTex(doc);
        case 'docx': return DM.toDocx(doc);
        case 'odt': return DM.toOdt(doc);
        case 'epub': return DM.toEpub(doc);
        case 'pdf': return DM.toPdf(doc, opts);
        default: throw new Error('no writer for .' + to);
      }
    });
  }

  /* --------------------------------------------------------- spreadsheets */
  var TABLE_IN = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'fods', 'csv', 'tsv', 'dif', 'dbf', 'prn', 'slk'];
  var TABLE_OUT = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'fods', 'csv', 'tsv', 'dif', 'dbf', 'prn', 'slk', 'html', 'rtf'];
  var BOOKTYPE = { xlsx: 'xlsx', xlsm: 'xlsm', xlsb: 'xlsb', xls: 'biff8', ods: 'ods', fods: 'fods', csv: 'csv', dif: 'dif', dbf: 'dbf', prn: 'prn', slk: 'sylk', html: 'html', txt: 'txt', rtf: 'rtf' };

  function readWorkbook(ctx) {
    return need('xlsx').then(function (XLSX) {
      return ctx.file.arrayBuffer().then(function (ab) {
        return XLSX.read(ab, { type: 'array', cellDates: true, raw: false });
      });
    });
  }
  function firstSheet(XLSX, wb) { return wb.Sheets[wb.SheetNames[0]]; }
  function sheetFromRows(XLSX, rows) {
    if (Array.isArray(rows) && rows.length && !Array.isArray(rows[0]) && typeof rows[0] === 'object' && rows[0] !== null) {
      return XLSX.utils.json_to_sheet(rows);
    }
    if (!Array.isArray(rows)) rows = [rows];
    return XLSX.utils.aoa_to_sheet(rows.map(function (r) { return Array.isArray(r) ? r : [r]; }));
  }
  function bookOut(XLSX, wb, to) {
    if (to === 'tsv') {
      return new Blob([XLSX.utils.sheet_to_csv(firstSheet(XLSX, wb), { FS: '\t' })], { type: 'text/tab-separated-values;charset=utf-8' });
    }
    var bt = BOOKTYPE[to];
    if (!bt) throw new Error('no spreadsheet writer for .' + to);
    var out = XLSX.write(wb, { bookType: bt, type: 'array' });
    return new Blob([out], { type: root.Formats.meta(to).mime });
  }
  // Every sheet becomes a heading plus a table block.
  function workbookToDoc(XLSX, wb, title) {
    var blocks = [];
    wb.SheetNames.forEach(function (name) {
      var aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
        .map(function (r) { return r.map(function (c) { return c === null || c === undefined ? '' : String(c); }); })
        .filter(function (r) { return r.some(function (c) { return c !== ''; }); });
      if (!aoa.length) return;
      if (wb.SheetNames.length > 1) blocks.push({ t: 'h', level: 2, runs: [{ text: name }] });
      blocks.push(DM.tableBlock(aoa, true));
    });
    return { title: title, blocks: blocks.length ? blocks : [{ t: 'p', runs: [{ text: '(empty workbook)' }] }] };
  }

  /* ---------------------------------------------------------------- data  */
  var DATA_IN = ['json', 'jsonl', 'ndjson', 'yaml', 'yml', 'xml', 'toml'];

  function xmlToObj(node) {
    var out = {}, kids = Array.prototype.filter.call(node.childNodes, function (n) { return n.nodeType === 1; });
    Array.prototype.forEach.call(node.attributes || [], function (a) { out['@' + a.name] = a.value; });
    if (!kids.length) {
      var t = (node.textContent || '').trim();
      return Object.keys(out).length ? (t ? Object.assign(out, { '#text': t }) : out) : t;
    }
    kids.forEach(function (k) {
      var v = xmlToObj(k);
      if (out[k.nodeName] === undefined) out[k.nodeName] = v;
      else { if (!Array.isArray(out[k.nodeName])) out[k.nodeName] = [out[k.nodeName]]; out[k.nodeName].push(v); }
    });
    return out;
  }
  function objToXml(v, tag) {
    tag = (tag || 'item').replace(/[^\w.:-]/g, '_');
    if (v === null || v === undefined) return '<' + tag + '/>';
    if (Array.isArray(v)) return v.map(function (x) { return objToXml(x, tag); }).join('');
    if (typeof v === 'object') {
      var inner = Object.keys(v).map(function (k) {
        return k === '#text' ? DM.esc(v[k]) : (k[0] === '@' ? '' : objToXml(v[k], k));
      }).join('');
      var attrs = Object.keys(v).filter(function (k) { return k[0] === '@'; })
        .map(function (k) { return ' ' + k.slice(1) + '="' + DM.esc(v[k]) + '"'; }).join('');
      return '<' + tag + attrs + '>' + inner + '</' + tag + '>';
    }
    return '<' + tag + '>' + DM.esc(v) + '</' + tag + '>';
  }
  function readData(ctx) {
    return blobText(ctx.file).then(function (t) {
      switch (ctx.from) {
        case 'json': return JSON.parse(t);
        case 'jsonl': case 'ndjson':
          return t.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l, i) {
            try { return JSON.parse(l); } catch (e) { throw new Error('line ' + (i + 1) + ' is not valid JSON'); }
          });
        case 'yaml': case 'yml': return need('jsyaml').then(function (Y) { return Y.load(t); });
        case 'toml': return need('toml').then(function (T) { return T.parse(t); });
        case 'xml': {
          var d = new DOMParser().parseFromString(t, 'application/xml');
          if (d.getElementsByTagName('parsererror').length) throw new Error('this XML is not well-formed');
          var o = {}; o[d.documentElement.nodeName] = xmlToObj(d.documentElement); return o;
        }
        default: return JSON.parse(t);
      }
    });
  }
  function rowsOf(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      var arrKey = Object.keys(value).find(function (k) { return Array.isArray(value[k]); });
      if (arrKey) return value[arrKey];
      return [value];
    }
    return [{ value: value }];
  }
  function writeData(value, to) {
    if (to === 'json') return Promise.resolve(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
    if (to === 'jsonl' || to === 'ndjson') {
      return Promise.resolve(new Blob([rowsOf(value).map(function (r) { return JSON.stringify(r); }).join('\n') + '\n'], { type: 'application/x-ndjson' }));
    }
    if (to === 'yaml' || to === 'yml') {
      return need('jsyaml').then(function (Y) { return new Blob([Y.dump(value, { noRefs: true, lineWidth: 100 })], { type: 'application/yaml' }); });
    }
    if (to === 'toml') {
      return need('toml').then(function (T) {
        var v = (value && typeof value === 'object' && !Array.isArray(value)) ? value : { items: rowsOf(value) };
        return new Blob([T.stringify(v) + '\n'], { type: 'application/toml' });
      });
    }
    if (to === 'xml') {
      var body = (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1)
        ? objToXml(value[Object.keys(value)[0]], Object.keys(value)[0])
        : objToXml(value, 'root');
      return Promise.resolve(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + body + '\n'], { type: 'application/xml' }));
    }
    return Promise.reject(new Error('no data writer for .' + to));
  }
  // rows -> CREATE TABLE + INSERTs (portable SQL, quoted identifiers).
  function toSql(rows, tableName) {
    rows = rowsOf(rows).map(function (r) { return (r && typeof r === 'object' && !Array.isArray(r)) ? r : { value: r }; });
    var cols = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    if (!cols.length) throw new Error('no columns found');
    var table = String(tableName || 'data').replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1').toLowerCase() || 'data';
    function ident(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
    function typeOf(col) {
      var t = null;
      for (var i = 0; i < rows.length; i++) {
        var v = rows[i][col];
        if (v === null || v === undefined || v === '') continue;
        var k = typeof v === 'boolean' ? 'BOOLEAN' : (typeof v === 'number' ? (Number.isInteger(v) ? 'INTEGER' : 'REAL') : 'TEXT');
        if (typeof v === 'string' && /^-?\d+$/.test(v)) k = 'INTEGER';
        else if (typeof v === 'string' && /^-?\d*\.\d+$/.test(v)) k = 'REAL';
        if (t === null) t = k;
        else if (t !== k) { if ((t === 'INTEGER' && k === 'REAL') || (t === 'REAL' && k === 'INTEGER')) t = 'REAL'; else return 'TEXT'; }
      }
      return t || 'TEXT';
    }
    var types = {}; cols.forEach(function (c) { types[c] = typeOf(c); });
    function lit(v, col) {
      if (v === null || v === undefined || v === '') return 'NULL';
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      if (types[col] !== 'TEXT' && (typeof v === 'number' || /^-?\d*\.?\d+$/.test(String(v)))) return String(v);
      if (typeof v === 'object') v = JSON.stringify(v);
      return "'" + String(v).replace(/'/g, "''") + "'";
    }
    var out = ['-- generated by Convert Files', 'CREATE TABLE IF NOT EXISTS ' + ident(table) + ' (',
      cols.map(function (c) { return '  ' + ident(c) + ' ' + types[c]; }).join(',\n'), ');', ''];
    var colList = cols.map(ident).join(', ');
    for (var i = 0; i < rows.length; i += 500) {
      var batch = rows.slice(i, i + 500).map(function (r) { return '  (' + cols.map(function (c) { return lit(r[c], c); }).join(', ') + ')'; });
      out.push('INSERT INTO ' + ident(table) + ' (' + colList + ') VALUES', batch.join(',\n') + ';', '');
    }
    return new Blob([out.join('\n')], { type: 'application/sql' });
  }

  /* --------------------------------------------------------------- audio  */
  function decodeAudio(file) {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return Promise.reject(new Error('this browser has no Web Audio support'));
    var ac = new AC();
    return file.arrayBuffer()
      .then(function (ab) { return ac.decodeAudioData(ab); })
      .then(function (buf) { ac.close && ac.close(); return buf; },
            function () { ac.close && ac.close(); throw new Error('this browser cannot decode that audio codec'); });
  }
  function bufferToWav(buf) {
    var chans = [];
    for (var i = 0; i < buf.numberOfChannels; i++) chans.push(buf.getChannelData(i));
    return Enc.wav(chans, buf.sampleRate);
  }
  function bufferToMp3(buf, kbps, log) {
    return need('lamejs').then(function (lame) {
      var ch = Math.min(2, buf.numberOfChannels), rate = buf.sampleRate;
      var enc = new lame.Mp3Encoder(ch, rate, kbps || 192);
      var L = buf.getChannelData(0), R = ch > 1 ? buf.getChannelData(1) : null;
      var n = L.length, block = 1152, out = [];
      function i16(f32, from, len) {
        var a = new Int16Array(len);
        for (var i = 0; i < len; i++) { var s = Math.max(-1, Math.min(1, f32[from + i])); a[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
        return a;
      }
      for (var i = 0; i < n; i += block) {
        var len = Math.min(block, n - i);
        var buf8 = ch > 1 ? enc.encodeBuffer(i16(L, i, len), i16(R, i, len)) : enc.encodeBuffer(i16(L, i, len));
        if (buf8.length) out.push(new Uint8Array(buf8));
        if (log && i % (block * 400) === 0) log('encoding ' + Math.round((i / n) * 100) + '%');
      }
      var tail = enc.flush();
      if (tail.length) out.push(new Uint8Array(tail));
      return new Blob(out, { type: 'audio/mpeg' });
    });
  }
  function resampleBuffer(buf, rate, channels) {
    var frames = Math.ceil(buf.duration * rate);
    var oac = new OfflineAudioContext(channels, frames, rate);
    var src = oac.createBufferSource();
    src.buffer = buf; src.connect(oac.destination); src.start(0);
    return oac.startRendering();
  }
  // Push an AudioBuffer through a WebCodecs AudioEncoder; onChunk gets (chunk, meta).
  function runAudioEncoder(buf, config, onChunk, log) {
    if (typeof root.AudioEncoder !== 'function') return Promise.reject(new Error('this browser has no WebCodecs audio encoder'));
    return new Promise(function (res, rej) {
      var enc = new root.AudioEncoder({ output: onChunk, error: function (e) { rej(new Error('encoder failed: ' + (e && e.message))); } });
      enc.configure(config);
      var ch = config.numberOfChannels, sr = config.sampleRate, total = buf.length, block = 4096;
      var planes = [];
      for (var c = 0; c < ch; c++) planes.push(buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)));
      for (var off = 0; off < total; off += block) {
        var n = Math.min(block, total - off), data = new Float32Array(n * ch);
        for (var k = 0; k < ch; k++) data.set(planes[k].subarray(off, off + n), k * n);
        var frame = new root.AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch,
                                         timestamp: Math.round(off / sr * 1e6), data: data });
        enc.encode(frame); frame.close();
        if (log && off % (block * 200) === 0) log('encoding ' + Math.round(off / total * 100) + '%');
      }
      enc.flush().then(function () { enc.close(); res(); }, rej);
    });
  }
  function encodeAac(buf, kbps, log) {
    var ch = Math.min(2, buf.numberOfChannels), chunks = [];
    return need('mp4muxer').then(function (M) {
      var target = new M.ArrayBufferTarget();
      var muxer = new M.Muxer({ target: target, audio: { codec: 'aac', sampleRate: buf.sampleRate, numberOfChannels: ch }, fastStart: 'in-memory' });
      return runAudioEncoder(buf, { codec: 'mp4a.40.2', sampleRate: buf.sampleRate, numberOfChannels: ch, bitrate: (kbps || 192) * 1000 },
        function (chunk, meta) { muxer.addAudioChunk(chunk, meta); }, log)
        .then(function () { muxer.finalize(); return new Blob([target.buffer], { type: 'audio/mp4' }); });
    });
  }
  function encodeAdts(buf, kbps, log) {
    var ch = Math.min(2, buf.numberOfChannels), parts = [];
    return runAudioEncoder(buf, { codec: 'mp4a.40.2', sampleRate: buf.sampleRate, numberOfChannels: ch, bitrate: (kbps || 192) * 1000, aac: { format: 'adts' } },
      function (chunk) { parts.push(chunkBytes(chunk)); }, log)
      .then(function () { return new Blob([concatBytes(parts)], { type: 'audio/aac' }); });
  }
  function encodeOpusOgg(buf, kbps, log) {
    var ch = Math.min(2, buf.numberOfChannels), packets = [], preSkip = 312, origRate = buf.sampleRate;
    var ready = buf.sampleRate === 48000 && buf.numberOfChannels === ch ? Promise.resolve(buf) : resampleBuffer(buf, 48000, ch);
    return ready.then(function (b48) {
      // raw Opus packets (Chrome offers no 'ogg' packaging); libopus's lookahead
      // at 48 kHz is 312 samples, which the OpusHead's pre-skip must declare.
      return runAudioEncoder(b48, { codec: 'opus', sampleRate: 48000, numberOfChannels: ch, bitrate: Math.min(256, kbps || 128) * 1000 },
        function (chunk, meta) {
          if (meta && meta.decoderConfig && meta.decoderConfig.description) {
            var desc = meta.decoderConfig.description, d = new Uint8Array(desc.buffer ? desc.buffer : desc);
            if (d.length >= 12 && d[0] === 0x4F && d[1] === 0x70) preSkip = d[10] | (d[11] << 8);
          }
          packets.push({ data: chunkBytes(chunk), samples: Math.round((chunk.duration || 20000) * 48000 / 1e6) });
        }, log);
    }).then(function () {
      return Enc.oggOpus(packets, { channels: ch, preSkip: preSkip, inputSampleRate: origRate });
    });
  }
  function audioOut(buf, to, opts, log) {
    if (to === 'wav') return Promise.resolve(bufferToWav(buf));
    if (to === 'mp3') return bufferToMp3(buf, opts.bitrate, log);
    if (to === 'm4a') return encodeAac(buf, opts.bitrate, log);
    if (to === 'aac') return encodeAdts(buf, opts.bitrate, log);
    if (to === 'ogg' || to === 'opus') return encodeOpusOgg(buf, opts.bitrate, log);
    return Promise.reject(new Error('no audio encoder for .' + to));
  }

  /* --------------------------------------------------------------- video  */
  function loadVideo(file) {
    return new Promise(function (res, rej) {
      var v = document.createElement('video'), settled = false;
      function fail(msg) {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(v.src);
        rej(new Error(msg));
      }
      v.preload = 'auto'; v.muted = true; v.playsInline = true;
      v.src = URL.createObjectURL(file);
      v.onloadedmetadata = function () { if (!settled) { settled = true; res(v); } };
      v.onerror = function () { fail('this browser cannot decode that video container/codec'); };
      // metadata can silently never arrive (unsupported codec, background tab),
      // so give up rather than leaving the conversion spinning forever.
      setTimeout(function () { fail('gave up waiting for the video to open — try a different container, or keep this tab in the foreground'); }, 20000);
    });
  }
  function seek(v, t) {
    return new Promise(function (res, rej) {
      var done = function () { v.removeEventListener('seeked', done); res(); };
      v.addEventListener('seeked', done);
      setTimeout(function () { v.removeEventListener('seeked', done); res(); }, 4000);
      try { v.currentTime = Math.max(0, Math.min(t, (v.duration || 0) - 0.05)); } catch (e) { rej(e); }
    });
  }
  function grabFrames(v, opts, onProg) {
    var width = opts.width || 480;
    var fps = Math.max(1, Math.min(24, opts.fps || 10));
    var span = Math.min(opts.maxSeconds || 5, v.duration || 5);
    var start = Math.max(0, opts.time || 0);
    var count = Math.max(1, Math.min(300, Math.round(span * fps)));
    var scale = Math.min(1, width / (v.videoWidth || width));
    var c = canvasOf((v.videoWidth || width) * scale, (v.videoHeight || width) * scale);
    var g = c.getContext('2d', { willReadFrequently: true });
    var frames = [], chain = Promise.resolve();
    for (var i = 0; i < count; i++) {
      (function (k) {
        chain = chain.then(function () {
          return seek(v, start + k / fps).then(function () {
            g.drawImage(v, 0, 0, c.width, c.height);
            frames.push({ imageData: g.getImageData(0, 0, c.width, c.height), delayMs: 1000 / fps });
            if (onProg) onProg((k + 1) / count, 'frame ' + (k + 1) + ' of ' + count);
          });
        });
      })(i);
    }
    return chain.then(function () { return { frames: frames, canvas: c }; });
  }
  function avcCodecFor(w, h) {
    var mb = Math.ceil(w / 16) * Math.ceil(h / 16);
    if (mb <= 3600) return 'avc1.4d001f';       // Main 3.1  (720p)
    if (mb <= 8192) return 'avc1.640028';       // High 4.0  (1080p)
    return 'avc1.640033';                        // High 5.1  (4K)
  }
  // A macrotask yield that background tabs do not throttle (setTimeout is clamped to 1 s there).
  var tickChannel = typeof MessageChannel === 'function' ? new MessageChannel() : null, tickWaiters = [];
  if (tickChannel) tickChannel.port1.onmessage = function () { var w = tickWaiters; tickWaiters = []; w.forEach(function (r) { r(); }); };
  function nextTick() {
    if (!tickChannel) return new Promise(function (r) { setTimeout(r, 0); });
    return new Promise(function (r) { tickWaiters.push(r); tickChannel.port2.postMessage(0); });
  }
  // Re-encode any browser-decodable video into MP4 (H.264 + AAC) or WebM (VP9 + Opus).
  function transcodeVideo(ctx, container) {
    if (typeof root.VideoEncoder !== 'function') return Promise.reject(new Error('this browser has no WebCodecs video encoder'));
    var v, W, H, fps, total, muxer, target, M, hasAudio = false, audioBuf = null, ch = 2;
    var isMp4 = container === 'mp4';
    return loadVideo(ctx.file).then(function (vid) {
      v = vid;
      if ((v.duration || 0) > 15 * 60) throw new Error('videos longer than 15 minutes are too large to re-encode inside a browser tab');
      fps = Math.max(1, Math.min(60, ctx.opts.fps || 30));
      var srcW = v.videoWidth || 640, srcH = v.videoHeight || 360;
      var maxW = ctx.opts.width || Math.min(srcW, 1920);
      var s = Math.min(1, maxW / srcW);
      W = even(srcW * s); H = even(srcH * s);
      total = Math.max(1, Math.round((v.duration || 0) * fps));
      ctx.log('source ' + srcW + 'x' + srcH + ', ' + (v.duration || 0).toFixed(1) + ' s — output ' + W + 'x' + H + ' @ ' + fps + ' fps');
      return decodeAudio(ctx.file).then(function (b) { audioBuf = b; hasAudio = true; ch = Math.min(2, b.numberOfChannels); },
                                        function () { ctx.log('no decodable audio track — video only'); });
    }).then(function () {
      return need(isMp4 ? 'mp4muxer' : 'webmmuxer');
    }).then(function (mod) {
      M = mod;
      target = new M.ArrayBufferTarget();
      var cfg = { target: target, video: { codec: isMp4 ? 'avc' : 'V_VP9', width: W, height: H, frameRate: fps } };
      if (hasAudio) cfg.audio = isMp4 ? { codec: 'aac', sampleRate: audioBuf.sampleRate, numberOfChannels: ch } : { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: ch };
      if (isMp4) cfg.fastStart = 'in-memory';
      muxer = new M.Muxer(cfg);
      var q = typeof ctx.opts.quality === 'number' ? ctx.opts.quality : 0.85;
      var bitrate = Math.round(W * H * fps * 0.09 * (0.5 + q));                    // ~4.5 Mbps for 1080p30 at q .85
      var codec = isMp4 ? avcCodecFor(W, H) : 'vp09.00.10.08';
      var config = { codec: codec, width: W, height: H, bitrate: bitrate, framerate: fps };
      if (isMp4) config.avc = { format: 'avc' };
      return root.VideoEncoder.isConfigSupported(config).then(function (r) {
        if (!r.supported) throw new Error('this browser cannot encode ' + (isMp4 ? 'H.264' : 'VP9') + ' at ' + W + 'x' + H);
        return config;
      });
    }).then(function (config) {
      return new Promise(function (res, rej) {
        var enc = new root.VideoEncoder({ output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); },
                                          error: function (e) { rej(new Error('video encoder failed: ' + (e && e.message))); } });
        enc.configure(config);
        var scaled = (W !== v.videoWidth || H !== v.videoHeight) ? canvasOf(W, H) : null;
        var g = scaled ? scaled.getContext('2d') : null;
        var i = 0;
        function step() {
          if (i >= total) { enc.flush().then(function () { enc.close(); res(); }, rej); return; }
          seek(v, i / fps).then(function () {
            var ts = Math.round(i * 1e6 / fps), src = v;
            if (scaled) { g.drawImage(v, 0, 0, W, H); src = scaled; }
            var frame = new root.VideoFrame(src, { timestamp: ts, duration: Math.round(1e6 / fps) });
            enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
            frame.close();
            i++;
            if (i % 10 === 0 || i === total) ctx.progress(i / total * (hasAudio ? 0.85 : 1), 'frame ' + i + ' of ' + total);
            return enc.encodeQueueSize > 6 ? new Promise(function (r) { enc.addEventListener('dequeue', r, { once: true }); }) : nextTick();
          }).then(step, rej);
        }
        step();
      });
    }).then(function () {
      if (!hasAudio) return;
      ctx.log('encoding audio track');
      if (isMp4) {
        return runAudioEncoder(audioBuf, { codec: 'mp4a.40.2', sampleRate: audioBuf.sampleRate, numberOfChannels: ch, bitrate: (ctx.opts.bitrate || 160) * 1000 },
          function (chunk, meta) { muxer.addAudioChunk(chunk, meta); });
      }
      var ready = (audioBuf.sampleRate === 48000 && audioBuf.numberOfChannels === ch) ? Promise.resolve(audioBuf) : resampleBuffer(audioBuf, 48000, ch);
      return ready.then(function (b48) {
        return runAudioEncoder(b48, { codec: 'opus', sampleRate: 48000, numberOfChannels: ch, bitrate: Math.min(256, ctx.opts.bitrate || 128) * 1000 },
          function (chunk, meta) { muxer.addAudioChunk(chunk, meta); });
      });
    }).then(function () {
      muxer.finalize();
      URL.revokeObjectURL(v.src);
      ctx.progress(1, 'muxed');
      return new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
    });
  }

  /* ------------------------------------------------------------- archives */
  function gzipSupported() { return typeof root.CompressionStream === 'function'; }
  function compress(blob, fmt) {
    if (!gzipSupported()) return Promise.reject(new Error('this browser has no CompressionStream (needs Chrome 80+ / Safari 16.4+)'));
    return new Response(blob.stream().pipeThrough(new root.CompressionStream(fmt))).arrayBuffer();
  }
  function decompress(blob, fmt) {
    if (typeof root.DecompressionStream !== 'function') return Promise.reject(new Error('this browser has no DecompressionStream'));
    return new Response(blob.stream().pipeThrough(new root.DecompressionStream(fmt))).arrayBuffer();
  }
  function gzip(blob) { return compress(blob, 'gzip').then(function (ab) { return new Blob([ab], { type: 'application/gzip' }); }); }
  function gunzip(blob) { return decompress(blob, 'gzip').then(function (ab) { return new Blob([ab]); }); }
  function zipEntries(file) {
    return need('jszip').then(function (JSZip) { return JSZip.loadAsync(file); }).then(function (zip) {
      var names = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir; });
      return Promise.all(names.map(function (n) {
        return zip.files[n].async('uint8array').then(function (d) { return { name: n, data: d, mtime: +zip.files[n].date || Date.now() }; });
      }));
    });
  }
  function entriesToZip(entries) {
    return need('jszip').then(function (JSZip) {
      var zip = new JSZip();
      entries.forEach(function (e) { zip.file(e.name, e.data); });
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    });
  }

  /* ---------------------------------------------------------------- fonts */
  // WOFF 1.0 is the sfnt table directory with each table zlib-compressed.
  function sfntTables(ab) {
    var dv = new DataView(ab), flavor = dv.getUint32(0), n = dv.getUint16(4), tables = [];
    if (!(flavor === 0x00010000 || flavor === 0x4F54544F || flavor === 0x74727565)) throw new Error('not a TrueType/OpenType font');
    for (var i = 0; i < n; i++) {
      var o = 12 + i * 16;
      tables.push({ tag: dv.getUint32(o), checksum: dv.getUint32(o + 4), offset: dv.getUint32(o + 8), length: dv.getUint32(o + 12) });
    }
    return { flavor: flavor, tables: tables };
  }
  function pad4(n) { return (n + 3) & ~3; }
  function fontToWoff(ab) {
    var info = sfntTables(ab), u8 = new Uint8Array(ab);
    var tables = info.tables.slice().sort(function (a, b) { return a.tag - b.tag; });
    return Promise.all(tables.map(function (t) {
      var raw = u8.subarray(t.offset, t.offset + t.length);
      return compress(new Blob([raw]), 'deflate').then(function (z) {
        var zu = new Uint8Array(z);
        return { t: t, data: zu.length < raw.length ? zu : raw, comp: zu.length < raw.length ? zu.length : raw.length };
      });
    })).then(function (list) {
      var n = list.length, dirLen = 44 + 20 * n, total = dirLen, sfntSize = 12 + 16 * n;
      list.forEach(function (e) { total += pad4(e.comp); sfntSize += pad4(e.t.length); });
      var out = new Uint8Array(total), dv = new DataView(out.buffer);
      dv.setUint32(0, 0x774F4646); dv.setUint32(4, info.flavor); dv.setUint32(8, total); dv.setUint16(12, n);
      dv.setUint32(16, sfntSize); dv.setUint16(20, 1); dv.setUint16(22, 0);
      var off = dirLen;
      list.forEach(function (e, i) {
        var d = 44 + i * 20;
        dv.setUint32(d, e.t.tag); dv.setUint32(d + 4, off); dv.setUint32(d + 8, e.comp); dv.setUint32(d + 12, e.t.length); dv.setUint32(d + 16, e.t.checksum);
        out.set(e.data.subarray(0, e.comp), off);
        off += pad4(e.comp);
      });
      return new Blob([out], { type: 'font/woff' });
    });
  }
  function woffToFont(ab) {
    var dv = new DataView(ab), u8 = new Uint8Array(ab);
    if (dv.getUint32(0) !== 0x774F4646) throw new Error(dv.getUint32(0) === 0x774F4632 ? 'this is WOFF2 (Brotli) — browsers cannot unpack it without a Brotli decoder' : 'not a WOFF font');
    var flavor = dv.getUint32(4), n = dv.getUint16(12), entries = [];
    for (var i = 0; i < n; i++) {
      var d = 44 + i * 20;
      entries.push({ tag: dv.getUint32(d), offset: dv.getUint32(d + 4), comp: dv.getUint32(d + 8), orig: dv.getUint32(d + 12), checksum: dv.getUint32(d + 16) });
    }
    return Promise.all(entries.map(function (e) {
      var raw = u8.subarray(e.offset, e.offset + e.comp);
      if (e.comp === e.orig) return Promise.resolve(raw);
      return decompress(new Blob([raw]), 'deflate').then(function (x) { return new Uint8Array(x); });
    })).then(function (datas) {
      var total = 12 + 16 * n;
      entries.forEach(function (e) { total += pad4(e.orig); });
      var out = new Uint8Array(total), o = new DataView(out.buffer);
      var sr = 1, es = 0; while (sr * 2 <= n) { sr *= 2; es++; }
      o.setUint32(0, flavor); o.setUint16(4, n); o.setUint16(6, sr * 16); o.setUint16(8, es); o.setUint16(10, n * 16 - sr * 16);
      var off = 12 + 16 * n;
      entries.forEach(function (e, i) {
        var d = 12 + i * 16;
        o.setUint32(d, e.tag); o.setUint32(d + 4, e.checksum); o.setUint32(d + 8, off); o.setUint32(d + 12, e.orig);
        out.set(datas[i].subarray(0, e.orig), off);
        off += pad4(e.orig);
      });
      var isCff = flavor === 0x4F54544F;
      return { blob: new Blob([out], { type: isCff ? 'font/otf' : 'font/ttf' }), ext: isCff ? 'otf' : 'ttf' };
    });
  }

  /* --------------------------------------------------------------- meshes */
  function parseObj(text) {
    var pos = [], tris = [];
    text.split(/\r?\n/).forEach(function (line) {
      var p = line.trim().split(/\s+/);
      if (p[0] === 'v') pos.push([+p[1], +p[2], +p[3]]);
      else if (p[0] === 'f') {
        var idx = p.slice(1).map(function (tok) {
          var n = parseInt(tok.split('/')[0], 10);
          return n < 0 ? pos.length + n : n - 1;
        });
        for (var i = 1; i + 1 < idx.length; i++) tris.push([idx[0], idx[i], idx[i + 1]]);
      }
    });
    if (!pos.length) throw new Error('no vertices found in this OBJ');
    return { pos: pos, tris: tris };
  }
  function parseStl(ab) {
    var u8 = new Uint8Array(ab);
    var head = String.fromCharCode.apply(null, u8.subarray(0, Math.min(80, u8.length)));
    var looksAscii = /^\s*solid/i.test(head) && u8.length > 84 &&
      String.fromCharCode.apply(null, u8.subarray(0, Math.min(1000, u8.length))).indexOf('facet') > -1;
    var pos = [], tris = [];
    if (looksAscii) {
      var text = new TextDecoder().decode(u8), verts = [];
      text.replace(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, function (_, a, b, c) { verts.push([+a, +b, +c]); return ''; });
      for (var i = 0; i + 2 < verts.length; i += 3) {
        var n = pos.length;
        pos.push(verts[i], verts[i + 1], verts[i + 2]);
        tris.push([n, n + 1, n + 2]);
      }
    } else {
      var dv = new DataView(ab), count = dv.getUint32(80, true), o = 84;
      for (var t = 0; t < count; t++, o += 50) {
        var b = pos.length;
        for (var v = 0; v < 3; v++) {
          var q = o + 12 + v * 12;
          pos.push([dv.getFloat32(q, true), dv.getFloat32(q + 4, true), dv.getFloat32(q + 8, true)]);
        }
        tris.push([b, b + 1, b + 2]);
      }
    }
    if (!tris.length) throw new Error('no triangles found in this STL');
    return { pos: pos, tris: tris };
  }
  function parsePly(ab) {
    var u8 = new Uint8Array(ab);
    var headText = new TextDecoder().decode(u8.subarray(0, Math.min(4096, u8.length)));
    var endIdx = headText.indexOf('end_header');
    if (endIdx < 0) throw new Error('not a PLY file (no end_header)');
    var header = headText.slice(0, endIdx);
    var bodyStart = endIdx + headText.slice(endIdx).indexOf('\n') + 1;
    var ascii = /format\s+ascii/.test(header);
    var nv = +(/element\s+vertex\s+(\d+)/.exec(header) || [])[1] || 0;
    var nf = +(/element\s+face\s+(\d+)/.exec(header) || [])[1] || 0;
    if (!ascii) throw new Error('only ASCII PLY is supported here — re-export as ASCII');
    var toks = new TextDecoder().decode(u8.subarray(bodyStart)).trim().split(/\s+/);
    var vprops = (header.split(/element\s+vertex[^\n]*\n/)[1] || '').split(/element\s/)[0];
    var stride = (vprops.match(/property\s+/g) || []).length || 3;
    var pos = [], tris = [], k = 0;
    for (var i = 0; i < nv; i++) { pos.push([+toks[k], +toks[k + 1], +toks[k + 2]]); k += stride; }
    for (var f = 0; f < nf; f++) {
      var n = +toks[k++], idx = [];
      for (var j = 0; j < n; j++) idx.push(+toks[k++]);
      for (var m = 1; m + 1 < idx.length; m++) tris.push([idx[0], idx[m], idx[m + 1]]);
    }
    if (!pos.length) throw new Error('no vertices found in this PLY');
    return { pos: pos, tris: tris };
  }
  function writeObj(mesh, name) {
    var out = ['# exported by Convert Files', 'o ' + (name || 'mesh')];
    mesh.pos.forEach(function (p) { out.push('v ' + p[0] + ' ' + p[1] + ' ' + p[2]); });
    mesh.tris.forEach(function (t) { out.push('f ' + (t[0] + 1) + ' ' + (t[1] + 1) + ' ' + (t[2] + 1)); });
    return new Blob([out.join('\n') + '\n'], { type: 'model/obj' });
  }
  function writeStl(mesh) {
    var n = mesh.tris.length, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
    var title = 'Convert Files binary STL';
    for (var i = 0; i < title.length; i++) dv.setUint8(i, title.charCodeAt(i));
    dv.setUint32(80, n, true);
    var o = 84;
    mesh.tris.forEach(function (t) {
      var a = mesh.pos[t[0]], b = mesh.pos[t[1]], c = mesh.pos[t[2]];
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var len = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / len, true); dv.setFloat32(o + 4, ny / len, true); dv.setFloat32(o + 8, nz / len, true);
      [a, b, c].forEach(function (p, i) {
        var q = o + 12 + i * 12;
        dv.setFloat32(q, p[0], true); dv.setFloat32(q + 4, p[1], true); dv.setFloat32(q + 8, p[2], true);
      });
      dv.setUint16(o + 48, 0, true);
      o += 50;
    });
    return new Blob([buf], { type: 'model/stl' });
  }
  function writePly(mesh) {
    var out = ['ply', 'format ascii 1.0', 'comment created by Convert Files',
      'element vertex ' + mesh.pos.length, 'property float x', 'property float y', 'property float z',
      'element face ' + mesh.tris.length, 'property list uchar int vertex_index', 'end_header'];
    mesh.pos.forEach(function (p) { out.push(p[0] + ' ' + p[1] + ' ' + p[2]); });
    mesh.tris.forEach(function (t) { out.push('3 ' + t[0] + ' ' + t[1] + ' ' + t[2]); });
    return new Blob([out.join('\n') + '\n'], { type: 'application/octet-stream' });
  }

  function b64FromBytes(u8) {
    var s = '', chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    return btoa(s);
  }
  function bytesFromB64(b64) {
    var bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function glbParse(ab) {
    var dv = new DataView(ab);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB file (bad magic)');
    var len = dv.getUint32(8, true), o = 12, json = null, bin = null;
    while (o < len && o + 8 <= ab.byteLength) {
      var cl = dv.getUint32(o, true), ct = dv.getUint32(o + 4, true);
      var body = new Uint8Array(ab, o + 8, cl);
      if (ct === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(body));
      else if (ct === 0x004E4942) bin = body;
      o += 8 + cl + ((4 - (cl % 4)) % 4);
    }
    if (!json) throw new Error('this GLB has no JSON chunk');
    return { json: json, bin: bin };
  }
  function glbToGltf(ab) {
    var g = glbParse(ab), json = g.json, bin = g.bin;
    if (bin && json.buffers && json.buffers.length) {
      // the BIN chunk is padded to a 4-byte boundary; the JSON byteLength is
      // authoritative, so trim the padding back off before re-embedding it.
      var declared = json.buffers[0].byteLength;
      var payload = (typeof declared === 'number' && declared >= 0 && declared <= bin.length) ? bin.subarray(0, declared) : bin;
      json.buffers[0].uri = 'data:application/octet-stream;base64,' + b64FromBytes(payload);
      json.buffers[0].byteLength = payload.length;
    }
    return new Blob([JSON.stringify(json, null, 2)], { type: 'model/gltf+json' });
  }
  function gltfToGlb(text) {
    var json = JSON.parse(text), bin = new Uint8Array(0);
    if (json.buffers && json.buffers.length) {
      var uri = json.buffers[0].uri;
      if (uri && /^data:/.test(uri)) bin = bytesFromB64(uri.split(',')[1]);
      else if (uri) throw new Error('this glTF points at an external "' + uri + '" — only self-contained glTF can be packed here');
      delete json.buffers[0].uri;
      json.buffers[0].byteLength = bin.length;
    }
    var jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    var jPad = (4 - (jsonBytes.length % 4)) % 4, bPad = (4 - (bin.length % 4)) % 4;
    var jLen = jsonBytes.length + jPad, bLen = bin.length + bPad;
    var total = 12 + 8 + jLen + (bLen ? 8 + bLen : 0);
    var out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, jLen, true); dv.setUint32(16, 0x4E4F534A, true);
    out.set(jsonBytes, 20);
    for (var i = 0; i < jPad; i++) out[20 + jsonBytes.length + i] = 0x20;
    if (bLen) {
      var off = 20 + jLen;
      dv.setUint32(off, bLen, true); dv.setUint32(off + 4, 0x004E4942, true);
      out.set(bin, off + 8);
    }
    return new Blob([out], { type: 'model/gltf-binary' });
  }
  // A plain triangle mesh as a one-primitive glTF (JSON text with an embedded buffer).
  function meshToGltfText(mesh, name) {
    var nv = mesh.pos.length, ni = mesh.tris.length * 3;
    var posLen = nv * 12, idxOff = pad4(posLen), idxLen = ni * 4;
    var buf = new ArrayBuffer(idxOff + idxLen), dv = new DataView(buf);
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    mesh.pos.forEach(function (p, i) {
      for (var c = 0; c < 3; c++) {
        dv.setFloat32(i * 12 + c * 4, p[c], true);
        if (p[c] < min[c]) min[c] = p[c];
        if (p[c] > max[c]) max[c] = p[c];
      }
    });
    mesh.tris.forEach(function (t, i) { for (var c = 0; c < 3; c++) dv.setUint32(idxOff + (i * 3 + c) * 4, t[c], true); });
    var json = {
      asset: { version: '2.0', generator: 'Convert Files' },
      scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: name || 'mesh' }],
      meshes: [{ name: name || 'mesh', primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min: min, max: max },
        { bufferView: 1, componentType: 5125, count: ni, type: 'SCALAR' }
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: posLen, target: 34962 },
        { buffer: 0, byteOffset: idxOff, byteLength: idxLen, target: 34963 }
      ],
      buffers: [{ byteLength: buf.byteLength, uri: 'data:application/octet-stream;base64,' + b64FromBytes(new Uint8Array(buf)) }]
    };
    return JSON.stringify(json);
  }
  // glTF JSON (+ BIN) -> merged triangle mesh, with node transforms applied.
  function gltfToMesh(json, bin) {
    var buffers = (json.buffers || []).map(function (b, i) {
      if (b.uri && /^data:/.test(b.uri)) return bytesFromB64(b.uri.split(',')[1]);
      if (!b.uri && i === 0 && bin) return bin;
      throw new Error('this glTF references an external buffer "' + (b.uri || '') + '" — convert the .glb instead');
    });
    var CT = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
    var NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    function accessor(idx) {
      var a = json.accessors[idx], bv = json.bufferViews[a.bufferView], T = CT[a.componentType][0], size = CT[a.componentType][1];
      var n = NC[a.type], src = buffers[bv.buffer], base = (bv.byteOffset || 0) + (a.byteOffset || 0);
      var stride = bv.byteStride || n * size, out = [];
      var dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
      var read = { 5120: dv.getInt8, 5121: dv.getUint8, 5122: dv.getInt16, 5123: dv.getUint16, 5125: dv.getUint32, 5126: dv.getFloat32 }[a.componentType];
      for (var i = 0; i < a.count; i++) {
        var item = [];
        for (var c = 0; c < n; c++) item.push(read.call(dv, base + i * stride + c * size, true));
        out.push(n === 1 ? item[0] : item);
      }
      if (a.sparse) throw new Error('sparse accessors are not supported');
      return out;
    }
    function mul(a, b) {                              // column-major 4x4
      var r = new Array(16);
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
        r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
      }
      return r;
    }
    function nodeMatrix(nd) {
      if (nd.matrix) return nd.matrix;
      var t = nd.translation || [0, 0, 0], q = nd.rotation || [0, 0, 0, 1], s = nd.scale || [1, 1, 1];
      var x = q[0], y = q[1], z = q[2], w = q[3];
      var xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
      return [
        (1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0,
        (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0,
        (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
        t[0], t[1], t[2], 1
      ];
    }
    var pos = [], tris = [], I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    function visit(ni, parent) {
      var nd = json.nodes[ni], m = mul(parent, nodeMatrix(nd));
      if (nd.mesh !== undefined) {
        (json.meshes[nd.mesh].primitives || []).forEach(function (prim) {
          if (prim.mode !== undefined && prim.mode !== 4) return;
          if (prim.extensions && prim.extensions.KHR_draco_mesh_compression) throw new Error('Draco-compressed meshes are not supported');
          if (prim.attributes.POSITION === undefined) return;
          var P = accessor(prim.attributes.POSITION), base = pos.length;
          P.forEach(function (p) {
            pos.push([m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]);
          });
          var idx = prim.indices !== undefined ? accessor(prim.indices) : P.map(function (_, i) { return i; });
          for (var i = 0; i + 2 < idx.length; i += 3) tris.push([base + idx[i], base + idx[i + 1], base + idx[i + 2]]);
        });
      }
      (nd.children || []).forEach(function (c) { visit(c, m); });
    }
    var scene = json.scenes && json.scenes[json.scene || 0];
    var roots = scene ? scene.nodes : (json.nodes || []).map(function (_, i) { return i; });
    roots.forEach(function (n) { visit(n, I); });
    if (!tris.length) throw new Error('no triangle geometry found in this glTF');
    return { pos: pos, tris: tris };
  }
  function readMesh(ctx) {
    if (ctx.from === 'obj') return blobText(ctx.file).then(parseObj);
    if (ctx.from === 'stl') return ctx.file.arrayBuffer().then(parseStl);
    if (ctx.from === 'ply') return ctx.file.arrayBuffer().then(parsePly);
    if (ctx.from === 'glb') return ctx.file.arrayBuffer().then(function (ab) { var g = glbParse(ab); return gltfToMesh(g.json, g.bin); });
    if (ctx.from === 'gltf') return blobText(ctx.file).then(function (t) { return gltfToMesh(JSON.parse(t), null); });
    return Promise.reject(new Error('no mesh reader for .' + ctx.from));
  }
  function writeMesh(mesh, to, name) {
    if (to === 'obj') return writeObj(mesh, name);
    if (to === 'stl') return writeStl(mesh);
    if (to === 'ply') return writePly(mesh);
    if (to === 'gltf') return new Blob([meshToGltfText(mesh, name)], { type: 'model/gltf+json' });
    if (to === 'glb') return gltfToGlb(meshToGltfText(mesh, name));
    throw new Error('no mesh writer for .' + to);
  }

  /* ====================================================== RULE REGISTRY == */
  var IMG_IN = ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'gif', 'bmp', 'dib', 'avif', 'jxl', 'svg', 'ico', 'tif', 'tiff', 'heic', 'heif', 'ppm', 'pgm', 'pbm'];
  var IMG_OUT = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'jxl', 'bmp', 'gif', 'ico', 'icns', 'svg', 'tif', 'tiff', 'tga', 'ppm', 'pgm', 'pbm'];
  var AUDIO_IN = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'weba', 'aiff'];
  var AUDIO_OUT = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'opus'];
  var VIDEO_IN = ['mp4', 'm4v', 'webm', 'mov', 'ogv'];

  // image -> image
  add(IMG_IN, IMG_OUT, function (ctx) {
    return decodeImage(ctx).then(function (c) {
      ctx.log('decoded ' + c.width + ' x ' + c.height);
      return encodeCanvas(resize(c, ctx.opts.width), ctx.to, ctx.opts);
    });
  }, ['width', 'quality', 'dither']);

  // image -> pdf
  add(IMG_IN, ['pdf'], function (ctx) {
    return decodeImage(ctx).then(function (c) { return canvasesToPdf([resize(c, ctx.opts.width)], ctx.opts); });
  }, ['width', 'pageSize']);

  // image -> document with the picture embedded
  add(IMG_IN, ['docx', 'odt', 'html', 'epub', 'rtf', 'md'], function (ctx) {
    return decodeImage(ctx).then(function (c) {
      return toBlob(resize(c, ctx.opts.width), 'image/png');
    }).then(function (png) {
      var doc = { title: baseName(ctx.file.name), blocks: [DM.imgBlock(png, baseName(ctx.file.name))] };
      return saveDoc(doc, ctx.to, ctx.opts);
    });
  }, ['width'], 'embeds the picture in a new document');

  // pdf -> image (one page, or a zip of every page)
  add(['pdf'], IMG_OUT, function (ctx) {
    return renderPdf(ctx.file, baseName(ctx.file.name), ctx);
  }, ['scale', 'width', 'quality', 'allPages']);

  // documents
  add(DOC_IN, DOC_OUT, function (ctx) {
    return loadDoc(ctx).then(function (doc) {
      ctx.log(doc.blocks.length + ' blocks parsed');
      return saveDoc(doc, ctx.to, ctx.opts);
    });
  }, ['pageSize']);

  // document -> page images (laid out as PDF first, then rasterised)
  add(DOC_IN, ['png', 'jpg', 'jpeg', 'webp'], function (ctx) {
    return loadDoc(ctx).then(function (doc) { return saveDoc(doc, 'pdf', ctx.opts); })
      .then(function (pdf) { return renderPdf(pdf, baseName(ctx.file.name), ctx); });
  }, ['pageSize', 'scale', 'allPages'], 'renders the pages as pictures');

  // spreadsheets and tables
  add(TABLE_IN.concat(['html', 'htm']), TABLE_OUT, function (ctx) {
    return need('xlsx').then(function (XLSX) {
      return readWorkbook(ctx).then(function (wb) {
        ctx.log('sheets: ' + wb.SheetNames.join(', '));
        return bookOut(XLSX, wb, ctx.to);
      });
    });
  });
  // table -> document with a real table in it
  add(TABLE_IN, ['pdf', 'docx', 'odt', 'epub', 'tex'], function (ctx) {
    return need('xlsx').then(function (XLSX) {
      return readWorkbook(ctx).then(function (wb) {
        return saveDoc(workbookToDoc(XLSX, wb, baseName(ctx.file.name)), ctx.to, ctx.opts);
      });
    });
  }, ['pageSize']);
  // table -> data / text
  add(TABLE_IN, ['json', 'jsonl', 'ndjson', 'yaml', 'yml', 'xml', 'toml', 'sql', 'md', 'txt'], function (ctx) {
    return need('xlsx').then(function (XLSX) {
      return readWorkbook(ctx).then(function (wb) {
        var ws = firstSheet(XLSX, wb);
        if (ctx.to === 'txt') return new Blob([XLSX.utils.sheet_to_csv(ws, { FS: '\t' })], { type: 'text/plain;charset=utf-8' });
        var rows = XLSX.utils.sheet_to_json(ws, { defval: null });
        if (ctx.to === 'sql') return toSql(rows, baseName(ctx.file.name));
        if (ctx.to === 'md') {
          var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          var head = aoa[0] || [];
          var lines = ['| ' + head.join(' | ') + ' |', '| ' + head.map(function () { return '---'; }).join(' | ') + ' |'];
          aoa.slice(1).forEach(function (r) { lines.push('| ' + head.map(function (_, i) { return String(r[i] === undefined ? '' : r[i]).replace(/\|/g, '\\|'); }).join(' | ') + ' |'); });
          return new Blob([lines.join('\n') + '\n'], { type: 'text/markdown;charset=utf-8' });
        }
        return writeData(ctx.to === 'xml' ? { rows: { row: rows } } : rows, ctx.to);
      });
    });
  });

  // data -> data
  add(DATA_IN, ['json', 'jsonl', 'ndjson', 'yaml', 'yml', 'xml', 'toml'], function (ctx) {
    return readData(ctx).then(function (v) { return writeData(v, ctx.to); });
  });
  add(DATA_IN, ['sql'], function (ctx) {
    return readData(ctx).then(function (v) { return toSql(v, baseName(ctx.file.name)); });
  });
  // data -> spreadsheet / csv
  add(DATA_IN, TABLE_OUT.concat(['tsv']), function (ctx) {
    return need('xlsx').then(function (XLSX) {
      return readData(ctx).then(function (v) {
        var rows = rowsOf(v);
        ctx.log(rows.length + ' rows');
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, rows), 'Sheet1');
        return bookOut(XLSX, wb, ctx.to);
      });
    });
  });
  // data -> readable document
  add(DATA_IN, ['txt', 'md', 'html', 'pdf', 'docx', 'odt', 'tex'], function (ctx) {
    return readData(ctx).then(function (v) {
      var pretty = JSON.stringify(v, null, 2);
      var doc = { title: baseName(ctx.file.name), blocks: [{ t: 'code', runs: [{ text: pretty }] }] };
      return saveDoc(doc, ctx.to, ctx.opts);
    });
  }, ['pageSize']);

  // audio
  add(AUDIO_IN, AUDIO_OUT, function (ctx) {
    return decodeAudio(ctx.file).then(function (buf) {
      ctx.log(buf.numberOfChannels + ' ch, ' + buf.sampleRate + ' Hz, ' + buf.duration.toFixed(1) + ' s');
      return audioOut(buf, ctx.to, ctx.opts, ctx.log);
    });
  }, ['bitrate']);

  // video -> audio
  add(VIDEO_IN, AUDIO_OUT, function (ctx) {
    return decodeAudio(ctx.file).then(function (buf) {
      ctx.log('audio track: ' + buf.duration.toFixed(1) + ' s');
      return audioOut(buf, ctx.to, ctx.opts, ctx.log);
    });
  }, ['bitrate'], 'extracts the audio track');

  // video -> video (real re-encode)
  add(VIDEO_IN, ['mp4', 'webm'], function (ctx) {
    return transcodeVideo(ctx, ctx.to);
  }, ['width', 'fps', 'quality', 'bitrate'], 're-encodes every frame in your browser, so a long clip takes a while');

  // video -> animated gif
  add(VIDEO_IN, ['gif'], function (ctx) {
    var v;
    return loadVideo(ctx.file).then(function (vid) {
      v = vid;
      ctx.log('video ' + v.videoWidth + ' x ' + v.videoHeight + ', ' + (v.duration || 0).toFixed(1) + ' s');
      return grabFrames(v, ctx.opts, ctx.progress);
    }).then(function (r) {
      ctx.log('quantising ' + r.frames.length + ' frames');
      var blob = Enc.gif(r.frames, { dither: ctx.opts.dither !== false });
      URL.revokeObjectURL(v.src);
      return blob;
    });
  }, ['width', 'fps', 'maxSeconds', 'time', 'dither'], 'samples frames from the chosen start point');

  // video -> still frame
  add(VIDEO_IN, ['png', 'jpg', 'jpeg', 'webp', 'avif', 'jxl', 'bmp', 'tga', 'ppm'], function (ctx) {
    var v;
    return loadVideo(ctx.file).then(function (vid) {
      v = vid;
      return seek(v, ctx.opts.time || 0);
    }).then(function () {
      var c = canvasOf(v.videoWidth, v.videoHeight);
      c.getContext('2d').drawImage(v, 0, 0);
      URL.revokeObjectURL(v.src);
      return encodeCanvas(resize(c, ctx.opts.width), ctx.to, ctx.opts);
    });
  }, ['time', 'width', 'quality'], 'grabs one frame');

  // 3D meshes
  add(['obj', 'stl', 'ply', 'gltf', 'glb'], ['obj', 'stl', 'ply', 'gltf', 'glb'], function (ctx) {
    if (ctx.from === 'glb' && ctx.to === 'gltf') return ctx.file.arrayBuffer().then(glbToGltf);
    if (ctx.from === 'gltf' && ctx.to === 'glb') return blobText(ctx.file).then(gltfToGlb);
    return readMesh(ctx).then(function (mesh) {
      ctx.log(mesh.pos.length + ' vertices, ' + mesh.tris.length + ' triangles');
      return writeMesh(mesh, ctx.to, baseName(ctx.file.name));
    });
  }, [], 'geometry only — materials and textures are not carried across');

  // fonts
  add(['ttf', 'otf'], ['woff'], function (ctx) {
    return ctx.file.arrayBuffer().then(fontToWoff);
  }, [], 'compresses the font tables with zlib');
  add(['woff'], ['ttf', 'otf'], function (ctx) {
    return ctx.file.arrayBuffer().then(woffToFont).then(function (r) {
      if (r.ext !== ctx.to) ctx.log('note: this WOFF wraps ' + (r.ext === 'otf' ? 'CFF (OpenType)' : 'TrueType') + ' outlines, so the file is really a .' + r.ext);
      return r.blob;
    });
  }, [], 'unpacks the original font tables');

  // archives
  add(['zip'], ['tar', 'tgz'], function (ctx) {
    return zipEntries(ctx.file).then(function (e) {
      ctx.log(e.length + ' entries');
      var tar = Enc.tar(e);
      return ctx.to === 'tar' ? tar : gzip(tar);
    });
  });
  add(['tar'], ['zip', 'tgz'], function (ctx) {
    if (ctx.to === 'tgz') return gzip(ctx.file);
    return ctx.file.arrayBuffer().then(function (ab) {
      var e = Enc.untar(new Uint8Array(ab));
      ctx.log(e.length + ' entries');
      return entriesToZip(e);
    });
  });
  add(['tgz'], ['zip', 'tar'], function (ctx) {
    return gunzip(ctx.file).then(function (tarBlob) {
      if (ctx.to === 'tar') return tarBlob;
      return tarBlob.arrayBuffer().then(function (ab) {
        var e = Enc.untar(new Uint8Array(ab));
        ctx.log(e.length + ' entries');
        return entriesToZip(e);
      });
    });
  });
  add(['gz'], ['*'], function (ctx) { return gunzip(ctx.file); });

  // catch-alls: any file can be wrapped or compressed. Registered last.
  var ALL = Object.keys(root.Formats.EXT).concat(['*']);
  add(ALL, ['zip'], function (ctx) {
    return ctx.file.arrayBuffer().then(function (ab) {
      return entriesToZip([{ name: ctx.file.name, data: new Uint8Array(ab) }]);
    });
  }, [], 'wraps the file in a zip archive');
  add(ALL, ['gz'], function (ctx) { return gzip(ctx.file); }, [], 'gzip-compresses the file as-is');
  add(ALL, ['tar', 'tgz'], function (ctx) {
    return ctx.file.arrayBuffer().then(function (ab) {
      var tar = Enc.tar([{ name: ctx.file.name, data: new Uint8Array(ab) }]);
      return ctx.to === 'tar' ? tar : gzip(tar);
    });
  });

  /* --------------------------------------------- prune what cannot happen */
  function canvasCanEncode(mime) {
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 1;
      return c.toDataURL(mime).indexOf('data:' + mime) === 0;
    } catch (e) { return false; }
  }
  function dropTarget(t, froms) {
    (froms || Object.keys(G)).forEach(function (f) { if (G[f]) delete G[f][t]; });
  }
  if (!canvasCanEncode('image/webp')) dropTarget('webp');
  if (!gzipSupported()) { dropTarget('gz'); dropTarget('tgz'); dropTarget('woff'); dropTarget('ttf', ['woff']); dropTarget('otf', ['woff']); }
  if (typeof root.AudioEncoder !== 'function') ['m4a', 'aac', 'ogg', 'opus'].forEach(function (t) { dropTarget(t, AUDIO_IN.concat(VIDEO_IN)); });
  if (typeof root.VideoEncoder !== 'function') { dropTarget('mp4', VIDEO_IN); dropTarget('webm', VIDEO_IN); }
  // Codec support is asynchronous; drop anything the platform refuses and tell the UI.
  var probes = [];
  if (typeof root.AudioEncoder === 'function') {
    probes.push(root.AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 128000 })
      .then(function (r) { if (!r.supported) { dropTarget('m4a', AUDIO_IN.concat(VIDEO_IN)); dropTarget('aac', AUDIO_IN.concat(VIDEO_IN)); dropTarget('mp4', VIDEO_IN); } }, function () {}));
    probes.push(root.AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 96000 })
      .then(function (r) { if (!r.supported) { dropTarget('ogg', AUDIO_IN.concat(VIDEO_IN)); dropTarget('opus', AUDIO_IN.concat(VIDEO_IN)); dropTarget('webm', VIDEO_IN); } }, function () {}));
  }
  if (typeof root.VideoEncoder === 'function') {
    probes.push(root.VideoEncoder.isConfigSupported({ codec: 'avc1.4d001f', width: 640, height: 360, bitrate: 1e6, avc: { format: 'avc' } })
      .then(function (r) { if (!r.supported) dropTarget('mp4', VIDEO_IN); }, function () {}));
    probes.push(root.VideoEncoder.isConfigSupported({ codec: 'vp09.00.10.08', width: 640, height: 360, bitrate: 1e6 })
      .then(function (r) { if (!r.supported) dropTarget('webm', VIDEO_IN); }, function () {}));
  }
  var ready = Promise.all(probes).then(function () { document.dispatchEvent(new Event('formats-changed')); });

  /* ------------------------------------------------------------- runner  */
  var PREFERRED = {
    image: ['jpg', 'png', 'webp', 'pdf'],
    doc: ['pdf', 'docx', 'html', 'txt'],
    table: ['csv', 'xlsx', 'json'],
    data: ['json', 'csv', 'yaml'],
    audio: ['mp3', 'wav'],
    video: ['mp4', 'webm', 'gif', 'mp3'],
    model3d: ['glb', 'stl', 'obj'],
    font: ['woff', 'ttf'],
    archive: ['zip'],
    any: ['zip']
  };
  function defaultTarget(from) {
    var targets = targetsFor(from).filter(function (t) { return t !== '*'; });
    if (!targets.length) return '';
    var fam = from === '*' ? 'any' : root.Formats.meta(from).family;
    var wish = PREFERRED[fam] || [];
    for (var i = 0; i < wish.length; i++) {
      if (wish[i] !== from && targets.indexOf(wish[i]) > -1) return wish[i];
    }
    return targets[0];
  }
  function targetsFor(from) { return G[from] ? Object.keys(G[from]).sort() : []; }
  function sourcesList() { return Object.keys(G).sort(); }
  function rule(from, to) { return G[from] && G[from][to]; }
  function pairCount() {
    return Object.keys(G).reduce(function (n, f) { return n + Object.keys(G[f]).length; }, 0);
  }

  function run(file, from, to, opts, hooks) {
    hooks = hooks || {};
    var r = rule(from, to);
    if (!r) return Promise.reject(new Error('.' + from + ' cannot be converted to .' + to));
    var ctx = {
      file: file, from: from, to: to, opts: opts || {},
      log: hooks.log || function () {},
      progress: hooks.progress || function () {}
    };
    return Promise.resolve().then(function () { return r.run(ctx); }).then(function (res) {
      var blob = res && res.blob ? res.blob : res;
      if (!(blob instanceof Blob)) throw new Error('the converter produced no output');
      var ext = (res && res.ext) || (to === '*' ? (root.Formats.extOf(baseName(file.name)) || 'bin') : to);
      var name = (res && res.name) || (baseName(file.name) + '.' + ext);
      return { blob: blob, name: name, ext: ext };
    });
  }

  root.Convert = {
    graph: G, run: run, rule: rule, targetsFor: targetsFor, sourcesList: sourcesList,
    pairCount: pairCount, baseName: baseName, gzipSupported: gzipSupported,
    defaultTarget: defaultTarget, ready: ready,
    // pure helpers exposed for the headless test harness in test/
    _pure: {
      parseObj: parseObj, parseStl: parseStl, parsePly: parsePly,
      writeObj: writeObj, writeStl: writeStl, writePly: writePly,
      glbToGltf: glbToGltf, gltfToGlb: gltfToGlb, glbParse: glbParse, meshToGltfText: meshToGltfText, gltfToMesh: gltfToMesh,
      objToXml: objToXml, rowsOf: rowsOf, b64FromBytes: b64FromBytes, bytesFromB64: bytesFromB64,
      toSql: toSql, sfntTables: sfntTables, avcCodecFor: avcCodecFor
    }
  };
})(window);
