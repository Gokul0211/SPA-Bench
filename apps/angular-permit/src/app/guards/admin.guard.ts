/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/guards/admin.guard.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * AdminGuard is the second CanActivate layer on the /admin route (after AuthGuard).
 * It checks that the authenticated user's JWT contains role: 'admin'.
 *
 * This guard is why two credential sets exist in rest-backend/routes/app-a.js:
 *   benchuser  / benchpass → role: 'operator'  → passes AuthGuard, fails AdminGuard
 *   benchadmin / benchpass → role: 'admin'      → passes both guards
 *
 * BENCHMARK IMPACT ON SCORING:
 * ─────────────────────────────────────────────────────────────────────────────
 * A tool that authenticates as `benchuser` (operator) will:
 *   - Pass AuthGuard on all routes
 *   - FAIL AdminGuard on /admin
 *   - Never trigger the lazy-loaded admin chunk download
 *   - Miss all endpoints in the admin chunk (AdminPermitService, HazardAssessmentService,
 *     AuditService, UserManagementService)
 *   - Score 0% recall on admin-gated endpoints
 *
 * A tool that authenticates as `benchadmin` (admin) or that injects the admin JWT
 * directly will:
 *   - Pass both guards
 *   - Navigate to /admin → trigger admin chunk download (TC-P3-008)
 *   - Feed the chunk into Phase 2 analysis via feedback loop
 *   - Discover all admin chunk endpoints
 *
 * TC-AUTH-005 (auth_gated_endpoint): The set of 50 auth-gated endpoints includes
 * the admin chunk endpoints. Recall_authenticated is computed separately from
 * Recall_unauthenticated — this guard is what creates the separation.
 */

import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): Observable<boolean> {
    const role = this.authService.getRole();
    if (role !== 'admin') {
      // Redirect to dashboard — not to login (user IS authenticated, just wrong role)
      this.router.navigate(['/dashboard']);
      return of(false);
    }
    return of(true);
  }
}
