# -*- coding: utf-8 -*-
"""What people actually type into Google for each conversion.

    python3 seo/keywords.py          # refresh content/suggest.json (needs network)

Google's autocomplete is public and reflects real query volume. For every
landing page we fetch the suggestions for "<from> to <to>" and "convert <from>
to <to>", store them, and the build reads the stored file — so CI never needs
the network and a page's FAQ only changes when the data does.

The build uses two things from here:
  * modifiers(f, t): which intents show up for that pair — "free", "online",
    "windows", "high quality", "download", "bulk", "ocr", "python"… — so the
    FAQ can answer the questions people are really asking, in their words.
  * search_name(ext): what people call a format when they search. Nobody
    types "docx to pdf"; they type "word to pdf".
"""
import json
import os
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
STORE = ROOT / 'content' / 'suggest.json'

# The word people use in a query, where it differs from the extension.
SEARCH_NAME = {
    'docx': 'Word', 'xlsx': 'Excel', 'md': 'Markdown',
}

# Query modifiers we act on, and the substrings that reveal them.
MODIFIERS = {
    'free':      ('free',),
    'online':    ('online',),
    'download':  ('download', 'software', 'app'),
    'windows':   ('windows', 'pc'),
    'mac':       ('mac', 'macos'),
    'iphone':    ('iphone', 'ios', 'ipad'),
    'android':   ('android',),
    'linux':     ('linux', 'ubuntu'),
    'quality':   ('quality', 'lossless', 'high resolution', 'hd'),
    'bulk':      ('bulk', 'batch', 'multiple', 'all at once'),
    'ocr':       ('ocr', 'scanned', 'scan'),
    'code':      ('python', 'command line', 'terminal', 'cli', 'ffmpeg', 'imagemagick', 'blender', 'github', 'script', 'npm', 'javascript'),
    'size':      ('compress', 'reduce size', 'smaller', 'size'),
    'editable':  ('editable', 'edit'),
    'transparent': ('transparent', 'transparency', 'background'),
}


def search_name(ext):
    return SEARCH_NAME.get(ext, ext.upper())


def _load():
    try:
        return json.loads(STORE.read_text())
    except FileNotFoundError:
        return {}


_DATA = None


def suggestions(f, t):
    """The stored autocomplete phrases for a pair (lowercase), or []."""
    global _DATA
    if _DATA is None:
        _DATA = _load()
    return _DATA.get('%s>%s' % (f, t), [])


def modifiers(f, t):
    """Set of modifier keys that appear in the real queries for this pair."""
    found = set()
    for phrase in suggestions(f, t):
        for key, needles in MODIFIERS.items():
            for n in needles:
                if re.search(r'\b%s\b' % re.escape(n), phrase):
                    found.add(key)
    return found


# ------------------------------------------------------------------ fetching
def _fetch(q):
    u = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=' + urllib.parse.quote(q)
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return [s.lower() for s in json.loads(r.read().decode('utf-8', 'replace'))[1]]


def refresh():
    pairs = sorted(d.split('-to-') for d in os.listdir(ROOT) if re.match(r'^[a-z0-9]+-to-[a-z0-9]+$', d))
    data = _load()
    done = 0
    for f, t in pairs:
        key = '%s>%s' % (f, t)
        a, b = search_name(f).lower(), search_name(t).lower()
        phrases = []
        for q in ('%s to %s' % (a, b), 'convert %s to %s' % (a, b)):
            try:
                phrases += _fetch(q)
            except Exception as e:  # one failed query should not sink the run
                print('  ! %s: %s' % (q, e), file=sys.stderr)
            time.sleep(0.12)
        seen, uniq = set(), []
        for p in phrases:
            if p not in seen:
                seen.add(p)
                uniq.append(p)
        data[key] = uniq
        done += 1
        if done % 50 == 0:
            print('  %d / %d' % (done, len(pairs)))
            STORE.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    STORE.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print('stored suggestions for %d pairs in %s' % (len(data), STORE.relative_to(ROOT)))


if __name__ == '__main__':
    refresh()
