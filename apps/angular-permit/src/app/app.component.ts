/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/app.component.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * The root Angular component. After compilation, its template HTML produces
 * several Phase 1 discovery patterns that appear in the compiled index.html.
 *
 * TC-P1-004 (html_attr_formaction, Phase 1):
 * A form button in the template uses the `formaction` attribute to point
 * directly to an API endpoint — bypassing Angular's usual form submission flow.
 * The compiled HTML contains:
 *   <button type="submit" formaction="/api/rc_permit/submitEmergencyStop">
 * Phase 1 scans all HTML attributes including `formaction` and finds this URL.
 *
 * TC-P1-007 (dynamic_import_inline, Phase 1):
 * The component template includes an inline script tag (placed outside Angular's
 * view encapsulation) that uses dynamic import() to load the admin chunk:
 *   <script>
 *     document.addEventListener('DOMContentLoaded', function() {
 *       if (window.__spabench_role === 'admin') {
 *         import('/admin-panel.chunk.js').then(m => m.initAdmin());
 *       }
 *     });
 *   </script>
 * Phase 1 scans inline script content for import() calls and finds the chunk URL.
 *
 * TC-P3-001 (xhr_interception, Phase 3):
 * ngOnInit() makes an XHR call on page load to fetch the current user's profile.
 * Phase 3 dynamic interception captures this XHR as soon as the page loads.
 *
 * TC-P3-002 (fetch_interception, Phase 3):
 * ngOnInit() also makes a native fetch() call to load app configuration.
 * Phase 3 intercepts both XHR and fetch traffic on page load.
 */

import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { AppConfigService } from './services/app-config.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="spabench-app" *ngIf="!loading">

      <!-- Main navigation -->
      <nav class="main-nav">
        <a routerLink="/dashboard">Dashboard</a>
        <a routerLink="/permits">Permits</a>
        <a routerLink="/orders">Work Orders</a>
        <a routerLink="/reports" *ngIf="isAuthenticated">Reports</a>
        <a routerLink="/admin" *ngIf="isAdmin">Admin</a>
      </nav>

      <router-outlet></router-outlet>

      <!-- TC-P1-004 (html_attr_formaction):
           Emergency stop form — uses formaction to bypass Angular router.
           The formaction attribute points directly to the API endpoint URL.
           Phase 1 scans all HTML form-related attributes and finds this. -->
      <form id="emergency-stop-form" method="POST">
        <button
          type="submit"
          formaction="/api/rc_permit/submitEmergencyStop"
          class="emergency-stop-btn"
          title="Immediately suspend all active permits at this work site">
          EMERGENCY STOP
        </button>
      </form>

      <!-- TC-P1-002 (html_attr_onclick):
           Admin panel loader button — onclick attribute loads the admin chunk.
           Phase 1 finds this in the compiled HTML before any JS executes. -->
      <button
        *ngIf="isAdmin"
        onclick="loadModule('/admin-chunk.js')"
        class="admin-panel-btn">
        Open Admin Panel
      </button>

    </div>

    <!-- TC-P1-007 (dynamic_import_inline):
         Inline script uses dynamic import() to load admin chunk conditionally.
         Angular compiles this as a static script block in the output HTML.
         Phase 1 scans inline script content for import() calls. -->
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        var role = localStorage.getItem('spabench_permit_role');
        if (role === 'admin') {
          import('/admin-panel.chunk.js').then(function(m) {
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

    // TC-P3-001 (xhr_interception): XHR on page load
    // Phase 3 intercepts this as soon as the root component initialises.
    this.loadCurrentUserProfile();

    // TC-P3-002 (fetch_interception): native fetch on page load
    this.loadAppConfig();
  }

  /**
   * TC-P3-001 — XHR on page load.
   * Angular's HttpClient uses XHR internally. Phase 3 intercepts this call
   * immediately on page load — before any user interaction.
   */
  private loadCurrentUserProfile(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.loading = false;
      return;
    }
    // Angular HttpClient → XHR — intercepted by Phase 3
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(() => { this.loading = false; })
      .catch(() => { this.loading = false; });
  }

  /**
   * TC-P3-002 — native fetch on page load.
   * Phase 3 intercepts fetch() traffic. This call happens on every page load
   * regardless of auth state — even unauthenticated tools see it.
   */
  private loadAppConfig(): void {
    fetch('/api/rc_permit/appConfig')
      .then(r => r.json())
      .catch(() => { /* swallow — config load is non-critical */ });
  }
}
