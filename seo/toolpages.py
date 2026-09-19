# -*- coding: utf-8 -*-
"""The stand-alone tool pages: what each one is called, what it promises, and
the questions people ask about it. build.py turns these into /<slug>/ pages
that carry the converter's shell plus <meta name="cf-tool">, which tools.js
picks up.

Titles stay under 60 characters. Every FAQ doubles as FAQPage schema.
"""

NOTHING = 'Nothing is uploaded: the work happens inside your browser, on your own device.'

TOOLS = [
    dict(slug='compress-image', group='image', name='Compress image to a size',
         title='Compress Image to 50 KB, 100 KB or 200 KB — Free Online',
         h1='Compress image to an exact size',
         desc='Compress a JPG or PNG to 20 KB, 50 KB, 100 KB or any size you need for a form. Free, in your browser, nothing uploaded.',
         intro='Type the size a form asks for — 50 KB, 100 KB, 200 KB — and get a picture at or under it. The tool finds the highest quality that fits, shrinking the pixels only when it has to. ' + NOTHING,
         steps=[('Drop your photo', 'JPG, PNG, WebP, HEIC and most other image formats work. You can add several at once.'),
                ('Set the target size', 'Type it in KB, or tap one of the quick sizes. The presets fill in what common exam and government forms ask for.'),
                ('Compress and download', 'Each result shows the before and after size. Download one, or all of them as a zip.')],
         faq=[('How do I compress an image to 50 KB?', 'Drop the image, type 50 in the target box and press Compress. The tool tries JPEG qualities from high to low and, if the picture is still too large at the lowest sensible quality, scales it down a little and tries again until it fits under 50 KB.'),
              ('Will it look bad?', 'Rarely. Photographs compress remarkably well — a phone picture of several megabytes is usually fine at 100 KB. Very small targets like 20 KB force a smaller picture, which is what those forms expect anyway.'),
              ('Does it work for PNG?', 'Yes. PNG is lossless, so the only way to make one smaller is to reduce its pixels; choose PNG as the output if you must keep it as PNG, or leave the output on Auto to get a much smaller JPG or WebP.'),
              ('What sizes do Indian exam forms want?', 'They vary, so check your form. Common requirements are a JPG photo of 20–50 KB at roughly 3.5×4.5 cm and a signature of 10–20 KB. The presets on this page match those, and the passport photo tool crops to the exact shape.'),
              ('Is the image uploaded anywhere?', 'No. Compression runs in your browser using your device. Nothing is sent, stored or seen by anyone.')],
         related=['resize-image', 'passport-photo', 'compress-pdf', 'crop-image']),

    dict(slug='compress-pdf', group='pdf', name='Compress PDF to a size',
         title='Compress PDF to 100 KB, 200 KB or 500 KB — Free Online',
         h1='Compress PDF to an exact size',
         desc='Compress a PDF to 100 KB, 200 KB, 500 KB or 1 MB for an upload limit. Free, in your browser, nothing uploaded.',
         intro='Forms and portals reject PDFs over a limit. Set the size you need and get a PDF under it. Strong compression re-renders pages as pictures, which is what makes big reductions possible; light compression keeps the text selectable. ' + NOTHING,
         steps=[('Drop the PDF', 'Scanned documents, photo PDFs and ordinary text PDFs all work.'),
                ('Choose the size and method', 'Type the limit in KB. Use Strong for scans and picture-heavy files; Light when the text must stay selectable.'),
                ('Compress and download', 'The result shows the new size. If a target is unreachable without making pages unreadable, you get the smallest readable version and a note saying so.')],
         faq=[('How do I compress a PDF to 200 KB?', 'Drop the file, type 200, keep Strong compression and press the button. Each page is redrawn as a JPEG at a resolution and quality chosen to bring the whole file under 200 KB.'),
              ('Why can I no longer select the text afterwards?', 'Strong compression turns each page into a picture, because that is the only way to shrink a scan or a photo-heavy PDF dramatically. If you need the text, use Light compression — it keeps the text but cannot shrink pictures much.'),
              ('Why did Light compression barely change the size?', 'It rewrites the file structure and removes duplicate objects. That helps files made by careless software, but a PDF that is mostly pictures is already as small as those pictures are.'),
              ('Is there a page limit?', 'No fixed limit, but a very long document takes a while because every page is rendered on your device. A hundred pages is fine; a thousand-page book will take a few minutes.'),
              ('Is my PDF uploaded?', 'No. The PDF is read and rewritten entirely inside your browser.')],
         related=['compress-image', 'merge-pdf', 'split-pdf', 'images-to-pdf']),

    dict(slug='passport-photo', group='image', name='Passport photo maker',
         title='Passport Size Photo Maker — 35×45 mm, 2×2 in, Free Online',
         h1='Passport size photo maker',
         desc='Make a passport size photo online: crop to 35×45 mm, 2×2 inch or any size, under 50 KB if needed, plus a printable 4×6 sheet. Free, nothing uploaded.',
         intro='Crop any photo to the exact passport, visa or exam-form size, at print resolution, with a guide for where the head should sit. Get the single photo for online forms and a 4×6 inch sheet of copies for printing. ' + NOTHING,
         steps=[('Drop a photo', 'A phone picture against a plain, light wall is ideal. Face the camera straight on with a neutral expression.'),
                ('Frame it', 'Pick the size your form wants. Drag the picture and zoom until the head fills the dotted guide, roughly 70% of the frame.'),
                ('Download', 'You get the photo at the exact size, optionally under the KB limit a form asks for, and a print sheet with several copies and cutting lines.')],
         faq=[('What size is a passport photo in India?', '35 × 45 mm, with the face taking up most of the frame. Most Indian forms — passport, PAN, exams, visas — ask for this size, and it is the default here.'),
              ('What about the USA?', '2 × 2 inches (51 × 51 mm), with the head between 1 and 1⅜ inches high. Choose the USA preset.'),
              ('Can it change the background to white?', 'No. This tool crops and sizes; it does not edit the picture. Photograph against a plain white or light wall and the result is accepted by nearly every form.'),
              ('How do I print it?', 'Download the 4×6 inch sheet and print it at 100% size (no "fit to page") on photo paper at any photo shop or on a home printer. Cut along the grey lines.'),
              ('Can I keep the file under 50 KB?', 'Yes. Set the maximum file size and the photo is saved at the highest quality that stays under it.')],
         related=['compress-image', 'crop-image', 'resize-image', 'remove-exif']),

    dict(slug='resize-image', group='image', name='Resize image',
         title='Resize Image Online — Pixels, Percent or Presets, Free',
         h1='Resize image online',
         desc='Resize an image to exact pixels, a percentage, or a preset like Instagram, YouTube thumbnail or passport size. Free, in your browser, nothing uploaded.',
         intro='Set a width, a height, a percentage or a preset. Fit inside the size, fill it exactly, rotate or mirror on the way. Several images at once, all done on your device. ' + NOTHING,
         steps=[('Drop the images', 'One or many. Every common format is fine, including HEIC from an iPhone.'),
                ('Choose the size', 'Type the pixels, pick a percentage, or choose a preset. Leave the height at 0 to keep the proportions.'),
                ('Resize and download', 'Each result shows the old and new dimensions.')],
         faq=[('How do I resize an image without stretching it?', 'Type only the width (leave height at 0) and the height follows automatically. If you give both, choose "Fit inside" to avoid distortion or "Fill exactly" to crop to that exact shape.'),
              ('Can I resize to a file size in KB instead?', 'That is the compress tool: it picks the dimensions and quality that land under a KB target.'),
              ('Does resizing lose quality?', 'Making an image smaller keeps it sharp. Making it larger cannot add detail that is not there; it will look soft.'),
              ('What sizes do social networks use?', 'Instagram posts are 1080×1080, stories 1080×1920, YouTube thumbnails 1280×720, Facebook covers 820×312. They are all presets here.')],
         related=['crop-image', 'compress-image', 'passport-photo']),

    dict(slug='crop-image', group='image', name='Crop image',
         title='Crop Image Online — Square, 16:9, 4:3 or Custom, Free',
         h1='Crop image online',
         desc='Crop an image to a square, 16:9, 4:3, 9:16 or any ratio by dragging. Free, in your browser, nothing uploaded.',
         intro='Choose a ratio, drag the picture into the frame, zoom, and download the crop. ' + NOTHING,
         steps=[('Drop an image', 'Any format, any size.'), ('Frame the crop', 'Pick a ratio, drag to position, zoom with the slider or the mouse wheel.'), ('Download', 'The cropped area at its original pixels, or scaled to a width you set.')],
         faq=[('How do I crop a photo to a square?', 'Choose 1:1, drag the picture so the part you want is inside the frame, press Crop.'),
              ('Can I crop to an exact pixel size?', 'Set the ratio to match and enter the output width; the height follows from the ratio.'),
              ('Does cropping reduce quality?', 'No. The pixels inside the frame are kept exactly as they are unless you also scale the result.')],
         related=['resize-image', 'passport-photo', 'compress-image']),

    dict(slug='merge-pdf', group='pdf', name='Merge PDF',
         title='Merge PDF Files Online — Free, Nothing Uploaded',
         h1='Merge PDF files',
         desc='Combine several PDFs into one, in the order you choose. Free, no limits, in your browser — nothing uploaded.',
         intro='Drop the PDFs, put them in order, press Merge. The pages are copied into one new file without being re-rendered, so text, links and quality are untouched. ' + NOTHING,
         steps=[('Drop two or more PDFs', 'Add as many as you need.'), ('Set the order', 'Use the arrows on each row.'), ('Merge and download', 'One PDF, pages in that order.')],
         faq=[('Is there a limit on the number of files?', 'Up to 200 files at a time, of any size your device can hold in memory.'),
              ('Does merging reduce quality?', 'No. Pages are copied as they are; nothing is re-rendered or compressed.'),
              ('Can I merge images and PDFs together?', 'Convert the images first with the images-to-PDF tool, then merge the results.'),
              ('Are my PDFs uploaded?', 'No. The merge happens entirely inside your browser.')],
         related=['split-pdf', 'organize-pdf', 'images-to-pdf', 'compress-pdf']),

    dict(slug='split-pdf', group='pdf', name='Split PDF',
         title='Split PDF Online — by Pages or Ranges, Free',
         h1='Split a PDF',
         desc='Split a PDF into single pages, page ranges or fixed chunks. Free, in your browser, nothing uploaded.',
         intro='Every page as its own file, the ranges you type, or chunks of a fixed length. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Choose how to split', 'Every page, ranges like 1-3, 5, 8-10, or chunks of N pages.'), ('Download', 'Several files come as one zip.')],
         faq=[('How do I extract just a few pages?', 'Choose "Page ranges", type them (for example 2, 5-7) and tick "put the chosen pages into one PDF".'),
              ('Does the split PDF lose quality?', 'No. Pages are copied exactly.'),
              ('Can I split a very large PDF?', 'Yes, within what your device’s memory can hold. Hundreds of pages are fine.')],
         related=['merge-pdf', 'organize-pdf', 'rotate-pdf', 'compress-pdf']),

    dict(slug='rotate-pdf', group='pdf', name='Rotate PDF',
         title='Rotate PDF Online — All Pages or Some, Free',
         h1='Rotate PDF pages',
         desc='Rotate every page of a PDF, or only the pages you choose, by 90 or 180 degrees. Free, in your browser, nothing uploaded.',
         intro='Rotate the whole document, or type the pages that came out sideways. The rotation is saved in the file, so it opens the right way up everywhere. ' + NOTHING,
         steps=[('Drop the PDF', 'Several at once if you like.'), ('Choose the angle and pages', 'Leave pages empty to rotate everything.'), ('Download', '')],
         faq=[('Will the rotation stick when I open it elsewhere?', 'Yes. It is written into the page itself, not just shown in a viewer.'),
              ('Can I rotate only one page?', 'Yes — type its number in the pages box.'),
              ('Does rotating reduce quality?', 'No. Nothing is re-rendered.')],
         related=['organize-pdf', 'split-pdf', 'merge-pdf']),

    dict(slug='organize-pdf', group='pdf', name='Organise PDF pages',
         title='Reorder, Rotate or Delete PDF Pages Online — Free',
         h1='Reorder, rotate or delete PDF pages',
         desc='See every page as a thumbnail, then move, rotate or delete pages and save a new PDF. Free, in your browser, nothing uploaded.',
         intro='Every page appears as a thumbnail. Move pages with the arrows, rotate the sideways ones, cross out the ones to delete, and save. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Arrange the pages', 'Arrows move, the circle rotates, the cross deletes (press again to keep).'), ('Save the new PDF', '')],
         faq=[('How do I delete pages from a PDF?', 'Drop it here, press the cross on each page you want gone, then save. The other pages are copied exactly as they were.'),
              ('Can I move a page to the front?', 'Press the left arrow until it is first.'),
              ('Is the original changed?', 'No. You download a new file; the original stays as it was.')],
         related=['delete-pdf-pages', 'split-pdf', 'merge-pdf', 'rotate-pdf']),

    dict(slug='delete-pdf-pages', group='pdf', name='Delete PDF pages',
         title='Delete Pages from a PDF Online — Free, Nothing Uploaded',
         h1='Delete pages from a PDF',
         desc='Remove pages from a PDF by clicking their thumbnails, then save. Free, in your browser, nothing uploaded.',
         intro='Drop the PDF, cross out the pages you do not want, save. You can reorder and rotate the rest at the same time. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Cross out pages', 'Press the cross on each page to remove; press again to keep it.'), ('Save', '')],
         faq=[('Can I remove a blank page from a PDF?', 'Yes — find it in the thumbnails, cross it out and save.'),
              ('Does it re-compress the pages I keep?', 'No. They are copied without change.')],
         related=['organize-pdf', 'split-pdf', 'merge-pdf']),

    dict(slug='images-to-pdf', group='pdf', name='Images to one PDF',
         title='Combine Images into One PDF Online — Free',
         h1='Combine images into one PDF',
         desc='Turn several JPG, PNG or HEIC images into a single PDF, one page each, in the order you choose. Free, nothing uploaded.',
         intro='Photos of a document, scans from a phone, screenshots — drop them all and get one PDF with a page per image, on A4, Letter or pages that match the pictures. ' + NOTHING,
         steps=[('Drop the images', 'In any order; fix it with the arrows.'), ('Pick the page size and margin', 'A4 is right for most forms. "Same size as each image" keeps every pixel.'), ('Make the PDF', '')],
         faq=[('How do I make a PDF from photos on my phone?', 'Open this page on the phone, tap to choose the photos, order them and press the button. It works in Safari and Chrome without any app.'),
              ('Can I combine JPG and PNG in one PDF?', 'Yes, and HEIC, WebP and the rest too.'),
              ('Will the PDF be huge?', 'Images are stored as JPEG at the quality you set; 90% is visually lossless and keeps the file reasonable. Lower it, or compress the PDF afterwards, if there is an upload limit.')],
         related=['compress-pdf', 'merge-pdf', 'pdf-to-jpg']),

    dict(slug='image-to-text', group='other', name='Image to text (OCR)',
         title='Image to Text Converter — OCR Online, Free, Nothing Uploaded',
         h1='Image to text (OCR)',
         desc='Extract text from a photo, screenshot or scanned PDF in your browser. English, Hindi and 18 more languages. Free, nothing uploaded.',
         intro='Read the words out of a picture or a scan and copy them as text. The recognition runs on your device, so a private document stays private. ' + NOTHING,
         steps=[('Drop images or a scanned PDF', 'Straight, sharp, well-lit pictures read best.'), ('Choose the language', 'English is the default; Hindi and other Indian languages are available.'), ('Read and copy', 'The text appears in a box you can copy from or download.')],
         faq=[('Is this really free and unlimited?', 'Yes. The recognition engine runs in your browser, so there is no server cost to pass on and no page limit.'),
              ('Why is the first run slow?', 'The engine (about 4 MB) and the language file (2–15 MB) are downloaded into your browser the first time. After that they are cached.'),
              ('How accurate is it?', 'Printed text in a clear photo reads at close to 100%. Handwriting, tiny text and blurry pictures will contain mistakes — check the result before relying on it.'),
              ('Can it read Hindi?', 'Yes. Choose Hindi, or English + Hindi for mixed documents. Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi and Urdu are also available.'),
              ('Does the scanned PDF get uploaded?', 'No. Pages are rendered and read entirely on your device.')],
         related=['pdf-ocr', 'pdf-to-txt', 'compress-image']),

    dict(slug='pdf-ocr', group='other', name='PDF OCR',
         title='PDF OCR Online — Extract Text from a Scanned PDF, Free',
         h1='Extract text from a scanned PDF (OCR)',
         desc='Read the text in a scanned PDF and copy it, in your browser. English, Hindi and more. Free, nothing uploaded.',
         intro='A scanned PDF is a picture of a page. This reads the words off it, page by page, on your device. ' + NOTHING,
         steps=[('Drop the scanned PDF', 'Up to 50 pages at a time.'), ('Choose the language', ''), ('Read, copy or download', 'Page breaks are marked in the text.')],
         faq=[('Will it make my PDF searchable?', 'It gives you the text as a file you can copy or save. It does not write an invisible text layer back into the PDF.'),
              ('Why did a normal PDF come out badly?', 'If the PDF already contains real text, converting it to TXT or Word is faster and exact; OCR is for scans.'),
              ('Is anything uploaded?', 'No.')],
         related=['image-to-text', 'pdf-to-txt', 'pdf-to-docx']),

    dict(slug='trim-video', group='media', name='Trim video',
         title='Trim Video Online — Free, No Watermark, Nothing Uploaded',
         h1='Trim video online',
         desc='Cut a video to the part you want, with no watermark and no upload. Save as MP4 or WebM, in your browser.',
         intro='Pick the start and end, preview the selection, save it as MP4. No watermark, no sign-up, and the video never leaves your device. ' + NOTHING,
         steps=[('Drop the video', 'MP4, MOV from an iPhone, WebM and most others.'), ('Set the start and end', 'Play to a point and press "Start here" or "End here", or type the times.'), ('Trim and save', 'The selection is re-encoded on your device.')],
         faq=[('Is there really no watermark?', 'None. There is nothing to pay for either.'),
              ('Why does it take a while?', 'Every frame in the selection is decoded and re-encoded on your own machine. A one-minute clip takes roughly a minute. Keep the tab in front.'),
              ('Does trimming lose quality?', 'It is re-encoded, so very slightly. At the default quality the difference is not visible.'),
              ('Can I remove the sound?', 'Yes, tick "Remove the sound".'),
              ('What is the size limit?', 'Clips up to 15 minutes; longer ones do not fit in a browser tab’s memory.')],
         related=['mp4-to-gif', 'mov-to-mp4', 'mp3-cutter', 'mp4-to-mp3']),

    dict(slug='mp3-cutter', group='media', name='MP3 cutter',
         title='MP3 Cutter Online — Cut Audio, Make a Ringtone, Free',
         h1='MP3 cutter and ringtone maker',
         desc='Cut an MP3 or any audio to the part you want, add a fade, save as MP3 or WAV. Free, in your browser, nothing uploaded.',
         intro='Drag the handles on the waveform, play the selection, add a fade in or out, save. Works with MP3, M4A, WAV, FLAC and the sound from a video. ' + NOTHING,
         steps=[('Drop the audio', 'Or a video — only its sound is used.'), ('Select the part', 'Drag the yellow handles or type the times. "30 s ringtone" sets a 30-second selection.'), ('Cut and save', 'MP3 at the bitrate you choose, or WAV.')],
         faq=[('How do I make a ringtone?', 'Select up to 30 seconds and save as MP3. On Android, put the file in the Ringtones folder or pick it in Settings › Sound. iPhone needs the clip added through iTunes/Finder or GarageBand.'),
              ('Does cutting an MP3 lose quality?', 'It is decoded and re-encoded, so a little. Saving at 256 or 320 kbps keeps it inaudible.'),
              ('Can I join two clips?', 'Not here yet. Cut each, then convert the pieces as needed.')],
         related=['ringtone-maker', 'trim-video', 'mp4-to-mp3', 'wav-to-mp3']),

    dict(slug='ringtone-maker', group='media', name='Ringtone maker',
         title='Ringtone Maker Online — Cut Any Song to 30 s, Free',
         h1='Ringtone maker',
         desc='Cut any song to a 30-second ringtone, add a fade, save as MP3. Free, in your browser, nothing uploaded.',
         intro='Drop a song, move the selection to the part you like, press the 30-second button, save. ' + NOTHING,
         steps=[('Drop the song', ''), ('Choose the 30 seconds', 'Drag the start handle to where the good part begins and press "30 s ringtone".'), ('Save as MP3', '')],
         faq=[('How do I set it as a ringtone on Android?', 'Save the MP3, then Settings › Sound › Phone ringtone › add from files, or copy it into the Ringtones folder.'),
              ('And on iPhone?', 'iPhone does not accept MP3 ringtones directly. Save the clip, then add it through GarageBand or iTunes/Finder as a tone.')],
         related=['mp3-cutter', 'trim-video', 'mp4-to-mp3']),

    dict(slug='remove-exif', group='image', name='Remove EXIF / metadata',
         title='Remove EXIF Data from Photos Online — Free, Private',
         h1='View and remove photo metadata (EXIF)',
         desc='See the hidden metadata in a photo — camera, date, GPS location — and remove it without re-encoding. Free, in your browser, nothing uploaded.',
         intro='Photos carry the camera model, the date and often the exact GPS location of where they were taken. See what yours reveal, then strip it. JPEG, PNG and WebP are cleaned without touching the picture itself. ' + NOTHING,
         steps=[('Drop the photos', 'The metadata is shown at once, including any location.'), ('Check what is there', 'A red GPS line means the photo says where it was taken.'), ('Remove and download', 'The picture is identical; the data is gone.')],
         faq=[('Does removing EXIF reduce image quality?', 'Not for JPEG, PNG or WebP — the metadata segments are cut out and the image data is copied byte for byte. Other formats are re-saved as JPEG at high quality.'),
              ('Why is the file only slightly smaller?', 'Metadata is usually a few kilobytes; an embedded preview thumbnail can be tens. The picture itself is unchanged, so the size mostly is too.'),
              ('Does WhatsApp remove EXIF?', 'WhatsApp and most social networks strip it on upload, but email, cloud drives and many websites do not. Cleaning it yourself is the only way to be sure.'),
              ('Will my photo appear rotated afterwards?', 'No. If the photo relied on an orientation tag, it is re-saved the right way up so it still displays correctly.')],
         related=['view-metadata', 'compress-image', 'heic-to-jpg']),

    dict(slug='view-metadata', group='image', name='View photo metadata',
         title='View Photo Metadata Online — EXIF, GPS, Camera, Free',
         h1='View photo metadata',
         desc='See the EXIF data in a photo: camera, lens, settings, date and GPS location. In your browser, nothing uploaded.',
         intro='Drop a photo and see everything it records about itself. Remove it in one click if you like. ' + NOTHING,
         steps=[('Drop a photo', ''), ('Read the data', 'Camera, lens, exposure, date, software and location if present.'), ('Optionally remove it', '')],
         faq=[('Where is the GPS location shown?', 'In red, with a map link, when the photo has one. Photos from phones often do unless location tagging is off.'),
              ('Can I edit the metadata?', 'Not here — only view and remove.')],
         related=['remove-exif', 'compress-image']),

    dict(slug='qr-code-generator', group='other', name='QR code generator',
         title='QR Code Generator — Free, No Sign-up, UPI, Wi-Fi, vCard',
         h1='QR code generator',
         desc='Make a QR code for a link, UPI payment, Wi-Fi network, contact card, email or phone. Download as PNG or SVG. Free, no sign-up, no tracking.',
         intro='Type what the code should hold and it appears as you type. Download a sharp PNG or an SVG for print. Codes are made in your browser; nothing is stored, and the code never expires because there is no redirect service behind it. ' + NOTHING,
         steps=[('Choose what kind of code', 'Link, UPI payment, Wi-Fi, contact card, email, phone or SMS.'), ('Fill in the details', 'The preview updates live.'), ('Download', 'PNG at the size you choose, or SVG.')],
         faq=[('Is the QR code free forever?', 'Yes. It encodes your data directly, so there is no subscription and nothing that can expire or be switched off.'),
              ('How do I make a UPI payment QR code?', 'Choose UPI, enter your UPI ID and name, optionally an amount. The code opens any UPI app with the payment ready.'),
              ('Which size should I download?', '512 px is enough for a screen or a leaflet; use 2048 px or the SVG for posters and print.'),
              ('Can I add a logo?', 'Not here. If you overlay one yourself, choose error correction H so the code still scans.'),
              ('Is my data stored?', 'No. Nothing is sent anywhere; the code is drawn in your browser.')],
         related=['compress-image', 'png-to-svg']),

    dict(slug='unzip', group='other', name='Unzip online',
         title='Unzip Files Online — Open ZIP, TAR, GZ in Your Browser, Free',
         h1='Unzip files online',
         desc='Open a ZIP, TAR or GZ archive in your browser, see what is inside and download the files you want. Free, nothing uploaded.',
         intro='Drop the archive, tick the files, download them one by one or as a smaller zip. Nothing is extracted on a server — it all happens on your device. ' + NOTHING,
         steps=[('Drop the archive', '.zip, .tar, .tgz or .gz.'), ('Pick the files', 'Everything is ticked by default.'), ('Download', 'A single file directly; several as a zip of just those.')],
         faq=[('Can I open a zip on my phone with this?', 'Yes. Open this page in the phone’s browser, choose the zip from Files, and download what you need.'),
              ('Is there a size limit?', 'Whatever your device can hold in memory — a few hundred megabytes is fine on most phones and laptops.'),
              ('Does it handle password-protected zips?', 'Not yet.'),
              ('Is the archive uploaded?', 'No. It is opened in your browser.')],
         related=['zip-to-tar', 'tar-to-zip', 'compress-pdf']),

    dict(slug='sign-pdf', group='pdf', name='Sign PDF',
         title='Sign a PDF Online — Draw or Type a Signature, Free',
         h1='Sign a PDF',
         desc='Draw, type or upload a signature and place it on any page of a PDF. Free, in your browser — the document is never uploaded.',
         intro='Draw your signature with a mouse or finger, type it, or upload a picture of it; drag it into place on the page; save. The contract, form or letter stays on your device throughout. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Make your signature', 'Draw it, type your name, or upload a photo of your signature on white paper.'), ('Place it and save', 'Choose the page, drag the signature where it belongs, adjust the size, save.')],
         faq=[('Is a drawn signature legally valid?', 'In most countries an electronic signature is valid for ordinary agreements when both sides intend it to be. Some documents — property, wills, certain government forms — need specific procedures. This tool adds an image; it does not create a cryptographic certificate.'),
              ('Can I sign more than one page?', 'Place the signature and save, then drop the saved file back in and sign the next page.'),
              ('Is my document uploaded?', 'No. That is the point of doing it here: the PDF is opened, signed and saved entirely in your browser.'),
              ('Can I add the date?', 'Tick the date option and today’s date is written under the signature.')],
         related=['merge-pdf', 'compress-pdf', 'organize-pdf']),
]

