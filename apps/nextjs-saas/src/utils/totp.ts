export function buildMfaPayload(token: string, sessionToken: string) {
  return { token, sessionToken };
}
