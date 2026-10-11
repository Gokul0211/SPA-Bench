import{Injectable}from'@angular/core';
@Injectable({providedIn:'root'})
export class HrService{
  private readonly apiBase='http://localhost:3002';
  constructor(private http:any){}
  getHr(){return this.http.get(this.apiBase+'/api/v2/hr/employees');}
}
