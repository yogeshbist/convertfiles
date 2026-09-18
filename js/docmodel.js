/* docmodel.js — one intermediate document model shared by every document pair.
   Doc   = { title, blocks: [Block] }
   Block = { t:'h'|'p'|'li'|'code'|'quote'|'hr'|'img'|'table', level, ordered, runs:[Run],
             blob, mime, alt, w, h,          (img — dataUrl/bytes/ext filled by prepareImages)
             rows:[[string]], header:bool }  (table)
   Run   = { text, b, i, code, href }                                             */
(function (root) {
  'use strict';
  var need = root.Formats.need;
  var BULLET = String.fromCharCode(0x2022);

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function flat(block) { return (block.runs || []).map(function (r) { return r.text; }).join(''); }
  function textRun(t) { return [{ text: t }]; }
  function dataUriToBlob(uri) {
    var m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(uri);
    if (!m) return null;
    var mime = m[1] || 'application/octet-stream';
    if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: mime });
    var bin = atob(m[3].replace(/\s/g, '')), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }
  function imgBlock(blob, alt) { return { t: 'img', blob: blob, mime: blob.type, alt: alt || '', runs: [] }; }
  function tableBlock(rows, header) { return { t: 'table', rows: rows, header: !!header, runs: [] }; }

  /* ============================================================== PARSERS  */

  function fromHTML(html, title) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var blocks = [];
    var t = title || (doc.querySelector('title') && doc.querySelector('title').textContent) || '';

    function runsOf(node, style) {
      var out = [];
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) {
          if (n.nodeValue) out.push(Object.assign({ text: n.nodeValue.replace(/\s+/g, ' ') }, style));
          return;
        }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toLowerCase(), s = Object.assign({}, style);
        if (tag === 'b' || tag === 'strong') s.b = true;
        else if (tag === 'i' || tag === 'em') s.i = true;
        else if (tag === 'code' || tag === 'kbd' || tag === 'samp') s.code = true;
        else if (tag === 'a') s.href = n.getAttribute('href') || '';
        else if (tag === 'br') { out.push({ text: '\n' }); return; }
        else if (tag === 'img') { var alt = n.getAttribute('alt'); if (alt) out.push(Object.assign({ text: '[' + alt + ']' }, style)); return; }
        out = out.concat(runsOf(n, s));
      });
      return out;
    }
    function tidy(runs) {
      var out = [];
      runs.forEach(function (r) {
        if (!r.text) return;
        var last = out[out.length - 1];
        if (last && !!last.b === !!r.b && !!last.i === !!r.i && !!last.code === !!r.code && last.href === r.href) last.text += r.text;
        else out.push(r);
      });
      if (out.length) { out[0].text = out[0].text.replace(/^\s+/, ''); out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, ''); }
      return out.filter(function (r) { return r.text; });
    }
    // Pull embedded (data:) images out of an element as their own blocks.
    function liftImages(node) {
      var clone = node.cloneNode(true), found = [];
      clone.querySelectorAll('img').forEach(function (img) {
        var src = img.getAttribute('src') || '';
        if (/^data:image\//.test(src)) {
          var blob = dataUriToBlob(src);
          if (blob) found.push(imgBlock(blob, img.getAttribute('alt') || ''));
          img.remove();
        }
      });
      return { clone: clone, images: found };
    }
    function pushTable(tbl) {
      var rows = [], header = false;
      tbl.querySelectorAll('tr').forEach(function (tr, i) {
        if (tr.closest('table') !== tbl) return;
        var cells = [];
        tr.querySelectorAll('th,td').forEach(function (c) { if (c.closest('tr') === tr) cells.push(c.textContent.replace(/\s+/g, ' ').trim()); });
        if (i === 0 && tr.querySelector('th')) header = true;
        if (cells.length) rows.push(cells);
      });
      if (rows.length) blocks.push(tableBlock(rows, header));
    }
    function walk(node, ctx) {
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) {
          var txt = n.nodeValue.replace(/\s+/g, ' ').trim();
          if (txt) blocks.push({ t: 'p', runs: textRun(txt) });
          return;
        }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toLowerCase();
        if (tag === 'img') {
          var src = n.getAttribute('src') || '';
          if (/^data:image\//.test(src)) { var b = dataUriToBlob(src); if (b) blocks.push(imgBlock(b, n.getAttribute('alt') || '')); }
          else if (n.getAttribute('alt')) blocks.push({ t: 'p', runs: textRun('[' + n.getAttribute('alt') + ']') });
          return;
        }
        if (/^h[1-6]$/.test(tag)) { blocks.push({ t: 'h', level: +tag[1], runs: tidy(runsOf(n, {})) }); return; }
        if (tag === 'p' || tag === 'figure') {
          var lifted = liftImages(n);
          lifted.images.forEach(function (b) { blocks.push(b); });
          var r = tidy(runsOf(lifted.clone, {}));
          if (r.length) blocks.push({ t: 'p', runs: r });
          return;
        }
        if (tag === 'pre') { blocks.push({ t: 'code', runs: textRun(n.textContent.replace(/\s+$/, '')) }); return; }
        if (tag === 'blockquote') { blocks.push({ t: 'quote', runs: tidy(runsOf(n, {})) }); return; }
        if (tag === 'hr') { blocks.push({ t: 'hr', runs: [] }); return; }
        if (tag === 'table') { pushTable(n); return; }
        if (tag === 'ul' || tag === 'ol') {
          var ordered = tag === 'ol', depth = (ctx.depth || 0) + 1;
          n.querySelectorAll(':scope > li').forEach(function (li) {
            var nested = li.querySelectorAll(':scope > ul, :scope > ol');
            var clone = li.cloneNode(true);
            clone.querySelectorAll(':scope > ul, :scope > ol').forEach(function (x) { x.remove(); });
            var rr = tidy(runsOf(clone, {}));
            if (rr.length) blocks.push({ t: 'li', ordered: ordered, level: depth, runs: rr });
            nested.forEach(function (x) { walk({ childNodes: [x] }, { depth: depth }); });
          });
          return;
        }
        if (tag === 'script' || tag === 'style' || tag === 'head' || tag === 'nav' || tag === 'noscript') return;
        walk(n, ctx);
      });
    }
    walk(doc.body, {});
    return { title: t, blocks: blocks.length ? blocks : [{ t: 'p', runs: textRun('') }] };
  }

  function fromText(txt, title) {
    var blocks = [];
    txt.replace(/\r\n?/g, '\n').split(/\n{2,}/).forEach(function (para) {
      var s = para.replace(/\s+$/, '');
      if (s.trim()) blocks.push({ t: 'p', runs: textRun(s) });
    });
    return { title: title || '', blocks: blocks.length ? blocks : [{ t: 'p', runs: textRun('') }] };
  }

  function fromMarkdown(md, title) {
    return need('marked').then(function (m) {
      var parse = m.parse || m;
      return fromHTML(parse(md, { mangle: false, headerIds: false }), title);
    });
  }

  function fromDocx(file, title) {
    return need('mammoth').then(function (mam) {
      return file.arrayBuffer().then(function (ab) { return mam.convertToHtml({ arrayBuffer: ab }); });
    }).then(function (res) { return fromHTML(res.value, title); });
  }

  function fromOdt(file, title) {
    var zip;
    return need('jszip').then(function (JSZip) { return JSZip.loadAsync(file); })
      .then(function (z) {
        zip = z;
        var f = zip.file('content.xml');
        if (!f) throw new Error('not a valid ODT package (content.xml missing)');
        return f.async('string');
      })
      .then(function (xml) {
        var d = new DOMParser().parseFromString(xml, 'application/xml');
        var blocks = [], body = d.getElementsByTagName('office:text')[0] || d.documentElement;
        var pending = [];
        function runsFrom(el) { var t = el.textContent; return t ? [{ text: t }] : []; }
        function walk(el, depth, ordered) {
          Array.prototype.forEach.call(el.children, function (c) {
            var n = c.nodeName;
            if (n === 'text:h') {
              var lvl = parseInt(c.getAttribute('text:outline-level') || '1', 10);
              blocks.push({ t: 'h', level: Math.min(6, Math.max(1, lvl)), runs: runsFrom(c) });
            } else if (n === 'text:p') {
              var imgs = c.getElementsByTagName('draw:image');
              Array.prototype.forEach.call(imgs, function (im) {
                var href = im.getAttribute('xlink:href'), zf = href && zip.file(href), slot = { t: 'p', runs: textRun('[image]') };
                blocks.push(slot);
                if (zf) pending.push(zf.async('blob').then(function (b) {
                  var ext = /\.(\w+)$/.exec(href), mime = ext ? ('image/' + ext[1].toLowerCase().replace('jpg', 'jpeg')) : 'image/png';
                  Object.assign(slot, imgBlock(new Blob([b], { type: mime }), ''));
                }));
              });
              var r = runsFrom(c);
              if (r.length && r[0].text.trim()) blocks.push(depth ? { t: 'li', ordered: ordered, level: depth, runs: r } : { t: 'p', runs: r });
            } else if (n === 'text:list') {
              walk(c, (depth || 0) + 1, false);
            } else if (n === 'text:list-item') {
              walk(c, depth, ordered);
            } else if (n === 'table:table') {
              var rows = [];
              Array.prototype.forEach.call(c.getElementsByTagName('table:table-row'), function (row) {
                var cells = [];
                Array.prototype.forEach.call(row.getElementsByTagName('table:table-cell'), function (cell) { cells.push(cell.textContent.trim()); });
                if (cells.length) rows.push(cells);
              });
              if (rows.length) blocks.push(tableBlock(rows, false));
            } else { walk(c, depth, ordered); }
          });
        }
        walk(body, 0, false);
        return Promise.all(pending).then(function () {
          return { title: title || '', blocks: blocks.length ? blocks : [{ t: 'p', runs: textRun('') }] };
        });
      });
  }

  function fromRtf(text, title) {
    var s = text.replace(/\\\r?\n/g, '\\par ');
    s = s.replace(/\{\\\*[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
    s = s.replace(/\{\\(fonttbl|colortbl|stylesheet|info|pict)[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
    s = s.replace(/\\u(-?\d+)\s?\??/g, function (_, n) { var c = +n; return String.fromCharCode(c < 0 ? c + 65536 : c); });
    s = s.replace(/\\'([0-9a-fA-F]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
    s = s.replace(/\\(par|line|pard)\b\s?/g, '\n');
    s = s.replace(/\\tab\b\s?/g, '\t');
    s = s.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');
    s = s.replace(/[{}]/g, '');
    return fromText(s.replace(/\n{3,}/g, '\n\n').trim(), title);
  }

  function fromPdf(file, title, onProgress) {
    return need('pdfjs').then(function (pdfjsLib) {
      return file.arrayBuffer().then(function (ab) { return pdfjsLib.getDocument({ data: ab }).promise; });
    }).then(function (pdf) {
      var blocks = [], chain = Promise.resolve();
      for (var p = 1; p <= pdf.numPages; p++) {
        (function (n) {
          chain = chain.then(function () {
            if (onProgress) onProgress(n / pdf.numPages, 'reading page ' + n + ' of ' + pdf.numPages);
            return pdf.getPage(n).then(function (page) { return page.getTextContent(); }).then(function (tc) {
              var lines = [], cur = null, lastY = null;
              tc.items.forEach(function (it) {
                var y = it.transform[5];
                if (lastY === null || Math.abs(y - lastY) > 2) { cur = { y: y, s: '' }; lines.push(cur); lastY = y; }
                cur.s += it.str;
                if (it.hasEOL) { cur = null; lastY = null; }
              });
              var para = [];
              lines.forEach(function (l) {
                var s = l.s.replace(/\s+/g, ' ').trim();
                if (!s) { if (para.length) { blocks.push({ t: 'p', runs: textRun(para.join(' ')) }); para = []; } return; }
                para.push(s);
                if (/[.!?:;")]$/.test(s) || s.length < 40) { blocks.push({ t: 'p', runs: textRun(para.join(' ')) }); para = []; }
              });
              if (para.length) blocks.push({ t: 'p', runs: textRun(para.join(' ')) });
              if (n < pdf.numPages) blocks.push({ t: 'hr', runs: [] });
            });
          });
        })(p);
      }
      return chain.then(function () {
        return { title: title || '', blocks: blocks.length ? blocks : [{ t: 'p', runs: textRun('') }] };
      });
    });
  }

  function fromEpub(file, title) {
    var zip;
    return need('jszip').then(function (JSZip) { return JSZip.loadAsync(file); })
      .then(function (z) {
        zip = z;
        var names = Object.keys(zip.files).filter(function (n) { return /\.(x?html|htm)$/i.test(n); }).sort();
        if (!names.length) throw new Error('no readable XHTML inside this EPUB');
        return Promise.all(names.slice(0, 400).map(function (n) { return zip.file(n).async('string'); }));
      })
      .then(function (docs) {
        var blocks = [];
        docs.forEach(function (h, i) {
          var d = fromHTML(h, '');
          if (i && d.blocks.length) blocks.push({ t: 'hr', runs: [] });
          blocks = blocks.concat(d.blocks);
        });
        return { title: title || '', blocks: blocks };
      });
  }

  /* ============================================== IMAGE PREPARATION ====== */
  // Decodes every img block once: pixel size, bytes, data URL, and a PNG
  // re-encode for formats Word/PDF cannot embed (webp, bmp, svg, ...).
  function prepareImages(doc) {
    var jobs = doc.blocks.map(function (b, i) {
      if (b.t !== 'img' || b.dataUrl) return null;
      return decodeToCanvas(b.blob).then(function (canvas) {
        b.w = canvas.width; b.h = canvas.height;
        var keep = /^image\/(png|jpeg|gif)$/.test(b.mime);
        var blobP = keep ? Promise.resolve(b.blob) : new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
        return blobP.then(function (blob) {
          b.blob = blob; b.mime = blob.type; b.ext = blob.type === 'image/jpeg' ? 'jpeg' : blob.type === 'image/gif' ? 'gif' : 'png';
          return blob.arrayBuffer();
        }).then(function (ab) {
          b.bytes = new Uint8Array(ab);
          return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { b.dataUrl = fr.result; res(); }; fr.readAsDataURL(b.blob); });
        });
      }).catch(function () {
        doc.blocks[i] = { t: 'p', runs: textRun(b.alt ? '[' + b.alt + ']' : '[image]') };
      });
    }).filter(Boolean);
    return Promise.all(jobs).then(function () { return doc; });
  }
  function decodeToCanvas(blob) {
    var draw = function (src, w, h) {
      var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
      c.getContext('2d').drawImage(src, 0, 0); return c;
    };
    var p = root.createImageBitmap ? createImageBitmap(blob).then(function (bmp) { var c = draw(bmp, bmp.width, bmp.height); bmp.close && bmp.close(); return c; }) : Promise.reject();
    return p.catch(function () {
      return new Promise(function (res, rej) {
        var url = URL.createObjectURL(blob), img = new Image();
        img.onload = function () { res(draw(img, img.naturalWidth || 300, img.naturalHeight || 150)); URL.revokeObjectURL(url); };
        img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('undecodable image')); };
        img.src = url;
      });
    });
  }
  // Fit an image into a box, returning [w, h] in the caller's units.
  function fit(w, h, maxW, maxH) {
    var s = Math.min(1, maxW / w, maxH / h);
    return [w * s, h * s];
  }

  /* ============================================================== WRITERS  */

  function toText(doc) {
    var out = [], counters = {};
    doc.blocks.forEach(function (b) {
      var s = flat(b);
      if (b.t === 'hr') { out.push('\n----------------------------------------\n'); counters = {}; return; }
      if (b.t === 'img') { out.push('[image' + (b.alt ? ': ' + b.alt : '') + ']'); return; }
      if (b.t === 'table') { out.push(b.rows.map(function (r) { return r.join('\t'); }).join('\n')); return; }
      if (b.t === 'h') { out.push('\n' + s.toUpperCase() + '\n' + '='.repeat(Math.min(60, Math.max(3, s.length)))); return; }
      if (b.t === 'li') {
        var d = b.level || 1, pad = '  '.repeat(d - 1);
        if (b.ordered) { counters[d] = (counters[d] || 0) + 1; out.push(pad + counters[d] + '. ' + s); }
        else out.push(pad + '- ' + s);
        return;
      }
      if (b.t === 'quote') { out.push(s.split('\n').map(function (l) { return '> ' + l; }).join('\n')); return; }
      out.push(s);
    });
    return new Blob([out.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
  }

  function mdRuns(runs) {
    return runs.map(function (r) {
      var t = r.text.replace(/([\\`*_\[\]])/g, '\\$1');
      if (r.code) t = '`' + r.text + '`';
      if (r.b) t = '**' + t + '**';
      if (r.i) t = '*' + t + '*';
      if (r.href) t = '[' + t + '](' + r.href + ')';
      return t;
    }).join('');
  }
  function mdTable(b) {
    var cols = Math.max.apply(null, b.rows.map(function (r) { return r.length; }));
    var cell = function (s) { return String(s === undefined ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' '); };
    var head = b.header ? b.rows[0] : [], body = b.header ? b.rows.slice(1) : b.rows;
    var lines = [];
    var hdr = []; for (var i = 0; i < cols; i++) hdr.push(cell(head[i] !== undefined ? head[i] : (b.header ? '' : 'Column ' + (i + 1))));
    lines.push('| ' + hdr.join(' | ') + ' |');
    lines.push('| ' + hdr.map(function () { return '---'; }).join(' | ') + ' |');
    body.forEach(function (r) { var cells = []; for (var i = 0; i < cols; i++) cells.push(cell(r[i])); lines.push('| ' + cells.join(' | ') + ' |'); });
    return lines.join('\n');
  }
  function toMarkdown(doc) {
    var out = [], counters = {};
    if (doc.title) out.push('# ' + doc.title, '');
    doc.blocks.forEach(function (b) {
      if (b.t === 'hr') { out.push('', '---', ''); counters = {}; return; }
      if (b.t === 'img') { out.push('', '![' + (b.alt || 'image') + '](' + (b.dataUrl || '') + ')', ''); return; }
      if (b.t === 'table') { out.push('', mdTable(b), ''); return; }
      if (b.t === 'h') { out.push('', '#'.repeat(Math.min(6, b.level || 1)) + ' ' + mdRuns(b.runs), ''); return; }
      if (b.t === 'li') {
        var d = b.level || 1, pad = '  '.repeat(d - 1);
        if (b.ordered) { counters[d] = (counters[d] || 0) + 1; out.push(pad + counters[d] + '. ' + mdRuns(b.runs)); }
        else out.push(pad + '- ' + mdRuns(b.runs));
        return;
      }
      if (b.t === 'quote') { out.push('', '> ' + flat(b).replace(/\n/g, '\n> '), ''); return; }
      if (b.t === 'code') { out.push('', '```', flat(b), '```', ''); return; }
      out.push('', mdRuns(b.runs));
    });
    return new Blob([out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'], { type: 'text/markdown;charset=utf-8' });
  }

  function htmlRuns(runs) {
    return runs.map(function (r) {
      var t = esc(r.text).replace(/\n/g, '<br>');
      if (r.code) t = '<code>' + t + '</code>';
      if (r.b) t = '<strong>' + t + '</strong>';
      if (r.i) t = '<em>' + t + '</em>';
      if (r.href) t = '<a href="' + esc(r.href) + '">' + t + '</a>';
      return t;
    }).join('');
  }
  function htmlTable(b) {
    var out = ['<table>'];
    b.rows.forEach(function (r, i) {
      var tag = (b.header && i === 0) ? 'th' : 'td';
      out.push('<tr>' + r.map(function (c) { return '<' + tag + '>' + esc(c) + '</' + tag + '>'; }).join('') + '</tr>');
    });
    out.push('</table>');
    return out.join('\n');
  }
  function bodyHTML(doc, xhtml) {
    var out = [], listOpen = null;
    function closeList() { if (listOpen) { out.push('</' + listOpen + '>'); listOpen = null; } }
    doc.blocks.forEach(function (b) {
      if (b.t === 'li') {
        var want = b.ordered ? 'ol' : 'ul';
        if (listOpen !== want) { closeList(); out.push('<' + want + '>'); listOpen = want; }
        out.push('<li>' + htmlRuns(b.runs) + '</li>');
        return;
      }
      closeList();
      if (b.t === 'hr') out.push(xhtml ? '<hr/>' : '<hr>');
      else if (b.t === 'img') out.push('<p><img src="' + (b.dataUrl || '') + '" alt="' + esc(b.alt || '') + '"' + (b.w ? ' width="' + b.w + '" height="' + b.h + '"' : '') + (xhtml ? '/>' : '>') + '</p>');
      else if (b.t === 'table') out.push(htmlTable(b));
      else if (b.t === 'h') out.push('<h' + (b.level || 1) + '>' + htmlRuns(b.runs) + '</h' + (b.level || 1) + '>');
      else if (b.t === 'quote') out.push('<blockquote><p>' + htmlRuns(b.runs) + '</p></blockquote>');
      else if (b.t === 'code') out.push('<pre><code>' + esc(flat(b)) + '</code></pre>');
      else out.push('<p>' + htmlRuns(b.runs) + '</p>');
    });
    closeList();
    var s = out.join('\n');
    return xhtml ? s.replace(/<br>/g, '<br/>') : s;
  }
  var PAGE_CSS = 'body{font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;max-width:44em;margin:3rem auto;padding:0 1.25rem;color:#1a1a1a}h1,h2,h3,h4,h5,h6{line-height:1.25;margin:2em 0 .6em}pre{background:#f4f4f4;padding:1em;overflow:auto}code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em}blockquote{margin:1.4em 0;padding-left:1em;border-left:3px solid #ddd;color:#555}hr{border:0;border-top:1px solid #ddd;margin:2.5em 0}img{max-width:100%;height:auto}table{border-collapse:collapse;margin:1.2em 0;font-size:.95em}th,td{border:1px solid #d5d5d5;padding:.4em .7em;text-align:left}th{background:#f4f4f4}';
  function toHTML(doc) {
    var page = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' +
      esc(doc.title || 'Document') + '</title>\n<style>\n' + PAGE_CSS + '\n</style>\n</head>\n<body>\n' + bodyHTML(doc, false) + '\n</body>\n</html>\n';
    return new Blob([page], { type: 'text/html;charset=utf-8' });
  }

  function toRtf(doc) {
    function rtfEsc(s) {
      return String(s).replace(/[\\{}]/g, '\\$&').replace(/\n/g, '\\line ')
        .replace(/[^\x00-\x7f]/g, function (c) { return '\\u' + c.charCodeAt(0) + '?'; });
    }
    function hex(u8) { var s = '', H = '0123456789abcdef'; for (var i = 0; i < u8.length; i++) { s += H[u8[i] >> 4] + H[u8[i] & 15]; if (i % 64 === 63) s += '\n'; } return s; }
    var out = ['{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}{\\f1\\fmodern Courier;}}\\fs24'];
    var counters = {};
    doc.blocks.forEach(function (b) {
      if (b.t === 'hr') { out.push('\\par\\brdrb\\brdrs\\brdrw10\\brsp20\\par\\pard'); counters = {}; return; }
      if (b.t === 'img' && b.bytes && (b.ext === 'png' || b.ext === 'jpeg')) {
        var dims = fit(b.w, b.h, 620, 800), twW = Math.round(dims[0] * 15), twH = Math.round(dims[1] * 15);
        out.push('\\pard\\sa180{\\pict\\' + (b.ext === 'png' ? 'pngblip' : 'jpegblip') + '\\picw' + b.w + '\\pich' + b.h + '\\picwgoal' + twW + '\\pichgoal' + twH + '\n' + hex(b.bytes) + '}\\par');
        return;
      }
      if (b.t === 'img') { out.push('\\pard\\sa180 [image]\\par'); return; }
      if (b.t === 'table') {
        var cols = Math.max.apply(null, b.rows.map(function (r) { return r.length; })), cw = Math.floor(9000 / cols);
        b.rows.forEach(function (r, ri) {
          var row = '\\trowd\\trgaph80';
          for (var c = 1; c <= cols; c++) row += '\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx' + (cw * c);
          for (var i = 0; i < cols; i++) row += (b.header && ri === 0 ? '{\\b ' : '') + rtfEsc(r[i] === undefined ? '' : r[i]) + (b.header && ri === 0 ? '}' : '') + '\\cell';
          out.push(row + '\\row');
        });
        out.push('\\pard\\sa180\\par');
        return;
      }
      var pre = '\\pard\\sa180 ', body = '';
      if (b.t === 'h') { var sz = [48, 40, 34, 30, 27, 25][(b.level || 1) - 1] || 24; pre = '\\pard\\sb240\\sa120\\b\\fs' + sz + ' '; }
      if (b.t === 'code') { pre = '\\pard\\sa180\\f1\\fs20 '; }
      if (b.t === 'quote') { pre = '\\pard\\li720\\sa180\\i '; }
      if (b.t === 'li') {
        var d = b.level || 1;
        var marker = b.ordered ? ((counters[d] = (counters[d] || 0) + 1) + '. ') : '\\bullet  ';
        pre = '\\pard\\fi-360\\li' + (360 * d + 360) + '\\sa60 ' + marker;
      }
      (b.runs || []).forEach(function (r) {
        var t = rtfEsc(r.text);
        if (r.b) t = '{\\b ' + t + '}';
        if (r.i) t = '{\\i ' + t + '}';
        if (r.code) t = '{\\f1 ' + t + '}';
        body += t;
      });
      if (b.t === 'code') body = rtfEsc(flat(b));
      out.push(pre + body + '\\par');
    });
    out.push('}');
    return new Blob([out.join('\n')], { type: 'application/rtf' });
  }

  function toDocx(doc) {
    return need('jszip').then(function (JSZip) {
      var zip = new JSZip(), media = [], imgN = 0;
      var PAGE_W = 9638;                                       // twips between A4 margins
      function runXml(r) {
        var props = '';
        if (r.b) props += '<w:b/>';
        if (r.i) props += '<w:i/>';
        if (r.code) props += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>';
        return String(r.text).split('\n').map(function (p, i) {
          return (i ? '<w:r><w:br/></w:r>' : '') +
            '<w:r>' + (props ? '<w:rPr>' + props + '</w:rPr>' : '') +
            '<w:t xml:space="preserve">' + esc(p) + '</w:t></w:r>';
        }).join('');
      }
      function imageXml(b) {
        var n = ++imgN, rid = 'rIdImg' + n, name = 'image' + n + '.' + (b.ext === 'jpeg' ? 'jpg' : b.ext);
        media.push({ name: name, bytes: b.bytes, rid: rid });
        var dims = fit(b.w, b.h, 640, 860), cx = Math.round(dims[0] * 9525), cy = Math.round(dims[1] * 9525);
        return '<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
          '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + n + '" name="Picture ' + n + '" descr="' + esc(b.alt || '') + '"/>' +
          '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
          '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + n + '" name="' + name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
          '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
          '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
          '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
      }
      function tableXml(b) {
        var cols = Math.max.apply(null, b.rows.map(function (r) { return r.length; })), cw = Math.floor(PAGE_W / cols);
        var border = '<w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/>';
        var x = '<w:tbl><w:tblPr><w:tblW w:w="' + PAGE_W + '" w:type="dxa"/><w:tblBorders>' + border + '</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>';
        for (var i = 0; i < cols; i++) x += '<w:gridCol w:w="' + cw + '"/>';
        x += '</w:tblGrid>';
        b.rows.forEach(function (r, ri) {
          var hdr = b.header && ri === 0;
          x += '<w:tr>' + (hdr ? '<w:trPr><w:tblHeader/></w:trPr>' : '');
          for (var c = 0; c < cols; c++) {
            x += '<w:tc><w:tcPr><w:tcW w:w="' + cw + '" w:type="dxa"/>' + (hdr ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '') + '</w:tcPr>' +
              '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>' + runXml({ text: r[c] === undefined ? '' : String(r[c]), b: hdr }) + '</w:p></w:tc>';
          }
          x += '</w:tr>';
        });
        return x + '</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
      }
      var body = doc.blocks.map(function (b) {
        if (b.t === 'img') return b.bytes ? imageXml(b) : '<w:p><w:r><w:t>[image]</w:t></w:r></w:p>';
        if (b.t === 'table') return tableXml(b);
        var runs = (b.runs || []).map(runXml).join('');
        if (b.t === 'hr') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="AAAAAA"/></w:pBdr></w:pPr></w:p>';
        if (b.t === 'h') return '<w:p><w:pPr><w:pStyle w:val="Heading' + Math.min(6, b.level || 1) + '"/></w:pPr>' + runs + '</w:p>';
        if (b.t === 'code') return '<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr><w:t xml:space="preserve">' + esc(flat(b)) + '</w:t></w:r></w:p>';
        if (b.t === 'quote') return '<w:p><w:pPr><w:ind w:left="720"/></w:pPr>' + b.runs.map(function (r) { return runXml(Object.assign({}, r, { i: true })); }).join('') + '</w:p>';
        if (b.t === 'li') return '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="' + Math.min(4, (b.level || 1) - 1) + '"/><w:numId w:val="' + (b.ordered ? 2 : 1) + '"/></w:numPr></w:pPr>' + runs + '</w:p>';
        return '<w:p>' + runs + '</w:p>';
      }).join('');

      var mediaTypes = {};
      media.forEach(function (m) { var e = m.name.split('.').pop(); mediaTypes[e] = e === 'jpg' ? 'image/jpeg' : 'image/' + e; });
      zip.file('[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        Object.keys(mediaTypes).map(function (e) { return '<Default Extension="' + e + '" ContentType="' + mediaTypes[e] + '"/>'; }).join('') +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
        '</Types>');
      zip.folder('_rels').file('.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      var w = zip.folder('word');
      w.folder('_rels').file('document.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
        media.map(function (m) { return '<Relationship Id="' + m.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.name + '"/>'; }).join('') +
        '</Relationships>');
      if (media.length) { var mf = w.folder('media'); media.forEach(function (m) { mf.file(m.name, m.bytes); }); }
      var headStyles = [1, 2, 3, 4, 5, 6].map(function (n) {
        var sz = [36, 30, 26, 24, 22, 22][n - 1];
        return '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr>' +
          '<w:rPr><w:b/><w:sz w:val="' + sz + '"/></w:rPr></w:style>';
      }).join('');
      w.file('styles.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>' +
        headStyles + '</w:styles>');
      function levels(fmt) {
        return [0, 1, 2, 3, 4].map(function (l) {
          var txt = fmt === 'bullet'
            ? '<w:lvlText w:val="&#8226;"/><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr>'
            : '<w:lvlText w:val="%' + (l + 1) + '."/>';
          return '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="' + (fmt === 'bullet' ? 'bullet' : 'decimal') + '"/>' +
            txt + '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 * (l + 1)) + '" w:hanging="360"/></w:pPr></w:lvl>';
        }).join('');
      }
      w.file('numbering.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>' + levels('bullet') + '</w:abstractNum>' +
        '<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>' + levels('decimal') + '</w:abstractNum>' +
        '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>');
      w.file('document.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>' +
        body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>');
      return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
    });
  }

  function toOdt(doc) {
    return need('jszip').then(function (JSZip) {
      var zip = new JSZip(), pics = [], imgN = 0;
      zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
      var NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
      var open = null, out = [];
      doc.blocks.forEach(function (b) {
        function inline() {
          return (b.runs || []).map(function (r) {
            var t = esc(r.text).replace(/\n/g, '<text:line-break/>');
            if (r.b) t = '<text:span text:style-name="B">' + t + '</text:span>';
            if (r.i) t = '<text:span text:style-name="I">' + t + '</text:span>';
            return t;
          }).join('');
        }
        if (b.t === 'li') {
          var want = b.ordered ? 'ol' : 'ul';
          if (open !== want) { if (open) out.push('</text:list>'); out.push('<text:list>'); open = want; }
          out.push('<text:list-item><text:p text:style-name="Standard">' + inline() + '</text:p></text:list-item>');
          return;
        }
        if (open) { out.push('</text:list>'); open = null; }
        if (b.t === 'img' && b.bytes) {
          var n = ++imgN, name = 'Pictures/image' + n + '.' + (b.ext === 'jpeg' ? 'jpg' : b.ext);
          pics.push({ name: name, bytes: b.bytes, mime: b.mime });
          var dims = fit(b.w, b.h, 640, 860), cmW = (dims[0] * 2.54 / 96).toFixed(3), cmH = (dims[1] * 2.54 / 96).toFixed(3);
          out.push('<text:p text:style-name="Standard"><draw:frame draw:name="image' + n + '" text:anchor-type="as-char" svg:width="' + cmW + 'cm" svg:height="' + cmH + 'cm">' +
            '<draw:image xlink:href="' + name + '" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>');
          return;
        }
        if (b.t === 'img') { out.push('<text:p text:style-name="Standard">[image]</text:p>'); return; }
        if (b.t === 'table') {
          var cols = Math.max.apply(null, b.rows.map(function (r) { return r.length; }));
          var x = '<table:table table:name="Table' + (out.length) + '"><table:table-column table:number-columns-repeated="' + cols + '"/>';
          b.rows.forEach(function (r, ri) {
            x += '<table:table-row>';
            for (var c = 0; c < cols; c++) {
              var cell = esc(r[c] === undefined ? '' : r[c]);
              if (b.header && ri === 0) cell = '<text:span text:style-name="B">' + cell + '</text:span>';
              x += '<table:table-cell office:value-type="string"><text:p text:style-name="Standard">' + cell + '</text:p></table:table-cell>';
            }
            x += '</table:table-row>';
          });
          out.push(x + '</table:table>');
          return;
        }
        if (b.t === 'hr') out.push('<text:p text:style-name="Standard">________________________________</text:p>');
        else if (b.t === 'h') out.push('<text:h text:outline-level="' + Math.min(6, b.level || 1) + '">' + inline() + '</text:h>');
        else if (b.t === 'code') out.push('<text:p text:style-name="Preformatted">' + esc(flat(b)).replace(/\n/g, '</text:p><text:p text:style-name="Preformatted">') + '</text:p>');
        else out.push('<text:p text:style-name="Standard">' + inline() + '</text:p>');
      });
      if (open) out.push('</text:list>');
      zip.folder('META-INF').file('manifest.xml',
        '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
        '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>' +
        '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
        '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
        pics.map(function (p) { return '<manifest:file-entry manifest:full-path="' + p.name + '" manifest:media-type="' + p.mime + '"/>'; }).join('') +
        '</manifest:manifest>');
      pics.forEach(function (p) { zip.file(p.name, p.bytes); });
      zip.file('styles.xml', '<?xml version="1.0" encoding="UTF-8"?><office:document-styles ' + NS + ' office:version="1.2"><office:styles/></office:document-styles>');
      zip.file('content.xml',
        '<?xml version="1.0" encoding="UTF-8"?><office:document-content ' + NS + ' office:version="1.2"><office:automatic-styles>' +
        '<style:style style:name="B" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>' +
        '<style:style style:name="I" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>' +
        '</office:automatic-styles><office:body><office:text>' + out.join('') + '</office:text></office:body></office:document-content>');
      return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text', compression: 'DEFLATE' });
    });
  }

  function toEpub(doc, meta) {
    meta = meta || {};
    var title = doc.title || meta.title || 'Untitled';
    var uid = 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    return need('jszip').then(function (JSZip) {
      var zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
      zip.folder('META-INF').file('container.xml',
        '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
        '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
      var o = zip.folder('OEBPS');
      o.file('text.xhtml',
        '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><head><meta charset="utf-8"/><title>' +
        esc(title) + '</title><link rel="stylesheet" href="style.css"/></head><body>' + bodyHTML(doc, true) + '</body></html>');
      o.file('style.css', 'body{font-family:serif;line-height:1.6;margin:1em}h1,h2,h3{line-height:1.25}pre{white-space:pre-wrap;font-family:monospace}blockquote{margin-left:1em;padding-left:.8em;border-left:2px solid #ccc}img{max-width:100%}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.3em .6em}');
      o.file('nav.xhtml',
        '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head>' +
        '<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="text.xhtml">' + esc(title) + '</a></li></ol></nav></body></html>');
      o.file('content.opf',
        '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid">' +
        '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bid">' + uid + '</dc:identifier>' +
        '<dc:title>' + esc(title) + '</dc:title><dc:language>en</dc:language>' +
        '<meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</meta></metadata>' +
        '<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' +
        '<item id="t" href="text.xhtml" media-type="application/xhtml+xml"/>' +
        '<item id="css" href="style.css" media-type="text/css"/></manifest>' +
        '<spine><itemref idref="t"/></spine></package>');
      return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
    });
  }

  function toPdf(doc, opts) {
    opts = opts || {};
    return need('jspdf').then(function (ns) {
      var JsPDF = ns.jsPDF || ns.default || ns;
      var pdf = new JsPDF({ unit: 'pt', format: opts.pageSize || 'a4', compress: true });
      var M = 56, W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
      var maxW = W - M * 2, y = M, counters = {};
      var HSIZE = [22, 18, 15.5, 13.5, 12.5, 12];

      function ensure(h) { if (y + h > H - M) { pdf.addPage(); y = M; } }

      function layout(runs, size, indent, baseStyle, leading) {
        var x0 = M + indent, lineH = size * (leading || 1.42), x = x0;
        ensure(lineH);
        runs.forEach(function (r) {
          var bold = r.b || baseStyle === 'bold', ital = r.i;
          var style = bold && ital ? 'bolditalic' : bold ? 'bold' : ital ? 'italic' : 'normal';
          var font = r.code ? 'courier' : 'helvetica';
          String(r.text).split('\n').forEach(function (chunk, ci) {
            if (ci) { y += lineH; x = x0; ensure(lineH); }
            chunk.split(/(\s+)/).forEach(function (word) {
              if (!word) return;
              pdf.setFont(font, style); pdf.setFontSize(size);
              var ww = pdf.getTextWidth(word);
              if (x + ww > M + maxW && /\S/.test(word)) { y += lineH; x = x0; ensure(lineH); }
              if (!/\S/.test(word) && x === x0) return;
              pdf.text(word, x, y + size * 0.85);
              x += ww;
            });
          });
        });
        y += lineH;
      }
      function image(b) {
        var dims = fit(b.w * 0.75, b.h * 0.75, maxW, H - M * 2);       // px -> pt at 96 dpi
        ensure(dims[1] + 8);
        pdf.addImage(b.dataUrl, b.ext === 'jpeg' ? 'JPEG' : 'PNG', M, y, dims[0], dims[1]);
        y += dims[1] + 12;
      }
      function table(b) {
        var cols = Math.max.apply(null, b.rows.map(function (r) { return r.length; })), cw = maxW / cols, fs = 9, lh = 11, pad = 4;
        pdf.setFontSize(fs);
        b.rows.forEach(function (r, ri) {
          var hdr = b.header && ri === 0;
          pdf.setFont('helvetica', hdr ? 'bold' : 'normal');
          var cells = [], lines = 1;
          for (var c = 0; c < cols; c++) {
            var txt = pdf.splitTextToSize(String(r[c] === undefined ? '' : r[c]), cw - pad * 2);
            cells.push(txt); lines = Math.max(lines, txt.length);
          }
          var rh = lines * lh + pad * 2;
          ensure(rh);
          if (hdr) { pdf.setFillColor(242, 242, 242); pdf.rect(M, y, maxW, rh, 'F'); }
          pdf.setDrawColor(200);
          for (var k = 0; k < cols; k++) {
            pdf.rect(M + k * cw, y, cw, rh);
            pdf.text(cells[k], M + k * cw + pad, y + pad + fs * 0.85);
          }
          y += rh;
        });
        y += 10;
      }

      doc.blocks.forEach(function (b) {
        if (b.t === 'hr') { ensure(20); pdf.setDrawColor(190); pdf.line(M, y + 6, W - M, y + 6); y += 20; counters = {}; return; }
        if (b.t === 'img') { if (b.dataUrl) image(b); return; }
        if (b.t === 'table') { table(b); return; }
        if (b.t === 'h') {
          var lvl = Math.min(6, b.level || 1), sz = HSIZE[lvl - 1];
          y += lvl <= 2 ? 14 : 9; ensure(sz * 1.6);
          layout(b.runs, sz, 0, 'bold', 1.3); y += 3; return;
        }
        if (b.t === 'code') {
          pdf.setFont('courier', 'normal'); pdf.setFontSize(9);
          flat(b).split('\n').forEach(function (l) {
            pdf.splitTextToSize(l || ' ', maxW - 12).forEach(function (piece) {
              ensure(13); pdf.text(piece, M + 8, y + 9); y += 13;
            });
          });
          y += 8; return;
        }
        if (b.t === 'quote') {
          layout(b.runs.map(function (r) { return Object.assign({}, r, { i: true }); }), 10.5, 22, null, 1.45);
          y += 4; return;
        }
        if (b.t === 'li') {
          var d = b.level || 1, ind = 16 * d;
          var marker = b.ordered ? ((counters[d] = (counters[d] || 0) + 1) + '.') : BULLET;
          ensure(16);
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5);
          pdf.text(marker, M + ind - 12, y + 9);
          layout(b.runs, 10.5, ind, null, 1.4); y += 1; return;
        }
        layout(b.runs, 10.5, 0, null, 1.5); y += 5;
      });
      return pdf.output('blob');
    });
  }

  function toTex(doc) {
    function tex(s) {
      return String(s).replace(/\\/g, '\\textbackslash{}').replace(/([{}&%$#_])/g, '\\$1')
        .replace(/\^/g, '\\textasciicircum{}').replace(/~/g, '\\textasciitilde{}');
    }
    function runs(rs) {
      return (rs || []).map(function (r) {
        var t = r.code ? '\\texttt{' + tex(r.text) + '}' : tex(r.text).replace(/\n/g, '\\\\ ');
        if (r.b) t = '\\textbf{' + t + '}';
        if (r.i) t = '\\textit{' + t + '}';
        if (r.href) t = '\\href{' + r.href.replace(/[%#]/g, '\\$&') + '}{' + t + '}';
        return t;
      }).join('');
    }
    var out = ['\\documentclass[11pt]{article}', '\\usepackage[utf8]{inputenc}', '\\usepackage[T1]{fontenc}', '\\usepackage{hyperref}', '\\usepackage{graphicx}', '\\usepackage{booktabs}', ''];
    if (doc.title) out.push('\\title{' + tex(doc.title) + '}', '\\date{}', '');
    out.push('\\begin{document}');
    if (doc.title) out.push('\\maketitle', '');
    var list = null, listDepth = 0;
    function closeLists(to) { while (listDepth > to) { out.push('\\end{' + list + '}'); listDepth--; } if (!listDepth) list = null; }
    var SECT = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph'];
    doc.blocks.forEach(function (b) {
      if (b.t !== 'li') closeLists(0);
      if (b.t === 'li') {
        var want = b.ordered ? 'enumerate' : 'itemize', d = b.level || 1;
        if (list && list !== want && listDepth === d) { closeLists(d - 1); }
        while (listDepth < d) { out.push('\\begin{' + want + '}'); listDepth++; list = want; }
        closeLists(d);
        out.push('  \\item ' + runs(b.runs)); return;
      }
      if (b.t === 'h') { out.push('', '\\' + SECT[Math.min(6, b.level || 1) - 1] + '{' + runs(b.runs) + '}', ''); return; }
      if (b.t === 'hr') { out.push('', '\\noindent\\rule{\\textwidth}{0.4pt}', ''); return; }
      if (b.t === 'code') { out.push('\\begin{verbatim}', flat(b), '\\end{verbatim}', ''); return; }
      if (b.t === 'quote') { out.push('\\begin{quote}', runs(b.runs), '\\end{quote}', ''); return; }
      if (b.t === 'img') { out.push('% image' + (b.alt ? ': ' + b.alt : '') + ' — export the picture separately and \\includegraphics{} it here', ''); return; }
      if (b.t === 'table') {
        var cols = Math.max.apply(null, b.rows.map(function (r) { return r.length; }));
        out.push('\\begin{center}', '\\begin{tabular}{' + 'l'.repeat(cols) + '}', '\\toprule');
        b.rows.forEach(function (r, ri) {
          var cells = []; for (var c = 0; c < cols; c++) cells.push(tex(r[c] === undefined ? '' : r[c]));
          if (b.header && ri === 0) { out.push(cells.map(function (x) { return '\\textbf{' + x + '}'; }).join(' & ') + ' \\\\', '\\midrule'); }
          else out.push(cells.join(' & ') + ' \\\\');
        });
        out.push('\\bottomrule', '\\end{tabular}', '\\end{center}', ''); return;
      }
      out.push(runs(b.runs), '');
    });
    closeLists(0);
    out.push('\\end{document}', '');
    return new Blob([out.join('\n')], { type: 'application/x-tex' });
  }

  root.DocModel = {
    esc: esc, flat: flat, bodyHTML: bodyHTML, imgBlock: imgBlock, tableBlock: tableBlock, prepareImages: prepareImages,
    fromHTML: fromHTML, fromText: fromText, fromMarkdown: fromMarkdown, fromDocx: fromDocx,
    fromOdt: fromOdt, fromRtf: fromRtf, fromPdf: fromPdf, fromEpub: fromEpub,
    toText: toText, toMarkdown: toMarkdown, toHTML: toHTML, toRtf: toRtf,
    toDocx: toDocx, toOdt: toOdt, toEpub: toEpub, toPdf: toPdf, toTex: toTex
  };
})(window);
