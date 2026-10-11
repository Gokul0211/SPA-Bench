import axios from 'axios';

const API_BASE = 'http://localhost:3004';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  grade: string;
  active: boolean;
  hireDate: string;
}

export function useUser(userId: string) {
  const user = ref<Employee | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);

  const { data, pending, error: fetchError } = useAsyncData(
    `user-${userId}`,
    async () => {
      const response = await axios.get(`${API_BASE}/api/users/${userId}`, { withCredentials: true });
      return response.data as Employee;
    },
  );

  return { data, pending, error: fetchError };
}

export function useUserList() {
  return useAsyncData('user-list', async () => {
    const response = await axios.get(`${API_BASE}/api/users`, { withCredentials: true });
    return response.data as Employee[];
  });
}

// Nuxt composable stubs for TypeScript compatibility outside of Nuxt runtime
declare function useAsyncData<T>(key: string, fn: () => Promise<T>): { data: T; pending: boolean; error: unknown };
declare function ref<T>(value: T): { value: T };
