# SPABench Technique Reference

Two different labels describe each ground-truth endpoint:

* **`discovery_class`** — *derived* by `build_manifest.py` from the served artifacts: the easiest artifact the
  endpoint can be recovered from and whether it is a literal there or must be assembled. This is what per-class
  recall is computed over. See the table at the end of this file.
* **`design_technique`** — the controlled vocabulary below: what a hand-designed **test case** was built to
  exercise. It documents intent; it is not evidence of difficulty (a case designed for source-map recovery may
  also be literal in the bundle — the derived class says so). Surface endpoints that are not test cases may have
  no design technique.

The tables in this file are the vocabulary: `validate_manifest.py` fails if this list and the schema enum differ.
The families below follow the order a tool usually works in (find code → read maps → analyse code → run it →
probe protocols); they are not tied to any one tool's pipeline.

---

## Finding code (HTML, chunks, remotes, workers)

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

## Source maps

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

## Static analysis of the code

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

## Running the app (browser instrumentation)

| Tag | Description |
|---|---|
| `xhr_interception` | XHR request intercepted at browser API level |
| `fetch_interception` | Fetch request intercepted at browser API level |
| `webpack_registry_unnavigated` | Module from `__webpack_modules__` registry, never navigated to |
| `dynamic_button_click` | API call triggered by clicking a button |
| `dynamic_menu_expand` | API call triggered by expanding a menu |
| `dynamic_form_submit` | API call triggered by submitting a form |
| `dynamic_hover` | API call triggered by hovering over an element |
| `lazy_loaded_chunk` | Route chunk fetched on navigation, whose code then has to be analysed |
| `dynamic_worker_blob` | Web Worker created from a Blob URL at runtime |
| `dynamic_worker_fetch` | API call made from inside a Web Worker (not visible in the page's own code) |
| `federation_runtime_manifest` | Module Federation remote resolved at runtime via manifest fetch |
| `websocket_connection_url` | WebSocket URL captured by wrapping `new WebSocket()` constructor |
| `websocket_payload_sample` | WebSocket message payload sampled after connection |
| `soap_bridge_dynamic` | SOAP-bridged legacy endpoint, URL fully runtime-computed |

---

## Protocols and server artefacts

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
| `noise_momentjs` | Moment.js locale paths — should not be reported as endpoints |
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
| `auth_bearer_injection` | Bearer token supplied to the tool and injected into its requests |
| `auth_gated_endpoint` | Endpoint only accessible after successful authentication |

---

## Discovery classes (derived)

| Class | The endpoint… |
|---|---|
| `html_literal` | is written in the served HTML (attribute value, inline script, commented-out tag) |
| `bundle_literal` | has every literal piece of its path inside one string literal of a served JS file (`"/api/users/"+id`) |
| `bundle_composed` | is assembled in served JS from several literals or variables (base URL + name, string arrays, DI chains) |
| `sourcemap_literal` | is literal only in the original sources shipped in a served source map |
| `sourcemap_composed` | is assembled, and only in source-map sources |
| `runtime_data` | needs data fetched at runtime for its last piece (SOAP operations named in a WSDL) |
| `graphql_client_operation` | is a GraphQL operation named in a client query string |
| `graphql_sourcemap_operation` | is a GraphQL operation named only in source-map sources |
| `graphql_introspection_only` | is a GraphQL operation named nowhere in the client — schema introspection only |
| `probe_only` | is referenced by no client code and is found only by probing well-known paths |

Literal presence is detected automatically (each literal run of the path template inside one string literal).
Composition cannot be decided by string matching, so it is recorded by annotation in the partials
(`evidence_hint`) and the build checks that every path segment really occurs in the claimed artifact.
`present_in` lists every artifact with literal or annotated-and-checked evidence, and `exclusive` means that list
has one element.
