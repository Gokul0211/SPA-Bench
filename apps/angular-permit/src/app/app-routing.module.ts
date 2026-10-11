import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./features/login/login.module').then(m => m.LoginModule),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
    // AuthGuard applied here — unauthenticated users redirected to /login
    // canActivate: [AuthGuard],
  },
  {
    path: 'permits',
    loadChildren: () =>
      import('./features/permits/permits.module').then(m => m.PermitsModule),
    // canActivate: [AuthGuard],
  },
  {
    path: 'orders',
    loadChildren: () =>
      import('./features/orders/orders.module').then(m => m.OrdersModule),
    // canActivate: [AuthGuard],
  },

  {
    path: 'admin',

    loadChildren: () =>
      import('./features/admin/admin.module').then(m => m.AdminModule),
    // canActivate: [AuthGuard, AdminGuard],
  },
  {
    path: 'reports',

    loadChildren: () =>
      import('./features/reports/reports.module').then(m => m.ReportsModule),
    // canActivate: [AuthGuard],
  },

  {
    path: '**',
    redirectTo: '/dashboard',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
