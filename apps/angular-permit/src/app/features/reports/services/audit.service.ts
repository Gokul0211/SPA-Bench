/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/admin/services/audit.service.ts
 *
 * BUNDLE LOCATION: admin-module.js (lazy chunk) — NOT in main bundle.js
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * TC-P2-004 (url_object_property_chain, Phase 2):
 * URL assembled from a 3-level deep property traversal:
 *   `env.config.api.base + "/audit"`
 *
 * This tests whether inter-procedural analysis can follow an object property
 * chain (not just a single variable or method call). The pattern appears in
 * enterprise apps that use a nested config object rather than a flat
 * environment constant.
 *
 * In source: `this.configObj.api.base + 'audit/log'`
 * Minified:  `this.n.o.e+"audit/log"` — three property dereferences
 *
 * TC-P2-013f (OPTIONS method, Phase 2):
 * `this.http.request('OPTIONS', url)` — the only endpoint in App A using the
 * OPTIONS method. Tests whether tools correctly attribute HTTP method to
 * request() calls where the method is a string argument, not a method name.
 *
 * ENDPOINTS:
 *   GET     /api/admin/audit/log               (TC-P2-004 — object property chain)
 *   GET     /api/admin/audit/log/{entryId}
 *   PUT     /api/admin/audit/log/{entryId}     (TC-P2-013c — PUT)
 *   OPTIONS /api/admin/audit/capabilities      (TC-P2-013f — OPTIONS via request())
 *   GET     /api/admin/audit/export
 */

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

/**
 * Nested config object — the source of the TC-P2-004 property chain pattern.
 *
 * TC-P2-004 (url_object_property_chain):
 * The URL base is accessed as `this.configObj.api.base` — a 3-level property
 * chain. In the minified bundle this becomes `this.n.o.e` or similar — three
 * successive property accesses on renamed objects.
 *
 * A Phase 2 tool resolving this must:
 *   1. Identify `this.configObj` as the object at call site
 *   2. Trace `.api` to the nested `api` property of the config
 *   3. Trace `.base` to the string value `'http://localhost:4001/api/admin/'`
 *
 * This is distinct from the TC-P2-009 3-file DI chain — here the depth is in
 * property nesting on a single object, not across constructor injections.
 */
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
  /**
   * The nested config object that produces the TC-P2-004 property chain.
   * Minified field name: single-char (e.g. `n`).
   * The call site `this.n.o.e` resolves through:
   *   this.n = configObj → .o = api → .e = base → 'http://localhost:4001/api/admin/'
   */
  private readonly configObj: typeof AUDIT_CONFIG;
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.configObj = AUDIT_CONFIG;
    this.http = http;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── TC-P2-004 — object property chain ────────────────────────────────────
  /**
   * GET /api/admin/audit/log
   *
   * TC-P2-004 (url_object_property_chain, Phase 2):
   * URL assembled as: this.configObj.api.base + 'audit/log'
   *
   * Minified: `this.n.o.e+"audit/log"`
   *
   * Phase 2 resolution:
   *   this.n = AuditService.configObj = AUDIT_CONFIG
   *   .o = AUDIT_CONFIG.api = { base: '...', version: '...' }
   *   .e = AUDIT_CONFIG.api.base = 'http://localhost:4001/api/admin/'
   *
   * discovery_notes: "URL base accessed via 3-level object property chain
   * this.configObj.api.base — not via Angular DI constructor injection.
   * Minified as 3 successive property dereferences on renamed objects."
   */
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

  // ── TC-P2-013c — PUT ──────────────────────────────────────────────────────
  /**
   * PUT /api/admin/audit/log/{entryId}
   * Amend an audit entry (admin correction workflow).
   * TC-P2-013c: this.http.put(url, body)
   */
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

  // ── TC-P2-013f — OPTIONS via request() ───────────────────────────────────
  /**
   * OPTIONS /api/admin/audit/capabilities
   *
   * TC-P2-013f: `this.http.request('OPTIONS', url)` — the OPTIONS method.
   *
   * This is the only OPTIONS endpoint in App A. It tests whether tools correctly
   * attribute HTTP method 'OPTIONS' when the method is passed as a STRING
   * argument to `request()`, not inferred from a method name like `.get()` or
   * `.post()`. Tools that only scan for `.get(`, `.post(`, etc. miss this entirely.
   *
   * In minified bundle:
   *   return this.h.request('OPTIONS', this.n.o.e+'audit/capabilities', {headers:this.j()})
   *
   * discovery_notes: "OPTIONS method via request() call — method name is a string
   * argument. Tools scanning for .get/.post/.put/.patch/.delete method names only
   * will not find this endpoint. Method attribution requires parsing request() args."
   */
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
