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


# Yogesh's standing rule (14 Nov 2026): no other company's name anywhere on
# the site. Autocomplete happily suggests competitor brands ("… ilovepdf",
# "… cloudconvert"); those phrases are never stored and never read back, so
# a refresh cannot bring them in. Only the joined FreeConvert token is
# blocked — "free convert png to tga" is plain English, not the brand.
BRAND_BLOCKLIST = tuple(re.compile(p, re.I) for p in (
    r'ilove\s?pdf', r'small\s?pdf', r'\bsejda\b', r'\bpdf24\b',
    r'cloud\s?convert', r'\bzamzar\b', r'\bconvertio\b', r'soda\s?pdf',
    r'\bpdf2go\b', r'\bhipdf\b', r'ease\s?pdf', r'online\s?convert\s?free',
    r'freeconvert', r'pdf\s?candy', r'\badobe\b', r'\bacrobat\b',
    r'\bcanva\b', r'\bcamscanner\b', r'\bezgif\b',
))


def blocked(phrase):
    """True when a phrase names a competitor brand and must be dropped."""
    return any(rx.search(phrase) for rx in BRAND_BLOCKLIST)


def _load():
    try:
        data = json.loads(STORE.read_text())
    except FileNotFoundError:
        return {}
    # Sanitise on read as well, so a store written before the rule (or by
    # hand) can never feed a brand phrase into the build.
    return {k: [p for p in phrases if not blocked(p)] for k, phrases in data.items()}


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
            if p not in seen and not blocked(p):
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
