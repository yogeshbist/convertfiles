# -*- coding: utf-8 -*-
"""Why people leave a format, and why they pick one.

A landing page whose only difference from its neighbour is the format name is a
doorway page, and Google treats it as one. Composing the "why convert" sentence
from a clause about the *source* and a clause about the *target* gives every one
of the 399 pairs its own sentence, built from things that are actually true of
those two formats rather than of their family.

LEAVING[x]  follows "because "  and describes the pain of staying on x.
ARRIVING[x] follows ", while "  and describes what x gives you.
NOTE[x]     is a practical caveat appended to "what to expect", when x has one.
"""

# --------------------------------------------------------------------- images
LEAVING = {
    'avif': 'AVIF makes remarkably small files, but older browsers, phones and photo editors still throw an error when they meet one',
    'bmp': 'BMP stores every pixel uncompressed, so the files are enormous for what they actually contain',
    'gif': 'GIF is stuck at 256 colours and balloons in size for anything longer than a few seconds',
    'heic': 'an iPhone saves photos as HEIC, and Windows, Android and most websites simply refuse to open them',
    'ico': 'ICO is a Windows icon container that ordinary image software treats as a curiosity rather than a picture',
    'icns': 'ICNS is a macOS icon bundle that nothing outside the Apple ecosystem knows how to read',
    'jpg': 'JPG discards a little more detail every time it is saved, and it cannot store a transparent background',
    'png': 'PNG keeps every pixel exactly, which makes photographs several times larger than they need to be',
    'svg': 'an SVG is code rather than pixels, so anything expecting a real image file rejects it',
    'tga': 'TGA survives mainly inside older games and 3D tools, and almost nothing else will open it',
    'tiff': 'TIFF is what scanners and print shops produce, and browsers and messaging apps will not display it',
    'webp': 'WebP saves real space on the web, but desktop software and older devices often cannot open it',
    # ------------------------------------------------------------- documents
    'docx': 'a DOCX needs Word or something compatible, and the layout shifts depending on which program opens it',
    'epub': 'EPUB is built for e-readers, so it reflows differently in every app and prints badly',
    'html': 'an HTML file is a web page rather than a document, dependent on a browser and on the files it links to',
    'md': 'Markdown is plain text with punctuation standing in for formatting, which reads as noise to anyone not expecting it',
    'odt': 'ODT is LibreOffice’s format, and colleagues working in Word often cannot open it cleanly',
    'pdf': 'a PDF is a picture of a finished page, which is exactly what makes editing one so awkward',
    'rtf': 'RTF is an old interchange format that modern editors support only loosely',
    'txt': 'plain text carries no headings, bold, tables or pictures whatsoever',
    # ------------------------------------------------------------ spreadsheets
    'csv': 'a CSV is only text with commas in it, holding no formulas, no formatting and no second sheet',
    'ods': 'ODS is LibreOffice’s spreadsheet format, and Excel users regularly cannot open it',
    'tsv': 'a TSV is plain text split by tab characters, which almost nobody recognises as a spreadsheet',
    'xls': 'XLS is Excel’s pre-2007 format, and current tools treat it as legacy baggage',
    'xlsx': 'an XLSX needs a spreadsheet program, and plenty of systems accept nothing but plain text',
    # -------------------------------------------------------------- structured
    'json': 'JSON is written for programs to parse, not for people to read',
    'sql': 'a SQL dump is just a list of statements, useless until a database actually runs it',
    'toml': 'TOML is a configuration format, not something most tools offer to import',
    'xml': 'XML is verbose and heavy for the amount of data it actually carries',
    'yaml': 'YAML depends on exact indentation, which breaks the moment somebody edits it carelessly',
    # ------------------------------------------------------------------ audio
    'aac': 'AAC is bare compressed audio that some older players and car stereos will not recognise',
    'flac': 'FLAC keeps every bit of the original, which makes the files several times larger than they need to be',
    'm4a': 'M4A is Apple’s audio wrapper, and plenty of players skip straight past it',
    'mp3': 'MP3 has already thrown detail away, and newer platforms increasingly prefer more efficient codecs',
    'ogg': 'Ogg Vorbis is well supported on the web and poorly supported on phones and hi-fi equipment',
    'opus': 'Opus sounds excellent at low bitrates, but older devices have never heard of it',
    'wav': 'WAV is completely uncompressed, so a few minutes of sound runs to tens of megabytes',
    # ------------------------------------------------------------------ video
    'm4v': 'M4V is Apple’s MP4 variant, and some players refuse it on sight because of the extension alone',
    'mov': 'MOV is QuickTime’s container, which iPhones and Macs produce and other devices frequently will not play',
    'mp4': 'MP4 plays nearly everywhere, but not inside every editor, browser or upload form',
    'webm': 'WebM is a web-first container that desktop video software and phones regularly reject',
    # --------------------------------------------------------------------- 3D
    'glb': 'a GLB packs an entire scene into one binary file that cannot be opened and edited as text',
    'gltf': 'a glTF scene is split across a JSON file and its buffers, so pieces go missing whenever it is moved',
    'obj': 'OBJ is decades old, keeps its materials in a second file and knows nothing about animation',
    'ply': 'PLY comes out of 3D scanners, and few engines or viewers accept it directly',
    'stl': 'STL describes bare triangles with no colour, texture or material at all',
    # ------------------------------------------------------------------ fonts
    'otf': 'OTF is a desktop font format that browsers accept only grudgingly, at full file size',
    'ttf': 'TTF is built for installing on a computer, not for downloading on every single page view',
    'woff': 'WOFF is compressed specifically for the web, so desktop font menus ignore it completely',
    # --------------------------------------------------------------- archives
    'gz': 'a .gz holds exactly one compressed file and cannot carry a folder',
    'tar': 'a .tar bundles files together without compressing them at all',
    'tgz': 'a .tar.gz takes two steps to unpack, and Windows has no built-in support for it',
    'zip': 'ZIP is universal but compresses less tightly than the formats built for the job',
}

