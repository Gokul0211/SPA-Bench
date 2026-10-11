export const environment = {
  production: false,

  apiBaseUrl: 'http://localhost:4001/api/rc_permit/',

  stagingApiUrl: 'https://staging-api.rc-permit.internal/v2',

  oauthTokenEndpoint: 'https://auth.rc-permit.internal/oauth/token',

  internalServiceUrl: 'http://10.0.0.45:8080/internal',

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
    tokenKey: 'ptw_token',
    sessionTimeout: 28800, // 8 hours in seconds
  },
};
