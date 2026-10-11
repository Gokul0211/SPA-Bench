import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ReportGeneratorService } from './services/report-generator.service';
import { ComplianceService } from './services/compliance.service';
import { ExportService } from './services/export.service';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: '', redirectTo: 'generate', pathMatch: 'full' },
      { path: 'generate', component: class ReportGenerateStub {} },
      { path: 'compliance', component: class ComplianceStub {} },
      { path: 'export', component: class ExportStub {} },
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
    // Provided here (not root) — tree-shaken into this chunk only
    ReportGeneratorService,
    ComplianceService,
    ExportService,
  ],
})
export class ReportsModule {}
