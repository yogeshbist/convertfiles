"""What each format actually is — the substance of every landing page.

`blurb` is two or three sentences of real, useful explanation; `aka` feeds the
page's alternative names so a search for "JPEG" finds the .jpg page.
"""

FORMATS = {
    # ---------------------------------------------------------------- images
    'png': dict(aka='Portable Network Graphics', blurb="PNG is lossless: it stores every pixel exactly as it was, and supports a transparent background. It is the right format for screenshots, logos, diagrams, icons and anything with sharp edges or text. Photographs come out noticeably larger than they would as JPG."),
    'jpg': dict(aka='JPEG', blurb="JPG (also written JPEG) is the universal photograph format — small files that open on every device made in the last twenty-five years. It is lossy, discarding detail the eye is least likely to miss, which makes it excellent for photos and poor for screenshots, logos and text, where it leaves visible smudging."),
    'webp': dict(aka='Google WebP', blurb="WebP is Google's web image format: roughly 30% smaller than JPG at the same visible quality, with support for transparency and animation. Every current browser displays it, but a great many desktop applications still cannot open one, which is why converting WebP to PNG or JPG is such a common need."),
    'avif': dict(aka='AV1 Image File Format', blurb="AVIF uses the AV1 video codec to compress still images, often landing at half the size of an equivalent JPG. Browsers display it well; most desktop software does not yet. Use it for pages you build, and convert it to JPG or PNG for anything you need to send to another person."),
    'gif': dict(aka='Graphics Interchange Format', blurb="GIF holds a short, silent, looping animation limited to 256 colours per frame. That colour limit makes it poor for photographs and fine for flat graphics, screen recordings and reaction clips, which still play inline almost everywhere."),
    'bmp': dict(aka='Windows Bitmap', blurb="BMP stores pixels uncompressed, which makes files very large and very simple. It survives from early Windows and still appears in older software and some hardware exports; almost any modern format will store the same picture in a fraction of the space."),
    'svg': dict(aka='Scalable Vector Graphics', blurb="SVG describes shapes mathematically rather than as pixels, so a logo or icon stays perfectly sharp at any size and the file is usually tiny. It is text underneath, which is why it can be edited, styled with CSS and animated — but it cannot represent a photograph."),
    'ico': dict(aka='Windows icon', blurb="ICO is the Windows icon container, used for favicons and application icons. One file can hold the same image at several sizes so the system can pick the right one; 16, 32, 48 and 256 pixels are the usual set."),
    'icns': dict(aka='Apple icon image', blurb="ICNS is macOS's icon container, the Apple counterpart to Windows ICO. It bundles several resolutions of the same artwork, up to 1024 pixels, so an icon stays crisp from the Dock to a Finder preview."),
    'heic': dict(aka='HEIF, iPhone photo', blurb="HEIC is the format iPhones have used for photos since iOS 11. It stores a picture in roughly half the space of a JPG at the same quality, but it is patent-encumbered: Windows, Android and every browser except Safari refuse to open one without extra software. That single fact is why HEIC to JPG is one of the most searched conversions on the internet."),
    'tiff': dict(aka='TIF, Tagged Image File Format', blurb="TIFF is the lossless format of scanners, print workflows and archives, able to hold multiple pages and very high bit depths. Files are large, and browsers cannot display one, so a TIFF usually has to be converted before it can be shared or put on a web page."),
    'jxl': dict(aka='JPEG XL', blurb="JPEG XL is a modern successor to JPEG that compresses better, supports transparency and can re-encode an existing JPEG losslessly. Support is still thin outside a few browsers and image tools, so it is best treated as an archival or experimental format for now."),
    'tga': dict(aka='Truevision Targa', blurb="TGA is a simple, usually uncompressed image format that persists in game development and 3D texturing pipelines, where its straightforward alpha channel is convenient. General-purpose software often cannot open one."),
    'ppm': dict(aka='Netpbm colour', blurb="PPM is about the simplest colour image format there is: a tiny text header followed by raw RGB bytes. It exists to be easy for programs to read and write, which makes it common in scientific tooling and in Unix image pipelines."),
    'pgm': dict(aka='Netpbm greyscale', blurb="PGM is the greyscale member of the Netpbm family — a plain header and one byte of brightness per pixel. It turns up in computer-vision work and academic code where a dependency-free format matters more than file size."),
    'pbm': dict(aka='Netpbm bitmap', blurb="PBM stores a purely black-and-white image, one bit per pixel. It is the smallest and bluntest of the Netpbm formats, used for masks, fax-like documents and simple diagrams."),

    # ------------------------------------------------------------- documents
    'pdf': dict(aka='Portable Document Format', blurb="PDF fixes a document to the page: every character sits at a recorded position, so it looks identical on any screen or printer. That is exactly why it is the format for sending and printing finished documents, and why editing one is awkward — the text is placed, not flowed."),
    'docx': dict(aka='Word, Microsoft Word document', blurb="DOCX is Microsoft Word's format. It describes a document by its structure — paragraphs, headings, lists, tables, images — and lets Word decide the layout, which makes it the right choice for anything still being written or edited. Underneath it is a ZIP archive of XML."),
    'odt': dict(aka='OpenDocument Text, LibreOffice Writer', blurb="ODT is the open standard used by LibreOffice and OpenOffice Writer, and an ISO standard in its own right. It carries the same kinds of structure as DOCX — headings, lists, tables, pictures — and Word can open one, though formatting occasionally shifts."),
    'rtf': dict(aka='Rich Text Format', blurb="RTF is a plain-text format with formatting instructions written inline, created by Microsoft as a lowest-common-denominator exchange format. Nearly every word processor ever made can open one, which makes it a dependable fallback when you do not know what software the recipient has."),
    'txt': dict(aka='plain text', blurb="Plain text is just the characters, with no formatting at all. It opens in every editor on every system, will still be readable in fifty years, and is the format to reach for when the words matter and their appearance does not."),
    'md': dict(aka='Markdown', blurb="Markdown is plain text with a light sprinkling of punctuation for formatting — # for a heading, ** for bold. It is readable as-is and converts cleanly to HTML, which is why READMEs, documentation sites and note-taking apps standardised on it."),
    'html': dict(aka='HTM, web page', blurb="HTML is the language of web pages: headings, paragraphs, lists, links, tables and images, marked up as structure rather than layout. Any browser on any device can open one, which makes it a convenient universal document format as well as a web one."),
    'epub': dict(aka='ebook', blurb="EPUB is the open ebook standard used by every major reader except the Kindle. Unlike a PDF it reflows text to fit the screen and respects the reader's font size, which is what makes it comfortable on a phone or e-reader. Inside, it is a ZIP of XHTML."),
    'tex': dict(aka='LaTeX', blurb="LaTeX source is plain text marked up for the TeX typesetting system, which academia relies on for papers, theses and anything heavy with mathematics. It produces exceptional typography, but it must be compiled before anyone can read the result."),

    # ---------------------------------------------------------- spreadsheets
    'xlsx': dict(aka='Excel, Microsoft Excel workbook', blurb="XLSX is the modern Excel workbook: multiple sheets, cell formatting, formulas and dates that know they are dates. It is what most people mean by “a spreadsheet”, and like DOCX it is really a ZIP of XML underneath."),
    'xls': dict(aka='Excel 97-2003', blurb="XLS is the old binary Excel format, used from 1997 to 2003 and still produced by plenty of legacy systems and bank exports. Excel still opens one, but it caps out at 65,536 rows, which modern data regularly exceeds."),
    'ods': dict(aka='OpenDocument Spreadsheet, LibreOffice Calc', blurb="ODS is the open spreadsheet standard used by LibreOffice and OpenOffice Calc. It holds the same sheets, formatting and formulas as XLSX, and Excel can open one, making it a good neutral choice when you do not want to require Microsoft Office."),
    'csv': dict(aka='comma-separated values', blurb="CSV is a table written as plain text: one row per line, values separated by commas. Every spreadsheet, database and programming language on earth can read and write it, which is why it remains the default way to move data between systems — at the cost of storing no formatting, no formulas and no idea what a date is."),
    'tsv': dict(aka='tab-separated values', blurb="TSV is CSV with tabs instead of commas, which sidesteps the classic problem of values that themselves contain commas. It is common in bioinformatics, log processing and anywhere data is piped between Unix tools."),

    # ------------------------------------------------------------------ data
    'json': dict(aka='JavaScript Object Notation', blurb="JSON is the data format of the modern web: nested objects and lists written as readable text. Every programming language and virtually every API speaks it, which makes it the usual destination when data has to leave a spreadsheet and enter a program."),
    'xml': dict(aka='Extensible Markup Language', blurb="XML wraps data in named tags that can nest arbitrarily deep, with a schema to validate the shape. It is more verbose than JSON but remains entrenched in enterprise systems, government data feeds, and the innards of formats like DOCX and XLSX."),
    'yaml': dict(aka='YML, YAML Ain’t Markup Language', blurb="YAML expresses the same structures as JSON using indentation instead of brackets, which makes it far easier for a human to read and edit. That is why it became the standard for configuration files — CI pipelines, Kubernetes, Docker Compose and countless application settings."),
    'sql': dict(aka='SQL insert script', blurb="A SQL script is plain text containing the statements needed to recreate a table and fill it with rows. Handing one to any database — MySQL, PostgreSQL, SQLite, SQL Server — reproduces the data exactly, which makes it the most portable way to move a table into a database."),
    'toml': dict(aka='Tom’s Obvious Minimal Language', blurb="TOML is a configuration format designed to be unambiguous to both people and parsers, avoiding YAML's indentation traps. Rust's Cargo, Python's packaging tooling and many Go projects use it."),

    # ----------------------------------------------------------------- audio
    'mp3': dict(aka='MPEG audio', blurb="MP3 is the audio format everything understands — every phone, car stereo, browser and media player made this century. It is lossy, but at 192 kbps or above most listeners cannot tell it from the original, and its universality outweighs the newer formats' efficiency."),
    'wav': dict(aka='Waveform audio', blurb="WAV is uncompressed audio: the raw samples, exactly as recorded, with no quality lost and no processing applied. That makes it the format for recording, editing and archiving — and a poor one for sharing, since a few minutes runs to tens of megabytes."),
    'm4a': dict(aka='AAC, MPEG-4 audio', blurb="M4A holds AAC audio in an MP4 container — the format of iTunes purchases, Apple Music downloads and iPhone voice memos. At the same bitrate it sounds better than MP3, though a few older devices still refuse it."),
    'aac': dict(aka='Advanced Audio Coding', blurb="AAC is the successor to MP3 adopted by Apple, YouTube and digital broadcasting, delivering better sound per kilobyte. A raw .aac file is the bare ADTS stream; the same audio inside an MP4 container is what people usually receive as .m4a."),
    'ogg': dict(aka='Ogg Opus, Ogg Vorbis', blurb="OGG is an open container, these days usually carrying Opus audio, which is exceptionally good at low bitrates. It is free of patents, which is why games, Wikipedia, Discord and most voice chat use it — and why some consumer hardware never added support."),
    'opus': dict(aka='Opus audio', blurb="Opus is the codec behind nearly all modern voice and music streaming, standardised by the IETF and free to use. It stays intelligible at bitrates where other codecs collapse, and every current browser decodes it."),
    'flac': dict(aka='Free Lossless Audio Codec', blurb="FLAC compresses audio to roughly half its size while preserving every original sample exactly. It is the format of choice for archiving a CD collection or distributing high-resolution music, at the cost of files several times larger than an MP3."),

    # ----------------------------------------------------------------- video
    'mp4': dict(aka='MPEG-4, H.264 video', blurb="MP4 carrying H.264 video and AAC audio is the one video format that plays essentially everywhere — phones, televisions, browsers, editing software and every messaging app. When something refuses to play a video, converting it to MP4 is almost always the fix."),
    'webm': dict(aka='VP9 video', blurb="WebM is the open web video container, usually holding VP9 video and Opus audio. It is typically smaller than an equivalent MP4 and plays in every modern browser, which makes it ideal for video you host yourself and awkward for video you send to someone."),
    'mov': dict(aka='QuickTime movie', blurb="MOV is Apple's QuickTime container, and what an iPhone or a Mac screen recording produces. Structurally it is close to MP4, but it often carries HEVC video, which Windows and Android frequently refuse to play — the usual reason a MOV has to be converted."),
    'm4v': dict(aka='Apple MPEG-4 video', blurb="M4V is Apple's variant of MP4, used by the iTunes Store and sometimes carrying copy protection. An unprotected M4V is effectively an MP4 and converting it is mostly a matter of relabelling the container."),

    # ------------------------------------------------------------------- 3D
    'obj': dict(aka='Wavefront OBJ', blurb="OBJ is a plain-text 3D mesh format from the late 1980s that virtually every 3D application can read and write. It stores geometry as vertices and faces, with materials kept alongside in a companion MTL file — simple, ubiquitous, and completely unable to carry animation."),
    'stl': dict(aka='stereolithography', blurb="STL describes a surface as nothing but triangles: no colour, no texture, no units. That bluntness is exactly what 3D printing needs, which is why it remains the standard format for sending a model to a printer or a print service."),
    'glb': dict(aka='binary glTF', blurb="GLB is the single-file binary form of glTF, and the format the augmented-reality world has standardised on — Android's Scene Viewer, web viewers, Unity and three.js all take one directly. Geometry, materials and animation travel in one file that loads fast."),
    'gltf': dict(aka='GL Transmission Format', blurb="glTF is a JSON description of a 3D scene — meshes, materials, nodes, animations — with the vertex data either alongside or embedded. It is often called “the JPEG of 3D”, and GLB is simply the same thing packed into one binary file."),
    'ply': dict(aka='Stanford Polygon Format', blurb="PLY was designed at Stanford for scanned 3D data and remains the common format for point clouds and photogrammetry output. It can carry per-vertex colour and arbitrary custom properties, which is why research tooling favours it."),

    # ----------------------------------------------------------------- fonts
    'ttf': dict(aka='TrueType font', blurb="TTF is the font format Windows and macOS have used for installed system fonts since the 1990s. Its outlines are quadratic curves, and nearly every application that renders text can use one."),
    'otf': dict(aka='OpenType font', blurb="OTF extends TrueType with cubic outlines and rich typographic features — ligatures, alternate glyphs, small capitals, proper kerning. Professional typefaces are normally distributed this way."),
    'woff': dict(aka='Web Open Font Format', blurb="WOFF is a font packaged for the web: the same tables as a TTF or OTF, compressed and wrapped so a browser can download it as part of a page. Serving WOFF instead of a raw TTF meaningfully reduces how much a visitor has to download."),

    # -------------------------------------------------------------- archives
    'zip': dict(aka='ZIP archive', blurb="ZIP bundles many files into one and compresses them, and every operating system has opened one natively for decades. It is the default way to send a folder to another person, and the container hiding inside DOCX, XLSX, EPUB and countless other formats."),
    'tar': dict(aka='tape archive', blurb="TAR bundles files together without compressing them, preserving Unix permissions and structure. It is almost always paired with a compressor — a .tar.gz — and remains the standard way software is distributed on Linux."),
    'gz': dict(aka='gzip', blurb="Gzip compresses a single file — it does not bundle several. That is why it is nearly always seen wrapping a TAR archive as .tar.gz, and why it is the compression the whole web uses when serving pages."),
    'tgz': dict(aka='tar.gz, gzipped tar', blurb="A TGZ is a TAR archive that has then been gzipped: the bundling and the compression done by two separate tools, as Unix prefers. It is the standard distribution format for source code and Linux packages."),
}

