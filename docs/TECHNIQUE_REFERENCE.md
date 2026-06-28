# SPABench Technique Reference

Controlled vocabulary of all `technique` tag values used in the manifest.
All new technique tags must be added here before use.

---

## Phase 1 — Federation Discovery

| Tag | Description |
|---|---|
| `script_tag_standard` | Standard `<script src="...">` tag |
| `html_attr_onclick` | JS file path in HTML `onclick` attribute |
| `html_attr_ng_include` | Angular `ng-include` directive pointing to a JS file |
| `html_attr_formaction` | `formaction` attribute containing a path |
| `link_preload` | `<link rel="preload" as="script">` tag |
| `link_modulepreload` | `<link rel="modulepreload">` tag |
| `dynamic_import_inline` | `import('/path/to/chunk.js')` in inline `<script>` |
| `web_worker_constructor` | `new Worker('/path/to/worker.js')` call |
| `noscript_tag` | `<script>` inside `<noscript>` |
| `commented_script` | `<!-- <script src="..."> -->` commented-out element |
| `module_federation_remote_entry` | Webpack Module Federation `remoteEntry.js` URL |
| `module_federation_html_parse` | HTML parsed after discovering a federation remote |

---

## Phase 1.5 — Source Map Intelligence

| Tag | Description |
|---|---|
| `sourcemap_probe_standard` | Probing `<bundle>.js.map` path |
| `sourcemap_url_directive` | Parsing `//# sourceMappingURL=` directive |
| `ts_service_file_recovery` | Endpoint recovered from a decompiled `.service.ts` file |
| `environment_ts_recovery` | URL found in recovered `environment.ts` config |
| `jsx_source_recovery` | Endpoint recovered from a decompiled `.tsx` / `.jsx` file |
| `sourcemap_restricted` | Source map probed but returned 404 — graceful degradation test |
| `backend_sourcemap_recovery` | Server-side source map decompilation (`dist/server.js.map`) |
| `auth_service_recovery` | Endpoint recovered from decompiled `auth.service.ts` |

---

## Phase 2 — Static AST and Variable Resolution

### URL Construction Patterns
| Tag | Description |
|---|---|
| `url_concat_direct` | Direct string concatenation: `this.base + "path"` |
| `url_template_literal` | Template literal: `` `${this.base}/path/${id}` `` |
| `url_variable_based` | URL assembled via intermediate variable |
| `url_object_property_chain` | Property chain 3+ levels deep: `env.config.api.base` |
| `url_service_method_delegation` | URL returned by a method call |
| `url_array_assembly` | URL fragments stored in an indexed string array (obfuscation) |
| `url_conditional_feature_flag` | Ternary / conditional URL construction (both branches) |

### Inter-Procedural Resolution
| Tag | Description |
|---|---|
| `inter_proc_constructor_single` | Constructor injection, single level |
| `inter_proc_constructor_multi` | Constructor injection, 3+ files / levels |
| `inter_proc_factory_return` | Base URL returned by a factory function |
| `obfuscated_string_array` | Rotation-shifted string array decoder |
| `inter_proc_cycle_detection` | Circular dependency — tests that tool does not hang |
| `inter_proc_constructor_injection` | Generic constructor injection (use specific tags above when possible) |

### HTTP Client Patterns
| Tag | Description |
|---|---|
| `httpclient_get` | Angular HttpClient `.get()` |
| `httpclient_post` | Angular HttpClient `.post()` |
| `httpclient_put` | Angular HttpClient `.put()` |
| `httpclient_patch` | Angular HttpClient `.patch()` |
| `httpclient_delete` | Angular HttpClient `.delete()` |
| `httpclient_request_generic` | Angular HttpClient `.request('METHOD', url)` |
| `fetch_api_native` | Native `fetch()` call |
| `axios_wrapper` | Axios `.get()`, `.post()`, etc. or custom Axios instance |
| `vue_composition_axios` | Vue 3 `useAsyncData` + Axios pattern |
| `react_useeffect_fetch` | React `useEffect` + `fetch()` pattern |

