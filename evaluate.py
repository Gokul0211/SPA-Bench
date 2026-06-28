#!/usr/bin/env python3
"""
SPABench evaluate.py - evaluation script for SPA API endpoint discovery tools.
Computes precision, recall, F1, vendor noise rate, and auth-stratified recall.

Usage:
  python evaluate.py --manifest manifest.json --tool-output out.json
  python evaluate.py --manifest manifest.json --tool-output out.json --breakdown-by technique
  python evaluate.py --manifest manifest.json --compare a.json b.json --report out.html
  python evaluate.py --manifest manifest.json --tool-output out.json --app angular-permit

Formats (--format): spabench-v1 (default), linkfinder, xnlinkfinder, jsluice, katana

Scope filtering (--scope-filter, default: on):
  Strips tool-output endpoints whose host:port does not belong to the target app.
  Prevents the shared GraphQL/WebSocket/SOAP backends from inflating FP counts
  when scanning non-saas apps.  Use --no-scope-filter to disable.
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse


# ---------------------------------------------------------------------------
# Per-app allowed host:port scopes
# Endpoints outside these hosts are out-of-scope FPs caused by shared backends
# being probed during every scan (GraphQL on 4002, WS on 4003, SOAP on 4004).
# ---------------------------------------------------------------------------

APP_SCOPE = {
    'angular-permit': {
        'localhost:3001',   # frontend
        'localhost:4001',   # shared REST backend
        '10.0.1.45:8080',   # internal IP — legitimate EP-B-004 style finding
        '10.0.0.45:8080',   # variant seen in scan output
        'staging-api.rc-permit.internal',
        'auth.rc-permit.internal',
    },
    'angular-erp': {
        'localhost:3002',   # shell frontend
        'localhost:4001',   # shared REST backend
        'localhost:3011', 'localhost:3012', 'localhost:3013', 'localhost:3014',
        'localhost:3015', 'localhost:3016', 'localhost:3017', 'localhost:3018',
        '10.0.1.45:8080',   # internal IP hardcoded in mfe-admin
        '10.0.0.45:8080',
    },
    'react-ecommerce': {
        'localhost:3003',   # frontend
        'localhost:4001',   # shared REST backend
    },
    'vue-portal': {
        'localhost:3004',   # frontend
        'localhost:4001',   # shared REST backend
        'localhost:4004',   # SOAP bridge — legitimately used by vue-portal
    },
    'nextjs-saas': {
        'localhost:3005',   # frontend
        'localhost:4001',   # shared REST backend
        'localhost:4002',   # GraphQL backend — legitimately used by nextjs-saas
        'localhost:4003',   # WebSocket backend — legitimately used by nextjs-saas
    },
}

# Relative paths (no host) are always kept — they resolve to the target host
# Paths containing only an internal hostname pattern are kept too
_INTERNAL_HOSTNAME_RE = re.compile(r'\.(internal|local|corp|intranet)(:\d+)?$', re.I)


def canon_host(netloc):
    """Canonicalise loopback host aliases so localhost, 127.0.0.1 and [::1] are
    treated as the same host. Scans run with --target http://127.0.0.1 emit
    127.0.0.1 URLs; the manifest and APP_SCOPE use localhost — without this they
    would be scored as different hosts (everything out-of-scope)."""
    h = netloc.lower()
    return (h.replace('127.0.0.1', 'localhost')
             .replace('[::1]', 'localhost')
             .replace('::1', 'localhost'))


def in_scope(url, app_id):
    """Return True if url belongs to the allowed scope for app_id."""
    allowed = APP_SCOPE.get(app_id)
    if not allowed:
        return True  # no scope defined → keep everything
    try:
        p = urlparse(url)
        host = canon_host(p.netloc)
        if not host:
            return True   # relative URL — keep
        if _INTERNAL_HOSTNAME_RE.search(host):
            return True   # internal hostname → always keep (security finding)
        return host in allowed
    except Exception:
        return True


# ---------------------------------------------------------------------------
# URL normalisation
# ---------------------------------------------------------------------------

def normalise_url(url):
    url = url.strip()
    fragment = ''
    if '#' in url:
        url, fragment = url.rsplit('#', 1)
    try:
        p = urlparse(url)
        q = urlencode(sorted(parse_qs(p.query, keep_blank_values=True).items()), doseq=True) if p.query else ''
        result = urlunparse(((p.scheme or 'http').lower(), canon_host(p.netloc), p.path.rstrip('/'), '', q, ''))
    except Exception:
        result = url.rstrip('/')
    return result + ('#' + fragment if fragment else '')


def _segs(url):
    return [s for s in urlparse(url).path.split('/') if s]


def url_matches(candidate, manifest_url):
    """True if candidate matches manifest_url, including {param} wildcards."""
    nc, nm = normalise_url(candidate), normalise_url(manifest_url)
    if nc == nm:
        return True
    pc, pm = urlparse(nc), urlparse(nm)
    if pc.scheme != pm.scheme or pc.netloc != pm.netloc:
        return False
    if pm.fragment and pc.fragment != pm.fragment:
        return False
    cs, ms = _segs(nc), _segs(nm)
    if len(cs) != len(ms):
        return False
    return all((m.startswith('{') and m.endswith('}')) or c == m for c, m in zip(cs, ms))


# ---------------------------------------------------------------------------
# GraphQL operation identity
#
# All GraphQL resolvers share one HTTP URL (/api/graphql), so URL+host matching
# cannot distinguish them. A GraphQL operation is identified by its operation
# NAME, which the tool emits as a fragment (".../graphql#getUser") and the
# manifest stores in discovery_notes ("Query getUser." / "Mutation updateUser.").
# Matching by operation name is host-agnostic: the tool legitimately discovers
# the operation regardless of whether it reports the proxy (:3005) or the live
# backend (:4002) host.
# ---------------------------------------------------------------------------

_GQL_NOTE_RE = re.compile(r'\b(?:Query|Mutation|Subscription)\s+([A-Za-z_]\w*)', re.I)

def gql_operation(url):
    """Operation name (lowercased) from a tool URL fragment, else ''."""
    if '#' in url:
        return url.rsplit('#', 1)[1].strip().lower()
    return ''

def manifest_gql_operation(mep):
    """Operation name for a GRAPHQL manifest entry (url fragment or notes)."""
    op = gql_operation(mep.get('url', ''))
    if op:
        return op
    m = _GQL_NOTE_RE.search(mep.get('discovery_notes', '') or '')
    return m.group(1).lower() if m else ''


def entry_matches(tep, mep):
    """True if tool finding `tep` discovers manifest entry `mep`.

    Endpoint discovery is evaluated by *endpoint/operation identity*, not HTTP
    method: the tool's job is to surface the endpoint, and the manifest splits a
    single source endpoint into several method-variant entries (GET/POST/PUT/
    DELETE on the same path). Requiring method agreement would understate recall,
    so matching is method-agnostic.

    - GraphQL entries match by operation name (host/URL agnostic).
    - REST entries match by URL pattern ({param} wildcards).
    """
    if (mep.get('method', '') or '').upper() == 'GRAPHQL':
        mop = manifest_gql_operation(mep)
        top = gql_operation(tep['url'])
        if mop:
            return top == mop
        # Base GraphQL endpoint entry (no named operation): match the bare URL.
        return '/graphql' in tep['url'].lower() and not top
    return _path_matches(tep['url'], mep['url'])


def _path_matches(cand, manifest_url):
    """Path-only match with {param} wildcards, host-agnostic. The same API path
    is the same endpoint whether the tool reports it relative, on the frontend
    host (proxy), or on the backend host — the scope filter already guarantees
    every candidate host is legitimate for this app, so distinguishing them only
    inflates FP/dup counts. GraphQL is handled separately by operation name."""
    cp = urlparse(normalise_url(cand)).path.rstrip('/')
    mp = urlparse(normalise_url(manifest_url)).path.rstrip('/')
    if cp == mp:
        return True
    cs = [s for s in cp.split('/') if s]
    ms = [s for s in mp.split('/') if s]
    if len(cs) != len(ms):
        return False
    return all((m.startswith('{') and m.endswith('}')) or c == m for c, m in zip(cs, ms))


def canon_key(ep):
    """Canonical identity of a tool finding, collapsing representation variants
    (path params, concrete ids, trailing slash, blank query) so the same
    endpoint reported several ways is not counted as several discoveries.

    Host-agnostic: the same API path seen relative, on the frontend proxy host,
    and on the backend host is ONE logical endpoint. Scope filtering has already
    run by the time this is used, so every remaining host is legitimate for this
    app and distinguishing them only inflates duplicate/FP counts. GraphQL
    operations stay distinct via their fragment."""
    u = ep['url']
    frag = ''
    if '#' in u:
        u, frag = u.split('#', 1)
    p = urlparse(u)
    path = re.sub(r'\{[^}]+\}', '{id}', p.path.rstrip('/'))
    path = re.sub(r'/(?:\d+|bench-[\w-]+|demo-[\w-]+)(?=/|$)', '/{id}', path)
    return (path, frag.lower(), (ep.get('method') or 'GET').upper())


def _reachable(url, method, timeout=8.0):
    """True if the endpoint exists (any non-404 response to GET or the emitted
    method). Used by --verify-reachable to separate real discoveries (non-404)
    from genuine false positives (404 / connection error).

    Conservative: a 404, connection error, OR timeout counts as NOT reachable.
    This can only ever understate precision (never inflate it), so a degraded /
    hung backend cannot produce a falsely high number — run against a responsive
    target for an accurate result."""
    import requests
    requests.packages.urllib3.disable_warnings()
    probe = re.sub(r'\{[^}]+\}', '1', url.split('#', 1)[0])
    if not probe.startswith('http'):
        return False
    # On Windows/WSL2, 'localhost' may resolve to IPv6 (::1) first and hang while
    # Docker only answers on IPv4 — force 127.0.0.1 so the probe is reliable.
    probe = probe.replace('://localhost:', '://127.0.0.1:').replace('://localhost/', '://127.0.0.1/')
    methods = ['GET']
    m = (method or 'GET').upper()
    if m in ('POST', 'PUT', 'DELETE', 'PATCH') and m not in methods:
        methods.append(m)
    for mm in methods:
        try:
            r = requests.request(mm, probe, timeout=(4, timeout), verify=False,
                                 headers={'Authorization': 'Bearer x'},
                                 allow_redirects=False)
            if r.status_code != 404:
                return True
        except Exception:
            pass
    return False


# ---------------------------------------------------------------------------
# Format adapters
# ---------------------------------------------------------------------------

def _spabench(path):
    d = json.load(open(path))
    out = []
    for e in d.get('endpoints', []):
        # main.py uses 'endpoint' key; manifest uses 'url' — handle both
        url = e.get('url') or e.get('endpoint', '')
        if url:
            out.append({'url': url, 'method': e.get('method', 'GET')})
    return out

def _linkfinder(path):
    out = []
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('/'):
            line = 'http://localhost' + line
        elif not line.startswith('http'):
            line = 'http://localhost/' + line
        out.append({'url': line, 'method': 'GET'})
    return out

def _xnlinkfinder(path):
    d = json.load(open(path))
    items = d if isinstance(d, list) else d.get('results', d.get('endpoints', []))
    return [{'url': (i if isinstance(i, str) else i.get('url', '')), 'method': 'GET'} for i in items]

def _jsluice(path):
    d = json.load(open(path))
    if not isinstance(d, list):
        d = d.get('findings', [])
    out = []
    for item in d:
        url = item.get('value') or item.get('url', '')
        if not url or '/' not in url:
            continue
        if url.startswith('/'):
            url = 'http://localhost' + url
        out.append({'url': url, 'method': item.get('method', 'GET')})
    return out

def _katana(path):
    out = []
    for line in open(path):
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except Exception:
            continue
        req = item.get('request', item)
        url = req.get('endpoint') or req.get('url') or item.get('endpoint', '')
        if url:
            out.append({'url': url, 'method': req.get('method', 'GET')})
    return out

LOADERS = {
    'spabench-v1':  _spabench,
    'linkfinder':   _linkfinder,
    'xnlinkfinder': _xnlinkfinder,
    'jsluice':      _jsluice,
    'katana':       _katana,
}


# ---------------------------------------------------------------------------
# Noise patterns
# ---------------------------------------------------------------------------

def load_noise(noise_dir):
    path = os.path.join(noise_dir, 'manifest-noise.json')
    if not os.path.exists(path):
        return {}
    d = json.load(open(path))
    return {p['tag']: p.get('indicators', []) for p in d.get('patterns', [])}

def classify_noise(url, patterns):
    for tag, inds in patterns.items():
        for ind in inds:
            if ind.lower() in url.lower():
                return tag
    return None


# ---------------------------------------------------------------------------
# Manifest loading
# ---------------------------------------------------------------------------

def load_manifest(path, app_filter=None):
    d = json.load(open(path))
    eps = []
    for app in d.get('apps', []):
        if app_filter and app['id'] != app_filter:
            continue
        for ep in app.get('endpoints', []):
            ep['_app_id'] = app['id']
            eps.append(ep)
    return eps


# ---------------------------------------------------------------------------
# Core evaluation
# ---------------------------------------------------------------------------

def evaluate(manifest_eps, tool_eps, noise_patterns, app_id=None, scope_filter=True,
             other_manifest_eps=None, verify_reachable=False):
    # ── Scope filtering ──────────────────────────────────────────────────────
    filtered_out = 0
    if scope_filter and app_id:
        scoped = [ep for ep in tool_eps if in_scope(ep['url'], app_id)]
        filtered_out = len(tool_eps) - len(scoped)
        tool_eps = scoped

    # ── Canonical deduplication — collapse representation variants (path-param
    # placeholders, concrete ids, trailing slash, blank query) so one endpoint
    # reported several ways is counted as one discovery, not several FPs.
    seen, deduped = set(), []
    for ep in tool_eps:
        k = canon_key(ep)
        if k not in seen:
            seen.add(k)
            deduped.append(ep)

    # ── Matching — each manifest entry is satisfied if ANY tool finding
    # discovers it (method-agnostic; GraphQL by operation name). Findings may
    # satisfy several method-variant entries on one path, so the tool is credited
    # once per endpoint it actually surfaced. Recall = matched manifest entries.
    matched_ids = {mep['id'] for mep in manifest_eps
                   if any(entry_matches(tep, mep) for tep in deduped)}
    # A finding is a "real discovery" if it matches some manifest entry; the rest
    # are candidate false positives.
    match_find = [tep for tep in deduped
                  if any(entry_matches(tep, m) for m in manifest_eps)]
    nonmatch   = [tep for tep in deduped if tep not in match_find]

    # ── Cross-app exclusion — a non-matching finding that belongs to ANOTHER
    # app's manifest is a real shared-backend endpoint discovered legitimately,
    # not a false positive against this app.
    cross_app_fps = 0
    if other_manifest_eps:
        kept = []
        for tep in nonmatch:
            if any(entry_matches(tep, m) for m in other_manifest_eps):
                cross_app_fps += 1
            else:
                kept.append(tep)
        nonmatch = kept

    # ── Reachability-verified precision — a remaining finding that responds
    # (non-404) is a real API surface (a valid discovery), not a false positive.
    # The curated manifest is a technique-coverage subset, so an uncurated but
    # reachable endpoint is a true find. Recall stays strictly manifest-based.
    verified_real = 0
    if verify_reachable and nonmatch:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=6) as _ex:
            flags = list(_ex.map(lambda t: _reachable(t['url'], t.get('method', 'GET')), nonmatch))
        nonmatch = [t for t, ok in zip(nonmatch, flags) if not ok]
        verified_real = sum(1 for ok in flags if ok)

    fps = nonmatch
    fns = [e for e in manifest_eps if e['id'] not in matched_ids]
    tp, fp, fn, total = len(matched_ids), len(fps), len(fns), len(manifest_eps)
    # Precision counts real discoveries (manifest-matching findings + reachable
    # uncurated endpoints) against all scored findings; recall is manifest-only.
    valid = len(match_find) + verified_real

    precision = valid / (valid + fp) if (valid + fp) > 0 else 0.0
    recall    = tp / total         if total > 0         else 0.0
    f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    noise_fps = [{'url': e['url'], 'noise_tag': classify_noise(e['url'], noise_patterns)}
                 for e in fps if classify_noise(e['url'], noise_patterns)]
    noise_rate = len(noise_fps) / fp if fp > 0 else 0.0

    unauth = [e for e in manifest_eps if not e.get('auth_required')]
    auth   = [e for e in manifest_eps if e.get('auth_required')]
    r_unauth = sum(1 for e in unauth if e['id'] in matched_ids) / len(unauth) if unauth else 0.0
    r_auth   = sum(1 for e in auth   if e['id'] in matched_ids) / len(auth)   if auth   else 0.0

    def breakdown(field):
        d = defaultdict(lambda: {'total': 0, 'found': 0})
        for ep in manifest_eps:
            k = ep.get(field, 'unknown')
            d[k]['total'] += 1
            if ep['id'] in matched_ids:
                d[k]['found'] += 1
        return {k: dict(v) for k, v in d.items()}

    return {
        'precision': round(precision, 4),
        'recall':    round(recall, 4),
        'f1':        round(f1, 4),
        'true_positives':  tp,
        'false_positives': fp,
        'false_negatives': fn,
        'total_manifest':  total,
        'out_of_scope_filtered': filtered_out,
        'cross_app_filtered':    cross_app_fps,
        'verified_real_discoveries': verified_real,
        'vendor_noise_fps':  noise_fps,
        'vendor_noise_rate': round(noise_rate, 4),
        'recall_unauthenticated': round(r_unauth, 4),
        'recall_authenticated':   round(r_auth, 4),
        'per_technique': breakdown('technique'),
        'per_phase':     breakdown('phase'),
        'per_app':       breakdown('_app_id'),
        'missed_endpoints': [{'id': e['id'], 'url': e['url'], 'technique': e['technique']} for e in fns],
        'matched_ids': sorted(matched_ids),
    }


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def _pct(v):
    return '{:.1f}%'.format(v * 100)

def print_summary(res, name='tool'):
    W = 60
    print('\n' + '=' * W)
    print('  SPABench Evaluation -- {}'.format(name))
    print('=' * W)
    print('  Manifest endpoints       : {}'.format(res['total_manifest']))
    print('  True positives           : {}'.format(res['true_positives']))
    print('  Out-of-scope filtered    : {}'.format(res.get('out_of_scope_filtered', 0)))
    print('  Cross-app (other manifest): {}'.format(res.get('cross_app_filtered', 0)))
    if res.get('verified_real_discoveries'):
        print('  Verified real (non-404)  : {}'.format(res['verified_real_discoveries']))
    print('  False positives          : {}'.format(res['false_positives']))
    print('  False negatives          : {}'.format(res['false_negatives']))
    print('-' * W)
    print('  Precision                : {}'.format(_pct(res['precision'])))
    print('  Recall                   : {}'.format(_pct(res['recall'])))
    print('  F1                       : {}'.format(_pct(res['f1'])))
    print('-' * W)
    print('  Recall (unauthenticated) : {}'.format(_pct(res['recall_unauthenticated'])))
    print('  Recall (auth-gated)      : {}'.format(_pct(res['recall_authenticated'])))
    print('-' * W)
    n = len(res['vendor_noise_fps'])
    print('  Vendor noise FPs         : {} ({} of FPs)'.format(n, _pct(res['vendor_noise_rate'])))
    print('=' * W + '\n')

def print_breakdown(res, by):
    data = res.get('per_' + by, {})
    print('  Breakdown by {}:'.format(by))
    print('  ' + '-' * 58)
    print('  {:<38} {:>5} {:>5} {:>8}'.format('Dimension', 'Found', 'Total', 'Recall'))
    print('  ' + '-' * 58)
    for k in sorted(data):
        v = data[k]
        r = v['found'] / v['total'] if v['total'] else 0
        mark = 'v' if r == 1.0 else ('~' if r > 0 else 'x')
        print('  {} {:<37} {:>5} {:>5} {:>8}'.format(mark, k, v['found'], v['total'], _pct(r)))
    print('  ' + '-' * 58 + '\n')

def print_missed(res, limit=25):
    missed = res['missed_endpoints']
    if not missed:
        print('  Perfect recall -- no missed endpoints!\n')
        return
    print('  Missed ({} total):'.format(len(missed)))
    for ep in missed[:limit]:
        print('    x [{}] {} -- {}'.format(ep['technique'], ep['id'], ep['url']))
    if len(missed) > limit:
        print('    ... and {} more'.format(len(missed) - limit))
    print()

def render_html(results):
    rows = '\n'.join(
        '<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td>'
        '<td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>'.format(
            r['tool'], _pct(r['precision']), _pct(r['recall']), _pct(r['f1']),
            r['true_positives'], r['false_positives'],
            _pct(r['recall_unauthenticated']), _pct(r['recall_authenticated']),
            _pct(r['vendor_noise_rate']))
        for r in results)
    return ('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SPABench</title>'
            '<style>body{font-family:system-ui;padding:2rem}'
            'table{border-collapse:collapse;width:100%}'
            'th,td{border:1px solid #ddd;padding:8px 12px;text-align:right}'
            'th{background:#1a1a2e;color:#fff}'
            'td:first-child,th:first-child{text-align:left}'
            'tr:hover{background:#f5f5f5}</style></head><body>'
            '<h1>SPABench Tool Comparison</h1><table><thead><tr>'
            '<th>Tool</th><th>Precision</th><th>Recall</th><th>F1</th>'
            '<th>TPs</th><th>FPs</th><th>Recall (unauth)</th>'
            '<th>Recall (auth)</th><th>Noise Rate</th>'
            '</tr></thead><tbody>{}</tbody></table></body></html>'.format(rows))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description='SPABench evaluate.py',
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument('--manifest',         required=True)
    ap.add_argument('--tool-output',      dest='tool_output')
    ap.add_argument('--format',           default='spabench-v1', choices=list(LOADERS))
    ap.add_argument('--breakdown-by',     choices=['technique', 'phase', 'app'])
    ap.add_argument('--report')
    ap.add_argument('--compare',          nargs='+', metavar='FILE')
    ap.add_argument('--app')
    ap.add_argument('--noise-dir',        default='noise')
    ap.add_argument('--show-missed',      action='store_true')
    ap.add_argument('--verbose',          action='store_true')
    ap.add_argument('--no-scope-filter',  dest='scope_filter', action='store_false', default=True,
                    help='Disable host-scope filtering (includes cross-app backend FPs in scoring)')
    ap.add_argument('--verify-reachable', action='store_true',
                    help='Probe non-manifest in-scope findings; count reachable (non-404) '
                         'endpoints as real discoveries rather than false positives '
                         '(reachability-verified precision). Requires the target to be up.')
    args = ap.parse_args()

    if not os.path.exists(args.manifest):
        print('ERROR: manifest not found: ' + args.manifest, file=sys.stderr)
        return 1

    manifest_eps = load_manifest(args.manifest, args.app)
    if not manifest_eps:
        print('ERROR: no endpoints loaded (app=' + str(args.app) + ')', file=sys.stderr)
        return 1

    # Other apps' manifest entries — used to exclude cross-app shared-backend
    # discoveries from this app's false positives (only meaningful when --app set).
    other_eps = None
    if args.app:
        this_ids = {e['id'] for e in manifest_eps}
        other_eps = [e for e in load_manifest(args.manifest) if e['id'] not in this_ids]

    noise = load_noise(args.noise_dir) if os.path.isdir(args.noise_dir) else {}

    # Compare mode
    if args.compare:
        all_res = []
        for path in args.compare:
            name = os.path.splitext(os.path.basename(path))[0]
            try:
                eps = _spabench(path)
            except Exception as e:
                print('WARN: {}: {}'.format(path, e), file=sys.stderr)
                continue
            res = evaluate(manifest_eps, eps, noise, app_id=args.app,
                           scope_filter=args.scope_filter,
                           other_manifest_eps=other_eps,
                           verify_reachable=args.verify_reachable)
            res['tool'] = name
            all_res.append(res)
            print_summary(res, name)
            if args.breakdown_by:
                print_breakdown(res, args.breakdown_by)
        if args.report:
            if args.report.endswith('.html'):
                open(args.report, 'w').write(render_html(all_res))
            else:
                json.dump(all_res, open(args.report, 'w'), indent=2)
            print('Report: ' + args.report)
        return 0

    # Single-tool mode
    if not args.tool_output:
        ap.error('--tool-output is required unless --compare is used')
    if not os.path.exists(args.tool_output):
        print('ERROR: not found: ' + args.tool_output, file=sys.stderr)
        return 1

    try:
        tool_eps = LOADERS[args.format](args.tool_output)
    except Exception as e:
        print('ERROR loading tool output: ' + str(e), file=sys.stderr)
        return 1

    name = os.path.splitext(os.path.basename(args.tool_output))[0]
    res = evaluate(manifest_eps, tool_eps, noise, app_id=args.app,
                   scope_filter=args.scope_filter,
                   other_manifest_eps=other_eps,
                   verify_reachable=args.verify_reachable)
    res['tool'] = name
    res['manifest'] = args.manifest
    res['app_filter'] = args.app

    print_summary(res, name)
    if args.breakdown_by:
        print_breakdown(res, args.breakdown_by)
    if args.show_missed or args.verbose:
        print_missed(res)
    if args.verbose:
        print('  Matched: ' + ', '.join(res['matched_ids']) + '\n')
    if args.report:
        if args.report.endswith('.html'):
            open(args.report, 'w').write(render_html([res]))
        else:
            json.dump(res, open(args.report, 'w'), indent=2)
        print('Report: ' + args.report)
    return 0


if __name__ == '__main__':
    sys.exit(main())
