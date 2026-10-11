import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  CreatePermitRequest,
  PermitResponse,
  PermitDetails,
  PermitTypeListResponse,
  WorkOrderResponse,
} from '../models/permit.models';

@Injectable({
  providedIn: 'root',
})
export class PermitService {

  private readonly api: ApiService;

  constructor(api: ApiService) {
    this.api = api;
  }

  getPermitType(): Observable<PermitTypeListResponse> {
    return this.api.get<PermitTypeListResponse>('getPermitType');
  }

  getWorkOrder(workOrderId: string): Observable<WorkOrderResponse> {
    const params = new HttpParams().set('workOrderId', workOrderId);
    return this.api.get<WorkOrderResponse>('getWorkOrder', params);
  }

  createPermit(request: CreatePermitRequest): Observable<PermitResponse> {
    return this.api.post<PermitResponse>('createPermit', request);
  }

  getPermitDetails(id: string): Observable<PermitDetails> {
    const params = new HttpParams().set('id', id);
    return this.api.get<PermitDetails>('getPermitDetails', params);
  }

  getPermitDetailsByPath(id: string): Observable<PermitDetails> {
    return this.api.get<PermitDetails>(`getPermitDetails/${id}`);
  }
}
