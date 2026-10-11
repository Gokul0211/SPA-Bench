// Login is handled by the REST backend (POST /api/auth/login, then POST /api/auth/mfa/verify);
// this route only exists so the page tree is complete.
export default function handler(req: any, res: any) { res.status(404).json({}); }
