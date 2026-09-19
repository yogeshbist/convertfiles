"""Builds the per-conversion landing pages and the hub pages."""

try:
    from . import traits as TRAITS
except ImportError:  # loaded as a plain module by build.py
    import traits as TRAITS
try:
    from . import keywords as KW
except ImportError:
    import keywords as KW
import html as _html
import json

from formats import FORMATS, GROUPS, seo_pairs  # noqa: F401

LOSSY = {'jpg', 'jpeg', 'webp', 'avif', 'jxl', 'heic', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'mp4', 'webm', 'gif'}

# Why someone actually performs this conversion. Anything not listed gets a
# sentence built from the two families, so no page is left with filler.
REASONS = {
    ('heic', 'jpg'): "Your iPhone saves photos as HEIC, and Windows, Android and most websites refuse to open them. JPG opens everywhere.",
    ('heic', 'png'): "iPhone photos arrive as HEIC, which most software cannot read. PNG is lossless, so nothing is thrown away before you edit.",
    ('webp', 'png'): "WebP is efficient on a web page but a great many desktop applications still cannot open one. PNG opens everywhere and keeps transparency.",
    ('webp', 'jpg'): "Browsers show WebP happily; the programs you actually edit and print with often do not. JPG is understood by all of them.",
    ('png', 'jpg'): "PNG keeps every pixel, which makes photographs unnecessarily large. JPG compresses them to a fraction of the size for sharing and uploading.",
    ('jpg', 'png'): "JPG loses a little detail each time it is saved. PNG is lossless and supports transparency, which is what editing and design work need.",
    ('png', 'webp'): "WebP files are roughly 30% smaller than PNG at the same visible quality, which makes pages load faster without changing how they look.",
    ('png', 'ico'): "Windows applications and website favicons need an ICO file, which packs the same artwork at several sizes into one file.",
    ('png', 'svg'): "An SVG wrapper lets a bitmap sit inside a vector workflow. Note this embeds the picture rather than tracing it into real vector shapes.",
    ('svg', 'png'): "SVG stays sharp at any size but many tools — office software, older apps, social platforms — cannot place one. PNG works everywhere.",
    ('tiff', 'jpg'): "Scanners and print workflows produce TIFF files that are far too large to email and that browsers cannot display at all.",
    ('gif', 'mp4'): "An MP4 of the same animation is usually a fraction of the size of the GIF, and every platform plays it.",
    ('jpg', 'pdf'): "A PDF is the right container for sending or printing a picture as a document, and it keeps several images together in page order.",
    ('png', 'pdf'): "PDF is what people expect to receive for anything document-shaped, and it prints predictably from any device.",
    ('pdf', 'jpg'): "Turning pages into images lets you post them, put them in a slide, or send a preview to someone who will not open a PDF.",
    ('pdf', 'png'): "PNG page images stay sharp for screenshots, documentation and anywhere a lossless copy of the page matters.",
    ('pdf', 'docx'): "PDFs are built to be read, not edited. Converting to Word recovers the text so you can actually change it.",
    ('docx', 'pdf'): "PDF fixes the layout so the document looks identical everywhere, which is what sending or printing a finished file requires.",
    ('docx', 'txt'): "Sometimes only the words matter — for a script, a dataset, or pasting somewhere that rejects formatting.",
    ('docx', 'md'): "Markdown turns a Word document into plain text that a README, a static site or a documentation tool can use directly.",
    ('md', 'pdf'): "Markdown is comfortable to write but not to send. PDF gives it a fixed, printable layout.",
    ('md', 'docx'): "Colleagues who work in Word need a Word file, however the text was originally written.",
    ('html', 'pdf'): "PDF captures a web page as a fixed document you can archive, print or attach to an email.",
    ('epub', 'pdf'): "PDF prints predictably and opens without an e-reader, which an EPUB cannot do.",
    ('pdf', 'epub'): "EPUB reflows text to fit the screen and respects your font size, which makes long reading on a phone or e-reader far easier.",
    ('csv', 'xlsx'): "Excel handles a real workbook better than raw text: proper columns, formatting and formulas instead of a wall of commas.",
    ('xlsx', 'csv'): "CSV is the format every other system accepts — databases, scripts, imports and analytics tools.",
    ('csv', 'json'): "JSON is what code and APIs consume, so this is the usual first step when spreadsheet data has to enter a program.",
    ('json', 'csv'): "A spreadsheet is far easier to read, sort and hand to a colleague than a wall of nested JSON.",
    ('csv', 'sql'): "A SQL script recreates the table and its rows in any database — MySQL, PostgreSQL, SQLite — without a manual import.",
    ('xlsx', 'pdf'): "PDF keeps the table exactly as it looks, which matters when the spreadsheet is being sent rather than edited.",
    ('json', 'yaml'): "YAML is far easier for a human to read and edit, which is why configuration files use it.",
    ('yaml', 'json'): "Most libraries and APIs expect JSON, even when the file was written in YAML for convenience.",
    ('mov', 'mp4'): "iPhone and Mac recordings are MOV, often with HEVC video that Windows and Android refuse to play. MP4 with H.264 plays everywhere.",
    ('mp4', 'webm'): "WebM is usually smaller at the same quality and is the right format for video you host on your own website.",
    ('webm', 'mp4'): "WebM plays in browsers but often nowhere else. MP4 works in every editor, player, television and messaging app.",
    ('mp4', 'mp3'): "Sometimes only the audio matters — a lecture, a podcast recording, an interview or a piece of music from a video.",
    ('mp4', 'gif'): "A short looping GIF plays inline in chats, issue trackers and documents where a video would not.",
    ('wav', 'mp3'): "WAV files are enormous. MP3 makes them small enough to send and store while staying indistinguishable to most ears.",
    ('mp3', 'wav'): "Editing and mastering want uncompressed audio so no further quality is lost along the way.",
    ('m4a', 'mp3'): "M4A comes from Apple devices and iTunes; MP3 is the format that plays on absolutely everything.",
    ('flac', 'mp3'): "FLAC is perfect for archiving and far too large for a phone or a car stereo.",
    ('obj', 'glb'): "Android's AR viewer, web viewers and modern engines want glTF. GLB packs the whole model into one file.",
    ('stl', 'glb'): "STL is the language of 3D printers; GLB is the language of AR and the web.",
    ('glb', 'stl'): "3D printers and slicers take STL, so a model that only exists as glTF has to be converted before it can be printed.",
    ('ttf', 'woff'): "WOFF is compressed for the web, so visitors download noticeably less when your page loads a custom font.",
    ('zip', 'tar'): "TAR preserves Unix permissions and structure, which is what Linux tooling and deployment pipelines expect.",
}

