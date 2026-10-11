import { useState } from 'react';
import { buildMfaPayload } from '../utils/totp';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Id': 'nextjs-saas' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed`);
  return res.json();
}

export default function Login() {
  const [pending, setPending] = useState<string | null>(null);

  async function signIn(username: string, password: string) {
    const r = await post<{ requiresMFA?: boolean; sessionToken?: string; accessToken?: string }>(
      '/api/auth/login', { username, password });
    if (r.requiresMFA && r.sessionToken) setPending(r.sessionToken);
    else if (r.accessToken) sessionStorage.setItem('saas_token', r.accessToken);
  }

  async function verify(code: string) {
    const r = await post<{ accessToken: string }>('/api/auth/mfa/verify', buildMfaPayload(code, pending!));
    sessionStorage.setItem('saas_token', r.accessToken);
  }

  return pending
    ? <form onSubmit={e => { e.preventDefault(); verify((e.currentTarget.elements.namedItem('code') as HTMLInputElement).value); }}>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" />
      </form>
    : <form onSubmit={e => {
        e.preventDefault();
        const f = e.currentTarget.elements;
        signIn((f.namedItem('username') as HTMLInputElement).value, (f.namedItem('password') as HTMLInputElement).value);
      }}>
        <input name="username" autoComplete="username" />
        <input name="password" type="password" autoComplete="current-password" />
      </form>;
}
