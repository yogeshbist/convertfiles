#!/usr/bin/env python3
"""Get the one AdSense refresh token the Worker needs.

Google will not hand out earnings data to an API key — it wants a real sign-in
by the person who owns the account. That sign-in only has to happen once: it
produces a refresh token, the Worker keeps it as a secret, and from then on the
Worker mints its own short-lived access tokens without anyone being present.

    python3 adsense-token.py

It asks for the OAuth client id and secret from your Google Cloud project,
opens the consent screen in a browser, catches the redirect on localhost and
prints the three `wrangler secret put` commands to run.

Before running it, once, in the Google Cloud console:
  1. Create a project (any name).
  2. APIs & Services -> Library -> enable "AdSense Management API".
  3. APIs & Services -> OAuth consent screen -> External. Add yourself under
     "Test users" — the app stays in Testing, which is all this needs and
     avoids Google's verification review.
  4. Credentials -> Create credentials -> OAuth client ID -> Web application.
     Under "Authorised redirect URIs" add exactly:
         http://localhost:8765/
  5. Copy the client id and client secret; this script asks for them.

Nothing is written to disk. The token is printed once, for you to paste.
"""

import http.server
import json
import secrets
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

REDIRECT_PORT = 8765
REDIRECT_URI = f'http://localhost:{REDIRECT_PORT}/'
SCOPE = 'https://www.googleapis.com/auth/adsense.readonly'
AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN = 'https://oauth2.googleapis.com/token'

_result = {}


class Catch(http.server.BaseHTTPRequestHandler):
    """Receives Google's redirect, once, then lets the program carry on."""

    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        _result.update({k: v[0] for k, v in q.items()})
        ok = 'code' in _result
        body = (
            '<html><body style="font:16px system-ui;padding:3rem;text-align:center">'
            + ('<h2>Done.</h2><p>You can close this tab and go back to the terminal.</p>'
               if ok else
               f'<h2>Google said no.</h2><p>{_result.get("error", "unknown error")}</p>')
            + '</body></html>'
        ).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass                      # keep the console clean


def ask(label):
    v = input(label).strip()
    if not v:
        sys.exit('Nothing entered — stopping.')
    return v


def post(url, fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(url, data=data,
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit('Google refused the exchange: %s\n%s' % (e.code, e.read().decode()[:500]))


def main():
    print(__doc__.split('Before running it')[0].strip())
    print()
    client_id = ask('OAuth client id     : ')
    client_secret = ask('OAuth client secret : ')
    state = secrets.token_urlsafe(16)

    url = AUTH + '?' + urllib.parse.urlencode({
        'client_id': client_id,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': SCOPE,
        'access_type': 'offline',       # this is what makes a refresh token appear
        'prompt': 'consent',            # and what makes it appear every time
        'state': state,
    })

    server = http.server.HTTPServer(('localhost', REDIRECT_PORT), Catch)
    threading.Thread(target=server.handle_request, daemon=True).start()

    print('\nOpening the Google sign-in. Choose the account that owns AdSense.')
    print('If nothing opens, paste this into a browser:\n\n%s\n' % url)
    try:
        webbrowser.open(url)
    except Exception:
        pass

    print('Waiting for the redirect…')
    for _ in range(600):              # ~5 minutes, checked twice a second
        if _result:
            break
        threading.Event().wait(0.5)
    server.server_close()

    if 'code' not in _result:
        sys.exit('No authorisation code came back: %s' % (_result.get('error') or 'timed out'))
    if _result.get('state') != state:
        sys.exit('The state did not match — stopping rather than trusting that redirect.')

    tok = post(TOKEN, {
        'code': _result['code'],
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code',
    })
    refresh = tok.get('refresh_token')
    if not refresh:
        sys.exit('Google returned no refresh token. That happens when the account has '
                 'already granted this client before — remove it at '
                 'https://myaccount.google.com/permissions and run this again.')

    # Prove it works before telling anyone it does.
    access = tok.get('access_token')
    who = ''
    try:
        req = urllib.request.Request('https://adsense.googleapis.com/v2/accounts',
                                     headers={'Authorization': 'Bearer ' + access})
        with urllib.request.urlopen(req, timeout=30) as r:
            accounts = json.load(r).get('accounts') or []
        who = accounts[0]['name'] if accounts else ''
    except Exception as e:
        print('\nWarning: the token was issued but listing the account failed (%s).' % e)

    print('\n' + '-' * 68)
    if who:
        print('Works. This token reads %s' % who)
    print('-' * 68)
    print('\nRun these three, from this folder:\n')
    print('  wrangler secret put ADSENSE_CLIENT_ID       # paste: %s' % client_id)
    print('  wrangler secret put ADSENSE_CLIENT_SECRET   # paste the secret')
    print('  wrangler secret put ADSENSE_REFRESH_TOKEN   # paste the line below\n')
    print(refresh)
    print('\nThen `wrangler deploy`, and the Earnings tab and the app screen fill in.')
    print('Treat that line like a password: it reads your earnings until you revoke it')
    print('at https://myaccount.google.com/permissions.\n')


if __name__ == '__main__':
    main()
