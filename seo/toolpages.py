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
         title='Free Image Compressor — to 50 KB, 100 KB, 200 KB Online',
         h1='Free image compressor: to an exact KB size',
         desc='Compress a JPG or PNG to 20 KB, 50 KB, 100 KB or any size you need for a form. Free, in your browser, nothing uploaded.',
         intro='Type the size a form asks for — 50 KB, 100 KB, 200 KB — and get a picture at or under it. The tool finds the highest quality that fits, shrinking the pixels only when it has to. ' + NOTHING,
         steps=[('Drop your photo', 'JPG, PNG, WebP, HEIC and most other image formats work. You can add several at once.'),
                ('Set the target size', 'Type it in KB, or tap one of the quick sizes. The presets fill in what common exam and government forms ask for.'),
                ('Compress and download', 'Each result shows the before and after size. Download one, or all of them as a zip.')],
         faq=[('How do I compress an image to 50 KB?', 'Drop the image, type 50 in the target box and press Compress. The tool tries JPEG qualities from high to low and, if the picture is still too large at the lowest sensible quality, scales it down a little and tries again until it fits under 50 KB.'),
              ('Will it look bad?', 'Rarely. Photographs compress remarkably well — a phone picture of several megabytes is usually fine at 100 KB. Very small targets like 20 KB force a smaller picture, which is what those forms expect anyway.'),
              ('Does it work for PNG?', 'Yes. PNG is lossless, so the only way to make one smaller is to reduce its pixels; choose PNG as the output if you must keep it as PNG, or leave the output on Auto to get a much smaller JPG or WebP.'),
              ('What sizes do Indian exam forms want?', 'They vary, so check your form. Common requirements are a JPG photo of 20–50 KB at roughly 3.5×4.5 cm and a signature of 10–20 KB. The presets on this page match those, and the passport photo tool crops to the exact shape.'),
              ('Is the image uploaded anywhere?', 'No. Compression runs in your browser, using your own device’s processor, and the image never leaves it. Nothing is sent, stored or seen by anyone, and there is no copy on a server to delete afterwards. You can watch this yourself in your browser’s Network tab while you compress.')],
         related=['resize-image', 'passport-photo', 'compress-pdf', 'crop-image']),

    dict(slug='compress-pdf', group='pdf', name='Compress PDF to a size',
         title='Free PDF Compressor — to 100 KB, 200 KB, 500 KB Online',
         h1='Free PDF compressor: to an exact KB size',
         desc='Compress a PDF to 100 KB, 200 KB, 500 KB or 1 MB for an upload limit. Free, in your browser, nothing uploaded.',
         intro='Forms and portals reject PDFs over a limit. Set the size you need and get a PDF under it. Strong compression re-renders pages as pictures, which is what makes big reductions possible; light compression keeps the text selectable. ' + NOTHING,
         steps=[('Drop the PDF', 'Scanned documents, photo PDFs and ordinary text PDFs all work.'),
                ('Choose the size and method', 'Type the limit in KB. Use Strong for scans and picture-heavy files; Light when the text must stay selectable.'),
                ('Compress and download', 'The result shows the new size. If a target is unreachable without making pages unreadable, you get the smallest readable version and a note saying so.')],
         faq=[('How do I compress a PDF to 200 KB?', 'Drop the file, type 200, keep Strong compression and press the button. Each page is redrawn as a JPEG at a resolution and quality chosen to bring the whole file under 200 KB.'),
              ('Why can I no longer select the text afterwards?', 'Strong compression turns each page into a picture, because that is the only way to shrink a scan or a photo-heavy PDF dramatically. If you need the text, use Light compression — it keeps the text but cannot shrink pictures much.'),
              ('Why did Light compression barely change the size?', 'It rewrites the file structure and removes duplicate objects. That helps files made by careless software, but a PDF that is mostly pictures is already as small as those pictures are.'),
              ('Is there a page limit?', 'No fixed limit, but a very long document takes a while because every page is rendered on your device. A hundred pages is fine; a thousand-page book will take a few minutes.'),
              ('Is my PDF uploaded?', 'No. The PDF is read and rewritten entirely inside your browser, on your own device. Nothing is uploaded, stored or seen by anyone, and there is no server copy to delete afterwards — you can verify it in your browser’s Network tab while a compression runs.')],
         related=['compress-image', 'merge-pdf', 'split-pdf', 'images-to-pdf']),

    dict(slug='passport-photo', group='image', name='Passport photo maker',
         title='Free Passport Size Photo Maker — Print Sheet, 35×45 mm, 2×2 in Online',
         h1='Free passport size photo maker',
         desc='Make a passport size photo online: crop to 35×45 mm, 2×2 inch or any size, under 50 KB if needed, plus a printable 4×6 sheet. Free, nothing uploaded.',
         intro='Crop any photo to the exact passport, visa or exam-form size, at print resolution, with a guide for where the head should sit. Get the single photo for online forms and a 4×6 inch sheet of copies for printing. ' + NOTHING,
         steps=[('Drop a photo', 'A phone picture against a plain, light wall is ideal. Face the camera straight on with a neutral expression.'),
                ('Frame it', 'Pick the size your form wants. Drag the picture and zoom until the head fills the dotted guide, roughly 70% of the frame.'),
                ('Download', 'You get the photo at the exact size, optionally under the KB limit a form asks for, and a print sheet with several copies and cutting lines.')],
         faq=[('What size is a passport photo in India?', '35 × 45 mm, with the face taking up most of the frame. Most Indian forms — passport, PAN, exams, visas — ask for this size, and it is the default here.'),
              ('What about the USA?', '2 × 2 inches (51 × 51 mm), with the head between 1 and 1⅜ inches high — that is 600 × 600 pixels at the 300 dpi print resolution forms expect. Choose the USA preset on this page and the crop frame is set to exactly that square shape.'),
              ('Can it change the background to white?', 'No. This tool crops and sizes; it does not edit the picture. Photograph against a plain white or light wall and the result is accepted by nearly every form.'),
              ('How do I print it?', 'Download the 4×6 inch sheet and print it at 100% size (no "fit to page") on photo paper at any photo shop or on a home printer. Cut along the grey lines.'),
              ('Can I keep the file under 50 KB?', 'Yes. Set the maximum file size on this page — 50 KB, or whatever limit your form shows — and the photo is saved at the highest quality that stays under it. The dimensions stay exactly the passport size you chose; only the JPEG quality steps down until the file fits.'),
              ('What is the passport photo size in pixels?', 'At the print resolution forms expect (300 DPI), 35 x 45 mm works out to 413 x 531 pixels, and the US 2 x 2 inch size is 600 x 600 pixels. Pick the preset and the download comes out at exactly that size.'),
              ('My exam form wants the photo under a KB limit — what do I do?', 'Make the photo here with the maximum file size set to the limit your form shows — 20 KB and 50 KB are the common ones. If your photo already has the right dimensions, the compress image tool takes it to an exact KB instead.')],
         related=['compress-image', 'crop-image', 'resize-image', 'remove-exif']),

    dict(slug='resize-image', group='image', name='Resize image',
         title='Free Image Resizer Online — Pixels, Percent or Presets',
         h1='Free image resizer',
         desc='Resize an image to exact pixels, a percentage, or a preset like Instagram, YouTube thumbnail or passport size. Free, in your browser, nothing uploaded.',
         intro='Set a width, a height, a percentage or a preset. Fit inside the size, fill it exactly, rotate or mirror on the way. Several images at once, all done on your device. ' + NOTHING,
         steps=[('Drop the images', 'One or many. Every common format is fine, including HEIC from an iPhone.'),
                ('Choose the size', 'Type the pixels, pick a percentage, or choose a preset. Leave the height at 0 to keep the proportions.'),
                ('Resize and download', 'Each result shows the old and new dimensions.')],
         faq=[('How do I resize an image without stretching it?', 'Type only the width (leave height at 0) and the height follows automatically. If you give both, choose "Fit inside" to avoid distortion or "Fill exactly" to crop to that exact shape.'),
              ('Can I resize to a file size in KB instead?', 'Resizing works in pixels; for a file size, use the compress image tool instead. It picks the dimensions and quality that land at or under the KB target you type — 50 KB, 100 KB or whatever the form asks for — and shows the final size before you download.'),
              ('Does resizing lose quality?', 'Making an image smaller keeps it sharp, because the pixels that remain are real. Making it larger cannot add detail that is not there — the new pixels are interpolated from their neighbours, so the result looks soft. Resize down freely; for a bigger version, start from the largest original you have.'),
              ('What sizes do social networks use?', 'Instagram posts are 1080×1080 and stories 1080×1920, YouTube thumbnails are 1280×720 and Facebook covers 820×312. All of them are presets on this page, so you pick the destination instead of typing numbers — and the picture is fitted inside the size without stretching.')],
         related=['crop-image', 'compress-image', 'passport-photo']),

    dict(slug='crop-image', group='image', name='Crop image',
         title='Free Image Cropper Online — Square, 16:9, 4:3 or Custom',
         h1='Free image cropper',
         desc='Crop an image to a square, 16:9, 4:3, 9:16 or any ratio by dragging. Free, in your browser, nothing uploaded.',
         intro='Choose a ratio, drag the picture into the frame, zoom, and download the crop. ' + NOTHING,
         steps=[('Drop an image', 'Any format, any size.'), ('Frame the crop', 'Pick a ratio, drag to position, zoom with the slider or the mouse wheel.'), ('Download', 'The cropped area at its original pixels, or scaled to a width you set.')],
         faq=[('How do I crop a photo to a square?', 'Choose the 1:1 ratio on this page, drag the picture so the part you want sits inside the frame, zoom if you need to, and press Crop. The download is a true square at the original pixels inside the frame — nothing is stretched to make it fit.'),
              ('Which ratios are available?', 'Square 1:1, 4:3, 3:2, 16:9, 9:16 for stories, 3:4, 2:3, 35:45 for passport photos — or any custom ratio you type. Pick one and the frame locks to that shape; with a custom ratio the frame follows whatever proportions you type.'),
              ('Can I make a passport photo with this?', 'Yes: the 35:45 ratio matches the Indian passport photo shape. For the full job at the exact pixel size, the passport photo tool does it in one step.'),
              ('Does the cropped image keep its format?', 'By default, yes — JPG stays JPG and PNG stays PNG. You can also switch the output to JPG, PNG or WebP while downloading, which is handy when a form insists on JPG even though your original is a PNG screenshot.'),
              ('Can I crop to an exact pixel size?', 'Set the ratio to match the shape you need and enter the output width; the height follows from the ratio automatically. For example, a 3:4 crop at 600 pixels wide comes out 600 × 800. The crop keeps the original pixels inside the frame unless you scale it.'),
              ('Does cropping reduce quality?', 'No. Cropping keeps the pixels inside the frame exactly as they are — it throws away the outside, it does not re-encode what remains. Quality only changes if you also choose to scale the result smaller or switch its format while downloading.')],
         related=['resize-image', 'passport-photo', 'compress-image']),

    dict(slug='merge-pdf', group='pdf', name='Merge PDF',
         title='Free PDF Merger Online — Combine PDFs, Nothing Uploaded',
         h1='Free PDF merger',
         desc='Combine several PDFs into one, in the order you choose. Free, no limits, in your browser — nothing uploaded.',
         intro='Drop the PDFs, put them in order, press Merge. The pages are copied into one new file without being re-rendered, so text, links and quality are untouched. ' + NOTHING,
         steps=[('Drop two or more PDFs', 'Add as many as you need.'), ('Set the order', 'Use the arrows on each row.'), ('Merge and download', 'One PDF, pages in that order.')],
         faq=[('Is there a limit on the number of files?', 'Up to 200 files at a time, of any size your device can hold in memory. The pages are copied into the new file rather than re-rendered, so a large merge is quick — and because everything runs in your browser, no file is uploaded while you combine them.'),
              ('Does merging reduce quality?', 'No. Pages are copied into the merged file exactly as they are — nothing is re-rendered, recompressed or converted — so text stays selectable, links keep working and images keep their original quality. The merged PDF is a reading copy of the same pages in a new order.'),
              ('Can I merge images and PDFs together?', 'Not directly, because a merge combines PDFs with PDFs. Convert the images first with the images to PDF tool — one PDF with a page per picture — then merge that PDF with the others here. Everything happens in your browser, so the files are never uploaded at any step.'),
              ('Can I change the order of the files?', 'Yes — the arrows on each row move it up or down, and the files are joined in the order shown. Drop them in any order and sort afterwards.'),
              ('Do bookmarks or form fields survive?', 'Page content — text, links, images — comes across exactly as it was. Document-wide extras such as bookmarks and fillable form fields do not transfer; the merged file is a clean reading copy.'),
              ('What is the merged file called?', 'merged.pdf, with every page in the order you set in the list. Rename it after downloading if you like — the name is only a default, so the file is easy to find in your Downloads folder straight after the merge finishes.'),
              ('Are my PDFs uploaded?', 'No. The merge happens entirely inside your browser, on your own device: the files are read from your disk, joined in memory and written back as one PDF. Nothing is uploaded, stored or seen by anyone at any point.')],
         related=['split-pdf', 'organize-pdf', 'images-to-pdf', 'compress-pdf']),

    dict(slug='split-pdf', group='pdf', name='Split PDF',
         title='Free PDF Splitter Online — by Pages or Ranges',
         h1='Free PDF splitter',
         desc='Split a PDF into single pages, page ranges or fixed chunks. Free, in your browser, nothing uploaded.',
         intro='Every page as its own file, the ranges you type, or chunks of a fixed length. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Choose how to split', 'Every page, ranges like 1-3, 5, 8-10, or chunks of N pages.'), ('Download', 'Several files come as one zip.')],
         faq=[('How do I extract just a few pages?', 'Choose "Page ranges", type the pages you want — for example 2, 5-7 — and tick "put the chosen pages into one PDF". Without the tick you get one file per range; with it, a single PDF holding just those pages, in the order they appear in the document.'),
              ('Does the split PDF lose quality?', 'No. Split pages are copied from the original file exactly as they are — never re-rendered or recompressed — so text stays selectable, images keep their quality and a scan splits exactly like a text PDF. Only the page grouping changes.'),
              ('How are the split files named?', 'Each file is named after the original: report-page-3.pdf for single pages, report-pages-1-5.pdf for chunks, report-5-10.pdf for a typed range — so a folder of splits stays in order.'),
              ('What is the chunks option for?', 'It cuts the document into equal parts — every 10 pages, say — which is handy for emailing a large file in pieces or splitting a scanned book into chapters.'),
              ('Does splitting work on a scanned PDF?', 'Yes. A scanned PDF splits exactly like a text PDF, because the pages are copied rather than re-rendered: each page image comes across untouched, at its original resolution, whether the page holds typed text, handwriting or a photograph.'),
              ('Can I split a very large PDF?', 'Yes, within what your device’s memory can hold. Hundreds of pages are fine on an ordinary phone or laptop; a thousand-page book will take longer because every page is handled on your device, but there is no page limit built into the tool.')],
         related=['merge-pdf', 'organize-pdf', 'rotate-pdf', 'compress-pdf']),

    dict(slug='rotate-pdf', group='pdf', name='Rotate PDF',
         title='Free PDF Rotator Online — All Pages or Some',
         h1='Free PDF rotator',
         desc='Rotate every page of a PDF, or only the pages you choose, by 90 or 180 degrees. Free, in your browser, nothing uploaded.',
         intro='Rotate the whole document, or type the pages that came out sideways. The rotation is saved in the file, so it opens the right way up everywhere. ' + NOTHING,
         steps=[('Drop the PDF', 'Several at once if you like.'), ('Choose the angle and pages', 'Leave pages empty to rotate everything.'), ('Download', '')],
         faq=[('Will the rotation stick when I open it elsewhere?', 'Yes. The rotation is written into the PDF page itself, not just shown in your viewer, so the file opens the right way up in every reader, on every device, and stays rotated when you upload it to a form or print it.'),
              ('Can I rotate only one page?', 'Yes — type its number in the pages box and only that page turns. Leave the box empty to rotate every page, or type a selection like 2, 5-7 to turn just the pages that came out sideways in a scan.'),
              ('How do I write the page selection?', 'Leave the box empty for every page, or type numbers like 2, 5-7. The direction buttons turn them 90° right, 90° left, or upside down.'),
              ('My scan opens sideways in every app — will this fix it?', 'Yes. The rotation is written into the PDF itself rather than just your viewer, so it opens the right way up in every reader on every device.'),
              ('Does rotating reduce quality?', 'No. Rotating only changes the page orientation written in the file — nothing is re-rendered or recompressed, so text, images and scans come out at exactly their original quality, just turned.')],
         related=['organize-pdf', 'split-pdf', 'merge-pdf']),

    dict(slug='organize-pdf', group='pdf', name='Organise PDF pages',
         title='Reorder PDF Pages Online — Free, Rotate & Delete, No Sign-up',
         h1='Free PDF page organiser: reorder, rotate, delete',
         desc='Reorder PDF pages free in your browser: see every page as a thumbnail, drag it into place, rotate or delete pages and save a new PDF. No sign-up, nothing uploaded.',
         intro='Every page appears as a thumbnail. Move pages with the arrows, rotate the sideways ones, cross out the ones to delete, and save. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Arrange the pages', 'Arrows move, the circle rotates, the cross deletes (press again to keep).'), ('Save the new PDF', '')],
         faq=[('How do I delete pages from a PDF?', 'Add the PDF to the organiser on this page, press the cross on each page you want gone, then save. The other pages are copied exactly as they were — nothing is re-rendered — and the new PDF keeps them in the order shown.'),
              ('Can I move a page to the front?', 'Press the left arrow on the page’s thumbnail until it reaches the front. Each press moves the page one place, and the order you see in the thumbnails is exactly the order saved into the new PDF when you download it.'),
              ('Is the original changed?', 'No. The organiser builds and downloads a new PDF with your page order; the original file on your device is never opened for writing and stays exactly as it was, so you can reorganise the same document again in a different order.'),
              ('How do I rearrange PDF pages?', 'Drop the PDF and use the arrows on each thumbnail to move pages until the order is right, then save. The pages themselves are copied exactly — only their order changes.'),
              ('Can I reorder pages and delete some at the same time?', 'Yes. Arrange the pages first, cross out the ones you do not want, and save once — the new PDF has your order without the deleted pages.')],
         related=['delete-pdf-pages', 'split-pdf', 'merge-pdf', 'rotate-pdf']),

    dict(slug='delete-pdf-pages', group='pdf', name='Delete PDF pages',
         title='Delete or Remove Pages from a PDF — Free Online, No Upload',
         h1='Free tool to delete pages from a PDF',
         desc='A free PDF page remover: click the thumbnails of the pages to remove, then save. In your browser, nothing uploaded.',
         intro='Drop the PDF, cross out the pages you do not want, save. Blank pages, scanner cover sheets, the empty form at the back — if a page should not be there, this takes it out. You can reorder and rotate the rest at the same time. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Cross out pages', 'Press the cross on each page to remove; press again to keep it.'), ('Save', 'You download a new PDF without the crossed-out pages.')],
         faq=[('How do I remove pages from a PDF?', 'Drop the PDF here, press the cross on every page you want removed, then save. You get a new PDF without those pages; the original file on your device is untouched.'),
              ('Can I remove just one page from a PDF?', 'Yes — cross out only that page and save. The remaining pages are copied exactly as they were, in the same order and at the same quality, and the original file on your device stays untouched, so you can start again if you cross the wrong page.'),
              ('Can I remove a blank page from a PDF?', 'Yes — find the blank page in the thumbnails, cross it out and save. Scanner cover sheets and the empty form page at the back go the same way, and every page you keep is copied into the new PDF exactly as it was.'),
              ('Does it re-compress the pages I keep?', 'No. The pages you keep are copied into the new PDF without any change — no re-compression, no re-rendering — so text stays selectable and images keep their original quality. Only the crossed-out pages are missing.'),
              ('Is my PDF uploaded to a server?', 'No. The pages are removed on your device, in your browser — the file never leaves it, so contracts and ID documents stay private. Nothing is uploaded, stored or seen by anyone, and there is no server copy to delete afterwards.')],
         related=['organize-pdf', 'split-pdf', 'merge-pdf', 'rotate-pdf']),

    dict(slug='images-to-pdf', group='pdf', name='Images to one PDF',
         title='Free Images to PDF Converter Online — Combine Photos',
         h1='Free images to PDF converter',
         desc='Turn several JPG, PNG or HEIC images into a single PDF, one page each, in the order you choose. Free, nothing uploaded.',
         intro='Photos of a document, scans from a phone, screenshots — drop them all and get one PDF with a page per image, on A4, Letter or pages that match the pictures. ' + NOTHING,
         steps=[('Drop the images', 'In any order; fix it with the arrows.'), ('Pick the page size and margin', 'A4 is right for most forms. "Same size as each image" keeps every pixel.'), ('Make the PDF', '')],
         faq=[('How do I make a PDF from photos on my phone?', 'Open this page on the phone, tap to choose the photos, order them and press the button. It works in Safari and Chrome without any app.'),
              ('Can I combine JPG and PNG in one PDF?', 'Yes — JPG, PNG, HEIC, WebP and the rest can be mixed freely in one PDF. Each image becomes its own page in the order you set, whatever format it arrived in, and the page size and margin you choose apply to all of them.'),
              ('Will the PDF be huge?', 'Images are stored as JPEG at the quality you set; 90% is visually lossless and keeps the file reasonable. Lower it, or compress the PDF afterwards, if there is an upload limit.'),
              ('What page size should I choose?', 'A4 suits most forms and printing in India; Letter is its US equivalent. "Same size as each image" skips the page frame entirely and keeps every pixel, which is best when the PDF is for viewing on screen rather than printing.'),
              ('Can I change the page order?', 'Yes — the arrows on each image move it up or down before you build the PDF. To rotate pages or remove some afterwards, run the finished file through the organise PDF tool.'),
              ('Will the text in my scans stay selectable?', 'No. Every page is a picture of your image, so words cannot be selected or searched. If you need the text itself, run the finished PDF through the image to text tool.'),
              ('How do I keep the file small enough to email?', 'Lower the JPEG quality a notch — scans tolerate 80% well. If it is still too big for the upload limit, the compress PDF tool squeezes it further.')],
         related=['compress-pdf', 'merge-pdf', 'pdf-to-jpg', 'organize-pdf']),

    dict(slug='image-to-text', group='other', name='Image to text (OCR)',
         title='Free Image to Text Converter — OCR Online, No Upload',
         h1='Free image to text converter (OCR)',
         desc='Extract text from a photo, screenshot or scanned PDF in your browser. English, Hindi and 18 more languages. Free, nothing uploaded.',
         intro='Read the words out of a picture or a scan and copy them as text. The recognition runs on your device, so a private document stays private. ' + NOTHING,
         steps=[('Drop images or a scanned PDF', 'Straight, sharp, well-lit pictures read best.'), ('Choose the language', 'English is the default; Hindi and other Indian languages are available.'), ('Read and copy', 'The text appears in a box you can copy from or download.')],
         faq=[('Is this really free and unlimited?', 'Yes. The recognition engine runs in your browser, so there is no server cost to pass on and no page limit — read one screenshot or a whole scanned document. English, Hindi and 18 more languages are included, and nothing you read is uploaded.'),
              ('Why is the first run slow?', 'The engine (about 4 MB) and the language file (2–15 MB) are downloaded into your browser the first time you use them. After that they are cached, so later readings start at once — and the reading itself never needed a connection, because it happens on your device.'),
              ('How accurate is it?', 'Printed text in a clear photo reads at close to 100%. Handwriting, tiny text and blurry pictures will contain mistakes — check the result before relying on it.'),
              ('Can it read Hindi?', 'Yes. Choose Hindi before you start, or English + Hindi for mixed documents. Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi and Urdu are also available — twenty languages in total, and every one of them is read on your device, not on a server.'),
              ('Which languages are supported?', 'Twenty in total: English, Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Arabic, Spanish, French, German, Portuguese, Russian, simplified Chinese and Japanese — plus an English + Hindi mode for mixed documents. Pick the right one before you start; the wrong language is the most common reason for gibberish output.'),
              ('What does the result look like?', 'Plain text in reading order, which you can copy or download. Layout, fonts, columns and tables are not preserved — it reads the words, not the design.'),
              ('Why is a whole paragraph missing?', 'The engine skips regions it cannot make sense of: text over a photo, watermarks behind the words, heavy skew or a deep crease. Crop tightly to the text block and straighten the photo, then try that part again.'),
              ('Does the scanned PDF get uploaded?', 'No. The scanned document is rendered and read entirely on your device — the recognition engine runs in your browser — so a private document never leaves it. Nothing is uploaded, stored or seen by anyone.')],
         related=['pdf-ocr', 'pdf-to-txt', 'compress-image']),

    dict(slug='pdf-ocr', group='other', name='PDF OCR',
         title='Free PDF OCR Online — Extract Text from a Scanned PDF',
         h1='Free PDF OCR: text from a scanned PDF',
         desc='Read the text in a scanned PDF and copy it, in your browser. English, Hindi and more. Free, nothing uploaded.',
         intro='A scanned PDF is a picture of a page. This reads the words off it, page by page, on your device. ' + NOTHING,
         steps=[('Drop the scanned PDF', 'Up to 50 pages at a time.'), ('Choose the language', ''), ('Read, copy or download', 'Page breaks are marked in the text.')],
         faq=[('Will it make my PDF searchable?', 'It gives you the text as a file you can copy or save. It does not write an invisible text layer back into the PDF.'),
              ('Why did a normal PDF come out badly?', 'If the PDF already contains real text, converting it to TXT or Word is faster and exact — those tools read the text that is already stored in the file. OCR is for scans: pages that are only pictures of text, with nothing stored underneath to read.'),
              ('Is anything uploaded?', 'No. Nothing is uploaded: the scanned PDF is rendered and read page by page inside your browser, on your own device. The text it finds appears on the page for you to copy or download, and the file itself never leaves your device.')],
         related=['image-to-text', 'pdf-to-txt', 'pdf-to-docx']),

    dict(slug='trim-video', group='media', name='Trim video',
         title='Free Video Trimmer Online — No Watermark, No Upload',
         h1='Free video trimmer, no watermark',
         desc='Cut a video to the part you want, with no watermark and no upload. Save as MP4 or WebM, in your browser.',
         intro='Pick the start and end, preview the selection, save it as MP4. No watermark, no sign-up, and the video never leaves your device. ' + NOTHING,
         steps=[('Drop the video', 'MP4, MOV from an iPhone, WebM and most others.'), ('Set the start and end', 'Play to a point and press "Start here" or "End here", or type the times.'), ('Trim and save', 'The selection is re-encoded on your device.')],
         faq=[('Is there really no watermark?', 'None, and there is nothing to pay for either. The trimmed video is re-encoded on your own device and saved without any watermark, logo or added frames — what you download is exactly the selection you made, as MP4 or WebM.'),
              ('Why does it take a while?', 'Every frame in the selection is decoded and re-encoded on your own machine. A one-minute clip takes roughly a minute. Keep the tab in front.'),
              ('Does trimming lose quality?', 'It is re-encoded, so very slightly — every frame is decoded and encoded again on your device. At the default quality the difference is not visible in ordinary footage; if the clip must stay pristine, save at a higher quality setting and accept the larger file.'),
              ('Can I remove the sound?', 'Yes — tick "Remove the sound" before saving and the video is written without its audio track. That is handy for a muted social clip, and it also makes the saved file a little smaller.'),
              ('Can I save as WebM instead of MP4?', 'Yes. Choose the format before you save: MP4 with H.264 plays on essentially every device, TV and messaging app, while WebM with VP9 is smaller at the same quality and suits websites. The sound can be kept or removed in the same pass.'),
              ('Why is trimming not instant?', 'Phone galleries cut without re-encoding. This tool re-encodes the selection frame by frame in your browser — slower, but it can also resize, change format and strip the sound in the same pass.'),
              ('How do I pick exact start and end points?', 'Type times like 0:12.5, or play the video and press "Start here" and "End here" at the right moments, then "Play selection" to check before saving.'),
              ('What is the size limit?', 'Clips up to 15 minutes. The whole video has to fit in a browser tab’s memory while it is decoded and re-encoded on your device, and longer footage runs out of room — trim a long recording in two passes if you need more.')],
         related=['mp4-to-gif', 'mov-to-mp4', 'mp3-cutter', 'mp4-to-mp3']),

    dict(slug='mp3-cutter', group='media', name='MP3 cutter',
         title='Free MP3 Cutter Online — Cut Audio, Make a Ringtone',
         h1='Free MP3 cutter and ringtone maker',
         desc='Cut an MP3 or any audio to the part you want, add a fade, save as MP3 or WAV. Free, in your browser, nothing uploaded.',
         intro='Drag the handles on the waveform, play the selection, add a fade in or out, save. Works with MP3, M4A, WAV, FLAC and the sound from a video. ' + NOTHING,
         steps=[('Drop the audio', 'Or a video — only its sound is used.'), ('Select the part', 'Drag the yellow handles or type the times. "30 s ringtone" sets a 30-second selection.'), ('Cut and save', 'MP3 at the bitrate you choose, or WAV.')],
         faq=[('How do I make a ringtone?', 'Select up to 30 seconds and save as MP3. On Android, put the file in the Ringtones folder or pick it in Settings › Sound. iPhone needs the clip added through iTunes/Finder or GarageBand.'),
              ('Does cutting an MP3 lose quality?', 'A little, because the audio is decoded and re-encoded to make the cut. Saving at 256 or 320 kbps keeps the difference inaudible on ordinary equipment; choose WAV instead if you want the selection with no further compression at all.'),
              ('Can I join two clips?', 'Not here yet. Cut each clip to the part you need first, then convert or combine the pieces as needed. Each cut is saved as its own MP3 or WAV file, at the bitrate you choose, entirely in your browser.')],
         related=['ringtone-maker', 'trim-video', 'mp4-to-mp3', 'wav-to-mp3']),

    dict(slug='ringtone-maker', group='media', name='Ringtone maker',
         title='Free Ringtone Maker Online — Cut Any Song to 30 s',
         h1='Free ringtone maker',
         desc='Cut any song to a 30-second ringtone, add a fade, save as MP3. Free, in your browser, nothing uploaded.',
         intro='Drop a song, move the selection to the part you like, press the 30-second button, save. ' + NOTHING,
         steps=[('Drop the song', ''), ('Choose the 30 seconds', 'Drag the start handle to where the good part begins and press "30 s ringtone".'), ('Save as MP3', '')],
         faq=[('How do I set it as a ringtone on Android?', 'Save the MP3 from this page, then open Settings › Sound › Phone ringtone and add it from your files — or copy the file into the Ringtones folder, after which it appears in the ringtone list. The clip is already 30 seconds or shorter, ready to use.'),
              ('And on iPhone?', 'iPhone does not accept MP3 ringtones directly. Save the clip from this page, then add it through GarageBand or iTunes/Finder as a tone — and keep it 30 seconds or shorter, because iPhones reject longer tones.'),
              ('What format does it save?', 'MP3, which Android accepts directly as a ringtone or notification sound. For an iPhone, keep the clip 30 seconds or shorter and add the same file through iTunes, Finder or GarageBand, which converts it into a tone.'),
              ('Can I fade the ends?', 'Yes — set a fade-in and a fade-out time and the clip eases in and out instead of starting and stopping abruptly. A second or two at each end is enough for a ringtone, and the preview plays the fades before you save.'),
              ('How long should a ringtone be?', 'Thirty seconds or less: iPhones reject longer ones, and on Android a short clip simply loops. The "30 s ringtone" button sets it for you.')],
         related=['mp3-cutter', 'trim-video', 'mp4-to-mp3']),

    dict(slug='mask-aadhaar', group='image', name='Mask Aadhaar number',
         title='Free Aadhaar Masking Tool \u2014 Hide First 8 Digits Online',
         h1='Free Aadhaar masking tool: hide the first 8 digits',
         desc='Mask an Aadhaar number on a photo or PDF: cover the first 8 digits and keep the last 4, as UIDAI advises. Free, in your browser, nothing uploaded.',
         intro='Share a copy of your Aadhaar without handing over the whole number. This covers the first 8 digits and leaves the last 4 readable, which is the form UIDAI itself recommends. The number is found for you, or you can draw the box by hand. ' + NOTHING,
         steps=[('Drop your Aadhaar', 'A photo, a scan or the e-Aadhaar PDF. It is read on your device \u2014 nothing is sent anywhere.'),
                ('Check the mask', 'Press Find the number and the first 8 digits are covered automatically. If the photo is tilted or blurred, draw the box yourself.'),
                ('Download the safe copy', 'The black box is burned into the pixels, so the hidden digits cannot be recovered from the file you send.')],
         faq=[('How much of an Aadhaar number should be hidden?', 'UIDAI\u2019s masked Aadhaar shows only the last 4 digits, so the first 8 are covered. That is what this tool does by default \u2014 enough to identify the document as yours, without giving away the full number.'),
              ('Can the hidden digits be recovered from the file?', 'No. Drawing a black rectangle on a PDF leaves the real text underneath, where copy-paste or any text extractor will find it. This tool flattens the page to an image and paints the mask into the pixels, so there is nothing left to recover.'),
              ('It did not find the number \u2014 what now?', 'Press Draw a box and drag across the digits yourself. Automatic reading struggles with a tilted photo, heavy glare, a low-resolution scan or a coloured background. The manual box always works.'),
              ('Should I cover the QR code as well?', 'Usually yes. The QR code on an Aadhaar carries the full record \u2014 name, address, date of birth and the number. Masking the printed digits alone still leaves all of that readable by anyone with a scanner. Draw a second box over the QR code before you download.'),
              ('Is masked Aadhaar accepted as proof?', 'It is accepted in many places that only need to see which document you hold, and UIDAI publishes masked Aadhaar for exactly that use. Some verifications still require the full number, so check what you are being asked for.'),
              ('Is my Aadhaar uploaded anywhere?', 'No. The picture is decoded, masked and re-encoded inside your browser. Open your developer tools, watch the Network tab while you use it, and you will see nothing leave your device.')],
         related=['remove-exif', 'compress-image', 'scan-document', 'images-to-pdf']),

    dict(slug='remove-exif', group='image', name='Remove EXIF / metadata',
         title='Free EXIF Remover — Strip Photo Metadata Online, Private',
         h1='Free EXIF remover: view and strip photo metadata',
         desc='See the hidden metadata in a photo — camera, date, GPS location — and remove it without re-encoding. Free, in your browser, nothing uploaded.',
         intro='Photos carry the camera model, the date and often the exact GPS location of where they were taken. See what yours reveal, then strip it. JPEG, PNG and WebP are cleaned without touching the picture itself. ' + NOTHING,
         steps=[('Drop the photos', 'The metadata is shown at once, including any location.'), ('Check what is there', 'A red GPS line means the photo says where it was taken.'), ('Remove and download', 'The picture is identical; the data is gone.')],
         faq=[('Does removing EXIF reduce image quality?', 'Not for JPEG, PNG or WebP — the metadata segments are cut out and the image data is copied byte for byte. Other formats are re-saved as JPEG at high quality.'),
              ('Why is the file only slightly smaller?', 'Metadata is usually a few kilobytes; an embedded preview thumbnail can be tens of kilobytes, which is where any real saving comes from. The picture itself is copied byte for byte, so the file size mostly stays the same — what leaves is the data about the photo, not the photo.'),
              ('Does WhatsApp remove EXIF?', 'WhatsApp and most social networks strip it on upload, but email, cloud drives and many websites do not. Cleaning it yourself is the only way to be sure.'),
              ('Will my photo appear rotated afterwards?', 'No. If the photo relied on an orientation tag, it is re-saved the right way up so it still displays correctly. That matters because the strip removes the tag — without the re-save, the picture would fall back to its stored sideways orientation in many viewers.')],
         related=['view-metadata', 'compress-image', 'heic-to-jpg']),

    dict(slug='view-metadata', group='image', name='View photo metadata',
         title='Free Photo Metadata Viewer — EXIF, GPS, Camera Online',
         h1='Free photo metadata viewer',
         desc='See the EXIF data in a photo: camera, lens, settings, date and GPS location. In your browser, nothing uploaded.',
         intro='Drop a photo and see everything it records about itself. Remove it in one click if you like. ' + NOTHING,
         steps=[('Drop a photo', ''), ('Read the data', 'Camera, lens, exposure, date, software and location if present.'), ('Optionally remove it', '')],
         faq=[('Where is the GPS location shown?', 'In red at the top of the list, with a map link, when the photo has one. Photos from phones often do, unless location tagging is off in the camera settings — which is exactly what this check tells you about a photo before you share it.'),
              ('Can I edit the metadata?', 'Not here — this tool only views metadata, and can remove it in one click. Editing fields such as the date or camera name would mean rewriting the file, which risks corrupting the picture; viewing and stripping are the safe operations.')],
         related=['remove-exif', 'compress-image']),

    dict(slug='scan-document', group='pdf', name='Document scanner',
         title='Free Document Scanner \u2014 Photo to Clean PDF, No Upload',
         h1='Free document scanner',
         desc='Photograph a page and get a straight, clean scan back as a PDF or a JPG. The corners are found for you, the shadow is removed, and nothing is uploaded.',
         intro=('A photograph of a document is not a scan. It leans, the lamp puts a grey gradient down one side, and the paper is never quite white. '
                'This tool fixes all three: it finds the four corners of the page, pulls the picture flat so the edges are square again, divides out the '
                'shadow so the paper goes white and the ink goes black, and saves the result as a PDF or an image with a real resolution written into it. '
                'Photograph several pages and they become one PDF, in the order you dropped them. ') + NOTHING,
         steps=[('Photograph the page', 'Lay it on a surface that is not the same colour as the paper, and get all four corners in the frame. Straight overhead is best but an angle is fine \u2014 that is what the straightening is for.'),
                ('Check the corners', 'Four circles appear on the page it found. Drag any that sat in the wrong place; on a busy background you may want to place all four yourself.'),
                ('Pick the finish', 'Colour removes the shadow and keeps the ink as it is. Black & white is the crispest and the smallest for plain text. Greyscale sits between them.'),
                ('Save it', 'One PDF for a multi-page document, or JPG and PNG images. The resolution you choose is written into the file, so a form that checks for 300 dpi is satisfied.')],
         faq=[('How do I scan a document with my phone for free?',
               'Photograph the page, drop it here and the page is found, straightened and cleaned automatically. There is no app to install, no account, no watermark, and the photograph never leaves your phone \u2014 the whole thing runs in the browser.'),
              ('Can I scan several pages into one PDF?',
               'Yes. Drop all the photographs at once, or add them one at a time; each becomes a page in a single PDF in the order shown. Use the page buttons to check the corners on each one.'),
              ('The corners are in the wrong place. Can I fix them?',
               'Drag them. Automatic detection looks for the largest pale shape, which is the page in most photographs but not on a white table or a patterned cloth. Drag each circle onto a corner and the result is exactly as good.'),
              ('Why does my scan look better than the photograph?',
               'Two reasons. The page is pulled flat with a projective transform, so an edge photographed at an angle becomes straight rather than merely cropped. Then the tool divides the picture by a blurred copy of itself, which removes the uneven light a lamp or a window leaves behind, and stretches what is left so paper reads as white.'),
              ('Can I use this instead of a scanner app?',
               'Yes. It does the same job \u2014 detect, straighten, clean, save as PDF \u2014 with no app to install, no sign-up, no watermark and no page limit, and it does not upload your documents to anyone.'),
              ('What resolution should I choose?',
               '300 dpi for anything going to print or to an office. 200 dpi is enough for a form upload and makes a noticeably smaller file. 600 dpi only helps if you will enlarge the page or run text recognition on very small print.')],
         related=['images-to-pdf', 'pdf-ocr', 'compress-pdf', 'change-dpi']),

    dict(slug='change-dpi', group='image', name='Change image DPI',
         title='Free DPI Converter \u2014 Set a Photo to 200 or 300 DPI',
         h1='Free image DPI converter',
         desc='Set a photo or signature to 200 dpi, 300 dpi or any resolution an exam form asks for, and see the printed size as you type. Free, nothing uploaded.',
         intro=('Forms ask for dots per inch because they are really asking how big the picture is on paper. A 600 by 600 photo at 300 dpi prints two inches '
                'across; the same photo at 200 dpi prints three. This tool writes that number into the file where a checker reads it \u2014 the JFIF header of a JPG, '
                'the pHYs chunk of a PNG \u2014 and can resize the pixels at the same time so the printed size comes out exactly as the form demands. '
                'It also tells you what your file says today, which for anything made by a phone or a web tool is usually nothing at all. ') + NOTHING,
         steps=[('Drop the photo or signature', 'JPG, PNG, WebP and HEIC all work, and several at once is fine.'),
                ('Type the resolution', '200 and 300 are one tap away. The line underneath shows what the file says now and what it will say afterwards, with the printed size in centimetres.'),
                ('Choose what should change', 'Writing only the number keeps every pixel and changes the printed size. Keeping the printed size resizes the pixels instead. The third option gives you an exact size in centimetres at that resolution \u2014 what a form like CCC means by "3.5 \u00d7 4.5 cm at 200 dpi".'),
                ('Save it', 'Add a KB limit if the form has one, and the result is compressed to fit with the resolution still written in.')],
         faq=[('How do I change the DPI of an image to 200 or 300?',
               'Add the photo to the DPI converter on this page, tap 200 dpi or 300 dpi, and press Set the DPI. The number is written into the file itself — the JFIF header of a JPG or the pHYs chunk of a PNG — so Photoshop, a print shop or a form validator all read it back correctly.'),
              ('My CCC form wants a 200 dpi photo. What do I do?',
               'Choose "Make it an exact printed size", set 3.5 by 4.5 cm and 200 dpi, and add the KB limit the form states. You get a 276 by 354 pixel JPG that says 200 dpi and fits the size limit \u2014 which is exactly what the form is checking.'),
              ('Does changing the DPI make my photo sharper?',
               'On its own, no. Dots per inch is a label saying how large to print the pixels you already have. If you ask to keep the printed size, the tool does resize the picture, but enlarging cannot invent detail that was never photographed \u2014 start from the largest original you have.'),
              ('Why does my photo say 96 dpi, or nothing at all?',
               'Because most phones and web tools never write the field. A picture with no resolution recorded is usually assumed to be 96 dpi by Windows and 72 dpi by older Mac software, which is why the same file prints at different sizes in different places. Writing the number removes the guesswork.'),
              ('What is the difference between DPI and pixels?',
               'Pixels are how much picture there is; dpi is how tightly they are packed when printed. 1200 pixels at 300 dpi is four inches of paper. Forms usually state both, because together they fix the printed size.'),
              ('Is the photo uploaded anywhere?', 'No. The file is read, edited and saved on your own device: the resolution number is written into the image header in your browser, and the picture never leaves it. Nothing is uploaded, stored or seen by anyone.')],
         related=['resize-image', 'compress-image', 'passport-photo', 'scan-document']),

    dict(slug='qr-code-generator', group='other', name='QR code generator',
         title='Free QR Code Generator — UPI, Wi-Fi, vCard, No Sign-up',
         h1='Free QR code generator',
         desc='Make a QR code for a link, UPI payment, Wi-Fi network, contact card, email or phone. Download as PNG or SVG. Free, no sign-up, no tracking.',
         intro='Type what the code should hold and it appears as you type. Download a sharp PNG or an SVG for print. Codes are made in your browser; nothing is stored, and the code never expires because there is no redirect service behind it. ' + NOTHING,
         steps=[('Choose what kind of code', 'Link, UPI payment, Wi-Fi, contact card, email, phone or SMS.'), ('Fill in the details', 'The preview updates live.'), ('Download', 'PNG at the size you choose, or SVG.')],
         faq=[('Is the QR code free forever?', 'Yes. The code encodes your data directly — there is no subscription, no redirect service and nothing that can expire or be switched off. A code you print today will still scan in ten years, as long as what it points to still exists.'),
              ('How do I make a UPI payment QR code?', 'Choose UPI on this page, enter your UPI ID and name, and add an amount only if you want it fixed. The finished code opens any UPI app with the payment ready to confirm — the payer just checks the name and amount before paying.'),
              ('Which size should I download?', '512 px is enough for a screen or a leaflet; use 2048 px or the SVG for posters and print, where the code must stay sharp at a large size. Bigger is always safer if the code will be scanned from a distance.'),
              ('Can I add a logo?', 'Not here. If you overlay a logo yourself afterwards, choose error correction H when you make the code, so it still scans with the middle covered — and test the printed code with two different phones before you rely on it.'),
              ('Is my data stored?', 'No. Nothing is sent anywhere: the code is drawn in your browser from the text you type, and it is never stored or tracked. That is also why the code never expires — there is no redirect service behind it that could be switched off.')],
         related=['compress-image', 'png-to-svg']),

    dict(slug='unzip', group='other', name='Unzip online',
         title='Free Online Unzip — Open ZIP, TAR, GZ in Your Browser',
         h1='Free online unzip tool',
         desc='Open a ZIP, TAR or GZ archive in your browser, see what is inside and download the files you want. Free, nothing uploaded.',
         intro='Drop the archive, tick the files, download them one by one or as a smaller zip. Nothing is extracted on a server — it all happens on your device. ' + NOTHING,
         steps=[('Drop the archive', '.zip, .tar, .tgz or .gz.'), ('Pick the files', 'Everything is ticked by default.'), ('Download', 'A single file directly; several as a zip of just those.')],
         faq=[('Can I open a zip on my phone with this?', 'Yes. Open this page in the phone’s browser, choose the zip from Files, and download what you need — no app to install. A single file downloads directly; several come as a smaller zip of just those files.'),
              ('Is there a size limit?', 'Whatever your device can hold in memory — a few hundred megabytes is fine on most phones and laptops, because the archive is opened locally rather than on a server. Very large archives on an old phone may run out of room.'),
              ('Does it handle password-protected zips?', 'Not yet. Password-protected archives cannot be opened here, because the tool reads the archive’s contents directly in your browser. Open a protected zip in a desktop archive app first, or ask whoever sent it to share an unprotected copy.'),
              ('Is the archive uploaded?', 'No. The archive is opened inside your browser, on your own device: you see what is inside and download the files you pick, without anything being extracted on a server or sent anywhere.')],
         related=['zip-to-tar', 'tar-to-zip', 'compress-pdf']),

    dict(slug='sign-pdf', group='pdf', name='Sign PDF',
         title='Free PDF Signer Online — Draw or Type a Signature',
         h1='Free PDF signer',
         desc='Draw, type or upload a signature and place it on any page of a PDF. Free, in your browser — the document is never uploaded.',
         intro='Draw your signature with a mouse or finger, type it, or upload a picture of it; drag it into place on the page; save. The contract, form or letter stays on your device throughout. ' + NOTHING,
         steps=[('Drop the PDF', ''), ('Make your signature', 'Draw it, type your name, or upload a photo of your signature on white paper.'), ('Place it and save', 'Choose the page, drag the signature where it belongs, adjust the size, save.')],
         faq=[('Is a drawn signature legally valid?', 'In most countries an electronic signature is valid for ordinary agreements when both sides intend it to be. Some documents — property, wills, certain government forms — need specific procedures. This tool adds an image; it does not create a cryptographic certificate.'),
              ('Can I sign more than one page?', 'One page per pass: place the signature and save, then drop the saved file back in and sign the next page the same way. Each save is a new file, so keep working from the latest one — the document is never uploaded at any step.'),
              ('Is my document uploaded?', 'No. That is the point of doing it here: the PDF is opened, signed and saved entirely in your browser, so a contract, form or letter never leaves your device, and there is no server copy to worry about afterwards.'),
              ('Can I add the date?', 'Yes — tick the date option and today’s date is written under the signature when you place it. The date becomes part of the saved PDF, positioned with the signature on the page you choose.')],
         related=['merge-pdf', 'compress-pdf', 'organize-pdf']),
]