### Parameter Mining
| Tag | Description |
|---|---|
| `param_ts_interface` | Parameters from TypeScript interface definition |
| `param_generic_type_annotation` | Parameters from generic type annotation on HTTP call |
| `param_httpparams_chain` | Angular `HttpParams` builder chain |
| `param_urlsearchparams` | `URLSearchParams` constructor arguments |
| `param_formgroup` | Angular `FormGroup` field definitions |
| `param_backward_taint` | Backward taint from call site to nearby object literal |

### WebSocket (static)
| Tag | Description |
|---|---|
| `websocket_static` | WebSocket URL hardcoded as string constant in bundle |

---

## Phase 3 — Dynamic Browser Instrumentation

| Tag | Description |
|---|---|
| `xhr_interception` | XHR request intercepted at browser API level |
| `fetch_interception` | Fetch request intercepted at browser API level |
| `webpack_registry_unnavigated` | Module from `__webpack_modules__` registry, never navigated to |
| `dynamic_button_click` | API call triggered by clicking a button |
| `dynamic_menu_expand` | API call triggered by expanding a menu |
| `dynamic_form_submit` | API call triggered by submitting a form |
| `dynamic_hover` | API call triggered by hovering over an element |
| `lazy_loaded_chunk` | Route chunk fetched on navigation → feeds Phase 2 feedback loop |
| `dynamic_worker_blob` | Web Worker created from a Blob URL at runtime |
| `federation_runtime_manifest` | Module Federation remote resolved at runtime via manifest fetch |
| `websocket_connection_url` | WebSocket URL captured by wrapping `new WebSocket()` constructor |
| `websocket_payload_sample` | WebSocket message payload sampled after connection |
| `soap_bridge_dynamic` | SOAP-bridged legacy endpoint, URL fully runtime-computed |

---

## Phase 4 — Protocol Expansion

### GraphQL
| Tag | Description |
|---|---|
| `graphql_endpoint_heuristic` | GraphQL endpoint found via path probe (`/graphql`, `/gql`) |
| `graphql_introspection` | Introspection query executed |
| `graphql_query_resolver` | Query resolver enumerated from schema |
| `graphql_mutation_resolver` | Mutation resolver enumerated from schema |
| `graphql_subscription_resolver` | Subscription resolver enumerated from schema |
| `graphql_introspection_disabled` | Introspection returns 400 — graceful degradation test |

### OpenAPI
| Tag | Description |
|---|---|
| `openapi_discovery` | OpenAPI/Swagger spec found via common path probe |
| `openapi_path_enumeration` | API paths extracted from parsed OpenAPI spec |

### Backend Artifacts
| Tag | Description |
|---|---|
| `spring_actuator_mappings` | Routes from Spring Boot `/actuator/mappings` |
| `backend_sourcemap_server_routes` | Server-side Express routes from `dist/server.js.map` |

### IndexedDB
| Tag | Description |
|---|---|
| `indexeddb_api_cache` | API response URL found in IndexedDB cache |
| `indexeddb_config` | API base URL found in IndexedDB config store |
| `indexeddb_session` | Internal URL found in IndexedDB session data |

---

## Vendor Noise (False Positive Validation)

| Tag | Description |
|---|---|
| `noise_momentjs` | Moment.js locale paths — should NOT be reported as endpoints |
| `noise_exceljs` | ExcelJS XML module paths |
| `noise_angular_compiler` | Angular compiler internal artifacts |
| `noise_pdfjs` | PDF.js specification keywords |
| `noise_nodejs_streams` | Browserified Node.js stream module paths |
| `noise_template_literal_artifacts` | Bundler-generated template literal path artifacts |
| `noise_react_component_names` | React component names that match URL patterns |
| `noise_router_navigation` | Client-side router navigation calls |

---

## Authentication

| Tag | Description |
|---|---|
| `auth_form_login` | Standard HTML form POST login |
| `auth_browser_driven` | JavaScript-heavy login requiring Playwright navigation |
| `auth_totp_mfa` | TOTP two-factor authentication flow |
| `auth_bearer_injection` | Pre-generated Bearer token injected into request headers |
| `auth_gated_endpoint` | Endpoint only accessible after successful authentication |
