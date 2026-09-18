#!/usr/bin/env python3
"""Build the production site in place.

    python3 build.py

Reads site.json and:
  - stamps the AdSense / analytics tags and window.SITE into index.html (site:head block)
  - versions the CSS/JS URLs with a content hash
  - writes privacy.html, terms.html, contact.html, 404.html from pages/
  - writes one static page per popular conversion (/heic-to-jpg/) and per guide (/guides/<slug>/)
  - writes sitemap.xml, robots.txt, ads.txt and CNAME
Everything is idempotent: run it again after any edit, then commit.
"""
import datetime, hashlib, json, os, re, subprocess, sys, html

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
SITE = json.load(open('site.json'))
DOMAIN = SITE['domain'].rstrip('/')
HOST = re.sub(r'^https?://', '', DOMAIN)
TODAY = datetime.date.today().strftime('%d %B %Y')
GENERATED = []                                           # (path, lastmod) for the sitemap


def esc(s):
    return html.escape(str(s), quote=True)


# ---------------------------------------------------------------- content dump
def load_content():
    """Evaluate content.js + formats.js with the system JavaScript engine and return them as JSON."""
    src = 'var window = this;\n' + open('js/formats.js').read() + '\n' + open('js/content.js').read() + \
          '\nJSON.stringify({ Content: window.Content, EXT: window.Formats.EXT });'
    tmp = '/tmp/cf-content-dump.js'
    open(tmp, 'w').write(src)
    out = subprocess.run(['osascript', '-l', 'JavaScript', tmp], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit('could not evaluate content.js: ' + out.stderr)
    return json.loads(out.stdout)


DATA = load_content()
CONTENT, EXT = DATA['Content'], DATA['EXT']


def fmt_name(ext):
    return EXT.get(ext, [None, ext.upper()])[1]


def family(ext):
    return EXT.get(ext, ['any'])[0]


# ------------------------------------------------------------- asset version
def asset_version():
    h = hashlib.sha1()
    for f in sorted(os.listdir('js')) + ['app.css']:
        p = os.path.join('js', f) if f.endswith('.js') else os.path.join('css', f)
        h.update(open(p, 'rb').read())
    return h.hexdigest()[:8]


VER = asset_version()


# ------------------------------------------------------------------ site head
def site_head():
    ads = SITE.get('adsense_client', '').strip()
    ga = SITE.get('ga4_measurement_id', '').strip()
    cfg = {'domain': DOMAIN, 'contact': SITE.get('contact_email', ''),
           'ads': {'client': ads, 'slots': SITE.get('adsense_slots', {})} if ads else None}
    lines = ['<script>window.SITE = ' + json.dumps(cfg) + ';</script>']
    if ads:
        lines.append('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=%s" crossorigin="anonymous"></script>' % ads)
    if ga:
        lines.append('<script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>' % ga)
        lines.append("<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','%s',{anonymize_ip:true});</script>" % ga)
    return '\n'.join(lines)


def replace_block(text, name, inner):
    start, end = '<!-- %s -->' % name, '<!-- /%s -->' % name
    a, b = text.index(start), text.index(end)
    return text[:a + len(start)] + '\n' + inner + '\n' + text[b:]


def page_meta(title, description, path, kind='website', extra_meta='', jsonld=None):
    url = DOMAIN + '/' + path
    m = ['<title>%s</title>' % esc(title),
         '<meta name="description" content="%s">' % esc(description),
         '<link rel="canonical" href="%s">' % esc(url),
         '<meta property="og:title" content="%s">' % esc(title),
         '<meta property="og:description" content="%s">' % esc(description),
         '<meta property="og:url" content="%s">' % esc(url),
         '<meta property="og:image" content="%s/assets/og.png">' % DOMAIN,
         '<meta property="og:type" content="%s">' % kind,
         '<meta property="og:site_name" content="Convert Files">',
         '<meta name="twitter:card" content="summary_large_image">']
    if extra_meta:
        m.append(extra_meta)
    if jsonld:
        m.append('<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + '</script>')
    return '\n'.join(m)


def write(path, text):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    open(path, 'w').write(text)
    GENERATED.append(path)


# ------------------------------------------------------------ index.html base
index = open('index.html').read()
index = re.sub(r'\?v=[0-9a-f]+', '?v=' + VER, index)
index = replace_block(index, 'site:head', site_head())
home_jsonld = {
    '@context': 'https://schema.org', '@type': 'WebApplication', 'name': 'Convert Files', 'url': DOMAIN + '/',
    'applicationCategory': 'UtilitiesApplication', 'operatingSystem': 'Any', 'browserRequirements': 'Requires a modern browser',
    'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'INR'},
    'description': 'Free file converter that runs entirely in your browser. Images, PDF, Word, Excel, audio, video, fonts and 3D models. Nothing is uploaded.'
}
index = replace_block(index, 'page:meta', page_meta(
    'Convert Files — free online file converter, nothing uploaded',
    'Convert your files in seconds — free, no account, nothing uploaded. Images, PDF, Word, Excel, audio, video, fonts and 3D models, converted inside your browser.',
    '', jsonld=home_jsonld))
index = replace_block(index, 'page:body', '')
open('index.html', 'w').write(index)
GENERATED.append('index.html')
BASE = index


# ---------------------------------------------------------- landing pages
BLURB = {
    'pdf': 'PDF fixes a document to the page exactly as it was laid out, which is why it is the format for sharing and printing. It is also why it is hard to edit: the text is placed, not flowed.',
    'docx': 'DOCX is Microsoft Word’s format. It describes a document by its structure — paragraphs, headings, lists, tables and pictures — and lets Word lay it out, which makes it the right format for anything that will still be edited.',
    'jpg': 'JPG (JPEG) is the universal photo format: small files, opened by every device made in the last twenty-five years. It is lossy, so it is best for photographs rather than screenshots, logos or text.',
    'jpeg': 'JPEG is the universal photo format: small files, opened by every device. It is lossy, so it suits photographs rather than screenshots, logos or text.',
    'png': 'PNG is lossless and supports transparency. It is the format for screenshots, logos, diagrams and anything with sharp edges or a cut-out background; photos come out larger than JPG.',
    'heic': 'HEIC is the format iPhones have used for photos since iOS 11. It stores a photo in about half the space of a JPG, but Windows, Android and most browsers cannot open it without help.',
    'webp': 'WebP is Google’s web image format: around 30% smaller than JPG at the same quality, with transparency. Every browser shows it; many desktop programs still cannot open it.',
    'mov': 'MOV is Apple’s QuickTime container, used by iPhones and Macs for recorded video. It often holds HEVC video, which many Windows and Android devices refuse to play.',
    'mp4': 'MP4 with H.264 video and AAC audio is the one video format that plays everywhere: phones, TVs, browsers, messaging apps and editing software.',
    'mp3': 'MP3 is the audio format everything understands. It is lossy but at 192 kbps or above the difference from the original is inaudible to most listeners.',
    'gif': 'GIF is a short, silent, looping animation with at most 256 colours. It plays inline everywhere, which keeps it popular for reactions and quick demos despite its large files.',
    'webm': 'WebM (VP9 video, Opus audio) is the open web video format. It is usually smaller than MP4 at the same quality and plays in every modern browser.',
    'wav': 'WAV is uncompressed audio: exactly the recorded samples, with no quality loss and large files. It is the format for editing and archiving, not for sharing.',
    'm4a': 'M4A is AAC audio in an MP4 container — the format of iTunes and Apple Music purchases and of voice memos. It sounds better than MP3 at the same bitrate but is less universally supported.',
    'ogg': 'OGG (Opus) is an open audio format with excellent quality at low bitrates. It is common in games, voice chat and open-source software, and plays in all modern browsers.',
    'csv': 'CSV is a plain-text table: one row per line, values separated by commas. Every spreadsheet, database and programming language can read and write it.',
    'xlsx': 'XLSX is Microsoft Excel’s workbook format: multiple sheets, formatting, formulas and real dates. It is what most people mean by “a spreadsheet”.',
    'json': 'JSON is the data format of the web: nested objects and lists in plain text, read and written by every programming language and API.',
    'md': 'Markdown is plain text with light formatting marks — # for headings, ** for bold. It is the format of READMEs, notes apps and documentation.',
    'html': 'HTML is the language of web pages. As a document format it is readable by any browser and carries headings, links, tables and images.',
    'epub': 'EPUB is the open ebook format used by every reader except the Kindle. It reflows text to fit the screen, unlike a PDF.',
    'txt': 'Plain text is the simplest format there is: just the words, with no formatting. It opens everywhere and never goes out of date.',
    'svg': 'SVG is a vector format: shapes described mathematically, so a logo or icon stays sharp at any size. Browsers, design tools and many apps open it.',
    'ico': 'ICO is the Windows icon format, used for favicons and application icons. It can hold several sizes of the same image in one file.',
    'tiff': 'TIFF is a lossless image format used by scanners, print workflows and archives. Files are large and not every app or browser opens them.',
    'obj': 'OBJ is a plain-text 3D mesh format from the 1990s that almost every 3D program can read and write. It carries geometry and, through a companion .mtl file, materials.',
    'stl': 'STL describes a 3D surface as triangles and nothing else — no colour, no texture. It is the standard format for 3D printing.',
    'glb': 'GLB is the binary form of glTF, the 3D format used by web viewers, Android’s AR Scene Viewer and modern game engines. One file holds the whole scene.',
    'ttf': 'TTF is the TrueType font format used by Windows, macOS and most applications for installed fonts.',
    'woff': 'WOFF is the web font format: the same font tables as TTF or OTF, compressed for downloading with a web page.',
}
LOSSY = {'jpg', 'jpeg', 'webp', 'avif', 'jxl', 'heic', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'mp4', 'webm', 'gif'}


def expect(f, t):
    ff, ft = family(f), family(t)
    if ff == 'image' and ft == 'image':
        if t in LOSSY:
            return 'The image is re-encoded, so keep the quality setting at 85% or higher; at that level the difference is invisible. Transparency is flattened to white for JPG.'
        return 'The target is lossless, so every pixel of the decoded image is kept. The file may be larger than the source.'
    if ff == 'image' and ft == 'pdf':
        return 'The picture is placed on a page sized to fit it. Several images can be combined by converting each and merging in any PDF tool.'
    if ff == 'video' and ft == 'video':
        return 'Every frame is decoded and re-encoded inside your browser, so a long clip takes a while and the tab must stay open. Set a width of 1280 for a much smaller file that still looks sharp on a phone.'
    if ff == 'video' and ft == 'audio':
        return 'The video track is dropped and only the sound is kept, encoded at the bitrate you choose.'
    if ff == 'video' and ft == 'image':
        return 'Pick the point in the clip to sample; for GIF also the length and frames per second. GIFs are limited to 256 colours, so dithering is on by default.'
    if ff == 'audio':
        return 'The audio is decoded and re-encoded with the codec of the target format. Choose 192 kbps or more for music.'
    if ff == 'doc' or ft == 'doc':
        return 'Headings, paragraphs, bold and italic text, lists, tables and embedded pictures are carried across. Exact page layout, fonts and columns are not; a scanned PDF has no text to extract.'
    if ff == 'table' or ft == 'table':
        return 'Cell values are carried across exactly as text. Formulas become their results, and only the first sheet is used for single-table formats like CSV.'
    if ff == 'model3d':
        return 'Geometry is converted exactly, with node transforms applied. Materials, textures and animations are not carried; check the scale in your viewer, since STL files are unitless.'
    if ff == 'font':
        return 'The font tables are unchanged; only the container differs. The result renders identically.'
    return 'The conversion runs in your browser and the file never leaves your device.'


POPULAR = CONTENT['POPULAR']
for f, t, label in POPULAR:
    path = '%s-to-%s/' % (f, t)
    title = 'Convert %s to %s online — free, in your browser' % (f.upper(), t.upper())
    desc = '%s to %s in seconds. Free, no account, nothing uploaded: the file is converted inside your browser and never leaves your device.' % (f.upper(), t.upper())
    related = [(a, b, l) for a, b, l in POPULAR if (a == f or b == t or a == t or b == f) and not (a == f and b == t)][:8]
    faq = [
        ('Is %s to %s conversion free?' % (f.upper(), t.upper()), 'Yes. Convert Files is free, with no account, no limits and no watermark.'),
        ('Is my %s file uploaded?' % f.upper(), 'No. The conversion runs inside your browser. The file is read from your device, converted in memory and saved back to your device. Nothing is sent to a server.'),
        ('What happens to the quality?', expect(f, t)),
    ]
    body = ['<section class="seo" id="about-pair">',
            '<h2>How to convert %s to %s</h2>' % (f.upper(), t.upper()),
            '<ol><li>Drop your <code>.%s</code> file above, or click the box to browse for it.</li>' % f,
            '<li>The target is already set to <code>.%s</code>. Change any option you like.</li>' % t,
            '<li>Press <strong>Convert</strong>, then <strong>Download</strong>. The file stays on your device the whole time.</li></ol>']
    if f in BLURB:
        body.append('<h2>About %s</h2><p>%s</p>' % (fmt_name(f), esc(BLURB[f])))
    if t in BLURB:
        body.append('<h2>About %s</h2><p>%s</p>' % (fmt_name(t), esc(BLURB[t])))
    body.append('<h2>What to expect</h2><p>%s</p>' % esc(expect(f, t)))
    body.append('<h2>Questions</h2>')
    for q, a in faq:
        body.append('<p><strong>%s</strong><br>%s</p>' % (esc(q), esc(a)))
    if related:
        body.append('<h2>Related conversions</h2><div class="rel">' + ''.join(
            '<a href="/%s-to-%s/">%s</a>' % (a, b, esc(l)) for a, b, l in related) + '</div>')
    body.append('</section>')
    jsonld = {'@context': 'https://schema.org', '@type': 'FAQPage',
              'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}
    page = replace_block(BASE, 'page:meta', page_meta(title, desc, path, extra_meta='<meta name="cf-preset" content="%s>%s">' % (f, t), jsonld=jsonld))
    page = replace_block(page, 'page:body', '\n'.join(body))
    page = page.replace('<h1>Convert any file, right here.</h1>', '<h1>Convert %s to %s</h1>' % (f.upper(), t.upper()))
    page = page.replace('<p>Pick a file, choose what it should become, download the result. Everything runs inside your browser &mdash; nothing is uploaded.</p>',
                        '<p>%s. Free, in your browser, in seconds &mdash; nothing is uploaded.</p>' % esc(label))
    write(path + 'index.html', page)


# ------------------------------------------------------------- guide pages
def render_body(lines):
    out = []
    for line in lines:
        kind, text = line[:1], line[2:]
        if line.startswith('ul:'):
            out.append('<ul>' + ''.join('<li>%s</li>' % t for t in line[3:].split('|')) + '</ul>')
        elif kind == 'h':
            out.append('<h3>%s</h3>' % text)
        else:
            out.append('<p>%s</p>' % text)
    return '\n'.join(out)


for gd in CONTENT['GUIDES']:
    path = 'guides/%s/' % gd['slug']
    words = len(re.sub(r'<[^>]+>', '', ' '.join(gd['body'])).split())
    article = ['<div class="cat">%s</div>' % esc(gd['cat']), '<h1>%s</h1>' % esc(gd['title']),
               '<div class="meta">%d min read · Convert Files guides</div>' % max(2, round(words / 200)),
               '<div class="body">' + render_body(gd['body']) + '</div>']
    if gd.get('tryFrom'):
        article.append('<div class="try"><span class="t">Try it: convert a .%s to .%s — free, in your browser.</span><a class="btn primary" href="/%s-to-%s/">Convert .%s to .%s</a></div>'
                       % (gd['tryFrom'], gd['tryTo'], gd['tryFrom'], gd['tryTo'], gd['tryFrom'], gd['tryTo']))
    jsonld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': gd['title'], 'description': gd['teaser'],
              'author': {'@type': 'Organization', 'name': 'Convert Files'}, 'publisher': {'@type': 'Organization', 'name': 'Convert Files'},
              'mainEntityOfPage': DOMAIN + '/' + path, 'image': DOMAIN + '/assets/og.png'}
    page = replace_block(BASE, 'page:meta', page_meta(gd['title'] + ' · Convert Files', gd['teaser'], path, kind='article',
                                                       extra_meta='<meta name="cf-guide" content="%s">' % gd['slug'], jsonld=jsonld))
    page = replace_block(page, 'page:body', '')
    # pre-render the article for crawlers; the app takes over on load
    page = page.replace('<section class="view" id="view-convert" role="tabpanel">', '<section class="view" id="view-convert" role="tabpanel" hidden>')
    page = page.replace('<section class="view" id="view-guides" role="tabpanel" hidden>', '<section class="view" id="view-guides" role="tabpanel">')
    page = page.replace('<div id="guides-list">', '<div id="guides-list" hidden>')
    page = page.replace('<article class="article" id="article" hidden></article>', '<article class="article" id="article">' + '\n'.join(article) + '</article>')
    page = page.replace('id="nav-convert" role="tab" aria-selected="true"', 'id="nav-convert" role="tab" aria-selected="false"')
    page = page.replace('id="nav-guides" role="tab" aria-selected="false"', 'id="nav-guides" role="tab" aria-selected="true"')
    write(path + 'index.html', page)


# -------------------------------------------------------------- legal pages
shell = open('pages/_shell.html').read()
for name in ['privacy', 'terms', 'contact']:
    raw = open('pages/%s.html' % name).read()
    title = re.search(r'<!-- title: (.*?) -->', raw).group(1)
    desc = re.search(r'<!-- description: (.*?) -->', raw).group(1)
    content = re.sub(r'<!-- (title|description): .*? -->\n', '', raw)
    ga = SITE.get('ga4_measurement_id', '').strip()
    content = re.sub(r'\{\{#ga\}\}(.*?)\{\{/ga\}\}', (r'\1' if ga else ''), content, flags=re.S)
    page = shell
    for k, v in {'title': title, 'description': desc, 'path': name + '.html', 'domain': DOMAIN, 'v': VER,
                 'head': site_head(), 'content': content}.items():
        page = page.replace('{{%s}}' % k, v)
    for k, v in {'email': SITE.get('contact_email', ''), 'date': TODAY, 'host': HOST}.items():
        page = page.replace('{{%s}}' % k, v)
    write(name + '.html', page)

nf = shell
for k, v in {'title': 'Page not found', 'description': 'That page does not exist.', 'path': '404.html', 'domain': DOMAIN, 'v': VER, 'head': site_head(),
             'content': '<h1>Page not found</h1><p class="upd">That link does not go anywhere.</p><p><a class="btn primary" href="/">Back to the converter</a></p>'}.items():
    nf = nf.replace('{{%s}}' % k, v)
write('404.html', nf)


# --------------------------------------------------- sitemap, robots, ads, CNAME
today = datetime.date.today().isoformat()
urls = [DOMAIN + '/'] + [DOMAIN + '/' + p.replace('index.html', '') for p in GENERATED if p != 'index.html' and p != '404.html']
sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in urls:
    sitemap.append('  <url><loc>%s</loc><lastmod>%s</lastmod></url>' % (esc(u), today))
sitemap.append('</urlset>')
write('sitemap.xml', '\n'.join(sitemap) + '\n')
write('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /test/\nDisallow: /pages/\n\nSitemap: %s/sitemap.xml\n' % DOMAIN)
client = SITE.get('adsense_client', '').strip()
write('ads.txt', ('google.com, %s, DIRECT, f08c47fec0942fa0\n' % client.replace('ca-', '')) if client else '# Add your AdSense line here after approval, e.g.\n# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n')
write('CNAME', HOST + '\n')
write('.nojekyll', '')

print('built %d files for %s (assets v=%s, adsense %s, analytics %s)' % (
    len(GENERATED), DOMAIN, VER, 'on' if client else 'off — set adsense_client in site.json', 'on' if SITE.get('ga4_measurement_id') else 'off'))
