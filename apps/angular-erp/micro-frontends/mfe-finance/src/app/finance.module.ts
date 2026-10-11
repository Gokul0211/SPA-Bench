import{Injectable}from'@angular/core';
@Injectable({providedIn:'root'})
export class FinanceService{
  private readonly apiBase='http://localhost:3002';
  constructor(private http:any){}
  getFinance(){return this.http.get(this.apiBase+'/api/v2/finance/summary');}
}
