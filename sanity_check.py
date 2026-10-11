#!/usr/bin/env python3
"""
SPABench sanity_check.py — is every ground-truth endpoint really served?

Live mode (containers running: docker compose up -d):
  * logs in once (POST http://localhost:4001/api/auth/login, benchadmin/benchpass);
  * REST: calls every endpoint with its method (path params → "1", JSON body {})
    through the URL in the manifest (i.e. through the app's nginx when it is an app
    origin). PASS = 2xx, or 400/403/422 with a JSON/XML body (a handler rejected the
    request). FAIL = 404, 405, 5xx, connection error, or an HTML page (SPA fallback);
  * auth-gated endpoints are also called without a token and must answer 401;
  * WebSocket: an RFC 6455 handshake must return 101;
  * GraphQL operations must be listed by introspection;
  * assets must be 200 with a non-HTML body; and a few things must stay 404
    (unknown paths on an app, missing assets, vue-portal source maps).
External entries (staging hosts, private IPs) are unreachable by design and skipped.

Offline mode (--offline): the same verdicts from the route oracle (spabench/oracle.py),
no network — what CI runs.

Usage:
  python sanity_check.py                  # live
  python sanity_check.py --offline
  python sanity_check.py --app vue-portal -v
Exit 0 = everything passes, 1 = at least one failure.
"""

import argparse
import base64
import json
import os
import re
import socket
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

LOGIN = 'http://localhost:4001/api/auth/login'
CREDS = {'username': 'benchadmin', 'password': 'benchpass'}
MUST_404 = ['http://localhost:3001/no-such-api/really', 'http://localhost:3001/runtime.js',
            'http://localhost:3003/assets/missing.chunk.js', 'http://localhost:3004/_nuxt/entry.js.map',
            'http://localhost:3005/_next/static/chunks/package.js']
INTROSPECTION = '{__schema{queryType{fields{name}} mutationType{fields{name}} subscriptionType{fields{name}}}}'


def concrete(url):
    return re.sub(r'\{[^}]+\}', '1', url.split('#')[0]).replace('://localhost', '://127.0.0.1')


def http(method, url, token=None, body=None, timeout=8.0):
    """(status, content_type, text) — status None on a connection error."""
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('User-Agent', 'SPABench-sanity/3')
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get('Content-Type', ''), r.read(65536).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Content-Type', ''), e.read(65536).decode('utf-8', 'replace')
    except Exception as e:                     # noqa: BLE001 — any network failure is a FAIL with its reason
        return None, '', str(e)


