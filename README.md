# SPABench v2.0

**A controlled benchmark for SPA API endpoint discovery tools.**

SPABench is the evaluation suite released alongside *"Shadow Endpoints: Hybrid Static–Dynamic Discovery of Hidden API Surfaces in Obfuscated Single-Page Applications"*. It ships 5 Dockerized SPA applications, 4 backend API servers, 108 ground-truth endpoints with technique tags, and a scoring script.

> **Paper:** Shadow Endpoints — Hybrid Static–Dynamic Discovery of Hidden API Surfaces in Obfuscated SPAs  
> **Authors:** Gokul Iyer, Aditya Ghadi, Aditya More, Parth Choutapelly, Kavya Huliyurdurga  
> **DOI:** 10.5281/zenodo.XXXXXXX *(to be assigned)*

---

## What SPABench Is (and Isn't)

SPABench is a **technique characterization benchmark**, not a population-level recall estimate. Each of the 108 manifest endpoints tests exactly one discovery technique. Hitting 108/108 means every listed technique works; it says nothing about what a tool will find on an arbitrary production SPA.

The design answers a precise question: *"Does this tool handle constructor injection chains, source map decompilation, GraphQL introspection?"* — with a deterministic yes/no per technique.

---

## Repository Structure

```
SPA-Bench-main/
├── apps/
│   ├── angular-permit/          # App A — Angular 8, port 3001
│   ├── angular-erp/             # App B — Angular 17 Module Federation, port 3002
│   ├── react-ecommerce/         # App C — React 18 / Vite, port 3003
│   ├── vue-portal/              # App D — Vue 3 / Nuxt, port 3004
│   └── nextjs-saas/             # App E — Next.js / React 19, port 3005
├── api-servers/
│   ├── rest-backend/            # REST API, port 4001
│   ├── graphql-backend/         # GraphQL with introspection enabled, port 4002
│   ├── websocket-backend/       # WebSocket server, port 4003
│   └── soap-bridge/             # SOAP/WSDL bridge, port 4004
├── docs/
│   ├── EVALUATION_GUIDE.md
│   ├── TECHNIQUE_REFERENCE.md
│   └── ADDING_TEST_CASES.md
├── noise/                       # Vendor library noise fixtures (false-positive testing)
├── output/                      # Frozen results and technique breakdowns
├── tools/                       # Scanner dependencies (see .gitignore — not committed)
├── manifest.json                # Ground truth: 108 endpoints across 5 apps
├── manifest.schema.json
├── evaluate.py
├── sanity_check.py
├── validate_manifest.py
├── build_manifest.py
├── run_authenticated_scans.py
├── run_competitor_scans.py
└── docker-compose.yml
```

> **Note:** `tools/go/` and `tools/LinkFinder/` are excluded from the repo via `.gitignore`. Run `python _build_jsluice.py` to compile jsluice locally after cloning.

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.8+

### 1. Start the Benchmark Environment

```bash
git clone https://github.com/Gokul0211/SPA-Bench.git
cd SPA-Bench

docker compose up -d
```

Wait ~15 seconds for the SPAs to initialize, then verify:

```bash
python sanity_check.py --manifest manifest.json
```

All endpoints should report reachable (HTTP 200/401/etc.).

### 2. Run Your Tool

```
App A (Angular 8 Permit):        http://localhost:3001
App B (Angular 17 ERP):          http://localhost:3002
App C (React 18 E-Commerce):     http://localhost:3003
App D (Vue 3 Government Portal): http://localhost:3004
App E (Next.js SaaS Dashboard):  http://localhost:3005
```

### 3. Evaluate

```bash
# All apps
python evaluate.py \
  --manifest manifest.json \
  --tool-output your-results.json \
  --breakdown-by technique \
  --show-missed

# Single app
python evaluate.py \
  --manifest manifest.json \
  --tool-output your-results.json \
  --app angular-permit \
  --breakdown-by technique
```

### 4. Stop

```bash
docker compose down
```

---

## The 108 Ground-Truth Endpoints

### Per-App Summary

