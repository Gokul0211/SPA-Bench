/**
 * SPABench App C — ProductService
 *
 * EP-C-001: GET http://localhost:3003/api/v2/products/{id}
 * technique: jsx_source_recovery (TC-P1.5-005)
 * phase: 1.5
 *
 * Vite generates highly readable source maps for TSX files. Recovery of this
 * file via the `.js.map` exposes the template literal URL including the path
 * parameter, plus the optional `?include` query parameter pattern.
 *
 * minified_location: assets/index.abc123.js:1:44201
 */
import React from 'react';

const API_BASE = 'http://localhost:3003';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  reviews?: Review[];
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  _cacheKey: string;
}

/**
 * Fetch a single product by ID.
 * EP-C-001: template literal URL — tool must resolve the `{id}` path param.
 * The optional `?include=reviews` query param is recoverable from this source.
 */
export async function getProduct(id: string, include?: string): Promise<Product> {
  // EP-C-001: GET http://localhost:3003/api/v2/products/{id}
  const url = new URL(`${API_BASE}/api/v2/products/${id}`);
  if (include) {
    url.searchParams.set('include', include);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch paginated product list.
 * EP-C-002: GET http://localhost:3003/api/v2/products/list
 * Also used by TC-P4-010: the response is cached in IndexedDB product-cache store.
 */
export async function listProducts(params: {
  page?: number;
  limit?: number;
  category?: string;
} = {}): Promise<ProductListResponse> {
  const url = new URL(`${API_BASE}/api/v2/products/list`);
  if (params.page != null) url.searchParams.set('page', String(params.page));
  if (params.limit != null) url.searchParams.set('limit', String(params.limit));
  if (params.category) url.searchParams.set('category', params.category);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Product list failed: ${res.status}`);
  const data: ProductListResponse = await res.json();

  // TC-P4-010 (indexeddb_api_cache): cache the response URL in IndexedDB
  // The _cacheKey field from the response is stored alongside the request URL.
  await cacheProductRequest(url.toString(), data._cacheKey);
  return data;
}

/**
 * Store request URL in IndexedDB product-cache store.
 * TC-P4-010: tools that inject an extraction script via Playwright can read
 * the cached URL from the browser's IndexedDB.
 */
async function cacheProductRequest(requestUrl: string, cacheKey: string): Promise<void> {
  const db = await openProductCache();
  const tx = db.transaction('product-cache', 'readwrite');
  const store = tx.objectStore('product-cache');
  store.put({ requestUrl, cacheKey, cachedAt: Date.now() }, 'latest-list');
}

async function openProductCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('spabench-product-cache', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('product-cache');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getToken(): string {
  return sessionStorage.getItem('bench_bearer_token') || '';
}
