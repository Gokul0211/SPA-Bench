/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/admin/services/user-management.service.ts
 *
 * BUNDLE LOCATION: admin-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * TC-P2-010 (inter_proc_factory_return, Phase 2):
 * URL comes from a factory function that returns different values based on
 * a condition — both the production URL AND the staging URL are valid return
 * values. The manifest spec says "Factory function — both production and
 * staging URLs." Both must appear in tool output.
 *
 * TC-P2-012 (inter_proc_cycle_detection, Phase 2):
 * This service and WorkflowHelperService have a deliberate circular reference:
 *   UserManagementService.getWorkflowBase() calls WorkflowHelperService.getUserRoot()
 *   WorkflowHelperService.getUserRoot() calls UserManagementService.getWorkflowBase()
 *
 * This is not a runtime circular dependency (Angular DI handles it via forward
 * refs) — it is a STATIC ANALYSIS circular dependency. A Phase 2 inter-procedural
 * resolver that follows this chain must detect the cycle using a visited-set and
 * bail out, rather than infinitely recursing or hanging.
 *
 * TC-P2-012 tests robustness, not discovery capability — the endpoint IS found
 * via the non-cyclic direct reference in `getUserProfile()`. The cycle is only
 * encountered if the tool follows the `getWorkflowBase()` resolution path.
 *
 * ENDPOINTS:
 *   GET    /api/admin/users                    (TC-P2-010 — factory URL)
 *   GET    /api/admin/users/{id}/profile       (TC-P2-010 — factory URL + path param)
 *   POST   /api/admin/users
 *   PATCH  /api/admin/users/{id}/role
 *   DELETE /api/admin/users/{id}
 *   GET    /api/admin/users/{id}/workflow      (TC-P2-012 — cycle detection path)
 */

