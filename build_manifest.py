#!/usr/bin/env python3
"""
Build manifest.json (the SPABench ground truth) from apps/*/manifest-partial.json.

The partials are the only hand-written input: which endpoints each app's
client references, how they are reached (served / external host / probe-only),
auth, parameters, and — for paths that no single string literal contains — in
which artifact the path is *composed*. Everything else is derived from the
served artifacts (see spabench/artifacts.py):

  discovery_class     easiest artifact + form in which the endpoint is present:
                        html_literal, bundle_literal, bundle_composed,
                        sourcemap_literal, sourcemap_composed, runtime_data,
                        graphql_client_operation, graphql_sourcemap_operation,
                        graphql_introspection_only, probe_only
  evidence            every artifact the endpoint is present in (+ location)
  exclusive           present in exactly one artifact class
  minified_location   first literal occurrence in a served bundle (path:line:col, 1-based)
  source_file         source-map source that contains it, if any
  discovery_notes     written from the evidence when the partial gives none
  summary counts      totals, per kind/method/class

The build fails when an annotation contradicts the artifacts (e.g. "composed in
the bundle" but a segment is missing from it, or no evidence at all).

Usage:
  python build_manifest.py            write manifest.json
  python build_manifest.py --check    exit 1 if manifest.json is not what the partials produce
"""

import argparse
import collections
import datetime
import json
import os
import re
import sys
from urllib.parse import urlparse

from spabench.artifacts import ROOT, Corpus, literal_runs, line_col, segments, url_to_file

APPS = ['angular-permit', 'angular-erp', 'react-ecommerce', 'vue-portal', 'nextjs-saas']
VERSION = '3.0.0'
CLASS_ORDER = ['html_literal', 'bundle_literal', 'bundle_composed', 'sourcemap_literal', 'sourcemap_composed',
               'runtime_data', 'graphql_client_operation', 'graphql_sourcemap_operation',
               'graphql_introspection_only', 'probe_only']


class BuildError(Exception):
    pass


def where(corpus_hit):
    where_, text, off = corpus_hit
    line, col = line_col(text, off)
    return f'{where_}:{line}:{col}'


def evidence_rest(corpus, row):
    path = urlparse(row['url']).path
    runs, segs = literal_runs(path), segments(path)
    hint = row.get('evidence_hint', {})
    ev = {}
    for art in ('html', 'bundle', 'sourcemap'):
        hits = [corpus.find(art, r) for r in runs]
        if all(hits):
            ev[art] = {'form': 'literal', 'location': where(hits[0])}
    for art in hint.get('composed', []):
        if art in ev:
            continue
        missing = [s for s in segs if not corpus.find(art, s)]
        if missing:
            raise BuildError(f"{row['id']}: annotated as composed in {art}, but segment(s) {missing} are not in any {art} string literal")
        ev[art] = {'form': 'composed'}
    if hint.get('runtime'):
        head, last = segs[:-1], segs[-1]
        missing = [s for s in head if not corpus.find('bundle', s)]
        if missing:
            raise BuildError(f"{row['id']}: runtime-composed, but prefix segment(s) {missing} are not in the bundle")
        data = next((rel for text, rel, _, _ in corpus.data if last in text), None)
        ev['runtime'] = {'form': 'runtime', 'data_source': data}
    return ev


def evidence_graphql(corpus, row):
    op = row['graphql']['operation']
    ev = {}
    for art in ('html', 'bundle', 'sourcemap'):
        hit = corpus.identifier(art, op)
        if hit:
            ev[art] = {'form': 'operation', 'location': where(hit)}
    return ev


def classify(row, ev):
    if row['kind'] == 'graphql':
        if 'bundle' in ev or 'html' in ev:
            return 'graphql_client_operation'
        if 'sourcemap' in ev:
            return 'graphql_sourcemap_operation'
        return 'graphql_introspection_only'
    # Easiest artifact first (what the page serves > what the bundle contains >
    # what only the source maps contain); within an artifact, literal before composed.
    for art in ('html', 'bundle', 'sourcemap'):
        if art in ev:
            return f"{art}_{ev[art]['form']}"
    if 'runtime' in ev:
        return 'runtime_data'
    if row.get('reachability') == 'probe':
        return 'probe_only'
    raise BuildError(f"{row['id']} ({row['method']} {row['url']}): no evidence in any served artifact — "
                     f"add an evidence_hint or remove the entry")


def notes_for(row, ev, cls):
    parts = []
    for art in ('html', 'bundle', 'sourcemap', 'runtime'):
        e = ev.get(art)
        if not e:
            continue
        if art == 'runtime':
            parts.append('last path segment only known at runtime' + (f" (from {e['data_source']})" if e.get('data_source') else ''))
        elif 'location' in e:
            parts.append(f"{e['form']} in {art} at {e['location']}")
        else:
            parts.append(f"{e['form']} in {art}")
    if cls == 'graphql_introspection_only':
        parts.append('operation name appears in no client artifact; recoverable through schema introspection')
    if cls == 'probe_only':
        parts.append('referenced by no client artifact; found by probing well-known paths')
    return '; '.join(parts) + '.'


