/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/services/admin.service.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * This file implements the admin-only operations and contains the source
 * pattern that becomes the obfuscated string array in the minified bundle.
 *
 * EP-A-007: GET /api/admin/legacy-reports
 *   technique: obfuscated_string_array (Phase 2)
 *   exclusive: true
 *   confidence_tier: BACKEND_API
 *   auth_required: true | auth_method: form
 *   Role check: admin only (403 if role !== 'admin')
 *
 * TC-P2-011 (obfuscated_string_array):
 * In the SOURCE (this file), the URL segments are in a plain string array.
 * After Webpack minification + terser + string array rotation obfuscation,
 * the bundle output becomes the rotation/shift pattern described in the
 * benchmark spec:
 *
 *   var a = ["https://api.internal/", "getPermitType", "legacy-reports", "Bearer "];
 *   (function(b, c) { var d = function(e) { for(;--e;) b.push(b.shift()) }; d(++c) }(a, 0x1a3));
 *   var b = function(c, d) { return a[c - 0x1a3] };
 *   this.http.get(b('0x1a3') + b('0x1a5'));
 *
 * A tool must:
 *   1. Detect the rotation/shift function pattern
 *   2. Execute or emulate the array rotation
 *   3. Resolve each index lookup to its string value
 *   4. Concatenate to get: http://localhost:4001/api/admin/legacy-reports
 *
 * This file's plain-source version makes the intent clear. The dist/ Phase 2
 * work (bundle.js) will contain the obfuscated version.
 *
 * EP-A-005 (staging URL) is also referenced here — AdminService uses the
 * staging base for certain admin-level diagnostics. This creates a second
 * file where staging_api_url appears (in addition to environment.ts and
 * app-config.service.ts), increasing Phase 1.5 recovery confidence.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';
import { environment } from '../../environments/environment';

/**
 * The string segments used to construct the admin endpoint URL.
 * In minified output this array is rotated and access is via computed index.
 *
 * TC-P2-011 source pattern — pre-obfuscation:
 * These strings are assembled into the final URL by getLegacyReports().
 * Webpack terser plugin + obfuscator plugin transforms this array into
 * the rotation/shift pattern in the minified bundle.
 */
const _adminPaths: string[] = [
  'http://localhost:4001',   // index 0: resolved base (not from DI chain — hardcoded in admin)
  '/api/',                   // index 1: path separator
  'admin/',                  // index 2: admin segment
  'legacy-reports',          // index 3: endpoint name
  'Bearer ',                 // index 4: auth header prefix (also in array — common obfuscation)
];

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  /**
   * AppConfigService injected to access staging base and feature flags.
   * Minified field: single-char identifier.
   */
  private readonly appConfig: AppConfigService;

  /**
   * HttpClient for direct admin calls.
   * Minified field: single-char identifier.
   */
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.appConfig = appConfig;
    this.http = http;
  }

  // ── EP-A-007 ─────────────────────────────────────────────────────────────
  /**
   * GET /api/admin/legacy-reports
   *
   * EP-A-007 | technique: obfuscated_string_array | Phase 2 | exclusive: true
   * confidence_tier: BACKEND_API | auth_required: true | auth_method: form
   * Role check: admin (403 if non-admin token)
   *
   * In the minified bundle the URL is assembled from the rotated _adminPaths
   * array (indices 0+1+2+3 concatenated). The rotation/shift function in the
   * bundle scrambles the index order — a tool must decode the shift to know
   * that indices [0,1,2,3] concatenate to:
   *   "http://localhost:4001" + "/api/" + "admin/" + "legacy-reports"
   *   = "http://localhost:4001/api/admin/legacy-reports"
   *
   * This is the method body that regex tools see:
   *   return this.h.get(b('0x1a3')+b('0x1a4')+b('0x1a5')+b('0x1a6'))
   * They extract nothing useful. Phase 2 obfuscated_string_array analysis
   * decodes the rotation, reconstructs the array, and resolves each b() call.
   */
  getLegacyReports(): Observable<LegacyReportListResponse> {
    // URL assembled from string array — this is what becomes the obfuscated
    // array pattern in bundle.js
    const url = _adminPaths[0] + _adminPaths[1] + _adminPaths[2] + _adminPaths[3];
    const token = localStorage.getItem('spabench_permit_token') || '';
    const headers = new HttpHeaders({
      Authorization: _adminPaths[4] + token,  // "Bearer " + token
    });
    return this.http.get<LegacyReportListResponse>(url, { headers });
  }

  // ── EP-A-005 staging reference ────────────────────────────────────────────
  /**
   * Admin diagnostic endpoint that calls the staging API.
   * Reinforces EP-A-005's discoverability from this file (in addition to
   * environment.ts) — a tool that decompiles admin.service.ts via source map
   * sees the staging URL reference here.
   *
   * Note: This method is intentionally not in the starter manifest — it is
   * part of the broader ~421 endpoint set. It demonstrates that staging URLs
   * can appear in service method bodies, not just environment files.
   */
  getStagingHealthCheck(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(
      this.appConfig.getStagingBase() + '/health'
    );
  }

  /**
   * Returns admin dashboard statistics.
   * Called on admin home page load — visible in Phase 3 traffic interception.
   */
  getDashboardStats(): Observable<AdminDashboardStats> {
    return this.http.get<AdminDashboardStats>(
      _adminPaths[0] + _adminPaths[1] + 'admin/dashboard-stats'
    );
  }
}

// ── Response types ────────────────────────────────────────────────────────

export interface LegacyReportListResponse {
  reports: LegacyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LegacyReport {
  reportId: string;
  title: string;
  generatedAt: string;
  format: 'PDF' | 'CSV' | 'XLSX';
  size: number;
  downloadUrl: string;
}

export interface AdminDashboardStats {
  totalPermits: number;
  activePermits: number;
  pendingApprovals: number;
  overdueClosed: number;
  incidentsThisMonth: number;
  complianceScore: number;
}
