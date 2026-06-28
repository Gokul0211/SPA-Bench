/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/services/order.service.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * This file contains the feature flag ternary that produces two separate
 * manifest endpoints — both branches must appear in tool output.
 *
 * EP-A-008: GET /api/v1/orders
 *   technique: url_conditional_feature_flag (Phase 2)
 *   exclusive: false
 *   redundant_techniques: [ts_service_file_recovery] (Phase 1.5)
 *   confidence_tier: BACKEND_API
 *   auth_required: true | auth_method: form
 *   This is the FALSE branch of the feature flag (useV2Orders: false in prod).
 *   It is the currently active path in the production app.
 *
 * EP-A-009: GET /api/v2/orders
 *   technique: url_conditional_feature_flag (Phase 2)
 *   exclusive: false
 *   redundant_techniques: [ts_service_file_recovery] (Phase 1.5)
 *   confidence_tier: BACKEND_API
 *   auth_required: true | auth_method: form
 *   This is the TRUE branch (useV2Orders: true). Not active in production
 *   but the endpoint exists and is callable on the REST backend.
 *
 * TC-P2-007 (url_conditional_feature_flag):
 * "featureFlags.new ? '/v2/orders' : '/v1/orders'"
 * "Both branches must be enumerated."
 * "Tools that only follow one branch of the conditional miss half the API surface."
 * "In a real production app under active development, the legacy branch may
 *  still be callable even when the feature flag is enabled — both are valid
 *  attack surface."
 *
 * MINIFIED BUNDLE PATTERN:
 * ─────────────────────────────────────────────────────────────────────────
 * In bundle.js the ternary becomes:
 *   return this.t.get(this.n.featureFlags.useV2Orders?"/api/v2/orders":"/api/v1/orders")
 * where this.n = AppConfigService instance, this.t = HttpClient instance.
 *
 * Regex tools: extract both "/api/v2/orders" and "/api/v1/orders" — they actually
 * PASS this test case because both strings are string literals. However, they
 * cannot associate them with the correct method or resolve the condition.
 *
 * For the benchmark, both URLs must appear in the tool's output with the
 * correct method (GET) to score true positives for EP-A-008 and EP-A-009.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';

export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Order {
  orderId: string;
  permitId: string;
  workSiteId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  // v2 only fields — absent in v1 response
  lineItems?: OrderLineItem[];
  estimatedCost?: number;
}

export interface OrderLineItem {
  itemId: string;
  description: string;
  quantity: number;
  unitCost: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  /**
   * AppConfigService — provides feature flags and auth config.
   * Minified field: single-char identifier (e.g. `n`).
   */
  private readonly appConfig: AppConfigService;

  /**
   * HttpClient — used directly here (not via ApiService) because orders
   * are at /api/v1/ or /api/v2/ — not under /api/rc_permit/.
   * Minified field: single-char identifier (e.g. `t`).
   */
  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.appConfig = appConfig;
    this.http = http;
  }

  /**
   * Builds auth headers from localStorage token.
   */
  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  // ── EP-A-008 + EP-A-009 ───────────────────────────────────────────────────
  /**
   * GET /api/v1/orders  (EP-A-008, false branch)
   * GET /api/v2/orders  (EP-A-009, true branch)
   *
   * TC-P2-007 (url_conditional_feature_flag, Phase 2):
   *
   * The URL selected depends on environment.featureFlags.useV2Orders.
   * In the benchmark's default environment (useV2Orders: false), the app calls
   * /api/v1/orders. But /api/v2/orders is a live, callable endpoint on the
   * REST backend — it returns paginated results with full lineItems arrays.
   *
   * A complete discovery tool must report BOTH:
   *   EP-A-008: GET http://localhost:3001/api/v1/orders
   *   EP-A-009: GET http://localhost:3001/api/v2/orders
   *
   * A tool that only evaluates the false branch (the active production path)
   * misses EP-A-009. A tool that only evaluates the true branch misses EP-A-008.
   * Only a tool that extracts BOTH sides of the ternary gets full recall here.
   *
   * In the minified bundle this ternary is preserved as:
   *   this.t.get(this.n.getFeatureFlags().useV2Orders?"/api/v2/orders":"/api/v1/orders",...)
   *
   * Both string literals "/api/v1/orders" and "/api/v2/orders" appear in the
   * minified source — regex tools can find them as fragments, Phase 2 tools
   * can reconstruct the full URLs with base.
   */
  getOrders(page: number = 1, limit: number = 20): Observable<OrderListResponse> {
    const flags = this.appConfig.getFeatureFlags();
    const endpoint = flags.useV2Orders ? '/api/v2/orders' : '/api/v1/orders';
    return this.http.get<OrderListResponse>(endpoint, {
      headers: this.buildHeaders(),
      params: { page: page.toString(), limit: limit.toString() },
    });
  }

  /**
   * Explicit v1 accessor — used by legacy report views.
   * Ensures /api/v1/orders is called even when feature flag is enabled.
   * This provides a second static reference to the v1 URL (EP-A-008).
   */
  getOrdersV1(page: number = 1): Observable<OrderListResponse> {
    return this.http.get<OrderListResponse>('/api/v1/orders', {
      headers: this.buildHeaders(),
      params: { page: page.toString() },
    });
  }

  /**
   * Explicit v2 accessor — used by the new order management dashboard.
   * This provides a second static reference to the v2 URL (EP-A-009).
   * Returns full lineItems and estimatedCost — not in v1 response.
   */
  getOrdersV2(page: number = 1, includeLineItems: boolean = true): Observable<OrderListResponse> {
    return this.http.get<OrderListResponse>('/api/v2/orders', {
      headers: this.buildHeaders(),
      params: {
        page: page.toString(),
        includeLineItems: includeLineItems.toString(),
      },
    });
  }
}
