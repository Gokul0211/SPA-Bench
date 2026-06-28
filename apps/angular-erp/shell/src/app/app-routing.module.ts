import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

/**
 * Shell routing — CRITICAL BENCHMARK CONSTRAINT
 *
 * This routing table intentionally has NO route pointing to the admin
 * or legacy-reports features. This is what makes EP-B-003 and EP-B-004
 * classified as:
 *   exclusive: true
 *   technique: webpack_registry_unnavigated
 *
 * Although mfe-inventory is registered as a remote (and its modules including
 * __webpack_modules__[847] are loaded into the registry when the remoteEntry.js
 * is fetched), the Angular router never navigates to '/inventory', so the
 * InventoryModule is never bootstrapped and module 847 is never called.
 *
 * A tool that relies only on live traffic interception (visiting all navigable
 * routes) will never trigger module 847. Only a tool that reads __webpack_modules__
 * directly and iterates all entries finds EP-B-003 and EP-B-004.
 */
const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('mfeCrm/CrmModule').then((m) => m.CrmModule),
  },
  {
    path: 'orders',
    loadChildren: () =>
      import('mfeOrders/OrdersModule').then((m) => m.OrdersModule),
  },
  {
    path: 'users',
    loadChildren: () =>
      import('mfeUsers/UsersModule').then((m) => m.UsersModule),
  },
  {
    path: 'reports',
    loadChildren: () =>
      import('mfeReports/ReportsModule').then((m) => m.ReportsModule),
  },
  {
    path: 'finance',
    loadChildren: () =>
      import('mfeFinance/FinanceModule').then((m) => m.FinanceModule),
  },
  {
    path: 'hr',
    loadChildren: () =>
      import('mfeHr/HrModule').then((m) => m.HrModule),
  },
  {
    path: 'analytics',
    loadChildren: () =>
      import('mfeAnalytics/AnalyticsModule').then((m) => m.AnalyticsModule),
  },
  // ── NOTE: No '/inventory' route ──────────────────────────────────────────
  // mfe-inventory is registered as a remote (webpack.config.js) but there is
  // no route that loads InventoryModule. The module is registered in
  // __webpack_modules__[847] but never called during navigation.
  //
  // ── NOTE: No '/admin' route ──────────────────────────────────────────────
  // mfe-admin is co-hosted at http://localhost:3002/mfe-admin/remoteEntry.js
  // but there is no route that loads AdminModule. Its LegacyReportService
  // (containing the internal IP 10.0.1.45:8080) is registered but unnavigated.
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { initialNavigation: 'enabledBlocking' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
