/* Convert Files analytics + admin API (Cloudflare Worker, D1).
   Public:   POST /event            anonymous counters (view / convert / fail / tool)
             GET  /public           site totals and per-tool usage
             GET  /feedback         ratings summary + recent comments
             POST /feedback         {stars, text?, name?, page?} leave a rating (3 per visitor per day)
   Admin:    GET  /feedback/all     every rating, hidden ones included
             POST /feedback/hide    {id, hidden}
   Admin:    POST /login            {password} -> {token}
             GET  /stats?days=30&scope=genuine|own|all   totals, daily series, top lists
             POST /reset            {confirm:'RESET'} wipes the counters
             GET  /content/:name    read a content JSON file from the GitHub repo
             PUT  /content/:name    write it (commits; GitHub Actions rebuilds the site)
             GET  /adsense/summary?days=30  the publisher's own AdSense earnings
             GET  /health                                                          */

const CONTENT_FILES = { site: 'site.json', popular: 'content/popular.json', steps: 'content/steps.json', faq: 'content/faq.json',
                        about: 'content/about.json', guides: 'content/guides.json', support: 'content/support.json', sponsor: 'content/sponsor.json' };
const TOKEN_TTL = 12 * 3600;                 // seconds a login stays valid
const KEY_MAX = 80;                          // longest stored key (path / referrer / pair)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      let res;
      if (url.pathname === '/health') res = json({ ok: true, time: new Date().toISOString() });
      else if (url.pathname === '/event' && request.method === 'POST') res = await event(request, env);
      else if (url.pathname === '/public' && request.method === 'GET') res = await publicTotals(env);
      else if (url.pathname === '/feedback' && request.method === 'GET') res = await feedbackPublic(env);
      else if (url.pathname === '/feedback' && request.method === 'POST') res = await feedbackPost(request, env);
      else if (url.pathname === '/feedback/all' && request.method === 'GET') res = await guard(request, env, () => feedbackAll(url, env));
      else if (url.pathname === '/feedback/hide' && request.method === 'POST') res = await guard(request, env, () => feedbackHide(request, env));
      else if (url.pathname === '/login' && request.method === 'POST') res = await login(request, env);
      else if (url.pathname === '/stats' && request.method === 'GET') res = await guard(request, env, () => stats(url, env));
      else if (url.pathname === '/reset' && request.method === 'POST') res = await guard(request, env, () => resetCounters(request, env));
      else if (url.pathname.startsWith('/content/')) res = await guard(request, env, () => content(request, url, env));
      else if (url.pathname === '/adsense/summary' && request.method === 'GET') res = await guard(request, env, () => adsenseSummary(url, env));
      else res = json({ error: 'not found' }, 404);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const res = json({ error: e.message || String(e) }, 500);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    }
  }
};

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^capacitor:|^app:/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function today() { return new Date().toISOString().slice(0, 10); }
function clean(s, max = KEY_MAX) { return String(s || '').replace(/[^\x20-\x7e]/g, '').slice(0, max); }