| App | Framework | Port | Source Maps | GT Endpoints | Key Techniques |
|-----|-----------|------|-------------|--------------|----------------|
| angular-permit | Angular 8 | 3001 | ✅ Yes | 25 | DI chain, source map recovery, environment.ts, feature-flag conditionals |
| angular-erp | Angular 17 | 3002 | ✅ Yes | 21 | Module Federation remoteEntry, Webpack registry harvest, background sync worker |
| react-ecommerce | React 18/Vite | 3003 | ✅ Yes | 28 | JSX source recovery, fetch interception, Axios wrapper, IndexedDB, recommendation worker |
| vue-portal | Vue 3/Nuxt | 3004 | ❌ Blocked | 25 | SOAP bridge dynamic interception, Vue Composition API, WSDL introspection |
| nextjs-saas | Next.js/React 19 | 3005 | ✅ Yes | 28 | GraphQL introspection (11 ops), WebSocket, React useEffect, TOTP service |
| **Total** | | | | **108** | |

### Endpoint Distribution by Method

| Method | Count | % |
|--------|-------|---|
| GET | 45 | 42% |
| POST | 25 | 23% |
| GraphQL | 12 | 11% |
| DELETE | 11 | 10% |
| PUT | 8 | 7% |
| PATCH | 5 | 5% |
| WebSocket | 2 | 2% |

### Full Endpoint List

**App A — angular-permit (Angular 8, 25 endpoints)**

| ID | Method | URL | Technique |
|----|--------|-----|-----------|
| EP-A-001 | GET | `http://localhost:4001/api/rc_permit/getPermitType` | `url_concat_direct` |
| EP-A-002 | GET | `http://localhost:4001/api/rc_permit/getWorkOrder` | `inter_proc_constructor_multi` |
| EP-A-003 | POST | `http://localhost:4001/api/rc_permit/createPermit` | `param_ts_interface` |
| EP-A-004 | GET | `http://localhost:4001/api/rc_permit/getPermitDetails` | `ts_service_file_recovery` |
| EP-A-005 | GET | `https://staging-api.rc-permit.internal/v2` | `environment_ts_recovery` |
| EP-A-006 | POST | `https://auth.rc-permit.internal/oauth/token` | `environment_ts_recovery` |
| EP-A-007 | GET | `http://localhost:4001/api/admin/legacy-reports` | `url_array_assembly` |
| EP-A-008 | GET | `http://localhost:4001/api/v1/orders` | `url_conditional_feature_flag` |
| EP-A-009 | GET | `http://localhost:4001/api/v2/orders` | `url_conditional_feature_flag` |
| EP-A-010 | POST | `http://localhost:4001/api/auth/login` | `auth_service_recovery` |
| EP-A-011 | DELETE | `http://localhost:4001/api/rc_permit/deletePermit/{id}` | `ts_service_file_recovery` |
| EP-A-012 | PUT | `http://localhost:4001/api/rc_permit/updatePermit/{id}` | `inter_proc_constructor_multi` |
| EP-A-013 | GET | `http://localhost:4001/api/compliance/status` | `ts_service_file_recovery` |
| EP-A-014 | POST | `http://localhost:4001/api/compliance/submit` | `param_ts_interface` |
| EP-A-015 | GET | `http://localhost:4001/api/hazard/assessment/{id}` | `url_concat_direct` |
| EP-A-016 | POST | `http://localhost:4001/api/hazard/report` | `param_ts_interface` |
| EP-A-017 | GET | `http://localhost:4001/api/users/list` | `ts_service_file_recovery` |
| EP-A-018 | PUT | `http://localhost:4001/api/users/{id}/role` | `inter_proc_constructor_multi` |
| EP-A-019 | DELETE | `http://localhost:4001/api/users/{id}` | `auth_service_recovery` |
| EP-A-020 | GET | `http://localhost:4001/api/reports/audit` | `url_array_assembly` |
| EP-A-021 | POST | `http://localhost:4001/api/reports/export` | `param_ts_interface` |
| EP-A-022 | GET | `http://localhost:4001/api/reports/scheduled` | `url_conditional_feature_flag` |
| EP-A-023 | GET | `http://localhost:4001/api/mobile/legacy/sync` | `ts_service_file_recovery` |
| EP-A-024 | POST | `http://localhost:4001/api/mobile/legacy/push` | `url_concat_direct` |
| EP-A-025 | GET | `http://localhost:4001/api/admin/config` | `environment_ts_recovery` |

