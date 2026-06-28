#!/usr/bin/env python3
"""
SPABench run_competitor_scans.py
--------------------------------
Installs (if missing) and runs the four baseline endpoint-discovery tools
against all 5 SPABench apps, normalises each tool's output to the format
expected by evaluate.py, and scores them with the SAME methodology used for
our system (--verify-reachable, cross-app excluded).

Tools:
  LinkFinder    (Python, git clone)             -> regex on static JS
  xnLinkFinder  (Python, pip)                   -> regex/crawl
  JSLuice       (Go binary, prebuilt release)   -> AST on static JS
  Katana        (Go binary, prebuilt release)   -> headless/JS crawl (gets bearer)

JSLuice / LinkFinder / xnLinkFinder read the app's STATIC JS bundles, which are
public assets, so they need no auth. Katana crawls live and is given the same
admin bearer token our scanner used, so the comparison is apples-to-apples.

Outputs:
  output/competitors/<tool>/<app>.{raw,json}     normalised tool output
  output/competitors/_COMPETITOR_RESULTS.txt     scored summary (review this)

Safe to re-run: installed tools and downloaded binaries are cached under tools/.
Every tool is wrapped in try/except so one failure never aborts the suite.
"""

import os
import re
import sys
import glob
import json
import time
import zipfile
import tarfile
import subprocess
import traceback

import requests

HERE      = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(HERE, 'tools')
JS_DIR    = os.path.join(TOOLS_DIR, 'js')
OUT_DIR   = os.path.join(HERE, 'output', 'competitors')
EVALUATE  = os.path.join(HERE, 'evaluate.py')
MANIFEST  = os.path.join(HERE, 'manifest.json')
AUTH_URL  = 'http://127.0.0.1:4001/api/auth/login'
ADMIN     = {'username': 'benchadmin', 'password': 'benchpass'}
SUMMARY   = os.path.join(OUT_DIR, '_COMPETITOR_RESULTS.txt')

APPS = [
    ('angular-permit',  3001),
    ('angular-erp',     3002),
    ('react-ecommerce', 3003),
    ('vue-portal',      3004),
    ('nextjs-saas',     3005),
]

for d in (TOOLS_DIR, JS_DIR, OUT_DIR):
    os.makedirs(d, exist_ok=True)

_log_lines = []
def log(msg):
    line = f'[{time.strftime("%H:%M:%S")}] {msg}'
    print(line, flush=True)
    _log_lines.append(line)


# ───────────────────────────── helpers ──────────────────────────────────────

def run(cmd, **kw):
    """Run a command, capture text output, never raise."""
    kw.setdefault('capture_output', True)
    kw.setdefault('text', True)
    kw.setdefault('timeout', 600)
    try:
        return subprocess.run(cmd, **kw)
    except Exception as e:
        log(f'    ! command failed: {e}')
        class _R:  # minimal stand-in
            returncode = 1; stdout = ''; stderr = str(e)
        return _R()


def download(url, dest):
    log(f'    downloading {url}')
    r = requests.get(url, stream=True, timeout=120,
                     headers={'User-Agent': 'spabench-competitor-runner'})
    r.raise_for_status()
    with open(dest, 'wb') as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    return dest


def github_release_asset(repo, must_contain):
    """Return browser_download_url of the first asset matching all substrings."""
    api = f'https://api.github.com/repos/{repo}/releases/latest'
    r = requests.get(api, timeout=60,
                     headers={'User-Agent': 'spabench-competitor-runner',
                              'Accept': 'application/vnd.github+json'})
    r.raise_for_status()
    for asset in r.json().get('assets', []):
        name = asset['name'].lower()
        if all(s in name for s in must_contain):
            return asset['browser_download_url'], asset['name']
    raise RuntimeError(f'no matching asset in {repo} for {must_contain}')


def extract_binary(archive, dest_dir, exe_basename):
    """Extract archive and return path to the binary named exe_basename(.exe)."""
    os.makedirs(dest_dir, exist_ok=True)
    if archive.endswith('.zip'):
        with zipfile.ZipFile(archive) as z:
            z.extractall(dest_dir)
    elif archive.endswith(('.tar.gz', '.tgz')):
        with tarfile.open(archive) as t:
            t.extractall(dest_dir)
    for root, _, files in os.walk(dest_dir):
        for fn in files:
            if fn.lower() in (exe_basename, exe_basename + '.exe'):
                return os.path.join(root, fn)
    return None