/* ------------------------------------------------------------ events */
async function event(request, env) {
  let ev;
  try { ev = JSON.parse(await request.text()); } catch { return json({ error: 'bad body' }, 400); }
  const day = today(), rows = [];
  // A device that has signed into the admin panel marks its events as its own;
  // they are kept apart so the dashboard can show genuine visitors alone.
  const P = ev.own === 1 || ev.own === true ? 'own:' : '';
  const add = (metric, key = '') => rows.push(env.DB.prepare(
    'INSERT INTO daily (day, metric, key, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT(day, metric, key) DO UPDATE SET n = n + 1').bind(day, P + metric, key));
  if (ev.t === 'time') {
    // Time actually spent looking at the page, in whole seconds. Capped so a tab
    // left open overnight cannot skew the average. No session is identified.
    var secs = Math.min(1800, Math.max(1, Math.round((+ev.ms || 0) / 1000)));
    if (!secs) return new Response(null, { status: 204 });
    rows.push(env.DB.prepare(
      'INSERT INTO daily (day, metric, key, n) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(day, metric, key) DO UPDATE SET n = n + ?4').bind(day, P + 'dwell', '', secs));
    if (ev.first === true) add('dwellN');
    await env.DB.batch(rows);
    return new Response(null, { status: 204 });
  }
  if (ev.t === 'view') {
    add('views');
    if (ev.first === true) add('uniq');
    // Cloudflare resolves these at the edge from the connection. We store only
    // the daily count per place — the IP address itself is never read or kept.
    var cf = request.cf || {};
    var country = /^[A-Z]{2}$/.test(String(cf.country || '')) ? cf.country : '';
    if (country) {
      add('country', country);
      var region = clean(cf.region || '', 40);
      if (region) add('region', country + '|' + region);
    }
    let path = clean(ev.p) || '/';
    if (!path.startsWith('/')) path = '/';
    add('page', path);
    add('device', ev.d === 'mobile' ? 'mobile' : 'desktop');
    const ref = clean(ev.ref).toLowerCase();
    if (ref) add('ref', ref);
  } else if (ev.t === 'tool') {
    const tool = clean(ev.tool, 40).toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(tool)) return json({ error: 'bad tool' }, 400);
    add('conv');                       // a tool run is a conversion in the site's own total
    add('tool', tool);
  } else if (ev.t === 'convert' || ev.t === 'fail') {
    const from = clean(ev.from, 12).toLowerCase(), to = clean(ev.to, 12).toLowerCase();
    if (!/^[a-z0-9*]{1,12}$/.test(from) || !/^[a-z0-9]{1,12}$/.test(to)) return json({ error: 'bad pair' }, 400);
    add(ev.t === 'convert' ? 'conv' : 'fail');
    add(ev.t === 'convert' ? 'pair' : 'failpair', from + '>' + to);
  } else {
    return json({ error: 'unknown event' }, 400);
  }
  await env.DB.batch(rows);
  return new Response(null, { status: 204 });
}

/* ------------------------------------------- public totals (no auth) */
// Two numbers the site shows on its home page. Nothing here is personal, and the
// edge caches it for a minute so a busy day does not hit the database per visit.
async function publicTotals(env) {
  const r = await env.DB.prepare("SELECT metric, SUM(n) AS n FROM daily WHERE key = '' AND metric IN ('conv', 'views') GROUP BY metric").all();
  const t = {};
  for (const row of r.results) t[row.metric] = row.n;
  const first = await env.DB.prepare('SELECT MIN(day) AS d FROM daily').first();
  // how often each tool has been used, so the home page can list the popular ones first
  const tr = await env.DB.prepare("SELECT key, SUM(n) AS n FROM daily WHERE metric = 'tool' GROUP BY key").all();
  const tools = {};
  for (const row of tr.results) if (row.key) tools[row.key] = row.n;
  const res = json({ conv: t.conv || 0, views: t.views || 0, since: (first && first.d) || null, tools });
  res.headers.set('cache-control', 'public, max-age=60');
  return res;
}

/* ---------------------------------------------------------- feedback */
// Text keeps letters in any script (Hindi included) and drops control characters.
function cleanText(s, max) { return String(s || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function feedbackPost(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (body.website) return new Response(null, { status: 204 });          // honeypot: bots fill every field
  const stars = parseInt(body.stars, 10);
  if (!(stars >= 1 && stars <= 5)) return json({ error: 'stars must be 1 to 5' }, 400);
  const text = cleanText(body.text, 300), name = cleanText(body.name, 40);
  let page = clean(body.page, 80); if (!page.startsWith('/')) page = '/';
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const day = new Date().toISOString().slice(0, 10);
  const iph = (await sha256hex(ip + ':' + day + ':' + (env.TOKEN_SECRET || 'salt'))).slice(0, 24);
  const today = await env.DB.prepare('SELECT COUNT(*) AS n FROM feedback WHERE iph = ?1 AND ts > ?2').bind(iph, Date.now() - 86400000).first();
  if (today && today.n >= 3) return json({ error: 'that is enough for one day — thank you' }, 429);
  // links in a comment are almost always spam; they go in hidden and the admin can unhide
  const hidden = /https?:\/\/|www\.|\.(com|in|net|org|io)\b/i.test(text) ? 1 : 0;
  await env.DB.prepare('INSERT INTO feedback (ts, stars, text, name, page, hidden, iph) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(Date.now(), stars, text, name, page, hidden, iph).run();
  return json({ ok: true, hidden: !!hidden });
}
async function feedbackPublic(env) {
  const agg = await env.DB.prepare('SELECT stars, COUNT(*) AS n FROM feedback WHERE hidden = 0 GROUP BY stars').all();
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0, sum = 0;
  for (const r of agg.results) { dist[r.stars] = r.n; count += r.n; sum += r.stars * r.n; }
  const recent = await env.DB.prepare("SELECT id, ts, stars, text, name, page FROM feedback WHERE hidden = 0 AND text != '' ORDER BY ts DESC LIMIT 12").all();
  const res = json({ count, avg: count ? Math.round(sum / count * 10) / 10 : 0, dist, recent: recent.results });
  res.headers.set('cache-control', 'public, max-age=60');
  return res;
}
async function feedbackAll(url, env) {
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '200', 10)));
  const r = await env.DB.prepare('SELECT id, ts, stars, text, name, page, hidden FROM feedback ORDER BY ts DESC LIMIT ?1').bind(limit).all();
  return json({ rows: r.results });
}
async function feedbackHide(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const id = parseInt(body.id, 10);
  if (!(id > 0)) return json({ error: 'bad id' }, 400);
  await env.DB.prepare('UPDATE feedback SET hidden = ?1 WHERE id = ?2').bind(body.hidden ? 1 : 0, id).run();
  return json({ ok: true });
}

