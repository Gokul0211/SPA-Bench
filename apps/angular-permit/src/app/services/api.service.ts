import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {

  private readonly appConfig: AppConfigService;

  private readonly http: HttpClient;

  constructor(appConfig: AppConfigService, http: HttpClient) {
    this.appConfig = appConfig;
    this.http = http;
  }

  getBase(): string {
    return this.appConfig.getApiBase();
  }

  getStagingBase(): string {
    return this.appConfig.getStagingBase();
  }

  /**
   * Builds default HTTP headers for authenticated requests.
   * Authorization header is populated from localStorage token on every request.
   */
  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem(
      this.appConfig.getFeatureFlags() ? 'ptw_token' : ''
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
