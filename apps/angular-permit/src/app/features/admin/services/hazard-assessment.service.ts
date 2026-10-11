import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export interface HazardAssessment {
  assessmentId: string;
  workSiteId: string;
  hazardType: 'CHEMICAL' | 'ELECTRICAL' | 'MECHANICAL' | 'THERMAL' | 'BIOLOGICAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  likelihood: 'RARE' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'ALMOST_CERTAIN';
  riskScore: number;
  controlMeasures: string[];
  assessedBy: string;
  assessedAt: string;
  permitId: string | null;
}

export interface RiskMatrix {
  assessmentId: string;
  inherentRisk: number;
  residualRisk: number;
  riskTolerance: 'ACCEPTABLE' | 'TOLERABLE' | 'UNACCEPTABLE';
  controlEffectiveness: number;
}

@Injectable()
export class HazardAssessmentService {
  private readonly base: string;
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.base = appConfig.getApiBase().replace('/api/rc_permit/', '/api/admin/');
    this.http = http;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getHazardAssessments(
    page: number = 1,
    limit: number = 25,
    workSiteId: string = '',
    hazardType: string = '',
  ): Observable<{ assessments: HazardAssessment[]; total: number }> {

    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('workSiteId', workSiteId)
      .append('hazardType', hazardType);

    return this.http.get<{ assessments: HazardAssessment[]; total: number }>(
      this.base + 'hazards',
      { headers: this.buildHeaders(), params },
    );
  }

  /**
   * GET /api/admin/hazards/{id}
   */
  getHazardById(assessmentId: string): Observable<HazardAssessment> {
    return this.http.get<HazardAssessment>(
      `${this.base}hazards/${assessmentId}`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * POST /api/admin/hazards
   */
  createHazardAssessment(assessment: Omit<HazardAssessment, 'assessmentId' | 'assessedAt'>): Observable<HazardAssessment> {
    return this.http.post<HazardAssessment>(
      this.base + 'hazards',
      assessment,
      { headers: this.buildHeaders() },
    );
  }

  patchHazardAssessment(
    assessmentId: string,
    changes: Partial<Pick<HazardAssessment, 'severity' | 'likelihood' | 'controlMeasures'>>,
  ): Observable<HazardAssessment> {
    return this.http.patch<HazardAssessment>(
      `${this.base}hazards/${assessmentId}`,
      changes,
      { headers: this.buildHeaders() },
    );
  }

  deleteHazardAssessment(assessmentId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}hazards/${assessmentId}`,
      { headers: this.buildHeaders() },
    );
  }

  getRiskMatrix(assessmentId: string): Observable<RiskMatrix> {
    return this.http.get<RiskMatrix>(
      `${this.base}hazards/${assessmentId}/risk-matrix`,
      { headers: this.buildHeaders() },
    );
  }
}
