/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/features/mobile-legacy/mobile-legacy.service.ts
 *
 * BUNDLE LOCATION: permit-mobile-legacy.js (commented-out chunk)
 *
 * BENCHMARK RELEVANCE — TC-P1-010 (commented_script, Phase 1)
 * ────────────────────────────────────────────────────────────────────────────
 * This module is "disabled" — its script tag in index.html is commented out:
 *   <!-- <script src="/permit-mobile-legacy.js"> -->
 *
 * TC-P1-010 (commented_script, Phase 1):
 * "This endpoint exists and is callable. It is excluded from the production
 * navigation flow but the code is still bundled. Represents a common situation
 * in enterprise code where legacy modules are 'disabled' by commenting out
 * their script tag but never actually removed."
 *
 * A Phase 1 tool that parses HTML comments in index.html finds the URL
 * `/permit-mobile-legacy.js` and adds it to the JS analysis queue. When Phase 2
 * analyses this file, it finds the mobile API endpoints below.
 *
 * A tool that does NOT parse HTML comments misses this chunk entirely — and
 * with it, all mobile API endpoints. These are not small test endpoints:
 * the mobile API is a full parallel API surface with its own authentication
 * and data access patterns.
 *
 * INDEX.HTML PATTERN (to be placed in dist/index.html in Phase 3):
 * ─────────────────────────────────────────────────────────────────────────────
 *   <!-- Legacy mobile module — disabled pending security review -->
 *   <!-- <script src="/permit-mobile-legacy.js"></script> -->
 *   <!-- Enable by removing comment tags above -->
 *
 * SECURITY RELEVANCE:
 * The mobile API bypasses some desktop-flow checks (form validation,
 * CSRF tokens) because it was built for a native app client. The endpoints
 * are still live and callable via REST — they represent legacy attack surface
 * that an assessor would prioritise once found.
 *
 * ENDPOINTS IN THIS FILE:
 *   GET  /api/mobile/v1/permits              (mobile permit list)
 *   POST /api/mobile/v1/permits/quick-submit (simplified permit creation)
 *   GET  /api/mobile/v1/work-orders          (work order list)
 *   POST /api/mobile/v1/location/checkin     (GPS check-in)
 *   GET  /api/mobile/v1/offline-sync         (offline data sync bundle)
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MobilePermit {
  permitId: string;
  type: string;
  status: string;
  workSiteId: string;
  startDate: string;
  endDate: string;
}

export interface QuickSubmitRequest {
  workSiteId: string;
  permitType: string;
  supervisorId: string;
  startDate: string;
  endDate: string;
  hazardLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  // Simplified — fewer required fields than the desktop createPermit
}

export interface LocationCheckin {
  userId: string;
  workSiteId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  deviceId: string;
}

export interface OfflineSyncBundle {
  permits: MobilePermit[];
  workOrders: unknown[];
  workSites: unknown[];
  lastSyncAt: string;
  nextSyncToken: string;
}

/**
 * Mobile API base — separate from the desktop API base.
 * This is a string literal because the mobile module doesn't use the Angular DI
 * chain — it was built as a standalone service with hardcoded config.
 * This makes it discoverable by simpler static analysis once the chunk is found.
 */
const MOBILE_API_BASE = 'http://localhost:4001/api/mobile/v1/';

@Injectable({
  providedIn: 'root', // In root because this module is standalone, not lazy-loaded via routing
})
export class MobileLegacyService {
  constructor(private readonly http: HttpClient) {}

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('spabench_permit_token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'X-Mobile-Client': 'permit-app/2.1',  // Mobile-specific header
    });
  }

  /**
   * GET /api/mobile/v1/permits
   * Mobile permit list — optimised for small screens, fewer fields than desktop.
   */
  getMobilePermits(
    workSiteId?: string,
    status?: string,
  ): Observable<{ permits: MobilePermit[]; total: number }> {
    let params = new HttpParams();
    if (workSiteId) params = params.set('workSiteId', workSiteId);
    if (status) params = params.set('status', status);
    return this.http.get<{ permits: MobilePermit[]; total: number }>(
      MOBILE_API_BASE + 'permits',
      { headers: this.buildHeaders(), params },
    );
  }

  /**
   * POST /api/mobile/v1/permits/quick-submit
   * Simplified permit creation — fewer required fields than desktop createPermit.
   * security_relevant: bypasses some desktop-flow validation checks.
   */
  quickSubmitPermit(request: QuickSubmitRequest): Observable<MobilePermit> {
    return this.http.post<MobilePermit>(
      MOBILE_API_BASE + 'permits/quick-submit',
      request,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * GET /api/mobile/v1/work-orders
   */
  getMobileWorkOrders(workSiteId?: string): Observable<{ workOrders: unknown[] }> {
    const params = workSiteId ? new HttpParams().set('workSiteId', workSiteId) : undefined;
    return this.http.get<{ workOrders: unknown[] }>(
      MOBILE_API_BASE + 'work-orders',
      { headers: this.buildHeaders(), params },
    );
  }

  /**
   * POST /api/mobile/v1/location/checkin
   * GPS check-in — worker arrives at work site, logs location.
   * security_relevant: exposes GPS tracking API surface.
   */
  locationCheckin(checkin: LocationCheckin): Observable<{ checkinId: string }> {
    return this.http.post<{ checkinId: string }>(
      MOBILE_API_BASE + 'location/checkin',
      checkin,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * GET /api/mobile/v1/offline-sync
   * Downloads a bundle of data for offline use.
   * Parameter: `since` (ISO timestamp) — only sync changes after this time.
   */
  getOfflineSyncBundle(since?: string): Observable<OfflineSyncBundle> {
    const params = since ? new HttpParams().set('since', since) : undefined;
    return this.http.get<OfflineSyncBundle>(
      MOBILE_API_BASE + 'offline-sync',
      { headers: this.buildHeaders(), params },
    );
  }
}
