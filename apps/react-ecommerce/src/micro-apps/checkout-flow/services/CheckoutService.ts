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
  const token = sessionStorage.getItem('shop_token');
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
