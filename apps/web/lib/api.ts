const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
}

async function refreshTokens(): Promise<string | null> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (!refreshToken) return null;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!res.ok) return null;

    const { data } = await res.json();
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    return data.accessToken;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`${BASE_URL}${path}`, { credentials: 'include', ...init, headers });

    if (res.status === 401) {
        const newToken = await refreshTokens();
        if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            res = await fetch(`${BASE_URL}${path}`, { credentials: 'include', ...init, headers });
        } else {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
            }
        }
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error((err as any).message || res.statusText) as any;
        e.status = res.status;
        e.data = err;
        throw e;
    }

    return res.json() as Promise<T>;
}

export const api = {
    get: <T>(path: string, init?: RequestInit) => apiFetch<T>(path, { method: 'GET', ...init }),
    post: <T>(path: string, body?: unknown, init?: RequestInit) =>
        apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...init }),
    put: <T>(path: string, body?: unknown, init?: RequestInit) =>
        apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body), ...init }),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
        apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...init }),
    delete: <T>(path: string, init?: RequestInit) => apiFetch<T>(path, { method: 'DELETE', ...init }),
};