import { Injectable, Inject, forwardRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export interface ManagedUser {
  userId: string;
  username: string;
  email: string;
  role: 'operator' | 'admin' | 'supervisor';
  active: boolean;
  department: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface WorkflowInfo {
  userId: string;
  pendingApprovals: number;
  assignedPermits: number;
  workflowStage: string;
}

/**
 * TC-P2-010 — Factory function that returns either prod or staging URL.
 *
 * Both return paths produce valid, callable URLs. The manifest has two
 * separate endpoint entries for the two base URLs — one VERIFIED_API
 * (production) and one LOW_CONFIDENCE (staging, security-relevant).
 *
 * In the minified bundle this factory becomes:
 *   function n(e){return e?'https://staging-api.rc-permit.internal/v2/admin/':'http://localhost:4001/api/admin/'}
 *
 * A Phase 2 tool following factory function return values must enumerate BOTH
 * branches and emit endpoints for both base URLs.
 */
function getAdminBaseUrl(useStaging: boolean): string {
  if (useStaging) {
    // Staging URL — security-relevant (TC-P2-010 staging branch)
    // This is the same staging URL as EP-A-005 but for the admin path
    return 'https://staging-api.rc-permit.internal/v2/admin/';
  }
  // Production URL — primary (TC-P2-010 production branch)
  return 'http://localhost:4001/api/admin/';
}

@Injectable()
export class UserManagementService {
  private readonly http: HttpClient;
  private readonly appConfig: AppConfigService;

  /**
   * WorkflowHelperService is injected via forwardRef to avoid circular
   * import at module load time. This creates the TC-P2-012 cycle in
   * static analysis — the injected service references back to this service.
   */
  private readonly workflowHelper: WorkflowHelperService;

  constructor(
    http: HttpClient,
    appConfig: AppConfigService,
    @Inject(forwardRef(() => WorkflowHelperService)) workflowHelper: WorkflowHelperService,
  ) {
    this.http = http;
    this.appConfig = appConfig;
    this.workflowHelper = workflowHelper;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── TC-P2-010 — factory return ────────────────────────────────────────────
  /**
   * GET /api/admin/users   (production)
   * GET https://staging-api.rc-permit.internal/v2/admin/users   (staging)
   *
   * TC-P2-010 (inter_proc_factory_return, Phase 2):
   * The base URL comes from `getAdminBaseUrl(useStaging)`. Both branches
   * are valid — a complete tool must emit endpoints for both.
   *
   * discovery_notes: "URL base from factory function getAdminBaseUrl(bool).
   * Returns production URL when false (primary), staging URL when true
   * (security-relevant LOW_CONFIDENCE). Both return values are callable
   * endpoints and must be enumerated."
   */
  getUsers(page: number = 1, useStaging: boolean = false): Observable<{
    users: ManagedUser[];
    total: number;
  }> {
    const base = getAdminBaseUrl(useStaging);
    return this.http.get<{ users: ManagedUser[]; total: number }>(
      base + 'users',
      { headers: this.buildHeaders() },
    );
  }

  /**
   * GET /api/admin/users/{id}/profile
   * TC-P2-010 (factory URL) + path parameter.
   */
  getUserProfile(userId: string, useStaging: boolean = false): Observable<ManagedUser> {
    const base = getAdminBaseUrl(useStaging);
    return this.http.get<ManagedUser>(
      `${base}users/${userId}/profile`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * POST /api/admin/users
   */
  createUser(user: Omit<ManagedUser, 'userId' | 'createdAt' | 'lastLoginAt'>): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(
      getAdminBaseUrl(false) + 'users',
      user,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * PATCH /api/admin/users/{id}/role
   */
  updateUserRole(userId: string, role: ManagedUser['role']): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(
      `${getAdminBaseUrl(false)}users/${userId}/role`,
      { role },
      { headers: this.buildHeaders() },
    );
  }

  /**
   * DELETE /api/admin/users/{id}
   */
  deactivateUser(userId: string): Observable<{ deactivated: boolean }> {
    return this.http.delete<{ deactivated: boolean }>(
      `${getAdminBaseUrl(false)}users/${userId}`,
      { headers: this.buildHeaders() },
    );
  }

  // ── TC-P2-012 — cycle detection ───────────────────────────────────────────
  /**
   * GET /api/admin/users/{id}/workflow
   *
   * TC-P2-012 (inter_proc_cycle_detection, Phase 2):
   *
   * The URL construction here calls `this.workflowHelper.getUserWorkflowBase()`
   * which in turn calls `this.userMgmt.getWorkflowBase()` which calls
   * `this.workflowHelper.getUserWorkflowBase()` again — an infinite loop.
   *
   * A Phase 2 inter-procedural resolver must detect this cycle via a
   * visited-set (or similar) and terminate the resolution, falling back to
   * an unresolved or partial URL rather than hanging indefinitely.
   *
   * The endpoint IS discoverable via the direct string concatenation path
   * in `getUserProfile()` above. TC-P2-012 tests robustness of the resolver,
   * not whether the endpoint is found — it must not crash or hang.
   *
   * discovery_notes: "Circular DI reference creates infinite resolution loop
   * in inter-procedural analysis. UserManagementService.getWorkflowBase() →
   * WorkflowHelperService.getUserWorkflowBase() → UserManagementService.getWorkflowBase().
   * Resolver must detect cycle via visited-set and terminate gracefully."
   */
  getUserWorkflow(userId: string): Observable<WorkflowInfo> {
    // This call path creates the TC-P2-012 cycle:
    const workflowBase = this.workflowHelper.getUserWorkflowBase();
    return this.http.get<WorkflowInfo>(
      `${workflowBase}${userId}/workflow`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * Called by WorkflowHelperService — creates the back-edge of the cycle.
   * This method is the cycle's return point.
   */
  getWorkflowBase(): string {
    // The cycle: calls back into workflowHelper which calls back here
    return this.workflowHelper.getUserWorkflowBase();
  }
}

/**
 * WorkflowHelperService — intentionally circular with UserManagementService.
 * Declared in this file to keep the cycle contained in a single chunk.
 *
 * TC-P2-012: This class is the other half of the circular reference.
 * getUserWorkflowBase() → UserManagementService.getWorkflowBase()
 *   → WorkflowHelperService.getUserWorkflowBase() → ...
 */
@Injectable()
export class WorkflowHelperService {
  constructor(
    @Inject(forwardRef(() => UserManagementService))
    private readonly userMgmt: UserManagementService,
  ) {}

  /**
   * Creates the cycle's back-edge by calling userMgmt.getWorkflowBase().
   * In practice, Angular's DI resolves the forward ref correctly at runtime.
   * In static analysis, this creates the cycle that TC-P2-012 tests for.
   */
  getUserWorkflowBase(): string {
    // Cycle back-edge — static analysis must detect and terminate here
    return this.userMgmt.getWorkflowBase();
  }
}
