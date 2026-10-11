import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export interface AdminPermitListResponse {
  permits: AdminPermit[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminPermit {
  permitId: string;
  workSiteId: string;
  status: string;
  hazardLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePermitStatusRequest {
  status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'CLOSED';
  reason: string;
  approvedBy: string;
}

export interface PatchPermitRequest {
  hazardLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  supervisorId?: string;
  endDate?: string;
  notes?: string;
}

@Injectable()
export class AdminPermitService {

  private readonly base: string;

  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    // Admin endpoints are under /api/admin/ — different base from permit service
    this.base = appConfig.getApiBase().replace('/api/rc_permit/', '/api/admin/');
    this.http = http;
  }

  private buildAdminHeaders(): HttpHeaders {
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /**
   * GET /api/admin/permits
   * Admin-only permit list with full details including rejected and draft permits.
   */
  getAllPermits(
    page: number = 1,
    status?: string,
    workSiteId?: string,
  ): Observable<AdminPermitListResponse> {
    let params = new HttpParams().set('page', page.toString());
    if (status) params = params.set('status', status);
    if (workSiteId) params = params.set('workSiteId', workSiteId);
    return this.http.get<AdminPermitListResponse>(
      this.base + 'permits',
      { headers: this.buildAdminHeaders(), params },
    );
  }

  getPermitById(permitId: string): Observable<AdminPermit> {
    return this.http.get<AdminPermit>(
      `${this.base}permits/${permitId}`,
      { headers: this.buildAdminHeaders() },
    );
  }

  createAdminPermit(request: AdminPermit): Observable<AdminPermit> {
    return this.http.post<AdminPermit>(
      this.base + 'permits',
      request,
      { headers: this.buildAdminHeaders() },
    );
  }

  updatePermitStatus(
    permitId: string,
    update: UpdatePermitStatusRequest,
  ): Observable<AdminPermit> {
    return this.http.put<AdminPermit>(
      `${this.base}permits/${permitId}/status`,
      update,
      { headers: this.buildAdminHeaders() },
    );
  }

  patchPermit(permitId: string, changes: PatchPermitRequest): Observable<AdminPermit> {

    const payload: Record<string, unknown> = {};
    if (changes.hazardLevel) payload['hazardLevel'] = changes.hazardLevel;
    if (changes.supervisorId) payload['supervisorId'] = changes.supervisorId;
    if (changes.endDate) payload['endDate'] = changes.endDate;
    if (changes.notes) payload['notes'] = changes.notes;
    return this.http.patch<AdminPermit>(
      `${this.base}permits/${permitId}`,
      payload,
      { headers: this.buildAdminHeaders() },
    );
  }

  deletePermit(permitId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}permits/${permitId}`,
      { headers: this.buildAdminHeaders() },
    );
  }
}
