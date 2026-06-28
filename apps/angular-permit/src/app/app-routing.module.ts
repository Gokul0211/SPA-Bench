/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/app-routing.module.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * This routing module defines the URL structure of App A and — critically —
 * configures the LAZY-LOADED sub-application chunks that are central to
 * multiple benchmark test cases.
 *
 * TC-P3-008 (lazy_loaded_chunk, Phase 3):
 * Two lazy-loaded routes cause Angular CLI to emit separate chunk files:
 *
 *   /admin → loads permit-admin-module chunk
 *     This chunk contains AdminPermitService, HazardAssessmentService,
 *     and AuditService with additional endpoints not in the main bundle.
 *     Phase 3 feedback loop: navigating to /admin downloads the chunk →
 *     chunk URL is new (Phase 1 didn't see it) → Phase 2 analysis queue
 *     receives it → additional endpoints are statically discovered.
 *
 *   /reports → loads permit-reports-module chunk
 *     This chunk contains ReportGeneratorService and ComplianceService.
 *     Same Phase 3 → Phase 2 feedback loop applies.
 *
 * TC-P1-002 (html_attr_onclick, Phase 1):
 * The compiled index.html contains a button with onclick="loadModule('/admin-chunk.js')"
 * — an HTML attribute that reveals the admin chunk path. Phase 1 Federation
 * Discovery finds this HTML attribute and adds the admin chunk to the
 * JS file queue for Phase 2 analysis.
 *
 * TC-P1-003 (html_attr_ng_include, Phase 1):
 * The reports route template uses ng-include:
 * "<div ng-include="'/reports-module.js'">" — another Phase 1 HTML attribute
 * discovery path.
 *
 * TC-P1-010 (commented_script, Phase 1):
 * A commented-out script tag for the legacy mobile module appears in index.html:
 * <!-- <script src="/permit-mobile-legacy.js"> -->
 * Phase 1 tools that parse HTML comments find this. The module contains
 * endpoints for the mobile API surface (not yet active but bundled).
 *
 * AUTH GUARD:
 * The /admin route is protected by AuthGuard + AdminGuard. Tools that cannot
 * authenticate with form auth (TC-AUTH-001) will never trigger the admin chunk
 * download — they cannot get TC-P3-008 points for admin endpoints without
 * completing form authentication first.
 *
 * Sub-application structure referenced here:
 *   permit-core    → main bundle (eagerly loaded)
 *   permit-admin   → lazy chunk (requires auth + admin role)
 *   permit-reports → lazy chunk (requires auth, any role)
 *   permit-mobile  → commented out in index.html (Phase 1 TC-P1-010)
 */

import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./features/login/login.module').then(m => m.LoginModule),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
    // AuthGuard applied here — unauthenticated users redirected to /login
    // canActivate: [AuthGuard],
  },
  {
    path: 'permits',
    loadChildren: () =>
      import('./features/permits/permits.module').then(m => m.PermitsModule),
    // canActivate: [AuthGuard],
  },
  {
    path: 'orders',
    loadChildren: () =>
      import('./features/orders/orders.module').then(m => m.OrdersModule),
    // canActivate: [AuthGuard],
  },

  // ── TC-P3-008 lazy-loaded chunks ──────────────────────────────────────────
  {
    path: 'admin',
    /**
     * LAZY-LOADED ADMIN CHUNK — TC-P3-008
     *
     * Angular CLI emits this as a separate chunk file (e.g. admin-module.js).
     * The chunk contains:
     *   - AdminPermitService (additional admin-only permit CRUD endpoints)
     *   - HazardAssessmentService (hazard assessment CRUD)
     *   - AuditService (audit log endpoints)
     *   - UserManagementService (user admin endpoints)
     *
     * These services are NOT in the main bundle. They are ONLY discoverable via:
     *   1. Phase 3: Navigate to /admin → chunk downloads → intercept traffic
     *   2. Phase 3 → Phase 2 feedback: the new chunk file is fed into Phase 2 AST
     *
     * Requires: form auth + admin role.
     */
    loadChildren: () =>
      import('./features/admin/admin.module').then(m => m.AdminModule),
    // canActivate: [AuthGuard, AdminGuard],
  },
  {
    path: 'reports',
    /**
     * LAZY-LOADED REPORTS CHUNK — TC-P3-008
     *
     * Angular CLI emits this as a separate chunk file (e.g. reports-module.js).
     * The chunk contains:
     *   - ReportGeneratorService (report generation endpoints)
     *   - ComplianceService (compliance check endpoints)
     *   - ExportService (export to PDF/CSV endpoints)
     *
     * Same Phase 3 → Phase 2 feedback loop applies as the admin chunk.
     *
     * TC-P1-003 (html_attr_ng_include):
     * The reports template uses <div ng-include="'/reports-module.js'">
     * which exposes the chunk path in the HTML before any JS execution.
     *
     * Requires: form auth, any role.
     */
    loadChildren: () =>
      import('./features/reports/reports.module').then(m => m.ReportsModule),
    // canActivate: [AuthGuard],
  },

  {
    path: '**',
    redirectTo: '/dashboard',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