/* -------------------------------------------------------------- auth */
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.TOKEN_SECRET) return json({ error: 'the API has no ADMIN_PASSWORD / TOKEN_SECRET set yet' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const pw = String(body.password || '');
  // hash both sides so the comparison cost does not depend on the password length
  const a = await hmac(env.TOKEN_SECRET, pw), b = await hmac(env.TOKEN_SECRET, env.ADMIN_PASSWORD);
  if (!safeEqual(a, b)) { await new Promise(r => setTimeout(r, 800)); return json({ error: 'wrong password' }, 401); }
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  return json({ token: exp + '.' + await hmac(env.TOKEN_SECRET, 'login:' + exp), expires: exp });
}
async function guard(request, env, fn) {
  const auth = request.headers.get('Authorization') || '';
  const m = /^Bearer (\d+)\.([0-9a-f]{64})$/.exec(auth);
  if (!m || !env.TOKEN_SECRET) return json({ error: 'sign in first' }, 401);
  const exp = +m[1];
  if (exp < Date.now() / 1000) return json({ error: 'session expired, sign in again' }, 401);
  if (!safeEqual(m[2], await hmac(env.TOKEN_SECRET, 'login:' + exp))) return json({ error: 'sign in first' }, 401);
  return fn();
}

/* ------------------------------------------------------------- stats */
// Which rows a dashboard view counts: genuine visitors (default), the owner's
// own devices, or everything together. Owner rows carry an "own:" prefix.
function scopeOf(url) { const s = url.searchParams.get('scope'); return s === 'own' || s === 'all' ? s : 'genuine'; }
function scopeSql(scope) {
  if (scope === 'own') return { m: 'SUBSTR(metric, 5)', where: "metric LIKE 'own:%'" };
  if (scope === 'all') return { m: "REPLACE(metric, 'own:', '')", where: '1 = 1' };
  return { m: 'metric', where: "metric NOT LIKE 'own:%'" };
}
function names(scope, metric) { return scope === 'own' ? [`own:${metric}`] : scope === 'all' ? [metric, `own:${metric}`] : [metric]; }
async function stats(url, env) {
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') || '30', 10)));
  const scope = scopeOf(url), sq = scopeSql(scope);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const since7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const pairNames = names(scope, 'pair');
  const [totals, series, pairs, pages, devices, refs, fails, pairDays, countries, regions] = await Promise.all([
    env.DB.prepare(`SELECT ${sq.m} AS metric, SUM(n) AS n FROM daily WHERE key = '' AND ${sq.where} GROUP BY 1`).all(),
    env.DB.prepare(`SELECT day, ${sq.m} AS metric, SUM(n) AS n FROM daily WHERE key = '' AND day >= ?1 AND ${sq.where} GROUP BY day, 2 ORDER BY day`).bind(since).all(),
    top(env, 'pair', since, 20, scope), top(env, 'page', since, 20, scope), top(env, 'device', since, 5, scope), top(env, 'ref', since, 20, scope), top(env, 'failpair', since, 10, scope),
    env.DB.prepare(`SELECT day, key, SUM(n) AS n FROM daily WHERE metric IN (${pairNames.map(() => '?').join(',')}) AND day >= ?${pairNames.length + 1} GROUP BY day, key`).bind(...pairNames, since7).all(),
    top(env, 'country', since, 30, scope), top(env, 'region', since, 30, scope),
  ]);
  // heatmap: the last 7 days x the 8 busiest conversion pairs of that week
  const heatDays = [];
  for (let i = 6; i >= 0; i--) heatDays.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const perPair = {};
  for (const r of pairDays.results) { (perPair[r.key] = perPair[r.key] || {})[r.day] = r.n; }
  const heatPairs = Object.keys(perPair)
    .map(k => ({ key: k, total: Object.values(perPair[k]).reduce((a, b) => a + b, 0), cells: heatDays.map(d => perPair[k][d] || 0) }))
    .sort((a, b) => b.total - a.total).slice(0, 8);
  const t = {};
  for (const r of totals.results) t[r.metric] = r.n;
  const byDay = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    byDay[d] = { day: d, views: 0, uniq: 0, conv: 0, fail: 0 };
  }
  for (const r of series.results) if (byDay[r.day]) byDay[r.day][r.metric] = r.n;
  const daily = Object.values(byDay);
  const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] || 0), 0);
  const window = n => daily.slice(-n);
  return json({
    generated: new Date().toISOString(), days, scope,
    totals: { views: t.views || 0, uniq: t.uniq || 0, conv: t.conv || 0, fail: t.fail || 0 },
    today: daily[daily.length - 1],
    yesterday: daily[daily.length - 2] || null,
    last7: { views: sum(window(7), 'views'), uniq: sum(window(7), 'uniq'), conv: sum(window(7), 'conv') },
    last30: { views: sum(window(30), 'views'), uniq: sum(window(30), 'uniq'), conv: sum(window(30), 'conv') },
    daily,
    pairs: pairs.results, pages: pages.results, devices: devices.results, referrers: refs.results, failures: fails.results,
    heat: { days: heatDays, pairs: heatPairs },
    countries: countries.results,
    regions: regions.results.map(r => {
      const i = r.key.indexOf('|');
      return { country: i < 0 ? '' : r.key.slice(0, i), region: i < 0 ? r.key : r.key.slice(i + 1), n: r.n };
    }),
    dwell: { seconds: t.dwell || 0, sessions: t.dwellN || 0, avg: t.dwellN ? Math.round((t.dwell || 0) / t.dwellN) : 0 },
  });
}
function top(env, metric, since, limit, scope) {
  const ms = names(scope || 'genuine', metric);
  return env.DB.prepare(`SELECT key, SUM(n) AS n FROM daily WHERE metric IN (${ms.map(() => '?').join(',')}) AND day >= ? GROUP BY key ORDER BY n DESC LIMIT ?`).bind(...ms, since, limit).all();
}
// Wipe every counter (not the feedback). The admin asks twice before calling this.
async function resetCounters(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (body.confirm !== 'RESET') return json({ error: 'send {"confirm":"RESET"}' }, 400);
  await env.DB.prepare('DELETE FROM daily').run();
  return json({ ok: true });
}