**App B — angular-erp (Angular 17 Module Federation, 21 endpoints)**

| ID | Method | URL | Technique |
|----|--------|-----|-----------|
| EP-B-001 | GET | `http://localhost:3011/remoteEntry.js` | `module_federation_remote_entry` |
| EP-B-002 | GET | `http://localhost:3012/remoteEntry.js` | `module_federation_remote_entry` |
| EP-B-003 | GET | `http://localhost:3002/api/inventory/items` | `webpack_registry_unnavigated` |
| EP-B-004 | GET | `http://10.0.1.45:8080/internal/api` | `webpack_registry_unnavigated` |
| EP-B-005 | POST | `http://localhost:3002/api/auth/login` | `fetch_interception` |
| EP-B-006 | GET | `http://localhost:3002/actuator/mappings` | `spring_actuator_mappings` |
| EP-B-007 | GET | `http://localhost:3002/api/crm/contacts` | `webpack_registry_unnavigated` |
| EP-B-008 | POST | `http://localhost:3002/api/crm/contacts` | `fetch_interception` |
| EP-B-009 | DELETE | `http://localhost:3002/api/crm/contacts/{id}` | `webpack_registry_unnavigated` |
| EP-B-010 | GET | `http://localhost:3002/api/finance/invoices` | `module_federation_remote_entry` |
| EP-B-011 | POST | `http://localhost:3002/api/finance/invoices` | `fetch_interception` |
| EP-B-012 | GET | `http://localhost:3002/api/hr/employees` | `webpack_registry_unnavigated` |
| EP-B-013 | PUT | `http://localhost:3002/api/hr/employees/{id}` | `fetch_interception` |
| EP-B-014 | GET | `http://localhost:3002/api/analytics/dashboard` | `module_federation_remote_entry` |
| EP-B-015 | GET | `http://localhost:3002/api/orders/list` | `webpack_registry_unnavigated` |
| EP-B-016 | POST | `http://localhost:3002/api/orders/create` | `fetch_interception` |
| EP-B-017 | GET | `http://localhost:3002/api/reports/generate` | `module_federation_remote_entry` |
| EP-B-018 | GET | `http://localhost:3002/api/users/profile` | `webpack_registry_unnavigated` |
| EP-B-019 | PUT | `http://localhost:3002/api/users/profile` | `fetch_interception` |
| EP-B-020 | GET | `http://localhost:3002/api/admin/settings` | `spring_actuator_mappings` |
| EP-B-021 | GET | `http://localhost:3002/ws/background-sync` | `webworker_script_src` |

**App C — react-ecommerce (React 18 / Vite, 28 endpoints)**

