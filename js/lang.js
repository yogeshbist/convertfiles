/* Language picker.
   Why a custom dropdown: Google retired its free Website Translator widget on
   1 Oct 2026, and the direct replacement (GTranslate) is only free for
   non-commercial sites. So we render our own searchable language menu and send
   the visitor to Google Translate's free site proxy (convertfiles-in.translate.goog)
   when they pick a language. Default is English on the canonical domain.
   Privacy: only the page text is translated by Google, and only after the
   visitor chooses it. Uploaded files never leave the device. */
(function () {
  'use strict';

  /* [code, native name, English name] — every language Google Translate supports. */
  var LANGS = [
    ['af', 'Afrikaans', 'Afrikaans'],
    ['sq', 'Shqip', 'Albanian'],
    ['am', 'አማርኛ', 'Amharic'],
    ['ar', 'العربية', 'Arabic'],
    ['hy', 'Հայերեն', 'Armenian'],
    ['as', 'অসমীয়া', 'Assamese'],
    ['ay', 'Aymar aru', 'Aymara'],
    ['az', 'Azərbaycan', 'Azerbaijani'],
    ['bm', 'Bamanankan', 'Bambara'],
    ['eu', 'Euskara', 'Basque'],
    ['be', 'Беларуская', 'Belarusian'],
    ['bn', 'বাংলা', 'Bengali'],
    ['bho', 'भोजपुरी', 'Bhojpuri'],
    ['bs', 'Bosanski', 'Bosnian'],
    ['bg', 'Български', 'Bulgarian'],
    ['ca', 'Català', 'Catalan'],
    ['ceb', 'Bisaya', 'Cebuano'],
    ['zh-CN', '中文简体', 'Chinese (Simplified)'],
    ['zh-TW', '中文繁體', 'Chinese (Traditional)'],
    ['co', 'Corsu', 'Corsican'],
    ['hr', 'Hrvatski', 'Croatian'],
    ['cs', 'Čeština', 'Czech'],
    ['da', 'Dansk', 'Danish'],
    ['dv', 'ދިވެހި', 'Divehi'],
    ['doi', 'डोगरी', 'Dogri'],
    ['nl', 'Nederlands', 'Dutch'],
    ['en', 'English', 'English'],
    ['eo', 'Esperanto', 'Esperanto'],
    ['et', 'Eesti', 'Estonian'],
    ['ee', 'Eʋegbe', 'Ewe'],
    ['fil', 'Filipino', 'Filipino'],
    ['fi', 'Suomi', 'Finnish'],
    ['fr', 'Français', 'French'],
    ['fy', 'Frysk', 'Frisian'],
    ['gl', 'Galego', 'Galician'],
    ['ka', 'ქართული', 'Georgian'],
    ['de', 'Deutsch', 'German'],
    ['el', 'Ελληνικά', 'Greek'],
    ['gn', "Avañe'ẽ", 'Guarani'],
    ['gu', 'ગુજરાતી', 'Gujarati'],
    ['ht', 'Kreyòl Ayisyen', 'Haitian Creole'],
    ['ha', 'Hausa', 'Hausa'],
    ['haw', 'ʻŌlelo Hawaiʻi', 'Hawaiian'],
    ['iw', 'עברית', 'Hebrew'],
    ['hi', 'हिन्दी', 'Hindi'],
    ['hmn', 'Hmoob', 'Hmong'],
    ['hu', 'Magyar', 'Hungarian'],
    ['is', 'Íslenska', 'Icelandic'],
    ['ig', 'Igbo', 'Igbo'],
    ['ilo', 'Ilokano', 'Iloko'],
    ['id', 'Indonesia', 'Indonesian'],
    ['ga', 'Gaeilge', 'Irish'],
    ['it', 'Italiano', 'Italian'],
    ['ja', '日本語', 'Japanese'],
    ['jv', 'Jawa', 'Javanese'],
    ['kn', 'ಕನ್ನಡ', 'Kannada'],
    ['kk', 'Қазақша', 'Kazakh'],
    ['km', 'ខ្មែរ', 'Khmer'],
    ['rw', 'Ikinyarwanda', 'Kinyarwanda'],
    ['gom', 'कोंकणी', 'Konkani'],
    ['ko', '한국어', 'Korean'],
    ['kri', 'Krio', 'Krio'],
    ['ku', 'Kurdî', 'Kurdish'],
    ['ckb', 'کوردی', 'Kurdish (Sorani)'],
    ['ky', 'Кыргызча', 'Kyrgyz'],
    ['lo', 'ລາວ', 'Lao'],
    ['la', 'Latina', 'Latin'],
    ['lv', 'Latviešu', 'Latvian'],
    ['ln', 'Lingála', 'Lingala'],
    ['lt', 'Lietuvių', 'Lithuanian'],
    ['lg', 'Oluganda', 'Luganda'],
    ['lb', 'Lëtzebuergesch', 'Luxembourgish'],
    ['mk', 'Македонски', 'Macedonian'],
    ['mai', 'मैथिली', 'Maithili'],
    ['mg', 'Malagasy', 'Malagasy'],
    ['ms', 'Melayu', 'Malay'],
    ['ml', 'മലയാളം', 'Malayalam'],
    ['mt', 'Malti', 'Maltese'],
    ['mi', 'Māori', 'Maori'],
    ['mr', 'मराठी', 'Marathi'],
    ['mni-Mtei', 'মৈতৈলোন্', 'Meiteilon (Manipuri)'],
    ['lus', 'Mizo', 'Mizo'],
    ['mn', 'Монгол', 'Mongolian'],
    ['my', 'မြန်မာ', 'Myanmar (Burmese)'],
    ['ne', 'नेपाली', 'Nepali'],
    ['no', 'Norsk', 'Norwegian'],
    ['or', 'ଓଡ଼ିଆ', 'Odia (Oriya)'],
    ['om', 'Afaan Oromoo', 'Oromo'],
    ['ps', 'پښتو', 'Pashto'],
    ['fa', 'فارسی', 'Persian'],
    ['pl', 'Polski', 'Polish'],
    ['pt', 'Português', 'Portuguese'],
    ['pa', 'ਪੰਜਾਬੀ', 'Punjabi'],
    ['qu', 'Runa Simi', 'Quechua'],
    ['ro', 'Română', 'Romanian'],
    ['ru', 'Русский', 'Russian'],
    ['sm', 'Gagana Samoa', 'Samoan'],
    ['sa', 'संस्कृतम्', 'Sanskrit'],
    ['gd', 'Gàidhlig', 'Scots Gaelic'],
    ['nso', 'Sesotho sa Leboa', 'Sepedi'],
    ['sr', 'Српски', 'Serbian'],
    ['st', 'Sesotho', 'Sesotho'],
    ['sn', 'chiShona', 'Shona'],
    ['sd', 'سنڌي', 'Sindhi'],
    ['si', 'සිංහල', 'Sinhala'],
    ['sk', 'Slovenčina', 'Slovak'],
    ['sl', 'Slovenščina', 'Slovenian'],
    ['so', 'Soomaali', 'Somali'],
    ['es', 'Español', 'Spanish'],
    ['su', 'Basa Sunda', 'Sundanese'],
    ['sw', 'Kiswahili', 'Swahili'],
    ['sv', 'Svenska', 'Swedish'],
    ['tg', 'Тоҷикӣ', 'Tajik'],
    ['ta', 'தமிழ்', 'Tamil'],
    ['tt', 'Татарча', 'Tatar'],
    ['te', 'తెలుగు', 'Telugu'],
    ['th', 'ไทย', 'Thai'],
    ['ti', 'ትግርኛ', 'Tigrinya'],
    ['ts', 'Xitsonga', 'Tsonga'],
    ['tr', 'Türkçe', 'Turkish'],
    ['tk', 'Türkmençe', 'Turkmen'],
    ['ug', 'ئۇيغۇرچە', 'Uyghur'],
    ['uk', 'Українська', 'Ukrainian'],
    ['ur', 'اردو', 'Urdu'],
    ['uz', "O'zbek", 'Uzbek'],
    ['vi', 'Tiếng Việt', 'Vietnamese'],
    ['cy', 'Cymraeg', 'Welsh'],
    ['xh', 'isiXhosa', 'Xhosa'],
    ['yi', 'ייִדיש', 'Yiddish'],
    ['yo', 'Yorùbá', 'Yoruba'],
    ['zu', 'isiZulu', 'Zulu']
  ];

  var PROXY_HOST = 'convertfiles-in.translate.goog';
  var CANONICAL = 'https://convertfiles.in';

  var btn = document.getElementById('langBtn');
  var panel = document.getElementById('langPanel');
  var search = document.getElementById('langSearch');
  var list = document.getElementById('langList');
  var cur = document.getElementById('langCur');
  if (!btn || !panel) return;

  function onProxy() {
    return location.hostname.indexOf('translate.goog') !== -1;
  }

  function currentCode() {
    var m = location.search.match(/[?&]_x_tr_tl=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : 'en';
  }

  /* Drop Google's _x_tr_* params so the canonical URL stays clean. */
  function cleanSearch() {
    var parts = location.search.replace(/^\?/, '').split('&');
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i].indexOf('_x_tr_') !== 0) kept.push(parts[i]);
    }
    return kept.length ? '?' + kept.join('&') : '';
  }

  function targetUrl(code) {
    var path = location.pathname + cleanSearch() + location.hash;
    if (code === 'en') return CANONICAL + path;
    var host = onProxy() ? location.hostname : PROXY_HOST;
    var sep = cleanSearch() ? '&' : '?';
    return 'https://' + host + path + sep +
      '_x_tr_sl=en&_x_tr_tl=' + encodeURIComponent(code) + '&_x_tr_hl=en';
  }

  function nativeName(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i][0] === code) return LANGS[i][1];
    }
    return 'English';
  }

  function render(filter) {
    var q = (filter || '').toLowerCase();
    var html = '';
    var shown = 0;
    for (var i = 0; i < LANGS.length; i++) {
      var code = LANGS[i][0], native = LANGS[i][1], eng = LANGS[i][2];
      if (q && native.toLowerCase().indexOf(q) === -1 &&
          eng.toLowerCase().indexOf(q) === -1 && code.toLowerCase() !== q) continue;
      var sel = code === currentCode() ? ' aria-selected="true"' : '';
      html += '<li role="option"' + sel + '><button type="button" data-code="' +
        code + '">' + escapeHtml(native) +
        '<span>' + escapeHtml(eng) + '</span></button></li>';
      shown++;
    }
    list.innerHTML = html || '<li class="lang-empty">No language found</li>';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function open() {
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    search.value = '';
    render('');
    search.focus();
  }

  function close() {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (panel.hidden) open(); else close();
  });

  document.addEventListener('click', function (e) {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); }
  });

  search.addEventListener('input', function () { render(search.value); });

  list.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-code]') : null;
    if (!b) return;
    location.href = targetUrl(b.getAttribute('data-code'));
  });

  /* Label the button with the active language (default: English). */
  cur.textContent = nativeName(currentCode());
})();