# ──────────────────────────── installation ──────────────────────────────────

def ensure_linkfinder():
    repo_dir = os.path.join(TOOLS_DIR, 'LinkFinder')
    script   = os.path.join(repo_dir, 'linkfinder.py')
    if not os.path.exists(script):
        log('  installing LinkFinder (git clone)...')
        run(['git', 'clone', '--depth', '1',
             'https://github.com/GerbenJavado/LinkFinder.git', repo_dir])
    # deps
    run([sys.executable, '-m', 'pip', 'install', '-q', 'jsbeautifier', 'requests'])
    return script if os.path.exists(script) else None


def ensure_xnlinkfinder():
    # pip package exposes the `xnLinkFinder` console script
    if not _which('xnLinkFinder'):
        log('  installing xnLinkFinder (pip)...')
        run([sys.executable, '-m', 'pip', 'install', '-q', 'xnLinkFinder'])
    return _which('xnLinkFinder') or 'xnLinkFinder'


def ensure_go():
    """Return path to a `go` executable, installing a portable toolchain if
    none is on PATH. JSLuice is distributed go-install-only (no release binary)."""
    existing = _which('go')
    if existing:
        return existing
    go_exe = os.path.join(TOOLS_DIR, 'go', 'go', 'bin', 'go.exe')
    if os.path.exists(go_exe):
        return go_exe
    log('  installing portable Go toolchain (needed to build JSLuice)...')
    try:
        idx = requests.get('https://go.dev/dl/?mode=json', timeout=60).json()
        asset = None
        for f in idx[0]['files']:
            if f['os'] == 'windows' and f['arch'] == 'amd64' and f['kind'] == 'archive':
                asset = f['filename']; break
        if not asset:
            raise RuntimeError('no windows/amd64 Go archive found')
        arc = download('https://go.dev/dl/' + asset, os.path.join(TOOLS_DIR, asset))
        with zipfile.ZipFile(arc) as z:
            z.extractall(os.path.join(TOOLS_DIR, 'go'))
        return go_exe if os.path.exists(go_exe) else None
    except Exception as e:
        log(f'  ! Go install failed: {e}')
        return None


def ensure_jsluice():
    gobin = os.path.join(TOOLS_DIR, 'gopath', 'bin')
    cached = glob.glob(os.path.join(gobin, 'jsluice*'))
    cached = [c for c in cached if c.lower().endswith(('jsluice', 'jsluice.exe'))]
    if cached:
        return cached[0]
    go = ensure_go()
    if not go:
        return None
    log('  installing JSLuice (go install)...')
    env = dict(os.environ)
    env['GOROOT'] = os.path.join(TOOLS_DIR, 'go', 'go')
    env['GOPATH'] = os.path.join(TOOLS_DIR, 'gopath')
    env['GOBIN']  = gobin
    env['PATH']   = os.path.join(env['GOROOT'], 'bin') + os.pathsep + env.get('PATH', '')
    run([go, 'install', 'github.com/BishopFox/jsluice/cmd/jsluice@latest'],
        env=env, timeout=600)
    cached = glob.glob(os.path.join(gobin, 'jsluice*'))
    cached = [c for c in cached if c.lower().endswith(('jsluice', 'jsluice.exe'))]
    return cached[0] if cached else None


def ensure_katana():
    cached = glob.glob(os.path.join(TOOLS_DIR, 'katana', '**', 'katana*'),
                       recursive=True)
    cached = [c for c in cached if c.lower().endswith(('katana', 'katana.exe'))]
    if cached:
        return cached[0]
    log('  installing Katana (prebuilt windows binary)...')
    try:
        url, name = github_release_asset('projectdiscovery/katana', ['windows', 'amd64'])
        arc = download(url, os.path.join(TOOLS_DIR, name))
        return extract_binary(arc, os.path.join(TOOLS_DIR, 'katana'), 'katana')
    except Exception as e:
        log(f'  ! Katana install failed: {e}')
        return None


def _which(name):
    from shutil import which
    return which(name)


# ──────────────────────────── JS harvesting ─────────────────────────────────