ARRIVING = {
    'avif': 'AVIF cuts the same picture to a fraction of the size with no visible loss',
    'bmp': 'BMP is the plainest possible bitmap, which old software and hardware accept without complaint',
    'gif': 'GIF plays a short animation anywhere — in any chat window, forum post or email',
    'heic': 'HEIC stores the same photograph at roughly half the size',
    'ico': 'ICO is what Windows icons and browser favicons actually require',
    'icns': 'ICNS is what macOS needs before it will show an application icon at all',
    'jpg': 'JPG opens on essentially every device built in the last thirty years',
    'png': 'PNG keeps every pixel exact and supports a genuinely transparent background',
    'svg': 'SVG stays razor sharp at any size because it stores shapes rather than pixels',
    'tga': 'TGA is what a number of game engines and older 3D tools still expect',
    'tiff': 'TIFF is what print shops, archives and scanning workflows ask for by name',
    'webp': 'WebP is typically 25–35% smaller than the same picture as JPG or PNG',
    'docx': 'a DOCX can be edited, tracked and commented on by anyone with Word',
    'epub': 'EPUB reflows to fit any e-reader screen and remembers where you stopped reading',
    'html': 'HTML can be published on the web or opened in any browser on any device',
    'md': 'Markdown is plain text that stays readable forever and drops into every notes and code tool',
    'odt': 'ODT is an open standard that will still open decades from now',
    'pdf': 'a PDF looks identical on every screen and printer and cannot be edited by accident',
    'rtf': 'RTF opens in every word processor ever written, down to the most basic ones',
    'txt': 'plain text is the one format every program on earth can read',
    'csv': 'CSV imports into every spreadsheet, database and analytics tool ever written',
    'ods': 'ODS is an open standard that LibreOffice and Google Sheets handle natively',
    'tsv': 'tab characters never clash with the commas inside your data, so TSV survives messy text',
    'xls': 'XLS is what older Excel installations and legacy business systems still require',
    'xlsx': 'XLSX gives you real cells, number formats and multiple sheets in Excel',
    'json': 'JSON is what APIs, JavaScript and practically every modern language speak natively',
    'sql': 'a SQL file loads straight into a database with a single command',
    'toml': 'TOML is unambiguous and genuinely pleasant to edit by hand',
    'xml': 'XML is what enterprise systems, feeds and older APIs still demand',
    'yaml': 'YAML is the most readable of the data formats and the one most config tools expect',
    'aac': 'AAC sounds better than MP3 at the same bitrate and plays on every Apple device',
    'flac': 'FLAC is lossless, so the result is a bit-perfect copy of the original sound',
    'm4a': 'M4A is what iTunes, iPhones and Apple Music expect to be handed',
    'mp3': 'MP3 plays on literally every device that has a speaker',
    'ogg': 'Ogg Vorbis is free of patents and supported by browsers and game engines alike',
    'opus': 'Opus beats every other codec at low bitrates, which is why calls and podcasts use it',
    'wav': 'WAV is raw, uncompressed audio that every editor and DAW imports without fuss',
    'm4v': 'M4V is the container Apple’s own players prefer to be given',
    'mov': 'MOV is what Final Cut, QuickTime and iPhone editing workflows expect',
    'mp4': 'MP4 with H.264 plays on phones, TVs, browsers and every video editor',
    'webm': 'WebM streams efficiently in browsers and carries no licensing baggage',
    'glb': 'a GLB is one self-contained file, which is exactly what AR viewers and the web want',
    'gltf': 'glTF is readable JSON you can inspect and edit before shipping it',
    'obj': 'OBJ is understood by practically every 3D program ever released',
    'ply': 'PLY carries per-vertex colour, which suits scanned and point-cloud data',
    'stl': 'STL is the format every 3D printer and slicer accepts',
    'otf': 'OTF installs on Windows, macOS and Linux and carries advanced typographic features',
    'ttf': 'TTF installs on any computer with a double-click',
    'woff': 'WOFF is compressed for the web and makes the page load measurably faster',
    'gz': 'gzip is the compression the entire internet already speaks',
    'tar': 'a .tar preserves a whole folder tree, permissions included, in a single file',
    'tgz': 'a .tar.gz is the standard way to ship a folder on Linux and macOS',
    'zip': 'a ZIP opens with a double-click on Windows, macOS and every phone',
}

