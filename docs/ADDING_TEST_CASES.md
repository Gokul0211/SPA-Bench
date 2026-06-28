# Adding Test Cases to SPABench

Step-by-step guide for contributors adding new endpoints, techniques, or applications.

---

## Adding a Single Endpoint

### 1. Add to the application source

Add the endpoint pattern to the relevant app's source file. For example, to add a new
Vue Composition API endpoint to App D:

```typescript
// apps/vue-portal/src/composables/useReport.ts
export function useReport(reportId: string) {
  return useAsyncData(`report-${reportId}`, async () => {
    const response = await axios.get(`${API_BASE}/api/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${useCookie('bench_session').value}` },
    });
    return response.data;
  });
}
```

### 2. Add to the minified dist file

The endpoint must also appear in the compiled output (`dist/`) at the correct location
so tools can discover it. Update the relevant `dist/**/*.js` file to include the URL
at a known column position, and update (or add) the corresponding `.js.map` to embed
the TypeScript source.

### 3. Add to `manifest-partial.json`

Add an entry to `apps/<app-name>/manifest-partial.json`:

```json
{
  "id": "EP-D-005",
  "method": "GET",
  "url": "http://localhost:3004/api/reports/{id}",
  "phase": "2",
  "technique": "vue_composition_axios",
  "exclusive": false,
  "auth_method": "form",
  "auth_required": true,
  "security_finding_type": "none",
  "source_file": "src/composables/useReport.ts",
  "minified_location": "_nuxt/entry.js:1:XXXXX",
  "parameters": [
    { "name": "id", "location": "path", "type": "string", "required": true }
  ],
  "discovery_notes": "Vue 3 Composition API useAsyncData + axios.get pattern. URL uses template literal with path parameter."
}
```

### 4. Rebuild the manifest

```bash
python build_manifest.py
```

### 5. Validate

```bash
python validate_manifest.py --manifest manifest.json --verbose
```

### 6. Verify reachability

```bash
docker compose up -d
python sanity_check.py --manifest manifest.json --app vue-portal
```

### 7. Submit a pull request

Include all three changed files: the source file, the dist file, and `manifest-partial.json`.

---

## Mandatory Fields

Every endpoint entry in `manifest-partial.json` must include:

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Format: `EP-{APP}-{N}`. Never reused after retirement. |
| `method` | Yes | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `WS`, `GRAPHQL` |
| `url` | Yes | Full URL. Path params as `{paramName}`. |
| `phase` | Yes | `"1"`, `"1.5"`, `"2"`, `"3"`, or `"4"` |
| `technique` | Yes | Must be in controlled vocabulary (`docs/TECHNIQUE_REFERENCE.md`) |
| `exclusive` | Yes | `true` if only discoverable via the specified technique |
| `auth_method` | Yes | `"none"`, `"bearer"`, `"form"`, or `"totp"` |
| `auth_required` | Yes | `true` if endpoint returns 401 without auth |
| `security_finding_type` | Yes | Use `"none"` if not security-relevant |
| `parameters` | Yes | Empty array `[]` if no parameters |
| `discovery_notes` | Yes | Must be non-empty. Explains why the technique is required. |

---

## Exclusive vs Non-Exclusive

Set `exclusive: true` when the endpoint is **only** discoverable via the specified technique
and cannot be found any other way:

```
exclusive: true  examples:
  - SOAP bridge URL (runtime-computed from WSDL — no static string)
  - GraphQL mutation resolver (only via introspection)
  - Webpack unnavigated module (only via __webpack_modules__ harvest)
  - Spring Actuator endpoint (only by probing /actuator/mappings)

exclusive: false examples:
  - Login endpoint (interceptable at network layer AND in source map)
  - Product list endpoint (found via useEffect AND via fetch interception)
  - WebSocket static URL (in source map AND as string literal AND interceptable)
```

When `exclusive: false`, list additional discovery methods in `redundant_techniques`:

```json
"exclusive": false,
"redundant_techniques": ["fetch_interception", "ts_service_file_recovery"]
```

---

## Adding a New Technique Tag

If your endpoint requires a discovery technique not already in the vocabulary:

1. **Add to `docs/TECHNIQUE_REFERENCE.md`** — include tag name, phase, description, and an example.

2. **Add to the enum in `manifest.schema.json`** — add the tag string to the `technique` enum list.

3. **Add to `validate_manifest.py`** — add to both `VALID_TECHNIQUES` and `PHASE_TECHNIQUE_MAP`:

```python
VALID_TECHNIQUES = {
    # ... existing tags ...
    'your_new_technique',        # <- add here
}

PHASE_TECHNIQUE_MAP = {
    '2': {'url_concat_direct', 'url_template_literal', ..., 'your_new_technique'},
}
```

4. Submit all three files in the same PR. The validator enforces that every `technique` tag
in the manifest appears in the controlled vocabulary — a manifest referencing an unknown
tag will fail validation.

---

## Adding a New Noise Pattern

To add a new vendor library as a noise source:

1. Add the library's characteristic path patterns to `noise/manifest-noise.json`:

```json
{
  "id": "TC-NOISE-009",
  "tag": "noise_lodash",
  "detection_method": "path_indicator",
  "indicators": ["node_modules/lodash", "node_modules/lodash-es"],
  "example_fps": [
    "node_modules/lodash/chunk.js",
    "node_modules/lodash-es/lodash.js"
  ]
}
```

2. Add representative noise strings to `noise/vendor.js` so they appear in the
simulated vendor bundle.

---

## Adding a New Benchmark Application

Adding a full application requires several steps. Before starting, verify that the new app
tests at least one technique not already covered, or tests an existing technique in a
meaningfully different framework context.

### Required files

```
apps/<new-app>/
  src/              # TypeScript/JSX source files
  dist/             # Pre-built output (index.html, *.js, *.js.map)
  manifest-partial.json
  Dockerfile
```

### Dockerfile conventions

All app containers:
- Use `nginx:1.25-alpine` as base
- Serve on a unique port (add to `docker-compose.yml`)
- Expose `GET /health` returning `{"status":"ok","app":"<id>","port":<port>}`
- Include `HEALTHCHECK` directive

### docker-compose.yml

Add a service entry following the existing pattern:

```yaml
your-new-app:
  build:
    context: ./apps/your-new-app
    dockerfile: Dockerfile
  container_name: spabench-your-new-app
  networks: [spabench]
  ports:
    - "30XX:30XX"
  environment:
    <<: *common-env
    PORT: 30XX
    API_BASE_URL: http://rest-backend:4001
  depends_on:
    rest-backend:
      condition: service_healthy
```

---

## Versioning Policy

- **Major version bump**: Incompatible manifest schema change (new required field, removed field)
- **Minor version bump**: New endpoint, application, or technique tag added
- **Patch version bump**: Bug fix, endpoint URL correction, documentation update

Endpoint IDs are **permanently stable** — once assigned, an ID is never changed and never
reused after the endpoint is retired. Retired endpoints are marked `"retired": true`
but remain in the manifest for historical scoring continuity.

---

## Validation Checklist

Before submitting a PR, run:

```bash
# 1. Schema + semantic validation
python validate_manifest.py --manifest manifest.json --verbose

# 2. Rebuild manifest from partials
python build_manifest.py

# 3. Reachability check
docker compose up -d
python sanity_check.py --manifest manifest.json

# 4. Regression check — existing tool baselines should not degrade
python evaluate.py --manifest manifest.json --tool-output baselines/katana.json --breakdown-by technique
```

All four checks must pass before merging.
