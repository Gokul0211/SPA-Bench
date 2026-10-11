import{Injectable}from'@angular/core';
@Injectable({providedIn:'root'})
export class AnalyticsService{
  private readonly apiBase='http://localhost:3002';
  constructor(private http:any){}
  getAnalytics(){return this.http.get(this.apiBase+'/api/v2/analytics/metrics');}
}
