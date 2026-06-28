/**
 * SPABench App A — Angular Permit-to-Work SPA
 * src/app/app.module.ts
 *
 * BENCHMARK RELEVANCE:
 * ────────────────────────────────────────────────────────────────────────────
 * The Angular root module. After source map decompilation (Phase 1.5) this file
 * confirms the DI wiring that the benchmark relies on:
 *   - All services are declared as providedIn: 'root' (tree-shakeable singletons)
 *   - AppRoutingModule is imported — confirms lazy-loaded routes exist
 *   - HttpClientModule is imported — HttpClient is available via DI
 *   - ReactiveFormsModule is imported — FormBuilder and FormGroup are available
 *
 * The lazy-loaded routes in AppRoutingModule (app-routing.module.ts) are the
 * reason that admin and reports chunks are not bundled in main.js — they only
 * download when those routes are navigated to.
 *
 * TC-P3-008 (lazy_loaded_chunk):
 * The loadChildren() calls in the routing module cause Angular CLI to emit
 * separate chunk files for permit-admin and permit-reports. These chunks contain
 * additional service files (and thus additional endpoints) that are invisible
 * to Phase 1/2 analysis of main.js until Phase 3 triggers their download via
 * route navigation. The feedback loop sends them back to Phase 2 analysis.
 *
 * TC-P1-002 (html_attr_onclick):
 * The compiled app produces an index.html with an onclick attribute that loads
 * the admin chunk — one of the Phase 1 Federation Discovery test cases for App A.
 *
 * TC-P1-003 (html_attr_ng_include):
 * The reports module uses ng-include for its dashboard template — another
 * Phase 1 Federation Discovery test case.
 */

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Services — all providedIn: 'root', listed here for documentation clarity
// AppConfigService, ApiService, PermitService, AuthService, AdminService, OrderService
// are all tree-shakeable singletons via providedIn: 'root' in their decorators.

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,         // Makes HttpClient available for injection
    ReactiveFormsModule,      // Makes FormBuilder, FormGroup available — TC-P2-022
    AppRoutingModule,         // Registers routes including lazy-loaded chunks
  ],
  providers: [
    // All services use providedIn: 'root' — no manual provider registration needed.
    // This is the Angular 6+ best practice and what real Angular 8 apps do.
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
