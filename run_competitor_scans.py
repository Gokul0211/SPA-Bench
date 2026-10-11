#!/usr/bin/env python3
"""
SPABench run_competitor_scans.py — run the baseline tools and score them exactly
like the scanner (same evaluate.py, same flags, same manifest).

Tools (pinned):
  LinkFinder    regex over JS files            (vendored copy in tools/LinkFinder, sha256 recorded)
  xnLinkFinder  regex/heuristics over JS files (pip xnLinkFinder==8.2)
  JSLuice       AST over JS files              (go install …/jsluice@v0.0.0-20240110145140-0ddfab153e06)
  Katana        live crawler with JS parsing   (v1.6.1 release binary; needs the containers)

Input fairness: the static tools (LinkFinder, xnLinkFinder, JSLuice) receive the
app's COMPLETE served JavaScript inventory, read from the repository (every
chunk, remote, worker and inline-free bundle the app serves — see
spabench/artifacts.py), i.e. what perfect crawling would hand them. With
--input served+sources they additionally receive every source-map source the app
serves, written out as files. Katana crawls the live app with the same bearer
token the scanner gets.

Outputs (output/competitors/<config>/):
  <tool>/<app>.<ext>      raw tool output (native format, nothing rewritten)
  <tool>/<app>.eval.json  evaluate.py report
  run_meta.json           versions, commands, inventory, timestamps
  RESULTS.md              table generated from the reports

Usage:
  python run_competitor_scans.py                         # all tools, all apps
  python run_competitor_scans.py --tools linkfinder jsluice --input served+sources
  python run_competitor_scans.py --evaluate-only         # re-score existing raw outputs
"""

import argparse
import datetime
import glob
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from spabench.artifacts import served_files  # noqa: E402

TOOLS_DIR = os.path.join(HERE, 'tools')
EVALUATE = os.path.join(HERE, 'evaluate.py')
MANIFEST = os.path.join(HERE, 'manifest.json')
LOGIN = 'http://127.0.0.1:4001/api/auth/login'
CREDS = {'username': 'benchadmin', 'password': 'benchpass'}
APPS = {'angular-permit': 'http://localhost:3001', 'angular-erp': 'http://localhost:3002',
        'react-ecommerce': 'http://localhost:3003', 'vue-portal': 'http://localhost:3004',
        'nextjs-saas': 'http://localhost:3005'}
PINS = {
    'xnlinkfinder': '8.2',
    'jsluice': 'v0.0.0-20240110145140-0ddfab153e06',
    'katana': '1.6.1',
}
FORMAT = {'linkfinder': ('linkfinder', 'txt'), 'xnlinkfinder': ('xnlinkfinder', 'txt'),
          'jsluice': ('jsluice', 'jsonl'), 'katana': ('katana', 'jsonl')}


def run(cmd, **kw):
    kw.setdefault('capture_output', True)
    kw.setdefault('text', True)
    kw.setdefault('encoding', 'utf-8')
    kw.setdefault('errors', 'replace')
    kw.setdefault('timeout', 900)
    try:
        return subprocess.run(cmd, **kw)
    except Exception as e:                        # noqa: BLE001 — a tool failure must not stop the suite
        return subprocess.CompletedProcess(cmd, 1, '', str(e))


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()


# ── tools ───────────────────────────────────────────────────────────────────

def linkfinder():
    script = os.path.join(TOOLS_DIR, 'LinkFinder', 'linkfinder.py')
    if not os.path.exists(script):
        run(['git', 'clone', '--depth', '1', 'https://github.com/GerbenJavado/LinkFinder.git',
             os.path.join(TOOLS_DIR, 'LinkFinder')])
        run([sys.executable, '-m', 'pip', 'install', '-q', 'jsbeautifier'])
    return (script, {'source': 'vendored copy', 'linkfinder.py sha256': sha256(script)}) if os.path.exists(script) else (None, {})


def xnlinkfinder():
    exe = shutil.which('xnLinkFinder')
    have = run([sys.executable, '-m', 'pip', 'show', 'xnLinkFinder']).stdout
    if not exe or f"Version: {PINS['xnlinkfinder']}" not in have:
        run([sys.executable, '-m', 'pip', 'install', '-q', f"xnLinkFinder=={PINS['xnlinkfinder']}"])
        exe = shutil.which('xnLinkFinder')
    return exe, {'version': PINS['xnlinkfinder']}


