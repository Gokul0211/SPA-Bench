#!/usr/bin/env python3
"""
SPABench offline audit — proves the benchmark is internally consistent.
No network, no containers: everything is read from the repository.

  served        every ground-truth endpoint is answered through its app's origin
                (reachability "served"/"probe"), external ones are really external
  ground-truth  manifest.json == build_manifest.py output (evidence recomputed)
  maps          every served map is valid, linked from its .js and in sync with the sources
  leaks         no test-case labels, benchmark prose, static token or credentials in
                anything a client can fetch (files, map sources, API/GraphQL/WSDL text)
  reachability  every served JS/map file is reachable from an index.html by a reference
                chain; no reference points at a file that is not served
  consistency   Dockerfiles / docker-compose / nginx agree with spabench/artifacts.SERVED
  docs          README tables and docs/TEST_CASES.md match manifest.json (make_docs.py --check)
  all           everything above (exit 1 on any failure)

  --emit-oracle FILE   also write the route oracle (served routes) used by evaluate.py

Usage: python audit/bench_audit.py all [-v] [--emit-oracle audit/out/oracle.json]
"""

import argparse
import json
import os
import re
import subprocess
import sys
from urllib.parse import urljoin, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from spabench.artifacts import SERVED, MAPS_BLOCKED, served_files, js_strings, html_strings, rp  # noqa: E402
from spabench.oracle import Oracle, NGINX_CONF  # noqa: E402

APPS = list(SERVED)


class Report:
    def __init__(self, name, verbose):
        self.name, self.verbose, self.problems, self.notes = name, verbose, [], []

    def fail(self, msg):
        self.problems.append(msg)

    def note(self, msg):
        self.notes.append(msg)

    def show(self):
        status = 'PASS' if not self.problems else 'FAIL'
        print(f'[{status}] {self.name}' + (f' — {len(self.problems)} problem(s)' if self.problems else ''))
        for p in self.problems:
            print('    x', p)
        if self.verbose:
            for n in self.notes:
                print('    ·', n)
        return not self.problems


def manifest():
    return json.load(open(rp('manifest.json'), encoding='utf-8'))


# ── served ──────────────────────────────────────────────────────────────────

def check_served(rep, oracle):
    m = manifest()
    n_ok = 0
    for a in m['apps']:
        for e in a['endpoints']:
            url = e['url'].split('#')[0]
            if e['reachability'] == 'external':
                host = urlparse(url).netloc
                if host in NGINX_CONF or host.startswith('localhost'):
                    rep.fail(f"{e['id']}: marked external but {host} is a benchmark host")
                continue
            ok, how = oracle.resolve(url, e['method'])
            if e['kind'] == 'graphql' and ok:
                op = e['graphql']['operation']
                if op not in oracle.backends.gql_ops:
                    ok, how = False, f'operation {op} not in schema.graphql'
            if ok:
                n_ok += 1
                rep.note(f"{e['id']} {e['method']} {e['url']} → {how}")
            else:
                rep.fail(f"{e['id']} {e['method']} {e['url']}: {how}")
        for x in a.get('assets', []):
            ok, how = oracle.resolve(x['url'], 'GET')
            if not ok:
                rep.fail(f"{x['id']} asset {x['url']}: {how}")
    rep.note(f'{n_ok} endpoints served')


# ── ground truth ────────────────────────────────────────────────────────────

def check_ground_truth(rep):
    r = subprocess.run([sys.executable, rp('build_manifest.py'), '--check'], capture_output=True, text=True,
                       encoding='utf-8', cwd=ROOT)
    if r.returncode:
        rep.fail((r.stdout + r.stderr).strip())


# ── maps ────────────────────────────────────────────────────────────────────

