#!/usr/bin/env python3
"""Tell the IndexNow search engines about every URL in the sitemap.

    python3 seo/indexnow.py            # submit everything in sitemap.xml
    python3 seo/indexnow.py /png-to-jpg/ /guides/   # or just these paths

IndexNow is shared by Bing, Yandex, Seznam, Naver and, through Bing, by
DuckDuckGo and Yahoo. One POST reaches all of them. Google does not take part;
it has to be told through Search Console instead.

The key in site.json must be reachable at https://<domain>/<key>.txt, which
build.py takes care of. Run this after a deploy, not before.
"""
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / 'site.json').read_text())
DOMAIN = SITE['domain'].rstrip('/')
HOST = DOMAIN.split('//', 1)[1]
KEY = SITE.get('indexnow_key', '').strip()

if not KEY:
    sys.exit('site.json has no indexnow_key')

# the engines refuse a submission whose key file is not live, so check first
try:
    with urllib.request.urlopen('%s/%s.txt' % (DOMAIN, KEY), timeout=20) as r:
        if r.read().decode().strip() != KEY:
            sys.exit('key file is live but holds the wrong key')
except Exception as e:
    sys.exit('key file is not live yet at %s/%s.txt (%s) — deploy first' % (DOMAIN, KEY, e))

if len(sys.argv) > 1:
    urls = [DOMAIN + p if p.startswith('/') else p for p in sys.argv[1:]]
else:
    sitemap = (ROOT / 'sitemap.xml').read_text()
    urls = re.findall(r'<loc>([^<]+)</loc>', sitemap)

# 10,000 per request is the protocol limit; ours is far under it
body = json.dumps({'host': HOST, 'key': KEY, 'keyLocation': '%s/%s.txt' % (DOMAIN, KEY), 'urlList': urls}).encode()
req = urllib.request.Request('https://api.indexnow.org/indexnow', data=body,
                             headers={'Content-Type': 'application/json; charset=utf-8'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print('submitted %d urls — HTTP %d %s' % (len(urls), r.status, r.reason))
except urllib.error.HTTPError as e:
    print('HTTP %d %s: %s' % (e.code, e.reason, e.read().decode()[:300]))
    sys.exit(1)
