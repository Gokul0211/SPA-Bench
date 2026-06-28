/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/admin/admin.module.ts
 *
 * BENCHMARK RELEVANCE — LAZY-LOADED CHUNK BOUNDARY
 * ────────────────────────────────────────────────────────────────────────────
 * This is the root module of the lazy-loaded admin chunk. Angular CLI emits
 * everything imported by this module into a separate chunk file — NOT into
 * the main `bundle.js`. This creates the Phase 3 → Phase 2 feedback loop
 * scenario tested by TC-P3-008.
 *
 * TC-P3-008 (lazy_loaded_chunk, Phase 3):
 * When a Phase 3 dynamic browser navigates to /admin:
 *   1. The browser fetches the admin chunk JS file (e.g. `admin-module.js`)
 *   2. Phase 3 intercepts this network request — the chunk URL is NEW
 *      (Phase 1 Federation Discovery didn't know this file existed from HTML alone)
 *   3. The feedback loop sends `admin-module.js` to Phase 2's AST analysis queue
 *   4. Phase 2 statically analyses the new chunk and discovers all endpoints in:
 *      AdminPermitService, HazardAssessmentService, AuditService, UserManagementService
 *
 * This is how Phase 3 contributes to Phase 2's discovery count — not just from
 * live traffic interception, but from feeding newly discovered files back to
 * static analysis.
 *
 * TC-P1-002 (html_attr_onclick, Phase 1):
 * The compiled index.html includes a Phase 1 discovery path for this chunk:
 *   <button onclick="loadModule('/admin-chunk.js')">Admin Panel</button>
 * A Phase 1 tool that scans all HTML attributes finds this before any JS runs.
 *
 * TC-P1-007 (dynamic_import_inline, Phase 1):
 * The app component template includes an inline script:
 *   <script>if(user.role==='admin') import('/admin-panel.chunk.js')</script>
 * Another Phase 1 path to the chunk URL.
 *
 * SERVICES IN THIS CHUNK:
 * ─────────────────────────────────────────────────────────────────────────────
 * All four services below are ONLY bundled into admin-module.js — they are
 * NOT in the main bundle.js. A tool that only analyses main bundle.js misses
 * all their endpoints completely.
 *
 *   AdminPermitService   — admin-level permit CRUD (TC-P2-002, TC-P2-023)
 *   HazardAssessmentService — hazard management (TC-P2-020, TC-P2-013d/e)
 *   AuditService         — audit log (TC-P2-004, TC-P2-013f)
 *   UserManagementService — user admin (TC-P2-010, TC-P2-012)
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// These imports cause all four service files to be bundled into this chunk
import { AdminPermitService } from './services/admin-permit.service';
import { HazardAssessmentService } from './services/hazard-assessment.service';
import { AuditService } from './services/audit.service';
import { UserManagementService } from './services/user-management.service';

const routes: Routes = [
  {
    path: '',
    // AdminDashboardComponent would be here in a full build
    // For benchmark purposes the module itself is the chunk boundary —
    // the component files are stubs; the services are the discovery targets
    children: [
      { path: '', redirectTo: 'permits', pathMatch: 'full' },
      { path: 'permits', component: class AdminPermitsStub {} },
      { path: 'hazards', component: class HazardsStub {} },
      { path: 'audit', component: class AuditStub {} },
      { path: 'users', component: class UsersStub {} },
    ],
  },
];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
  ],
  providers: [
    // Services are provided here (not root) so they are tree-shaken into this chunk
    AdminPermitService,
    HazardAssessmentService,
    AuditService,
    UserManagementService,
  ],
})
export class AdminModule {}
