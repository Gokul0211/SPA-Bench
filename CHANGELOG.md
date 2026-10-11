# Changelog

## 3.0.0

Breaking revision. Scores computed with 2.x are not comparable; `evaluate.py --legacy-v2` with
`legacy/manifest-v2.0.json` reproduces them.

### Ground truth
- The ground truth is now the **complete API surface the clients reference** (168 endpoints, 135 distinct paths),
  annotated from the served code. The 2.0 test cases (112 after the GraphQL rework) are kept and flagged
  `test_case: true`. 2.0 omitted ~56 endpoints that the clients call, so tools were charged false positives for
  finding them.
- `manifest.json` is **built** by `build_manifest.py` from `apps/*/manifest-partial.json` and the served artifacts.
  Derived per endpoint: `discovery_class`, `evidence` (+ locations), `present_in`, `exclusive`,
  `minified_location`, `source_file`, default notes; derived summary counts. In 2.0 these were typed by hand: 46 of
  47 "source-map only" entries were literal in the bundle, 0 of 95 bundle locations were correct, 51 source-file
  paths did not exist, and the header totals disagreed with the lists.
- Static files (remoteEntry, chunks, workers) are listed as **assets**, scored separately from endpoints.
- Corrected entries: staging/OAuth URLs are endpoints rather than base URLs; the GraphQL endpoint is
  `POST /graphql` (what the client calls); WebSockets are `ws://localhost:3005/ws/*`; the TOTP login is
  `/api/auth/login` + `/api/auth/mfa/verify` (2.0 listed a `/api/auth` that nothing called).
- Removed `confidence_tier` (a prediction of one tool's scorer) and `phase` (one tool's pipeline numbering);
  added `design_technique` for test cases and the derived `discovery_class`. Schema rewritten to match.

### Serving
- Every app's nginx forwards its same-origin API paths to the backends; static assets return 404 when missing
  and the HTML shell is served only for client routes. In 2.0 no app proxied anything and every path returned the
  HTML shell with 200, so 84 of 114 entries were answered by nothing while reachability checks passed.
- 120+ missing backend routes added; one auth policy (`requireAuth`/`requireRole`) for all apps; the TOTP flow
  works (2.0's verify step could never succeed).
- nginx configs live in `apps/*/nginx/*.conf`; containers listen on 80; compose maps the host ports.

### Realism and leakage
- Removed test-case labels and benchmark commentary from everything served: HTML, bundles, source-map sources,
  GraphQL descriptions, the OpenAPI document, the WSDL, API responses.
- Removed the auth bypass: no pre-planted bearer token, role or session cookie, no hard-coded credentials or
  auto-login in bundles. Every app has a login form; the static token works only with
  `BENCH_ALLOW_STATIC_TOKEN=1`.
- Assets are referenced like real builds reference them: Next.js `_buildManifest.js` and runtime chunk map,
  `new Worker(...)`, federation remotes; removed references to non-existent files and files no build would ship.
- Runtime bugs fixed: CommonJS `exports` in browser chunks, Module Federation remotes resolving `main.js` against
  the wrong origin, a shadowed variable in the mobile chunk, missing `put`/`delete` in the Vue HTTP stub, a
  `wss:`-only WebSocket URL on plain HTTP.
- Source maps regenerated from the repository sources (`scripts/sync_sourcemaps.py`); 22 orphan maps removed;
  sources that existed only inside maps added to the repository.

### Tooling
- `evaluate.py` rewritten: path-template unit for precision and recall, host rules, assets separated, strict and
  lenient precision with an offline route oracle instead of "non-404 = real", Wilson intervals, per-class
  breakdowns, per-entry hits, PR curves, JSON reports.
- `sanity_check.py` rewritten: real handlers only (404/HTML fail), auth enforcement, WebSocket handshake, GraphQL
  introspection, must-404 checks; `--offline` mode.
- New: `audit/bench_audit.py` (offline consistency proof), `spabench/` helpers, `make_docs.py`,
  `scripts/sync_sourcemaps.py`, `tests/`.
- Runners: identical scoring for every tool, complete JS inventory for the static baselines, pinned versions,
  run metadata, generated result tables.
