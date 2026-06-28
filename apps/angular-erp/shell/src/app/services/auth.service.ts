import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: {
    username: string;
    role: string;
  };
}

export interface AuthState {
  token: string | null;
  username: string | null;
  role: string | null;
  authenticated: boolean;
}

/**
 * Shell AuthService — EP-B-005
 *
 * TC-P1.5-008 (auth_service_recovery):
 *   This file is recoverable via source map decompilation of shell/main.js.
 *   The login endpoint URL (`${this.apiBase}/api/auth/login`) is the primary
 *   signal — the template literal resolves to http://localhost:3002/api/auth/login
 *   (EP-B-005).
 *
 * TC-P3-013 (fetch_interception):
 *   During Phase 3 dynamic browsing, the POST to /api/auth/login is intercepted
 *   at the network layer when the login form is submitted. The tool captures the
 *   URL from the intercepted XHR/Fetch request.
 *
 * Auth method: bearer (BENCH_BEARER_TOKEN injected at startup for automated runs).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBase = environment.apiBaseUrl;

  private authState$ = new BehaviorSubject<AuthState>({
    token: null,
    username: null,
    role: null,
    authenticated: false,
  });

  readonly state$ = this.authState$.asObservable();

  constructor(private http: HttpClient) {
    // Inject static benchmark bearer token for automated test runners (TC-AUTH-004)
    const staticToken = (window as any).__BENCH_BEARER_TOKEN__;
    if (staticToken) {
      this.authState$.next({
        token: staticToken,
        username: 'benchuser',
        role: 'operator',
        authenticated: true,
      });
    }
  }

  /**
   * EP-B-005: POST http://localhost:3002/api/auth/login
   * Sends bearer credentials to obtain a JWT for subsequent API calls.
   */
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiBase}/api/auth/login`, { username, password })
      .pipe(
        tap((res) => {
          this.authState$.next({
            token:         res.token,
            username:      res.user.username,
            role:          res.user.role,
            authenticated: true,
          });
          // Store token for page refresh persistence
          sessionStorage.setItem(environment.authTokenKey, res.token);
        }),
        catchError((err) => {
          this.authState$.next({ token: null, username: null, role: null, authenticated: false });
          return throwError(() => err);
        }),
      );
  }

  logout(): void {
    sessionStorage.removeItem(environment.authTokenKey);
    this.authState$.next({ token: null, username: null, role: null, authenticated: false });
  }

  getToken(): string | null {
    return this.authState$.value.token
      ?? sessionStorage.getItem(environment.authTokenKey);
  }

  isAuthenticated(): boolean {
    return this.authState$.value.authenticated
      || !!sessionStorage.getItem(environment.authTokenKey);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }
}
