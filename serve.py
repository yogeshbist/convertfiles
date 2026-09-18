#!/usr/bin/env python3
"""Serve Convert Files locally with caching disabled.

python3 -m http.server works too, but it sends no Cache-Control header, so
Chrome applies heuristic caching and can keep an old app.js for a day after an
edit. This server marks every response no-cache so a plain reload is enough.

    python3 serve.py            # http://localhost:8777
    python3 serve.py 9000       # another port
"""
import http.server
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    print(f'Convert Files  ->  http://localhost:{port}   (Ctrl+C to stop)')
    try:
        http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        pass