def build_endpoint(app, corpus, row):
    ev = evidence_graphql(corpus, row) if row['kind'] == 'graphql' else evidence_rest(corpus, row)
    cls = classify(row, ev)
    present = [a for a in ('html', 'bundle', 'sourcemap', 'runtime') if a in ev]
    if cls == 'graphql_introspection_only':
        present = ['introspection']
    if cls == 'probe_only':
        present = ['probe']
    bundle_loc = ev.get('bundle', {}).get('location') if ev.get('bundle', {}).get('form') in ('literal', 'operation') else None
    smap = ev.get('sourcemap', {}).get('location')
    out = {
        'id': row['id'],
        'url': row['url'],
        'method': row['method'],
        'kind': row['kind'],
        'test_case': row['test_case'],
        'discovery_class': cls,
        'evidence': ev,
        'present_in': present,
        'exclusive': len(present) == 1,
        'reachability': row['reachability'],
        'auth_required': row['auth_required'],
        'auth_method': row.get('auth_method') or (row['_app_auth'] if row['auth_required'] else 'none'),
        'parameters': row.get('parameters', []),
        'security_relevant': row.get('security_finding_type', 'none') != 'none',
        'security_finding_type': row.get('security_finding_type', 'none'),
        'source_file': smap.split('::', 1)[1].rsplit(':', 2)[0] if smap else None,
        'minified_location': bundle_loc,
        'discovery_notes': row.get('notes') or notes_for(row, ev, cls),
    }
    if 'design_technique' in row:
        out['design_technique'] = row['design_technique']
    if 'graphql' in row:
        out['graphql'] = row['graphql']
    return out


def build():
    apps, errors = [], []
    for app_id in APPS:
        part = json.load(open(os.path.join(ROOT, 'apps', app_id, 'manifest-partial.json'), encoding='utf-8'))
        meta = part['app']
        corpus = Corpus(app_id)
        eps = []
        for row in part['endpoints']:
            row = dict(row, _app_auth=meta['auth_method'])
            try:
                eps.append(build_endpoint(app_id, corpus, row))
            except BuildError as e:
                errors.append(str(e))
        assets = []
        for a in part.get('assets', []):
            served = url_to_file(app_id, a['url']) is not None
            if not served:
                errors.append(f"{a['id']}: asset {a['url']} is not served by {app_id}")
            assets.append(dict(a, served=served))
        apps.append({**meta, 'endpoint_count': len(eps), 'test_case_count': sum(e['test_case'] for e in eps),
                     'endpoints': eps, 'assets': assets})
    if errors:
        raise BuildError('\n'.join(errors))

    allep = [e for a in apps for e in a['endpoints']]
    distinct = {(a['id'], e['method'] if e['kind'] != 'graphql' else 'GRAPHQL',
                 re.sub(r'\{[^}]+\}', '{}', urlparse(e['url']).path) + ('#' + e['graphql']['operation'] if 'graphql' in e else ''))
                for a in apps for e in a['endpoints']}
    distinct_paths = {(a['id'], re.sub(r'\{[^}]+\}', '{}', urlparse(e['url']).path) + ('#' + e['graphql']['operation'] if 'graphql' in e else ''))
                      for a in apps for e in a['endpoints']}
    summary = {
        'apps': len(apps),
        'endpoints': len(allep),
        'test_cases': sum(e['test_case'] for e in allep),
        'distinct_method_paths': len(distinct),
        'distinct_paths': len(distinct_paths),
        'assets': sum(len(a['assets']) for a in apps),
        'auth_required': sum(e['auth_required'] for e in allep),
        'security_relevant': sum(e['security_relevant'] for e in allep),
        'by_kind': dict(sorted(collections.Counter(e['kind'] for e in allep).items())),
        'by_method': dict(sorted(collections.Counter(e['method'] for e in allep).items())),
        'by_reachability': dict(sorted(collections.Counter(e['reachability'] for e in allep).items())),
        'by_discovery_class': {c: n for c in CLASS_ORDER
                               for n in [sum(e['discovery_class'] == c for e in allep)] if n},
    }
    return {'version': VERSION, 'generated': None, 'summary': summary, 'apps': apps}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='compare with manifest.json instead of writing it')
    ap.add_argument('--output', default=os.path.join(ROOT, 'manifest.json'))
    args = ap.parse_args()
    try:
        new = build()
    except BuildError as e:
        print('BUILD FAILED\n' + str(e), file=sys.stderr)
        return 1

    old = None
    if os.path.exists(args.output):
        try:
            old = json.load(open(args.output, encoding='utf-8'))
        except ValueError:
            old = None
    same = old is not None and {k: v for k, v in old.items() if k != 'generated'} == {k: v for k, v in new.items() if k != 'generated'}
    if args.check:
        print('manifest.json is up to date' if same else 'manifest.json is OUT OF DATE — run python build_manifest.py')
        return 0 if same else 1
    new['generated'] = old['generated'] if same else datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    with open(args.output, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(new, f, indent=2, ensure_ascii=False)
        f.write('\n')
    s = new['summary']
    print(f"wrote {os.path.relpath(args.output, ROOT)}: {s['endpoints']} endpoints ({s['test_cases']} test cases), "
          f"{s['distinct_paths']} distinct paths, {s['assets']} assets")
    print('by discovery class:', s['by_discovery_class'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
