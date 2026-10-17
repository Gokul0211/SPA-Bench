#!/usr/bin/env python3
"""
Paired comparison of two tools on SPABench from their evaluate.py reports (--report).

Both reports must cover the same apps. For every ground-truth endpoint the reports record whether the tool
found it ("hits"); the comparison is therefore paired:

  * McNemar exact test on discordant endpoints (found by A only vs found by B only), two-sided;
  * paired bootstrap 95% CI of the recall difference (A - B), resampling ground-truth endpoints;
  * the same bootstrap resampling APPS (the unit that matters for generalisation; wide with 5 apps);
  * micro and macro recall for each tool.

Usage:
  python compare.py A.eval.json B.eval.json [--iterations 10000] [--seed 0] [--json OUT]

Reports written for a single app (`evaluate.py --app X --report ...`) can be merged first with --merge:
  python compare.py --merge OUT.json app1.eval.json app2.eval.json ...
"""
import argparse
import json
import math
import random
import sys


def load_hits(path):
    d = json.load(open(path, encoding='utf-8'))
    hits = {}
    for a in d['apps']:
        for eid, ok in a['hits'].items():
            hits[(a['app'], eid)] = bool(ok)
    return d.get('tool', path), hits


def mcnemar_exact(b, c):
    """Two-sided exact McNemar p-value from the discordant counts b (A only) and c (B only)."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * tail)


def _pct(xs, q):
    xs = sorted(xs)
    i = min(len(xs) - 1, max(0, int(round(q * (len(xs) - 1)))))
    return xs[i]


def compare(hits_a, hits_b, iterations=10000, seed=0):
    keys = sorted(set(hits_a) & set(hits_b))
    if not keys:
        raise SystemExit('no ground-truth endpoints in common')
    a_only = sum(hits_a[k] and not hits_b[k] for k in keys)
    b_only = sum(hits_b[k] and not hits_a[k] for k in keys)
    both = sum(hits_a[k] and hits_b[k] for k in keys)
    rec = lambda h, ks: sum(h[k] for k in ks) / len(ks)
    out = {'endpoints': len(keys), 'both': both, 'a_only': a_only, 'b_only': b_only,
           'neither': len(keys) - both - a_only - b_only,
           'micro_recall': {'a': round(rec(hits_a, keys), 4), 'b': round(rec(hits_b, keys), 4)},
           'mcnemar_p': round(mcnemar_exact(a_only, b_only), 6)}
    apps = sorted({k[0] for k in keys})
    by_app = {x: [k for k in keys if k[0] == x] for x in apps}
    out['macro_recall'] = {'a': round(sum(rec(hits_a, by_app[x]) for x in apps) / len(apps), 4),
                           'b': round(sum(rec(hits_b, by_app[x]) for x in apps) / len(apps), 4)}
    rng = random.Random(seed)
    diffs_e, diffs_a = [], []
    for _ in range(iterations):
        sample = [keys[rng.randrange(len(keys))] for _ in keys]
        diffs_e.append(rec(hits_a, sample) - rec(hits_b, sample))
        pick = [apps[rng.randrange(len(apps))] for _ in apps]
        diffs_a.append(sum(rec(hits_a, by_app[x]) - rec(hits_b, by_app[x]) for x in pick) / len(pick))
    out['recall_diff_ci95_over_endpoints'] = [round(_pct(diffs_e, .025), 4), round(_pct(diffs_e, .975), 4)]
    out['recall_diff_ci95_over_apps'] = [round(_pct(diffs_a, .025), 4), round(_pct(diffs_a, .975), 4)]
    out['recall_diff'] = round(out['micro_recall']['a'] - out['micro_recall']['b'], 4)
    return out


def merge(out_path, paths):
    merged = {'tool': None, 'apps': []}
    for p in paths:
        d = json.load(open(p, encoding='utf-8'))
        merged['tool'] = merged['tool'] or d.get('tool')
        merged['apps'].extend(d['apps'])
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=2)
    print(f'merged {len(merged["apps"])} apps -> {out_path}')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('reports', nargs='*')
    ap.add_argument('--merge', metavar='OUT')
    ap.add_argument('--iterations', type=int, default=10000)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--json')
    args = ap.parse_args(argv)
    if args.merge:
        merge(args.merge, args.reports)
        return 0
    if len(args.reports) != 2:
        ap.error('give exactly two evaluate.py reports')
    (na, ha), (nb, hb) = load_hits(args.reports[0]), load_hits(args.reports[1])
    res = compare(ha, hb, args.iterations, args.seed)
    res['a'], res['b'] = na, nb
    print(f'A = {na}   B = {nb}   ({res["endpoints"]} ground-truth endpoints)')
    print(f'  recall (micro)  A {res["micro_recall"]["a"]:.3f}   B {res["micro_recall"]["b"]:.3f}   diff {res["recall_diff"]:+.3f}')
    print(f'  recall (macro)  A {res["macro_recall"]["a"]:.3f}   B {res["macro_recall"]["b"]:.3f}')
    print(f'  discordant: A only {res["a_only"]}, B only {res["b_only"]}  ->  McNemar exact p = {res["mcnemar_p"]}')
    print(f'  95% CI of diff: over endpoints {res["recall_diff_ci95_over_endpoints"]}, over apps {res["recall_diff_ci95_over_apps"]}')
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump(res, f, indent=2)
    return 0


if __name__ == '__main__':
    sys.exit(main())
