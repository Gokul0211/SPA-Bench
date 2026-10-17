"""compare.py: McNemar and paired bootstrap; evaluate.py parameter/auth scoring helpers."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import compare  # noqa: E402


class Compare(unittest.TestCase):
    def test_mcnemar_exact(self):
        self.assertAlmostEqual(compare.mcnemar_exact(10, 0), 2 / 1024)
        self.assertEqual(compare.mcnemar_exact(5, 5), 1.0)
        self.assertEqual(compare.mcnemar_exact(0, 0), 1.0)

    def test_paired_comparison(self):
        a = {('x', str(i)): True for i in range(10)}
        b = {('x', str(i)): i < 4 for i in range(10)}
        r = compare.compare(a, b, iterations=300, seed=1)
        self.assertEqual((r['a_only'], r['b_only'], r['both']), (6, 0, 4))
        self.assertAlmostEqual(r['recall_diff'], 0.6)
        lo, hi = r['recall_diff_ci95_over_endpoints']
        self.assertTrue(lo <= 0.6 <= hi)
        self.assertLess(r['mcnemar_p'], 0.05)

    def test_deterministic(self):
        a = {('x', str(i)): i % 2 == 0 for i in range(20)}
        b = {('x', str(i)): i % 3 == 0 for i in range(20)}
        self.assertEqual(compare.compare(a, b, 200, 7), compare.compare(a, b, 200, 7))


if __name__ == '__main__':
    unittest.main()
