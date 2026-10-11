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

  private readonly appConfig: AppConfigService;

  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.appConfig = appConfig;
    this.http = http;
  }

  /**
   * Builds auth headers from localStorage token.
   */
  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getOrders(page: number = 1, limit: number = 20): Observable<OrderListResponse> {
    const flags = this.appConfig.getFeatureFlags();
    const endpoint = flags.useV2Orders ? '/api/v2/orders' : '/api/v1/orders';
    return this.http.get<OrderListResponse>(endpoint, {
      headers: this.buildHeaders(),
      params: { page: page.toString(), limit: limit.toString() },
    });
  }

  getOrdersV1(page: number = 1): Observable<OrderListResponse> {
    return this.http.get<OrderListResponse>('/api/v1/orders', {
      headers: this.buildHeaders(),
      params: { page: page.toString() },
    });
  }

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
