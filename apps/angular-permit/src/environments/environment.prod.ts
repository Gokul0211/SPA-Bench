/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/environments/environment.prod.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * Angular CLI substitutes this file for environment.ts during production build
 * (via fileReplacements in angular.json). The built bundle only contains the
 * values from this file — NOT the development environment.ts.
 *
 * This is why EP-A-005 (stagingApiUrl) and EP-A-006 (oauthTokenEndpoint) are
 * Phase 1.5 exclusive: they live ONLY in environment.ts (dev), never in
 * environment.prod.ts. A tool analysing the production bundle will never see
 * them via static analysis — only source map decompilation recovers them.
 *
 * The apiBaseUrl here points to the same Docker network address as development,
 * because in the benchmark both environments run on localhost. In a real
 * production deployment this would be a fully-qualified external API URL.
 */

export const environment = {
  production: true,

  /**
   * Production REST API base — same value as dev for benchmark purposes.
   * In production the DI chain (AppConfigService → ApiService → PermitService)
   * still resolves through the same 3-level injection — the minified variable
   * names change but the pattern is identical.
   */
  apiBaseUrl: 'http://localhost:4001/api/rc_permit/',

  /**
   * stagingApiUrl intentionally ABSENT in production.
   * This is the tree-shaking that makes EP-A-005 exclusively Phase 1.5.
   */

  /**
   * oauthTokenEndpoint intentionally ABSENT in production.
   * This is the tree-shaking that makes EP-A-006 exclusively Phase 1.5.
   */

  /**
   * internalServiceUrl present in production — admin module uses it.
   * Security-relevant: internal IP exposed in production bundle.
   */
  internalServiceUrl: 'http://10.0.0.45:8080/internal',

  /**
   * Feature flags — production defaults.
   * useV2Orders: false means /api/v1/orders is the live path in production,
   * but /api/v2/orders (EP-A-009) is still callable — it is the canary branch.
   */
  featureFlags: {
    useV2Orders: false,
    enableLegacyReports: true,
    enableMobileApi: false,
  },

  authConfig: {
    tokenKey: 'spabench_permit_token',
    sessionTimeout: 28800,
  },
};
