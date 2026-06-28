import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent }     from './app.component';

/**
 * Shell AppModule — root module for the Angular ERP shell application.
 *
 * Module Federation context:
 *   This shell loads micro-frontends lazily via the router. The federation
 *   runtime (configured in webpack.config.js) fetches each remoteEntry.js
 *   at startup and registers all exposed modules into __webpack_modules__.
 *   This registration happens regardless of whether the user navigates to
 *   that feature — which is why unnavigated modules (EP-B-003, EP-B-004)
 *   are still present in the module registry.
 */
@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
