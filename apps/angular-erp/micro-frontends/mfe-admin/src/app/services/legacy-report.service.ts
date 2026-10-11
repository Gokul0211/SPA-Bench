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
