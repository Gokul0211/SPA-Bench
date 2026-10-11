import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  reorderPoint: number;
  warehouseId: string;
  lastUpdated: string;
}

export interface ODataResponse<T> {
  '@odata.context': string;
  '@odata.count':   number;
  value:            T[];
}

export interface InventoryQueryParams {
  $filter?: string;
  $top?:    number;
  $skip?:   number;
  $orderby?: string;
  $select?:  string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  // Base URL injected through the Angular DI environment token
  private readonly apiBase = 'http://localhost:3002';
  private readonly inventoryEndpoint = '/api/inventory/items';

  constructor(private http: HttpClient) {}

  getInventoryItems(params: InventoryQueryParams = {}): Observable<ODataResponse<InventoryItem>> {
    let httpParams = new HttpParams();
    if (params.$filter)  httpParams = httpParams.set('$filter',  params.$filter);
    if (params.$top)     httpParams = httpParams.set('$top',     params.$top.toString());
    if (params.$skip)    httpParams = httpParams.set('$skip',    params.$skip.toString());
    if (params.$orderby) httpParams = httpParams.set('$orderby', params.$orderby);
    if (params.$select)  httpParams = httpParams.set('$select',  params.$select);

    return this.http.get<ODataResponse<InventoryItem>>(
      `${this.apiBase}${this.inventoryEndpoint}`,
      { params: httpParams },
    );
  }

  /**
   * Convenience: get items with stock below reorder point.
   * Uses OData $filter expression.
   */
  getLowStockItems(): Observable<InventoryItem[]> {
    return this.getInventoryItems({
      $filter: 'stock le reorderPoint',
      $orderby: 'stock asc',
    }).pipe(map((res) => res.value));
  }

  /**
   * Paginated inventory for the inventory grid component.
   */
  getPage(page: number, pageSize: number = 25): Observable<ODataResponse<InventoryItem>> {
    return this.getInventoryItems({
      $top:  pageSize,
      $skip: page * pageSize,
    });
  }
}
