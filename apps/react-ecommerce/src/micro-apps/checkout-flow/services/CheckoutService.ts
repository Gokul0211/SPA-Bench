/**
 * SPABench App C — CheckoutService (lazy-loaded chunk)
 *
 * EP-C-003: POST http://localhost:3003/checkout/process
 * technique: axios_wrapper (TC-P2-015)
 * phase: 2
 *
 * This file lives in the lazy-loaded checkout chunk:
 *   assets/checkout.chunk.js
 * It is only fetched when the user navigates to the /checkout route.
 *
 * Discovery requires the Phase 3 → Phase 2 feedback loop:
 *   1. Phase 3: browser navigates to /checkout, triggering chunk download
 *   2. Phase 2: the downloaded chunk.js is parsed by AST analysis
 *   3. The axios POST call is found at assets/checkout.chunk.js:1:8820
 *
 * TC-P2-015 (axios_wrapper): axiosInstance.post() with full body parameter
 * structure — cartId, paymentMethod, billingAddress all recoverable from
 * source map decompilation of the chunk.
 *
 * source_file: src/micro-apps/checkout-flow/services/CheckoutService.ts
 * minified_location: assets/checkout.chunk.js:1:8820
 */
import axios from 'axios';

const API_BASE = 'http://localhost:3003';

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject bearer token on every request
axiosInstance.interceptors.request.use(config => {
  const token = sessionStorage.getItem('bench_bearer_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface BillingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface CheckoutRequest {
  cartId: string;
  paymentMethod: string;
  billingAddress: BillingAddress;
}

export interface CheckoutResponse {
  orderId: string;
  status: string;
  total: number;
  estimatedDelivery: string;
}

/**
 * EP-C-003: POST http://localhost:3003/checkout/process
 * axios POST with structured body — all three required params are named here.
 */
export async function processCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
  const response = await axiosInstance.post<CheckoutResponse>('/checkout/process', {
    cartId:         req.cartId,
    paymentMethod:  req.paymentMethod,
    billingAddress: req.billingAddress,
  });
  return response.data;
}

export async function getCartSummary(cartId: string): Promise<{ items: unknown[]; total: number }> {
  const response = await axiosInstance.get(`/api/v2/cart/${cartId}`);
  return response.data;
}
