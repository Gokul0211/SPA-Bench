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

export async function getProduct(id: string, include?: string): Promise<Product> {

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

  // The _cacheKey field from the response is stored alongside the request URL.
  await cacheProductRequest(url.toString(), data._cacheKey);
  return data;
}

async function cacheProductRequest(requestUrl: string, cacheKey: string): Promise<void> {
  const db = await openProductCache();
  const tx = db.transaction('product-cache', 'readwrite');
  const store = tx.objectStore('product-cache');
  store.put({ requestUrl, cacheKey, cachedAt: Date.now() }, 'latest-list');
}

async function openProductCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('product-cache-db', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('product-cache');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getToken(): string {
  return sessionStorage.getItem('shop_token') || '';
}
