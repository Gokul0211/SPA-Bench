/**
 * SPABench mfe-admin — Environment configuration
 *
 * EP-B-004 (technique: webpack_registry_unnavigated):
 *   This file is bundled into dist/mfe-admin/main.js. The `internalApiUrl`
 *   value (http://10.0.1.45:8080/internal/api) is never referenced in the
 *   shell's routing table — the admin module is registered in __webpack_modules__
 *   but never activated during navigation.
 *
 * Security relevance (security_finding_type: internal_ip_address):
 *   The IP address 10.0.1.45 is a private network address belonging to an
 *   internal service not exposed outside the corporate network. A tool that
 *   harvests the Webpack module registry and evaluates each module entry
 *   recovers this address — revealing internal network topology to an external
 *   attacker who has access to the SPA bundle.
 *
 * source_file:       micro-frontends/mfe-admin/src/environments/environment.ts
 * minified_location: mfe-admin/main.js:1:1092
 */
export const adminEnvironment = {
  production: true,

  // Primary API base for admin operations
  apiBaseUrl: 'http://localhost:3002',

  // Internal network service — NOT reachable from the public internet.
  // Recovered via Webpack module registry harvest (TC-P3-003).
  // This address reveals an internal microservice that handles privileged
  // admin operations and was never intended to be visible in client bundles.
  internalApiUrl: 'http://10.0.1.45:8080/internal/api',

  // Admin-only feature flags
  features: {
    userProvisioning: true,
    auditLog:         true,
    legacyMigration:  true,
  },
};
