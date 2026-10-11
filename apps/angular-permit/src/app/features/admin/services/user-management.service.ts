import { Injectable, Inject, forwardRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';

export interface ManagedUser {
  userId: string;
  username: string;
  email: string;
  role: 'operator' | 'admin' | 'supervisor';
  active: boolean;
  department: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface WorkflowInfo {
  userId: string;
  pendingApprovals: number;
  assignedPermits: number;
  workflowStage: string;
}

function getAdminBaseUrl(useStaging: boolean): string {
  if (useStaging) {

    return 'https://staging-api.rc-permit.internal/v2/admin/';
  }

  return 'http://localhost:4001/api/admin/';
}

@Injectable()
export class UserManagementService {
  private readonly http: HttpClient;
  private readonly appConfig: AppConfigService;

  private readonly workflowHelper: WorkflowHelperService;

  constructor(
    http: HttpClient,
    appConfig: AppConfigService,
    @Inject(forwardRef(() => WorkflowHelperService)) workflowHelper: WorkflowHelperService,
  ) {
    this.http = http;
    this.appConfig = appConfig;
    this.workflowHelper = workflowHelper;
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('ptw_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getUsers(page: number = 1, useStaging: boolean = false): Observable<{
    users: ManagedUser[];
    total: number;
  }> {
    const base = getAdminBaseUrl(useStaging);
    return this.http.get<{ users: ManagedUser[]; total: number }>(
      base + 'users',
      { headers: this.buildHeaders() },
    );
  }

  getUserProfile(userId: string, useStaging: boolean = false): Observable<ManagedUser> {
    const base = getAdminBaseUrl(useStaging);
    return this.http.get<ManagedUser>(
      `${base}users/${userId}/profile`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * POST /api/admin/users
   */
  createUser(user: Omit<ManagedUser, 'userId' | 'createdAt' | 'lastLoginAt'>): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(
      getAdminBaseUrl(false) + 'users',
      user,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * PATCH /api/admin/users/{id}/role
   */
  updateUserRole(userId: string, role: ManagedUser['role']): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(
      `${getAdminBaseUrl(false)}users/${userId}/role`,
      { role },
      { headers: this.buildHeaders() },
    );
  }

  /**
   * DELETE /api/admin/users/{id}
   */
  deactivateUser(userId: string): Observable<{ deactivated: boolean }> {
    return this.http.delete<{ deactivated: boolean }>(
      `${getAdminBaseUrl(false)}users/${userId}`,
      { headers: this.buildHeaders() },
    );
  }

  getUserWorkflow(userId: string): Observable<WorkflowInfo> {

    const workflowBase = this.workflowHelper.getUserWorkflowBase();
    return this.http.get<WorkflowInfo>(
      `${workflowBase}${userId}/workflow`,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * Called by WorkflowHelperService — creates the back-edge of the cycle.
   * This method is the cycle's return point.
   */
  getWorkflowBase(): string {
    // The cycle: calls back into workflowHelper which calls back here
    return this.workflowHelper.getUserWorkflowBase();
  }
}

@Injectable()
export class WorkflowHelperService {
  constructor(
    @Inject(forwardRef(() => UserManagementService))
    private readonly userMgmt: UserManagementService,
  ) {}

  getUserWorkflowBase(): string {

    return this.userMgmt.getWorkflowBase();
  }
}
