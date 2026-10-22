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
  return _accessToken; 
}

export function getRefreshToken(): string | null { 
  if (!_refreshToken) {
    _refreshToken = sessionStorage.getItem('sf_refresh_token') || localStorage.getItem('sf_refresh_token');
  }
  return _refreshToken; 
}

export function isAuthenticated() { return !!getAccessToken(); }

// ─── Axios instance ───────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 45_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach Bearer token ──────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: refresh on 401 ─────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retried?: boolean };
    const refreshToken = getRefreshToken();
    if (error.response?.status === 401) {
      if (!originalRequest._retried && refreshToken) {
        originalRequest._retried = true;
        if (!_refreshPromise) {
          _refreshPromise = axios
            .post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken })
            .then((res) => {
              const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
              setTokens(accessToken, refreshToken);
              return accessToken;
            })
            .catch(() => {
              clearTokens();
              window.dispatchEvent(new CustomEvent('sf:unauthenticated'));
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
              return null;
            })
            .finally(() => { _refreshPromise = null; });
        }
        const newToken = await _refreshPromise;
        if (newToken && originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } else {
        clearTokens();
        window.dispatchEvent(new CustomEvent('sf:unauthenticated'));
        if (window.location.pathname !== '/login') {
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
