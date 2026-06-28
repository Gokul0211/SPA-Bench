/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/reports/services/export.service.ts
 *
 * BUNDLE LOCATION: reports-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * TC-P2-003 (url_variable_based, Phase 2):
 * The URL is assembled via an intermediate variable — not a direct string
 * concatenation at the call site. The pattern:
 *
 *   const endpoint = this.getEndpoint(exportType);
 *   return this.http.get(endpoint, ...)
 *
 * The full URL only exists inside `getEndpoint()`. At the call site in the
 * HTTP method, only the variable name `endpoint` appears — no URL fragments.
 *
 * This is subtly different from TC-P2-005 (service method delegation):
 *   TC-P2-005: URL from a NAMED method on the class (`getReportUrl(type)`)
 *   TC-P2-003: URL from an intermediate LOCAL VARIABLE (`const endpoint = ...`)
 *
 * Tools must trace backward from the `this.http.get(endpoint)` call through
 * the variable assignment `const endpoint = this.getEndpoint(exportType)` and
 * then into the `getEndpoint()` method body to find the URL string.
 *
 * ENDPOINTS:
 *   GET  /api/reports/export/pdf                  (TC-P2-003)
 *   GET  /api/reports/export/csv
 *   GET  /api/reports/export/xlsx
 *   GET  /api/reports/export/status/{jobId}
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';

export interface ExportJob {
  jobId: string;
  format: ExportFormat;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
  downloadUrl: string | null;
  queuedAt: string;
  completedAt: string | null;
  fileSizeBytes: number | null;
}

@Injectable()
export class ExportService {
  private readonly exportBase: string;
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.exportBase = appConfig.getApiBase().replace('/api/rc_permit/', '/api/reports/export/');
    this.http = http;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── TC-P2-003 — variable-based URL ────────────────────────────────────────
  /**
   * URL assembly helper — the intermediate variable that TC-P2-003 tests.
   *
   * TC-P2-003 (url_variable_based):
   * `const endpoint = this.getEndpoint(exportType)` is the intermediate variable.
   * The call site only shows `this.http.get(endpoint, ...)` — the URL string
   * is not visible at the call site at all.
   *
   * Minified call site: `const t=this.n(e); return this.h.get(t,{...})`
   * Minified helper:    `n.prototype.n=function(e){ return this.r+e }`
   * where this.r = exportBase = 'http://localhost:4001/api/reports/export/'
   *
   * discovery_notes: "URL assembled into intermediate variable `endpoint` by
   * getEndpoint(exportType). Call site has only `this.http.get(endpoint)` —
   * no URL literal visible. Tool must trace variable assignment to helper method."
   */
  private getEndpoint(format: ExportFormat): string {
    return this.exportBase + format;
  }

  /**
   * GET /api/reports/export/pdf
   * GET /api/reports/export/csv
   * GET /api/reports/export/xlsx
   *
   * All three call the same pattern — TC-P2-003 variable-based URL.
   */
  exportReport(
    format: ExportFormat,
    reportId: string,
    includeAttachments: boolean = false,
  ): Observable<ExportJob> {
    // TC-P2-003: URL stored in intermediate variable, not at call site
    const endpoint = this.getEndpoint(format);
    const params = new HttpParams()
      .set('reportId', reportId)
      .set('includeAttachments', String(includeAttachments));
    return this.http.get<ExportJob>(endpoint, {
      headers: this.buildHeaders(),
      params,
    });
  }

  /**
   * GET /api/reports/export/status/{jobId}
   * Poll for async export job completion.
   */
  getExportStatus(jobId: string): Observable<ExportJob> {
    return this.http.get<ExportJob>(
      `${this.exportBase}status/${jobId}`,
      { headers: this.buildHeaders() },
    );
  }
}
