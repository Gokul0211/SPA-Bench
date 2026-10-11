import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditLogEntry {
  entryId: string;
  entityType: 'PERMIT' | 'WORK_ORDER' | 'HAZARD' | 'USER' | 'SYSTEM';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT';
  performedBy: string;
  timestamp: string;
  details: Record<string, unknown>;
  ipAddress: string;
}

export interface AuditCapabilities {
  canExport: boolean;
  canDelete: boolean;
  retentionDays: number;
  allowedExportFormats: string[];
}

const AUDIT_CONFIG = {
  api: {
    base: 'http://localhost:4001/api/admin/',  // hardcoded in admin chunk (not via DI)
    version: 'v1',
    timeout: 30000,
  },
  retention: {
    days: 365,
    archivePath: '/archive',
  },
};

@Injectable()
export class AuditService {

  private readonly configObj: typeof AUDIT_CONFIG;
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.configObj = AUDIT_CONFIG;
    this.http = http;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAuditLog(
    from?: string,
    to?: string,
    entityType?: string,
    action?: string,
    page: number = 1,
  ): Observable<{ entries: AuditLogEntry[]; total: number }> {
    let params = new HttpParams().set('page', page.toString());
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (entityType) params = params.set('entityType', entityType);
    if (action) params = params.set('action', action);

    return this.http.get<{ entries: AuditLogEntry[]; total: number }>(
      this.configObj.api.base + 'audit/log',
      { headers: this.buildHeaders(), params },
    );
  }

  /**
   * GET /api/admin/audit/log/{entryId}
   */
  getAuditEntry(entryId: string): Observable<AuditLogEntry> {
    return this.http.get<AuditLogEntry>(
      `${this.configObj.api.base}audit/log/${entryId}`,
      { headers: this.buildHeaders() },
    );
  }

  amendAuditEntry(
    entryId: string,
    amendment: { reason: string; correctedDetails: Record<string, unknown> },
  ): Observable<AuditLogEntry> {
    return this.http.put<AuditLogEntry>(
      `${this.configObj.api.base}audit/log/${entryId}`,
      amendment,
      { headers: this.buildHeaders() },
    );
  }

  getAuditCapabilities(): Observable<AuditCapabilities> {
    return this.http.request<AuditCapabilities>(
      'OPTIONS',
      this.configObj.api.base + 'audit/capabilities',
      { headers: this.buildHeaders() },
    );
  }

  /**
   * GET /api/admin/audit/export
   * Export audit log as CSV or PDF.
   * Parameters: format (query), from/to (query), entityType (query)
   */
  exportAuditLog(
    format: 'CSV' | 'PDF',
    from: string,
    to: string,
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('format', format)
      .set('from', from)
      .set('to', to);
    return this.http.get(
      this.configObj.api.base + 'audit/export',
      {
        headers: this.buildHeaders(),
        params,
        responseType: 'blob',
      },
    );
  }
}