FAMILY_REASON = {
    ('image', 'image'): "different software, websites and devices accept different image formats, and this pair is one of the common mismatches.",
    ('image', 'doc'): "a picture often has to arrive as a document — for printing, attaching or filing.",
    ('doc', 'doc'): "documents move between writers, reviewers and publishers who each use different software.",
    ('doc', 'image'): "a page sometimes has to become a picture, for a slide, a post or a preview.",
    ('table', 'table'): "spreadsheets travel between Excel, LibreOffice and systems that only accept plain text.",
    ('table', 'doc'): "a table often needs to be read rather than edited, as part of a finished document.",
    ('table', 'data'): "data leaves the spreadsheet and enters a program, an API or a database.",
    ('data', 'data'): "the same structure is needed in the notation a particular tool expects.",
    ('data', 'table'): "raw data becomes something a person can read, sort and share.",
    ('audio', 'audio'): "players, devices and editors each favour different audio codecs.",
    ('video', 'video'): "a video refuses to play somewhere, or needs to be smaller for the web.",
    ('video', 'audio'): "only the sound is needed — the pictures are not.",
    ('video', 'image'): "a single frame or a short loop is wanted rather than the whole clip.",
    ('model3d', 'model3d'): "3D pipelines — printing, AR, engines, scanning — each standardised on different formats.",
    ('font', 'font'): "a font installed on a computer and a font served to a browser are packaged differently.",
    ('archive', 'archive'): "archive formats differ by platform and by what the receiving system expects.",
}


def esc(s):
    return _html.escape(str(s), quote=True)


def name_of(ext, ext_table):
    return FORMATS.get(ext, {}).get('name') or ext_table.get(ext, [None, ext.upper()])[1]


def family(ext, ext_table):
    return ext_table.get(ext, ['any'])[0]


def reason(f, t, ext_table):
    if (f, t) in REASONS:
        return REASONS[(f, t)]
    ff, ft = family(f, ext_table), family(t, ext_table)
    tail = FAMILY_REASON.get((ff, ft), "the two formats suit different tools and situations.")
    generic = "People convert %s to %s because %s" % (f.upper(), t.upper(), tail)
    return TRAITS.why(f, t, generic)


