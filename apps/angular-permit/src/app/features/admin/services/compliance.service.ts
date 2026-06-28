/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/reports/services/compliance.service.ts
 *
 * BUNDLE LOCATION: reports-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * TC-P2-008 (inter_proc_constructor_single, Phase 2):
 * Single-level constructor injection — the simplest inter-procedural case.
 * This service receives its base URL directly from AppConfigService in one
 * constructor step (no intermediate ApiService layer).
 *
 * This is the "1 file" depth in the inter-procedural resolution test cases:
 *   inter_proc_constructor_single: 1 file
 *   inter_proc_constructor_multi:  3+ files (permit.service.ts)
 *
 * A tool that can resolve 1-level injection but not 3-level would:
 *   - Find endpoints in this file ✓
 *   - Miss endpoints in permit.service.ts ✗
 *
 * TC-P2-006 (url_array_assembly, Phase 2):
 * URL fragments stored in a plain string array, assembled via index access:
 *   `_s = ["getWorkOrder","createPermit"]; this.http.get(this.o + _s[0])`
 *
 * This is the non-obfuscated version of TC-P2-011. The array is not rotated —
 * indices map directly to values. Tools must trace the array definition and
 * resolve `_endpoints[0]` to `'compliance-checks'`.
 *
 * ENDPOINTS:
 *   GET  /api/reports/compliance-checks          (TC-P2-006 — array assembly)
 *   GET  /api/reports/compliance-checks/{id}
 *   POST /api/reports/compliance-checks
 *   GET  /api/reports/compliance-checks/summary
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export interface ComplianceCheck {
  checkId: string;
  checkType: string;
  workSiteId: string;
  result: 'PASS' | 'FAIL' | 'PENDING' | 'WAIVED';
  score: number;
  maxScore: number;
  findings: ComplianceFinding[];
  performedBy: string;
  performedAt: string;
  dueDate: string;
}

export interface ComplianceFinding {
  findingId: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  description: string;
  requirement: string;
  remediated: boolean;
}

export interface ComplianceSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  pending: number;
  overallScore: number;
  criticalFindings: number;
}

/**
 * TC-P2-006 — URL fragment array (non-obfuscated).
 *
 * These fragments are assembled by index at call sites:
 *   complianceBase + _endpoints[0]  → /api/reports/compliance-checks
 *   complianceBase + _endpoints[1]  → /api/reports/compliance-checks/summary
 *
 * After Phase 3 Phase 2 (bundle generation), this pattern will remain as a
 * plain array (unlike admin.service.ts which gets the rotation obfuscation).
 * This gives the benchmark two difficulty levels of array assembly:
 *   TC-P2-006: plain array, direct index → easy
 *   TC-P2-011: rotated array, shifted index → hard
 */
const _endpoints: string[] = [
  'compliance-checks',     // index 0
  'compliance-checks/summary', // index 1
];

@Injectable()
export class ComplianceService {
  /**
   * TC-P2-008: Base URL via single-level constructor injection.
   * AppConfigService → reportsBase (one hop only, no intermediate service).
   * Minified field: single-char (e.g. `r`).
   */
  private readonly reportsBase: string;
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    // Single-level injection — appConfig read directly in constructor
    this.reportsBase = appConfig.getApiBase().replace('/api/rc_permit/', '/api/reports/');
    this.http = http;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── TC-P2-006 — array assembly ────────────────────────────────────────────
  /**
   * GET /api/reports/compliance-checks
   *
   * TC-P2-006 (url_array_assembly, Phase 2):
   * URL assembled as: this.reportsBase + _endpoints[0]
   *
   * Minified: `return this.h.get(this.r+o[0],{...})`
   * where o = _endpoints (renamed), o[0] = 'compliance-checks'
   *
   * Tool must:
   *   1. Identify `o` as the `_endpoints` array
   *   2. Resolve `o[0]` to `'compliance-checks'`
   *   3. Concatenate with resolved base URL
   *
   * discovery_notes: "URL suffix from indexed string array: _endpoints[0] =
   * 'compliance-checks'. Array index resolves without rotation — simpler variant
   * of the obfuscated_string_array pattern in admin.service.ts."
   */
  getComplianceChecks(
    workSiteId?: string,
    result?: string,
    page: number = 1,
  ): Observable<{ checks: ComplianceCheck[]; total: number }> {
    let params = new HttpParams().set('page', page.toString());
    if (workSiteId) params = params.set('workSiteId', workSiteId);
    if (result) params = params.set('result', result);
    return this.http.get<{ checks: ComplianceCheck[]; total: number }>(
      this.reportsBase + _endpoints[0],    // TC-P2-006
      { headers: this.buildHeaders(), params },
    );
  }

  /**
   * GET /api/reports/compliance-checks/{id}
   */
  getComplianceCheckById(checkId: string): Observable<ComplianceCheck> {
    return this.http.get<ComplianceCheck>(
      `${this.reportsBase}${_endpoints[0]}/${checkId}`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * POST /api/reports/compliance-checks
   */
  createComplianceCheck(
    check: Omit<ComplianceCheck, 'checkId' | 'performedAt'>,
  ): Observable<ComplianceCheck> {
    return this.http.post<ComplianceCheck>(
      this.reportsBase + _endpoints[0],
      check,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * GET /api/reports/compliance-checks/summary
   * TC-P2-006 — second index: _endpoints[1]
   */
  getComplianceSummary(workSiteId?: string): Observable<ComplianceSummary> {
    const params = workSiteId ? new HttpParams().set('workSiteId', workSiteId) : undefined;
    return this.http.get<ComplianceSummary>(
      this.reportsBase + _endpoints[1],    // TC-P2-006
      { headers: this.buildHeaders(), params },
    );
  }
}
