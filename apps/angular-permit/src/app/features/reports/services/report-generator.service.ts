/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/reports/services/report-generator.service.ts
 *
 * BUNDLE LOCATION: reports-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * TC-P2-005 (url_service_method_delegation, Phase 2):
 * The endpoint URL is not assembled at the call site — it is returned by a
 * dedicated helper method `getReportUrl(type)`. The call site only has:
 *   `this.http.get(this.getReportUrl(reportType), ...)`
 *
 * Tools must inline the method body of `getReportUrl()` to reconstruct the
 * URL. This is method return value inlining — different from both the DI chain
 * (constructor injection) and the factory function (external function) patterns.
 *
 * TC-P2-021 (param_urlsearchparams, Phase 2):
 * Parameters are passed via `new URLSearchParams({...})` constructor object —
 * not via Angular's `HttpParams` builder. This tests whether the tool
 * recognises URLSearchParams as a parameter construction pattern.
 *
 * In source:
 *   const searchParams = new URLSearchParams({ userId, role, dateFrom, dateTo });
 *   this.http.get(url + '?' + searchParams.toString(), ...)
 *
 * Tools must extract field names from the URLSearchParams constructor object
 * literal: `userId`, `role`, `dateFrom`, `dateTo`.
 *
 * ENDPOINTS:
 *   GET  /api/reports/generate/{type}           (TC-P2-005 — service method delegation)
 *   GET  /api/reports/history                   (TC-P2-021 — URLSearchParams)
 *   GET  /api/reports/templates
 *   POST /api/reports/schedule
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export type ReportType =
  | 'PERMIT_SUMMARY'
  | 'WORK_ORDER_STATUS'
  | 'HAZARD_REGISTER'
  | 'COMPLIANCE_DASHBOARD'
  | 'INCIDENT_LOG'
  | 'AUDIT_TRAIL';

export interface GeneratedReport {
  reportId: string;
  type: ReportType;
  generatedAt: string;
  recordCount: number;
  downloadUrl: string;
  format: 'PDF' | 'CSV' | 'XLSX';
}

export interface ReportSchedule {
  scheduleId?: string;
  reportType: ReportType;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recipients: string[];
  format: 'PDF' | 'CSV';
  active: boolean;
}

export interface ReportTemplate {
  templateId: string;
  name: string;
  reportType: ReportType;
  defaultParams: Record<string, string>;
}

@Injectable()
export class ReportGeneratorService {
  private readonly reportsBase: string;
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    // Reports are under /api/reports/ — separate base from permit/admin
    this.reportsBase = appConfig.getApiBase().replace('/api/rc_permit/', '/api/reports/');
    this.http = http;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── TC-P2-005 — service method delegation ────────────────────────────────
  /**
   * Returns the URL for a specific report type.
   *
   * TC-P2-005 (url_service_method_delegation, Phase 2):
   * This method is the delegation target. The call site `generateReport()` only
   * has `this.getReportUrl(type)` — the actual URL string is HERE.
   *
   * Minified: `n.prototype.getReportUrl=function(e){return this.r+"generate/"+e}`
   * where this.r = reportsBase = 'http://localhost:4001/api/reports/'
   *
   * A tool must: (1) find `this.http.get(this.getReportUrl(type))` at call site,
   * (2) resolve `this.getReportUrl` to this method, (3) inline the method body,
   * (4) reconstruct: `this.reportsBase + 'generate/' + type`
   *
   * discovery_notes: "URL returned by getReportUrl(type) helper method — not
   * assembled at call site. Tool must inline the method body of getReportUrl
   * to recover the URL pattern /api/reports/generate/{type}."
   */
  private getReportUrl(type: ReportType): string {
    return this.reportsBase + 'generate/' + type;
  }

  /**
   * GET /api/reports/generate/{type}
   * Uses TC-P2-005 delegation — URL via getReportUrl().
   */
  generateReport(
    reportType: ReportType,
    dateFrom: string,
    dateTo: string,
    format: 'PDF' | 'CSV' | 'XLSX' = 'PDF',
  ): Observable<GeneratedReport> {
    return this.http.get<GeneratedReport>(
      this.getReportUrl(reportType),           // ← TC-P2-005: URL from method delegation
      {
        headers: this.buildHeaders(),
        params: { dateFrom, dateTo, format },
      },
    );
  }

  // ── TC-P2-021 — URLSearchParams ───────────────────────────────────────────
  /**
   * GET /api/reports/history
   *
   * TC-P2-021 (param_urlsearchparams, Phase 2):
   * Query parameters passed via `new URLSearchParams({...})` — not HttpParams.
   * Parameters: userId, role, dateFrom, dateTo (all from URLSearchParams constructor)
   *
   * In source:
   *   const searchParams = new URLSearchParams({ userId, role, dateFrom, dateTo });
   *   return this.http.get(url + '?' + searchParams.toString(), ...)
   *
   * Minified:
   *   const p=new URLSearchParams({userId:e,role:t,dateFrom:n,dateTo:r});
   *   return this.h.get(this.r+'history?'+p.toString(),{headers:this.j()})
   *
   * Tools must recognise `new URLSearchParams({...})` as a parameter source
   * and extract keys: userId, role, dateFrom, dateTo.
   *
   * discovery_notes: "Query parameters via URLSearchParams constructor object
   * literal — not Angular HttpParams. Tool must recognise URLSearchParams pattern
   * and extract object keys: userId, role, dateFrom, dateTo."
   */
  getReportHistory(
    userId: string,
    role: string,
    dateFrom: string,
    dateTo: string,
  ): Observable<{ reports: GeneratedReport[]; total: number }> {
    // TC-P2-021: URLSearchParams constructor with object literal
    const searchParams = new URLSearchParams({ userId, role, dateFrom, dateTo });
    return this.http.get<{ reports: GeneratedReport[]; total: number }>(
      this.reportsBase + 'history?' + searchParams.toString(),
      { headers: this.buildHeaders() },
    );
  }

  /**
   * GET /api/reports/templates
   */
  getReportTemplates(): Observable<ReportTemplate[]> {
    return this.http.get<ReportTemplate[]>(
      this.reportsBase + 'templates',
      { headers: this.buildHeaders() },
    );
  }

  /**
   * POST /api/reports/schedule
   */
  scheduleReport(schedule: ReportSchedule): Observable<ReportSchedule> {
    return this.http.post<ReportSchedule>(
      this.reportsBase + 'schedule',
      schedule,
      { headers: this.buildHeaders() },
    );
  }
}