# Appended to "what to expect" when the target format has a real gotcha.
NOTE = {
    'ico': 'Windows icons are capped at 256×256, so a larger picture is scaled down to fit.',
    'icns': 'macOS icons are square, so a picture that is not square is fitted inside one.',
    'gif': 'GIF holds only 256 colours per frame, so dithering is on by default to keep gradients smooth.',
    'jpg': 'JPG has no transparency, so any transparent area is flattened onto white.',
    'bmp': 'BMP is uncompressed, so expect the result to be considerably larger than the original.',
    'wav': 'WAV is uncompressed, so expect roughly 10 MB per minute of stereo sound.',
    'flac': 'FLAC is lossless but cannot restore detail an MP3 or AAC already discarded.',
    'stl': 'STL stores geometry only, so colours, textures and materials are dropped.',
    'csv': 'A CSV holds one sheet of values, so formulas, formatting and extra sheets do not come across.',
    'txt': 'Plain text keeps the words and drops every heading, table and picture.',
    'svg': 'A photograph placed in an SVG stays a photograph; it does not become editable vector shapes.',
    'gz': 'gzip compresses a single file, so several files are bundled into a .tar.gz instead.',
}


def why(f, t, fallback):
    """The pair-specific "why convert" sentence, or `fallback` if either end is
    undocumented."""
    a, b = LEAVING.get(f), ARRIVING.get(t)
    if not a or not b:
        return fallback
    return 'People convert %s to %s because %s, while %s.' % (f.upper(), t.upper(), a, b)


# Appended to "what to expect" when the SOURCE format has its own quirk. Without
# this, every "* to ICO" page would describe only what ICO does.
FROM_NOTE = {
    'heic': 'HEIC photos carry their orientation as metadata, which is applied before conversion so the picture is never sideways.',
    'pdf': 'A PDF made by scanning holds a picture of a page rather than text, so there is nothing to extract from it without OCR.',
    'svg': 'An SVG has no fixed size, so pick the width you want before converting and it is rendered sharply at that scale.',
    'gif': 'An animated GIF has many frames; converting to a still format keeps the first one.',
    'tiff': 'Multi-page TIFFs are common from scanners — each page comes out as its own file.',
    'ico': 'An ICO can hold several sizes at once, and the largest one is the one converted.',
    'mp3': 'MP3 is already lossy, so detail it discarded cannot be recovered by converting.',
    'aac': 'AAC is already lossy, so converting cannot restore what the original encoder threw away.',
    'docx': 'A DOCX keeps its pictures inside the file, so they travel across with the text.',
    'xlsx': 'Only cell values cross over, not formulas — what you see in the sheet is what you get.',
    'xls': 'Only cell values cross over, not formulas or macros.',
    'csv': 'Delimiters and quoting are detected automatically, including fields that contain commas.',
    'json': 'Nested objects are flattened into columns using dotted names, so nothing is silently dropped.',
    'mov': 'iPhone MOV files are usually H.264 or HEVC already, so the picture quality survives the trip.',
    'webm': 'WebM from a browser recording often has no duration in its header; it is measured during conversion.',
    'stl': 'An STL has no colour or texture, so the result is untextured geometry.',
    'ply': 'A PLY from a scanner may carry per-vertex colour, which is kept where the target supports it.',
    'obj': 'OBJ keeps its materials in a separate .mtl file, which is not read here — geometry converts, materials do not.',
    'flac': 'FLAC is lossless, so this is the best possible starting point for any conversion.',
    'wav': 'WAV is uncompressed, so the source is pristine and only the target format decides the quality.',
    'zip': 'The archive is repacked, not re-compressed file by file, so the contents are untouched.',
}
