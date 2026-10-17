#!/usr/bin/env python3
"""
SPABench evaluate.py — score an API-discovery tool against manifest.json (v3).

Unit of evaluation
  An endpoint is identified by its path template (REST, WebSocket) or its
  operation name (GraphQL), per app. Every finding and every ground-truth entry
  is reduced to that unit, so a path counts once no matter how many HTTP
  methods use it or how many times a tool reports it.
    path level   (primary)    recall = matched GT paths / GT paths
                              precision = matching finding-paths / all finding-paths
    method level (secondary)  the same over (method, path); only for tools that emit methods
  Precision and recall always use the same unit.

Matching
  * relative findings ("/api/x") resolve against the app's origin;
  * hosts are interchangeable only within the app's api_hosts (its origin and the
    backends it proxies to); external hosts (staging, private IPs) must match exactly;
  * {param} in the ground truth matches any one segment; a finding's own
    placeholder ({id}, :id, ${…}) matches only a {param};
  * GraphQL operations match on name — the tool reports them as ".../graphql#op".

Strict (default) vs lenient
  strict   a finding that matches no ground-truth path is a false positive, including
           findings on hosts outside the app (reported as out_of_scope)
  lenient  additionally credits findings the route oracle confirms are served by the
           benchmark (real but not referenced by the client, e.g. /actuator/health) and
           ignores out-of-scope hosts. Both are always reported; --mode picks the headline.

Assets
  Findings that are static files (.js, .map, .css, .html, images, …) are not
  endpoints: they are scored separately against the app's asset list and never
  count as endpoint false positives.

Formats (--format): spabench-v1 (default), linkfinder, xnlinkfinder, jsluice, katana, urls

Examples
  python evaluate.py --tool-output scan.json --app angular-permit
  python evaluate.py --tool-output lf.txt --format linkfinder --app angular-permit --breakdown-by discovery_class
  python evaluate.py --tool-output scan.json --app vue-portal --min-score 55 --pr-curve
  python evaluate.py --legacy-v2 --manifest legacy/manifest-v2.0.json --tool-output scan.json --app angular-permit
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

ASSET_EXT = re.compile(r'\.(?:m?js|map|css|html?|json|wsdl|xml|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|txt|wasm)$', re.I)
PLACEHOLDER = re.compile(r'^(\{[^}]*\}|:\w+|\$\{[^}]*\}|<[^>]+>)$')
ID_LIKE = re.compile(r'^(\d+|[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f-]{27,}|[A-Za-z]+-\d+)$', re.I)


# ── loaders ─────────────────────────────────────────────────────────────────

def _lines(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        return [l.strip() for l in f if l.strip() and not l.lstrip().startswith('#')]


def load_spabench(path):
    with open(path, encoding='utf-8') as f:
        d = json.load(f)
    out = []
    for e in d.get('endpoints', []) if isinstance(d, dict) else d:
        url = e.get('url') or e.get('endpoint') or ''
        if url:
            params = e.get('parameters')
            out.append({'url': url, 'method': (e.get('method') or '').upper() or None,
                        'score': e.get('confidence_score', e.get('score')),
                        'auth_required': e.get('auth_required'),
                        'parameters': sorted({p if isinstance(p, str) else p.get('name') for p in params} - {None})
                        if isinstance(params, list) else None})
    return out


def load_linkfinder(path):
    return [{'url': l, 'method': None} for l in _lines(path)]


def load_xnlinkfinder(path):
    try:
        with open(path, encoding='utf-8') as f:
            d = json.load(f)
        items = d if isinstance(d, list) else d.get('results', d.get('endpoints', []))
        return [{'url': i if isinstance(i, str) else i.get('url', ''), 'method': None} for i in items if i]
    except ValueError:
        return load_linkfinder(path)


def load_jsluice(path):
    out = []
    with open(path, encoding='utf-8', errors='replace') as f:
        text = f.read().strip()
    items = []
    if text.startswith('['):
        items = json.loads(text)
    else:
        for line in text.splitlines():
            try:
                items.append(json.loads(line))
            except ValueError:
                continue
    for i in items:
        url = i.get('url') or i.get('value') or ''
        if url:
            out.append({'url': url, 'method': (i.get('method') or '').upper() or None})
    return out


def load_katana(path):
    out = []
    for line in _lines(path):
        try:
            item = json.loads(line)
        except ValueError:
            continue
        req = item.get('request', item)
        url = req.get('endpoint') or req.get('url') or ''
        if url:
            out.append({'url': url, 'method': (req.get('method') or '').upper() or None})
    return out


LOADERS = {'spabench-v1': load_spabench, 'linkfinder': load_linkfinder, 'xnlinkfinder': load_xnlinkfinder,
           'jsluice': load_jsluice, 'katana': load_katana, 'urls': load_linkfinder}
METHOD_AWARE = {'spabench-v1', 'jsluice', 'katana'}


# ── normalisation ───────────────────────────────────────────────────────────

def canon_host(netloc):
    h = netloc.lower()
    for a in ('127.0.0.1', '[::1]', '0.0.0.0'):
        h = h.replace(a, 'localhost')
    return h


def split_url(url, origin):
    """(host, path, fragment) with relative URLs resolved against origin."""
    url = url.strip()
    frag = ''
    if '#' in url:
        url, frag = url.split('#', 1)
    if url.startswith('//'):
        url = 'http:' + url
    if not re.match(r'^[a-z][a-z0-9+.-]*://', url, re.I):
        if not url.startswith('/'):
            url = '/' + url
        url = origin.rstrip('/') + url
    p = urlparse(url)
    path = re.sub(r'/{2,}', '/', p.path or '/').rstrip('/') or '/'
    return canon_host(p.netloc), path, frag.strip()


def segs(path):
    return [s for s in path.split('/') if s]


def template_key(path):
    """Dedup key: id-like segments and placeholders collapse to {}."""
    return '/' + '/'.join('{}' if PLACEHOLDER.match(s) or ID_LIKE.match(s) else s for s in segs(path))


def path_match(finding_path, gt_path):
    f, g = segs(finding_path), segs(gt_path)
    if len(f) != len(g):
        return False
    for fs, gs in zip(f, g):
        if gs.startswith('{') and gs.endswith('}'):
            continue
        if PLACEHOLDER.match(fs) or fs != gs:
            return False
    return True


# ── ground truth ────────────────────────────────────────────────────────────

class App:
    def __init__(self, a):
        self.id = a['id']
        self.origin = a['origin']
        self.api_hosts = {h.lower() for h in a['api_hosts']}
        self.external_hosts = {h.lower() for h in a['external_hosts']}
        self.endpoints = a['endpoints']
        self.assets = a.get('assets', [])
        # path-level units: (host-class, path or #op) → [entries]
        self.units = defaultdict(list)
        for e in self.endpoints:
            self.units[self.unit_of_entry(e)].append(e)

    def host_class(self, host):
        if host in self.api_hosts:
            return 'app'
        if host in self.external_hosts:
            return host
        return None

    def unit_of_entry(self, e):
        if e['kind'] == 'graphql':
            return ('graphql', e['graphql']['operation'])
        host, path, _ = split_url(e['url'], self.origin)
        return (self.host_class(host) or host, path)

    def match_units(self, host, path, frag):
        """Ground-truth units a finding (host, path, fragment) discovers."""
        hc = self.host_class(host)
        if hc is None:
            return []
        if frag and path.endswith('/graphql'):
            return [u for u in self.units if u == ('graphql', frag)]
        return [u for u in self.units if u[0] == hc and u[0] != 'graphql' and path_match(path, u[1])]


def load_manifest(path, app_filter=None):
    with open(path, encoding='utf-8') as f:
        m = json.load(f)
    if not str(m.get('version', '')).startswith('3.'):
        raise SystemExit(f'{path} is a v{m.get("version")} manifest; use --legacy-v2 for v2 manifests')
    apps = [App(a) for a in m['apps'] if not app_filter or a['id'] == app_filter]
    if not apps:
        raise SystemExit(f'no app {app_filter!r} in {path}')
    return m, apps


# ── vendor noise ────────────────────────────────────────────────────────────

def load_noise(path=os.path.join(HERE, 'noise', 'manifest-noise.json')):
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as f:
        return [(p['tag'], ind) for p in json.load(f).get('patterns', []) for ind in p.get('indicators', [])]


def noise_tag(url, rules):
    """Tag of the first vendor-noise rule a URL matches. Indicators with a '/' must
    match a whole run of path segments; bare words must equal a whole segment;
    indicators containing spaces (PDF operators) match the raw string."""
    low = url.lower()
    path = '/' + '/'.join(segs(urlparse(low).path if '://' in low else low.split('?')[0])) + '/'
    for tag, ind in rules:
        i = ind.lower()
        if ' ' in i or '[' in i:
            hit = i in low
        elif '/' in i:
            hit = ('/' + i.strip('/') + '/') in path
        else:
            hit = ('/' + i + '/') in path
        if hit:
            return tag
    return None


# ── statistics ──────────────────────────────────────────────────────────────

def wilson(k, n, z=1.959964):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (round(max(0.0, c - h), 4), round(min(1.0, c + h), 4))


def prf(tp_pred, n_pred, tp_gt, n_gt):
    p = tp_pred / n_pred if n_pred else 0.0
    r = tp_gt / n_gt if n_gt else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {'precision': round(p, 4), 'recall': round(r, 4), 'f1': round(f, 4),
            'precision_ci95': wilson(tp_pred, n_pred), 'recall_ci95': wilson(tp_gt, n_gt),
            'tp_findings': tp_pred, 'findings': n_pred, 'tp_ground_truth': tp_gt, 'ground_truth': n_gt}


# ── core ────────────────────────────────────────────────────────────────────

def evaluate_app(app, findings, oracle=None, method_aware=False):
    """Score one app. findings: [{'url','method'}]."""
    served_assets = None
    if oracle is not None:
        from spabench.artifacts import served_files
        served_assets = {split_url(u, app.origin)[:2] for u, _ in served_files(app.id)}

    endpoint_keys = {}        # dedup key → {'units', 'methods', 'scope', 'raw'}
    asset_keys = {}
    for f in findings:
        host, path, frag = split_url(f['url'], app.origin)
        if ASSET_EXT.search(path) and not (frag and path.endswith('/graphql')):
            asset_keys.setdefault((host, path), f['url'])
            continue
        hc = app.host_class(host)
        key = ('graphql', frag) if (frag and path.endswith('/graphql')) else (hc or host, template_key(path))
        rec = endpoint_keys.setdefault(key, {'units': set(), 'methods': set(), 'scope': hc is not None,
                                             'raw': f['url'], 'host': host, 'path': path, 'frag': frag,
                                             'auth': [], 'params': None})
        if f.get('auth_required') is not None:
            rec['auth'].append(bool(f['auth_required']))
        if f.get('parameters') is not None:
            rec['params'] = (rec['params'] or set()) | set(f['parameters'])
        rec['units'] |= set(app.match_units(host, path, frag))
        if f.get('method'):
            rec['methods'].add(f['method'])

    gt_units = set(app.units)
    found_units = set().union(*[r['units'] for r in endpoint_keys.values()]) if endpoint_keys else set()
    in_scope = [r for r in endpoint_keys.values() if r['scope']]
    out_scope = [r for r in endpoint_keys.values() if not r['scope']]
    matched = [r for r in endpoint_keys.values() if r['units']]
    unmatched = [r for r in in_scope if not r['units']]

    real_uncurated = []
    if oracle is not None:
        for r in unmatched:
            for meth in (sorted(r['methods']) or ['GET']):
                url = f"http://{r['host'] if r['host'] not in ('', 'app') else urlparse(app.origin).netloc}{r['path']}"
                ok, _ = oracle.resolve(url, 'POST' if r['frag'] else meth)
                if ok and r['frag']:
                    ok = r['frag'] in oracle.backends.gql_ops
                if ok:
                    real_uncurated.append(r)
                    break

    strict = prf(len(matched), len(endpoint_keys), len(found_units), len(gt_units))
    lenient = prf(len(matched) + len(real_uncurated), len(in_scope), len(found_units), len(gt_units))

    # method level: only meaningful when the tool reports methods
    method_level = None
    if method_aware:
        gt_m = {(u, e['method']) for u, es in app.units.items() for e in es}
        found_m = set()
        tp_pred = n_pred = 0
        for r in endpoint_keys.values():
            ms = r['methods'] or {'GET'}
            for m in ms:
                n_pred += 1
                hit = {(u, e['method']) for u in r['units'] for e in app.units[u]
                       if e['method'] == m or (e['method'] in ('GRAPHQL', 'WS') and r['units'])}
                if hit:
                    tp_pred += 1
                    found_m |= hit
        method_level = prf(tp_pred, n_pred, len(found_m), len(gt_m))

    # auth_required accuracy: only findings that state a value, only matched units
    auth_gt = {u: any(e['auth_required'] for e in es) for u, es in app.units.items()}
    auth_ok = auth_n = 0
    for r in matched:
        if not r['auth']:
            continue
        said = any(r['auth'])
        for u in r['units']:
            auth_n += 1
            auth_ok += said == auth_gt[u]
    # parameter level: query/body/header parameters of ground-truth entries (path parameters live in the URL)
    gt_params = {u: {p['name'] for e in es for p in (e.get('parameters') or []) if p.get('location') != 'path'}
                 for u, es in app.units.items()}
    p_tp = p_found = p_gt = 0
    for r in matched:
        if r['params'] is None:
            continue
        for u in r['units']:
            p_found += len(r['params'])
            p_tp += len(r['params'] & gt_params[u])
            p_gt += len(gt_params[u])
    param_level = None
    if any(r['params'] is not None for r in matched):
        param_level = {'reported': p_found, 'correct': p_tp, 'ground_truth': p_gt,
                       'precision': round(p_tp / p_found, 4) if p_found else 0.0,
                       'recall': round(p_tp / p_gt, 4) if p_gt else None}

    def breakdown(field, only_test_cases=False):
        d = defaultdict(lambda: [0, 0])
        for u, es in app.units.items():
            vals = {e.get(field) for e in es if (e.get('test_case') or not only_test_cases)} - {None}
            for v in vals:
                d[v][1] += 1
                d[v][0] += u in found_units
        return {k: {'found': a, 'total': b, 'recall': round(a / b, 4) if b else 0.0} for k, (a, b) in sorted(d.items())}

    auth_units = {u for u, es in app.units.items() if any(e['auth_required'] for e in es)}
    public_units = gt_units - auth_units
    tc_units = {u for u, es in app.units.items() if any(e['test_case'] for e in es)}

    fps = [r['raw'] for r in unmatched if r not in real_uncurated] + [r['raw'] for r in out_scope]
    rules = load_noise()
    noise = Counter(t for t in (noise_tag(u, rules) for u in fps) if t)

    asset_gt = {split_url(x['url'], app.origin)[:2] for x in app.assets}
    asset_found = set(asset_keys)
    asset_tp = asset_found & asset_gt
    asset_real = {k for k in asset_found if served_assets and k in served_assets}

    return {
        'app': app.id,
        'path_level': {'strict': strict, 'lenient': lenient},
        'method_level': method_level,
        'auth_accuracy': ({'checked': auth_n, 'correct': auth_ok, 'accuracy': round(auth_ok / auth_n, 4)} if auth_n else None),
        'parameter_level': param_level,
        'counts': {
            'findings_raw': len(findings), 'endpoint_findings': len(endpoint_keys), 'asset_findings': len(asset_keys),
            'matched_findings': len(matched), 'out_of_scope': len(out_scope), 'unmatched_in_scope': len(unmatched),
            'real_uncurated': len(real_uncurated), 'ground_truth_paths': len(gt_units), 'found_paths': len(found_units),
        },
        'recall_authenticated': round(len(found_units & auth_units) / len(auth_units), 4) if auth_units else None,
        'recall_public': round(len(found_units & public_units) / len(public_units), 4) if public_units else None,
        'recall_test_cases': round(len(found_units & tc_units) / len(tc_units), 4) if tc_units else None,
        'per_discovery_class': breakdown('discovery_class'),
        'per_design_technique': breakdown('design_technique', only_test_cases=True),
        'per_kind': breakdown('kind'),
        'assets': {'ground_truth': len(asset_gt), 'found': len(asset_tp),
                   'recall': round(len(asset_tp) / len(asset_gt), 4) if asset_gt else None,
                   'reported': len(asset_found), 'served': len(asset_real) if served_assets is not None else None},
        'hits': {e['id']: (u in found_units) for u, es in app.units.items() for e in es},
        'missed': sorted(e['id'] for u, es in app.units.items() if u not in found_units for e in es),
        'false_positives': sorted(fps),
        'vendor_noise': {'fps': sum(noise.values()), 'rate': round(sum(noise.values()) / len(fps), 4) if fps else 0.0,
                         'by_tag': dict(noise)},
        'real_uncurated': sorted(r['raw'] for r in real_uncurated),
    }


def combine(results, mode):
    """Micro (pooled) and macro (mean over apps) path-level scores."""
    pool = defaultdict(int)
    for r in results:
        s = r['path_level'][mode]
        for k in ('tp_findings', 'findings', 'tp_ground_truth', 'ground_truth'):
            pool[k] += s[k]
    micro = prf(pool['tp_findings'], pool['findings'], pool['tp_ground_truth'], pool['ground_truth'])
    macro = {k: round(sum(r['path_level'][mode][k] for r in results) / len(results), 4) for k in ('precision', 'recall', 'f1')}
    return {'micro': micro, 'macro': macro}


def pr_curve(app, findings, oracle):
    scores = sorted({f['score'] for f in findings if isinstance(f.get('score'), (int, float))})
    out = []
    for t in scores:
        r = evaluate_app(app, [f for f in findings if (f.get('score') or 0) >= t], oracle)
        s = r['path_level']['strict']
        out.append({'threshold': t, 'precision': s['precision'], 'recall': s['recall'], 'findings': s['findings']})
    return out


# ── output ──────────────────────────────────────────────────────────────────

def pct(v):
    return '   n/a' if v is None else f'{v * 100:5.1f}%'


def print_result(r, mode, name):
    s = r['path_level'][mode]
    c = r['counts']
    print(f"\n== {name} on {r['app']}  [{mode}]")
    print(f"  precision {pct(s['precision'])}  CI95 {s['precision_ci95']}   ({s['tp_findings']}/{s['findings']} finding-paths)")
    print(f"  recall    {pct(s['recall'])}  CI95 {s['recall_ci95']}   ({s['tp_ground_truth']}/{s['ground_truth']} ground-truth paths)")
    print(f"  F1        {pct(s['f1'])}")
    other = 'lenient' if mode == 'strict' else 'strict'
    o = r['path_level'][other]
    print(f"  ({other}: precision {pct(o['precision'])}, recall {pct(o['recall'])})")
    if r['method_level']:
        m = r['method_level']
        print(f"  method level: precision {pct(m['precision'])}, recall {pct(m['recall'])}")
    if r.get('auth_accuracy'):
        a_ = r['auth_accuracy']
        print(f"  auth_required accuracy {pct(a_['accuracy'])} ({a_['correct']}/{a_['checked']} matched units where the tool states it)")
    if r.get('parameter_level'):
        p_ = r['parameter_level']
        print(f"  parameters (query/body): precision {pct(p_['precision'])} ({p_['correct']}/{p_['reported']}), "
              f"recall {pct(p_['recall']) if p_['recall'] is not None else 'n/a'} ({p_['correct']}/{p_['ground_truth']})")
    print(f"  recall public {pct(r['recall_public'])} | auth-gated {pct(r['recall_authenticated'])} | test cases {pct(r['recall_test_cases'])}")
    print(f"  findings: {c['findings_raw']} raw → {c['endpoint_findings']} endpoint paths + {c['asset_findings']} assets; "
          f"{c['matched_findings']} matched, {c['real_uncurated']} real-uncurated, {c['unmatched_in_scope'] - c['real_uncurated']} unmatched, {c['out_of_scope']} out of scope")
    if r['vendor_noise']['fps']:
        print(f"  vendor noise: {r['vendor_noise']['fps']} of the false positives ({pct(r['vendor_noise']['rate'])})")
    a = r['assets']
    if a['ground_truth']:
        print(f"  assets: {a['found']}/{a['ground_truth']} listed assets found ({a['reported']} asset URLs reported)")


def print_breakdown(r, by):
    data = r[f'per_{by}']
    print(f'  by {by}:')
    for k, v in data.items():
        print(f"    {k:34s} {v['found']:4d}/{v['total']:<4d} {pct(v['recall'])}")


def legacy(argv):
    """--legacy-v2: run the v2.x evaluator unchanged (reproduces the submitted numbers)."""
    argv = [a for a in argv if a != '--legacy-v2']
    if not any(a == '--manifest' or a.startswith('--manifest=') for a in argv):
        argv = ['--manifest', os.path.join(HERE, 'legacy', 'manifest-v2.0.json')] + argv
    return subprocess.call([sys.executable, os.path.join(HERE, 'legacy', 'evaluate_v2.py')] + argv)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--legacy-v2' in sys.argv:
        return legacy(sys.argv[1:])
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--manifest', default=os.path.join(HERE, 'manifest.json'))
    ap.add_argument('--tool-output', required=True)
    ap.add_argument('--format', default='spabench-v1', choices=sorted(LOADERS))
    ap.add_argument('--app', help='score one app (recommended; required for relative findings)')
    ap.add_argument('--name', help='tool name for the report')
    ap.add_argument('--mode', choices=['strict', 'lenient'], default='strict', help='headline numbers (both are always computed)')
    ap.add_argument('--no-oracle', action='store_true', help='skip the route oracle (lenient = strict minus out-of-scope)')
    ap.add_argument('--min-score', type=float, help='drop findings whose score is below this (spabench-v1 confidence_score)')
    ap.add_argument('--pr-curve', action='store_true', help='precision/recall at every score threshold')
    ap.add_argument('--breakdown-by', choices=['discovery_class', 'design_technique', 'kind'])
    ap.add_argument('--show-missed', action='store_true')
    ap.add_argument('--report', help='write the full JSON result here')
    ap.add_argument('--legacy-v2', action='store_true', help='use the v2.x evaluator (manifest defaults to legacy/manifest-v2.0.json)')
    args = ap.parse_args()

    _, apps = load_manifest(args.manifest, args.app)
    findings = LOADERS[args.format](args.tool_output)
    if args.min_score is not None:
        findings = [f for f in findings if (f.get('score') or 0) >= args.min_score]
    oracle = None
    if not args.no_oracle:
        from spabench.oracle import Oracle
        oracle = Oracle()
    if len(apps) > 1 and any(not re.match(r'^[a-z]+://', f['url'], re.I) for f in findings):
        print('note: relative findings are resolved against each app\'s origin; pass --app for per-app runs',
              file=sys.stderr)

    name = args.name or os.path.splitext(os.path.basename(args.tool_output))[0]
    results = [evaluate_app(a, findings, oracle, args.format in METHOD_AWARE) for a in apps]
    for r, a in zip(results, apps):
        print_result(r, args.mode, name)
        if args.breakdown_by:
            print_breakdown(r, args.breakdown_by)
        if args.show_missed and r['missed']:
            print('  missed:', ', '.join(r['missed']))
        if args.pr_curve:
            r['pr_curve'] = pr_curve(a, findings, oracle)
            for p in r['pr_curve']:
                print(f"    score ≥ {p['threshold']:>5}: P {pct(p['precision'])} R {pct(p['recall'])} ({p['findings']} paths)")
    report = {'tool': name, 'format': args.format, 'manifest_version': '3', 'mode': args.mode, 'apps': results}
    if len(results) > 1:
        report['combined'] = {m: combine(results, m) for m in ('strict', 'lenient')}
        c = report['combined'][args.mode]
        print(f"\n== all apps [{args.mode}]  micro P {pct(c['micro']['precision'])} R {pct(c['micro']['recall'])} F1 {pct(c['micro']['f1'])}"
              f"  |  macro P {pct(c['macro']['precision'])} R {pct(c['macro']['recall'])} F1 {pct(c['macro']['f1'])}")
    if args.report:
        with open(args.report, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(report, f, indent=2)
        print('report written to', args.report)
    return 0


if __name__ == '__main__':
    sys.exit(main())
