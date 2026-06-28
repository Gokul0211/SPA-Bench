import { Component, OnInit } from '@angular/core';
import { AuthService }       from './services/auth.service';

@Component({
  selector: 'app-root',
  template: `
    <nav class="erp-nav">
      <span class="erp-brand">SPABench ERP</span>
      <a routerLink="/dashboard">Dashboard</a>
      <a routerLink="/orders">Orders</a>
      <a routerLink="/users">Users</a>
      <a routerLink="/reports">Reports</a>
      <a routerLink="/finance">Finance</a>
      <a routerLink="/hr">HR</a>
      <a routerLink="/analytics">Analytics</a>
    </nav>
    <main>
      <router-outlet></router-outlet>
    </main>
  `,
})
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    // Spawn background sync worker (TC-P1-008: web_worker_constructor)
    // The Worker URL is a static string literal here — discoverable via AST.
    // The worker itself makes API calls invisible to main-thread interceptors.
    if (typeof Worker !== 'undefined') {
      const worker = new Worker('/background-sync.worker.js');
      const token = this.auth.getToken();
      if (token) {
        worker.postMessage({ type: 'INIT', payload: { token } });
      }
    }
  }
}