GROUPS = [('image', 'Image tools'), ('pdf', 'PDF tools'), ('media', 'Audio & video'), ('other', 'Other tools')]

# The home page lists every tool, most used first. Until the counters have
# something to say, this is the order — by search demand, most to least.
RAIL_ORDER = ['compress-image', 'compress-pdf', 'mask-aadhaar', 'passport-photo', 'scan-document', 'merge-pdf', 'image-to-text', 'change-dpi', 'resize-image',
              'images-to-pdf', 'split-pdf', 'sign-pdf', 'crop-image', 'qr-code-generator', 'remove-exif', 'trim-video',
              'mp3-cutter', 'pdf-ocr', 'organize-pdf', 'delete-pdf-pages', 'rotate-pdf', 'unzip', 'ringtone-maker', 'view-metadata']
GROUP_FAM = {'image': 'image', 'pdf': 'doc', 'media': 'video', 'other': 'data'}
# one line under the name in the rail, and the glyph beside it (sprite ids in index.html)
RAIL_META = {
    'compress-image':    ('Down to 20\u2013500 KB for any form', 'compress'),
    'compress-pdf':      ('Under 100 KB to 1 MB limits', 'pdf'),
    'mask-aadhaar':      ('Hide the first 8 digits, keep the last 4', 'shield'),
    'passport-photo':    ('35\u00d745 mm, print sheet, under 50 KB', 'portrait'),
    'resize-image':      ('Pixels, percent or social presets', 'resize'),
    'crop-image':        ('Square, 16:9, 9:16 or custom', 'crop'),
    'merge-pdf':         ('Several PDFs into one', 'merge'),
    'split-pdf':         ('Pages or ranges into files', 'split'),
    'rotate-pdf':        ('Fix sideways pages', 'rotate'),
    'organize-pdf':      ('Move, rotate, delete pages', 'grid'),
    'delete-pdf-pages':  ('Remove pages by thumbnail', 'grid'),
    'images-to-pdf':     ('Photos into one PDF', 'stack'),
    'image-to-text':     ('Copy text from a photo', 'scan'),
    'pdf-ocr':           ('Text from a scanned PDF', 'scan'),
    'trim-video':        ('Cut a clip, no watermark', 'video'),
    'mp3-cutter':        ('Cut audio, add a fade', 'audio'),
    'ringtone-maker':    ('30-second clip from a song', 'audio'),
    'remove-exif':       ('Strip camera and GPS data', 'shield'),
    'view-metadata':     ('See what a photo reveals', 'shield'),
    'scan-document':     ('Photo of a page \u2192 clean PDF', 'scan'),
    'change-dpi':        ('200 or 300 dpi for exam forms', 'dpi'),
    'qr-code-generator': ('Link, UPI, Wi\u2011Fi, vCard', 'qr'),
    'unzip':             ('Open ZIP or TAR, pick files', 'box'),
    'sign-pdf':          ('Draw or type, place, save', 'pen'),
}