def harvest_js(app, port):
    """Download the app's same-origin .js bundles for static-analysis tools."""
    base = f'http://127.0.0.1:{port}'
    dest = os.path.join(JS_DIR, str(port))
    os.makedirs(dest, exist_ok=True)
    saved = []
    try:
        html = requests.get(base, timeout=30).text
    except Exception as e:
        log(f'    ! could not fetch {base}: {e}')
        return saved
    srcs = set(re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, re.I))
    # common bundle fallbacks
    srcs |= {'main.js', 'bundle.js', 'app.js', 'index.js',
             'runtime.js', 'polyfills.js', 'vendor.js'}
    for src in srcs:
        if src.startswith('http') and f':{port}' not in src:
            continue  # skip third-party CDN
        url = src if src.startswith('http') else base + '/' + src.lstrip('/')
        try:
            r = requests.get(url, timeout=30)
            if r.status_code == 200 and ('javascript' in r.headers.get('content-type', '')
                                          or url.endswith('.js')):
                fn = os.path.join(dest, re.sub(r'[^A-Za-z0-9._-]', '_', src)[-80:] or 'b.js')
                if not fn.endswith('.js'):
                    fn += '.js'
                open(fn, 'w', encoding='utf-8', errors='ignore').write(r.text)
                saved.append(fn)
        except Exception:
            pass
    log(f'    harvested {len(saved)} JS file(s) for {app}')
    return saved


# ──────────────────────────── tool runners ──────────────────────────────────

def _to_bare_path(s):
    """Strip scheme+host to a bare '/path' so matching is host-agnostic and
    consistent across all tools. Returns None if not path-like."""
    s = (s or '').strip().strip('"\'')
    if not s:
        return None
    s = re.sub(r'^https?://[^/]+', '', s)        # drop scheme://host:port
    s = s.split('#', 1)[0]
    if not s.startswith('/'):
        if '/' in s and not s.startswith('//'):
            s = '/' + s
        else:
            return None
    return s


