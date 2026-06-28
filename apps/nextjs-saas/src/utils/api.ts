export const API_BASE = 'http://localhost:3005';
export function authHeader(token: string) { return { Authorization: `Bearer ${token}` }; }
