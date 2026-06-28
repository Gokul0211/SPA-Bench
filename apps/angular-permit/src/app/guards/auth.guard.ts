/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/guards/auth.guard.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * AuthGuard protects all routes that require form authentication (TC-AUTH-001).
 * Its presence in the routing module is why:
 *
 * 1. Tools that cannot authenticate (no form login capability) will never
 *    trigger the lazy-loaded admin chunk download. They score 0% on
 *    auth-gated endpoints — which is the correct benchmark result.
 *
 * 2. TC-AUTH-001 (auth_form_login): A tool that implements form login
 *    (POST /api/auth/login with benchuser/benchpass, captures the JWT,
 *    stores it, and uses it for subsequent requests) will bypass this guard
 *    and can access protected endpoints.
 *
 * 3. TC-AUTH-002 (auth_browser_driven): Tools using Playwright/Puppeteer
 *    that navigate through the login form directly will also bypass this
 *    guard via the session cookie set by the server.
 *
 * AdminGuard (in guards/admin.guard.ts) adds a second layer for the /admin
 * route — JWT must contain role: 'admin' to pass.
 */

import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): Observable<boolean> {
    return this.authService.isLoggedIn$.pipe(
      take(1),
      map(isLoggedIn => {
        if (!isLoggedIn) {
          this.router.navigate(['/login']);
          return false;
        }
        return true;
      }),
    );
  }
}