def jsluice():
    gobin = os.path.join(TOOLS_DIR, 'gopath', 'bin')
    exe = next(iter(glob.glob(os.path.join(gobin, 'jsluice*'))), None)
    mod = glob.glob(os.path.join(TOOLS_DIR, 'gopath', 'pkg', 'mod', 'github.com', '!bishop!fox', f"jsluice@{PINS['jsluice']}"))
    if not exe or not mod:
        go = shutil.which('go') or os.path.join(TOOLS_DIR, 'go', 'go', 'bin', 'go.exe')
        env = dict(os.environ, GOPATH=os.path.join(TOOLS_DIR, 'gopath'), GOBIN=gobin, CGO_ENABLED='1')
        run([go, 'install', f"github.com/BishopFox/jsluice/cmd/jsluice@{PINS['jsluice']}"], env=env)
        exe = next(iter(glob.glob(os.path.join(gobin, 'jsluice*'))), None)
    return exe, {'version': PINS['jsluice']}


def katana():
    exe = next(iter(glob.glob(os.path.join(TOOLS_DIR, 'katana', '**', 'katana*'), recursive=True)), None)
    if not exe:
        name = f"katana_{PINS['katana']}_{'windows' if os.name == 'nt' else platform.system().lower()}_amd64.zip"
        url = f"https://github.com/projectdiscovery/katana/releases/download/v{PINS['katana']}/{name}"
        arc = os.path.join(TOOLS_DIR, name)
        if not os.path.exists(arc):
            import urllib.request
            urllib.request.urlretrieve(url, arc)
        with zipfile.ZipFile(arc) as z:
            z.extractall(os.path.join(TOOLS_DIR, 'katana'))
        exe = next(iter(glob.glob(os.path.join(TOOLS_DIR, 'katana', '**', 'katana*'), recursive=True)), None)
    return exe, {'version': PINS['katana']}


# ── inputs ──────────────────────────────────────────────────────────────────

def inventory(app, with_sources, workdir):
    """(list of input files, [served URLs]) for the static tools."""
    files, urls = [], []
    for url, path in served_files(app):
        if path.endswith(('.js', '.mjs')) and url not in urls:
            files.append(path)
            urls.append(url)
    if with_sources:
        out = os.path.join(workdir, 'sources', app)
        os.makedirs(out, exist_ok=True)
        for url, path in served_files(app):
            if path.endswith('.map'):
                m = json.load(open(path, encoding='utf-8'))
                for i, (src, content) in enumerate(zip(m.get('sources', []), m.get('sourcesContent') or [])):
                    if content:
                        name = f"{hashlib.md5((url + src).encode()).hexdigest()[:10]}_{os.path.basename(src) or i}"
                        p = os.path.join(out, name if name.endswith(('.js', '.ts', '.tsx', '.jsx')) else name + '.js')
                        with open(p, 'w', encoding='utf-8') as f:
                            f.write(content)
                        files.append(p)
                        urls.append(f'{url}::{src}')
    return files, urls


# ── runners (raw output kept as the tool wrote it) ──────────────────────────

