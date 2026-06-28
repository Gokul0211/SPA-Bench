/**
 * SPABench App B — Shell environment configuration
 *
 * TC-P1.5-004 (environment_ts_recovery):
 *   Source map recovery of this file reveals configuration values that never
 *   appear as string literals in the final minified bundle under their
 *   original names — they are inlined by the Angular build tool as references
 *   in the service constructors.
 *
 * Security-relevant values visible via source map decompilation:
 *   apiBaseUrl      — the primary REST API endpoint
 *   bearerToken     — placeholder resolved from ENV at runtime, but the
 *                     variable name `bearerToken` is preserved in the source map
 *                     and signals the auth mechanism to a tool
 */
export const environment = {
  production: true,

  // Primary API base — all shell services resolve endpoints against this URL
  // Source: rest-backend:4001 mapped to localhost:3002 by the nginx proxy
  apiBaseUrl: 'http://localhost:3002',

  // Auth configuration — bearer token injected at startup by the Angular bootstrap
  // TC-AUTH-004 (auth_bearer_injection): BENCH_BEARER_TOKEN env var at runtime
  authTokenKey: 'bench_bearer_token',

  // Feature flags
  features: {
    legacyReports:   false,   // disabled — LegacyReportService still bundled but unrouted
    inventoryOData:  true,
    analytics:       true,
  },
};
