import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { adminEnvironment } from '../../environments/environment';

export interface LegacyReport {
  reportId:   string;
  type:       string;
  generatedAt: string;
  rowCount:   number;
  data:       Record<string, unknown>[];
}

/**
 * LegacyReportService — mfe-admin
 *
 * TC-P3-003 (webpack_registry_unnavigated):
 *   This service is bundled into dist/mfe-admin/main.js alongside
 *   adminEnvironment.internalApiUrl = 'http://10.0.1.45:8080/internal/api'.
 *
 *   The mfe-admin remoteEntry.js is co-hosted at localhost:3002/mfe-admin/
 *   and is loaded by the shell federation runtime at startup. All of this
 *   module's code (including the internal URL) is registered in __webpack_modules__
 *   but never called — because the shell's AppRoutingModule has no '/admin' route.
 *
 *   A standard page crawler following navigation paths will never encounter
 *   this service. A tool that reads __webpack_modules__ entries finds it.
 */
@Injectable({ providedIn: 'root' })
export class LegacyReportService {
  // This value resolves to 'http://10.0.1.45:8080/internal/api' at bundle time
  private readonly internalBase = adminEnvironment.internalApiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Fetch a legacy report from the internal service.
   * URL: http://10.0.1.45:8080/internal/api/reports/{type}
   * This endpoint is on the internal network — not callable from outside.
   * Its existence is detectable via the bundle, not via HTTP probing.
   */
  getLegacyReport(reportType: string, authHeader: string): Observable<LegacyReport> {
    const headers = new HttpHeaders({ Authorization: authHeader });
    return this.http.get<LegacyReport>(
      `${this.internalBase}/reports/${reportType}`,
      { headers },
    );
  }

  /**
   * Submit data to the internal legacy admin API.
   * URL: http://10.0.1.45:8080/internal/api/admin/submit
   */
  submitAdminPayload(payload: unknown, authHeader: string): Observable<{ success: boolean }> {
    const headers = new HttpHeaders({
      Authorization:  authHeader,
      'Content-Type': 'application/json',
    });
    return this.http.post<{ success: boolean }>(
      `${this.internalBase}/admin/submit`,
      payload,
      { headers },
    );
  }
}
