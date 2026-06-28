/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/reports/reports.module.ts
 *
 * BUNDLE LOCATION: reports-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE — SECOND LAZY-LOADED CHUNK BOUNDARY
 * ────────────────────────────────────────────────────────────────────────────
 * This is the root module of the lazy-loaded reports chunk. It is the second
 * chunk boundary in App A (alongside admin-module.js).
 *
 * TC-P3-008 (lazy_loaded_chunk, Phase 3):
 * When a Phase 3 browser navigates to /reports:
 *   1. Browser fetches `reports-module.js`
 *   2. Phase 3 intercepts the network request
 *   3. Feedback loop sends the new chunk to Phase 2 AST analysis
 *   4. Phase 2 discovers endpoints in ReportGeneratorService, ComplianceService,
 *      ExportService
 *
 * TC-P1-003 (html_attr_ng_include, Phase 1):
 * The reports template uses ng-include to load its dashboard view:
 *   <div ng-include="'/reports-module.js'">
 * Phase 1 scans HTML attributes and finds this before any JS execution,
 * adding the chunk URL to the JS file analysis queue.
 *
 * SERVICES IN THIS CHUNK:
 *   ReportGeneratorService  — TC-P2-005 (service method delegation), TC-P2-021 (URLSearchParams)
 *   ComplianceService       — TC-P2-008 (single-level constructor injection)
 *   ExportService           — TC-P2-003 (variable-based URL assembly)
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ReportGeneratorService } from './services/report-generator.service';
import { ComplianceService } from './services/compliance.service';
import { ExportService } from './services/export.service';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: '', redirectTo: 'generate', pathMatch: 'full' },
      { path: 'generate', component: class ReportGenerateStub {} },
      { path: 'compliance', component: class ComplianceStub {} },
      { path: 'export', component: class ExportStub {} },
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
    // Provided here (not root) — tree-shaken into this chunk only
    ReportGeneratorService,
    ComplianceService,
    ExportService,
  ],
})
export class ReportsModule {}
