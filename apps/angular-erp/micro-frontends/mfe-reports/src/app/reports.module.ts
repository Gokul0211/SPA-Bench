import{Injectable}from'@angular/core';
@Injectable({providedIn:'root'})
export class ReportsService{
  private readonly apiBase='http://localhost:3002';
  constructor(private http:any){}
  getReports(){return this.http.get(this.apiBase+'/api/v2/reports');}
}
