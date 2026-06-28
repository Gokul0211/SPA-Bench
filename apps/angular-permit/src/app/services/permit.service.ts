/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/services/permit.service.ts
 *
 * BENCHMARK RELEVANCE — DI CHAIN LEVEL 3 of 3
 * ────────────────────────────────────────────────────────────────────────────
 * This is the third and final link in the 3-file constructor injection chain.
 * It is the file where the HTTP calls actually happen — and where static analysis
 * tools must arrive after tracing back through two levels of Angular DI.
 *
 * Chain summary:
 *   environment.ts
 *     └─ AppConfigService.getApiBase()        (Level 1, app-config.service.ts)
 *          └─ ApiService.getBase()             (Level 2, api.service.ts)
 *               └─ PermitService.http.get()    ← THIS FILE (Level 3)
 *
 * MINIFIED OUTPUT (what appears in bundle.js):
 * ─────────────────────────────────────────────
 * Angular CLI / Webpack renames:
 *   PermitService → mangled class name
 *   this.api      → this.o   (the ApiService injection, minified)
 *   this.http     → this.t   (the HttpClient injection, minified)
 *
 * In bundle.js the getPermitType call becomes approximately:
 *   n.prototype.getPermitType = function() {
 *     return this.t.get(this.o + "getPermitType")
 *   }
 * Wait — this is wrong. The call goes through ApiService.get() which wraps
 * HttpClient. The bundle pattern for EP-A-001 is actually:
 *   return this.t.get(this.o.getBase() + "getPermitType")
 * where this.t = ApiService instance, this.o = some property, but actually
 * in minified output through the ApiService wrapper it would look like:
 *   return this.t.get(this.t.e + "getPermitType")
 *
 * The precise minified form in bundle.js is documented in the manifest:
 *   EP-A-001 minified_location: "bundle.js:1:91032"
 *   The token at that position is: this.t.get(this.o+"getPermitType")
 *
 * This is what regex tools extract: "getPermitType" — a fragment without its
 * base URL. They cannot resolve `this.o` to http://localhost:4001/api/rc_permit/.
 *
 * ENDPOINTS IN THIS FILE:
 * ─────────────────────────────────────────────
 * EP-A-001: GET /api/rc_permit/getPermitType
 *   technique: url_concat_direct (Phase 2)
 *   exclusive: true
 *   Discovered by resolving `this.o` through the 3-level DI chain.
 *
 * EP-A-002: GET /api/rc_permit/getWorkOrder?workOrderId=...
 *   technique: inter_proc_constructor_multi (Phase 2)
 *   exclusive: true
 *   The hardest Phase 2 case — 3 files, 3 constructors, 1 base URL.
 *
 * EP-A-003: POST /api/rc_permit/createPermit
 *   technique: param_ts_interface (Phase 2)
 *   exclusive: false (also discoverable via Phase 1.5 source map)
 *   5 parameters from CreatePermitRequest interface.
 *
 * EP-A-004: GET /api/rc_permit/getPermitDetails?id=...
 *   technique: ts_service_file_recovery (Phase 1.5)
 *   exclusive: true
 *   Only discoverable via source map decompilation of this file.
 *   Never fired during normal navigation — admin-only endpoint.
 */

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  CreatePermitRequest,
  PermitResponse,
  PermitDetails,
  PermitTypeListResponse,
  WorkOrderResponse,
} from '../models/permit.models';

@Injectable({
  providedIn: 'root',
})
export class PermitService {
  /**
   * ApiService injection — DI chain level 2.
   * In the minified bundle this field is renamed (e.g. `o`).
   * This is the `this.o` that regex tools see but cannot resolve.
   *
   * The Angular injector wires: PermitService(api: ApiService) →
   * ApiService(appConfig: AppConfigService, http: HttpClient) →
   * AppConfigService() reads environment.apiBaseUrl.
   *
   * The full string at EP-A-001 call site in bundle.js:
   *   this.t.get(this.o.getBase()+"getPermitType")
   * Resolves to: http://localhost:4001/api/rc_permit/getPermitType
   */
  private readonly api: ApiService;

  constructor(api: ApiService) {
    this.api = api;
  }

  // ── EP-A-001 ─────────────────────────────────────────────────────────────
  /**
   * GET /api/rc_permit/getPermitType
   *
   * EP-A-001 | technique: url_concat_direct | Phase 2 | exclusive: true
   * confidence_tier: BACKEND_API | auth_required: true | auth_method: form
   *
   * Minified bundle pattern:
   *   this.t.get(this.o+"getPermitType")
   * where this.o resolves (via DI chain) to "http://localhost:4001/api/rc_permit/"
   *
   * Regex tools extract: "getPermitType" — a suffix fragment.
   * JSLuice parses but cannot trace this.o → reports nothing.
   * Phase 2 inter-procedural analysis resolves this.o → full URL.
   *
   * Returns 6 permit type codes for the current work site context.
   */
  getPermitType(): Observable<PermitTypeListResponse> {
    return this.api.get<PermitTypeListResponse>('getPermitType');
  }

