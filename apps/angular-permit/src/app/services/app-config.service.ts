/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/services/app-config.service.ts
 *
 * BENCHMARK RELEVANCE — DI CHAIN LEVEL 1 of 3
 * ────────────────────────────────────────────────────────────────────────────
 * This is the first link in the 3-file constructor injection chain tested by
 * TC-P2-009 (inter_proc_constructor_multi) and EP-A-002.
 *
 * Chain summary:
 *   environment.ts
 *     └─ AppConfigService.getApiBase()        ← THIS FILE (Level 1)
 *          └─ ApiService.getBase()             (Level 2, api.service.ts)
 *               └─ PermitService.http.get()    (Level 3, permit.service.ts)
 *
 * After minification by Angular CLI / Webpack:
 *   - AppConfigService class → mangled class identifier
 *   - getApiBase() method → property on minified prototype
 *   - this.apiBase private field → renamed to single-char (e.g. `e`)
 *   - environment.apiBaseUrl → inlined string constant OR referenced variable
 *
 * A single-file static analyser (JSLuice) parsing permit.service.ts sees:
 *   this.http.get(this.o.getBase() + "getPermitType")
 * It cannot resolve `this.o` without tracing the ApiService injection into
 * PermitService's constructor, and then tracing ApiService's `getBase()` method
 * back to AppConfigService, and then tracing AppConfigService back to
 * environment.ts. Three separate files, three levels of indirection.
 *
 * This service is intentionally minimal — it exists only to hold the config
 * value and expose it through the DI chain. Real Angular apps often have a
 * much richer AppConfigService that loads remote configuration; here we keep
 * it thin to make the discovery challenge clear.
 */

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  /**
   * The full API base URL, read from environment.ts at service instantiation.
   * In the minified bundle this field is renamed to a single character (e.g. `e`).
   * The Angular DI framework instantiates this service as a singleton — all
   * consumers that inject AppConfigService share the same instance and thus the
   * same `apiBase` value.
   */
  private readonly apiBase: string;

  /**
   * Secondary: staging URL (development only — tree-shaken in production).
   * Recovered by Phase 1.5 source map decompilation of environment.ts.
   * EP-A-005 — staging_server_url (security_relevant: true).
   */
  private readonly stagingBase: string;

  /**
   * OAuth token endpoint (development only — tree-shaken in production).
   * Recovered by Phase 1.5 source map decompilation of environment.ts.
   * EP-A-006 — oauth_token_endpoint (security_relevant: true).
   */
  private readonly oauthEndpoint: string;

  constructor() {
    this.apiBase = environment.apiBaseUrl;
    this.stagingBase = environment.stagingApiUrl || '';
    this.oauthEndpoint = environment.oauthTokenEndpoint || '';
  }

  /**
   * Returns the primary API base URL.
   * Called by ApiService.getBase() in the next DI chain level.
   * Minified name in bundle: varies per build — part of what makes it hard.
   */
  getApiBase(): string {
    return this.apiBase;
  }

  /**
   * Returns the staging API base URL.
   * Only present in development builds — tree-shaken in production.
   * EP-A-005: a tool that recovers this file via source map gets the staging URL.
   */
  getStagingBase(): string {
    return this.stagingBase;
  }

  /**
   * Returns the OAuth token endpoint.
   * Only present in development builds.
   * EP-A-006: auth flow enumeration surface.
   */
  getOAuthEndpoint(): string {
    return this.oauthEndpoint;
  }

  /**
   * Returns the full flag config object.
   * Used by OrderService to resolve the feature-flag ternary (EP-A-008/009).
   */
  getFeatureFlags(): typeof environment.featureFlags {
    return environment.featureFlags;
  }
}
