# SPABench Evaluation Guide (v3)

How `evaluate.py` scores a tool, exactly. Everything here is implemented in `evaluate.py` and covered by
`tests/test_evaluate.py`.

---

## 1. Run

```bash
docker compose up -d --build
your-tool --target http://localhost:3001 --output results.json
python evaluate.py --tool-output results.json --app angular-permit --breakdown-by discovery_class --show-missed
```

Always pass `--app`: relative findings are resolved against that app's origin, and every metric is per app.
Without `--app`, every app is scored and micro (pooled) and macro (mean over apps) totals are printed.

## 2. Input formats

| `--format` | Expects |
|---|---|
| `spabench-v1` (default) | JSON `{"endpoints": [{"url" or "endpoint": "...", "method": "GET", "confidence_score": 87}]}` — the Shadow Endpoints report format. Only the URL is required. |
| `linkfinder`, `urls` | one URL or path per line (`#` lines ignored) |
| `xnlinkfinder` | JSON array / `{"results": [...]}`, or one URL per line |
| `jsluice` | JSON lines (`jsluice urls` output) or a JSON array; `url` (or `value`) and optional `method` |
| `katana` | JSON lines; `request.endpoint` and `request.method` |

URLs are taken as the tool wrote them — absolute or relative, nothing is rewritten before scoring.

## 3. What is counted

**Endpoint identity.** A REST or WebSocket endpoint is its **path template** within an app; a GraphQL operation
is its **name** (report it as `…/graphql#operationName`). The ground truth's entries are grouped by that identity,
so a path that the client calls with GET, POST and DELETE is one unit; a tool finding the path once gets the unit
once.

| Metric | Unit | Formula |
|---|---|---|
| recall (path level, headline) | ground-truth paths | found paths / ground-truth paths |
| precision (path level, headline) | the tool's distinct finding-paths | finding-paths that match a ground-truth path / all finding-paths |
| method-level P/R (secondary) | (method, path) | only for formats that carry methods (`spabench-v1`, `jsluice`, `katana`) |

Findings are deduplicated before counting: query strings, trailing slashes, and id-like path segments
(`42`, hex/uuid, `PTW-1000`) collapse, so `/api/users/1`, `/api/users/7` and `/api/users/{id}` are one finding.

**Matching a finding to the ground truth**

* Relative findings resolve against the app origin (`/api/x` → `http://localhost:300N/api/x`).
* Hosts are interchangeable only within the app's `api_hosts` (its origin plus the backends its nginx proxies to,
  e.g. angular-erp: 3002, 4001, 3011–3018). External hosts (staging, private IPs) must match exactly.
* A `{param}` in the ground truth matches any one segment; a finding's own placeholder (`{id}`, `:id`, `${…}`)
  matches only a `{param}`, never a literal segment. Segment counts must agree.
* A GraphQL finding with a fragment matches the operation of that name; `/graphql` without a fragment matches the
  GraphQL HTTP endpoint entry. Substrings such as `/graphql-playground` match nothing.

**Assets are not endpoints.** Findings that are static files (`.js .mjs .map .css .html .json .wsdl …`) are scored
separately against the app's asset list (`assets` in the manifest: remoteEntry files, lazily loaded chunks,
workers) and never count as endpoint false positives.

## 4. Strict and lenient precision

| | strict (default headline) | lenient |
|---|---|---|
| finding matches a ground-truth path | true positive | true positive |
| no match, but the **route oracle** says the benchmark serves it (e.g. `/actuator/health`, `/api-docs`) | false positive | true positive ("real uncurated") |
| no match, not served | false positive | false positive |
| on a host outside the app (CDN, another app's port) | false positive (`out_of_scope`) | ignored |

The route oracle (`spabench/oracle.py`) is read from source: Express routes, the WSDL, the GraphQL schema, the
WebSocket server and each app's nginx configuration. It replaces v2.0's live "any non-404 is real" probing, which
counted every path on an app as real because the apps answered every path with their HTML shell.

Both modes are always computed; `--mode` only chooses the headline. Report which one you use.

## 5. Breakdowns and statistics

* `--breakdown-by discovery_class | design_technique | kind` — per-group recall over ground-truth paths
  (`design_technique` covers test cases only);
* recall for public vs login-protected endpoints, and over test cases only;
* Wilson 95 % intervals for every precision and recall;
* `hits` in the JSON report maps every ground-truth id to found/not found — use it for paired comparisons
  (McNemar) between tools on the same app;
* `--min-score S` drops findings below a confidence score; `--pr-curve` prints precision/recall at every score
  threshold;
* vendor noise: false positives are tagged with `noise/manifest-noise.json` indicators (whole path segments, not
  substrings); the rate is tagged FPs / all FPs.

## 6. JSON report (`--report out.json`)

```
{tool, format, manifest_version, mode,
 apps: [{app, path_level: {strict: {...}, lenient: {...}}, method_level, counts, recall_public,
         recall_authenticated, recall_test_cases, per_discovery_class, per_design_technique, per_kind,
         assets, hits, missed, false_positives, vendor_noise, real_uncurated}],
 combined: {strict: {micro, macro}, lenient: {micro, macro}}}     # only when several apps are scored
```

Each `path_level` block has `precision, recall, f1, precision_ci95, recall_ci95, tp_findings, findings,
tp_ground_truth, ground_truth`.

## 7. Fair comparisons

* Score every tool with the same command (`run_competitor_scans.py` and `run_authenticated_scans.py` do this).
* Give every tool the same inputs: the same JS files (the runners use the app's complete served inventory), the
  same credentials, the same crawl budget where the tool has one.
* Report per app and pooled, with intervals, strict and lenient, and test-case recall separately from surface
  recall.

## 8. Reproducing v2.0 numbers

```bash
python evaluate.py --legacy-v2 --manifest legacy/manifest-v2.0.json --tool-output results.json --app angular-permit
```

runs the v2.0 scorer unchanged. Its rules differ from v3 in every respect listed above; do not mix the two.
