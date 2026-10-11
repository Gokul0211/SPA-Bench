export const environment = {
  production: true,

  apiBaseUrl: 'http://localhost:3002',

  authTokenKey: 'erp_token',

  // Feature flags
  features: {
    legacyReports:   false,   // disabled — LegacyReportService still bundled but unrouted
    inventoryOData:  true,
    analytics:       true,
  },
};
