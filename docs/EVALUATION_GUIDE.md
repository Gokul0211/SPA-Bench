# SPABench Evaluation Guide

How to run `evaluate.py` against any SPA API discovery tool and interpret the results.

---

## Quick Start

```bash
# 1. Start the benchmark
docker compose up -d

# 2. Run your tool against App A (Angular Permit)
your-tool --target http://localhost:3001 --output results-app-a.json

# 3. Evaluate
python evaluate.py \
  --manifest manifest.json \
  --tool-output results-app-a.json \
  --app angular-permit \
  --breakdown-by technique \
  --show-missed
```

---

## Output Format

Your tool must produce — or be adapted to produce — a JSON file in this format:

```json
{
  "tool": "YourToolName",
  "version": "1.0.0",
  "target": "http://localhost:3001",
  "endpoints": [
    {
      "url": "http://localhost:3001/api/rc_permit/getPermitType",
      "method": "GET",
      "confidence": 91,
      "source": "static_analysis"
    }
  ]
}
```

Fields `confidence` and `source` are optional. Only `url` and `method` are required per endpoint.

---

## Built-In Adapters

Use `--format` to handle native output formats directly:

| Format | `--format` value | Description |
|---|---|---|
| SPABench native | `spabench-v1` | Default. JSON with `endpoints` array |
| LinkFinder | `linkfinder` | One URL or path per line, `#` comments |
| xnLinkFinder | `xnlinkfinder` | JSON array or `{ "results": [...] }` |
| JSLuice | `jsluice` | JSON array of `{ "kind": "URL", "value": "..." }` |
| Katana | `katana` | JSONL, one `{ "request": { "endpoint": "..." } }` per line |

Example:

```bash
# Evaluate LinkFinder output
python evaluate.py \
  --manifest manifest.json \
  --tool-output linkfinder-results.txt \
  --format linkfinder \
  --breakdown-by technique
```

---

## Metrics Explained

### Precision
```
Precision = True Positives / (True Positives + False Positives)
```
What fraction of the tool's reported endpoints are real API endpoints in the manifest.
A tool that reports only things it is certain about has high precision.

### Recall
```
Recall = True Positives / Total Manifest Endpoints
```
What fraction of all ground-truth endpoints the tool discovered.
Per-technique recall is the most actionable metric — it shows exactly which discovery
capabilities are present or absent.

### F1
```
F1 = 2 * Precision * Recall / (Precision + Recall)
```
Harmonic mean. Use this for single-number tool ranking.

### Auth-Stratified Recall
```
Recall_unauthenticated = TPs from unauth endpoints / Total unauth manifest endpoints
Recall_authenticated   = TPs from auth-gated endpoints / Total auth-gated manifest endpoints
```
A tool that fails to authenticate will have `Recall_authenticated = 0%` regardless of its
static analysis capability. These two metrics separate the authentication problem from the
discovery problem.

### Vendor Noise Rate
```
Vendor Noise Rate = FPs attributable to bundled libraries / Total FPs
```
Computed by cross-referencing false positive URLs against patterns in `noise/manifest-noise.json`.
A rate of 80% means 80% of the tool's false positives are vendor library paths
(Moment.js locales, ExcelJS XML paths, Angular compiler artifacts, etc.) rather than
genuine endpoint candidates.

---

## URL Matching Rules

`evaluate.py` applies these normalisation rules before comparing URLs:

1. **Trailing slash stripped** — `/api/users/` matches `/api/users`
2. **Scheme + host lowercased** — `HTTP://Localhost:3001` matches `http://localhost:3001`
3. **Query params sorted alphabetically** — `?b=2&a=1` matches `?a=1&b=2`
4. **Path parameter wildcards** — `/api/users/123` matches `/api/users/{id}`

GraphQL resolver endpoints use URL fragments: `http://localhost:3005/graphql#getUser`.
Both the base URL and the fragment must match.

---

## Breakdown Modes

### Per-technique breakdown (most actionable)

```bash
python evaluate.py \
  --manifest manifest.json \
  --tool-output results.json \
  --breakdown-by technique
```

Output:
```
  Breakdown by technique:
  ----------------------------------------------------------
  Dimension                              Found Total   Recall
  ----------------------------------------------------------
  v fetch_interception                       2     2   100.0%
  ~ url_concat_direct                        1     2    50.0%
  x webpack_registry_unnavigated             0     2     0.0%
  x soap_bridge_dynamic                      0     3     0.0%
  ----------------------------------------------------------
```

`v` = 100% recall, `~` = partial, `x` = 0%

### Per-phase breakdown

```bash
python evaluate.py --manifest manifest.json --tool-output results.json --breakdown-by phase
```

### Per-app breakdown

```bash
python evaluate.py --manifest manifest.json --tool-output results.json --breakdown-by app
```

---

## Compare Multiple Tools

```bash
python evaluate.py \
  --manifest manifest.json \
  --compare linkfinder.json jsluice.json katana.json your-tool.json \
  --report comparison.html
```

Produces an HTML table with all tools side-by-side. Also works with `--report comparison.json`
for machine-readable output.

---

## Filter to One App

```bash
# Evaluate only against App A
python evaluate.py \
  --manifest manifest.json \
  --tool-output results.json \
  --app angular-permit \
  --breakdown-by technique \
  --show-missed
```

App IDs: `angular-permit`, `angular-erp`, `react-ecommerce`, `vue-portal`, `nextjs-saas`

---

## Reference Results (Paper Baseline)

These results are from the companion paper evaluation on the real production targets.
SPABench reproduces the same discovery challenges in a controlled environment.

| Tool | Precision | Recall (App A equivalent) | Notes |
|---|---|---|---|
| LinkFinder | ~2% | <1% | 370/550 results are vendor noise |
| xnLinkFinder | ~3% | <1% | Fragment-only URLs, no base resolution |
| JSLuice | ~95% | <1% | Finds only complete string literal URLs (4 of 421) |
| Katana | ~40% | ~5% | Crawl-only, misses unnavigated paths |
| Research tool (paper) | ~89% | ~96% | Full hybrid static+dynamic pipeline |

---

## Troubleshooting

**All recalls are 0%** — Check that your tool output URLs use the correct localhost ports
(3001–3005 for apps, 4001–4004 for API servers).

**Recall_authenticated = 0%** — Your tool did not authenticate. See `docs/ADDING_TEST_CASES.md`
for the auth flows. Use `--format` to check the tool output contains any auth-gated endpoint URLs.

**High vendor noise rate** — Your tool is extracting vendor library paths as endpoints.
The `noise/vendor.js` fixture contains example patterns. Run with `--show-missed` to see
which endpoints were found vs missed, and compare false positives against `noise/manifest-noise.json`.

**GraphQL endpoints not found** — GraphQL resolvers (EP-E-GQL-*) require introspection against
`http://localhost:3005/graphql`. If your tool doesn't send `__schema` introspection queries,
these 17 endpoints will not appear in its output.
