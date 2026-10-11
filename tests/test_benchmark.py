"""Integration checks over the repository (offline): ground truth, maps, audit, oracle."""
import json
import os
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


def run(*args):
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')


class Repository(unittest.TestCase):
    def test_manifest_is_built_from_partials(self):
        r = run('build_manifest.py', '--check')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_manifest_validates(self):
        r = run('validate_manifest.py')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_source_maps_in_sync(self):
        r = run(os.path.join('scripts', 'sync_sourcemaps.py'), '--check')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_audit_passes(self):
        r = run(os.path.join('audit', 'bench_audit.py'), 'all')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


class Oracle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from spabench.oracle import Oracle as O
        cls.o = O()

    def test_spa_fallback_is_not_an_endpoint(self):
        ok, _ = self.o.resolve('http://localhost:3001/api-that-does-not-exist', 'GET')
        self.assertFalse(ok)
        ok, _ = self.o.resolve('http://localhost:3003/some/client/route', 'GET')
        self.assertFalse(ok)

    def test_proxied_api_paths_are_served(self):
        self.assertTrue(self.o.resolve('http://localhost:3003/api/v2/products/prod-001', 'GET')[0])
        self.assertTrue(self.o.resolve('http://localhost:3004/api/legacy/bridge/getEmployeeRecord', 'POST')[0])
        self.assertTrue(self.o.resolve('ws://localhost:3005/ws/notifications', 'WS')[0])
        self.assertTrue(self.o.resolve('http://localhost:3005/graphql', 'POST')[0])

    def test_vue_maps_blocked_and_missing_assets_404(self):
        self.assertFalse(self.o.resolve('http://localhost:3004/_nuxt/entry.js.map', 'GET')[0])
        self.assertFalse(self.o.resolve('http://localhost:3001/runtime.js', 'GET')[0])

    def test_every_ground_truth_entry_is_served_or_external(self):
        with open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8') as f:
            m = json.load(f)
        for a in m['apps']:
            for e in a['endpoints']:
                if e['reachability'] == 'external':
                    continue
                ok, how = self.o.resolve(e['url'].split('#')[0], e['method'])
                self.assertTrue(ok, f"{e['id']}: {how}")


if __name__ == '__main__':
    unittest.main()
