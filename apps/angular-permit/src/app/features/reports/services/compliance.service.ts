import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export interface ComplianceCheck {
  checkId: string;
  checkType: string;
  workSiteId: string;
  result: 'PASS' | 'FAIL' | 'PENDING' | 'WAIVED';
  score: number;
  maxScore: number;
  findings: ComplianceFinding[];
  performedBy: string;
  performedAt: string;
  dueDate: string;
}

export interface ComplianceFinding {
  findingId: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  description: string;
  requirement: string;
  remediated: boolean;
}

export interface ComplianceSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  pending: number;
  overallScore: number;
  criticalFindings: number;
}

const _endpoints: string[] = [
  'compliance-checks',     // index 0
  'compliance-checks/summary', // index 1
];

@Injectable()
export class ComplianceService {

  private readonly reportsBase: string;
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    // Single-level injection — appConfig read directly in constructor
    this.reportsBase = appConfig.getApiBase().replace('/api/rc_permit/', '/api/reports/');
    this.http = http;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getComplianceChecks(
    workSiteId?: string,
    result?: string,
    page: number = 1,
  ): Observable<{ checks: ComplianceCheck[]; total: number }> {
    let params = new HttpParams().set('page', page.toString());
    if (workSiteId) params = params.set('workSiteId', workSiteId);
    if (result) params = params.set('result', result);
    return this.http.get<{ checks: ComplianceCheck[]; total: number }>(
      this.reportsBase + _endpoints[0],
      { headers: this.buildHeaders(), params },
    );
  }

  /**
   * GET /api/reports/compliance-checks/{id}
   */
  getComplianceCheckById(checkId: string): Observable<ComplianceCheck> {
    return this.http.get<ComplianceCheck>(
      `${this.reportsBase}${_endpoints[0]}/${checkId}`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * POST /api/reports/compliance-checks
   */
  createComplianceCheck(
    check: Omit<ComplianceCheck, 'checkId' | 'performedAt'>,
  ): Observable<ComplianceCheck> {
    return this.http.post<ComplianceCheck>(
      this.reportsBase + _endpoints[0],
      check,
      { headers: this.buildHeaders() },
    );
  }

  getComplianceSummary(workSiteId?: string): Observable<ComplianceSummary> {
    const params = workSiteId ? new HttpParams().set('workSiteId', workSiteId) : undefined;
    return this.http.get<ComplianceSummary>(
      this.reportsBase + _endpoints[1],
      { headers: this.buildHeaders(), params },
    );
  }
}
