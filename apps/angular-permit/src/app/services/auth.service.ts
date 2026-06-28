/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/services/auth.service.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * This file implements the form-based authentication for App A and covers two
 * manifest endpoints:
 *
 * EP-A-010: POST /api/auth/login
 *   technique: auth_service_recovery (Phase 1.5)
 *   exclusive: false
 *   redundant_techniques: [auth_form_login (Phase auth test), url_concat_direct]
 *   confidence_tier: VERIFIED_API
 *   auth_required: false (it IS the auth endpoint)
 *   parameters (from FormGroup — TC-P2-022):
 *     username  (body, string, required)
 *     password  (body, string, required)
 *     rememberMe (body, boolean, optional)
 *
 * EP-A-006: https://auth.rc-permit.internal/oauth/token
 *   technique: environment_ts_recovery (Phase 1.5)
 *   exclusive: true
 *   security_relevant: true
 *   security_finding_type: oauth_token_endpoint
 *   Recovered from environment.ts via source map decompilation.
 *   This file references environment.oauthTokenEndpoint — a tool that
 *   decompiles this source file sees the oauth endpoint URL.
 *
 * TC-P2-022 (param_formgroup):
 * The FormGroup definition below has fields `username`, `password`, `rememberMe`.
 * A tool that extracts FormGroup field names from this source file (via Phase 1.5
 * source map recovery) associates these parameter names with EP-A-010.
 *
 * TC-P1.5-008 (auth_service_recovery):
 * "Recover auth.service.ts with login/refresh/logout." This file is exactly that.
 * The source map for auth.service.ts is one of the 26 exposed .map files.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { LoginResponse, LoginFormValue } from '../models/permit.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  /**
   * Reactive auth state — components subscribe to know if user is logged in.
   * Minified in bundle to a BehaviorSubject with renamed fields.
   */
  private readonly _isLoggedIn$ = new BehaviorSubject<boolean>(false);
  readonly isLoggedIn$ = this._isLoggedIn$.asObservable();

  /**
   * Current user role — used by AuthGuard and admin-only route checks.
   */
  private currentRole: 'operator' | 'admin' | 'supervisor' | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly router: Router,
  ) {
    // Restore session from localStorage on service init
    const storedToken = localStorage.getItem(environment.authConfig.tokenKey);
    if (storedToken) {
      this._isLoggedIn$.next(true);
    }
  }

  // ── EP-A-010 ─────────────────────────────────────────────────────────────
  /**
   * POST /api/auth/login
   *
   * EP-A-010 | technique: auth_service_recovery | Phase 1.5 | exclusive: false
   * redundant_techniques: [auth_form_login, url_concat_direct]
   * confidence_tier: VERIFIED_API | auth_required: false | auth_method: none
   * parameters (TC-P2-022 FormGroup):
   *   username   (body, string, required)
   *   password   (body, string, required)
   *   rememberMe (body, boolean, optional)
   *
   * The login URL '/api/auth/login' is a plain string literal here — this is
   * intentional. It is one of the 4 endpoints JSLuice found on Target-A: a
   * complete, non-fragmented URL that requires no variable resolution.
   *
   * The FormGroup below (TC-P2-022) adds the parameter mining dimension:
   * tools that just find the URL get EP-A-010 scored as a TP, but tools that
   * also extract FormGroup field names score full parameter recall too.
   *
   * Note: this.http.post is used directly here (not this.api.post) because
   * the auth endpoint is at the root /api/auth path, not /api/rc_permit/.
   * ApiService.getBase() returns /api/rc_permit/ — wrong prefix for auth.
   */
  login(formValue: LoginFormValue): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', {
      username: formValue.username,
      password: formValue.password,
      rememberMe: formValue.rememberMe,
    }).pipe(
      tap((response: LoginResponse) => {
        localStorage.setItem(environment.authConfig.tokenKey, response.accessToken);
        this.currentRole = response.user.role;
        this._isLoggedIn$.next(true);
      }),
    );
  }

  // ── EP-A-006 ─────────────────────────────────────────────────────────────
  /**
   * Token refresh via OAuth endpoint.
   *
   * EP-A-006 | technique: environment_ts_recovery | Phase 1.5 | exclusive: true
   * security_relevant: true | security_finding_type: oauth_token_endpoint
   * confidence_tier: LOW_CONFIDENCE
   *
   * environment.oauthTokenEndpoint = 'https://auth.rc-permit.internal/oauth/token'
   * This URL is only present in the development environment.ts — it is
   * tree-shaken in production builds (not in environment.prod.ts).
   *
   * A tool that decompiles environment.ts via source map recovery finds this URL.
   * A tool that only analyses the production bundle never sees it.
   *
   * The OAuth endpoint represents auth flow enumeration surface — in a real
   * pentest, finding the OAuth token endpoint reveals the auth provider,
   * enables client credential probing, and maps the token refresh attack surface.
   */
  refreshToken(refreshToken: string): Observable<{ accessToken: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = `grant_type=refresh_token&refresh_token=${refreshToken}`;
    return this.http.post<{ accessToken: string }>(
      environment.oauthTokenEndpoint,
      body,
      { headers },
    );
  }

  /**
   * Clears the local session and navigates to login.
   * No server call — JWT is stateless on the benchmark server.
   */
  logout(): void {
    localStorage.removeItem(environment.authConfig.tokenKey);
    this.currentRole = null;
    this._isLoggedIn$.next(false);
    this.router.navigate(['/login']);
  }

  /**
   * Returns the stored JWT or null.
   */
  getToken(): string | null {
    return localStorage.getItem(environment.authConfig.tokenKey);
  }

  /**
   * Returns current user role — used by AdminGuard.
   */
  getRole(): 'operator' | 'admin' | 'supervisor' | null {
    return this.currentRole;
  }

  // ── TC-P2-022 — FormGroup definition ─────────────────────────────────────
  /**
   * Builds the reactive form for the login page.
   *
   * TC-P2-022 (param_formgroup, Phase 2):
   * A tool that extracts Angular FormGroup field names from this source file
   * recovers 3 parameter names for EP-A-010:
   *   username   → maps to { name: "username", location: "body", required: true }
   *   password   → maps to { name: "password", location: "body", required: true }
   *   rememberMe → maps to { name: "rememberMe", location: "body", required: false }
   *
   * The connection: this form is submitted via login() above, which sends
   * form.value to POST /api/auth/login. Cross-file parameter mining connects
   * the FormGroup fields to the login endpoint's request body.
   */
  buildLoginForm(): FormGroup {
    return this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
    });
  }
}
