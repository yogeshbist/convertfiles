# Convert Files — design guide

Everything you see on convertfiles.in comes from a handful of files in this
folder. This guide says which ones, how to preview your changes, and what the
JavaScript depends on so a redesign does not break the converter.

## 1. Preview it

You need Python 3 (already on every Mac; on Windows install it from python.org).

```
python3 serve.py
```

then open **http://localhost:8777**. Edit a file, reload the page. Do not open
the HTML files directly by double-clicking — the pages link to `/css/…` and
`/js/…` from the site root, which only works through the little server.

Pages worth opening while you design (one of each kind):

| Kind | URL |
|---|---|
| Home (converter + tools rail + everything) | http://localhost:8777/ |
| Conversion landing page (399 of these) | http://localhost:8777/heic-to-jpg/ |
| Tool page, simple | http://localhost:8777/compress-image/ |
| Tool page with an interactive stage | http://localhost:8777/passport-photo/ · /organize-pdf/ · /sign-pdf/ · /mp3-cutter/ |
| Tool page without a file input | http://localhost:8777/qr-code-generator/ |
| Hubs | http://localhost:8777/formats/ · /tools/ · /guides/ · /hi/guides/ |
| Guide article | http://localhost:8777/guides/heic-to-jpg/ |
| Legal page (different shell) | http://localhost:8777/privacy.html |
| Embeddable widget | http://localhost:8777/embed/ and its docs page /widget/ |
| Admin panel | http://localhost:8777/admin/ (needs the API; look, do not log in) |

Switch your OS between light and dark: the site follows it. Resize down to a
phone width: it must work there too.

## 2. The files that are the design

| File | What it is |
|---|---|
| `index.html` | **The master template.** Every page of the site is built from this one file — the nav, hero, drop zone, format chooser, options, result panel, the home sections, footer, modal, picker, toast, and the SVG icon sprite at the top. |
| `css/app.css` | **All the styling.** Design tokens at the top (colours, fonts, radii, shadows), then components in page order. Light theme first; dark only redefines tokens. |
| `css/tools.css` | Styling for the tool pages (option cards, crop stage, page thumbnails, waveform, signature pad, QR, archive table). Inlined into tool pages at build. |
| `assets/` | Fonts (`fonts/*.woff2`, self-hosted), icons, `og.png` (the 1200×630 social preview), `upi-qr.png`. |
| `pages/_shell.html` | The shell for the three legal pages (privacy, terms, contact); their text is in `pages/*.html`. |
| `admin/index.html`, `admin/admin.css` | The admin panel. Separate look is fine; it is not public. |

Everything else (`js/`, `build.py`, `seo/`, `content/`, `api/`) is behaviour and
content. You can leave it alone. If you want to change markup that JavaScript
generates (see §5), change the JS or send me the design and I will.

## 3. How pages get built

`build.py` reads `index.html`, fills the markers, and writes 455 pages
(`heic-to-jpg/index.html`, `compress-image/index.html`, …). After you change
`index.html` or the CSS:

```
python3 build.py
```

and reload. It needs nothing but Python. If you would rather not, edit and
preview the home page only, then send me the folder — I rebuild, test and
deploy. **Do not edit the generated pages by hand**; the next build overwrites them.

## 4. Design tokens

Every colour on the site is one of these. Change them here, not in components.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | #F5F7FA | #0E141C | page background |
| `--surface` / `-2` / `-3` | #FFFFFF / #F0F3F7 / #E9EEF3 | #151D27 / #1B2531 / #222D3A | cards, wells, tracks |
| `--ink` / `--ink-2` / `--muted` | #12202B / #3C4A56 / #6B7A88 | #E8EEF3 / #B9C5CF / #8393A1 | text, secondary text, captions |
| `--line` / `--line-2` | #E3E9EF / #CFD9E2 | #243040 / #2E3B4C | borders |
| `--accent` / `-d` / `-soft` / `-ink` | #0E7C86 / #0B646C / #DDF1F3 / #FFF | #2FB7C2 / #6ACBD3 / #12333A / #06191C | buttons, links, highlights, text on accent |
| `--pop` / `--pop-soft` | #FF7A59 / #FFE7DF | #FF8F73 / #3A241D | the arrow, small emphasis |
| `--ok`, `--err` (+ `-soft`) | greens / reds | | success and error states |
| `--f-image` `--f-doc` `--f-table` `--f-data` `--f-audio` `--f-video` `--f-archive` `--f-model3d` | family colours for chips, dots and icon tiles |
| `--display` / `--body` / `--mono` | Sora / Manrope / JetBrains Mono | | headings / text / file extensions |
| `--r-sm` `--r` `--r-lg` | 10 / 14 / 20 px | | corner radii |
| `--shadow`, `--shadow-lg` | | | card elevation |