# Formats that deserve their own landing pages, by family. Aliases (jpeg, htm,
# yml, tif, markdown, jfif, dib, heif, oga, weba) are deliberately left out so
# the site never competes with itself for the same search.
SEO_IMAGE = ['png', 'jpg', 'webp', 'gif', 'bmp', 'svg', 'ico', 'heic', 'tiff', 'avif', 'icns', 'tga']
SEO_DOC = ['pdf', 'docx', 'odt', 'rtf', 'txt', 'md', 'html', 'epub']
SEO_TABLE = ['xlsx', 'xls', 'csv', 'ods', 'tsv']
SEO_DATA = ['json', 'xml', 'yaml', 'sql', 'toml']
SEO_AUDIO = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus']
SEO_VIDEO = ['mp4', 'webm', 'mov', 'm4v']
SEO_3D = ['obj', 'stl', 'glb', 'gltf', 'ply']
SEO_FONT = ['ttf', 'otf', 'woff']
SEO_ARCHIVE = ['zip', 'tar', 'gz', 'tgz']

GROUPS = [
    ('Image converters', 'image', SEO_IMAGE),
    ('Document converters', 'doc', SEO_DOC),
    ('Spreadsheet converters', 'table', SEO_TABLE),
    ('Data converters', 'data', SEO_DATA),
    ('Audio converters', 'audio', SEO_AUDIO),
    ('Video converters', 'video', SEO_VIDEO),
    ('3D & AR converters', 'model3d', SEO_3D),
    ('Font converters', 'font', SEO_FONT),
    ('Archive converters', 'archive', SEO_ARCHIVE),
]


