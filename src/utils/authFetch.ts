const TOKEN_STORAGE_KEY = 'geleia_tab_token';
const USER_STORAGE_KEY = 'geleia_tab_user';
const HANDOFF_STORAGE_KEY = 'geleia_tab_handoff';

export function prepareTabSessionHandoff() {
  try {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const user = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!token || !user) return;
    localStorage.setItem(
      HANDOFF_STORAGE_KEY,
      JSON.stringify({ token, user, expiresAt: Date.now() + 30_000 })
    );
  } catch {
    // ignore storage errors
  }
}

function consumeTabSessionHandoff(): string | null {
  try {
    const raw = localStorage.getItem(HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(HANDOFF_STORAGE_KEY);
    const parsed = JSON.parse(raw) as { token?: string; user?: string; expiresAt?: number };
    if (!parsed.token || !parsed.user || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
      return null;
    }
    sessionStorage.setItem(TOKEN_STORAGE_KEY, parsed.token);
    sessionStorage.setItem(USER_STORAGE_KEY, parsed.user);
    return parsed.token;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  try {
    const existing = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (existing) return existing;
    return consumeTabSessionHandoff();
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
    localStorage.removeItem(HANDOFF_STORAGE_KEY);
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
