/* theme.js — the header Theme picker. Ten animated themes; the choice is
   kept in localStorage ('cf-theme') and applied by the tiny inline script
   in <head> (see build.py site_head) before the page paints. This file
   only builds the panel and switches themes — no reload, ever. */
(function () {
  var THEMES = [
    ['aurora', 'Aurora Flow', 'linear-gradient(135deg,#7C3AED,#0EA5E9 55%,#EC4899)'],
    ['neon', 'Neon Night', 'linear-gradient(135deg,#22D3EE,#D946EF)'],
    ['liquid', 'Liquid Glass', 'linear-gradient(135deg,#FBCFE8,#BAE6FD 55%,#FEF9C3)'],
    ['ocean', 'Ocean Depth', 'linear-gradient(180deg,#2DD4BF,#075985)'],
    ['candy', 'Candy Pop', 'linear-gradient(135deg,#F43F5E,#FACC15 55%,#38BDF8)'],
    ['mono', 'Mono Luxe', 'linear-gradient(135deg,#FAFAFA,#262626)'],
    ['sunset', 'Sunset Drift', 'linear-gradient(135deg,#FB7185,#A78BFA)'],
    ['forest', 'Forest Mist', 'linear-gradient(135deg,#34D399,#0D9488)'],
    ['cyber', 'Cyber Grid', 'linear-gradient(135deg,#22D3EE,#6366F1)'],
    ['starfield', 'Starfield', 'linear-gradient(135deg,#A5B4FC,#7C3AED)']
  ];
  var btn = document.getElementById('themeBtn');
  var panel = document.getElementById('themePanel');
  if (!btn || !panel) return;

  function current() {
    return document.documentElement.getAttribute('data-theme') || 'liquid';
  }
  function mark() {
    var cur = current();
    var opts = panel.querySelectorAll('.theme-opt');
    for (var i = 0; i < opts.length; i++) {
      var on = opts[i].getAttribute('data-theme-id') === cur;
      opts[i].setAttribute('aria-selected', on ? 'true' : 'false');
      opts[i].querySelector('.theme-check').hidden = !on;
    }
  }
  function setTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    try { localStorage.setItem('cf-theme', id); } catch (e) { /* private mode */ }
    mark();
  }
  function open() { mark(); panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
  function close() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }

  THEMES.forEach(function (t) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-opt';
    b.setAttribute('role', 'option');
    b.setAttribute('data-theme-id', t[0]);
    var dot = document.createElement('span');
    dot.className = 'theme-dot';
    dot.style.background = t[2];
    var check = document.createElement('span');
    check.className = 'theme-check';
    check.textContent = '\u2713';
    check.hidden = true;
    b.appendChild(dot);
    b.appendChild(document.createTextNode(t[1]));
    b.appendChild(check);
    b.addEventListener('click', function () { setTheme(t[0]); close(); btn.focus(); });
    panel.appendChild(b);
  });

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (panel.hidden) open(); else close();
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { if (!panel.hidden) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); }
  });
  mark();
})();