  // ── EP-A-002 ─────────────────────────────────────────────────────────────
  /**
   * GET /api/rc_permit/getWorkOrder?workOrderId=...
   *
   * EP-A-002 | technique: inter_proc_constructor_multi | Phase 2 | exclusive: true
   * confidence_tier: BACKEND_API | auth_required: true | auth_method: form
   * parameters: [{ name: "workOrderId", location: "query", type: "string", required: true }]
   *
   * This is the hardest Phase 2 test case in the benchmark. The base URL flows:
   *   environment.apiBaseUrl
   *     → AppConfigService constructor (file 1)
   *     → AppConfigService.getApiBase() called by ApiService constructor (file 2)
   *     → ApiService.getBase() called here (file 3)
   *
   * A tool must trace through all 3 constructors across 3 files to reconstruct:
   *   http://localhost:4001/api/rc_permit/getWorkOrder
   *
   * The discovery_notes in the manifest state:
   * "Base URL flows through 3 files: AppConfigService reads environment.ts,
   * ApiService injects AppConfigService and exposes .getBase(), PermitService
   * injects ApiService and calls .getBase(). Minified to this.o. No single-file
   * tool can reconstruct this."
   */
  getWorkOrder(workOrderId: string): Observable<WorkOrderResponse> {
    const params = new HttpParams().set('workOrderId', workOrderId);
    return this.api.get<WorkOrderResponse>('getWorkOrder', params);
  }

  // ── EP-A-003 ─────────────────────────────────────────────────────────────
  /**
   * POST /api/rc_permit/createPermit
   *
   * EP-A-003 | technique: param_ts_interface | Phase 2 | exclusive: false
   * redundant_techniques: [ts_service_file_recovery] (Phase 1.5)
   * confidence_tier: BACKEND_API | auth_required: true | auth_method: form
   * parameters: 5 fields from CreatePermitRequest interface
   *
   * TC-P2-018 test case: a tool performing TypeScript interface extraction
   * recovers all 5 parameters (workSiteId, startDate, endDate, hazardLevel,
   * supervisorId) from the CreatePermitRequest type annotation.
   *
   * TC-P2-019 test case: generic type argument `post<PermitResponse>` signals
   * to the tool that the second argument matches CreatePermitRequest, enabling
   * field enumeration from the type definition.
   *
   * TC-P2-022 test case (indirectly): the matching FormGroup in the permit
   * creation component has fields that align with this interface — cross-file
   * parameter mining connects the two.
   */
  createPermit(request: CreatePermitRequest): Observable<PermitResponse> {
    return this.api.post<PermitResponse>('createPermit', request);
  }

  // ── EP-A-004 ─────────────────────────────────────────────────────────────
  /**
   * GET /api/rc_permit/getPermitDetails?id=...
   *
   * EP-A-004 | technique: ts_service_file_recovery | Phase 1.5 | exclusive: true
   * confidence_tier: BACKEND_API | auth_required: true | auth_method: form
   * parameters: [{ name: "id", location: "query", type: "string", required: true }]
   *
   * This endpoint is EXCLUSIVELY discoverable via Phase 1.5 source map recovery.
   *
   * Why it cannot be found by other phases:
   * - Phase 1 (Federation): No HTML attribute, comment, or preload link references
   *   this endpoint's URL or the admin chunk that contains it.
   * - Phase 2 (Static AST): The minified bundle for this endpoint is inside a
   *   lazy-loaded admin chunk that is never emitted to the main bundle. Static
   *   analysis of bundle.js never sees this code.
   * - Phase 3 (Dynamic): No standard navigation path triggers this endpoint.
   *   It is called only from the permit admin panel, which requires form login
   *   + admin role — conditions that standard crawlers never satisfy.
   *
   * The ONLY way to find it: decompile bundle.js.map → recover this file →
   * parse the source → trace the DI chain → reconstruct the full URL.
   *
   * This is TC-P1.5-003 (ts_service_file_recovery): "Recover full .service.ts
   * with HTTP call signatures."
   */
  getPermitDetails(id: string): Observable<PermitDetails> {
    const params = new HttpParams().set('id', id);
    return this.api.get<PermitDetails>('getPermitDetails', params);
  }

  /**
   * GET /api/rc_permit/getPermitDetails/{id} — path param variant.
   * Alternative call pattern — some tools only trace string concatenation,
   * not HttpParams. Both patterns resolve to the same endpoint.
   */
  getPermitDetailsByPath(id: string): Observable<PermitDetails> {
    return this.api.get<PermitDetails>(`getPermitDetails/${id}`);
  }
}
