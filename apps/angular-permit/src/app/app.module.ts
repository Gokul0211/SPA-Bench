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
    ReactiveFormsModule,
    AppRoutingModule,         // Registers routes including lazy-loaded chunks
  ],
  providers: [
    // All services use providedIn: 'root' — no manual provider registration needed.
    // This is the Angular 6+ best practice and what real Angular 8 apps do.
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
