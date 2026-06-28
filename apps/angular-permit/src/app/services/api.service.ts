/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/services/api.service.ts
 *
 * BENCHMARK RELEVANCE — DI CHAIN LEVEL 2 of 3
 * ────────────────────────────────────────────────────────────────────────────
 * This is the second link in the 3-file constructor injection chain tested by
 * TC-P2-009 (inter_proc_constructor_multi) and EP-A-002.
 *
 * Chain summary:
 *   environment.ts
 *     └─ AppConfigService.getApiBase()        (Level 1, app-config.service.ts)
 *          └─ ApiService.getBase()             ← THIS FILE (Level 2)
 *               └─ PermitService.http.get()    (Level 3, permit.service.ts)
 *
 * After minification by Angular CLI / Webpack:
 *   - ApiService class → mangled class identifier
 *   - getBase() → property on minified prototype (e.g. `getBase` stays if
 *     not fully mangled, or becomes a single-char method)
 *   - this.appConfig private field → renamed (e.g. `s`)
 *   - The entire method chain becomes: return this.s.getApiBase()
 *     which itself returns this.s.e (the apiBase string)
 *
 * This extra indirection level is what defeats single-pass AST tools. JSLuice
 * sees `this.o.getBase()` in PermitService and cannot trace `getBase()` across
 * this file without inter-procedural analysis.
 *
 * ApiService also provides the HttpClient wrapper methods used across all
 * permit domain services — centralising common headers (Authorization, Content-Type)
 * so individual services only call this.api.get() rather than this.http.get()
 * directly. This is the canonical Angular enterprise pattern.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  /**
   * Reference to AppConfigService — the first DI level.
   * In the minified bundle this field is renamed (e.g. `s` or `c`).
   * Inter-procedural resolution must trace: this.s → AppConfigService instance
   * → AppConfigService.getApiBase() → environment.apiBaseUrl string.
   */
  private readonly appConfig: AppConfigService;

  /**
   * HttpClient injected by Angular DI — used in get/post/put/delete helpers.
   * Minified field name in bundle: single-char (e.g. `h`).
   */
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.appConfig = appConfig;
    this.http = http;
  }

  /**
   * Returns the resolved API base URL.
   * Called by PermitService, AdminService, OrderService as their URL foundation.
   *
   * In the minified bundle this becomes something like:
   *   getBase() { return this.s.getApiBase() }
   * or inlined as a getter. The key is that `this.o` in PermitService resolves
   * to THIS service, and `this.o.getBase()` resolves to THIS method.
   *
   * TC-P2-009 (inter_proc_constructor_multi, Phase 2, exclusive: true):
   * A tool that traces this chain correctly reconstructs the base URL.
   */
  getBase(): string {
    return this.appConfig.getApiBase();
  }

  /**
   * Returns the staging API base (development only).
   * Provides the second-level access point for EP-A-005.
   */
  getStagingBase(): string {
    return this.appConfig.getStagingBase();
  }

  /**
   * Builds default HTTP headers for authenticated requests.
   * Authorization header is populated from localStorage token on every request.
   */
  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem(
      this.appConfig.getFeatureFlags() ? 'spabench_permit_token' : ''
    );
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  /**
   * GET wrapper — used by all read-only permit operations.
   * The headers are injected here so PermitService never handles auth directly.
   */
  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(this.getBase() + path, {
      headers: this.buildHeaders(),
      params,
    });
  }

  /**
   * POST wrapper — used by createPermit (EP-A-003) and auth flows.
   */
  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.getBase() + path, body, {
      headers: this.buildHeaders(),
    });
  }

  /**
   * PUT wrapper — used by update operations (permit status updates).
   */
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.getBase() + path, body, {
      headers: this.buildHeaders(),
    });
  }

  /**
   * DELETE wrapper — used by permit cancellation flows.
   */
  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.getBase() + path, {
      headers: this.buildHeaders(),
    });
  }
}
