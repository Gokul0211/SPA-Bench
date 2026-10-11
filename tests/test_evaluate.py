"""Unit tests for evaluate.py scoring rules (python -m unittest discover -s tests)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import evaluate as ev  # noqa: E402


def entry(id_, method, url, kind='rest', op=None, auth=True, test_case=True, cls='bundle_literal', tech='url_concat_direct'):
    e = {'id': id_, 'method': method, 'url': url, 'kind': kind, 'auth_required': auth, 'test_case': test_case,
         'discovery_class': cls, 'design_technique': tech}
    if op:
        e['graphql'] = {'operation_type': 'query', 'operation': op}
    return e


APP = {
    'id': 'demo', 'origin': 'http://localhost:3005',
    'api_hosts': ['localhost:3005', 'localhost:4001', 'localhost:4002'],
    'external_hosts': ['staging.internal'],
    'endpoints': [
        entry('EP-X-001', 'GET', 'http://localhost:3005/api/users'),
        entry('EP-X-002', 'POST', 'http://localhost:3005/api/users'),
        entry('EP-X-003', 'GET', 'http://localhost:3005/api/users/{id}'),
        entry('EP-X-004', 'DELETE', 'http://localhost:3005/api/users/{id}', test_case=False, cls='bundle_composed'),
        entry('EP-X-005', 'GET', 'https://staging.internal/v2/health', auth=False, cls='sourcemap_composed'),
        entry('EP-X-006', 'GRAPHQL', 'http://localhost:3005/graphql#getUser', kind='graphql', op='getUser',
              cls='graphql_sourcemap_operation'),
        entry('EP-X-007', 'POST', 'http://localhost:3005/graphql', auth=False),
    ],
    'assets': [{'id': 'AS-X-001', 'url': 'http://localhost:3005/remoteEntry.js', 'design_technique': 'module_federation_remote_entry'}],
}


def run(urls, methods=None, method_aware=False):
    findings = [{'url': u, 'method': (methods or {}).get(u)} for u in urls]
    return ev.evaluate_app(ev.App(APP), findings, oracle=None, method_aware=method_aware)


class Units(unittest.TestCase):
    def test_ground_truth_units_are_paths_not_methods(self):
        # 4 REST entries on 2 paths + 1 external + 1 GraphQL op + the /graphql endpoint = 5 units
        self.assertEqual(len(ev.App(APP).units), 5)

    def test_one_finding_credits_a_path_once(self):
        r = run(['/api/users'])
        s = r['path_level']['strict']
        self.assertEqual((s['tp_ground_truth'], s['ground_truth']), (1, 5))
        self.assertTrue(r['hits']['EP-X-001'] and r['hits']['EP-X-002'])   # both methods of the path

    def test_relative_findings_resolve_against_origin(self):
        self.assertEqual(run(['/api/users'])['counts']['matched_findings'], 1)
        self.assertEqual(run(['api/users'])['counts']['matched_findings'], 1)

    def test_hosts_alias_only_within_api_hosts(self):
        self.assertEqual(run(['http://127.0.0.1:4001/api/users'])['counts']['matched_findings'], 1)
        r = run(['http://localhost:9999/api/users'])
        self.assertEqual(r['counts']['matched_findings'], 0)
        self.assertEqual(r['counts']['out_of_scope'], 1)

    def test_external_host_must_match_exactly(self):
        self.assertTrue(run(['https://staging.internal/v2/health'])['hits']['EP-X-005'])
        self.assertFalse(run(['http://localhost:3005/v2/health'])['hits']['EP-X-005'])

    def test_param_templates_and_concrete_ids(self):
        r = run(['/api/users/42', '/api/users/7', '/api/users/{userId}', '/api/users/:id'])
        self.assertTrue(r['hits']['EP-X-003'])
        self.assertEqual(r['counts']['endpoint_findings'], 1)      # all four collapse to one finding-path

    def test_finding_placeholder_does_not_match_a_literal_segment(self):
        self.assertFalse(ev.path_match('/api/{x}', '/api/users'))
        self.assertTrue(ev.path_match('/api/users', '/api/{x}'))

    def test_segment_count_must_agree(self):
        self.assertFalse(run(['/api/users/1/extra'])['hits']['EP-X-003'])

    def test_graphql_operations_match_by_name(self):
        r = run(['http://localhost:4002/graphql#getUser'])
        self.assertTrue(r['hits']['EP-X-006'])
        self.assertFalse(r['hits']['EP-X-007'])                    # op finding is not the bare endpoint
        self.assertTrue(run(['/graphql'])['hits']['EP-X-007'])

    def test_graphql_substring_is_not_enough(self):
        r = run(['/graphql-playground', '/api/graphql/schema.json'])
        self.assertFalse(r['hits']['EP-X-007'])


class Precision(unittest.TestCase):
    def test_strict_counts_out_of_scope_lenient_does_not(self):
        r = run(['/api/users', 'https://cdn.example.com/lib'])
        self.assertEqual(r['path_level']['strict']['precision'], 0.5)
        self.assertEqual(r['path_level']['lenient']['precision'], 1.0)

    def test_assets_are_not_endpoint_false_positives(self):
        r = run(['/api/users', '/remoteEntry.js', '/main.js', '/main.js.map'])
        self.assertEqual(r['path_level']['strict']['precision'], 1.0)
        self.assertEqual(r['counts']['asset_findings'], 3)
        self.assertEqual(r['assets']['found'], 1)

    def test_precision_and_recall_share_the_unit(self):
        r = run(['/api/users', '/api/users?page=2', '/api/users/'])
        s = r['path_level']['strict']
        self.assertEqual((s['tp_findings'], s['findings']), (1, 1))

    def test_unmatched_in_scope_is_a_false_positive(self):
        r = run(['/api/users', '/api/nope'])
        self.assertEqual(r['path_level']['strict']['precision'], 0.5)
        self.assertIn('http://localhost:3005/api/nope', [u if u.startswith('http') else 'http://localhost:3005' + u
                                                         for u in r['false_positives']])


class MethodLevel(unittest.TestCase):
    def test_method_level_only_credits_the_reported_method(self):
        r = run(['/api/users'], methods={'/api/users': 'GET'}, method_aware=True)
        m = r['method_level']
        self.assertEqual(m['tp_ground_truth'], 1)                   # GET /api/users, not POST
        self.assertEqual(m['precision'], 1.0)

    def test_method_level_is_absent_without_methods(self):
        self.assertIsNone(run(['/api/users'])['method_level'])


class Breakdowns(unittest.TestCase):
    def test_per_class_and_test_case_recall(self):
        r = run(['/api/users/1'])
        self.assertEqual(r['per_discovery_class']['bundle_composed']['found'], 1)
        self.assertEqual(r['recall_test_cases'], round(1 / 5, 4))


class Noise(unittest.TestCase):
    RULES = [('noise_router', '/admin/users'), ('noise_component', 'ProductCard'), ('noise_pdf', '/Type /Page')]

    def test_segment_runs_not_substrings(self):
        self.assertEqual(ev.noise_tag('/admin/users', self.RULES), 'noise_router')
        self.assertEqual(ev.noise_tag('/admin/users/settings', self.RULES), 'noise_router')
        self.assertIsNone(ev.noise_tag('/api/superadmin/users2', self.RULES))

    def test_bare_word_is_a_whole_segment(self):
        self.assertEqual(ev.noise_tag('/ProductCard', self.RULES), 'noise_component')
        self.assertIsNone(ev.noise_tag('/ProductCards', self.RULES))

    def test_raw_match_for_pdf_operators(self):
        self.assertEqual(ev.noise_tag('/Type /Page', self.RULES), 'noise_pdf')


class Stats(unittest.TestCase):
    def test_wilson(self):
        self.assertAlmostEqual(ev.wilson(0, 50)[1], 0.071, places=3)     # paper said 5.8 %
        self.assertAlmostEqual(ev.wilson(1, 50)[1], 0.105, places=3)
        lo, hi = ev.wilson(21, 538)
        self.assertAlmostEqual(lo, 0.0256, places=3)
        self.assertAlmostEqual(hi, 0.0590, places=3)


class Loaders(unittest.TestCase):
    def test_spabench_reads_endpoint_and_score(self):
        import json
        import tempfile
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump({'endpoints': [{'endpoint': '/a', 'method': 'post', 'confidence_score': 70}]}, f)
        try:
            self.assertEqual(ev.load_spabench(f.name), [{'url': '/a', 'method': 'POST', 'score': 70}])
        finally:
            os.unlink(f.name)

    def test_jsluice_json_lines(self):
        import tempfile
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
            f.write('{"url": "/a", "method": "GET"}\n{"url": "/b"}\n')
        try:
            self.assertEqual([x['url'] for x in ev.load_jsluice(f.name)], ['/a', '/b'])
        finally:
            os.unlink(f.name)


if __name__ == '__main__':
    unittest.main()