def run_linkfinder(exe, files, raw):
    lines, cmds = [], []
    for f in files:
        cmd = [sys.executable, exe, '-i', f, '-o', 'cli']
        cmds.append(cmd)
        lines += [l for l in run(cmd).stdout.splitlines() if l.strip()]
    open(raw, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return cmds


def run_xnlinkfinder(exe, files, raw, workdir, app):
    d = os.path.join(workdir, 'xn-input', app)
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    for i, f in enumerate(files):
        shutil.copy(f, os.path.join(d, f'{i:03d}_{os.path.basename(f)}'))
    cmd = [exe, '-i', d, '-o', raw, '-sf', 'localhost']
    run(cmd)
    if not os.path.exists(raw):
        open(raw, 'w').close()
    return [cmd]


def run_jsluice(exe, files, raw):
    cmd = [exe, 'urls'] + files
    open(raw, 'w', encoding='utf-8').write(run(cmd).stdout)
    return [cmd]


def run_katana(exe, origin, raw, token):
    cmd = [exe, '-u', origin.replace('localhost', '127.0.0.1'), '-jc', '-d', '3', '-jsonl', '-silent',
           '-H', f'Authorization: Bearer {token}', '-o', raw]
    run(cmd, timeout=600)
    if not os.path.exists(raw):
        open(raw, 'w').close()
    return [cmd[:-4] + ['-H', 'Authorization: Bearer <jwt>', '-o', raw]]


def login():
    import urllib.request
    req = urllib.request.Request(LOGIN, data=json.dumps(CREDS).encode(), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())['token']
    except Exception:                             # noqa: BLE001
        return None


def evaluate(fmt, app, raw, report, name):
    cmd = [sys.executable, EVALUATE, '--manifest', MANIFEST, '--tool-output', raw, '--format', fmt,
           '--app', app, '--name', name, '--report', report]
    r = run(cmd)
    if r.returncode or not os.path.exists(report):
        print(f'    evaluate failed: {r.stderr.strip()[-300:]}')
        return None
    return json.load(open(report, encoding='utf-8'))['apps'][0]


def results_table(rows, config):
    head = (f'# Baseline results ({config})\n\nGenerated by run_competitor_scans.py from the evaluate.py reports.\n'
            'Path level; strict unless noted. CI = Wilson 95 %.\n\n'
            '| App | Tool | Precision | Recall (CI95) | F1 | Lenient P | Findings |\n|---|---|---|---|---|---|---|\n')
    lines = []
    for app, tool, r in rows:
        if not r:
            lines.append(f'| {app} | {tool} | — | — | — | — | failed |')
            continue
        s, l = r['path_level']['strict'], r['path_level']['lenient']
        lines.append(f"| {app} | {tool} | {s['precision']:.1%} | {s['recall']:.1%} ({s['recall_ci95'][0]:.1%}–{s['recall_ci95'][1]:.1%}) "
                     f"| {s['f1']:.1%} | {l['precision']:.1%} | {r['counts']['endpoint_findings']} |")
    return head + '\n'.join(lines) + '\n'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tools', nargs='+', default=['linkfinder', 'xnlinkfinder', 'jsluice', 'katana'],
                    choices=['linkfinder', 'xnlinkfinder', 'jsluice', 'katana'])
    ap.add_argument('--apps', nargs='+', default=list(APPS), choices=list(APPS))
    ap.add_argument('--input', choices=['served', 'served+sources'], default='served')
    ap.add_argument('--evaluate-only', action='store_true', help='re-score existing raw outputs')
    args = ap.parse_args()

    config = args.input
    out = os.path.join(HERE, 'output', 'competitors', config)
    os.makedirs(out, exist_ok=True)
    meta = {'started': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'input': config,
            'manifest': json.load(open(MANIFEST, encoding='utf-8'))['version'], 'python': sys.version.split()[0],
            'platform': platform.platform(), 'tools': {}, 'runs': []}
    exes = {}
    if not args.evaluate_only:
        for t in args.tools:
            exe, info = {'linkfinder': linkfinder, 'xnlinkfinder': xnlinkfinder, 'jsluice': jsluice, 'katana': katana}[t]()
            exes[t] = exe
            meta['tools'][t] = dict(info, path=exe, available=bool(exe))
            print(f'{t:13s} {exe or "UNAVAILABLE"}')
    token = login() if 'katana' in args.tools and not args.evaluate_only else None

    rows = []
    for app in args.apps:
        files, urls = inventory(app, config == 'served+sources', out)
        print(f'\n[{app}] {len(files)} input file(s)')
        for t in args.tools:
            fmt, ext = FORMAT[t]
            raw = os.path.join(out, t, f'{app}.{ext}')
            os.makedirs(os.path.dirname(raw), exist_ok=True)
            cmds = []
            if not args.evaluate_only:
                if not exes.get(t):
                    rows.append((app, t, None))
                    continue
                if t == 'linkfinder':
                    cmds = run_linkfinder(exes[t], files, raw)
                elif t == 'xnlinkfinder':
                    cmds = run_xnlinkfinder(exes[t], files, raw, out, app)
                elif t == 'jsluice':
                    cmds = run_jsluice(exes[t], files, raw)
                elif t == 'katana':
                    if not token:
                        print('    katana skipped: login failed (containers down?)')
                        rows.append((app, t, None))
                        continue
                    cmds = run_katana(exes[t], APPS[app], raw, token)
            r = evaluate(fmt, app, raw, os.path.join(out, t, f'{app}.eval.json'), t) if os.path.exists(raw) else None
            rows.append((app, t, r))
            meta['runs'].append({'app': app, 'tool': t, 'raw': os.path.relpath(raw, HERE), 'inputs': urls,
                                 'commands': [[os.path.basename(c[0])] + [str(x) for x in c[1:8]] + (['…'] if len(c) > 8 else []) for c in cmds]})
            if r:
                s = r['path_level']['strict']
                print(f"    {t:13s} P {s['precision']:.1%}  R {s['recall']:.1%}  F1 {s['f1']:.1%}")
    meta['finished'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    json.dump(meta, open(os.path.join(out, 'run_meta.json'), 'w', encoding='utf-8'), indent=1)
    open(os.path.join(out, 'RESULTS.md'), 'w', encoding='utf-8').write(results_table(rows, config))
    print(f'\nwrote {os.path.relpath(out, HERE)}/RESULTS.md and run_meta.json')
    return 0


if __name__ == '__main__':
    sys.exit(main())
