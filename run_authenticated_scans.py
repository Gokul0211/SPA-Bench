#!/usr/bin/env python3
"""
SPABench run_authenticated_scans.py — run the Shadow Endpoints scanner against
every app and score it with exactly the same evaluate.py call the baselines get
(run_competitor_scans.py).

Authentication: the scanner receives a real JWT from POST /api/auth/login
(benchadmin/benchpass) via --bearer, plus the login endpoint and credentials
(--api-login-url/--username/--password) so it can log in itself. No static
token is involved (the servers reject it unless BENCH_ALLOW_STATIC_TOKEN=1).

Determinism: PYTHONHASHSEED=0 is set for the scanner process.

Outputs (output/scanner/):
  <app>.json        the scanner's JSON report
  <app>.eval.json   evaluate.py report
  run_meta.json     scanner path + git commit, command lines, timestamps, exit codes
  RESULTS.md        table generated from the reports

Usage:
  python run_authenticated_scans.py                              # refactored scanner (default)
  python run_authenticated_scans.py --scanner ../main.py         # the original single-file scanner
  python run_authenticated_scans.py --apps vue-portal --evaluate-only
"""

import argparse
import datetime
import glob
import json
import os
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
EVALUATE = os.path.join(HERE, 'evaluate.py')
MANIFEST = os.path.join(HERE, 'manifest.json')
DEFAULT_SCANNER = os.path.normpath(os.path.join(HERE, '..', '..', 'refactored', 'main.py'))
LOGIN = 'http://127.0.0.1:4001/api/auth/login'
CREDS = {'username': 'benchadmin', 'password': 'benchpass'}
APPS = {'angular-permit': 3001, 'angular-erp': 3002, 'react-ecommerce': 3003, 'vue-portal': 3004, 'nextjs-saas': 3005}
OUT = os.path.join(HERE, 'output', 'scanner')


def login():
    req = urllib.request.Request(LOGIN, data=json.dumps(CREDS).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())['token']


def git_commit(path):
    r = subprocess.run(['git', '-C', os.path.dirname(path), 'rev-parse', 'HEAD'], capture_output=True, text=True)
    dirty = subprocess.run(['git', '-C', os.path.dirname(path), 'status', '--porcelain'], capture_output=True, text=True)
    return (r.stdout.strip() or None, bool(dirty.stdout.strip()))


def scan(scanner, app, port, token, timeout):
    target = f'http://127.0.0.1:{port}'
    out = os.path.join(OUT, f'{app}.json')
    cmd = [sys.executable, scanner, '--target', target, '--output', out,
           '--max-routes', '30', '--max-depth', '5', '--workers', '15', '--timeout', '30',
           '--api-login-url', LOGIN, '--username', CREDS['username'], '--password', CREDS['password'],
           '--bearer', token]
    env = dict(os.environ, PYTHONHASHSEED='0')
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        code = subprocess.run(cmd, cwd=HERE, env=env, timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        code = 'timeout'
    if not os.path.exists(out):
        # the original single-file scanner ignores --output: take its newest report for this target
        reports = glob.glob(os.path.join(HERE, 'output', f'127_0_0_1_{port}', 'json', '*.json'))
        newest = max(reports, key=os.path.getmtime) if reports else None
        if newest and os.path.getmtime(newest) >= datetime.datetime.fromisoformat(started).timestamp() - 1:
            shutil.copyfile(newest, out)
    shown = [os.path.basename(c) if c == scanner else ('<jwt>' if c == token else c) for c in cmd]
    return {'app': app, 'command': shown, 'exit_code': code, 'started': started,
            'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'report': os.path.relpath(out, HERE) if os.path.exists(out) else None}


def evaluate(app, report_path):
    rep = os.path.join(OUT, f'{app}.eval.json')
    r = subprocess.run([sys.executable, EVALUATE, '--manifest', MANIFEST, '--tool-output', report_path,
                        '--format', 'spabench-v1', '--app', app, '--name', 'shadow-endpoints', '--report', rep],
                       capture_output=True, text=True, encoding='utf-8')
    print(r.stdout)
    if r.returncode or not os.path.exists(rep):
        print('evaluate failed:', r.stderr[-400:])
        return None
    return json.load(open(rep, encoding='utf-8'))['apps'][0]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--scanner', default=DEFAULT_SCANNER)
    ap.add_argument('--apps', nargs='+', default=list(APPS), choices=list(APPS))
    ap.add_argument('--timeout', type=int, default=3600, help='seconds per app')
    ap.add_argument('--evaluate-only', action='store_true')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    scanner = os.path.abspath(args.scanner)
    commit, dirty = git_commit(scanner)
    meta = {'scanner': scanner, 'scanner_commit': commit, 'scanner_dirty': dirty,
            'manifest': json.load(open(MANIFEST, encoding='utf-8'))['version'], 'runs': []}
    token = None
    if not args.evaluate_only:
        try:
            token = login()
        except Exception as e:                    # noqa: BLE001
            print(f'login failed ({e}) — start the benchmark with docker compose up -d')
            return 1

    rows, failed = [], False
    for app in args.apps:
        print(f'\n===== {app} =====')
        run = {'app': app}
        if not args.evaluate_only:
            run = scan(scanner, app, APPS[app], token, args.timeout)
            if run['exit_code'] != 0:
                print(f"scanner exit code {run['exit_code']}")
                failed = True
        report = os.path.join(OUT, f'{app}.json')
        result = evaluate(app, report) if os.path.exists(report) else None
        if result is None:
            failed = True
        rows.append((app, result))
        meta['runs'].append(run)

    json.dump(meta, open(os.path.join(OUT, 'run_meta.json'), 'w', encoding='utf-8'), indent=1)
    lines = ['# Shadow Endpoints results\n', 'Generated by run_authenticated_scans.py. Path level; CI = Wilson 95 %.\n',
             '| App | Precision (strict) | Recall (CI95) | F1 | Precision (lenient) | Test-case recall |',
             '|---|---|---|---|---|---|']
    for app, r in rows:
        if not r:
            lines.append(f'| {app} | — | — | — | — | failed |')
            continue
        s, l = r['path_level']['strict'], r['path_level']['lenient']
        lines.append(f"| {app} | {s['precision']:.1%} | {s['recall']:.1%} ({s['recall_ci95'][0]:.1%}–{s['recall_ci95'][1]:.1%}) "
                     f"| {s['f1']:.1%} | {l['precision']:.1%} | {r['recall_test_cases']:.1%} |")
    open(os.path.join(OUT, 'RESULTS.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(f'wrote {os.path.relpath(OUT, HERE)}/RESULTS.md')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
