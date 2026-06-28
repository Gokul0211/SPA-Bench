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

/**
 * SPABench InventoryService — EP-B-003
 *
 * This service becomes __webpack_modules__[847] in dist/mfe-inventory/main.js.
 *
 * TC-P3-003 (webpack_registry_unnavigated):
 *   The shell has no route to InventoryModule, so this service is never
 *   instantiated during navigation. A tool harvesting __webpack_modules__
 *   at runtime must force-evaluate module 847 to find:
 *     GET http://localhost:3002/api/inventory/items (EP-B-003)
 *
 * The OData query parameters ($filter, $top, $skip) are part of the endpoint
 * parameter surface — manifest records them as EP-B-003.parameters[0..2].
 *
 * source_file:           micro-frontends/mfe-inventory/src/app/services/inventory.service.ts
 * minified_location:     mfe-inventory/main.js:1:8841
 */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  // Base URL injected through the Angular DI environment token
  private readonly apiBase = 'http://localhost:3002';
  private readonly inventoryEndpoint = '/api/inventory/items';

  constructor(private http: HttpClient) {}

  /**
   * EP-B-003: GET http://localhost:3002/api/inventory/items
   *
   * Supports OData query parameters for filtering, pagination, and ordering.
   * The rest-backend serves this endpoint on /api/inventory/items with full
   * @odata.context and @odata.count fields in the response.
   */
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
