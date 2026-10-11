import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { AppConfigService } from './services/app-config.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="permit-app" *ngIf="!loading">

      <!-- Main navigation -->
      <nav class="main-nav">
        <a routerLink="/dashboard">Dashboard</a>
        <a routerLink="/permits">Permits</a>
        <a routerLink="/orders">Work Orders</a>
        <a routerLink="/reports" *ngIf="isAuthenticated">Reports</a>
        <a routerLink="/admin" *ngIf="isAdmin">Admin</a>
      </nav>

      <router-outlet></router-outlet>

      <form id="emergency-stop-form" method="POST">
        <button
          type="submit"
          formaction="/api/rc_permit/submitEmergencyStop"
          class="emergency-stop-btn"
          title="Immediately suspend all active permits at this work site">
          EMERGENCY STOP
        </button>
      </form>

      <button
        *ngIf="isAdmin"
        onclick="loadModule('/admin-module.js')"
        class="admin-panel-btn">
        Open Admin Panel
      </button>

    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        var role = localStorage.getItem('ptw_role');
        if (role === 'admin') {
          import('/admin-module.js').then(function(m) {
            if (m && m.initAdmin) m.initAdmin();
          });
        }
      });
    </script>
  `,
})
export class AppComponent implements OnInit {
  loading = true;
  isAuthenticated = false;
  isAdmin = false;

  constructor(
    private readonly authService: AuthService,
    private readonly appConfig: AppConfigService,
  ) {}

  ngOnInit(): void {
    this.authService.isLoggedIn$.subscribe(loggedIn => {
      this.isAuthenticated = loggedIn;
      this.isAdmin = this.authService.getRole() === 'admin';
    });

    this.loadCurrentUserProfile();

    this.loadAppConfig();
  }

  private loadCurrentUserProfile(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.loading = false;
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(() => { this.loading = false; })
      .catch(() => { this.loading = false; });
  }

  private loadAppConfig(): void {
    fetch('/api/rc_permit/appConfig')
      .then(r => r.json())
      .catch(() => { /* swallow — config load is non-critical */ });
  }
}
