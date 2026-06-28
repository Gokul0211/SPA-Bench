/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/environments/environment.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * This file is recovered by Phase 1.5 source map decompilation (TC-P1.5-004).
 * It is never referenced as a string in the minified bundle — only the compiled
 * output survives. A tool that reads the source map and decompiles this file
 * recovers three security-relevant URLs that are invisible to static AST tools:
 *
 *   apiUrl            → flows into AppConfigService → ApiService → PermitService
 *                        Minified as `this.o` in bundle.js. Required for EP-A-001
 *                        through EP-A-004. The base URL resolves to:
 *                        http://localhost:4001/api/rc_permit/
 *
 *   stagingApiUrl     → EP-A-005 (security_relevant: true)
 *                        technique: environment_ts_recovery
 *                        Phase 1.5 exclusive. Direct access to pre-production API.
 *                        Never referenced in the minified bundle — only in this file.
 *
 *   oauthTokenEndpoint → EP-A-006 (security_relevant: true)
 *                        technique: environment_ts_recovery
 *                        Phase 1.5 exclusive. Auth flow enumeration surface.
 *                        AuthService calls this URL for token refresh.
 *
 *   internalServiceUrl → security-relevant internal IP — not in starter manifest
 *                        but present for comprehensive noise/IP extraction testing.
 *
 * The path separator in apiBaseUrl (/api/rc_permit/) is intentional — it matches
 * the route registrations in rest-backend/routes/app-a.js exactly. AppConfigService
 * returns this full base so PermitService only needs to append the method name.
 */

export const environment = {
  production: false,

  /**
   * Primary REST API base — passed through the 3-level DI chain.
   * AppConfigService reads this → ApiService injects AppConfigService →
   * PermitService injects ApiService. Minified as `this.o` in bundle.js:1:91032.
   *
   * EP-A-001 final URL: http://localhost:4001/api/rc_permit/getPermitType
   * EP-A-002 final URL: http://localhost:4001/api/rc_permit/getWorkOrder
   * EP-A-003 final URL: http://localhost:4001/api/rc_permit/createPermit
   * EP-A-004 final URL: http://localhost:4001/api/rc_permit/getPermitDetails
   */
  apiBaseUrl: 'http://localhost:4001/api/rc_permit/',

  /**
   * EP-A-005 — staging_server_url (security_relevant: true)
   * Phase 1.5 exclusive — only recoverable via environment_ts_recovery.
   * Represents direct access to pre-production APIs from a publicly-served app.
   * This URL never appears in the production bundle — it is tree-shaken out
   * when environment.prod.ts is substituted at build time.
   */
  stagingApiUrl: 'https://staging-api.rc-permit.internal/v2',

  /**
   * EP-A-006 — oauth_token_endpoint (security_relevant: true)
   * Phase 1.5 exclusive — only recoverable via environment_ts_recovery.
   * Used by AuthService.refreshToken() to obtain a new access token.
   * Exposes the internal OAuth provider's token endpoint.
   */
  oauthTokenEndpoint: 'https://auth.rc-permit.internal/oauth/token',

  /**
   * Internal service URL — used by AdminService for legacy system calls.
   * security_relevant: true (internal_ip_address category).
   * Phase 1.5 recoverable and also Phase 3 via Webpack module harvest.
   */
  internalServiceUrl: 'http://10.0.0.45:8080/internal',

  /**
   * Feature flags — control which API version is used for order endpoints.
   * EP-A-008 and EP-A-009 are both branches of the useV2Orders ternary.
   * Both URLs must appear in tool output — tools that follow only one branch
   * miss half the API surface.
   */
  featureFlags: {
    useV2Orders: false,
    enableLegacyReports: true,
    enableMobileApi: false,
  },

  /**
   * Auth config — used by AuthService and AuthGuard.
   * tokenKey is the localStorage key where JWT is stored client-side.
   */
  authConfig: {
    tokenKey: 'spabench_permit_token',
    sessionTimeout: 28800, // 8 hours in seconds
  },
};
