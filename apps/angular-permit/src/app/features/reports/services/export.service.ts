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
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private getEndpoint(format: ExportFormat): string {
    return this.exportBase + format;
  }

  exportReport(
    format: ExportFormat,
    reportId: string,
    includeAttachments: boolean = false,
  ): Observable<ExportJob> {

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
