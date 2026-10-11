import{Injectable}from'@angular/core';
@Injectable({providedIn:'root'})
export class OrdersService{
  private readonly apiBase='http://localhost:3002';
  constructor(private http:any){}
  getOrders(){return this.http.get(this.apiBase+'/api/v2/orders');}
}