| ID | Method | URL | Technique |
|----|--------|-----|-----------|
| EP-C-001 | GET | `http://localhost:3003/api/v2/products/{id}` | `jsx_source_recovery` |
| EP-C-002 | GET | `http://localhost:3003/api/v2/products/list` | `fetch_interception` |
| EP-C-003 | POST | `http://localhost:3003/checkout/process` | `axios_wrapper` |
| EP-C-004 | GET | `http://localhost:3003/api/v2/products/list` | `indexeddb_api_cache` |
| EP-C-005 | POST | `http://localhost:3003/api/v2/products` | `jsx_source_recovery` |
| EP-C-006 | PUT | `http://localhost:3003/api/v2/products/{id}` | `axios_wrapper` |
| EP-C-007 | DELETE | `http://localhost:3003/api/v2/products/{id}` | `fetch_interception` |
| EP-C-008 | GET | `http://localhost:3003/api/v2/cart` | `jsx_source_recovery` |
| EP-C-009 | POST | `http://localhost:3003/api/v2/cart/add` | `axios_wrapper` |
| EP-C-010 | DELETE | `http://localhost:3003/api/v2/cart/{itemId}` | `fetch_interception` |
| EP-C-011 | GET | `http://localhost:3003/api/v2/orders` | `jsx_source_recovery` |
| EP-C-012 | POST | `http://localhost:3003/api/v2/orders` | `axios_wrapper` |
| EP-C-013 | GET | `http://localhost:3003/api/v2/orders/{id}` | `indexeddb_api_cache` |
| EP-C-014 | PATCH | `http://localhost:3003/api/v2/orders/{id}/status` | `fetch_interception` |
| EP-C-015 | GET | `http://localhost:3003/api/v2/users/profile` | `jsx_source_recovery` |
| EP-C-016 | PUT | `http://localhost:3003/api/v2/users/profile` | `axios_wrapper` |
| EP-C-017 | POST | `http://localhost:3003/api/v2/auth/login` | `fetch_interception` |
| EP-C-018 | POST | `http://localhost:3003/api/v2/auth/logout` | `axios_wrapper` |
| EP-C-019 | GET | `http://localhost:3003/api/v2/recommendations` | `webworker_script_src` |
| EP-C-020 | POST | `http://localhost:3003/api/v2/recommendations/feedback` | `webworker_script_src` |
| EP-C-021 | GET | `http://localhost:3003/api/v2/search` | `jsx_source_recovery` |
| EP-C-022 | GET | `http://localhost:3003/api/v2/categories` | `fetch_interception` |
| EP-C-023 | GET | `http://localhost:3003/api/v2/reviews/{productId}` | `indexeddb_api_cache` |
| EP-C-024 | POST | `http://localhost:3003/api/v2/reviews` | `axios_wrapper` |
| EP-C-025 | GET | `http://localhost:3003/api/v2/wishlist` | `jsx_source_recovery` |
| EP-C-026 | POST | `http://localhost:3003/api/v2/wishlist/add` | `fetch_interception` |
| EP-C-027 | DELETE | `http://localhost:3003/api/v2/wishlist/{id}` | `axios_wrapper` |
| EP-C-028 | POST | `http://localhost:3003/checkout/validate-coupon` | `jsx_source_recovery` |

**App D — vue-portal (Vue 3 / Nuxt — no source maps, 25 endpoints)**

| ID | Method | URL | Technique |
|----|--------|-----|-----------|
| EP-D-001 | GET | `http://localhost:3004/api/users/{id}` | `vue_composition_axios` |
| EP-D-002 | POST | `http://localhost:3004/api/legacy/bridge/getEmployeeRecord` | `soap_bridge_dynamic` |
| EP-D-003 | POST | `http://localhost:3004/api/legacy/bridge/updatePayroll` | `soap_bridge_dynamic` |
| EP-D-004 | POST | `http://localhost:3004/api/legacy/bridge/generateReport` | `soap_bridge_dynamic` |
| EP-D-005 | GET | `http://localhost:3004/api/users/list` | `vue_composition_axios` |
| EP-D-006 | PUT | `http://localhost:3004/api/users/{id}` | `vue_composition_axios` |
| EP-D-007 | DELETE | `http://localhost:3004/api/users/{id}` | `vue_composition_axios` |
| EP-D-008 | GET | `http://localhost:3004/api/portal/announcements` | `vue_composition_axios` |
| EP-D-009 | POST | `http://localhost:3004/api/portal/announcements` | `vue_composition_axios` |
| EP-D-010 | GET | `http://localhost:3004/api/portal/documents` | `vue_composition_axios` |
| EP-D-011 | POST | `http://localhost:3004/api/portal/documents/upload` | `vue_composition_axios` |
| EP-D-012 | DELETE | `http://localhost:3004/api/portal/documents/{id}` | `vue_composition_axios` |
| EP-D-013 | POST | `http://localhost:3004/api/legacy/bridge/getPayslip` | `soap_bridge_dynamic` |
| EP-D-014 | POST | `http://localhost:3004/api/legacy/bridge/submitLeaveRequest` | `soap_bridge_dynamic` |
| EP-D-015 | GET | `http://localhost:3004/wsdl/legacy-service.wsdl` | `wsdl_introspection` |
| EP-D-016 | GET | `http://localhost:3004/api/services/directory` | `vue_composition_axios` |
| EP-D-017 | GET | `http://localhost:3004/api/services/{id}` | `vue_composition_axios` |
| EP-D-018 | POST | `http://localhost:3004/api/auth/login` | `vue_composition_axios` |
| EP-D-019 | GET | `http://localhost:3004/api/dashboard/stats` | `vue_composition_axios` |
| EP-D-020 | GET | `http://localhost:3004/api/notifications` | `vue_composition_axios` |
| EP-D-021 | PATCH | `http://localhost:3004/api/notifications/{id}/read` | `vue_composition_axios` |
| EP-D-022 | GET | `http://localhost:3004/api/profile` | `vue_composition_axios` |
| EP-D-023 | PUT | `http://localhost:3004/api/profile` | `vue_composition_axios` |
| EP-D-024 | POST | `http://localhost:3004/api/legacy/bridge/getDepartmentBudget` | `soap_bridge_dynamic` |
| EP-D-025 | DELETE | `http://localhost:3004/api/portal/announcements/{id}` | `vue_composition_axios` |

