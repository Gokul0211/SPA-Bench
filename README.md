# SPABench v3.0.0

**A controlled benchmark for API-endpoint discovery in single-page applications.**

SPABench is the evaluation suite released with *"Shadow Endpoints: Hybrid Static–Dynamic Discovery of Hidden API
Surfaces in Obfuscated Single-Page Applications"*. It ships five Dockerised SPAs, four API servers, a ground truth
derived from the served artifacts, a scorer, and an offline audit that proves the benchmark is internally
consistent.

> **Authors:** Gokul Iyer, Aditya Ghadi, Aditya More, Parth Choutapelly, Kavya Huliyurdurga
> **DOI:** 10.5281/zenodo.XXXXXXX *(to be assigned)*

v3.0.0 is a breaking revision of v2.0 — see [Changes from v2.0](#changes-from-v20) and [CHANGELOG.md](CHANGELOG.md).
Numbers reported against v2.0 are not comparable with v3.0.0.

---

## What it measures (and what it doesn't)

Each app is a small client that talks to a real API. The ground truth is **every API endpoint the client
references** — not a hand-picked subset — so precision means something: a finding is either one of those
endpoints or it is not. Within that surface, the hand-designed **test cases** exercise specific discovery
techniques (constructor-injection chains, string-array obfuscation, environment files leaked through source maps,
Module Federation, WSDL-driven URLs, GraphQL introspection, …).

Every endpoint carries a **discovery class** computed by `build_manifest.py` from what is actually served — the
easiest artifact in which the endpoint can be recovered and whether it appears there as a literal or must be
assembled. The class is derived, never typed by hand, and the build fails if an annotation contradicts the
artifacts.

SPABench is small and synthetic. It characterises *techniques*; recall here does not predict recall on arbitrary
production SPAs. See [Limitations](#limitations).

<!-- BEGIN generated:totals -->
168 endpoints (112 hand-designed test cases + 56 further client calls), 135 distinct paths, 16 assets, across 5 apps. 146 endpoints require login; by kind: 17 graphql, 149 rest, 2 websocket.
<!-- END generated:totals -->

### Apps

<!-- BEGIN generated:apps -->
| App | Emulates | Host port | Source maps | Login | Endpoints | of which test cases | Distinct paths | Assets |
|---|---|---|---|---|---|---|---|---|
| angular-permit | angular 8 (emulated), angular-cli-webpack | 3001 | served | bearer | 63 | 22 | 54 | 3 |
| angular-erp | angular 17 (emulated), webpack5-module-federation | 3002 | served | bearer | 28 | 18 | 22 | 10 |
| react-ecommerce | react 18 (emulated), vite | 3003 | served | bearer | 22 | 20 | 14 | 2 |
| vue-portal | vue 3 / Nuxt 3 (emulated), nuxt | 3004 | blocked (404) | form | 20 | 18 | 15 | 1 |
| nextjs-saas | nextjs 14 (emulated), nextjs-compiler | 3005 | served | totp | 35 | 34 | 30 | 0 |
| **total** | | | | | **168** | **112** | **135** | **16** |
<!-- END generated:apps -->

| App | What it exercises |
|---|---|
| angular-permit | API on a separate origin; lazily loaded admin/reports chunks; a disabled (commented-out) mobile chunk; HTML attributes (`ng-include`, `onclick`, `formaction`, inline `import()`); string-array obfuscation; a development environment file leaked through the bundle's source map |
| angular-erp | Module Federation shell with 9 remotes loaded on navigation; a background-sync Web Worker; a private-network URL in a remote; a Spring-style actuator that no client references |
| react-ecommerce | public catalogue + authenticated account area; a checkout chunk loaded on demand; a Web Worker that fetches recommendations; an IndexedDB request cache |
| vue-portal | cookie-session login; source maps blocked (404); SOAP operations exposed as REST paths whose names are read from a WSDL at runtime; a `<noscript>` fallback script |
| nextjs-saas | REST + GraphQL + WebSockets behind one origin; TOTP second factor; chunks referenced through `_buildManifest.js` and the webpack runtime chunk map; server code leaked into client chunks; two GraphQL operations that appear in no client artifact |

### Discovery classes

<!-- BEGIN generated:classes -->
| Discovery class | Endpoints | Meaning |
|---|---|---|
| `html_literal` | 1 | path is written in the served HTML |
| `bundle_literal` | 106 | every literal piece of the path is inside one string literal of a served bundle |
| `bundle_composed` | 36 | assembled in a served bundle from several literals/variables (needs value-flow) |
| `sourcemap_literal` | 1 | literal only in the TypeScript sources shipped in a source map |
| `sourcemap_composed` | 3 | composed, and only in source-map sources |
| `runtime_data` | 3 | the last piece comes from data fetched at runtime (WSDL operations) |
| `graphql_client_operation` | 2 | GraphQL operation named in a client query |
| `graphql_sourcemap_operation` | 13 | GraphQL operation named only in source-map sources |
| `graphql_introspection_only` | 2 | GraphQL operation named nowhere in the client; schema introspection only |
| `probe_only` | 1 | referenced by no client code; found only by probing well-known paths |
<!-- END generated:classes -->

The full list — every endpoint with its class, the artifacts it is present in and its test-case design — is in
[docs/TEST_CASES.md](docs/TEST_CASES.md) (generated).

---

## Quick start

Prerequisites: Docker with Compose, Python 3.9+ (`pip install jsonschema` for schema validation; the rest is
standard library).

```bash
docker compose up -d --build
python sanity_check.py            # every endpoint answered by a real handler (needs the containers)
python audit/bench_audit.py all   # offline consistency proof (no containers needed)
```

| Service | Host port | |
|---|---|---|
| angular-permit | 3001 | |
| angular-erp shell / remotes | 3002 / 3011–3018 | |
| react-ecommerce | 3003 | |
| vue-portal | 3004 | |
| nextjs-saas | 3005 | |
| REST / GraphQL / WebSocket / SOAP | 4001 / 4002 / 4003 / 4004 | also reachable same-origin through each app's nginx |

**Accounts.** `benchuser` / `benchpass` (operator) and `benchadmin` / `benchpass` (admin). Every app shows a login
form; nextjs-saas then asks for a TOTP code (secret `JBSWY3DPEHPK3PXP`, 30 s step). Protected endpoints require
a real login: the static development token is accepted only if the backends run with `BENCH_ALLOW_STATIC_TOKEN=1`,
which benchmark runs must not set.

---

## Scoring a tool

```bash
python evaluate.py --tool-output results.json --app angular-permit
python evaluate.py --tool-output lf.txt --format linkfinder --app vue-portal --breakdown-by discovery_class
python evaluate.py --tool-output results.json --app nextjs-saas --min-score 55 --pr-curve --report out.json
```

Formats: `spabench-v1` (default; `{"endpoints": [{"url"|"endpoint": …, "method": …, "confidence_score": …}]}`),
`linkfinder`, `xnlinkfinder`, `jsluice` (JSON lines), `katana` (JSONL), `urls` (one per line). URLs may be
absolute or relative to the app.

**Rules** (details in [docs/EVALUATION_GUIDE.md](docs/EVALUATION_GUIDE.md)):

- the unit is a **distinct path template per app** (GraphQL: the operation name, reported as `…/graphql#op`);
  precision and recall use the same unit; method-level scores are added for tools that report methods;
- relative findings resolve against the app's origin; hosts are interchangeable only among the app's own API
  hosts; staging hosts and private IPs must match exactly;
- **strict** (default): anything that matches no ground-truth path is a false positive, including findings on
  unrelated hosts; **lenient**: additionally credits findings the route oracle confirms are served by the
  benchmark, and ignores unrelated hosts. Both are always reported;
- static files (JS, maps, CSS, …) are scored separately as asset discovery and never count against endpoint
  precision;
- Wilson 95 % intervals, per-class / per-technique / per-app breakdowns, a per-entry hit map (for paired tests),
  vendor-noise tagging.

`--legacy-v2 --manifest legacy/manifest-v2.0.json` runs the v2.0 scorer unchanged, to reproduce numbers computed
with v2.0.

### Running the scanner and the baselines

```bash
python run_authenticated_scans.py                 # Shadow Endpoints (default: ../../refactored/main.py)
python run_competitor_scans.py                    # LinkFinder, xnLinkFinder, JSLuice, Katana
python run_competitor_scans.py --input served+sources
```

Both runners score with the identical `evaluate.py` call and write `RESULTS.md` + `run_meta.json` (tool versions,
commands, inputs, timestamps). The static baselines receive the app's complete served JavaScript inventory read
from the repository — what perfect crawling would hand them; `--input served+sources` also gives them every
source-map source. Tool versions are pinned (xnLinkFinder 8.2, jsluice v0.0.0-20240110145140-0ddfab153e06,
Katana 1.6.1, LinkFinder vendored copy recorded by hash).

---

## Repository layout

```
apps/<app>/                 client: dist/ (or .next/) served by nginx, src/ (sources shipped in the maps),
                            nginx/*.conf, Dockerfile, manifest-partial.json (hand-written ground-truth input)
api-servers/                rest-backend (4001), graphql-backend (4002), websocket-backend (4003), soap-bridge (4004)
spabench/                   shared helpers: served-artifact corpus (artifacts.py), route oracle (oracle.py)
manifest.json               ground truth — built, never edited by hand
manifest.schema.json        JSON Schema of manifest.json
build_manifest.py           partials + served artifacts → manifest.json (--check)
validate_manifest.py        schema + rebuild equality + semantic rules
evaluate.py                 scorer (legacy/evaluate_v2.py for v2 reproduction)
sanity_check.py             live check against the containers (--offline: via the oracle)
audit/bench_audit.py        offline audit: served, ground-truth, maps, leaks, reachability, consistency
make_docs.py                regenerates the tables in this README and docs/TEST_CASES.md (--check)
scripts/sync_sourcemaps.py  keeps every served map in sync with the app sources (--check)
run_*_scans.py              tool runners
tests/                      python -m unittest discover -s tests
noise/                      vendor-noise indicators used to tag false positives
legacy/                     v2.0 manifest and scorer, for reproducing v2.0 numbers
docs/                       evaluation guide, technique vocabulary, test-case list, how to add cases
```

`tools/` (third-party binaries) and `output/` (scan outputs) are not tracked.

---

## Checking the benchmark itself

```bash
python build_manifest.py --check         # manifest.json == what the partials + artifacts produce
python validate_manifest.py              # schema + semantics
python scripts/sync_sourcemaps.py --check
python make_docs.py --check
python audit/bench_audit.py all          # everything below, offline
python -m unittest discover -s tests
```

The audit fails if any ground-truth endpoint is not answered through its app's origin, a served file carries
test labels, benchmark prose, the static token or the bench password, a served JS file or map is not reachable from
an `index.html`, a reference points at a file that is not served, a map is invalid or out of sync, or the
Dockerfiles, compose file and nginx configs disagree with the serving map.

---

## Changes from v2.0

- **Ground truth = the client's full API surface** (168 endpoints) instead of 108 hand-picked entries; the 108
  original cases (112 after the GraphQL rework) are kept as tagged test cases. v2.0 charged tools for correctly
  finding the ~56 endpoints that the clients call but the manifest omitted.
- **Discovery classes are derived from the artifacts.** In v2.0, 46 of the 47 "source-map only" entries were plainly
  in the bundle, no recorded bundle location was correct, and 51 source-file paths did not exist.
- **Everything in the ground truth is served.** In v2.0, 84 of 114 entries were answered by nothing (no proxies,
  missing routes); every app returned its HTML shell with 200 for any path, so the reachability checks could not
  fail.
- **No answer key and no auth bypass in served files.** Test-case labels, benchmark commentary, a pre-planted bearer
  token and hard-coded credentials were removed from HTML, bundles, source maps, GraphQL descriptions, the OpenAPI
  document and the WSDL. Logins are real.
- **Assets are reachable the way real builds reference them** (build manifest, runtime chunk map, `new Worker`,
  federation remotes) instead of only through file-name guessing.
- **Scoring rewritten** (unit, hosts, assets, strict/lenient, route oracle), plus `sanity_check.py`, the runners,
  and an offline audit.

Full list: [CHANGELOG.md](CHANGELOG.md).

---

## Limitations

- **Hand-built bundles.** The apps' `dist/` folders are hand-written to emulate the named frameworks' build
  output; they were not produced by Angular CLI, Vite, Nuxt or the Next.js compiler.
- **Content-only source maps.** Maps carry the original sources (`sourcesContent`) but a single placeholder
  mapping; tools that rely on position mappings get no position information.
- **One shared backend.** All apps use the same REST server, so some paths are shared between apps.
- **Small and synthetic.** 5 apps, 168 endpoints; Angular is represented twice. Results characterise techniques,
  not production prevalence.
- **Single annotator.** The client surface was enumerated by one person reading the served code; inter-annotator
  agreement has not been measured.

---

## Adding test cases

See [docs/ADDING_TEST_CASES.md](docs/ADDING_TEST_CASES.md): change the client in `apps/<app>/`, add the route to the
backend, add the row to `apps/<app>/manifest-partial.json`, then run `scripts/sync_sourcemaps.py`,
`build_manifest.py`, `make_docs.py` and `audit/bench_audit.py all`.

---

## Citation

```bibtex
@article{iyer2026shadowendpoints,
  title   = {Shadow Endpoints: Hybrid Static--Dynamic Discovery of Hidden API Surfaces in Obfuscated Single-Page Applications},
  author  = {Iyer, Gokul and Ghadi, Aditya and More, Aditya and Choutapelly, Parth and Huliyurdurga, Kavya},
  year    = {2026},
  doi     = {10.5281/zenodo.XXXXXXX}
}
```

## License

The README of v2.0 declared the MIT License; a `LICENSE` file still has to be added.
