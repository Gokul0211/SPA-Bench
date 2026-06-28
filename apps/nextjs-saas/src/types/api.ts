export interface ApiResponse<T> { data: T; status: number; }
export type Period = 'last_7d'|'last_30d'|'last_90d'|'last_365d';
