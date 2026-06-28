#!/usr/bin/env python3
"""
SPABench run_authenticated_scans.py
Runs main.py scanner against all 5 benchmark apps with correct auth,
then evaluates results using evaluate.py.

Credentials (fixed benchmark creds, see api-servers/rest-backend/routes/app-a.js):
  benchuser  / benchpass  — operator role
  benchadmin / benchpass  — admin role   (required for ADMIN_PANEL endpoints)

Auth strategies:
  Apps A, D  → form-auth  → --login-url http://127.0.0.1:4001/api/auth/login
               + --bearer  (pre-fetched admin token for auth header injection)
  Apps B, C, E → bearer   → --api-login-url http://127.0.0.1:4001/api/auth/login
               + --username/--password
"""

import subprocess
import sys
import os
import glob
import json
import time
import requests

SCANNER   = os.path.join(os.path.dirname(__file__), '..', 'main.py')
EVALUATE  = os.path.join(os.path.dirname(__file__), 'evaluate.py')
MANIFEST  = os.path.join(os.path.dirname(__file__), 'manifest.json')
OUTPUT    = os.path.join(os.path.dirname(__file__), 'output')
AUTH_URL  = 'http://127.0.0.1:4001/api/auth/login'

# ── Credentials ──────────────────────────────────────────────────────────────
ADMIN_CREDS = {'username': 'benchadmin', 'password': 'benchpass'}
USER_CREDS  = {'username': 'benchuser',  'password': 'benchpass'}

# ── App definitions ───────────────────────────────────────────────────────────
APPS = [
    {
        'id':   'angular-permit',
        'port':  3001,
        'auth':  'form',          # form login → cookie + bearer header
        'creds': ADMIN_CREDS,
    },
    {
        'id':   'angular-erp',
        'port':  3002,
        'auth':  'bearer',
        'creds': ADMIN_CREDS,
    },
    {
        'id':   'react-ecommerce',
        'port':  3003,
        'auth':  'bearer',
        'creds': ADMIN_CREDS,
    },
    {
        'id':   'vue-portal',
        'port':  3004,
        'auth':  'form',
        'creds': ADMIN_CREDS,
    },
    {
        'id':   'nextjs-saas',
        'port':  3005,
        'auth':  'bearer',
        'creds': ADMIN_CREDS,
    },
]


def fetch_admin_token():
    """Pre-fetch an admin bearer token from the auth server."""
    try:
        r = requests.post(AUTH_URL, json=ADMIN_CREDS, timeout=10)
        r.raise_for_status()
        token = r.json().get('token', '')
        if token:
            print(f'[AUTH] Pre-fetched admin token: {token[:40]}...')
            return token
    except Exception as e:
        print(f'[AUTH] WARNING: Could not pre-fetch token: {e}')
    return 'spabench-bearer-token-dev'


def run_scan(app, admin_token):
    port   = app['port']
    app_id = app['id']
    target = f'http://127.0.0.1:{port}'
    out_dir = os.path.join(OUTPUT, f'localhost_{port}', 'json')
    os.makedirs(out_dir, exist_ok=True)

    ts = time.strftime('%Y%m%d_%H%M%S')
    out_file = os.path.join(out_dir, f'localhost_{port}_{ts}.json')

    cmd = [
        sys.executable, SCANNER,
        '--target', target,
        '--output', out_file,
        '--max-routes', '30',
        '--max-depth', '5',
        '--workers', '15',
        '--timeout', '30',
        # Auth server login for token acquisition
        '--api-login-url', AUTH_URL,
        '--username', ADMIN_CREDS['username'],
        '--password', ADMIN_CREDS['password'],
        # Always inject admin bearer token so auth-gated endpoints fire
        '--bearer', admin_token,
    ]

    if app['auth'] == 'form':
        # Form auth apps also need form-based login for cookie
        cmd += [
            '--login-url', AUTH_URL,
            '--username-field', 'username',
            '--password-field', 'password',
        ]

    print(f'\n[{app_id}] Starting authenticated scan on port {port}...')
    print(f'[{app_id}] CMD: {" ".join(cmd[:8])} ...')

    result = subprocess.run(cmd, capture_output=False)
    code = result.returncode
    print(f'[{app_id}] Scan completed with code {code}.')
    return app_id, port, out_file


def run_evaluation(app_id, port, out_file):
    if not os.path.exists(out_file):
        # Find the most recent JSON in the dir
        pattern = os.path.join(OUTPUT, f'localhost_{port}', 'json', '*.json')
        files = glob.glob(pattern)
        if not files:
            print(f'  [EVAL] No output JSON found for {app_id}')
            return None
        out_file = max(files, key=os.path.getmtime)

    print(f'\n>>> Evaluating {app_id} using {out_file}:')

    # Map port → app_id for --app filter
    cmd = [
        sys.executable, EVALUATE,
        '--manifest', MANIFEST,
        '--tool-output', out_file,
        '--app', app_id,
        '--format', 'spabench-v1',
    ]
    subprocess.run(cmd)


def main():
    print('=' * 60)
    print('SPABench Authenticated Scan Runner')
    print('=' * 60)

    # Pre-fetch admin token once (shared across all apps)
    admin_token = fetch_admin_token()

    results = []
    for app in APPS:
        app_id, port, out_file = run_scan(app, admin_token)
        results.append((app_id, port, out_file))

    print('\n\n' + '=' * 42)
    print('FINAL EVALUATION')
    print('=' * 42)

    for app_id, port, out_file in results:
        run_evaluation(app_id, port, out_file)


if __name__ == '__main__':
    main()
