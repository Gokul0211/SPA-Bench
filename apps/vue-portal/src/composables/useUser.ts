/**
 * SPABench App D — useUser composable
 *
 * EP-D-001: GET http://localhost:3004/api/users/{id}
 * technique: vue_composition_axios (TC-P2-016)
 * phase: 2
 *
 * Vue 3 Composition API pattern with useAsyncData + axios.get.
 * Source maps are intentionally RESTRICTED on App D (TC-P1.5-006) —
 * all .map requests return 404. This endpoint is only recoverable via
 * AST analysis of the minified _nuxt/entry.js bundle.
 *
 * The AST tool must:
 *   1. Identify the axios.get() call pattern in the minified code
 *   2. Resolve the string concatenation: this.apiBase + "/api/users/" + id
 *   3. Reconstruct the full URL with the {id} path parameter
 *
 * minified_location: _nuxt/entry.js:1:28441
 * source_file: src/composables/useUser.ts (NOT accessible via source map)
 */
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

/**
 * Vue 3 Composition API user fetcher.
 * EP-D-001: GET http://localhost:3004/api/users/{id}
 *
 * TC-P2-016 (vue_composition_axios):
 *   useAsyncData wrapping an axios.get call.
 *   The tool must recognise this as an API call pattern, not a component render.
 */
export function useUser(userId: string) {
  const user = ref<Employee | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);

  const { data, pending, error: fetchError } = useAsyncData(
    `user-${userId}`,
    async () => {
      // EP-D-001: GET http://localhost:3004/api/users/{id}
      const response = await axios.get(`${API_BASE}/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${useCookie('bench_session').value}`,
        },
      });
      return response.data as Employee;
    },
  );

  return { data, pending, error: fetchError };
}

/**
 * Fetch list of all users.
 * Companion to EP-D-001 — called on portal load.
 */
export function useUserList() {
  return useAsyncData('user-list', async () => {
    const response = await axios.get(`${API_BASE}/api/users`, {
      headers: {
        Authorization: `Bearer ${useCookie('bench_session').value}`,
      },
    });
    return response.data as Employee[];
  });
}

// Nuxt composable stubs for TypeScript compatibility outside of Nuxt runtime
declare function useAsyncData<T>(key: string, fn: () => Promise<T>): { data: T; pending: boolean; error: unknown };
declare function useCookie(name: string): { value: string };
declare function ref<T>(value: T): { value: T };
