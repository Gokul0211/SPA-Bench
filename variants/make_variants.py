#!/usr/bin/env python3
"""
Build degraded variants of the SPABench bundles for the robustness experiments.

  nomaps       the same bundles with the sourceMappingURL comments removed and no .map served
  obf-low      javascript-obfuscator 'low-obfuscation' preset (string array, rotation), no maps
  obf-medium   'medium-obfuscation' preset (+ control-flow flattening, dead code, string-array encoding)
  obf-high     'high-obfuscation' preset

The ground truth (manifest.json) is unchanged: the same endpoints exist, they are only harder to find.
A variant is written to <out>/<variant>/<app>/ and used by setting SPABENCH_VARIANT_DIR=<out>/<variant>
(spabench/artifacts.py then serves the variant files; the offline harness and evaluate.py's oracle see them).

  cd variants && npm ci                                   # once (javascript-obfuscator 5.9.0, deterministic seeds)
  python variants/make_variants.py --variant obf-medium   # all apps
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

VARIANTS = ('nomaps', 'obf-low', 'obf-medium', 'obf-high')
APPS = ['angular-permit', 'angular-erp', 'react-ecommerce', 'vue-portal', 'nextjs-saas']
_MAP_COMMENT = re.compile(r'^\s*//[#@]\s*sourceMappingURL=.*$', re.M)


def variant_path(out, app, url):
    parts = urlsplit(url)
    return os.path.join(out, app, parts.netloc.replace(':', '_'), parts.path.lstrip('/'))


def js_files(app):
    os.environ.pop('SPABENCH_VARIANT_DIR', None)
    from spabench.artifacts import served_files
    seen, out = set(), []
    for url, path in served_files(app):
        if path.endswith(('.js', '.mjs')) and (url, path) not in seen and not url.endswith('/'):
            seen.add((url, path))
            out.append((url, path))
    return out


def build(variant, apps, out_root):
    out = os.path.join(out_root, variant)
    summary = {}
    for app in apps:
        shutil.rmtree(os.path.join(out, app), ignore_errors=True)
        files = js_files(app)
        if variant == 'nomaps':
            for url, path in files:
                dest = variant_path(out, app, url)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(path, encoding='utf-8') as f:
                    code = f.read()
                with open(dest, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(_MAP_COMMENT.sub('', code))
            summary[app] = {'files': len(files), 'failed': []}
        else:
            level = variant.split('-', 1)[1]
            jobs = [{'in': path, 'out': variant_path(out, app, url)} for url, path in files]
            with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as jf:
                json.dump(jobs, jf)
            try:
                r = subprocess.run(['node', os.path.join(HERE, 'obfuscate.js'), jf.name, level],
                                   capture_output=True, text=True, cwd=HERE, check=True)
            finally:
                os.unlink(jf.name)
            res = json.loads(r.stdout)
            summary[app] = {'files': res['ok'], 'failed': res['failed']}
        os.makedirs(os.path.join(out, app), exist_ok=True)
        with open(os.path.join(out, app, 'variant.json'), 'w', encoding='utf-8') as f:
            json.dump({'name': variant, 'drop_maps': True}, f)
    return out, summary


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--variant', required=True, choices=VARIANTS)
    ap.add_argument('--apps', nargs='+', default=APPS, choices=APPS)
    ap.add_argument('--out', default=os.path.join(ROOT, 'output', 'variants'))
    args = ap.parse_args(argv)
    out, summary = build(args.variant, args.apps, args.out)
    for app, s in summary.items():
        print(f'{app:18s} {s["files"]:3d} files' + (f'   FAILED: {s["failed"]}' if s['failed'] else ''))
    print(f'\nSPABENCH_VARIANT_DIR={out}')
    return 1 if any(s['failed'] for s in summary.values()) else 0


if __name__ == '__main__':
    sys.exit(main())
