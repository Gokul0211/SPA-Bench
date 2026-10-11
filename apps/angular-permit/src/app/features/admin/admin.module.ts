import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// These imports cause all four service files to be bundled into this chunk
import { AdminPermitService } from './services/admin-permit.service';
import { HazardAssessmentService } from './services/hazard-assessment.service';
import { AuditService } from './services/audit.service';
import { UserManagementService } from './services/user-management.service';

const routes: Routes = [
  {
    path: '',
    // AdminDashboardComponent would be here in a full build

    children: [
      { path: '', redirectTo: 'permits', pathMatch: 'full' },
      { path: 'permits', component: class AdminPermitsStub {} },
      { path: 'hazards', component: class HazardsStub {} },
      { path: 'audit', component: class AuditStub {} },
      { path: 'users', component: class UsersStub {} },
    ],
  },
];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
  ],
  providers: [
    // Services are provided here (not root) so they are tree-shaken into this chunk
    AdminPermitService,
    HazardAssessmentService,
    AuditService,
    UserManagementService,
  ],
})
export class AdminModule {}
