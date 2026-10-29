/**
 * SmartFarm API HTTP Client
 * Axios-based client with JWT Bearer auth, automatic token refresh, and typed error handling.
 * Backend: http://localhost:5144  (http) | https://localhost:7040 (https)
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

// ─── Config ──────────────────────────────────────────────────────────────────

export const BASE_URL =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ??
  (typeof window !== 'undefined' ? '' : 'http://localhost:5144');

// ─── Token storage (sessionStorage with fallback to localStorage for persistent session) ───────

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;

export function isJwtExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = typeof window !== 'undefined'
      ? decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
      : Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonStr) as { exp?: number };
    if (!payload.exp) return false;
    // Consider token expired 10 seconds before actual exp timestamp
    return Date.now() >= (payload.exp * 1000 - 10000);
  } catch {
    return true;
  }
}

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  sessionStorage.setItem('sf_access_token', access);
  sessionStorage.setItem('sf_refresh_token', refresh);
  localStorage.setItem('sf_access_token', access);
  localStorage.setItem('sf_refresh_token', refresh);
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  sessionStorage.removeItem('sf_access_token');
  sessionStorage.removeItem('sf_refresh_token');
  localStorage.removeItem('sf_access_token');
  localStorage.removeItem('sf_refresh_token');
}

export function getAccessToken(): string | null { 
  if (!_accessToken) {
    _accessToken = sessionStorage.getItem('sf_access_token') || localStorage.getItem('sf_access_token');
  }
  // If access token is expired and there is no refresh token, clean up stale credentials
  if (_accessToken && isJwtExpired(_accessToken) && !getRefreshToken()) {
    clearTokens();
    return null;
  }
  return _accessToken; 
}

export function getRefreshToken(): string | null { 
  if (!_refreshToken) {
    _refreshToken = sessionStorage.getItem('sf_refresh_token') || localStorage.getItem('sf_refresh_token');
  }
  return _refreshToken; 
}

export function isAuthenticated() { return !!getAccessToken(); }

export async function refreshSessionToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }
  if (!_refreshPromise) {
    _refreshPromise = axios
      .post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken })
      .then((res) => {
        const { accessToken, refreshToken: newRefresh } = res.data as { accessToken: string; refreshToken: string };
        setTokens(accessToken, newRefresh);
        return accessToken;
      })
      .catch(() => {
        clearTokens();
        window.dispatchEvent(new CustomEvent('sf:unauthenticated'));
        const isPublicPath = typeof window !== 'undefined' && ['/', '/home', '/login', '/register'].includes(window.location.pathname);
        if (!isPublicPath && typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return null;
      })
      .finally(() => {
        _refreshPromise = null;
      });
  }
  return _refreshPromise;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: proactive refresh & attach Bearer token ──────────────
apiClient.interceptors.request.use(async (config) => {
  let token = getAccessToken();

  // If token is expired but we have a refresh token, proactively refresh before sending
  if (token && isJwtExpired(token)) {
    token = await refreshSessionToken();
  }

  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: refresh on 401 fallback ─────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retried?: boolean };
    const refreshToken = getRefreshToken();
    if (error.response?.status === 401) {
      if (!originalRequest._retried && refreshToken) {
        originalRequest._retried = true;
        const newToken = await refreshSessionToken();
        if (newToken && originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } else {
        clearTokens();
        window.dispatchEvent(new CustomEvent('sf:unauthenticated'));
        const isPublicPath = typeof window !== 'undefined' && ['/', '/home', '/login', '/register'].includes(window.location.pathname);
        if (!isPublicPath && typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Utility: extract ProblemDetails message ─────────────────────────────────
export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { title?: string; detail?: string; errors?: Record<string, string[]> } | undefined;
    let raw = '';
    if (d?.errors) {
      raw = Object.values(d.errors).flat().join(' | ');
    } else {
      raw = d?.detail ?? d?.title ?? err.message ?? 'Unknown API error';
    }

    // Friendly Vietnamese mapping
    if (raw.includes('Zone area exceeds the Field available area')) {
      return 'Diện tích Zone vượt quá diện tích còn trống của Lô đất!';
    }
    if (raw.includes('Field area exceeds the Farm available area')) {
      return 'Diện tích Lô đất vượt quá diện tích còn trống của Trang trại!';
    }
    if (raw.includes('A Zone with this name already exists in the Field')) {
      return 'Tên Zone này đã tồn tại trong Lô đất. Vui lòng đặt tên khác!';
    }
    if (raw.includes('A Field with this name already exists in the Farm')) {
      return 'Tên Lô đất này đã tồn tại trong Trang trại. Vui lòng đặt tên khác!';
    }
    if (raw.includes('An Operating Zone cannot change area or boundary')) {
      return 'Zone đang hoạt động không thể thay đổi diện tích hoặc ranh giới!';
    }
    if (raw.includes('Cannot add a Zone to an archived parent')) {
      return 'Không thể thêm Zone vào Lô đất đã lưu trữ/xóa!';
    }
    return raw;
  }
  return String(err);
}