# /compress-image-to-50kb/ and friends: the same tool, preset, with its own copy
KB_PAGES = {
    # Every one of these is a phrase Google itself suggests for "compress image
    # to" / "compress pdf to", which is where this site's demand actually is:
    # a third of its search queries name an exact KB or MB target.
    'compress-image': [15, 20, 30, 40, 50, 100, 200, 500, 1024],
    'compress-pdf': [50, 100, 200, 300, 400, 500, 1024, 2048],
}


def kb_label(kb):
    return '%d MB' % (kb // 1024) if kb >= 1024 and kb % 1024 == 0 else '%d KB' % kb


def kb_slug(kb):
    return '%dmb' % (kb // 1024) if kb >= 1024 and kb % 1024 == 0 else '%dkb' % kb


def kb_page(base, kb):
    """A landing page for one fixed size target."""
    lab = kb_label(kb)
    kind = 'image' if base['slug'] == 'compress-image' else 'PDF'
    d = dict(base)
    d['slug'] = '%s-to-%s' % (base['slug'], kb_slug(kb))
    d['preset'] = {'kb': kb}
    d['parent'] = base['slug']
    if kind == 'image':
        d['title'] = 'Compress Image to %s — Free Online Tool, No Upload' % lab
        d['h1'] = 'Free image compressor to %s' % lab
        d['desc'] = 'Reduce a JPG or PNG to under %s for a form or upload, at the best quality that fits. Free, in your browser, nothing uploaded.' % lab
        d['intro'] = ('Drop the picture and it comes back under %s — the target is already set. The tool keeps the highest quality that fits and only '
                      'shrinks the pixels if it has to. ' % lab) + NOTHING
        d['faq'] = [('How do I reduce a photo to %s?' % lab, 'Add your photo to the image compressor on this page — the target is already set to %s, so you only press Compress and download the result. The compressor keeps the highest quality that fits under %s and only shrinks the pixels if it has to. Several photos can be done at once, and nothing is uploaded: the compression runs in your browser.' % (lab, lab)),
                    ('Will a %s image still look good?' % lab, {15: 'Only for something simple. 15 KB is signature territory — black ink on white compresses to almost nothing, so it stays crisp. A face photo at 15 KB has to drop to roughly 300 pixels across and will look soft.',
                                                              20: 'At 20 KB the picture has to be small — a few hundred pixels across — which is exactly what forms asking for 20 KB expect, such as a signature or a thumbnail photo.',
                                                              30: 'For a signature or a scanned form, easily. For a face, 30 KB gives about 400 pixels across: readable on screen, a little soft if printed.',
                                                              40: 'Yes. 40 KB is the size many Indian exam forms ask for, and it holds a face photo around 500 pixels wide — enough to be clearly recognisable.',
                                                              50: 'Yes for a photo of a face or a document: 50 KB holds a sharp picture around 600 pixels wide, which is what passport-style uploads want.',
                                                              100: 'Yes. 100 KB holds a clear picture around 1000 pixels wide — sharp enough for any form, for a profile picture and for most web use. A phone photo of several megabytes usually reaches 100 KB with no visible difference at normal viewing size.',
                                                              200: 'Comfortably. 200 KB is enough for a full-screen photo at good quality — a detailed picture around 1600 pixels wide. Only a very large print would want more; for forms, websites and sharing, 200 KB is generous.',
                                                              500: 'Easily. 500 KB is a large, high-quality image — close to full camera resolution for most photos. Only the biggest camera files need any visible compression to reach it, and even then the difference shows only at full zoom.',
                                                              1024: 'There is nothing to worry about at 1 MB. That is a full-resolution photo at high quality; the limit exists to stop a 12 MB camera file, not to force any visible loss.'}[kb]),
                    ('What if the form also wants specific dimensions?', 'Use a preset size when you compress — the exam photo, signature and passport presets set the dimensions for you — or crop the picture first with the passport photo tool for an exact shape such as 35 × 45 mm. Then apply the %s target on top, so the finished file has both the right dimensions and the right file size.' % lab),
                    ('Is the picture uploaded?', 'No. Everything runs in your browser, on your own device: the picture is read, compressed and saved without ever leaving it. There is no server copy to delete afterwards, and you can check this yourself in your browser’s Network tab while a compression runs — no request carries your file out.')]
        d['steps'] = [('Drop your photo', 'JPG, PNG, WebP, HEIC and most other image formats work. You can add several at once.'),
                      ('Target: %s' % lab, 'The size is already set to %s — the exact limit forms ask for. Change it only if your form asks for a different size.' % lab),
                      ('Compress and download', 'Each result shows the before and after size, at or under %s. Download one, or all of them as a zip.' % lab)]
        d['related'] = [base['slug'] + '-to-' + kb_slug(k) for k in KB_PAGES['compress-image'] if k != kb] + ['passport-photo', 'resize-image']
    else:
        d['title'] = 'Compress PDF to %s — Free Online Tool, No Upload' % lab
        d['h1'] = 'Free PDF compressor to %s' % lab
        d['desc'] = 'Shrink a PDF to under %s for an upload limit, in your browser. Free, nothing uploaded.' % lab
        d['intro'] = ('Drop the PDF and get it back under %s — the target is preset. Strong compression redraws pages to fit; light compression keeps the text selectable. ' % lab) + NOTHING
        d['faq'] = [('How do I compress a PDF to %s?' % lab, 'The target %s is already set on the PDF compressor on this page, so add the PDF, keep Strong compression for scans and picture-heavy PDFs, press the button and download. Strong compression redraws each page as a picture at the resolution needed to bring the whole file under %s.' % (lab, lab)),
                    ('My PDF is in MB — how do I reduce it to %s?' % lab, 'The target is already set to %s. A scanned or photo-heavy PDF sits in MB because every page is a picture, and Strong compression redraws those pages at the size needed to come down to %s. If a file cannot reach it without turning unreadable, you get the smallest readable version and a note saying so.' % (lab, lab)),
                    ('Will the text still be readable?', 'Yes. Pages are redrawn at the resolution needed to hit %s; if that would make them unreadable you get the smallest readable version and a note instead.' % lab),
                    ('Can I keep the text selectable?', 'Choose Light compression when you compress the PDF. Light compression rewrites the file structure and keeps the text as real, selectable text, but it cannot shrink the pictures inside a scan by much — so a scanned or photo-heavy PDF may not reach %s that way. Use Strong compression when the size limit matters more than selectable text.' % lab),
                    ('Is the PDF uploaded?', 'No. The PDF is read, compressed and rewritten entirely inside your browser, on your own device — it never leaves it. That is why there is nothing to delete afterwards: nothing was ever sent. You can verify it in your browser’s Network tab while the compression runs.')]
        d['steps'] = [('Drop the PDF', 'Scanned documents, photo PDFs and ordinary text PDFs all work.'),
                      ('Target: %s' % lab, 'The limit is already set to %s. Use Strong compression for scans and picture-heavy files; Light when the text must stay selectable.' % lab),
                      ('Compress and download', 'The result shows the new size, at or under %s. If a target is unreachable without making pages unreadable, you get the smallest readable version and a note saying so.' % lab)]
        d['related'] = [base['slug'] + '-to-' + kb_slug(k) for k in KB_PAGES['compress-pdf'] if k != kb] + ['merge-pdf', 'images-to-pdf']
    return d


DPI_PAGES = [200, 300, 600]


def dpi_page(base, dpi):
    """A landing page for one fixed resolution."""
    d = dict(base)
    d['slug'] = '%d-dpi-converter' % dpi
    d['preset'] = {'dpi': dpi}
    d['parent'] = base['slug']
    d['title'] = 'Free %d DPI Converter \u2014 Set Any Photo to %d DPI' % (dpi, dpi)
    d['h1'] = 'Free %d dpi converter' % dpi
    d['desc'] = ('Set a photo or signature to %d dpi for a form or a print, with the printed size shown as you type. '
                 'Free, in your browser, nothing uploaded.' % dpi)
    d['intro'] = (('Drop the picture and it comes back saying %d dpi \u2014 the number is already filled in. You can also fix the printed size '
                   'in centimetres, so the result is exactly what the form asks for rather than merely close. ' % dpi) + NOTHING)
    use = {200: 'what most Indian exam forms ask for, CCC among them',
           300: 'the usual requirement for printing and for office documents',
           600: 'for fine print, archival scans and anything that will be enlarged'}[dpi]
    d['faq'] = [('How do I make an image %d dpi?' % dpi,
                 'Add the photo to the DPI converter on this page — %d dpi is already filled in as the resolution — and press the button. The number is written into the file itself, in the JFIF header of a JPG or the pHYs chunk of a PNG, so a form checker, Photoshop or a print shop reads back exactly %d dpi.' % (dpi, dpi)),
                ('Why %d dpi?' % dpi, {200: '200 dpi is what most Indian exam forms ask for — CCC among them — because at that packing a 3.5 × 4.5 cm photo works out to 276 × 354 pixels: small enough to upload easily, detailed enough for an admit card. Form signatures are commonly asked at 200 dpi too.',
                                       300: '300 dpi is the standard resolution for printing and for office documents: at that packing, printed text and photographs come out sharp at their real size. Print shops, offices and many form checkers ask for 300 dpi whenever the file will end up on paper.',
                                       600: '600 dpi is for fine print, archival scans and anything that will be enlarged later: packing the pixels twice as tightly as 300 dpi keeps small text and fine detail readable when the page is printed bigger than the original or examined closely.'}[dpi]),
                ('Can I also set the size in centimetres?',
                 'Yes. Choose "Make it an exact printed size", type the centimetres the form states, and the pixel count is worked out for you at %d dpi.' % dpi),
                ('Can I keep it under a KB limit too?',
                 'Yes. Type the limit into the maximum file size box when you set the DPI, and the picture is compressed to fit under it while still carrying %d dpi in its header — so the result passes both checks a form makes: the resolution it reads and the file size it weighs.' % dpi)]
    d['steps'] = [('Drop the photo or signature', 'JPG, PNG, WebP and HEIC all work, and several at once is fine.'),
                  ('Resolution: %d dpi' % dpi, '%d dpi is already filled in — %s. The line underneath shows the printed size in centimetres as you type.' % (dpi, use)),
                  ('Choose what should change', 'Writing only the number keeps every pixel and changes the printed size. Keeping the printed size resizes the pixels instead. The third option gives you an exact size in centimetres at that resolution — what a form like CCC means by "3.5 × 4.5 cm at 200 dpi".'),
                  ('Save it', 'Add a KB limit if the form has one, and the result is compressed to fit with %d dpi still written in.' % dpi)]
    d['related'] = ['%d-dpi-converter' % k for k in DPI_PAGES if k != dpi] + ['change-dpi', 'resize-image', 'passport-photo']
    return d


def all_pages():
    out = []
    by = {t['slug']: t for t in TOOLS}
    for t in TOOLS:
        out.append(t)
        for kb in KB_PAGES.get(t['slug'], []):
            out.append(kb_page(t, kb))
        if t['slug'] == 'change-dpi':
            for dpi in DPI_PAGES:
                out.append(dpi_page(t, dpi))
    return out
