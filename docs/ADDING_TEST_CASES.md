# Adding test cases to SPABench

The ground truth is built from the apps, not typed next to them. Adding an endpoint means changing an app so that
its client really calls the endpoint and its server really answers it; the manifest then follows.

## Rules

1. **Nothing served may describe the benchmark.** No `TC-…`/`EP-…` ids, no "this tests …" comments, no
   tool names, no ground-truth hints — not in HTML, bundles, source-map sources, API responses, GraphQL
   descriptions, OpenAPI text or WSDL documentation. Put design notes in the partial's `notes` field instead.
   `audit/bench_audit.py leaks` enforces this.
2. **No auth shortcuts.** Clients get tokens only from the login flow; never plant tokens, roles or passwords in
   pages or bundles.
3. **Everything is reachable.** A new chunk, worker or map must be referenced the way a real build would
   (script tag, `import()`, `new Worker`, build manifest, runtime chunk map, federation remote,
   `sourceMappingURL`). `audit/bench_audit.py reachability` enforces this.
4. **Every ground-truth endpoint is served** by a real route (no catch-alls). `audit/bench_audit.py served`
   enforces this.
5. **Do not hand-write derived fields** (class, evidence, locations, exclusivity, counts). The build computes them.

## Adding an endpoint to an existing app

1. **Client.** Add the call to the app's source in `apps/<app>/src/…` (or the remote's source) *and* to the served
   output in `apps/<app>/dist/…` (`.next/` for nextjs-saas). The served output is hand-built (see README,
   Limitations): write it the way the emulated toolchain would emit it, without comments.
2. **Source maps.** `python scripts/sync_sourcemaps.py` copies the changed sources into every served map that lists
   them. If you added a new source file to a bundle, add it to that map's `sources` first.
3. **Server.** Add the route to the matching file in `api-servers/rest-backend/routes/` (or the GraphQL schema and
   resolvers, the WebSocket server's `ENDPOINT_CHANNELS`, the WSDL). Use `requireAuth` / `requireRole('admin')`
   for protected routes, and return a 2xx for any well-formed request (synthesise records for unknown ids). If
   the app reaches it same-origin, make sure the app's `nginx/*.conf` forwards the path.
4. **Ground truth.** Add a row to `apps/<app>/manifest-partial.json`:

   ```json
   {
     "id": "EP-D-019",
     "method": "GET",
     "url": "http://localhost:3004/api/reports/{reportId}",
     "kind": "rest",
     "test_case": true,
     "reachability": "served",
     "auth_required": true,
     "design_technique": "vue_composition_axios",
     "parameters": [{"name": "reportId", "location": "path", "type": "string", "required": true}],
     "security_finding_type": "none",
     "notes": "Optional: why the case is interesting."
   }
   ```

   * `reachability`: `served` (answered by the benchmark), `external` (a non-routable host such as a staging
     server or private IP, which must be listed in the app's `external_hosts`), or `probe` (served but referenced
     by no client code, like `/actuator/mappings`).
   * If no single string literal contains the path (it is assembled from a base URL and a name, a string array,
     template pieces, …), add `"evidence_hint": {"composed": ["bundle"]}` (and/or `"sourcemap"`); for paths whose
     last piece comes from runtime data, `"evidence_hint": {"runtime": true}`. The build checks every segment is
     present in the artifact you name.
   * `security_finding_type` is one of `staging_server_url`, `oauth_token_endpoint`, `auth_endpoint`,
     `internal_ip_address`, `admin_crud_endpoint`, `management_endpoint_exposure`, `legacy_attack_surface`,
     `graphql_resolver_exposure`, `websocket_realtime_surface`, `none`.
   * New design techniques go into `docs/TECHNIQUE_REFERENCE.md` **and** the `design_technique` enum in
     `manifest.schema.json`.
   * GraphQL operations: `"kind": "graphql"`, `"method": "GRAPHQL"`, URL `…/graphql#operationName` and
     `"graphql": {"operation_type": "query", "operation": "operationName"}`.
5. **Rebuild and check:**

   ```bash
   python build_manifest.py
   python make_docs.py
   python validate_manifest.py
   python audit/bench_audit.py all
   python -m unittest discover -s tests
   docker compose up -d --build && python sanity_check.py
   ```

## Adding a static asset (chunk, remote, worker)

List it under `assets` in the partial (`{"id": "AS-D-002", "url": "...", "design_technique": "..."}`). Assets are
scored separately from endpoints. Make sure it is referenced (rule 3).

## Adding an application

1. `apps/<new-app>/` with `dist/` (served files), `src/`, `nginx/default.conf` (listen 80; forward API paths with
   `proxy_pass $var` and `resolver 127.0.0.11`; static assets `try_files $uri =404`; SPA fallback only on `/`),
   a `Dockerfile` that copies both, and `manifest-partial.json` with an `app` block.
2. Add the service to `docker-compose.yml` (`"<port>:80"`).
3. Register the origin in `spabench/artifacts.py` (`SERVED`) and the nginx conf in `spabench/oracle.py`
   (`NGINX_CONF`); add the app id to `APPS` in `build_manifest.py` and the runners.
4. Run the checks above; `audit/bench_audit.py consistency` verifies compose, Dockerfile and nginx agree with
   `SERVED`.
