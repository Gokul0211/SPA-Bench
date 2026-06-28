#!/usr/bin/env python3
"""
SPABench sanity_check.py - verifies all manifest endpoints are reachable.

Usage:
  python sanity_check.py --manifest manifest.json
  python sanity_check.py --manifest manifest.json --base-url http://localhost
  python sanity_check.py --manifest manifest.json --app angular-permit --verbose

Exit codes:
  0  All probed endpoints reachable
  1  One or more endpoints unreachable or manifest errors
"""

import argparse
import json
import os
import sys
import time
from urllib.parse import urlparse, urlunparse

try:
    import urllib.request as urlreq
    import urllib.error as urlerr
except ImportError:
    print('ERROR: urllib not available', file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SKIP_METHODS = {'WS', 'GRAPHQL'}   # not HTTP-probeable by a plain GET/HEAD
TIMEOUT_S    = 5
MAX_RETRIES  = 2

# Endpoints that require auth return 401 — we treat 401 as "reachable"
# (the server is up and responding, auth is a separate concern)
REACHABLE_STATUS = {200, 201, 204, 301, 302, 400, 401, 403, 404, 405, 422}


def probe(url, method='GET', timeout=TIMEOUT_S, retries=MAX_RETRIES):
    """
    HTTP probe a URL. Returns (status_code, error_string).
    Uses HEAD first, falls back to GET on 405.
    """
    for attempt in range(retries + 1):
        try:
            req = urlreq.Request(url, method='HEAD')
            req.add_header('User-Agent', 'SPABench-SanityCheck/1.0')
            with urlreq.urlopen(req, timeout=timeout) as resp:
                return resp.status, None
        except urlerr.HTTPError as e:
            if e.code == 405:
                # Server doesn't support HEAD — try GET
                try:
                    req2 = urlreq.Request(url, method='GET')
                    req2.add_header('User-Agent', 'SPABench-SanityCheck/1.0')
                    with urlreq.urlopen(req2, timeout=timeout) as resp:
                        return resp.status, None
                except urlerr.HTTPError as e2:
                    return e2.code, None
                except Exception as e2:
                    if attempt < retries:
                        time.sleep(0.5)
                        continue
                    return None, str(e2)
            return e.code, None
        except urlerr.URLError as e:
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            return None, str(e.reason)
        except Exception as e:
            if attempt < retries:
                time.sleep(0.5)
                continue
            return None, str(e)
    return None, 'max retries exceeded'


def rebase_url(url, base_url):
    """
    Replace the host:port of url with base_url's host:port.
    Used when manifest has localhost:XXXX but you want to test against
    a different base (e.g. during CI).
    """
    if not base_url:
        return url
    parsed     = urlparse(url)
    base       = urlparse(base_url)
    rebased    = parsed._replace(scheme=base.scheme, netloc=base.netloc)
    return urlunparse(rebased)


def url_for_probe(ep, base_url=None):
    """
    Build a concrete probe URL from a manifest endpoint.
    Replaces path parameters with placeholder values.
    """
    url = ep['url']
    # Substitute path params: {id} -> 1, {paramName} -> test
    import re
    url = re.sub(r'\{[^}]+\}', '1', url)
    # Strip GraphQL fragment
    if '#' in url:
        url = url.split('#')[0]
    if base_url:
        url = rebase_url(url, base_url)
    return url


def probe_soap_bridge(base_url, verbose=False):
    """
    Special probe for SOAP bridge: GET /api/legacy/bridge
    Returns list of registered operations or error string.
    """
    bridge_url = (base_url or 'http://localhost:4004') + '/api/legacy/bridge'
    # Try rest-backend port (4001) first since bridge routes are registered there
    for port in [4004, 4001]:
        test_url = bridge_url.replace(':4004', ':' + str(port)).replace(':4001', ':' + str(port)) if base_url else f'http://localhost:{port}/api/legacy/bridge'
        status, err = probe(test_url)
        if status in REACHABLE_STATUS:
            if verbose:
                print(f'    SOAP bridge at {test_url} -> HTTP {status}')
            return True, test_url
    return False, bridge_url


# ---------------------------------------------------------------------------
# Main check
# ---------------------------------------------------------------------------

def load_manifest(path, app_filter=None):
    d = json.load(open(path))
    result = {}
    for app in d.get('apps', []):
        if app_filter and app['id'] != app_filter:
            continue
        result[app['id']] = app.get('endpoints', [])
    return result


def run_checks(manifest_path, base_url=None, app_filter=None, verbose=False, timeout=TIMEOUT_S):
    apps = load_manifest(manifest_path, app_filter)
    if not apps:
        print(f'ERROR: no apps loaded (filter={app_filter})')
        return False

    total_probed = 0
    total_ok     = 0
    total_skip   = 0
    all_failures = []

    for app_id, endpoints in sorted(apps.items()):
        print(f'\n  [{app_id}]')
        app_ok = app_skip = app_fail = 0

        for ep in endpoints:
            method = ep.get('method', 'GET')
            ep_id  = ep['id']

            # Skip non-HTTP endpoints
            if method in SKIP_METHODS:
                if verbose:
                    print(f'    SKIP  {ep_id:12}  {method} (not HTTP-probeable)')
                app_skip += 1
                total_skip += 1
                continue

            # Special handling for SOAP bridge endpoints (runtime-computed URLs)
            if ep.get('technique') == 'soap_bridge_dynamic':
                ok, bridge_url = probe_soap_bridge(base_url, verbose)
                status_str = 'OK (bridge)' if ok else 'FAIL (bridge unreachable)'
                mark = 'OK  ' if ok else 'FAIL'
                print(f'    {mark}  {ep_id:12}  {method} {ep["url"]}  [{status_str}]')
                if ok:
                    app_ok += 1; total_ok += 1
                else:
                    app_fail += 1
                    all_failures.append({'id': ep_id, 'url': ep['url'], 'error': 'soap bridge unreachable'})
                continue

            probe_url = url_for_probe(ep, base_url)
            status, err = probe(probe_url, timeout=timeout)

            if status is not None and status in REACHABLE_STATUS:
                mark = 'OK  '
                if verbose:
                    auth_note = ' [auth-gated]' if ep.get('auth_required') else ''
                    print(f'    {mark}  {ep_id:12}  HTTP {status}  {probe_url}{auth_note}')
                else:
                    print(f'    {mark}  {ep_id:12}  HTTP {status}')
                app_ok    += 1
                total_ok  += 1
            else:
                reason = f'HTTP {status}' if status else str(err)
                print(f'    FAIL  {ep_id:12}  {reason}  {probe_url}')
                app_fail += 1
                all_failures.append({'id': ep_id, 'url': probe_url, 'error': reason})

        total_probed += app_ok + app_fail
        skipped_note = f'  ({app_skip} skipped)' if app_skip else ''
        status_line = 'PASS' if app_fail == 0 else 'FAIL'
        print(f'    -- {status_line}: {app_ok}/{app_ok + app_fail} reachable{skipped_note}')

    # Summary
    print(f'\n{"=" * 58}')
    print(f'  Total probed : {total_probed}')
    print(f'  Reachable    : {total_ok}')
    print(f'  Unreachable  : {len(all_failures)}')
    print(f'  Skipped      : {total_skip} (WS/GraphQL - not HTTP)')
    print(f'{"=" * 58}')

    if all_failures:
        print(f'\n  FAILED endpoints:')
        for f in all_failures:
            print(f'    x {f["id"]:12} -- {f["error"]}  ({f["url"]})')
        print()
        return False

    print(f'\n  All reachable endpoints OK\n')
    return True


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description='SPABench sanity_check.py',
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument('--manifest',  required=True, help='Path to manifest.json')
    ap.add_argument('--base-url',  help='Override host for all URLs (e.g. http://localhost)')
    ap.add_argument('--app',       help='Filter to one app ID')
    ap.add_argument('--timeout',   type=float, default=5.0, help='HTTP timeout seconds (default: 5)')
    ap.add_argument('--verbose',   action='store_true', help='Print full URL for each probe')
    args = ap.parse_args()

    if not os.path.exists(args.manifest):
        print(f'ERROR: manifest not found: {args.manifest}', file=sys.stderr)
        return 1

    print('SPABench Sanity Check')
    print(f'  Manifest : {args.manifest}')
    print(f'  Base URL : {args.base_url or "(from manifest)"}')
    print(f'  App      : {args.app or "all"}')

    ok = run_checks(
        manifest_path=args.manifest,
        base_url=args.base_url,
        app_filter=args.app,
        verbose=args.verbose,
        timeout=args.timeout,
    )
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
