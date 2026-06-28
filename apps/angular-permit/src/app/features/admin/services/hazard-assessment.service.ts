/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/admin/services/hazard-assessment.service.ts
 *
 * BUNDLE LOCATION: admin-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * TC-P2-020 (param_httpparams_chain, Phase 2):
 * HttpParams builder chain — `.set().set().append()` — is the dominant URL
 * parameter construction pattern in Angular enterprise apps. Tools that only
 * extract query string literals miss all parameters built via the builder API.
 *
 * Pattern in source:
 *   const params = new HttpParams()
 *     .set('page', page.toString())
 *     .set('limit', limit.toString())
 *     .set('workSiteId', workSiteId)
 *     .append('hazardType', type);
 *
 * In minified bundle:
 *   const p=(new t.HttpParams).set('page',String(n)).set('limit',String(r)).set('workSiteId',o).append('hazardType',s)
 *
 * A tool implementing TC-P2-020 traces each .set() and .append() call on the
 * HttpParams chain and emits: page, limit, workSiteId, hazardType as query
 * parameters for the GET /api/admin/hazards endpoint.
 *
 * ENDPOINTS:
 *   GET    /api/admin/hazards                     (TC-P2-020 — HttpParams chain)
 *   GET    /api/admin/hazards/{id}
 *   POST   /api/admin/hazards
 *   PATCH  /api/admin/hazards/{id}               (TC-P2-013d)
 *   DELETE /api/admin/hazards/{id}               (TC-P2-013e)
 *   GET    /api/admin/hazards/{id}/risk-matrix
 */

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
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── TC-P2-020 — HttpParams builder chain ─────────────────────────────────
  /**
   * GET /api/admin/hazards
   *
   * TC-P2-020 (param_httpparams_chain, Phase 2):
   * Parameters: page, limit, workSiteId, hazardType (all via HttpParams chain)
   *
   * The chained .set().set().set().append() pattern is how Angular apps build
   * multi-parameter query strings. Regex tools see nothing — no '?' or '&'
   * characters. Tools that parse the HttpParams builder chain recover all 4 params.
   *
   * discovery_notes: "Query parameters built via HttpParams builder chain with
   * 3 .set() and 1 .append() calls. No URL query string literal exists anywhere
   * in the bundle — all param names extracted from builder method arguments only."
   */
  getHazardAssessments(
    page: number = 1,
    limit: number = 25,
    workSiteId: string = '',
    hazardType: string = '',
  ): Observable<{ assessments: HazardAssessment[]; total: number }> {
    // TC-P2-020: HttpParams builder chain — each call is a separate method invocation
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

  // ── TC-P2-013d — PATCH ────────────────────────────────────────────────────
  /**
   * PATCH /api/admin/hazards/{id}
   * TC-P2-013d: this.http.patch(url, body)
   */
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

  // ── TC-P2-013e — DELETE ───────────────────────────────────────────────────
  /**
   * DELETE /api/admin/hazards/{id}
   * TC-P2-013e: this.http.delete(url)
   */
  deleteHazardAssessment(assessmentId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}hazards/${assessmentId}`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * GET /api/admin/hazards/{id}/risk-matrix
   * Nested resource endpoint — path has two dynamic segments.
   * Tests whether tools handle double path parameters correctly.
   */
  getRiskMatrix(assessmentId: string): Observable<RiskMatrix> {
    return this.http.get<RiskMatrix>(
      `${this.base}hazards/${assessmentId}/risk-matrix`,
      { headers: this.buildHeaders() },
    );
  }
}