def expect(f, t, ext_table):
    """The body of "what to expect", plus any caveat specific to the target."""
    base = _expect(f, t, ext_table)
    for note in (TRAITS.FROM_NOTE.get(f), TRAITS.NOTE.get(t)):
        if note and note not in base:
            base += " " + note
    return base


def _expect(f, t, ext_table):
    ff, ft = family(f, ext_table), family(t, ext_table)
    if ff == 'image' and ft == 'image':
        if t in LOSSY:
            return ("The image is decoded and re-encoded, so keep the quality slider at 85% or above — at that setting the "
                    "difference is invisible to the eye. Transparency is flattened onto white for formats that cannot store it, "
                    "such as JPG.")
        return ("The target format is lossless, so every pixel of the decoded image is preserved exactly. The result can be "
                "larger than the original, which is the normal trade for keeping full quality.")
    if ff == 'image' and ft in ('doc',):
        return ("The picture is placed on a page sized to fit it, with a small margin. To combine several images into one "
                "document, convert them together and merge the results, or pick a document format that holds them all.")
    if ff == 'doc' and ft == 'image':
        return ("Each page is laid out and then rendered as a picture at the scale you choose. A document of several pages "
                "produces several images, delivered together in a zip.")
    if ff == 'video' and ft == 'video':
        return ("Every frame is decoded and re-encoded inside your browser, so a long clip takes a while and the tab must stay "
                "open. Setting a width of 1280 gives a much smaller file that still looks sharp on a phone.")
    if ff == 'video' and ft == 'audio':
        return "The picture track is discarded and only the sound is kept, encoded at the bitrate you choose."
    if ff == 'video' and ft == 'image':
        return ("Choose the point in the clip to sample. For an animated GIF you also set the length and the frame rate; GIFs "
                "are limited to 256 colours, so dithering is switched on by default to keep gradients smooth.")
    if ff == 'audio':
        return ("The audio is decoded and re-encoded with the target codec. Choose 192 kbps or higher for music; speech is "
                "perfectly clear at less. Converting between two lossy formats always loses a little, so work from the "
                "original where you can.")
    if ff == 'doc' or ft == 'doc':
        return ("Headings, paragraphs, bold and italic text, lists, quotes, tables and embedded pictures are all carried "
                "across. Exact page layout, fonts and multi-column arrangements are not — and a scanned PDF holds no text at "
                "all, so there is nothing to extract without OCR.")
    if ff == 'table' or ft == 'table':
        return ("Cell values are carried across exactly as they appear. Formulas become their calculated results, and formats "
                "that hold only one table — CSV and TSV — take the first sheet of a multi-sheet workbook.")
    if ff == 'model3d':
        return ("Geometry is converted exactly, with node transforms applied so the model keeps its pose. Materials, textures "
                "and animation are not carried across. Check the scale in your viewer: STL files carry no units, so a model "
                "exported in millimetres can appear a thousand times too large.")
    if ff == 'font':
        return "The font tables themselves are unchanged — only the container differs — so the glyphs render identically."
    return "The conversion runs entirely in your browser and the file never leaves your device."


NO_ALPHA = {'jpg', 'jpeg', 'bmp', 'tga', 'pdf'}
HAS_ALPHA = {'png', 'webp', 'avif', 'gif', 'ico', 'icns', 'tiff', 'svg', 'jxl'}
# the tool people would otherwise script this with, per family
SCRIPT_TOOL = {'image': 'ImageMagick', 'audio': 'FFmpeg', 'video': 'FFmpeg', 'model3d': 'Blender',
               'data': 'Python', 'table': 'Python', 'doc': 'Pandoc or LibreOffice', 'font': 'FontForge',
               'archive': 'the command line'}


