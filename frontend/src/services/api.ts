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

// ─── Token storage (sessionStorage — never localStorage per AGENTS.md) ───────

let _accessToken: string | null = sessionStorage.getItem('sf_access_token');
let _refreshToken: string | null = sessionStorage.getItem('sf_refresh_token');
let _refreshPromise: Promise<string | null> | null = null;

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  sessionStorage.setItem('sf_access_token', access);
  sessionStorage.setItem('sf_refresh_token', refresh);
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  sessionStorage.removeItem('sf_access_token');
  sessionStorage.removeItem('sf_refresh_token');
}

export function getAccessToken() { return _accessToken; }
export function getRefreshToken() { return _refreshToken; }
export function isAuthenticated() { return !!_accessToken; }

// ─── Axios instance ───────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach Bearer token ──────────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Response interceptor: refresh on 401 ─────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && !originalRequest._retried && _refreshToken) {
      originalRequest._retried = true;
      if (!_refreshPromise) {
        _refreshPromise = axios
          .post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken: _refreshToken })
          .then((res) => {
            const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
            setTokens(accessToken, refreshToken);
            return accessToken;
          })
          .catch(() => {
            clearTokens();
            window.dispatchEvent(new CustomEvent('sf:unauthenticated'));
            return null;
          })
          .finally(() => { _refreshPromise = null; });
      }
      const newToken = await _refreshPromise;
      if (newToken && originalRequest.headers) {
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Utility: extract ProblemDetails message ─────────────────────────────────
export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { title?: string; detail?: string; errors?: Record<string, string[]> } | undefined;
    if (d?.errors) {
      return Object.values(d.errors).flat().join(' | ');
    }
    return d?.detail ?? d?.title ?? err.message ?? 'Unknown API error';
  }
  return String(err);
}