/* ----------------------------------------------------------- content */
async function content(request, url, env) {
  const name = url.pathname.split('/')[2];
  const path = CONTENT_FILES[name];
  if (!path) return json({ error: 'unknown content file' }, 404);
  if (!env.GITHUB_TOKEN) return json({ error: 'the API has no GITHUB_TOKEN set yet' }, 503);
  const api = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`;
  const headers = { 'Authorization': 'Bearer ' + env.GITHUB_TOKEN, 'User-Agent': 'convertfiles-admin', 'Accept': 'application/vnd.github+json' };
  const cur = await fetch(api, { headers });
  if (!cur.ok) return json({ error: 'GitHub read failed: ' + cur.status }, 502);
  const meta = await cur.json();
  const text = new TextDecoder().decode(Uint8Array.from(atob(meta.content.replace(/\n/g, '')), c => c.charCodeAt(0)));
  if (request.method === 'GET') return json({ name, path, sha: meta.sha, data: JSON.parse(text) });
  if (request.method !== 'PUT') return json({ error: 'method' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  if (body.data === undefined) return json({ error: 'missing data' }, 400);
  const next = JSON.stringify(body.data, null, 2) + '\n';
  const bytes = new TextEncoder().encode(next);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  const put = await fetch(api.split('?')[0], { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `admin: update ${path}`, content: btoa(bin), sha: meta.sha, branch: env.GITHUB_BRANCH || 'main' }) });
  if (!put.ok) return json({ error: 'GitHub write failed: ' + put.status + ' ' + (await put.text()).slice(0, 200) }, 502);
  const r = await put.json();
  return json({ ok: true, name, path, sha: r.content && r.content.sha, commit: r.commit && r.commit.html_url });
}

/* --------------------------------------------------------- AdSense earnings
   Reads the publisher's own AdSense figures through the AdSense Management
   API v2 and hands them to the admin panel and the phone app. The Google
   credentials stay here: an APK can be taken apart, so a refresh token must
   never travel inside one. Callers authenticate with the ordinary admin
   token, so whoever knows ADMIN_PASSWORD sees the earnings and nobody else.

   Secrets:  ADSENSE_CLIENT_ID  ADSENSE_CLIENT_SECRET  ADSENSE_REFRESH_TOKEN  */

const ADSENSE_API = 'https://adsense.googleapis.com/v2';
let _tok = { value: '', expires: 0 };     // best-effort cache, per isolate
let _account = '';

async function accessToken(env) {
  const now = Date.now() / 1000;
  if (_tok.value && _tok.expires > now + 60) return _tok.value;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: env.ADSENSE_REFRESH_TOKEN,
    client_id: env.ADSENSE_CLIENT_ID,
    client_secret: env.ADSENSE_CLIENT_SECRET,
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error('google refused the refresh token: ' + (j.error_description || j.error || r.status));
  }
  _tok = { value: j.access_token, expires: now + (j.expires_in || 3600) };
  return _tok.value;
}

// The publisher account this refresh token belongs to, e.g. accounts/pub-123.
async function adsenseAccount(env, tok) {
  if (_account) return _account;
  const r = await fetch(ADSENSE_API + '/accounts', { headers: { Authorization: 'Bearer ' + tok } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('could not list AdSense accounts: ' + (j.error && j.error.message || r.status));
  const first = (j.accounts || [])[0];
  if (!first) throw new Error('this Google account has no AdSense account');
  _account = first.name;
  return _account;
}

function ymd(d) { return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }

// One report. `dims` may be empty for a plain total.
async function adsenseReport(env, tok, account, dims, start, end, currency) {
  const p = new URLSearchParams();
  const a = ymd(start), b = ymd(end);
  p.set('dateRange', 'CUSTOM');
  p.set('startDate.year', a.y); p.set('startDate.month', a.m); p.set('startDate.day', a.d);
  p.set('endDate.year', b.y); p.set('endDate.month', b.m); p.set('endDate.day', b.d);
  // Only the five raw counters. Rates (CPC, RPM, CTR) are worked out below,
  // which keeps us clear of the API's metric/dimension compatibility rules.
  for (const m of ['ESTIMATED_EARNINGS', 'CLICKS', 'IMPRESSIONS', 'PAGE_VIEWS', 'AD_REQUESTS']) p.append('metrics', m);
  for (const d of dims) p.append('dimensions', d);
  if (dims.length) { p.set('orderBy', '-ESTIMATED_EARNINGS'); p.set('limit', '50'); }
  p.set('currencyCode', currency);
  p.set('reportingTimeZone', 'ACCOUNT_TIME_ZONE');
  const r = await fetch(`${ADSENSE_API}/${account}/reports:generate?` + p.toString(),
                        { headers: { Authorization: 'Bearer ' + tok } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('AdSense report failed: ' + (j.error && j.error.message || r.status));
  return j;
}

// Turn the API's cell grid into plain objects keyed by header name.
function rowsOf(rep) {
  const heads = (rep.headers || []).map(h => h.name);
  return (rep.rows || []).map(row => {
    const o = {};
    (row.cells || []).forEach((c, i) => { o[heads[i]] = c.value; });
    return o;
  });
}
function totalsOf(rep) {
  const heads = (rep.headers || []).map(h => h.name);
  const o = {};
  ((rep.totals || {}).cells || []).forEach((c, i) => { o[heads[i]] = c.value; });
  return o;
}
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// Earnings per click and per thousand impressions, plus click-through rate.
// AdSense does not say how much of the money came from clicks and how much
// from impressions, so these are rates, never a split of the total.
function rates(earn, clicks, impressions) {
  return {
    perClick: clicks > 0 ? earn / clicks : 0,
    per1000Views: impressions > 0 ? (earn / impressions) * 1000 : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
  };
}

function breakdown(usdRep, inrRep, keys) {
  const inrBy = new Map();
  for (const r of rowsOf(inrRep)) inrBy.set(keys.map(k => r[k] || '').join('|'), num(r.ESTIMATED_EARNINGS));
  return rowsOf(usdRep).map(r => {
    const id = keys.map(k => r[k] || '').join('|');
    const usd = num(r.ESTIMATED_EARNINGS), clicks = num(r.CLICKS), impressions = num(r.IMPRESSIONS);
    const inr = inrBy.get(id) || 0;
    // A rate has to exist in both currencies, or a caller showing rupees ends
    // up printing a dollar figure behind a rupee sign.
    const ru = rates(usd, clicks, impressions), ri = rates(inr, clicks, impressions);
    return {
      key: id,
      label: r[keys[keys.length - 1]] || r[keys[0]] || '—',
      code: keys.length > 1 ? (r[keys[0]] || '') : '',
      usd, inr,
      clicks, impressions,
      pageViews: num(r.PAGE_VIEWS), adRequests: num(r.AD_REQUESTS),
      perClickUsd: ru.perClick, perClickInr: ri.perClick,
      per1000ViewsUsd: ru.per1000Views, per1000ViewsInr: ri.per1000Views,
      ctr: ru.ctr,
    };
  });
}

async function adsenseSummary(url, env) {
  if (!env.ADSENSE_REFRESH_TOKEN || !env.ADSENSE_CLIENT_ID || !env.ADSENSE_CLIENT_SECRET) {
    return json({ error: 'not_configured',
                  message: 'The API has no AdSense credentials yet. Set ADSENSE_CLIENT_ID, '
                           + 'ADSENSE_CLIENT_SECRET and ADSENSE_REFRESH_TOKEN with `wrangler secret put`.' }, 503);
  }
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') || '30', 10)));
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  try {
    const tok = await accessToken(env);
    const account = await adsenseAccount(env, tok);
    const want = [['DATE'], ['COUNTRY_CODE', 'COUNTRY_NAME'], ['PLATFORM_TYPE_NAME'], ['AD_UNIT_NAME'], ['PRODUCT_NAME']];
    const jobs = [];
    for (const dims of want) for (const cur of ['USD', 'INR']) jobs.push(adsenseReport(env, tok, account, dims, start, end, cur));
    const out = await Promise.all(jobs);
    const [dateUsd, dateInr, cUsd, cInr, pUsd, pInr, uUsd, uInr, prUsd, prInr] = out;

    const tU = totalsOf(dateUsd), tI = totalsOf(dateInr);
    const usd = num(tU.ESTIMATED_EARNINGS), inr = num(tI.ESTIMATED_EARNINGS);
    const clicks = num(tU.CLICKS), impressions = num(tU.IMPRESSIONS);
    const rUsd = rates(usd, clicks, impressions), rInr = rates(inr, clicks, impressions);

    const daily = (() => {
      const inrBy = new Map();
      for (const r of rowsOf(dateInr)) inrBy.set(r.DATE, num(r.ESTIMATED_EARNINGS));
      return rowsOf(dateUsd).map(r => ({
        date: r.DATE, usd: num(r.ESTIMATED_EARNINGS), inr: inrBy.get(r.DATE) || 0,
        clicks: num(r.CLICKS), impressions: num(r.IMPRESSIONS), pageViews: num(r.PAGE_VIEWS),
      }));
    })();

    return json({
      ok: true,
      account,
      range: { days, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
      totals: {
        usd, inr, clicks, impressions,
        pageViews: num(tU.PAGE_VIEWS), adRequests: num(tU.AD_REQUESTS),
        perClickUsd: rUsd.perClick, perClickInr: rInr.perClick,
        per1000ViewsUsd: rUsd.per1000Views, per1000ViewsInr: rInr.per1000Views,
        ctr: rUsd.ctr,
      },
      daily,
      countries: breakdown(cUsd, cInr, ['COUNTRY_CODE', 'COUNTRY_NAME']),
      platforms: breakdown(pUsd, pInr, ['PLATFORM_TYPE_NAME']),
      units: breakdown(uUsd, uInr, ['AD_UNIT_NAME']),
      products: breakdown(prUsd, prInr, ['PRODUCT_NAME']),
      // Stated here so every caller shows the same thing and nobody invents it.
      notes: {
        splitByClickOrView: 'AdSense reports one estimated earnings figure. It does not say how much came '
                            + 'from clicks and how much from impressions, so this shows the rate per click '
                            + 'and the rate per 1000 views instead of a split.',
        purchases: 'AdSense pays for clicks and impressions, not for anything a visitor buys afterwards. '
                   + 'Purchase or conversion revenue belongs to the advertiser and is not reported to publishers.',
        geography: 'AdSense geography stops at the country. There is no state or city breakdown in its API.',
      },
    });
  } catch (e) {
    return json({ error: 'adsense_failed', message: String(e.message || e) }, 502);
  }
}
