const SERVER_URL = import.meta.env.PROD ? '/api' : 'http://localhost:8005/api';
const FETCH_TIMEOUT = 15000;

function getToken() {
  return localStorage.getItem('saas_token');
}

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

let isRefreshing = false;
let refreshPromise = null;

async function tryRefreshToken() {
  const refreshToken = localStorage.getItem('saas_refresh_token');
  if (!refreshToken) return false;
  if (isRefreshing) {
    await refreshPromise;
    return true;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${refreshToken}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('saas_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('saas_refresh_token', data.refresh_token);
        return true;
      }
      if (res.status === 401) localStorage.removeItem('saas_token');
      return false;
    } catch { return false; }
  })();
  const result = await refreshPromise;
  isRefreshing = false;
  refreshPromise = null;
  return result;
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetchWithTimeout(`${SERVER_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getToken();
      if (newToken && newToken !== token) {
        headers['Authorization'] = `Bearer ${newToken}`;
        return fetchWithTimeout(`${SERVER_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      }
    }
  }
  return res;
}

export function apiGet(path) { return request('GET', path); }
export function apiPost(path, body) { return request('POST', path, body); }
export function apiPut(path, body) { return request('PUT', path, body); }
export function apiDelete(path) { return request('DELETE', path); }
export function apiPatch(path, body) { return request('PATCH', path, body); }

export { SERVER_URL };