B64 = {c: i for i, c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/')}


def vlq_ok(mappings):
    for line in mappings.split(';'):
        for seg in filter(None, line.split(',')):
            vals, shift, cur = [], 0, 0
            for ch in seg:
                if ch not in B64:
                    return False
                d = B64[ch]
                cur += (d & 31) << shift
                if d & 32:
                    shift += 5
                else:
                    vals.append(cur)
                    cur, shift = 0, 0
            if shift or len(vals) not in (1, 4, 5):
                return False
    return True


def check_maps(rep):
    r = subprocess.run([sys.executable, rp('scripts', 'sync_sourcemaps.py'), '--check'], capture_output=True,
                       text=True, encoding='utf-8', cwd=ROOT)
    if r.returncode:
        rep.fail('sync_sourcemaps --check: ' + (r.stdout + r.stderr).strip().replace('\n', ' | '))
    for app in APPS:
        for url, path in served_files(app):
            if path.endswith(('.js', '.mjs')):
                text = open(path, encoding='utf-8').read()
                d = re.search(r'//# sourceMappingURL=(\S+)\s*$', text)
                if d:
                    target = os.path.join(os.path.dirname(path), d.group(1))
                    if not os.path.exists(target):
                        rep.fail(f'{url}: sourceMappingURL points at missing {d.group(1)}')
            if path.endswith('.map'):
                try:
                    mp = json.load(open(path, encoding='utf-8'))
                except ValueError as e:
                    rep.fail(f'{url}: invalid JSON ({e})')
                    continue
                if mp.get('version') != 3 or not vlq_ok(mp.get('mappings', '')):
                    rep.fail(f'{url}: not a valid v3 map')
                if len(mp.get('sources', [])) != len(mp.get('sourcesContent') or []):
                    rep.fail(f'{url}: sources/sourcesContent length mismatch')
                js = path[:-4]
                if not os.path.exists(js):
                    rep.fail(f'{url}: orphan map (no {os.path.basename(js)})')
                elif f'sourceMappingURL={os.path.basename(path)}' not in open(js, encoding='utf-8').read():
                    rep.fail(f'{url}: not referenced by {os.path.basename(js)}')
    for app in MAPS_BLOCKED:
        if any(p.endswith('.map') for _, p in served_files(app)):
            rep.fail(f'{app}: maps are supposed to be blocked but a .map is served')
    rep.note('maps checked')


# ── leaks ───────────────────────────────────────────────────────────────────

LEAK = re.compile(r'\bTC-[A-Z0-9.]+-?\d*|\bEP-[A-Z](?:-[A-Z]+)?-\d{3}\b|SPABench|spabench|benchmark|ground.?truth|'
                  r'test.?case|discoverable|\bmanifest\b(?!\.json)|competitor|LinkFinder|JSLuice|Katana|xnLinkFinder|'
                  r'spabench-bearer-token-dev|benchpass|bench_bearer|_benchmark', re.I)
# Credentials the servers check (README "Accounts"; the static token is off unless
# BENCH_ALLOW_STATIC_TOKEN=1). Never returned; still a leak anywhere a client is served.
SERVER_CREDENTIALS = {'benchpass', 'spabench-bearer-token-dev'}
ALLOWED = re.compile(r'urn:spabench:legacy:hr|web app manifest|webmanifest|BUILD_MANIFEST|_buildManifest|_ssgManifest|SSG_MANIFEST', re.I)


def scan(rep, where, text):
    for m in LEAK.finditer(text):
        ctx = text[max(0, m.start() - 40):m.end() + 40]
        if ALLOWED.search(ctx):
            continue
        rep.fail(f'{where}: "{m.group(0)}" in …{ctx.strip()[:90]}…')


def check_leaks(rep):
    for app in APPS:
        for url, path in served_files(app):
            if not path.endswith(('.js', '.mjs', '.html', '.map', '.json', '.wsdl', '.css', '.txt')):
                continue
            text = open(path, encoding='utf-8', errors='replace').read()
            if path.endswith('.map'):
                mp = json.loads(text)
                scan(rep, url + ' (sources)', ' '.join(mp.get('sources', [])))
                for s, c in zip(mp.get('sources', []), mp.get('sourcesContent') or []):
                    scan(rep, f'{url}::{s}', c or '')
            else:
                scan(rep, url, text)
    # text the API servers return: string literals of server code (not comments), schema, spec, WSDL
    for d in ('rest-backend', 'graphql-backend', 'websocket-backend', 'soap-bridge'):
        for r, _, fs in os.walk(rp('api-servers', d)):
            if 'node_modules' in r:
                continue
            for f in fs:
                p = os.path.join(r, f)
                rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
                text = open(p, encoding='utf-8', errors='replace').read()
                if f.endswith('.js'):
                    # the account store's password is an input the server checks, never returned
                    scan(rep, rel + ' (string literals)',
                         '\n'.join(v for v, _ in js_strings(text) if v not in SERVER_CREDENTIALS))
                elif f.endswith('.graphql'):
                    scan(rep, rel + ' (descriptions)', '\n'.join(re.findall(r'"""([\s\S]*?)"""', text)))
                elif f.endswith(('.json', '.wsdl')) and 'package' not in f:
                    scan(rep, rel, text)
    rep.note('leak scan done')


# ── reachability ────────────────────────────────────────────────────────────

ASSET_RX = re.compile(r'[\w./-]*[\w-]\.(?:m?js|map)$')
# Bundler module identifiers (webpack module ids, Angular compiler factories): names inside a
# bundle, never fetched over HTTP.
MODULE_ID_RX = re.compile(r'(?:^|/)node_modules/|\.ngfactory\.js$')
# Served on purpose without any reference (found only by probing well-known paths):
# nextjs-saas ships its server bundle and map in a public directory by mistake.
PROBE_ONLY = {'http://localhost:3005/dist/server.js', 'http://localhost:3005/dist/server.js.map'}


def references(url, text, path):
    """Asset URLs referenced from one served file (absolute)."""
    refs = set()
    if path.endswith('.html'):
        vals = [v for v, _ in html_strings(text)]
    elif path.endswith('.map'):
        return refs
    else:
        vals = [v for v, _ in js_strings(text)]
        d = re.search(r'//# sourceMappingURL=(\S+)', text)
        if d:
            refs.add(urljoin(url, d.group(1)))
        # federation remotes "name@http://…/remoteEntry.js"
        refs |= {urljoin(url, m) for m in re.findall(r'@(https?://[^"\']+\.js)', text)}
        # webpack runtime chunk map: r.p + "static/chunks/" + {id:"name"}[id] + ".js"
        rt = re.search(r'r\.p="([^"]+)".*?"(static/chunks/)"\+\((\{.*?\})\)\[e\]\+"\.js"', text, re.S)
        if rt:
            for name in json.loads(rt.group(3)).values():
                refs.add(urljoin(url, '/' + rt.group(1).strip('/') + '/' + rt.group(2) + name + '.js'))
        # build manifest: "static/chunks/…js" relative to /_next/
        refs |= {urljoin(url, '/_next/' + m) for m in re.findall(r'"(static/chunks/[\w./-]+\.js)"', text)}
        # remoteEntry: import(p+"main.js") where p is the script's own directory
        if re.search(r'new URL\("\./",document\.currentScript', text):
            refs |= {urljoin(url, m) for m in re.findall(r'p\+"([\w./-]+\.js)"', text)}
    for v in vals:
        for piece in re.split(r'[\s\'"(),]+', v):
            piece = piece.strip()
            # "name@http://…/remoteEntry.js" is handled above; keep only the URL part
            piece = re.sub(r'^[\w$]+@(?=https?://)', '', piece)
            if MODULE_ID_RX.search(piece):
                continue
            if ASSET_RX.search(piece) and not piece.startswith(('static/chunks/',)):
                refs.add(urljoin(url, piece))
    return refs


def check_reachability(rep):
    served = {}
    for app in APPS:
        for url, path in served_files(app):
            served[url] = path
    roots = [u for u in served if u.endswith('/index.html') or (u.endswith('/') and not u.endswith('//'))]
    seen, queue = set(), list(roots)
    dangling = set()
    while queue:
        u = queue.pop()
        if u in seen:
            continue
        seen.add(u)
        p = served.get(u)
        if not p:
            continue
        for ref in references(u, open(p, encoding='utf-8', errors='replace').read(), p):
            ref = ref.split('#')[0].split('?')[0]
            if ref in served:
                queue.append(ref)
            elif urlparse(ref).netloc in {urlparse(x).netloc for x in served}:
                dangling.add((u, ref))
    for u, ref in sorted(dangling):
        rep.fail(f'{u} references {ref}, which is not served')
    for u, p in sorted(served.items()):
        if p.endswith(('.js', '.mjs', '.map')) and u not in seen and u not in PROBE_ONLY:
            rep.fail(f'unreachable: {u} (no reference chain from any index.html)')
    rep.note(f'{len(seen)} served URLs reachable from {len(roots)} root page(s)')


# ── consistency ─────────────────────────────────────────────────────────────

def check_consistency(rep):
    compose = open(rp('docker-compose.yml'), encoding='utf-8').read()
    for app, origins in SERVED.items():
        for origin in origins:
            port = urlparse(origin).port
            if not re.search(rf'"{port}:80"', compose):
                rep.fail(f'docker-compose: no "{port}:80" mapping for {app} ({origin})')
    for host, conf in NGINX_CONF.items():
        if not os.path.exists(rp(conf)):
            rep.fail(f'missing nginx conf {conf}')
    # every app Dockerfile copies its nginx conf and the served directories named in SERVED
    for app in APPS:
        df = open(rp('apps', app, 'Dockerfile'), encoding='utf-8').read()
        if 'COPY nginx/' not in df:
            rep.fail(f'apps/{app}/Dockerfile does not copy an nginx conf')
        for origin, mounts in SERVED[app].items():
            for prefix, repo in mounts:
                rel = os.path.relpath(rp(repo), rp('apps', app)).replace(os.sep, '/')
                if rel.split('/')[0] not in df:
                    rep.fail(f'apps/{app}/Dockerfile does not COPY {rel}')
        for conf in re.findall(r'COPY nginx/(\S+)', df):
            if not os.path.exists(rp('apps', app, 'nginx', conf)):
                rep.fail(f'apps/{app}/Dockerfile copies missing nginx/{conf}')
    rep.note('compose / Dockerfile / nginx consistency checked')


def check_docs(rep):
    r = subprocess.run([sys.executable, rp('make_docs.py'), '--check'], capture_output=True, text=True,
                       encoding='utf-8', cwd=ROOT)
    if r.returncode:
        rep.fail((r.stdout + r.stderr).strip().replace('\n', ' | '))


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('check', choices=['served', 'ground-truth', 'maps', 'leaks', 'reachability', 'consistency', 'docs', 'all'])
    ap.add_argument('-v', '--verbose', action='store_true')
    ap.add_argument('--emit-oracle', metavar='FILE')
    args = ap.parse_args()

    oracle = Oracle()
    todo = (['consistency', 'ground-truth', 'served', 'maps', 'leaks', 'reachability', 'docs']
            if args.check == 'all' else [args.check])
    ok = True
    for name in todo:
        rep = Report(name, args.verbose)
        {'served': lambda r: check_served(r, oracle), 'ground-truth': check_ground_truth, 'maps': check_maps,
         'leaks': check_leaks, 'reachability': check_reachability, 'consistency': check_consistency,
         'docs': check_docs}[name](rep)
        ok &= rep.show()
    if args.emit_oracle:
        os.makedirs(os.path.dirname(os.path.abspath(args.emit_oracle)), exist_ok=True)
        with open(args.emit_oracle, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(oracle.emit(), f, indent=1)
        print('oracle written to', args.emit_oracle)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
