#!/usr/bin/env python3
"""
Keep every served source map in sync with the app sources in this repository.

SPABench's bundles are hand-built (see README, "Limitations"), so their source
maps are written by this script rather than by a bundler. For every served map:

  * each `sources` entry is resolved to a file in the app's source tree and
    rewritten in one canonical form per app (e.g. webpack://nextjs-saas/./src/…);
  * `sourcesContent` is set to that file's exact content;
  * `mappings` is a single valid VLQ segment ("AAAA": generated 1:0 → source 1:0).
    Maps therefore carry the original sources but not position information —
    a documented limitation.

Usage:
  python scripts/sync_sourcemaps.py           # rewrite maps
  python scripts/sync_sourcemaps.py --check   # exit 1 if any map is out of date
"""

import argparse
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPS = os.path.join(ROOT, 'apps')
SCHEME = re.compile(r'^[a-z]+://[^/]*/')


def served_maps():
    pats = ['angular-permit/dist/**/*.map', 'angular-erp/dist/**/*.map', 'react-ecommerce/dist/**/*.map',
            'nextjs-saas/.next/**/*.map', 'nextjs-saas/dist/**/*.map']
    out = []
    for p in pats:
        out += glob.glob(os.path.join(APPS, p), recursive=True)
    return sorted(os.path.normpath(p) for p in out)


def project(map_path):
    """(project root, canonical source prefix) for a served map."""
    rel = os.path.relpath(map_path, APPS).replace(os.sep, '/')
    app = rel.split('/')[0]
    if app == 'angular-permit':
        return os.path.join(APPS, app), ''
    if app == 'angular-erp':
        sub = rel.split('/')[2]                       # dist/<sub>/…
        if sub == 'shell':
            return os.path.join(APPS, app, 'shell'), 'webpack://erp-shell/./'
        name = re.sub(r'-(\w)', lambda m: m.group(1).upper(), sub)   # mfe-inventory → mfeInventory
        return os.path.join(APPS, app, 'micro-frontends', sub), f'webpack://{name}/./'
    if app == 'react-ecommerce':
        return os.path.join(APPS, app), 'vite://react-ecommerce/'
    if app == 'nextjs-saas':
        return os.path.join(APPS, app), 'webpack://nextjs-saas/./'
    raise SystemExit(f'unknown app for {map_path}')


def resolve(root, source):
    rel = SCHEME.sub('', source)
    rel = re.sub(r'^(\./)+', '', rel)
    for cand in (rel, 'src/' + rel):
        p = os.path.join(root, cand)
        if os.path.isfile(p):
            return cand
    return None


def build(map_path):
    old = json.load(open(map_path, encoding='utf-8'))
    root, prefix = project(map_path)
    sources, contents, missing = [], [], []
    for s in old.get('sources', []):
        rel = resolve(root, s)
        if rel is None:
            missing.append(s)
            continue
        canon = prefix + rel
        if canon in sources:
            continue
        sources.append(canon)
        contents.append(open(os.path.join(root, rel), encoding='utf-8').read())
    new = {
        'version': 3,
        'file': os.path.basename(map_path)[:-4],
        'sourceRoot': '',
        'sources': sources,
        'sourcesContent': contents,
        'names': [],
        'mappings': 'AAAA' if sources else '',
    }
    return old, new, missing


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='report out-of-date maps, change nothing')
    args = ap.parse_args()

    stale, problems = [], []
    for mp in served_maps():
        old, new, missing = build(mp)
        rel = os.path.relpath(mp, ROOT).replace(os.sep, '/')
        if missing:
            problems.append(f'{rel}: no source file for {missing}')
        if not os.path.exists(mp[:-4]):
            problems.append(f'{rel}: no generated file {os.path.basename(mp[:-4])}')
        if old != new:
            stale.append(rel)
            if not args.check:
                with open(mp, 'w', encoding='utf-8', newline='\n') as f:
                    json.dump(new, f, ensure_ascii=False, separators=(',', ':'))
                    f.write('\n')

    for p in problems:
        print('PROBLEM', p)
    if args.check:
        for s in stale:
            print('STALE  ', s)
        print(f'{len(stale)} stale map(s), {len(problems)} problem(s)')
        return 1 if stale or problems else 0
    print(f'rewrote {len(stale)} map(s); {len(problems)} problem(s)')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