def _write_spabench(paths, app, tool):
    """Write a bare-path spabench-v1 JSON; return (path, 'spabench-v1')."""
    seen, eps = set(), []
    for p in paths:
        bp = _to_bare_path(p)
        if bp and bp not in seen:
            seen.add(bp); eps.append({'url': bp})
    out = os.path.join(OUT_DIR, tool, f'{app}.norm.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({'endpoints': eps}, open(out, 'w'))
    return out, 'spabench-v1'


def run_linkfinder(script, app, js_files):
    """Run LinkFinder on each harvested JS file (the fair 'all JS provided' setup)."""
    if not script or not js_files:
        return None, None
    paths = []
    for jf in js_files:
        r = run([sys.executable, script, '-i', jf, '-o', 'cli'])
        paths += [l for l in (r.stdout or '').splitlines() if l.strip()]
    return _write_spabench(paths, app, 'linkfinder')


def run_xnlinkfinder(cmd, app, port):
    """Run xnLinkFinder on the harvested JS directory."""
    if not cmd:
        return None, None
    js_dir = os.path.join(JS_DIR, str(port))
    raw    = os.path.join(OUT_DIR, 'xnlinkfinder', f'{app}.txt')
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    run([cmd, '-i', js_dir, '-o', raw])
    links = []
    if os.path.exists(raw):
        links = [l.strip() for l in open(raw, encoding='utf-8', errors='ignore')
                 if l.strip()]
    return _write_spabench(links, app, 'xnlinkfinder')


def run_jsluice(binary, app, js_files):
    if not binary or not js_files:
        return None, None
    paths = []
    for jf in js_files:
        r = run([binary, 'urls', jf])
        for line in (r.stdout or '').splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                u = obj.get('url') or obj.get('value', '')
                if u:
                    paths.append(u)
            except Exception:
                pass
    return _write_spabench(paths, app, 'jsluice')


def run_katana(binary, app, port, token):
    """Katana emits full URLs with correct host -> score with native adapter."""
    if not binary:
        return None, None
    base = f'http://127.0.0.1:{port}'
    out  = os.path.join(OUT_DIR, 'katana', f'{app}.jsonl')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    run([binary, '-u', base, '-jc', '-d', '3', '-jsonl', '-silent',
         '-H', f'Authorization: Bearer {token}', '-o', out], timeout=300)
    if not os.path.exists(out):
        open(out, 'w').close()
    return out, 'katana'


# ──────────────────────────── scoring ───────────────────────────────────────

def score(fmt, app, tool_output):
    if not tool_output or not os.path.exists(tool_output):
        return None
    r = run([sys.executable, EVALUATE, '--manifest', MANIFEST,
             '--tool-output', tool_output, '--app', app,
             '--format', fmt, '--verify-reachable'])
    return r.stdout or ''


def parse_metrics(text):
    if not text:
        return {}
    g = lambda p: (re.search(p, text) or [None, None])[1] if re.search(p, text) else '-'
    return {
        'recall':    g(r'Recall\s+:\s+([\d.]+%)'),
        'precision': g(r'Precision\s+:\s+([\d.]+%)'),
        'f1':        g(r'F1\s+:\s+([\d.]+%)'),
        'tp':        g(r'True positives\s+:\s+(\d+)'),
        'fp':        g(r'False positives\s+:\s+(\d+)'),
    }


# ──────────────────────────────── main ──────────────────────────────────────

def main():
    log('=' * 64)
    log('SPABench Competitor Scan Runner')
    log('=' * 64)

    log('Installing / locating tools...')
    lf  = ensure_linkfinder()
    xn  = ensure_xnlinkfinder()
    jl  = ensure_jsluice()
    kt  = ensure_katana()
    log(f'  LinkFinder   : {lf or "UNAVAILABLE"}')
    log(f'  xnLinkFinder : {xn or "UNAVAILABLE"}')
    log(f'  JSLuice      : {jl or "UNAVAILABLE"}')
    log(f'  Katana       : {kt or "UNAVAILABLE"}')

    try:
        token = requests.post(AUTH_URL, json=ADMIN, timeout=10).json().get('token', '')
        log(f'  admin token  : {"ok" if token else "MISSING"}')
    except Exception as e:
        token = ''
        log(f'  ! token fetch failed: {e}')

    results = {}  # results[app][tool] = metrics
    for app, port in APPS:
        log(f'\n----- {app} ({port}) -----')
        results[app] = {}
        js_files = harvest_js(app, port)

        for tool, fn in [
            ('LinkFinder',   lambda: run_linkfinder(lf, app, js_files)),
            ('xnLinkFinder', lambda: run_xnlinkfinder(xn, app, port)),
            ('JSLuice',      lambda: run_jsluice(jl, app, js_files)),
            ('Katana',       lambda: run_katana(kt, app, port, token)),
        ]:
            try:
                log(f'  running {tool}...')
                out, fmt = fn()
                txt = score(fmt, app, out)
                results[app][tool] = parse_metrics(txt)
                m = results[app][tool]
                log(f'    {tool}: R={m.get("recall","-")} P={m.get("precision","-")} '
                    f'F1={m.get("f1","-")} (TP={m.get("tp","-")} FP={m.get("fp","-")})')
            except Exception as e:
                log(f'    ! {tool} errored: {e}')
                log(traceback.format_exc())
                results[app][tool] = {}

    # ── summary table ────────────────────────────────────────────────────────
    lines = ['', '=' * 64, 'COMPETITOR RESULTS SUMMARY (SPABench v2.0, 108 endpoints)',
             'Methodology: evaluate.py --verify-reachable (same as our system)',
             '=' * 64, '']
    header = f'{"App":<18}{"Tool":<14}{"Recall":>9}{"Prec":>9}{"F1":>9}{"TP":>6}{"FP":>6}'
    lines.append(header); lines.append('-' * len(header))
    for app, _ in APPS:
        for tool in ('LinkFinder', 'xnLinkFinder', 'JSLuice', 'Katana'):
            m = results.get(app, {}).get(tool, {})
            lines.append(f'{app:<18}{tool:<14}{m.get("recall","-"):>9}'
                         f'{m.get("precision","-"):>9}{m.get("f1","-"):>9}'
                         f'{m.get("tp","-"):>6}{m.get("fp","-"):>6}')
        lines.append('')

    report = '\n'.join(_log_lines) + '\n' + '\n'.join(lines)
    open(SUMMARY, 'w', encoding='utf-8').write(report)
    print('\n'.join(lines))
    log(f'\nSummary written to {SUMMARY}')


if __name__ == '__main__':
    main()