def ws_handshake(url, token=None, timeout=5.0):
    u = urlparse(url)
    path = u.path + (f'?token={token}' if token else '')
    key = base64.b64encode(os.urandom(16)).decode()
    try:
        with socket.create_connection(('127.0.0.1', u.port or 80), timeout=timeout) as s:
            s.sendall((f'GET {path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                       f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
            line = s.recv(1024).decode('latin-1').split('\r\n', 1)[0]
            return line
    except Exception as e:                     # noqa: BLE001
        return f'error: {e}'


def handled(status, ctype, text):
    if status is None:
        return False, f'no response ({text[:80]})'
    if 'text/html' in ctype or text.lstrip().lower().startswith('<!doctype html'):
        return False, f'HTTP {status} HTML page (SPA fallback?)'
    if 200 <= status < 300:
        return True, f'HTTP {status}'
    if status in (400, 403, 422) and ('json' in ctype or 'xml' in ctype):
        return True, f'HTTP {status} from handler'
    return False, f'HTTP {status}'


class Checker:
    def __init__(self, verbose):
        self.verbose, self.fails, self.passes = verbose, [], 0
        self._ops = {}

    def ok(self, what, how):
        self.passes += 1
        if self.verbose:
            print(f'    PASS {what}  [{how}]')

    def fail(self, what, how):
        self.fails.append((what, how))
        print(f'    FAIL {what}  [{how}]')

    def gql_ops(self, origin_url, token):
        if origin_url not in self._ops:
            st, ct, text = http('POST', origin_url, token, {'query': INTROSPECTION})
            names = set()
            try:
                sch = json.loads(text)['data']['__schema']
                for k in ('queryType', 'mutationType', 'subscriptionType'):
                    names |= {f['name'] for f in ((sch.get(k) or {}).get('fields') or [])}
            except (ValueError, KeyError, TypeError):
                pass
            self._ops[origin_url] = names
        return self._ops[origin_url]


def live(manifest, app_filter, verbose):
    c = Checker(verbose)
    st, ct, text = http('POST', concrete(LOGIN), body=CREDS)
    try:
        token = json.loads(text)['token']
    except (ValueError, KeyError):
        print(f'login failed: HTTP {st} {text[:120]} — are the containers up?')
        return 1
    for a in manifest['apps']:
        if app_filter and a['id'] != app_filter:
            continue
        print(f"\n[{a['id']}]")
        for e in a['endpoints']:
            what = f"{e['id']} {e['method']} {e['url']}"
            if e['reachability'] == 'external':
                if verbose:
                    print(f'    SKIP {what}  [external host by design]')
                continue
            if e['kind'] == 'graphql':
                ops = c.gql_ops(concrete(e['url']), token)
                op = e['graphql']['operation']
                (c.ok if op in ops else c.fail)(what, 'in introspection' if op in ops else f'not in introspection ({len(ops)} ops)')
                continue
            if e['kind'] == 'websocket':
                line = ws_handshake(concrete(e['url']), token)
                (c.ok if ' 101 ' in line else c.fail)(what, line)
                continue
            url = concrete(e['url'])
            body = {} if e['method'] in ('POST', 'PUT', 'PATCH') else None
            good, how = handled(*http(e['method'], url, token, body))
            (c.ok if good else c.fail)(what, how)
            if good and e['auth_required']:
                st, _, _ = http(e['method'], url, None, body)
                (c.ok if st == 401 else c.fail)(what + ' (no token)', f'HTTP {st}, expected 401')
        for x in a.get('assets', []):
            st, ct, _ = http('GET', concrete(x['url']))
            good = st == 200 and 'text/html' not in ct
            (c.ok if good else c.fail)(f"{x['id']} {x['url']}", f'HTTP {st} {ct}')
    if not app_filter:
        print('\n[must stay 404]')
        for u in MUST_404:
            st, ct, _ = http('GET', concrete(u))
            (c.ok if st == 404 else c.fail)(u, f'HTTP {st}')
    return report(c)


def offline(manifest, app_filter, verbose):
    from spabench.oracle import Oracle
    o, c = Oracle(), Checker(verbose)
    for a in manifest['apps']:
        if app_filter and a['id'] != app_filter:
            continue
        print(f"\n[{a['id']}] (offline)")
        for e in a['endpoints']:
            what = f"{e['id']} {e['method']} {e['url']}"
            if e['reachability'] == 'external':
                continue
            ok, how = o.resolve(e['url'].split('#')[0], e['method'])
            if ok and e['kind'] == 'graphql' and e['graphql']['operation'] not in o.backends.gql_ops:
                ok, how = False, 'operation not in schema.graphql'
            (c.ok if ok else c.fail)(what, how)
        for x in a.get('assets', []):
            ok, how = o.resolve(x['url'], 'GET')
            (c.ok if ok else c.fail)(f"{x['id']} {x['url']}", how)
    if not app_filter:
        print('\n[must stay 404] (offline)')
        for u in MUST_404:
            ok, how = o.resolve(u, 'GET')
            (c.fail if ok else c.ok)(u, how)
    return report(c)


def report(c):
    print(f'\n{c.passes} passed, {len(c.fails)} failed')
    return 1 if c.fails else 0


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--manifest', default=os.path.join(HERE, 'manifest.json'))
    ap.add_argument('--app')
    ap.add_argument('--offline', action='store_true', help='check against the route oracle; no network')
    ap.add_argument('-v', '--verbose', action='store_true')
    args = ap.parse_args()
    with open(args.manifest, encoding='utf-8') as f:
        manifest = json.load(f)
    return (offline if args.offline else live)(manifest, args.app, args.verbose)


if __name__ == '__main__':
    sys.exit(main())