**App E — nextjs-saas (Next.js / React 19, 28 endpoints)**

| ID | Method | Resolver / URL | Technique |
|----|--------|----------------|-----------|
| EP-E-001 | GRAPHQL | `http://localhost:3005/api/graphql` | `graphql_endpoint_heuristic` |
| EP-E-GQL-001 | GRAPHQL | `Query.getUser` | `graphql_query_resolver` |
| EP-E-GQL-002 | GRAPHQL | `Query.listOrders` | `graphql_query_resolver` |
| EP-E-GQL-003 | GRAPHQL | `Query.getProduct` | `graphql_query_resolver` |
| EP-E-GQL-004 | GRAPHQL | `Query.searchProducts` | `graphql_query_resolver` |
| EP-E-GQL-005 | GRAPHQL | `Query.getDashboardMetrics` | `graphql_query_resolver` |
| EP-E-GQL-006 | GRAPHQL | `Query.getAuditLog` | `graphql_query_resolver` |
| EP-E-GQL-007 | GRAPHQL | `Query.listTeamMembers` | `graphql_query_resolver` |
| EP-E-GQL-008 | GRAPHQL | `Query.getBillingInfo` | `graphql_query_resolver` |
| EP-E-GQL-009 | GRAPHQL | `Mutation.createUser` | `graphql_mutation_resolver` |
| EP-E-GQL-010 | GRAPHQL | `Mutation.updateOrder` | `graphql_mutation_resolver` |
| EP-E-GQL-011 | GRAPHQL | `Mutation.deleteProduct` | `graphql_mutation_resolver` |
| EP-E-018 | WS | `wss://localhost:3005/ws/notifications` | `websocket_connection_url` |
| EP-E-019 | WS | `wss://localhost:3005/ws/live-dashboard` | `websocket_static` |
| EP-E-020 | GET | `http://localhost:3005/api/dashboard/metrics` | `react_useeffect_fetch` |
| EP-E-021 | GET | `http://localhost:3005/api/auth/session` | `react_useeffect_fetch` |
| EP-E-022 | POST | `http://localhost:3005/api/auth/login` | `react_useeffect_fetch` |
| EP-E-023 | POST | `http://localhost:3005/api/auth/logout` | `react_useeffect_fetch` |
| EP-E-024 | GET | `http://localhost:3005/api/users` | `react_useeffect_fetch` |
| EP-E-025 | GET | `http://localhost:3005/api/users/{id}` | `react_useeffect_fetch` |
| EP-E-026 | GET | `http://localhost:3005/api/billing/plans` | `react_useeffect_fetch` |
| EP-E-027 | POST | `http://localhost:3005/api/billing/subscribe` | `react_useeffect_fetch` |
| EP-E-028 | GET | `http://localhost:3005/api/team/members` | `react_useeffect_fetch` |
| EP-E-029 | POST | `http://localhost:3005/api/team/invite` | `react_useeffect_fetch` |
| EP-E-030 | GET | `http://localhost:3005/api/settings` | `react_useeffect_fetch` |
| EP-E-031 | PUT | `http://localhost:3005/api/settings` | `react_useeffect_fetch` |
| EP-E-032 | GET | `http://localhost:3005/api/totp/setup` | `ts_service_file_recovery` |
| EP-E-033 | POST | `http://localhost:3005/api/totp/verify` | `ts_service_file_recovery` |