GROUPS = [('image', 'Image tools'), ('pdf', 'PDF tools'), ('media', 'Audio & video'), ('other', 'Other tools')]

# The home page lists every tool, most used first. Until the counters have
# something to say, this is the order — by search demand, most to least.
RAIL_ORDER = ['compress-image', 'compress-pdf', 'passport-photo', 'merge-pdf', 'image-to-text', 'resize-image',
              'images-to-pdf', 'split-pdf', 'sign-pdf', 'crop-image', 'qr-code-generator', 'remove-exif', 'trim-video',
              'mp3-cutter', 'pdf-ocr', 'organize-pdf', 'delete-pdf-pages', 'rotate-pdf', 'unzip', 'ringtone-maker', 'view-metadata']
GROUP_FAM = {'image': 'image', 'pdf': 'doc', 'media': 'video', 'other': 'data'}

# /compress-image-to-50kb/ and friends: the same tool, preset, with its own copy
KB_PAGES = {
    'compress-image': [20, 50, 100, 200, 500],
    'compress-pdf': [100, 200, 500, 1024],
}


def kb_label(kb):
    return '1 MB' if kb == 1024 else '%d KB' % kb


def kb_page(base, kb):
    """A landing page for one fixed size target."""
    lab = kb_label(kb)
    kind = 'image' if base['slug'] == 'compress-image' else 'PDF'
    d = dict(base)
    d['slug'] = '%s-to-%s' % (base['slug'], '1mb' if kb == 1024 else '%dkb' % kb)
    d['preset'] = {'kb': kb}
    d['parent'] = base['slug']
    if kind == 'image':
        d['title'] = 'Compress Image to %s Online — Free, Nothing Uploaded' % lab
        d['h1'] = 'Compress image to %s' % lab
        d['desc'] = 'Reduce a JPG or PNG to under %s for a form or upload, at the best quality that fits. Free, in your browser, nothing uploaded.' % lab
        d['intro'] = ('Drop the picture and it comes back under %s — the target is already set. The tool keeps the highest quality that fits and only '
                      'shrinks the pixels if it has to. ' % lab) + NOTHING
        d['faq'] = [('How do I reduce a photo to %s?' % lab, 'Drop it above; %s is already set as the target. Press Compress and download the result. Several photos can be done at once.' % lab),
                    ('Will a %s image still look good?' % lab, {20: 'At 20 KB the picture has to be small — a few hundred pixels across — which is exactly what forms asking for 20 KB expect, such as a signature or a thumbnail photo.',
                                                              50: 'Yes for a photo of a face or a document: 50 KB holds a sharp picture around 600 pixels wide, which is what passport-style uploads want.',
                                                              100: 'Yes. 100 KB holds a clear picture around 1000 pixels wide, fine for any form and most web use.',
                                                              200: 'Comfortably. 200 KB is enough for a full-screen photo at good quality.',
                                                              500: 'Easily. 500 KB is a large, high-quality image; only the biggest camera files need any visible compression to reach it.'}[kb]),
                    ('What if the form also wants specific dimensions?', 'Use the presets on the page (exam photo, signature, passport) or the passport photo tool for an exact crop; then the size target is applied on top.'),
                    ('Is the picture uploaded?', 'No. Everything runs in your browser.')]
        d['related'] = [base['slug'] + ('-to-%s' % ('1mb' if k == 1024 else '%dkb' % k)) for k in KB_PAGES['compress-image'] if k != kb] + ['passport-photo', 'resize-image']
    else:
        d['title'] = 'Compress PDF to %s Online — Free, Nothing Uploaded' % lab
        d['h1'] = 'Compress PDF to %s' % lab
        d['desc'] = 'Shrink a PDF to under %s for an upload limit, in your browser. Free, nothing uploaded.' % lab
        d['intro'] = ('Drop the PDF and get it back under %s — the target is preset. Strong compression redraws pages to fit; light compression keeps the text selectable. ' % lab) + NOTHING
        d['faq'] = [('How do I compress a PDF to %s?' % lab, 'Drop it above with %s already set, keep Strong compression for scans and picture PDFs, press the button and download.' % lab),
                    ('Will the text still be readable?', 'Yes. Pages are redrawn at the resolution needed to hit %s; if that would make them unreadable you get the smallest readable version and a note instead.' % lab),
                    ('Can I keep the text selectable?', 'Choose Light compression. It keeps the text but cannot shrink pictures much, so a scan may not reach %s that way.' % lab),
                    ('Is the PDF uploaded?', 'No.')]
        d['related'] = [base['slug'] + ('-to-%s' % ('1mb' if k == 1024 else '%dkb' % k)) for k in KB_PAGES['compress-pdf'] if k != kb] + ['merge-pdf', 'images-to-pdf']
    return d


def all_pages():
    out = []
    by = {t['slug']: t for t in TOOLS}
    for t in TOOLS:
        out.append(t)
        for kb in KB_PAGES.get(t['slug'], []):
            out.append(kb_page(t, kb))
    return out
