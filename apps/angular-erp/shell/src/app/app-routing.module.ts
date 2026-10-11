import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

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
