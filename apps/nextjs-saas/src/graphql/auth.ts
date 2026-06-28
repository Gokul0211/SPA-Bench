export function requireAuth(ctx: { token?: string }): void {
  if (!ctx.token) throw new Error('UNAUTHENTICATED');
}
