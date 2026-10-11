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
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private getReportUrl(type: ReportType): string {
    return this.reportsBase + 'generate/' + type;
  }

  generateReport(
    reportType: ReportType,
    dateFrom: string,
    dateTo: string,
    format: 'PDF' | 'CSV' | 'XLSX' = 'PDF',
  ): Observable<GeneratedReport> {
    return this.http.get<GeneratedReport>(
      this.getReportUrl(reportType),
      {
        headers: this.buildHeaders(),
        params: { dateFrom, dateTo, format },
      },
    );
  }

  getReportHistory(
    userId: string,
    role: string,
    dateFrom: string,
    dateTo: string,
  ): Observable<{ reports: GeneratedReport[]; total: number }> {

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
