#!/bin/zsh
# Headless test run for the pure encoders/parsers. Uses macOS JavaScriptCore
# via osascript, so it needs no node/npm.
set -e
here=${0:a:h}
root=${here:h}
out=$(mktemp -t convertfiles).js
cat "$here/shims.js" \
    "$root/js/formats.js" \
    "$root/js/encoders.js" \
    "$root/js/imaging.js" \
    "$root/js/docmodel.js" \
    "$root/js/convert.js" \
    "$here/tests.js" > "$out"
osascript -l JavaScript "$out"
rm -f "$out"