Rules that keep the site healthy:

- **No hard-coded colours in components** — always a token. Then dark mode is free.
- Text on a tinted background must stay at **4.5:1 contrast** in both themes.
  Chips and icon tiles already mix the family colour darker (light) or
  lighter (dark) for this reason; keep that pattern.
- Fonts are self-hosted variable fonts (81 KB total). To change a font, drop
  a latin-subset `.woff2` into `assets/fonts/`, add its `@font-face` at the top
  of `app.css`, and point the token at it. Do not add a Google Fonts `<link>`
  — that was the single biggest thing slowing the site down.

## 5. Component map

Where each piece lives, and who creates its markup.

| Component | Markup lives in | Classes / ids |
|---|---|---|
| Header, nav, install button | `index.html` | `.nav .nav-in .brand .tabs .tab #install` |
| Hero (eyebrow, h1, lead) | `index.html` | `.hero .eyebrow` — build.py **replaces the `<h1>` text and the `<p>` text** on every generated page, so keep them as single elements |
| Drop zone | `index.html` | `#drop .drop .drop-ic .browse` |
| Picked files list | **app.js / tools.js** | `.picked .picked-list .picked-row .thumb .info .name .meta` |
| Format chooser | `index.html` | `.section .section-h .pipe .tile #tile-from #tile-to` |
| Format picker popover / phone sheet | `index.html` + app.js | `.picker .picker-q .picker-list .picker-row` |
| Conversion options | `index.html` | `.opts .opt` |
| Convert button, privacy line | `index.html` | `.cta #go .private` |
| Progress, result panel | `index.html` + **app.js** | `.progress .bar .status .done .done-row .done-list .picked-foot` |
| Sticky convert bar (phones) | `index.html` | `.sticky` |
| Services carousel (home only) | `index.html` (`promo:only` markers) + app.js rotation | `.promo .promo-track .promo-slide .promo-ic .promo-dots .promo-dot` |
| Tools rail (home only) | `index.html` markers + **build.py** | `.tools-rail .rail-h .rail-tag .rail-list .ic .tx .rk .cnt .rail-foot .rail-more` |
| Tools hub cards | **build.py** | `.tools-hub .tgrid .tcard .ttag .tools-foot` |
| Home: numbers, steps, popular tiles, guide cards, FAQ, support, feedback | `index.html` + **app.js** | `.home .kpis .steps .pop .guides .gcard .faq #support .fb-*` |
| Tool page panel | **tools.js** | `.tool .t-opts .t-chip .t-stage .t-pages .t-page .t-trim .t-wave .t-meta .t-files .t-sigpad .t-done` |
| SEO body on landing/tool pages | **build.py** | `.seo .crumbs .lead .howto .faq-list .rel .seo-more` |
| Hub lists | **build.py** | `.hub .hub-row .hub-guide` |
| Guide article | `index.html` + app.js | `.article .cat .meta .body .try` |
| Footer | `index.html` | `.footer .footer-links` |
| Preview modal, toast | `index.html` | `.modal .modal-box #toast` |
| Icons | `index.html` sprite | `<symbol id="i-…">` for UI, `<symbol id="t-…">` per tool, `#i-star` |

Restyle anything with CSS freely. To change the **structure** of the rows the
JavaScript builds, edit the `el(…)` calls in `js/app.js` / `js/tools.js` — or
mock the new markup in HTML and hand it to me.

## 6. Do not break these

The JavaScript finds elements by id and the build finds blocks by marker.

- **Keep every `id="…"`** in `index.html`. Move them, restyle them, wrap them — but keep them.
- **Keep the marker comments** exactly: `<!-- site:head -->`, `<!-- page:meta -->`,
  `<!-- page:body -->`, `<!-- home:only -->`, `<!-- rail:only -->`, `<!-- promo:only -->`,
  `<!-- popular:tiles -->`, `<!-- home:guides -->`, `<!-- rail:list -->` (each with its closing twin).
- Keep the hero `<h1>Free Online File Converter</h1>` and the paragraph after it
  as they are — build.py swaps their text per page by matching the exact string.
- Keep the four `<section class="view" id="view-…">` sections; the app shows one at a time.
- Keep the global rule `[hidden]{display:none!important}` in `app.css`.
- Keep the `?v=…` on asset URLs; the build sets the version.
- One `<h1>` per page. Labels on every input. No third-party CSS or fonts.
- Breakpoints in use: 960 (rail drops below), 760, 640, 560, 520 (phones).

## 7. Handing it back

Send the whole folder (or just the files you changed: usually `index.html`,
`css/app.css`, `css/tools.css`, `assets/`). I rebuild all pages, run the test
suite and the Lighthouse check, and deploy.