---

## Backend API Servers

| Server | Port | Protocol | Purpose |
|--------|------|----------|---------|
| rest-backend | 4001 | REST/HTTP | Serves REST endpoints for Apps A–E; OpenAPI spec at `/openapi.json` |
| graphql-backend | 4002 | GraphQL | Full schema with introspection enabled |
| websocket-backend | 4003 | WebSocket | Real-time endpoint for App E |
| soap-bridge | 4004 | SOAP/WSDL | Legacy service bridge for App D; WSDL at `/wsdl/legacy-service.wsdl` |

---

## evaluate.py — Scoring

`evaluate.py` scores your tool's output against the manifest. It normalizes URLs (trailing slashes, scheme casing, query parameter ordering, numeric path segments as wildcards) and supports native output formats from major tools via `--format`.

**Note on GraphQL scoring:** GraphQL operations all share the `/api/graphql` URL. The evaluator matches by `operation_name` field, not URL alone. Tools must emit operation names in their output to score individual resolvers.

### Supported Input Formats

| Tool | `--format` value | Input format |
|------|-----------------|--------------|
| SPABench native | `spabench-v1` | JSON `{ "endpoints": [...] }` |
| LinkFinder | `linkfinder` | One URL/path per line |
| xnLinkFinder | `xnlinkfinder` | JSON array or `{ "results": [...] }` |
| JSLuice | `jsluice` | JSON array of `{ "kind": "URL", "value": "..." }` |
| Katana | `katana` | JSONL, one `{ "request": { "endpoint": "..." } }` per line |

### Key Options

```
--manifest          Path to manifest.json (required)
--tool-output       Path to your tool's output file (required)
--format            Input format adapter (default: spabench-v1)
--app               Filter to a single app (e.g. angular-permit)
--breakdown-by      Per-technique or per-phase stats (technique | phase)
--show-missed       List ground-truth endpoints the tool missed
--compare           Compare two tool outputs side-by-side
--report            Write an HTML comparison report to a file
--threshold         Minimum confidence score to include
```

### SPABench Native Output Format

```json
{
  "tool": "YourToolName",
  "version": "1.0.0",
  "target": "http://localhost:3001",
  "endpoints": [
    {
      "url": "http://localhost:4001/api/rc_permit/getPermitType",
      "method": "GET",
      "confidence": 91,
      "source": "static_analysis"
    }
  ]
}
```

Only `url` is required per endpoint; `method`, `confidence`, and `source` are optional.

---

## Technique Tags

All technique tags follow the controlled vocabulary in [`docs/TECHNIQUE_REFERENCE.md`](docs/TECHNIQUE_REFERENCE.md), organized by discovery phase:

- **Phase 1** — Federation & JS bundle discovery (script tags, preloads, Module Federation, WebWorkers)
- **Phase 1.5** — Source map intelligence (service file recovery, `environment.ts`, JSX maps, auth services)
- **Phase 2** — Static AST & variable resolution (URL construction patterns, inter-procedural chains, HTTP client patterns, parameter mining)
- **Phase 3** — Dynamic browser instrumentation (XHR/fetch interception, Webpack registry, WebSocket, IndexedDB)
- **Phase 4** — Protocol expansion (GraphQL introspection, Spring Actuator, WSDL/SOAP, OpenAPI probing)

Each manifest entry gets exactly one technique tag — the minimum capability needed to find that endpoint.

---

## Baseline Results (v2.0 — June 2026)

Results on SPABench v2.0 (108 endpoints, scope-filtered):

| Tool | Recall | Precision | F1 | Notes |
|------|--------|-----------|-----|-------|
| **Shadow Endpoints** | **77.3% avg** | **29.6% avg** | **42.8% avg** | See per-app breakdown below |
| Katana | ~10% | ~38% | — | Crawl-only; auth-blocked on Apps A, D |
| JSLuice | ~4% | ~93% | — | String literal URLs only |
| xnLinkFinder | ~0% | ~3% | — | Fragment-only, no base resolution |
| LinkFinder | ~0% | ~2% | — | Vendor noise dominates |

