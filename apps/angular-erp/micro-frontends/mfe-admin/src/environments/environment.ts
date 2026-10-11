export const adminEnvironment = {
  production: true,

  // Primary API base for admin operations
  apiBaseUrl: 'http://localhost:3002',

  // Internal network service — NOT reachable from the public internet.

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
