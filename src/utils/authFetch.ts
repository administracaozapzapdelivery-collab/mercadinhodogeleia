const TOKEN_STORAGE_KEY = 'geleia_tab_token';
const USER_STORAGE_KEY = 'geleia_tab_user';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function clearAuthSession() {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url;

  if (url.startsWith('/api/')) {
    const token = getAuthToken();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await originalFetch(input, { ...init, headers });
    if (response.status === 401 && !url.startsWith('/api/auth/login')) {
      clearAuthSession();
      window.dispatchEvent(new Event('geleia:unauthorized'));
    }
    return response;
  }

  return originalFetch(input, init);
};
