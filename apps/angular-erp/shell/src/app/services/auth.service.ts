import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: {
    username: string;
    role: string;
  };
}

export interface AuthState {
  token: string | null;
  username: string | null;
  role: string | null;
  authenticated: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBase = environment.apiBaseUrl;

  private authState$ = new BehaviorSubject<AuthState>({
    token: null,
    username: null,
    role: null,
    authenticated: false,
  });

  readonly state$ = this.authState$.asObservable();

  constructor(private http: HttpClient) {
    const token = sessionStorage.getItem(environment.authTokenKey);
    if (token) {
      this.authState$.next({ token, username: null, role: null, authenticated: true });
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiBase}/api/auth/login`, { username, password })
      .pipe(
        tap((res) => {
          this.authState$.next({
            token:         res.token,
            username:      res.user.username,
            role:          res.user.role,
            authenticated: true,
          });
          // Store token for page refresh persistence
          sessionStorage.setItem(environment.authTokenKey, res.token);
        }),
        catchError((err) => {
          this.authState$.next({ token: null, username: null, role: null, authenticated: false });
          return throwError(() => err);
        }),
      );
  }

  logout(): void {
    sessionStorage.removeItem(environment.authTokenKey);
    this.authState$.next({ token: null, username: null, role: null, authenticated: false });
  }

  getToken(): string | null {
    return this.authState$.value.token
      ?? sessionStorage.getItem(environment.authTokenKey);
  }

  isAuthenticated(): boolean {
    return this.authState$.value.authenticated
      || !!sessionStorage.getItem(environment.authTokenKey);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }
}
