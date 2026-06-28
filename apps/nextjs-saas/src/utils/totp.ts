// TC-AUTH-003: TOTP MFA flow
// Step 1: POST /api/auth/login
// Step 2: POST /api/auth/mfa/verify
export function buildMfaPayload(token: string, sessionToken: string) { return { token, sessionToken }; }