def faqs(f, t, ext_table):
    """Questions phrased the way people actually search for this pair.

    The base four apply everywhere. The rest are added only when Google's
    autocomplete for this pair shows that intent (content/suggest.json), so a
    HEIC page answers "on iPhone?" and an STL page answers "without Blender?"
    rather than every page answering everything."""
    F, T = f.upper(), t.upper()
    SF, ST = KW.search_name(f), KW.search_name(t)
    mods = KW.modifiers(f, t)
    ff, ft = family(f, ext_table), family(t, ext_table)
    out = [
        ("Is this %s to %s converter free?" % (SF, ST),
         "Yes, completely. There is no account, no daily limit, no watermark and no premium tier."),
        ("Is my %s file uploaded to a server?" % F,
         "No. The conversion runs inside your own browser using your device's processor. The file is read from your disk, "
         "converted in memory and saved back to your disk \u2014 nothing is transmitted, so there is nothing for anyone to store."),
    ]
    if 'online' in mods or 'download' in mods:
        out.append(("Can I convert %s to %s online without downloading software?" % (SF, ST),
                    "Yes. This is an online %s to %s converter that runs in your browser, so there is nothing to install "
                    "and no app to trust with your files. It works the same on a phone." % (SF, ST)))
    out.append(("Does converting %s to %s lose quality?" % (SF, ST) if 'quality' in mods else "What happens to the quality?",
                expect(f, t, ext_table)))
    if 'transparent' in mods and t in NO_ALPHA:
        out.append(("Does %s to %s keep a transparent background?" % (SF, ST),
                    "No. %s cannot store transparency, so any transparent area is flattened onto a solid colour \u2014 "
                    "white unless you choose another. Pick PNG or WebP as the target if the transparency matters." % T))
    elif 'transparent' in mods and t in HAS_ALPHA:
        out.append(("Does %s to %s keep a transparent background?" % (SF, ST),
                    "Yes. %s supports a real alpha channel, and transparent areas come through exactly as they were." % T))
    if 'editable' in mods and ft == 'doc':
        out.append(("Will the %s file be editable?" % ST,
                    "Yes. The text comes across as real, editable text with headings, lists, links and tables, not as a "
                    "picture of the page. Exact page layout and fonts are the part that may need tidying afterwards."))
    if 'ocr' in mods or (ff == 'doc' and f == 'pdf'):
        out.append(("Does this %s to %s converter do OCR?" % (SF, ST),
                    "No. It converts the text that is already in the file. A scanned %s holds a picture of a page rather "
                    "than text, so it comes out as an image; OCR software is needed to read the words off a scan." % F))
    if 'windows' in mods or 'mac' in mods or 'linux' in mods:
        out.append(("How do I convert %s to %s on Windows, Mac or Linux?" % (SF, ST),
                    "The same way on all three: open this page in Chrome, Edge, Firefox or Safari, drop the %s file, "
                    "press Convert and download the %s. Nothing is installed and no admin permission is needed." % (F, T)))
    if 'iphone' in mods or 'android' in mods:
        out.append(("Can I convert %s to %s on an iPhone or Android phone?" % (SF, ST),
                    "Yes. Open this page in Safari or Chrome on the phone, pick the file from Photos or Files, tap Convert "
                    "and save the result. The conversion runs on the phone itself, so it works on mobile data without "
                    "uploading anything."))
    out.append(("Can I batch convert several %s files to %s at once?" % (F, T) if 'bulk' in mods else "Can I convert several %s files at once?" % F,
                "Yes. Select as many files as you like and they are converted one after another in a single tap, with a "
                "download for each and a zip of all of them."))
    if 'code' in mods:
        tool = SCRIPT_TOOL.get(ff, 'a script')
        out.append(("Can I convert %s to %s without %s or a script?" % (SF, ST, tool),
                    "Yes \u2014 that is what this page is for. %s does the same job well if you already have it set up "
                    "and thousands of files to process; for one file, or a handful, the browser is faster than "
                    "installing anything." % tool))
    src = TRAITS.LEAVING.get(f)
    if src:
        out.append(("Should I keep the original %s file?" % F,
                    "Yes \u2014 keep it, converting never touches it. The reason to make a copy in another format is that "
                    "%s." % src))
    if ff == 'video':
        out.append(("How long does it take?",
                    "Roughly as long as the clip itself for high-definition video, because every frame is decoded and "
                    "re-encoded on your own machine. Keep the tab in the foreground while it works."))
    if f == 'heic' or t == 'heic':
        out.append(("Why can my computer not open HEIC files?",
                    "HEIC is patent-encumbered, so Windows, Android and most browsers do not include a decoder. Safari on "
                    "Apple devices is the exception. Convert Files carries its own decoder, so it works in any browser."))
    return out


def related(f, t, pairs_set, limit=12):
    """Other pages worth linking: same source, then same target."""
    same_source = [(f, x) for (a, x) in pairs_set if a == f and x != t]
    same_target = [(x, t) for (x, b) in pairs_set if b == t and x != f]
    reverse = [(t, f)] if (t, f) in pairs_set else []
    out, seen = [], set()
    for p in reverse + same_source + same_target:
        if p not in seen and p in pairs_set:
            seen.add(p)
            out.append(p)
        if len(out) >= limit:
            break
    return out


def group_of(ext):
    for title, fam, members in GROUPS:
        if ext in members:
            return title, fam
    return 'Converters', 'any'
