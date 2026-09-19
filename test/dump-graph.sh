#!/bin/zsh
# Regenerate content/pairs.json from the real conversion rules.
set -e
here=${0:a:h}
root=${here:h}
out=$(mktemp -t cfgraph).js
cat "$here/shims.js" "$here/dump-graph.js" \
    "$root/js/formats.js" "$root/js/encoders.js" "$root/js/docmodel.js" "$root/js/convert.js" > "$out"
cat >> "$out" <<'TAIL'
(function () {
  var g = {}, n = 0;
  Convert.sourcesList().forEach(function (f) {
    var t = Convert.targetsFor(f).filter(function (x) { return x !== '*'; });
    if (t.length) { g[f] = t; n += t.length; }
  });
  var ext = {};
  Object.keys(Formats.EXT).forEach(function (e) { ext[e] = Formats.EXT[e]; });
  return JSON.stringify({ pairs: n, graph: g, ext: ext }, null, 1);
})();
TAIL
osascript -l JavaScript "$out" > "$root/content/pairs.json"
rm -f "$out"
python3 -c "
import json; d = json.load(open('$root/content/pairs.json'))
print('content/pairs.json:', d['pairs'], 'pairs,', len(d['graph']), 'sources,', len(d['ext']), 'formats')
"
