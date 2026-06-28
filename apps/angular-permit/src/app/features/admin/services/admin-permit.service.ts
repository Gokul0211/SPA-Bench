/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/admin/services/admin-permit.service.ts
 *
 * BUNDLE LOCATION: admin-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * This service is in the admin lazy chunk and covers three Phase 2 test cases
 * that are not covered by the main-bundle services:
 *
 * TC-P2-002 (url_template_literal):
 *   `this.http.get(`${this.b}/users/${e}/profile`)`
 *   Template literal with two interpolated variables — requires resolving BOTH
 *   `this.b` (the base URL) and understanding that `e` is a path parameter.
 *
 * TC-P2-023 (param_backward_taint):
 *   `const payload = {orderId, quantity}; this.http.put(url, payload)`
 *   The parameter object is defined BEFORE the HTTP call and passed by reference.
 *   Tools must taint-trace backward from the call site to the payload definition
 *   to recover the parameter names.
 *
 * TC-P2-013b/c/d/e — All six Angular HttpClient methods are represented across
 * the admin chunk services. This service covers POST, PUT, PATCH, DELETE.
 *
 * ENDPOINTS IN THIS FILE:
 * ─────────────────────────────────────────────────────────────────────────────
 * All routes are under /api/admin/ — protected by form auth + admin role.
 *
 *   GET    /api/admin/permits                     (list all permits, admin view)
 *   GET    /api/admin/permits/{id}                (TC-P2-002 — template literal)
 *   POST   /api/admin/permits                     (TC-P2-013b)
 *   PUT    /api/admin/permits/{id}/status         (TC-P2-013c)
 *   PATCH  /api/admin/permits/{id}                (TC-P2-013d + TC-P2-023 backward taint)
 *   DELETE /api/admin/permits/{id}                (TC-P2-013e)
 */

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
  /**
   * ApiService-equivalent base — in admin chunk this is injected directly
   * from AppConfigService (single-level DI, TC-P2-008 pattern).
   * Minified field name in admin chunk: single-char (e.g. `b`).
   * This is the `this.b` in the TC-P2-002 template literal.
   */
  private readonly base: string;

  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    // Admin endpoints are under /api/admin/ — different base from permit service
    this.base = appConfig.getApiBase().replace('/api/rc_permit/', '/api/admin/');
    this.http = http;
  }

  private buildAdminHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── TC-P2-013a — GET (list) ───────────────────────────────────────────────
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

  // ── TC-P2-002 — template literal ─────────────────────────────────────────
  /**
   * GET /api/admin/permits/{id}
   *
   * TC-P2-002 (url_template_literal, Phase 2):
   * Pattern: `${this.b}/permits/${permitId}`
   *
   * In the minified bundle this becomes:
   *   return this.h.get(`${this.b}/permits/${e}`,...)
   * where this.b = the base string, e = permitId parameter.
   *
   * Tools must:
   *   1. Detect the template literal pattern (backtick string)
   *   2. Resolve `this.b` through the constructor injection (AppConfigService)
   *   3. Recognise `${e}` as a path parameter placeholder
   *   4. Emit: GET /api/admin/permits/{id}
   *
   * discovery_notes: "Template literal URL with two interpolated variables.
   * this.b resolves through single-level constructor injection to /api/admin/.
   * The second interpolation is a path parameter — tool must emit {id} placeholder."
   */
  getPermitById(permitId: string): Observable<AdminPermit> {
    return this.http.get<AdminPermit>(
      `${this.base}permits/${permitId}`,
      { headers: this.buildAdminHeaders() },
    );
  }

  // ── TC-P2-013b — POST ─────────────────────────────────────────────────────
  /**
   * POST /api/admin/permits
   * Admin creates a permit on behalf of an operator.
   * TC-P2-013b: `this.http.post(url, body)`
   */
  createAdminPermit(request: AdminPermit): Observable<AdminPermit> {
    return this.http.post<AdminPermit>(
      this.base + 'permits',
      request,
      { headers: this.buildAdminHeaders() },
    );
  }

  // ── TC-P2-013c — PUT ──────────────────────────────────────────────────────
  /**
   * PUT /api/admin/permits/{id}/status
   * Full status update — replaces entire status record.
   * TC-P2-013c: `this.http.put(url, body)`
   */
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

  // ── TC-P2-013d + TC-P2-023 — PATCH + backward taint ─────────────────────
  /**
   * PATCH /api/admin/permits/{id}
   *
   * TC-P2-013d: `this.http.patch(url, body)` — the PATCH method pattern.
   *
   * TC-P2-023 (param_backward_taint, Phase 2):
   * The payload object is constructed BEFORE the HTTP call and referenced
   * by variable name at the call site. Tools must taint-trace backward from
   * `this.http.patch(url, payload)` to the `payload` definition two lines above
   * to recover the 4 patchable field names.
   *
   * In minified bundle:
   *   const r={};
   *   if(e.hazardLevel) r.hazardLevel=e.hazardLevel;
   *   if(e.supervisorId) r.supervisorId=e.supervisorId;
   *   if(e.endDate) r.endDate=e.endDate;
   *   if(e.notes) r.notes=e.notes;
   *   return this.h.patch(`${this.b}permits/${t}`,r,{headers:this.j()})
   *
   * discovery_notes: "PATCH payload assembled into `r` before call. Backward
   * taint from this.h.patch call site to the r object definition recovers
   * all 4 patchable fields: hazardLevel, supervisorId, endDate, notes."
   */
  patchPermit(permitId: string, changes: PatchPermitRequest): Observable<AdminPermit> {
    // Payload constructed before the HTTP call — TC-P2-023 pattern
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

  // ── TC-P2-013e — DELETE ───────────────────────────────────────────────────
  /**
   * DELETE /api/admin/permits/{id}
   * Hard-delete a permit (admin only, irreversible).
   * TC-P2-013e: `this.http.delete(url)`
   */
  deletePermit(permitId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}permits/${permitId}`,
      { headers: this.buildAdminHeaders() },
    );
  }
}
