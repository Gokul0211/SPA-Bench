import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';
import { environment } from '../../environments/environment';

const _adminPaths: string[] = [
  'http://localhost:4001',   // index 0: resolved base (not from DI chain — hardcoded in admin)
  '/api/',                   // index 1: path separator
  'admin/',                  // index 2: admin segment
  'legacy-reports',          // index 3: endpoint name
  'Bearer ',
];

@Injectable({
  providedIn: 'root',
})
export class AdminService {

  private readonly appConfig: AppConfigService;

  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.appConfig = appConfig;
    this.http = http;
  }

  getLegacyReports(): Observable<LegacyReportListResponse> {

    // array pattern in bundle.js
    const url = _adminPaths[0] + _adminPaths[1] + _adminPaths[2] + _adminPaths[3];
    const token = localStorage.getItem('ptw_token') || '';
    const headers = new HttpHeaders({
      Authorization: _adminPaths[4] + token,  // "Bearer " + token
    });
    return this.http.get<LegacyReportListResponse>(url, { headers });
  }

  getStagingHealthCheck(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(
      this.appConfig.getStagingBase() + '/health'
    );
  }

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