**Shadow Endpoints per-app (v2.0):**

| App | Recall | Precision | F1 | Notes |
|-----|--------|-----------|-----|-------|
| A (angular-permit) | 77.3% | 21.2% | 33.3% | |
| B (angular-erp) | 65.0% | 25.0% | 36.1% | |
| C (react-ecommerce) | 90.0% | 42.9% | 58.1% | |
| D (vue-portal) | 100.0%* | 40.0% | 57.1% | *evaluate.py wildcard bug — actual TP count under review |
| E (nextjs-saas) | 64.3% | 19.1% | 29.5% | GQL op-level matching not yet implemented |

**Known evaluation gaps in v2.0:**
- App D TP/FN contradiction from `{param}` wildcard matching on same-base-path/different-method endpoints — fix in progress
- App E precision suppressed because 11 GraphQL operations share `/api/graphql`; evaluate.py scores them by URL, not operation name
- Verb-variant gap across all apps: scanner finds GET but misses POST/PUT/PATCH/DELETE on the same path

Frozen results and full technique breakdowns are in `output/_FROZEN_RESULTS_20260628.txt` and `output/_TECHNIQUE_BREAKDOWN_20260628.txt`.

---

## Running Against a Single App

```bash
# App A only
python evaluate.py \
  --manifest manifest.json \
  --tool-output results.json \
  --app angular-permit \
  --breakdown-by technique \
  --show-missed

# Compare two tools on App E (GraphQL focus)
python evaluate.py \
  --manifest manifest.json \
  --compare tool-a.json tool-b.json \
  --app nextjs-saas \
  --report comparison.html
```

---

## Authenticated Scans

Some endpoints require auth. Use `run_authenticated_scans.py` for auth-gated paths:

```bash
# Apps A and D use form auth (JWT via port 4001)
# Credentials: benchadmin / benchpass

python run_authenticated_scans.py \
  --app angular-permit \
  --username benchadmin \
  --password benchpass

# Apps B, C, E use bearer token auth
python run_authenticated_scans.py \
  --app nextjs-saas \
  --bearer <token>
```

---

## Verifying the Environment

```bash
python sanity_check.py --manifest manifest.json
# Verbose, single app:
python sanity_check.py --manifest manifest.json --app angular-permit --verbose
```

Exit 0 = all reachable. Exit 1 = something is down — check `docker compose ps`.

---

## Known Limitations

**SPABench is small by design.** 108 endpoints across 5 apps covers all technique classes in the paper. It is not a random sample of production SPAs, and recall here does not predict recall in the wild.

**GraphQL concentration.** 12 of 108 endpoints (11%) are GraphQL operations on nextjs-saas. A tool with broken introspection misses all of them. The test is effectively binary — introspection returns the schema or it doesn't.

**Angular overrepresentation.** Apps A and B are both Angular. React (App C), Vue (App D), and Next.js (App E) balance this, but the benchmark does not weight frameworks proportionally to their production prevalence.

**No adversarial cases.** Obfuscation is limited to standard minification and variable renaming. No CSP blocks, no anti-debug, no stripped source maps on apps that serve them. Adversarial variants are planned.

**Verb-variant gap.** The scanner frequently finds GET but misses other methods on the same path. This is a known open problem — see issue tracker.

---

## Adding New Test Cases

See [`docs/ADDING_TEST_CASES.md`](docs/ADDING_TEST_CASES.md). Short version:

1. Add the endpoint to `apps/<app>/manifest-partial.json`
2. Implement it in the corresponding backend server
3. Add the technique tag to `docs/TECHNIQUE_REFERENCE.md` if new
4. `python build_manifest.py` to regenerate `manifest.json`
5. `python validate_manifest.py` to check schema
6. `python sanity_check.py` to confirm reachability

Constraint: every new entry must test a technique not already covered, and must be exclusively discoverable via that technique.

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

---

## License

SPABench benchmark applications, API servers, manifest, and evaluation scripts are released under the MIT License. See `LICENSE` for details.
