#!/usr/bin/env python3
"""
Validate manifest.json (SPABench v3).

  1. JSON Schema (manifest.schema.json) — skipped with a warning if jsonschema is missing
  2. The manifest equals what build_manifest.py produces from the partials (no hand edits)
  3. Semantic rules: summary counts, unique ids and URLs, vocabulary == docs/TECHNIQUE_REFERENCE.md,
     evidence consistency, auth and security consistency, URL/kind/reachability agreement

Exit 0 = valid, 1 = errors.

Usage:
  python validate_manifest.py [--manifest manifest.json] [--schema manifest.schema.json] [-v]
"""

import argparse
import collections
import json
import os
import re
import sys
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

try:
    import jsonschema
except ImportError:                      # optional dependency
    jsonschema = None


def technique_reference_tags(path):
    """Tags listed in the first column of the vocabulary tables in docs/TECHNIQUE_REFERENCE.md
    (everything above the derived "Discovery classes" section)."""
    text = open(path, encoding='utf-8').read().split('## Discovery classes')[0]
    return set(re.findall(r'^\|\s*`([a-z0-9_]+)`\s*\|', text, re.M))


def check(manifest, schema, verbose=False):
    errors, warnings = [], []
    err = errors.append

    # 1. schema
    if jsonschema is None:
        warnings.append('jsonschema not installed — schema validation skipped (pip install jsonschema)')
    else:
        v = jsonschema.Draft7Validator(schema)
        for e in sorted(v.iter_errors(manifest), key=lambda e: list(e.path)):
            err('schema: ' + '/'.join(str(p) for p in e.path) + ': ' + e.message[:200])

    # 2. built, not hand-edited
    try:
        import build_manifest
        built = build_manifest.build()
        if {k: v for k, v in built.items() if k != 'generated'} != {k: v for k, v in manifest.items() if k != 'generated'}:
            err('manifest.json differs from build_manifest.py output — edit apps/*/manifest-partial.json and rebuild')
    except Exception as e:                # noqa: BLE001 — report any build failure as a validation error
        err(f'build_manifest.py failed: {e}')

    # 3. semantics
    apps = manifest.get('apps', [])
    eps = [(a, e) for a in apps for e in a.get('endpoints', [])]
    ids = [e['id'] for _, e in eps] + [x['id'] for a in apps for x in a.get('assets', [])]
    for i, n in collections.Counter(ids).items():
        if n > 1:
            err(f'duplicate id {i}')
    keys = collections.Counter((a['id'], e['method'], e['url']) for a, e in eps)
    for k, n in keys.items():
        if n > 1:
            err(f'duplicate endpoint {k}')

    s = manifest.get('summary', {})
    expect = {
        'apps': len(apps), 'endpoints': len(eps), 'test_cases': sum(e['test_case'] for _, e in eps),
        'assets': sum(len(a.get('assets', [])) for a in apps),
        'auth_required': sum(e['auth_required'] for _, e in eps),
        'security_relevant': sum(e['security_relevant'] for _, e in eps),
    }
    for k, v in expect.items():
        if s.get(k) != v:
            err(f'summary.{k} = {s.get(k)} but the lists give {v}')
    for k, field in (('by_kind', 'kind'), ('by_method', 'method'), ('by_reachability', 'reachability'),
                     ('by_discovery_class', 'discovery_class')):
        got = dict(collections.Counter(e[field] for _, e in eps))
        if s.get(k) != {kk: got[kk] for kk in s.get(k, {})} or sum(s.get(k, {}).values()) != len(eps):
            err(f'summary.{k} does not match the endpoint lists')
    for a in apps:
        if a['endpoint_count'] != len(a['endpoints']):
            err(f"{a['id']}: endpoint_count {a['endpoint_count']} != {len(a['endpoints'])}")
        if a['test_case_count'] != sum(e['test_case'] for e in a['endpoints']):
            err(f"{a['id']}: test_case_count is wrong")

    vocab = set(schema['definitions']['Endpoint']['properties']['design_technique']['enum'])
    ref = os.path.join(HERE, 'docs', 'TECHNIQUE_REFERENCE.md')
    if os.path.exists(ref):
        doc = technique_reference_tags(ref)
        if vocab - doc:
            err(f'techniques in the schema but not in docs/TECHNIQUE_REFERENCE.md: {sorted(vocab - doc)}')
        if doc - vocab:
            err(f'techniques in docs/TECHNIQUE_REFERENCE.md but not in the schema: {sorted(doc - vocab)}')
    else:
        err('docs/TECHNIQUE_REFERENCE.md missing')

    for a, e in eps:
        eid = e['id']
        u = urlparse(e['url'])
        host = u.netloc
        if e['kind'] == 'websocket' and u.scheme not in ('ws', 'wss'):
            err(f'{eid}: websocket entry must use ws:// or wss://')
        if e['kind'] != 'websocket' and u.scheme not in ('http', 'https'):
            err(f'{eid}: {e["kind"]} entry must use http(s)://')
        if e['kind'] == 'graphql':
            if e['method'] != 'GRAPHQL' or 'graphql' not in e or u.fragment != e['graphql']['operation']:
                err(f'{eid}: GraphQL entries need method GRAPHQL and url fragment == graphql.operation')
        elif e['method'] == 'GRAPHQL':
            err(f'{eid}: method GRAPHQL on a non-graphql entry')
        if e['reachability'] == 'external':
            if host in a['api_hosts'] or host not in a['external_hosts']:
                err(f'{eid}: external entry on {host}, which is not listed in external_hosts')
        elif host not in a['api_hosts']:
            err(f'{eid}: host {host} is not one of {a["id"]} api_hosts')
        if e['auth_required'] == (e['auth_method'] == 'none'):
            err(f'{eid}: auth_required={e["auth_required"]} but auth_method={e["auth_method"]}')
        if e['security_relevant'] != (e['security_finding_type'] != 'none'):
            err(f'{eid}: security_relevant disagrees with security_finding_type')
        if e['exclusive'] != (len(e['present_in']) == 1):
            err(f'{eid}: exclusive must equal (len(present_in) == 1)')
        art = e['discovery_class'].split('_')[0]
        if art in ('html', 'bundle', 'sourcemap') and art not in e['evidence']:
            err(f'{eid}: discovery_class {e["discovery_class"]} has no {art} evidence')
        if e['discovery_class'] == 'probe_only' and e['reachability'] != 'probe':
            err(f'{eid}: probe_only entries must have reachability "probe"')
        if not e.get('test_case') and 'design_technique' in e and e['design_technique'] not in vocab:
            err(f'{eid}: unknown design_technique')
    for a in apps:
        for x in a.get('assets', []):
            if not x['served']:
                err(f"{x['id']}: asset {x['url']} is not served")

    if verbose:
        print(f"  {len(apps)} apps, {len(eps)} endpoints ({expect['test_cases']} test cases), {expect['assets']} assets")
        print('  by discovery class:', s.get('by_discovery_class'))
    return errors, warnings


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--manifest', default=os.path.join(HERE, 'manifest.json'))
    ap.add_argument('--schema', default=os.path.join(HERE, 'manifest.schema.json'))
    ap.add_argument('-v', '--verbose', action='store_true')
    args = ap.parse_args()

    manifest = json.load(open(args.manifest, encoding='utf-8'))
    schema = json.load(open(args.schema, encoding='utf-8'))
    print(f"SPABench manifest validator — {os.path.basename(args.manifest)} v{manifest.get('version')}")
    errors, warnings = check(manifest, schema, args.verbose)
    for w in warnings:
        print('  WARN ', w)
    for e in errors:
        print('  ERROR', e)
    print(f"{'VALID' if not errors else 'INVALID'} — {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