def seo_pairs(graph):
    """Pairs worth a dedicated page: inside a family, plus the cross-family
    conversions people actually search for."""
    want = []

    def add(sources, targets):
        for f in sources:
            for t in targets:
                if f != t and t in graph.get(f, []):
                    want.append((f, t))

    add(SEO_IMAGE, SEO_IMAGE)
    add(SEO_IMAGE, ['pdf', 'docx'])
    add(['pdf'], SEO_IMAGE)
    add(SEO_DOC, SEO_DOC)
    add(SEO_DOC, ['png', 'jpg'])
    add(SEO_TABLE, SEO_TABLE)
    add(SEO_TABLE, ['pdf', 'docx', 'json', 'xml', 'sql', 'html', 'md'])
    add(SEO_DATA, SEO_DATA)
    add(SEO_DATA, ['csv', 'xlsx', 'pdf'])
    add(SEO_AUDIO, SEO_AUDIO)
    add(SEO_VIDEO, SEO_VIDEO)
    add(SEO_VIDEO, SEO_AUDIO + ['gif', 'png', 'jpg'])
    add(SEO_3D, SEO_3D)
    add(SEO_FONT, SEO_FONT)
    add(SEO_ARCHIVE, SEO_ARCHIVE)
    seen, out = set(), []
    for p in want:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out
