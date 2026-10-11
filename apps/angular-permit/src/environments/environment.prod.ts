export const environment = {
  production: true,

  apiBaseUrl: 'http://localhost:4001/api/rc_permit/',

  /**
   * internalServiceUrl present in production — admin module uses it.
   * Security-relevant: internal IP exposed in production bundle.
   */
  internalServiceUrl: 'http://10.0.0.45:8080/internal',

  featureFlags: {
    useV2Orders: false,
    enableLegacyReports: true,
    enableMobileApi: false,
  },

  authConfig: {
    tokenKey: 'ptw_token',
    sessionTimeout: 28800,
  },
};
