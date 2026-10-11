import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {

  private readonly apiBase: string;

  private readonly stagingBase: string;

  private readonly oauthEndpoint: string;

  constructor() {
    this.apiBase = environment.apiBaseUrl;
    this.stagingBase = environment.stagingApiUrl || '';
    this.oauthEndpoint = environment.oauthTokenEndpoint || '';
  }

  getApiBase(): string {
    return this.apiBase;
  }

  getStagingBase(): string {
    return this.stagingBase;
  }

  getOAuthEndpoint(): string {
    return this.oauthEndpoint;
  }

  getFeatureFlags(): typeof environment.featureFlags {
    return environment.featureFlags;
  }
}
