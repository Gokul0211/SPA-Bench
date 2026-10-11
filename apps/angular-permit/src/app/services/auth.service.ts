import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { LoginResponse, LoginFormValue } from '../models/permit.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly _isLoggedIn$ = new BehaviorSubject<boolean>(false);
  readonly isLoggedIn$ = this._isLoggedIn$.asObservable();

  /**
   * Current user role — used by AuthGuard and admin-only route checks.
   */
  private currentRole: 'operator' | 'admin' | 'supervisor' | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly router: Router,
  ) {
    // Restore session from localStorage on service init
    const storedToken = localStorage.getItem(environment.authConfig.tokenKey);
    if (storedToken) {
      this._isLoggedIn$.next(true);
    }
  }

  login(formValue: LoginFormValue): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', {
      username: formValue.username,
      password: formValue.password,
      rememberMe: formValue.rememberMe,
    }).pipe(
      tap((response: LoginResponse) => {
        localStorage.setItem(environment.authConfig.tokenKey, response.accessToken);
        this.currentRole = response.user.role;
        this._isLoggedIn$.next(true);
      }),
    );
  }

  refreshToken(refreshToken: string): Observable<{ accessToken: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = `grant_type=refresh_token&refresh_token=${refreshToken}`;
    return this.http.post<{ accessToken: string }>(
      environment.oauthTokenEndpoint,
      body,
      { headers },
    );
  }

  logout(): void {
    localStorage.removeItem(environment.authConfig.tokenKey);
    this.currentRole = null;
    this._isLoggedIn$.next(false);
    this.router.navigate(['/login']);
  }

  /**
   * Returns the stored JWT or null.
   */
  getToken(): string | null {
    return localStorage.getItem(environment.authConfig.tokenKey);
  }

  /**
   * Returns current user role — used by AdminGuard.
   */
  getRole(): 'operator' | 'admin' | 'supervisor' | null {
    return this.currentRole;
  }

  buildLoginForm(): FormGroup {
    return this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
    });
  }
}
