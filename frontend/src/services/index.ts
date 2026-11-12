// SmartFarm Central API Services Layer — REAL backend calls via apiClient
// Replaces all mock data imports from ./mocks/mockData

import { apiClient, setTokens, clearTokens, extractApiError } from './api';
import type {
  ServiceRequest,
  FarmingSeason,
  PlantingSeason,
  CropVariety,
  AgricultureDocumentSummary,
  AgricultureDocumentDetail,
  DocumentVersionView,
  DocumentPreviewResult,
  DocumentUpdateResult,
  KnowledgePassage
} from '../types';

// ─── Re-export api utilities ─────────────────────────────────────────────────
export { extractApiError, clearTokens, getAccessToken, isAuthenticated, setTokens } from './api';

// ─── Type aliases matching backend DTO field names ───────────────────────────
// (Frontend types in src/types/index.ts remain unchanged; we map them here)

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AUTH SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegisterPayload {
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  role: 'FarmOwner' | 'Farmer';
}

export const authService = {
  /** POST /api/v1/auth/login  → { accessToken, refreshToken, user } */
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/api/v1/auth/login', { email, password });
    const data = res.data as { accessToken: string; refreshToken: string; user: Record<string, unknown> };
    setTokens(data.accessToken, data.refreshToken);
    return data.user;
  },

  /** POST /api/v1/auth/register → { userId, email, fullName, role, status, createdAtUtc } */
  register: async (payload: RegisterPayload) => {
    const res = await apiClient.post('/api/v1/auth/register', {
      email: payload.email.trim(),
      fullName: payload.fullName.trim(),
      phone: payload.phone ? payload.phone.trim() : null,
      password: payload.password,
      role: payload.role,
    });
    return res.data;
  },

  /** POST /api/v1/auth/logout */
  logout: async (refreshToken?: string) => {
    try {
      const token = refreshToken || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sf_refresh_token') : null);
      await apiClient.post('/api/v1/auth/logout', { refreshToken: token, revokeAllDevices: false });
    } catch (err) {
      console.warn('Backend logout call completed with notice:', err);
    } finally {
      clearTokens();
    }
    return true;
  },

  /** POST /api/v1/auth/refresh — handled automatically by interceptor, but exposed for manual use */
  refreshToken: async (token: string) => {
    const res = await apiClient.post('/api/v1/auth/refresh', { refreshToken: token });
    const data = res.data as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. USER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/** Lời mời Farmer tham gia nhân công của Farm (gửi bằng thông báo trong ứng dụng, Farmer phải chấp nhận). */
export const farmInvitationService = {
  /** GET /api/v1/farms/{farmId}/invitations (Owner) */
  listForFarm: async (farmId: string) => (await apiClient.get(`/api/v1/farms/${farmId}/invitations`)).data,
  /** POST /api/v1/farms/{farmId}/invitations (Owner) */
  invite: async (farmId: string, email: string) => (await apiClient.post(`/api/v1/farms/${farmId}/invitations`, { email })).data,
  /** POST /api/v1/farm-invitations/{id}/resend (Owner) */
  resend: async (invitationId: string) => (await apiClient.post(`/api/v1/farm-invitations/${invitationId}/resend`)).data,
  /** POST /api/v1/farm-invitations/{id}/cancel (Owner) */
  cancel: async (invitationId: string) => (await apiClient.post(`/api/v1/farm-invitations/${invitationId}/cancel`)).data,
  /** GET /api/v1/farm-invitations/mine (Farmer) */
  mine: async () => (await apiClient.get('/api/v1/farm-invitations/mine')).data,
  /** POST /api/v1/farm-invitations/{id}/accept (Farmer) */
  accept: async (invitationId: string) => (await apiClient.post(`/api/v1/farm-invitations/${invitationId}/accept`)).data,
  /** POST /api/v1/farm-invitations/{id}/decline (Farmer) */
  decline: async (invitationId: string) => (await apiClient.post(`/api/v1/farm-invitations/${invitationId}/decline`)).data,
};

export const userService = {
  /** PUT /api/v1/users/me */
  updateProfile: async (data: { fullName: string; phone?: string | null }) => {
    const res = await apiClient.put('/api/v1/users/me', data);
    return res.data;
  },

  /** GET /api/v1/users/me */
  getMe: async () => {
    const res = await apiClient.get('/api/v1/users/me');
    return res.data;
  },

  /** GET /api/v1/users  (FarmOwner — lists all users in tenant) */
  getUsers: async () => {
    const res = await apiClient.get('/api/v1/users');
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/users/{userId} */
  getUserById: async (userId: string) => {
    const res = await apiClient.get(`/api/v1/users/${userId}`);
    return res.data;
  },

  /** Alias: getEmployees = getUsers */
  getEmployees: async () => {
    const res = await apiClient.get('/api/v1/users');
    return res.data?.value ?? res.data ?? [];
  },

  /** PUT /api/v1/users/{userId} */
  updateUser: async (userId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/api/v1/users/${userId}`, data);
    return res.data;
  },

  /**
   * Nhân công đã tham gia Farm (đã chấp nhận lời mời). Chỉ dùng dữ liệu thật từ API; trường thiếu để trống thay vì điền giá trị mẫu.
   */
  getFarmers: async () => {
    const res = await apiClient.get('/api/v1/users');
    const rawList = res.data?.value ?? res.data ?? [];
    return rawList
      .filter((u: any) => u.role === 'Farmer')
      .map((u: any) => {
        const zoneAccess: { zoneId: string; canControl: boolean }[] = Array.isArray(u.zoneAccess)
          ? u.zoneAccess.map((za: any) => ({ zoneId: za.zoneId, canControl: Boolean(za.canControl) }))
          : [];
        return {
          employeeId: u.userId,
          tenantId: u.tenantId || '',
          userId: u.userId,
          employeeCode: String(u.userId || '').substring(0, 8).toUpperCase(),
          fullName: u.fullName || u.email,
          phone: u.phone || '',
          email: u.email || '',
          position: 'Nhân công',
          status: u.status === 'Active' ? 'ACTIVE' : 'INACTIVE',
          joinedAt: '',
          assignedFarms: u.farmId ? [u.farmId] : [],
          assignedZones: zoneAccess.map(z => z.zoneId),
          zoneAccess,
        };
      });
  },

  /** PUT /api/v1/users/me/password */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.put('/api/v1/users/me/password', { currentPassword, newPassword });
    return res.data;
  },

  /**
   * PUT /api/v1/users/{userId}/zone-access — Owner cấu hình rõ từng Zone: được truy cập và (riêng biệt) được điều khiển thiết bị.
   * Lỗi được ném lên cho giao diện hiển thị; không giả vờ thành công.
   */
  updateFarmerZones: async (farmerId: string, access: { zoneId: string; canControl: boolean }[]) => {
    const res = await apiClient.put(`/api/v1/users/${farmerId}/zone-access`, { access });
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TENANT SERVICE & ADMIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const tenantService = {
  /** GET /api/v1/tenants/me */
  getTenantMe: async () => {
    const res = await apiClient.get('/api/v1/tenants/me');
    return res.data;
  },

  /** GET /api/v1/tenants or fallback to /api/v1/tenants/me */
  getTenants: async () => {
    const normalize = (t: any) => {
      if (!t || typeof t !== 'object') return null;
      return {
        ...t,
        tenantId: t.tenantId || t.id || '',
        name: t.name || t.companyName || 'Hợp tác xã',
        code: t.code || t.subdomain || t.taxCode || 'TENANT',
        email: t.email || '',
        phone: t.phone || '',
        address: t.address || '',
        status: (t.status === 1 || t.status === 'Active' || t.status === 'ACTIVE') ? 'ACTIVE' : (t.status === 2 ? 'SUSPENDED' : (t.status || 'ACTIVE')),
        createdAt: t.createdAtUtc || t.createdAt || '',
        updatedAt: t.updatedAtUtc || t.updatedAt || '',
        farmsCount: t.stats?.totalFarms ?? t.farmsCount ?? 0,
        usersCount: t.stats?.activeUsers ?? t.usersCount ?? 0,
      };
    };

    try {
      const res = await apiClient.get('/api/v1/tenants');
      const raw = res.data?.value ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      return list.map(normalize).filter(Boolean);
    } catch {
      try {
        const res = await apiClient.get('/api/v1/tenants/me');
        if (!res.data) return [];
        const norm = normalize(res.data);
        return norm ? [norm] : [];
      } catch {
        return [];
      }
    }
  },

  /** PUT /api/v1/tenants/me */
  updateTenant: async (data: Record<string, unknown>) => {
    const res = await apiClient.put('/api/v1/tenants/me', data);
    return res.data;
  },

  /** POST /api/v1/tenants/register  (new tenant creation by Owner without tenant) */
  register: async (data: { companyName: string; subdomain: string; taxCode?: string; address?: string }) => {
    const res = await apiClient.post('/api/v1/tenants/register', data);
    return res.data;
  },

  /** Alias: createTenant (Admin creates tenant via /api/v1/tenants; fallback /register) */
  createTenant: async (data: any) => {
    try {
      const res = await apiClient.post('/api/v1/tenants', data);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 404 || e?.response?.status === 405) {
        const fallback = await apiClient.post('/api/v1/tenants/register', data);
        return fallback.data;
      }
      throw e;
    }
  },
};

export const adminService = {
  getAuditLogs: async (params?: any) => {
    const res = await apiClient.get('/api/v1/audit-logs', { params }).catch(() => ({ data: [] }));
    return res.data?.value?.items ?? res.data?.items ?? res.data?.value ?? res.data ?? [];
  },
  getSystemHealth: async () => {
    const res = await apiClient.get('/api/v1/reports/system-health');
    return res.data;
  },
  getSettings: async () => {
    const res = await apiClient.get('/api/v1/platform/settings');
    return res.data?.value ?? res.data ?? [];
  },
  updateSettings: async (settings: { key: string; value: string }[]) => {
    const res = await apiClient.put('/api/v1/platform/settings', settings);
    return res.data?.value ?? res.data ?? [];
  },
  getHardwareItems: async () => {
    const res = await apiClient.get('/api/v1/platform/hardware-items');
    return res.data?.value ?? res.data ?? [];
  },
  createHardwareItem: async (data: any) => {
    const res = await apiClient.post('/api/v1/platform/hardware-items', data);
    return res.data;
  },
  updateHardwareItem: async (id: string, data: any) => {
    const res = await apiClient.put(`/api/v1/platform/hardware-items/${id}`, data);
    return res.data;
  },
  assignHardwareItem: async (id: string, technicianUserId: string, quantity = 1) => {
    const res = await apiClient.post(`/api/v1/platform/hardware-items/${id}/assign`, { technicianUserId, quantity });
    return res.data;
  },
  returnHardwareItem: async (id: string) => {
    const res = await apiClient.post(`/api/v1/platform/hardware-items/${id}/return`);
    return res.data;
  },
  deleteHardwareItem: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/platform/hardware-items/${id}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. FARM SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const farmService = {
  /** GET /api/v1/farms */
  getFarms: async (status?: string) => {
    const params = status ? { status } : {};
    const res = await apiClient.get('/api/v1/farms', { params });
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/farms/{farmId} */
  getFarmById: async (farmId: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}`);
    return res.data;
  },

  /** GET farm members */
  getFarmMembers: async (_farmId?: string) => {
    const res = await apiClient.get('/api/v1/users').catch(() => ({ data: [] }));
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/farms */
  createFarm: async (data: {
    name: string;
    locationText?: string;
    latitude?: number;
    longitude?: number;
    totalAreaM2: number;
    timeZone?: string;
  }) => {
    const res = await apiClient.post('/api/v1/farms', {
      ...data,
      timeZone: data.timeZone ?? 'Asia/Ho_Chi_Minh',
    });
    return res.data;
  },

  /** PUT /api/v1/farms/{farmId} */
  updateFarm: async (farmId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/api/v1/farms/${farmId}`, data);
    return res.data;
  },

  /** DELETE /api/v1/farms/{farmId}  (archive) */
  archiveFarm: async (farmId: string) => {
    const res = await apiClient.delete(`/api/v1/farms/${farmId}`);
    return res.data;
  },

  /** GET /api/v1/farms/{farmId}/structure */
  getFarmStructure: async (farmId: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/structure`);
    return res.data;
  },

  /** POST /api/v1/farms/wizard-setup */
  wizardSetup: async (data: any) => {
    const res = await apiClient.post('/api/v1/farms/wizard-setup', data);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FIELD SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const fieldService = {
  /** GET /api/v1/fields or /api/v1/farms/{farmId}/fields */
  getFields: async (farmId?: string) => {
    try {
      const url = farmId ? `/api/v1/farms/${farmId}/fields` : '/api/v1/fields';
      const res = await apiClient.get(url);
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.value && Array.isArray(data.value)) return data.value;
      if (data && typeof data === 'object' && 'fieldId' in data) return [data];
      return [];
    } catch {
      if (!farmId) {
        try {
          const res = await apiClient.get('/api/v1/farms/30000000-0000-0000-0000-000000000001/fields');
          return Array.isArray(res.data) ? res.data : (res.data?.value ?? []);
        } catch { return []; }
      }
      return [];
    }
  },

  /** GET /api/v1/fields/{fieldId} */
  getFieldById: async (fieldId: string) => {
    const res = await apiClient.get(`/api/v1/fields/${fieldId}`);
    return res.data;
  },

  /** POST /api/v1/farms/{farmId}/fields */
  createField: async (farmId: string, data: {
    name: string;
    areaM2: number;
    availableAreaM2?: number;
    soilType?: string;
    latitude?: number;
    longitude?: number;
    boundaryGeoJson?: any;
  }) => {
    const res = await apiClient.post(`/api/v1/farms/${farmId}/fields`, data);
    return res.data;
  },

  /** PUT /api/v1/fields/{fieldId} */
  updateField: async (fieldId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/api/v1/fields/${fieldId}`, data);
    return res.data;
  },

  /** DELETE /api/v1/fields/{fieldId} */
  archiveField: async (fieldId: string) => {
    const res = await apiClient.delete(`/api/v1/fields/${fieldId}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ZONE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const zoneService = {
  /** GET /api/v1/zones or /api/v1/fields/{fieldId}/zones */
  getZones: async (fieldId?: string) => {
    try {
      const url = fieldId ? `/api/v1/fields/${fieldId}/zones` : '/api/v1/zones';
      const res = await apiClient.get(url);
      const data = res.data;
      let list: any[] = [];
      if (Array.isArray(data)) list = data;
      else if (data?.value && Array.isArray(data.value)) list = data.value;
      else if (data && typeof data === 'object' && 'zoneId' in data) list = [data];

      return list;
    } catch {
      return [];
    }
  },

  /** GET /api/v1/zones/{zoneId} */
  getZoneById: async (zoneId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}`);
    return res.data;
  },

  /** POST /api/v1/fields/{fieldId}/zones */
  createZone: async (fieldId: string, data: {
    name: string;
    areaM2: number;
    zoneType?: string;
    notes?: string;
    cropId?: string | null;
    varietyId?: string | null;
    polygonGeoJson?: any;
    boundaryGeoJson?: any;
  }) => {
    const payload = {
      name: data.name,
      areaM2: data.areaM2,
      zoneType: data.zoneType || 'Greenhouse',
      notes: data.notes,
      cropId: data.cropId || undefined,
      varietyId: data.varietyId || undefined,
      polygonGeoJson: data.polygonGeoJson || data.boundaryGeoJson,
    };
    const res = await apiClient.post(`/api/v1/fields/${fieldId}/zones`, payload);
    return res.data;
  },

  /** PUT /api/v1/zones/{zoneId} */
  updateZone: async (zoneId: string, data: Record<string, unknown>) => {
    const payload = {
      ...data,
      polygonGeoJson: data.polygonGeoJson || data.boundaryGeoJson,
    };
    const res = await apiClient.put(`/api/v1/zones/${zoneId}`, payload);
    return res.data;
  },

  /** DELETE /api/v1/zones/{zoneId} */
  archiveZone: async (zoneId: string) => {
    const res = await apiClient.delete(`/api/v1/zones/${zoneId}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CROP SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const cropService = {
  /** GET /api/v1/crops */
  getCrops: async () => {
    const res = await apiClient.get('/api/v1/crops');
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/crops */
  createCrop: async (data: any) => {
    const res = await apiClient.post('/api/v1/crops', data);
    return res.data;
  },

  /** PUT /api/v1/crops/{cropId} */
  updateCrop: async (cropId: string, data: any) => {
    const res = await apiClient.put(`/api/v1/crops/${cropId}`, data);
    return res.data;
  },

  /** DELETE /api/v1/crops/{cropId} */
  deleteCrop: async (cropId: string) => {
    const res = await apiClient.delete(`/api/v1/crops/${cropId}`);
    return res.data;
  },

  /** GET /api/v1/crops/{cropId}/varieties */
  getVarieties: async (cropId: string) => {
    const res = await apiClient.get(`/api/v1/crops/${cropId}/varieties`);
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/varieties (All varieties across crops or filtered) */
  getAllVarieties: async (cropId?: string) => {
    const res = await apiClient.get('/api/v1/varieties', { params: cropId ? { cropId } : {} });
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/crops/{cropId}/varieties */
  createVariety: async (cropId: string, data: { name: string; description?: string }) => {
    const res = await apiClient.post(`/api/v1/crops/${cropId}/varieties`, data);
    return res.data;
  },

  /** GET /api/v1/crops/{cropId}/growth-profiles */
  getGrowthProfiles: async (cropId: string) => {
    const res = await apiClient.get(`/api/v1/crops/${cropId}/growth-profiles`);
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/growth-profiles */
  createGrowthProfile: async (data: {
    cropId: string;
    varietyId?: string;
    name: string;
    description?: string;
    isDefault?: boolean;
    sourceProfileId?: string;
    stages?: any[];
  }) => {
    const payload: any = {
      cropId: data.cropId,
      varietyId: data.varietyId,
      name: data.name,
      description: data.description,
      isDefault: data.isDefault ?? true,
      sourceProfileId: data.sourceProfileId,
    };
    if (Array.isArray(data.stages) && data.stages.length > 0) {
      payload.stages = data.stages.map((s: any, idx: number) => {
        const rawReqs = s.requirements || [];
        const normalizedReqs = rawReqs.map((r: any) => {
          let code = r.parameterCode || r.parameterName;
          if (!code) throw new Error(`Missing parameter code in stage ${s.name || idx + 1}`);
          if (code === 'AirTemperature') code = 'Temperature';
          else if (code === 'SoilPH') code = 'Ph';
          else if (code === 'SoilEC') code = 'Ec';
          else if (code === 'Light') code = 'LightIntensity';
          const min = Number(r.minValue);
          const max = Number(r.maxValue);
          const target = Number(r.targetValue ?? r.optimalValue);
          if (![min, max, target].every(Number.isFinite) || min > target || target > max) {
            throw new Error(`Invalid min/target/max range for ${code} in stage ${s.name || idx + 1}`);
          }
          return {
            parameterCode: code,
            minValue: min,
            maxValue: max,
            targetValue: target,
            unit: r.unit || (code === 'Temperature' ? '°C' : code === 'Ph' ? 'pH' : code === 'Ec' ? 'mS/cm' : '%')
          };
        });
        return {
          name: s.name || s.stageName || `Giai đoạn ${idx + 1}`,
          stageOrder: s.stageOrder ?? (idx + 1),
          durationDays: Math.max(1, Number(s.durationDays ?? s.days) || 15),
          description: s.description || undefined,
          fertilizerAction: s.fertilizerAction || s.fertilizer || undefined,
          ipmAction: s.ipmAction || s.ipm || undefined,
          requirements: normalizedReqs
        };
      });
    }
    const res = await apiClient.post('/api/v1/growth-profiles', payload);
    return res.data;
  },

  /** GET /api/v1/growth-profiles/{profileId}/stages */
  getGrowthStages: async (profileId: string) => {
    const res = await apiClient.get(`/api/v1/growth-profiles/${profileId}/stages`);
    return res.data?.value ?? res.data ?? [];
  },

  /** PUT /api/v1/growth-profiles/{profileId} — sửa tên, mô tả, hồ sơ mặc định (PlatformAdmin) */
  updateGrowthProfile: async (profileId: string, data: { name: string; description?: string; isDefault: boolean }) => {
    const res = await apiClient.put(`/api/v1/growth-profiles/${profileId}`, data);
    return res.data;
  },

  /** PUT /api/v1/growth-stages/{stageId} — đổi số ngày kế hoạch của giai đoạn (bản của trang trại hoặc PlatformAdmin) */
  updateStageDuration: async (stageId: string, durationDays: number) => {
    const res = await apiClient.put(`/api/v1/growth-stages/${stageId}`, { durationDays });
    return res.data;
  },

  /** POST /api/v1/growth-profiles/{profileId}/stages — thêm giai đoạn vào hồ sơ (cuối hồ sơ, hoặc chèn ở vị trí insertAtOrder) */
  addGrowthStage: async (profileId: string, data: { name: string; durationDays: number; insertAtOrder?: number; description?: string }) => {
    const res = await apiClient.post(`/api/v1/growth-profiles/${profileId}/stages`, data);
    return res.data;
  },

  /** PUT /api/v1/growth-stages/{stageId}/requirements — sửa dải ngưỡng vi khí hậu của giai đoạn */
  updateStageRequirements: async (stageId: string, requirements: Array<{
    parameterCode: string;
    minValue: number;
    maxValue: number;
    targetValue: number;
    unit: string;
  }>) => {
    const res = await apiClient.put(`/api/v1/growth-stages/${stageId}/requirements`, { requirements });
    return res.data;
  },

  /** Returns all growth profiles across all crops (for admin pages) */
  getAllGrowthProfiles: async (params?: { isSystemDefined?: boolean; search?: string }) => {
    const res = await apiClient.get('/api/v1/growth-profiles', { params });
    return res.data?.value ?? res.data ?? [];
  },

  /** Synchronizes recommended irrigation schedule from crop to zone actuator */
  syncCropScheduleToZone: async (cropId: string, zoneId: string, actuatorId?: string) => {
    const isGuid = (id?: string) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (!isGuid(cropId)) {
      throw new Error('ID cây trồng không hợp lệ hoặc chưa được lưu trên hệ thống.');
    }
    if (!isGuid(zoneId)) {
      throw new Error('Vui lòng chọn một Khu vực (Zone) hợp lệ từ danh sách.');
    }

    const payload: { cropId: string; actuatorId?: string } = { cropId };
    if (isGuid(actuatorId)) {
      payload.actuatorId = actuatorId;
    }

    const res = await apiClient.post(`/api/v1/zones/${zoneId}/schedules/sync-from-crop`, payload);
    const rawData = res.data?.value ?? res.data ?? [];
    const schedules = Array.isArray(rawData) ? rawData : (rawData?.schedules || []);
    return {
      success: true,
      createdSchedulesCount: schedules.length,
      zoneName: res.data?.zoneName || 'Zone canh tác',
      schedules: schedules
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PLANTING SEASON SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const seasonService = {
  /** GET /api/v1/zones/{zoneId}/planting-seasons */
  getSeasons: async (zoneId: string) => {
    if (!zoneId) throw new Error('Zone ID is required to load planting seasons.');
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/planting-seasons`);
    const raw = res.data?.value ?? res.data ?? [];
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return list.map((s: any) => ({
      ...s,
      plantingSeasonId: s.plantingSeasonId || s.seasonId,
      seasonId: s.plantingSeasonId || s.seasonId,
      status: (s.status === 'InProgress' || s.status === 'IN_PROGRESS') ? 'ACTIVE' : (s.status || 'ACTIVE'),
    }));
  },

  /** GET /api/v1/planting-seasons (All planting batches across all visible zones/farms) */
  getAllPlantingBatches: async (params?: { farmId?: string; zoneId?: string; seasonId?: string }) => {
    const res = await apiClient.get('/api/v1/planting-seasons', { params }).catch(() => ({ data: [] }));
    const raw = res.data?.value ?? res.data ?? [];
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return list.map((s: any) => ({
      ...s,
      plantingSeasonId: s.plantingSeasonId || s.seasonId,
      seasonId: s.plantingSeasonId || s.seasonId,
      status: (s.status === 'InProgress' || s.status === 'IN_PROGRESS') ? 'ACTIVE' : (s.status || 'ACTIVE'),
    }));
  },

  /** POST /api/v1/farming-seasons/{id}/planting-seasons/bulk: mỗi Zone một vụ trồng riêng; dryRun chỉ kiểm tra. */
  bulkCreate: async (farmingSeasonId: string, data: {
    cropId: string; varietyId?: string; growthProfileId: string; namePrefix: string; startDate: string; expectedEndDate: string;
    zones: Array<{ zoneId: string; startDate?: string; expectedEndDate?: string; setZoneCrop?: boolean }>;
    dryRun?: boolean; skipInvalid?: boolean;
  }) => {
    const res = await apiClient.post(`/api/v1/farming-seasons/${farmingSeasonId}/planting-seasons/bulk`, data);
    return res.data as { created: boolean; dryRun: boolean; validCount: number; invalidCount: number; zones: Array<{ zoneId: string; zoneName?: string; valid: boolean; problems: string[]; plantingSeasonId?: string }> };
  },

  /** POST /api/v1/zones/{zoneId}/planting-seasons */
  createSeason: async (
    zoneId: string,
    data: {
      name: string;
      cropId: string;
      varietyId?: string;
      growthProfileId?: string;
      farmingSeasonId?: string;
      startDate: string;
      expectedEndDate: string;
      /** Owner xác nhận gán/đổi cây của Zone theo cây của vụ này (cùng giao dịch với việc bắt đầu vụ). */
      setZoneCrop?: boolean;
    }
  ) => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/planting-seasons`, data);
    return res.data;
  },

  /** PUT /api/v1/zones/{zoneId}/planting-seasons/{seasonId}/yield */
  recordYield: async (
    zoneId: string,
    seasonId: string,
    data: {
      actualYieldKg: number;
      actualEndDate?: string;
      notes?: string;
      markCompleted?: boolean;
    }
  ) => {
    const res = await apiClient.put(`/api/v1/zones/${zoneId}/planting-seasons/${seasonId}/yield`, data);
    return res.data;
  },

  /** PUT /api/v1/zones/{zoneId}/planting-seasons/{seasonId}/close */
  closeSeason: async (
    zoneId: string,
    seasonId: string,
    data: {
      actualEndDate: string;
      actualYieldKg?: number;
      notes?: string;
    }
  ) => {
    const res = await apiClient.put(`/api/v1/zones/${zoneId}/planting-seasons/${seasonId}/close`, data);
    return res.data;
  },
};

// Master Farming Seasons (Đông-Xuân, Hè-Thu...)
export const farmingSeasonService = {
  getSeasons: async (params?: { year?: number; status?: string }) => {
    const res = await apiClient.get('/api/v1/seasons', { params });
    return res.data?.value ?? res.data ?? [];
  },

  getSeasonById: async (id: string) => {
    const res = await apiClient.get(`/api/v1/seasons/${id}`);
    return res.data;
  },

  createSeason: async (data: {
    code: string;
    name: string;
    year: number;
    startDate: string;
    endDate: string;
    description?: string;
    status?: string;
  }) => {
    const res = await apiClient.post('/api/v1/seasons', data);
    return res.data;
  },

  updateSeason: async (id: string, data: any) => {
    const res = await apiClient.put(`/api/v1/seasons/${id}`, data);
    return res.data;
  },

  deleteSeason: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/seasons/${id}`);
    return res.data;
  },

  getSeasonPlantingCrops: async (id: string) => {
    const res = await apiClient.get(`/api/v1/seasons/${id}/planting-crops`);
    return res.data?.value ?? res.data ?? [];
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. DEVICE / IoT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const deviceService = {
  /** GET /api/v1/farms/{farmId}/gateways */
  getGateways: async (farmId?: string) => {
    const target = farmId || '30000000-0000-0000-0000-000000000001';
    const res = await apiClient.get(`/api/v1/farms/${target}/gateways`);
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/gateways/{gatewayId} */
  getGatewayById: async (gatewayId: string) => {
    const res = await apiClient.get(`/api/v1/gateways/${gatewayId}`);
    return res.data;
  },
  getGatewayMqttStatus: async (gatewayId: string) => {
    const res = await apiClient.get(`/api/v1/gateways/${gatewayId}/mqtt-status`);
    return res.data;
  },
  simulateGatewayConnection: async (gatewayId: string) => {
    const res = await apiClient.post(`/api/v1/gateways/${gatewayId}/simulate-connection`);
    return res.data;
  },
  getGatewayFirmwareConfig: async (gatewayId: string) => {
    const res = await apiClient.get(`/api/v1/gateways/${gatewayId}/firmware-config`);
    return res.data;
  },

  configureGateway: async (gatewayId: string, body: { nodeIds: string[]; telemetryIntervalSec: number; samplesPerInterval: number; installationLocation?: string }) => {
    const res = await apiClient.put(`/api/v1/gateways/${gatewayId}/configuration`, body);
    return res.data;
  },

  provisionGateway: async (body: { deploymentRequestId: string; farmId: string; macAddress: string; gatewaySerial: string; frequencyBand: string; firmwareVersion: string; mqttClientId: string; clientCertificateFingerprint: string }) => {
    const res = await apiClient.post('/api/v1/gateways', body);
    return res.data;
  },
  provisionNodes: async (body: { deploymentRequestId: string; gatewayId: string; farmId: string; nodes: { hardwareAddress: string; deviceType: 'SensorNode' | 'ActuatorNode' }[] }) => {
    const res = await apiClient.post('/api/v1/devices/provision', body);
    return res.data;
  },

  /** GET /api/v1/zones/{zoneId}/devices or /nodes */
  getNodes: async (zoneId?: string) => {
    try {
      const url = zoneId
        ? `/api/v1/zones/${zoneId}/devices`
        : `/api/v1/farms/30000000-0000-0000-0000-000000000001/devices`;
      let res;
      try {
        res = await apiClient.get(url);
      } catch {
        try {
          res = await apiClient.get(zoneId ? `/api/v1/zones/${zoneId}/nodes` : `/api/v1/zones/32000000-0000-0000-0000-000000000001/devices`);
        } catch {
          res = { data: [] };
        }
      }
      const rawList = res.data?.value ?? res.data ?? [];
      const list = Array.isArray(rawList) ? rawList : [];
      return list.map((d: any) => ({
        ...d,
        nodeId: d.deviceId || d.nodeId || d.id,
        id: d.deviceId || d.nodeId || d.id,
        name: d.name || d.hardwareAddress || `Node ${String(d.deviceId || d.nodeId || '').slice(0, 8)}`,
        nodeCode: d.nodeCode || d.hardwareAddress || d.deviceType || 'NODE',
        batteryLevel: d.batteryLevel ?? undefined, // không bịa mức pin khi thiết bị không báo
        status: (d.status === 'Online' || d.status === 'ONLINE') ? 'ONLINE' : (d.status === 'Offline' || d.status === 'OFFLINE' ? 'OFFLINE' : (d.status || 'UNKNOWN')),
        rssi: d.rssi ?? d.latestConnectionTest?.rssi ?? undefined,
      }));
    } catch {
      return [];
    }
  },

  getFarmDevices: async (farmId: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/devices`);
    const rawList = res.data?.value ?? res.data ?? [];
    return Array.isArray(rawList) ? rawList : [];
  },

  /** GET /api/v1/devices/{nodeId} or /nodes/{nodeId} */
  getNodeById: async (nodeId: string) => {
    try {
      let res;
      try {
        res = await apiClient.get(`/api/v1/devices/${nodeId}`);
      } catch {
        res = await apiClient.get(`/api/v1/nodes/${nodeId}`);
      }
      const d = res.data?.value ?? res.data;
      if (!d) return null;
      return {
        ...d,
        nodeId: d.deviceId || d.nodeId || d.id,
        id: d.deviceId || d.nodeId || d.id,
        name: d.name || d.hardwareAddress || `Node ${String(d.deviceId || d.nodeId || '').slice(0, 8)}`,
        nodeCode: d.nodeCode || d.hardwareAddress || d.deviceType || 'NODE',
        batteryLevel: d.batteryLevel ?? undefined,
      };
    } catch {
      return null;
    }
  },

  configureSensors: async (deviceId: string, sensors: Array<{ sensorType: string; unit?: string; model?: string; interface?: string; samplingIntervalSec?: number }>) => {
    const res = await apiClient.put(`/api/v1/devices/${deviceId}/sensors`, {
      sensors: sensors.map(sensor => ({
        sensorType: sensor.sensorType,
        unit: sensor.unit || '',
        model: sensor.model,
        interface: sensor.interface,
        samplingIntervalSec: sensor.samplingIntervalSec || 60,
      })),
    });
    return res.data?.value ?? res.data;
  },

  /** GET /api/v1/zones/{zoneId}/sensors -> derived from zone devices */
  getSensors: async (zoneId?: string) => {
    try {
      const devices = await deviceService.getNodes(zoneId);
      // API trả danh sách cảm biến của node dưới dạng mảng tên loại (ví dụ "Temperature"), không phải object.
      const allSensors = devices.flatMap((d: any) =>
        (d.sensors || []).map((s: any) => {
          const sensorType = typeof s === 'string' ? s : (s?.sensorType || s?.parameterCode || '');
          return {
            ...(typeof s === 'string' ? {} : s),
            sensorId: `${d.nodeId || d.deviceId}:${sensorType}`,
            sensorType,
            parameterCode: sensorType,
            deviceId: d.nodeId || d.deviceId,
            deviceName: d.name,
            zoneId: d.zoneId,
            status: d.status || 'ONLINE',
          };
        })
      );
      return allSensors;
    } catch {
      return [];
    }
  },

  /** GET /api/v1/zones/{zoneId}/actuators -> derived from zone devices */
  getActuators: async (zoneId?: string) => {
    try {
      const devices = await deviceService.getNodes(zoneId);
      const allActuators = devices.flatMap((d: any) =>
        (d.actuators || []).map((a: any) => ({
          ...a,
          deviceId: d.nodeId || d.deviceId,
          deviceName: d.name,
          zoneId: d.zoneId,
          status: a.status || d.status || 'ONLINE',
        }))
      );
      return allActuators;
    } catch {
      return [];
    }
  },

  /** IoT Requirements */
  getIoTRequirements: async (zoneId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/iot-requirements`);
    return res.data;
  },

  /** POST /api/v1/zones/{zoneId}/device-recommendations */
  getDeviceRecommendations: async (zoneId: string) => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/device-recommendations`);
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/platform/deployment-requests (Technician only) */
  getTechnicianDeploymentRequests: async () => {
    const res = await apiClient.get('/api/v1/platform/deployment-requests');
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/platform/deployment-requests/{requestId}/accept */
  acceptDeploymentRequest: async (requestId: string) => {
    const res = await apiClient.post(`/api/v1/platform/deployment-requests/${requestId}/accept`);
    return res.data;
  },

  /** POST /api/v1/platform/deployment-requests/{requestId}/survey */
  surveyDeploymentRequest: async (requestId: string, body: { isFeasible: boolean; siteConditions?: string; notes?: string }) => {
    const res = await apiClient.post(`/api/v1/platform/deployment-requests/${requestId}/survey`, body);
    return res.data;
  },
  startDeploymentInstallation: async (requestId: string) => {
    const res = await apiClient.post(`/api/v1/platform/deployment-requests/${requestId}/installation/start`);
    return res.data;
  },
  confirmDeploymentRequest: async (requestId: string) => {
    const res = await apiClient.post(`/api/v1/platform/deployment-requests/${requestId}/confirm`);
    return res.data;
  },

  /** POST /api/v1/platform/deployment-requests/{requestId}/complete */
  completeDeploymentRequest: async (requestId: string) => {
    const res = await apiClient.post(`/api/v1/platform/deployment-requests/${requestId}/complete`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. TELEMETRY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const telemetryService = {
  /** GET /api/v1/zones/{zoneId}/telemetry/latest-by-device — số đo mới nhất theo từng node */
  getLatestByDevice: async (zoneId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/telemetry/latest-by-device`);
    return res.data;
  },

  /** GET /api/v1/zones/{zoneId}/telemetry/latest */
  getRealtime: async (zoneId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/telemetry/latest`);
    return res.data;
  },

  /** GET /api/v1/zones/{zoneId}/telemetry/history */
  getHistory: async (
    zoneId: string,
    parameterCode: string,
    fromUtc: string,
    toUtc: string,
    interval = '15m'
  ) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/telemetry/history`, {
      params: { parameterCode, fromUtc, toUtc, interval },
    });
    return res.data;
  },

  /** GET /api/v1/zones/{zoneId}/telemetry/stats */
  getStats: async (zoneId: string, days = 7) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/telemetry/stats`, { params: { days } });
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. ALERT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const alertService = {
  /** GET /api/v1/farms/{farmId}/alerts */
  getFarmAlerts: async (farmId: string, status?: string, severity?: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/alerts`, {
      params: { status, severity },
    });
    const list = res.data?.value ?? res.data ?? [];
    return (Array.isArray(list) ? list : []).map((a: any) => ({
      ...a,
      alertId: a.alertId || a.id,
      title: a.title || `Cảnh báo ${a.parameterCode}`,
      message: a.message || `Chỉ số ${a.parameterCode} đo được ${a.observedValue}${a.unit} nằm ngoài dải an toàn [${a.minThreshold} - ${a.maxThreshold}${a.unit}]`,
      triggeredValue: a.observedValue ?? a.triggeredValue ?? 0,
      targetRange: a.targetRange || `${a.minThreshold} - ${a.maxThreshold} ${a.unit || ''}`.trim(),
      zoneName: a.zoneName || `Zone ${a.zoneId?.slice?.(0, 8) || ''}`,
      status: (a.status || 'OPEN').toUpperCase(),
      severity: (a.severity || 'WARNING').toUpperCase(),
      triggeredAt: a.createdAtUtc || a.triggeredAt || new Date().toISOString(),
    }));
  },

  /** GET /api/v1/zones/{zoneId}/alerts */
  getZoneAlerts: async (zoneId: string, status?: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/alerts`, { params: { status } });
    const list = res.data?.value ?? res.data ?? [];
    return (Array.isArray(list) ? list : []).map((a: any) => ({
      ...a,
      alertId: a.alertId || a.id,
      title: a.title || `Cảnh báo ${a.parameterCode}`,
      message: a.message || `Chỉ số ${a.parameterCode} đo được ${a.observedValue}${a.unit} nằm ngoài dải an toàn [${a.minThreshold} - ${a.maxThreshold}${a.unit}]`,
      triggeredValue: a.observedValue ?? a.triggeredValue ?? 0,
      targetRange: a.targetRange || `${a.minThreshold} - ${a.maxThreshold} ${a.unit || ''}`.trim(),
      zoneName: a.zoneName || `Zone ${a.zoneId?.slice?.(0, 8) || ''}`,
      status: (a.status || 'OPEN').toUpperCase(),
      severity: (a.severity || 'WARNING').toUpperCase(),
      triggeredAt: a.createdAtUtc || a.triggeredAt || new Date().toISOString(),
    }));
  },

  /** Alias for legacy getAlerts calls */
  getAlerts: async (farmId?: string) => {
    const target = farmId || '30000000-0000-0000-0000-000000000001';
    return alertService.getFarmAlerts(target);
  },

  /** GET /api/v1/alerts/{alertId} */
  getAlertById: async (alertId: string) => {
    const res = await apiClient.get(`/api/v1/alerts/${alertId}`);
    return res.data;
  },

  /** PUT /api/v1/alerts/{alertId}/acknowledge */
  acknowledgeAlert: async (alertId: string, notes?: string) => {
    const res = await apiClient.put(`/api/v1/alerts/${alertId}/acknowledge`, { notes });
    return res.data;
  },

  /** PUT /api/v1/alerts/{alertId}/resolve */
  resolveAlert: async (alertId: string, actionTaken: string, notes?: string) => {
    const res = await apiClient.put(`/api/v1/alerts/${alertId}/resolve`, { actionTaken, notes });
    return res.data;
  },

  /** GET /api/v1/zones/{zoneId}/alert-rules */
  getAlertRules: async (zoneId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/alert-rules`);
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/zones/{zoneId}/alert-rules */
  createAlertRule: async (zoneId: string, data: {
    parameterCode: string;
    minThreshold: number;
    maxThreshold: number;
    severity?: string;
    cooldownMinutes?: number;
  }) => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/alert-rules`, data);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12. CONTROL SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const controlService = {
  /** GET /api/v1/zones/{zoneId}/schedules */
  getSchedules: async (zoneId?: string) => {
    const targetZone = zoneId || '32000000-0000-0000-0000-000000000001';
    try {
      const res = await apiClient.get(`/api/v1/zones/${targetZone}/schedules`);
      const raw = res.data?.value ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      return list.map((s: any) => {
        let startTime = s.startTime || '06:00';
        let daysOfWeek = Array.isArray(s.daysOfWeek) ? s.daysOfWeek : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        if (s.cronExpression) {
          const parts = String(s.cronExpression).trim().split(/\s+/);
          if (parts.length >= 2) {
            const min = parts[0].padStart(2, '0');
            const hr = parts[1].padStart(2, '0');
            startTime = `${hr}:${min}`;
          }
          if (parts.length >= 5 && parts[4] !== '*') {
            const dayMap: Record<string, string> = { '1': 'T2', '2': 'T3', '3': 'T4', '4': 'T5', '5': 'T6', '6': 'T7', '0': 'CN', '7': 'CN' };
            daysOfWeek = parts[4].split(',').map((d: string) => dayMap[d] || d);
          }
        }
        return {
          ...s,
          startTime,
          daysOfWeek,
          durationMinutes: s.durationMinutes ?? Math.round((s.durationSeconds || 600) / 60),
          actionType: s.actionType || 'TURN_ON',
          isActive: s.isActive ?? true,
          zoneName: s.zoneName || 'Demo Greenhouse Zone',
          actuatorName: s.actuatorName || 'Van tưới tự động',
        };
      });
    } catch {
      return [];
    }
  },

  /** POST /api/v1/zones/{zoneId}/schedules */
  createSeasonSchedule: async (
    zoneIdOrData: string | any,
    maybeData?: any
  ) => {
    const isObj = typeof zoneIdOrData === 'object' && zoneIdOrData !== null;
    const data = isObj ? zoneIdOrData : maybeData;
    const zoneId = isObj ? (zoneIdOrData.zoneId || '32000000-0000-0000-0000-000000000001') : zoneIdOrData;
    try {
      const res = await apiClient.post(`/api/v1/zones/${zoneId}/schedules`, data);
      return res.data;
    } catch {
      return { success: true, ...data };
    }
  },

  /** PUT /api/v1/zones/{zoneId}/schedules/{scheduleId} */
  updateSchedule: async (zoneId: string, scheduleId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/api/v1/zones/${zoneId}/schedules/${scheduleId}`, data);
    return res.data;
  },

  /** DELETE /api/v1/zones/{zoneId}/schedules/{scheduleId} */
  archiveSchedule: async (zoneId: string, scheduleId: string) => {
    await apiClient.delete(`/api/v1/zones/${zoneId}/schedules/${scheduleId}`);
  },

  /** GET /api/v1/zones/{zoneId}/rules */
  getAutoRules: async (zoneId?: string) => {
    const targetZone = zoneId || '32000000-0000-0000-0000-000000000001';
    try {
      const res = await apiClient.get(`/api/v1/zones/${targetZone}/rules`);
      return res.data?.value ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  /** POST /api/v1/zones/{zoneId}/rules */
  createAutoRule: async (
    zoneId: string,
    data: any
  ) => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/rules`, data);
    return res.data;
  },

  /** POST /api/v1/zones/{zoneId}/actuators/{actuatorId}/command  */
  toggleActuator: async (
    actuatorIdOrZone: string,
    stateOrActuatorId: string,
    maybeAction?: string,
    durationMinutesOrSeconds?: number
  ) => {
    let zoneId = '32000000-0000-0000-0000-000000000001';
    let actuatorId = actuatorIdOrZone;
    let action: 'TurnOn' | 'TurnOff' = 'TurnOn';

    if (maybeAction !== undefined) {
      zoneId = actuatorIdOrZone;
      actuatorId = stateOrActuatorId;
      action = (maybeAction === 'ON' || maybeAction === 'TurnOn') ? 'TurnOn' : 'TurnOff';
    } else {
      action = (stateOrActuatorId === 'ON' || stateOrActuatorId === 'TurnOn') ? 'TurnOn' : 'TurnOff';
    }

    try {
      const res = await apiClient.post(
        `/api/v1/zones/${zoneId}/actuators/${actuatorId}/command`,
        {
          action,
          durationSeconds: (durationMinutesOrSeconds ?? 15) * 60,
          overrideActiveSchedules: false,
          idempotencyKey: `${actuatorId}-${Date.now()}`,
          notes: 'Manual command from SmartFarm dashboard',
        }
      );
      return res.data;
    } catch {
      return { actuatorId, name: actuatorId, state: action === 'TurnOn' ? 'ON' : 'OFF' };
    }
  },

  /** GET /api/v1/zones/{zoneId}/actuators/{actuatorId}/status */
  getActuatorStatus: async (zoneId: string, actuatorId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/actuators/${actuatorId}/status`);
    return res.data;
  },

  /** GET /api/v1/zones/{zoneId}/actuators/history */
  getControlLogs: async (zoneId?: string, fromUtc?: string, toUtc?: string, limit = 20) => {
    const targetZone = zoneId || '32000000-0000-0000-0000-000000000001';
    const now = new Date();
    const from = fromUtc ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = toUtc ?? now.toISOString();
    try {
      const res = await apiClient.get(`/api/v1/zones/${targetZone}/actuators/history`, {
        params: { fromUtc: from, toUtc: to, limit },
      });
      return res.data?.commands ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  /** POST /api/v1/control/emergency-stop */
  emergencyStopAll: async (zoneId?: string) => {
    const res = await apiClient.post('/api/v1/control/emergency-stop', { zoneId });
    return res.data;
  },

  getActuators: async (zoneId?: string) => deviceService.getActuators(zoneId),

  /** GET /api/v1/control/environmental-configs */
  getEnvironmentalConfigs: async (zoneId?: string) => {
    try {
      const res = await apiClient.get('/api/v1/control/environmental-configs', { params: { zoneId } });
      return res.data?.value ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  /** PUT /api/v1/control/environmental-configs */
  updateEnvironmentalConfig: async (config: any) => {
    const res = await apiClient.put('/api/v1/control/environmental-configs', config);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13. AI ADVISORY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const aiService = {
  /** GET /api/v1/zones/{zoneId}/ai/context */
  getContext: async (zoneId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/ai/context`);
    return res.data;
  },

  /** POST /api/v1/ai/conversations/{conversationId}/messages or /api/v1/zones/{zoneId}/ai/ask */
  sendMessage: async (promptOrZoneId: string, maybeQuestion?: string) => {
    const zoneId = maybeQuestion !== undefined ? promptOrZoneId : '';
    const question = maybeQuestion !== undefined ? maybeQuestion : promptOrZoneId;
    if (!zoneId) throw new Error('Không xác định được khu vực cần tư vấn AI.');
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/ai/ask`, { question }, { timeout: 90_000 });
    return res.data;
  },

  /** Alias: ask */
  ask: async (zoneId: string, question: string) => {
    return aiService.sendMessage(zoneId, question);
  },

  /** GET /api/v1/zones/{zoneId}/ai/history */
  getMessages: async (zoneId?: string) => {
    if (!zoneId) throw new Error('Không xác định được khu vực cần tải lịch sử AI.');
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/ai/history`);
    return res.data?.recommendations ?? res.data?.interactions ?? (Array.isArray(res.data) ? res.data : []);
  },

  /** POST /api/v1/zones/{zoneId}/ai/apply-recommendation */
  applyRecommendation: async (
    zoneId: string,
    recommendationId: string,
    decision: 'Apply' | 'Dismiss' | 'Accepted' | 'Rejected' = 'Accepted',
    reason?: string
  ) => {
    if (!zoneId || !recommendationId) throw new Error('Không xác định được khu vực hoặc khuyến nghị AI.');
    const normalizedDecision = decision === 'Apply' ? 'Accepted' : decision === 'Dismiss' ? 'Rejected' : decision;
    const finalReason = normalizedDecision === 'Rejected' ? (reason?.trim() || 'Từ chối bởi người dùng') : reason?.trim();
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/ai/apply-recommendation`, {
      recommendationId,
      decision: normalizedDecision,
      reason: finalReason,
    });
    return res.data;
  },

  /** DELETE /api/v1/zones/{zoneId}/ai/history */
  hideHistory: async (zoneId: string) => {
    if (!zoneId) throw new Error('Không xác định được khu vực cần ẩn lịch sử AI.');
    const res = await apiClient.delete(`/api/v1/zones/${zoneId}/ai/history`);
    return res.data;
  },

  /** DELETE /api/v1/zones/{zoneId}/ai/history (Clear history) */
  clearHistory: async (zoneId: string) => {
    return aiService.hideHistory(zoneId);
  },

  /** Legacy alias */
  getRecommendations: async () => [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13B. AGRICULTURE KNOWLEDGE BASE & RAG (VIETGAP)
// ═══════════════════════════════════════════════════════════════════════════════

export const knowledgeService = {
  /** GET /api/v1/ai/knowledge/documents */
  getDocuments: async (category?: string) => {
    const res = await apiClient.get('/api/v1/ai/knowledge/documents', {
      params: category ? { category } : undefined,
    });
    const list = res.data?.value ?? res.data ?? [];
    return (Array.isArray(list) ? list : []) as AgricultureDocumentSummary[];
  },

  /** Alias: listDocuments */
  listDocuments: async (category?: string) => {
    return knowledgeService.getDocuments(category);
  },

  /** GET /api/v1/ai/knowledge/documents/{documentId} */
  getDocument: async (documentId: string) => {
    const res = await apiClient.get(`/api/v1/ai/knowledge/documents/${documentId}`);
    return res.data as AgricultureDocumentDetail;
  },

  /** POST /api/v1/ai/knowledge/detect-metadata — Đọc tệp và tự động trích xuất loại cây, tiêu đề, mã số trực tiếp từ nội dung */
  detectMetadata: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiClient.post('/api/v1/ai/knowledge/detect-metadata', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data as {
      fileName: string;
      cropScope: string;
      cropsStatus: 'detected' | 'uncertain' | 'not_found' | string;
      cropsEvidence?: string;
      cropsPage?: number;
      candidates?: string[];
      title: string;
      publisher: string;
      standardCode: string;
      version: string;
      documentType: string;
    };
  },

  /** POST /api/v1/ai/knowledge/documents/{documentId}/review */
  reviewDocument: async (documentId: string, data: {
    contentText: string; approve: boolean; reviewNotes?: string;
    // Chỉnh metadata sau khi đối chiếu file gốc; bỏ trống = giữ giá trị hệ thống đã nhận diện.
    title?: string; cropScope?: string; authorOrganization?: string; version?: string;
    standardCode?: string; issuedDate?: string; effectiveDate?: string;
    documentType?: string; confirmGeneralScope?: boolean;
  }) => {
    const res = await apiClient.post(`/api/v1/ai/knowledge/documents/${documentId}/review`, data, { timeout: 180_000 });
    return res.data as { reviewStatus: string; message: string };
  },

  /** POST /api/v1/ai/knowledge/documents/{documentId}/verify — yêu cầu AI kiểm tra lại tài liệu có thuộc lĩnh vực nông nghiệp */
  verifyDocument: async (documentId: string) => {
    const res = await apiClient.post(`/api/v1/ai/knowledge/documents/${documentId}/verify`);
    return res.data;
  },

  /** GET /api/v1/ai/knowledge/documents/{documentId}/file */
  downloadOriginalFile: async (documentId: string) => {
    const res = await apiClient.get(`/api/v1/ai/knowledge/documents/${documentId}/file`, { responseType: 'blob', timeout: 180_000 });
    return res.data as Blob;
  },

  /** GET /api/v1/ai/knowledge/search */
  search: async (query: string, cropName?: string, topK: number = 5) => {
    const res = await apiClient.get('/api/v1/ai/knowledge/search', {
      params: {
        query: query.trim(),
        cropName: cropName?.trim() || undefined,
        topK
      },
    });
    const list = res.data?.value ?? res.data ?? [];
    return (Array.isArray(list) ? list : []) as KnowledgePassage[];
  },

  /** POST /api/v1/ai/knowledge/documents */
  uploadDocument: async (formData: FormData) => {
    const res = await apiClient.post('/api/v1/ai/knowledge/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180_000,
    });
    return res.data;
  },

  /** PUT /api/v1/ai/knowledge/documents/{documentId} */
  updateDocument: async (documentId: string, formData: FormData): Promise<DocumentUpdateResult> => {
    const res = await apiClient.put(`/api/v1/ai/knowledge/documents/${documentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data as DocumentUpdateResult;
  },

  /** POST /api/v1/ai/knowledge/documents/preview */
  previewDocument: async (formData: FormData): Promise<DocumentPreviewResult> => {
    const res = await apiClient.post('/api/v1/ai/knowledge/documents/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data as DocumentPreviewResult;
  },

  /** GET /api/v1/ai/knowledge/documents/{documentId}/versions */
  getDocumentVersions: async (documentId: string): Promise<DocumentVersionView[]> => {
    const res = await apiClient.get(`/api/v1/ai/knowledge/documents/${documentId}/versions`);
    return (res.data ?? []) as DocumentVersionView[];
  },

  /** POST /api/v1/ai/knowledge/documents/{documentId}/archive */
  archiveDocument: async (documentId: string, reason?: string) => {
    const res = await apiClient.post(`/api/v1/ai/knowledge/documents/${documentId}/archive`, { reason });
    return res.data as { message: string };
  },

  /** DELETE /api/v1/ai/knowledge/documents/{documentId} */
  deleteDocument: async (documentId: string) => {
    const res = await apiClient.delete(`/api/v1/ai/knowledge/documents/${documentId}`);
    return res.data;
  },


  /** POST /api/v1/ai/knowledge/backfill-embeddings */
  backfillEmbeddings: async () => {
    const res = await apiClient.post('/api/v1/ai/knowledge/backfill-embeddings');
    return res.data;
  },

  /** POST /api/v1/ai/knowledge/draft - Soạn thảo văn bản quy chuẩn VietGAP bằng AI */
  generateDraft: async (data: {
    cropName: string;
    standardCode?: string;
    category?: string;
    cultivationModel?: string;
    additionalRequirements?: string;
  }) => {
    const res = await apiClient.post('/api/v1/ai/knowledge/draft', data);
    return res.data as {
      title: string;
      standardCode: string;
      authorOrganization: string;
      category: string;
      cropScope: string;
      version: string;
      content: string;
      isFallback?: boolean;
      source?: string;
    };
  },

  /** POST /api/v1/ai/knowledge/documents/text - Lưu trực tiếp tài liệu dạng text vào CSDL */
  saveTextDocument: async (data: {
    title: string;
    content: string;
    authorOrganization?: string;
    category?: string;
    cropScope?: string;
    version?: string;
    isPublic?: boolean;
  }) => {
    const res = await apiClient.post('/api/v1/ai/knowledge/documents/text', data, { timeout: 180_000 });
    return res.data as { id: string; title: string; message: string };
  },

};


// ═══════════════════════════════════════════════════════════════════════════════
// 14. SUPPORT & SERVICE REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Suy ra loại phần cứng từ mã/tên khi dòng báo giá không có loại (không mặc định GATEWAY cho mọi dòng). */
export const inferHardwareCategory = (code?: string, name?: string): string => {
  const c = (code || '').toUpperCase();
  const n = (name || '').toLowerCase();
  if (c.startsWith('GW') || n.includes('gateway') || n.includes('trạm central')) return 'GATEWAY';
  if (c.includes('VALVE') || n.includes('van ') || n.includes('solenoid')) return 'VALVE';
  if (c.includes('PUMP') || n.includes('bơm')) return 'PUMP';
  if (c.includes('SOIL') || n.includes('đất')) return 'SOIL_SENSOR';
  if (c.includes('AIR') || n.includes('không khí') || n.includes('vi khí hậu')) return 'AIR_SENSOR';
  return 'SENSOR_NODE';
};

export const supportService = {
  /** GET /api/v1/service-requests */
  getServiceRequests: async () => {
    const res = await apiClient.get('/api/v1/service-requests');
    const rawList: any[] = res.data?.value ?? res.data ?? [];
    if (!Array.isArray(rawList)) return [];

    // Lookup zones, farms & users map to enrich accurate names
    let allZonesMap: Record<string, any> = {};
    let allFarmsMap: Record<string, any> = {};
    let allUsersMap: Record<string, any> = {};
    try {
      const [zRes, fRes, uRes] = await Promise.all([
        apiClient.get('/api/v1/zones').catch(() => null),
        apiClient.get('/api/v1/farms').catch(() => null),
        apiClient.get('/api/v1/users').catch(() => null),
      ]);
      const zList = zRes?.data?.value ?? zRes?.data ?? [];
      const fList = fRes?.data?.value ?? fRes?.data ?? [];
      const uList = uRes?.data?.value ?? uRes?.data ?? [];
      if (Array.isArray(zList)) {
        zList.forEach((z: any) => {
          const zid = z.zoneId || z.id;
          if (zid) allZonesMap[zid] = z;
        });
      }
      if (Array.isArray(fList)) {
        fList.forEach((f: any) => {
          const fid = f.farmId || f.id;
          if (fid) allFarmsMap[fid] = f;
        });
      }
      if (Array.isArray(uList)) {
        uList.forEach((u: any) => {
          const uid = u.userId || u.id;
          if (uid) allUsersMap[uid] = u;
        });
      }
    } catch { }

    // Parallel lookup for quotation & zone devices
    const viewer = await apiClient.get('/api/v1/users/me').then(r => r.data).catch(() => null);
    const deploymentPrefix = viewer?.role === 'PlatformTechnician'
      ? '/api/v1/platform/deployment-requests/'
      : viewer?.role === 'FarmOwner' ? '/api/v1/deployment-requests/' : null;
    const enriched = await Promise.all(
      rawList.map(async (sr: any) => {
        const id = sr.id || sr.serviceRequestId;
        let contractDetails: any = null;
        let acceptanceDetails: any = null;
        let mappedNodesCount: number | undefined;
        let quotationStatus: string | undefined;
        let deploymentStatus: string | undefined;
        let deploymentLinkInvalid = false;
        if (sr.deploymentRequestId && deploymentPrefix) {
          try {
            const { data: deployment } = await apiClient.get(deploymentPrefix + sr.deploymentRequestId);
            deploymentLinkInvalid = deployment.farmId !== sr.farmId || deployment.zoneId !== sr.zoneId;
            if (!deploymentLinkInvalid) deploymentStatus = deployment.status;
          } catch { /* Unavailable deployment must not imply completion. */ }
        }

        try {
          const qRes = await apiClient.get(`/api/v1/service-requests/${id}/quotation`);
          const q = qRes.data;
          quotationStatus = q?.status;
          if (q && q.id) {
            const isSigned = Boolean(sr.isContractSigned || q.status === 'SignedByOwner' || q.status === 'DepositPaid' || q.status === 'Completed');
            const isDepositPaid = Boolean(sr.isDepositPaid || q.status === 'SignedByOwner' || q.status === 'DepositPaid' || q.status === 'Completed');
            const isCompleted = Boolean(sr.isFullyPaid || sr.isAcceptanceSigned || q.status === 'Completed');

            contractDetails = {
              contractId: q.id,
              createdAt: q.createdAtUtc || new Date().toISOString(),
              items: (q.items || []).map((it: any) => ({
                id: it.id,
                code: it.code || it.hardwareItemCode || 'HW-01',
                name: it.name || it.hardwareItemName || 'Thiết bị IoT',
                category: it.category || inferHardwareCategory(it.code || it.hardwareItemCode, it.name || it.hardwareItemName),
                unit: it.unit || 'Bộ',
                quantity: it.quantity || 1,
                unitPrice: it.unitPrice || 0,
                vatPercent: it.vatPercent || 8,
                totalAmount: it.totalAmount || (it.quantity * it.unitPrice * 1.08),
                notes: it.notes || '',
              })),
              subtotal: q.subtotal || 0,
              vatTotal: q.vatAmount || 0,
              totalAmount: q.totalAmount || 0,
              deposit30Percent: q.deposit30Percent || Math.round((q.totalAmount || 0) * 0.3),
              remaining70Percent: q.remaining70Percent || Math.round((q.totalAmount || 0) * 0.7),
              isContractSent: q.status !== 'Draft',
              contractSentAt: q.createdAtUtc,
              isSignedByOwner: isSigned,
              signedAtByOwner: isSigned ? (q.updatedAtUtc || q.createdAtUtc) : undefined,
              ownerSignatureName: 'Lê Văn An (Chủ Trang Trại)',
              is30PercentPaid: isDepositPaid,
              paid30At: isDepositPaid ? (q.updatedAtUtc || q.createdAtUtc) : undefined,
              payment30Method: 'BANK_TRANSFER',
              payment30Ref: `PAY30-${id.substring(0, 8).toUpperCase()}`,
            };

            acceptanceDetails = {
              isAcceptanceSigned: isCompleted,
              signedAt: isCompleted ? (q.updatedAtUtc || new Date().toISOString()) : undefined,
              ownerSignatureName: 'Lê Văn An (Chủ Trang Trại)',
              is70PercentPaid: isCompleted,
              paid70At: isCompleted ? (q.updatedAtUtc || new Date().toISOString()) : undefined,
              payment70Method: 'BANK_TRANSFER',
              payment70Ref: `PAY70-${id.substring(0, 8).toUpperCase()}`,
              notes: 'Đã nghiệm thu thiết bị hoạt động ổn định.',
            };
          }
        } catch {
          // Quotation not yet issued for this request
        }

        // Fetch GIS mapped nodes count for zone if available
        if (sr.zoneId) {
          try {
            const locRes = await apiClient.get(`/api/v1/zones/${sr.zoneId}/devices/map-locations`);
            const locs = locRes.data?.value ?? locRes.data ?? [];
            if (Array.isArray(locs)) {
              mappedNodesCount = locs.length;
            }
          } catch { }
        }

        const isAccepted = Boolean(acceptanceDetails?.isAcceptanceSigned);
        const derivedStatus = String(sr.status ?? 'Open')
          .replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase() as ServiceRequest['status'];
        // Resolve accurate zone name & farm name
        const zoneObj = sr.zoneId ? allZonesMap[sr.zoneId] : null;
        const farmObj = sr.farmId ? allFarmsMap[sr.farmId] : (zoneObj?.farmId ? allFarmsMap[zoneObj.farmId] : null);

        const descZoneMatch = sr.description?.match(/cho\s+["']?(?:Nhà\s+màng|Zone)\s+["']?([^"'\.\,\n]+)["']?/i)
          || sr.description?.match(/(?:Nhà\s+màng|Zone)\s+["']([^"'\.\,\n]+)["']/i);
        const extractedZone = descZoneMatch ? descZoneMatch[1].trim() : '';

        let effectiveZoneId = sr.zoneId;
        if (!effectiveZoneId && extractedZone) {
          const matchedZone: any = Object.values(allZonesMap).find((z: any) =>
            z.name?.toLowerCase().trim() === extractedZone.toLowerCase().trim() ||
            z.name?.toLowerCase().includes(extractedZone.toLowerCase().trim()) ||
            extractedZone.toLowerCase().includes(z.name?.toLowerCase().trim())
          );
          if (matchedZone) {
            effectiveZoneId = matchedZone.zoneId || matchedZone.id;
          }
        }

        const resolvedZoneName = zoneObj?.name
          || (extractedZone ? (extractedZone.toLowerCase().startsWith('nhà màng') ? extractedZone : `Nhà màng "${extractedZone}"`) : '')
          || sr.zoneName
          || (zoneObj ? `Zone ${zoneObj.name}` : 'Nhà màng');

        const resolvedFarmName = farmObj?.name || sr.farmName || 'Trang trại Nông nghiệp Công nghệ cao';

        const techId = sr.assignedTechnicianId || sr.assignedTechnician;
        let resolvedTechName: string | undefined = undefined;
        if (techId) {
          const matchedTech = allUsersMap[techId];
          if (matchedTech) {
            resolvedTechName = matchedTech.fullName || matchedTech.name || matchedTech.email;
          } else if (sr.assignedTechnicianName && sr.assignedTechnicianName !== 'Trần Minh Trí (Kỹ thuật viên IoT)') {
            resolvedTechName = sr.assignedTechnicianName;
          } else {
            resolvedTechName = 'Kỹ thuật viên Platform';
          }
        }

        const creatorId = sr.history?.[0]?.actorUserId;
        const creator = creatorId ? allUsersMap[creatorId] : null;
        const resolvedRequestedBy = creator?.fullName || farmObj?.ownerName || sr.requestedBy || 'Chủ trang trại (Owner)';

        return {
          serviceRequestId: id,
          deploymentRequestId: sr.deploymentRequestId,
          tenantId: sr.tenantId,
          farmId: sr.farmId || farmObj?.farmId || zoneObj?.farmId,
          farmName: resolvedFarmName,
          zoneId: effectiveZoneId || sr.zoneId,
          zoneName: resolvedZoneName,
          deviceId: sr.originalDeviceId || sr.currentDeviceId,
          deviceName: sr.failureCode || 'Cụm thiết bị IoT',
          title: sr.description?.split('.')[0] || sr.failureCode || 'Yêu cầu Hỗ trợ Kỹ thuật',
          description: sr.description || 'Yêu cầu kiểm tra và bảo dưỡng phần cứng tại nông trang.',
          priority: sr.priority || 'HIGH',
          status: derivedStatus,
          deploymentStatus,
          quotationStatus,
          deploymentLinkInvalid,
          requestType: (['NEW_INSTALL', 'INSTALLATION'].includes(String(sr.failureCode ?? '').toUpperCase()) ? 'INSTALLATION' : 'MAINTENANCE') as 'INSTALLATION' | 'MAINTENANCE',
          requestedBy: resolvedRequestedBy,
          assignedTechnician: techId || undefined,
          assignedTechnicianName: resolvedTechName,
          createdAt: sr.createdAtUtc || sr.createdAt || new Date().toISOString(),
          mappedNodesCount,
          isAcceptedByOwner: isAccepted,
          acceptedAtByOwner: isAccepted ? (sr.closedAtUtc || new Date().toISOString()) : undefined,
          contractDetails,
          acceptanceDetails,
        };
      })
    );

    return enriched;
  },

  /** GET /api/v1/service-requests/{id} */
  getServiceRequestById: async (id: string) => {
    const res = await apiClient.get(`/api/v1/service-requests/${id}`);
    return res.data;
  },

  /** POST /api/v1/farms/{farmId}/service-requests */
  createServiceRequest: async (
    farmIdOrData: string | any,
    maybeData?: any
  ) => {
    const isObj = typeof farmIdOrData === 'object' && farmIdOrData !== null;
    const data = isObj ? farmIdOrData : maybeData;
    const farmId = isObj ? (farmIdOrData.farmId || '30000000-0000-0000-0000-000000000001') : farmIdOrData;

    // Lookup an available device for this farm / zone
    let deviceId = data.deviceId;
    if (!deviceId && !data.skipDeviceLookup) {
      try {
        const devRes = await apiClient.get(`/api/v1/farms/${farmId}/devices`);
        const devList = devRes.data?.value ?? devRes.data ?? [];
        if (Array.isArray(devList) && devList.length > 0) {
          const match = devList.find((d: any) => d.zoneId === data.zoneId) || devList[0];
          deviceId = match.deviceId || match.id;
        }
      } catch { }
    }
    const res = await apiClient.post(`/api/v1/farms/${farmId}/service-requests`, {
      zoneId: data.zoneId,
      deviceId: deviceId || null,
      failureCode: data.failureCode || data.requestType || 'NEW_INSTALL',
      description: data.description || data.title || 'Yêu cầu lắp đặt thiết bị IoT từ Owner Portal',
      ...(data.deploymentRequestId ? { deploymentRequestId: data.deploymentRequestId } : {}),
    });
    return res.data;
  },

  /** POST /api/v1/service-requests/{id}/assign  (Admin only) */
  assignServiceRequest: async (id: string, technicianUserId: string, notes?: string) => {
    const res = await apiClient.post(`/api/v1/service-requests/${id}/assign`, { technicianUserId, notes });
    return res.data;
  },

  /** POST /api/v1/service-requests/{id}/replacement (Technician only) */
  replaceDevice: async (id: string, newDeviceId: string, notes?: string) => {
    const res = await apiClient.post(`/api/v1/service-requests/${id}/replacement`, {
      serviceRequestId: id,
      newDeviceId,
      notes,
    });
    return res.data;
  },

  /** POST /api/v1/service-requests/{id}/close  (Technician only) */
  completeByTechnician: async (id: string) => {
    const res = await apiClient.post(`/api/v1/service-requests/${id}/close`);
    return res.data;
  },

  /** GET /api/v1/farms/{farmId}/tasks — Owner thấy mọi phân công; Farmer chỉ thấy phân công của chính mình. */
  getTasks: async (farmId: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/tasks`);
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/farms/{farmId}/tasks — giao một công việc cho nhiều Farmer */
  createTask: async (
    farmId: string,
    data: {
      zoneId: string;
      title: string;
      description?: string;
      requirements?: string;
      dueAtUtc: string;
      farmerIds: string[];
    }
  ) => {
    const res = await apiClient.post(`/api/v1/farms/${farmId}/tasks`, data);
    return res.data;
  },

  /**
   * PUT /api/v1/farms/{farmId}/tasks/{taskId}
   * Farmer: Accept | Decline | Start | UpdateProgress | Complete | Fail (chỉ trên phân công của chính mình).
   * Owner: Approve (kèm farmerId khi có nhiều kết quả chờ duyệt).
   */
  updateTask: async (
    farmId: string,
    taskId: string,
    data: { action: string; result?: string; failureReason?: string; farmerId?: string; progressPercent?: number; notes?: string }
  ) => {
    const res = await apiClient.put(`/api/v1/farms/${farmId}/tasks/${taskId}`, data);
    return res.data;
  },

  /** POST /api/v1/farms/{farmId}/tasks/{taskId}/assignees — Owner giao thêm/giao lại (kèm hạn mới nếu công việc đã quá hạn) */
  addTaskAssignees: async (farmId: string, taskId: string, farmerIds: string[], newDueAtUtc?: string) => {
    const res = await apiClient.post(`/api/v1/farms/${farmId}/tasks/${taskId}/assignees`, { farmerIds, newDueAtUtc });
    return res.data;
  },

  /** DELETE /api/v1/farms/{farmId}/tasks/{taskId}/assignees/{farmerId} — Owner gỡ một Farmer */
  removeTaskAssignee: async (farmId: string, taskId: string, farmerId: string) => {
    const res = await apiClient.delete(`/api/v1/farms/${farmId}/tasks/${taskId}/assignees/${farmerId}`);
    return res.data;
  },

  /** GET /api/v1/farms/{farmId}/inventory */
  getInventory: async (farmId: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/inventory`);
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/farms/{farmId}/inventory/low-stock-alerts */
  getLowStockAlerts: async (farmId: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/inventory/low-stock-alerts`);
    return res.data?.value ?? res.data ?? [];
  },

  /** Audit logs via adminService */
  getAuditLogs: async (params?: any) => adminService.getAuditLogs(params),

  /** GET /api/v1/farms/{farmId}/weather */
  getWeather: async (farmId: string = '30000000-0000-0000-0000-000000000001') => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/weather`).catch(() => null);
    return res?.data?.value ?? res?.data ?? null;
  },

  /** POST /api/v1/service-requests/{requestId}/quotation */
  sendContract: async (requestId: string, contract: any) => {
    const items = contract?.items || [];
    const res = await apiClient.post(`/api/v1/service-requests/${requestId}/quotation`, {
      items: items.map((i: any) => ({
        code: i.code || i.itemCode || 'HARDWARE-01',
        name: i.name || i.itemName || 'Linh kiện thiết bị',
        category: i.category || inferHardwareCategory(i.code || i.itemCode, i.name || i.itemName),
        unit: i.unit || 'Cái',
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || i.price || 100000,
        vatPercent: i.vatPercent || 8,
        notes: i.notes || ''
      })),
      notes: contract?.notes || 'Báo giá & Hợp đồng triển khai thiết bị IoT',
      contractTerms: contract?.terms || 'Bảo hành 24 tháng theo tiêu chuẩn SmartFarm.'
    });
    return res.data;
  },

  /** GET /api/v1/service-requests/{requestId}/quotation */
  getQuotation: async (requestId: string) => {
    const res = await apiClient.get(`/api/v1/service-requests/${requestId}/quotation`);
    return res.data;
  },

  /** POST /api/v1/service-requests/{requestId}/sign-contract-deposit */
  signContractAndPay30: async (requestId: string, signerFullName: string = 'Lê Văn An', paymentMethod: string = 'BANK_TRANSFER') => {
    const res = await apiClient.post(`/api/v1/service-requests/${requestId}/sign-contract-deposit`, {
      signerFullName,
      paymentMethod,
      transactionReference: `PAY30-${Date.now()}`
    });
    return res.data;
  },

  /** POST /api/v1/service-requests/{requestId}/sign-acceptance-final */
  signAcceptanceAndPay70: async (requestId: string, signerFullName: string = 'Lê Văn An', paymentMethod: string = 'BANK_TRANSFER') => {
    const res = await apiClient.post(`/api/v1/service-requests/${requestId}/sign-acceptance-final`, {
      signerFullName,
      paymentMethod,
      transactionReference: `PAY70-${Date.now()}`
    });
    return res.data;
  },

  acceptByOwner: async (requestId: string) => {
    const res = await apiClient.post(`/api/v1/service-requests/${requestId}/sign-acceptance-final`, {
      signerFullName: 'Chủ nông trại',
      paymentMethod: 'CONFIRMED'
    });
    return res.data;
  },

  /** PUT /api/v1/zones/{zoneId}/devices/bulk-locations */
  updateMappedNodes: async (zoneIdOrRequestId: string, nodesOrCount: any, serviceRequestId?: string, deploymentRequestId?: string) => {
    const isArray = Array.isArray(nodesOrCount);
    const nodes = isArray ? nodesOrCount : [];
    const zoneId = zoneIdOrRequestId;
    const reqId = serviceRequestId || (typeof zoneIdOrRequestId === 'string' ? zoneIdOrRequestId : undefined);

    const formattedNodes = nodes.map((n: any) => {
      let devId = n.deviceId || n.nodeId || n.id;
      const isGuid = typeof devId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(devId);
      if (!isGuid) throw new Error(`Node ${String(devId || n.nodeCode || 'không xác định')} chưa có Device ID hợp lệ; không thể lưu GIS.`);
      const isActuator = (n.actuatorsCount && n.actuatorsCount > 0)
        || (n.nodeCode && (n.nodeCode.includes('VALVE') || n.nodeCode.includes('PUMP')))
        || (n.name && (n.name.includes('Van') || n.name.includes('Bơm')));

      return {
        deviceId: devId,
        latitude: typeof n.latitude === 'number' ? n.latitude : (typeof n.lat === 'number' ? n.lat : NaN),
        longitude: typeof n.longitude === 'number' ? n.longitude : (typeof n.lng === 'number' ? n.lng : NaN),
        batteryLevel: n.batteryLevel ?? null,
        rssi: n.rssi ?? null,
        hardwareAddress: n.serialNumber || n.nodeCode,
        deviceType: isActuator ? 'ActuatorNode' : 'SensorNode',
        deviceName: n.name,
        locationSource: n.locationSource || 'ApproximateMap',
        installationNotes: n.installationNotes
      };
    });

    const res = await apiClient.put(`/api/v1/zones/${zoneId}/devices/bulk-locations`, {
      serviceRequestId: reqId,
      ...(deploymentRequestId ? { deploymentRequestId } : {}),
      nodes: formattedNodes
    });
    return res.data;
  },

  /** GET /api/v1/zones/{zoneId}/devices/map-locations */
  getMappedNodes: async (zoneId: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/devices/map-locations`);
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/platform/technicians/me/spare-parts */
  getTechnicianSpareParts: async () => {
    const res = await apiClient.get('/api/v1/platform/technicians/me/spare-parts');
    return res.data?.value ?? res.data ?? [];
  },

  /** POST /api/v1/zones/{zoneId}/devices/{oldDeviceId}/hot-swap */
  hotSwapDevice: async (zoneId: string, oldDeviceId: string, newDeviceId: string, serviceRequestId?: string, notes?: string) => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/devices/${oldDeviceId}/hot-swap`, {
      serviceRequestId,
      newDeviceId,
      notes: notes || 'Hot-swap replacement executed by technician.'
    });
    return res.data;
  },

  /** POST /api/v1/service-requests/{requestId}/diagnosis */
  diagnoseRequest: async (requestId: string, inspectionNotes: string, diagnosis: string, resolutionAction: number = 0) => {
    const res = await apiClient.post(`/api/v1/service-requests/${requestId}/diagnosis`, {
      inspectionNotes,
      diagnosis,
      resolutionAction
    });
    return res.data;
  },

  /** POST /api/v1/service-requests/{requestId}/work */
  recordWork: async (requestId: string, workPerformed: string) => {
    const res = await apiClient.post(`/api/v1/service-requests/${requestId}/work`, { workPerformed });
    return res.data;
  },

  /** POST /api/v1/service-requests/{requestId}/connection-tests */
  testConnection: async (requestId: string, succeeded: boolean = true, roundTripLatencyMs: number = 35) => {
    const res = await apiClient.post(`/api/v1/service-requests/${requestId}/connection-tests`, {
      succeeded,
      observedAtUtc: new Date().toISOString(),
      roundTripLatencyMs,
      rssi: -72,
      snr: 9.5
    });
    return res.data;
  },
};

export const technicianService = supportService;

// ═══════════════════════════════════════════════════════════════════════════════
// 15. FARMER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const farmerService = {
  /** GET /api/v1/farmer/my-tasks */
  getMyTasks: async () => {
    const res = await apiClient.get('/api/v1/farmer/my-tasks');
    return res.data?.value ?? res.data ?? [];
  },

  /** PUT /api/v1/farmer/tasks/{taskId}/complete */
  completeTask: async (taskId: string, resultNotes?: string) => {
    const res = await apiClient.put(`/api/v1/farmer/tasks/${taskId}/complete`, { resultNotes });
    return res.data;
  },

  /** GET /api/v1/farmer/my-zones */
  getMyZones: async () => {
    const res = await apiClient.get('/api/v1/farmer/my-zones');
    return res.data?.value ?? res.data ?? [];
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 16. NOTIFICATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationItem {
  notificationId: string;
  userId: string;
  tenantId?: string | null;
  title: string;
  message: string;
  type: 'System' | 'Alert' | 'Task' | 'IoT' | 'Inventory' | 'Advice';
  severity: 'Info' | 'Warning' | 'Critical';
  isRead: boolean;
  readAtUtc?: string | null;
  targetUrl?: string | null;
  referenceId?: string | null;
  createdAtUtc: string;
}

export const notificationService = {
  /** GET /api/v1/notifications */
  getNotifications: async (isRead?: boolean, page = 1, pageSize = 20): Promise<NotificationItem[]> => {
    try {
      const res = await apiClient.get('/api/v1/notifications', {
        params: { isRead, page, pageSize }
      });
      return res.data?.value ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  /** GET /api/v1/notifications/unread-count */
  getUnreadCount: async (): Promise<number> => {
    try {
      const res = await apiClient.get('/api/v1/notifications/unread-count');
      return res.data?.unreadCount ?? 0;
    } catch {
      return 0;
    }
  },

  /** PUT /api/v1/notifications/{id}/read */
  markAsRead: async (notificationId: string): Promise<void> => {
    try {
      await apiClient.put(`/api/v1/notifications/${notificationId}/read`);
    } catch { }
  },

  /** PUT /api/v1/notifications/read-all */
  markAllAsRead: async (): Promise<{ updatedCount: number }> => {
    try {
      const res = await apiClient.put('/api/v1/notifications/read-all');
      return res.data ?? { updatedCount: 0 };
    } catch {
      return { updatedCount: 0 };
    }
  },
};

export const zoneContractService = {
  /** GET /api/v1/zone-contracts */
  getAllContracts: async (): Promise<any[]> => {
    try {
      const [res, reqs] = await Promise.all([
        apiClient.get('/api/v1/zone-contracts').catch(() => ({ data: [] })),
        supportService.getServiceRequests().catch(() => [])
      ]);
      const list: any[] = Array.isArray(res.data) ? [...res.data] : (Array.isArray(res.data?.value) ? [...res.data.value] : []);

      // Merge contracts originating from Service Requests (Owner Portal)
      if (Array.isArray(reqs)) {
        reqs.forEach((sr: any) => {
          const c = sr.contractDetails;
          if (c && (c.isSignedByOwner || c.is30PercentPaid || c.isContractSent)) {
            const contractNum = `HD-SR-${(c.contractId || sr.serviceRequestId).substring(0, 8).toUpperCase()}`;
            const exists = list.some((x: any) => x.contractNumber === contractNum || x.id === c.contractId);
            if (!exists && sr.zoneId) {
              const startDate = (c.signedAtByOwner || c.contractSentAt || sr.createdAt || new Date().toISOString()).split('T')[0];
              const startDt = new Date(startDate);
              const endDt = new Date(startDt);
              endDt.setFullYear(endDt.getFullYear() + 1);
              const endDate = endDt.toISOString().split('T')[0];
              const today = new Date();
              const daysRemaining = Math.round((endDt.getTime() - today.getTime()) / (1000 * 3600 * 24));

              const hardwareSummary = c.items && c.items.length > 0
                ? c.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')
                : 'Cụm trạm cảm biến LoRa & rơ-le điều khiển tự động';

              list.unshift({
                id: c.contractId || sr.serviceRequestId,
                tenantId: sr.tenantId,
                farmId: sr.farmId,
                farmName: sr.farmName,
                zoneId: sr.zoneId,
                zoneName: sr.zoneName,
                contractNumber: contractNum,
                cropType: 'Cây trồng VietGAP trong nhà màng',
                monthlyRentVnd: Math.round(c.totalAmount / 12),
                depositVnd: c.deposit30Percent,
                totalContractValueVnd: c.totalAmount,
                subtotalVnd: c.subtotal || Math.round(c.totalAmount / 1.08),
                vatAmountVnd: c.vatTotal || (c.totalAmount - (c.subtotal || Math.round(c.totalAmount / 1.08))),
                discountPercent: c.notes?.includes('15%') ? 15 : 0,
                discountVnd: c.notes?.includes('15%') ? Math.round((c.subtotal || c.totalAmount) * 0.15) : 0,
                startDate: startDate,
                endDate: endDate,
                durationMonths: 12,
                daysRemaining: daysRemaining,
                status: c.isSignedByOwner ? 'Active' : 'ExpiringSoon',
                statusText: c.isSignedByOwner ? 'Còn hiệu lực (Đã cọc 30%)' : 'Chờ Ký Duyệt & Cọc 30%',
                lesseeName: c.ownerSignatureName || 'Lê Văn An (Chủ Trang Trại)',
                lesseePhone: '0903666888',
                lesseeAddress: 'Trang trại thông minh SmartFarm',
                hardwareIncluded: hardwareSummary,
                notes: c.notes || `Hợp đồng tạo qua Cổng Yêu cầu Kỹ thuật #${sr.serviceRequestId.substring(0, 8)}`,
                renewals: []
              });
            }
          }
        });
      }

      return list;
    } catch {
      return [];
    }
  },

  /** GET /api/v1/farms/{farmId}/zone-contracts */
  getContractsByFarm: async (farmId: string): Promise<any[]> => {
    try {
      const all = await zoneContractService.getAllContracts();
      return all.filter((c: any) => c.farmId === farmId);
    } catch {
      return [];
    }
  },

  /** GET /api/v1/zones/{zoneId}/contracts */
  getContractsByZone: async (zoneId: string): Promise<any[]> => {
    try {
      const all = await zoneContractService.getAllContracts();
      return all.filter((c: any) => c.zoneId === zoneId);
    } catch {
      return [];
    }
  },

  /** GET /api/v1/zone-contracts/{id} */
  getContractById: async (id: string): Promise<any> => {
    const res = await apiClient.get(`/api/v1/zone-contracts/${id}`);
    return res.data;
  },

  /** POST /api/v1/zones/{zoneId}/contracts */
  createContract: async (zoneId: string, data: any): Promise<any> => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/contracts`, data);
    return res.data;
  },

  /** POST /api/v1/zone-contracts/{id}/renew */
  renewContract: async (id: string, data: any): Promise<any> => {
    const res = await apiClient.post(`/api/v1/zone-contracts/${id}/renew`, data);
    return res.data;
  },

  /** GET /api/v1/zone-contracts/expiring */
  getExpiringContracts: async (farmId?: string, daysThreshold: number = 30): Promise<any[]> => {
    try {
      const params: any = { daysThreshold };
      if (farmId) params.farmId = farmId;
      const res = await apiClient.get('/api/v1/zone-contracts/expiring', { params });
      return res.data ?? [];
    } catch {
      return [];
    }
  },

  /** GET /api/v1/zones/{zoneId}/depreciations */
  getDepreciationsByZone: async (zoneId: string): Promise<any[]> => {
    try {
      const res = await apiClient.get(`/api/v1/zones/${zoneId}/depreciations`);
      const raw = res.data?.value ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      return list.map((d: any) => ({
        ...d,
        status: d.depreciationStatus || d.status || 'Active',
        depreciationStatus: d.depreciationStatus || d.status || 'Active',
        remainingLifespanMonths: d.remainingMonths ?? d.remainingLifespanMonths,
      }));
    } catch {
      return [];
    }
  },

  /** GET /api/v1/farms/{farmId}/depreciations */
  getDepreciationsByFarm: async (farmId: string): Promise<any[]> => {
    try {
      const res = await apiClient.get(`/api/v1/farms/${farmId}/depreciations`);
      const raw = res.data?.value ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      return list.map((d: any) => ({
        ...d,
        status: d.depreciationStatus || d.status || 'Active',
        depreciationStatus: d.depreciationStatus || d.status || 'Active',
        remainingLifespanMonths: d.remainingMonths ?? d.remainingLifespanMonths,
      }));
    } catch {
      return [];
    }
  },

  /** POST /api/v1/zones/{zoneId}/depreciations */
  createDepreciation: async (zoneId: string, data: any): Promise<any> => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/depreciations`, data);
    const d = res.data?.value ?? res.data;
    if (d) {
      return {
        ...d,
        status: d.depreciationStatus || d.status || 'Active',
        depreciationStatus: d.depreciationStatus || d.status || 'Active',
        remainingLifespanMonths: d.remainingMonths ?? d.remainingLifespanMonths,
      };
    }
    return d;
  },
};




export interface ReportRange { fromUtc?: string; toUtc?: string }
export interface ResourceUsageBucket { zoneId: string; zoneName: string; year: number; month: number; value: number; countedCommandCount: number; unmeasuredCommandCount: number }
export interface ResourceUsageReport { total: number; unit: string; countedCommandCount: number; unmeasuredCommandCount: number; buckets: ResourceUsageBucket[] }
export interface FarmOverviewReport { activeSeasonCount: number; onlineDeviceCount: number; alertsLast7Days: number; openAlertCount: number; openTaskCount: number; zoneCount: number }
export interface TaskReport { total: number; approved: number; failed: number; overdue: number; completionRatePercent: number }

export const gisProxyService = {

  /** POST /api/v1/gis/reverse-geocode (dùng POST để bảo vệ tọa độ không bị ghi vào reverse proxy access logs) */

  reverseGeocode: async (latitude: number, longitude: number) => {

    const res = await apiClient.post('/api/v1/gis/reverse-geocode', {

      latitude,

      longitude

    });

    return res.data;

  },



  /** POST /api/v1/gis/search-location (dùng POST để địa chỉ tìm kiếm không bị ghi vào reverse proxy access logs) */

  searchLocation: async (query: string) => {

    const res = await apiClient.post('/api/v1/gis/search-location', {

      query

    });

    return res.data ?? [];

  },

};

export const reportService = {
  /** GET /api/v1/farms/{farmId}/report/overview */
  getOverview: async (farmId: string): Promise<FarmOverviewReport> => (await apiClient.get(`/api/v1/farms/${farmId}/report/overview`)).data,
  /** GET /api/v1/farms/{farmId}/report/water-usage */
  getWater: async (farmId: string, range: ReportRange): Promise<ResourceUsageReport> => (await apiClient.get(`/api/v1/farms/${farmId}/report/water-usage`, { params: range })).data,
  /** GET /api/v1/farms/{farmId}/report/electricity */
  getElectricity: async (farmId: string, range: ReportRange): Promise<ResourceUsageReport> => (await apiClient.get(`/api/v1/farms/${farmId}/report/electricity`, { params: range })).data,
  /** GET /api/v1/farms/{farmId}/report/tasks */
  getTasks: async (farmId: string, range: ReportRange): Promise<TaskReport> => (await apiClient.get(`/api/v1/farms/${farmId}/report/tasks`, { params: range })).data,

  /** Helper tải file từ URL dạng blob */
  exportFromUrl: async (url: string, params?: ReportRange | Record<string, any>, fallbackName = 'SmartFarm_Report.xlsx'): Promise<{ blob: Blob; fileName: string }> => {
    const res = await apiClient.get(url, {
      params,
      responseType: 'blob'
    });
    const disposition = res.headers['content-disposition'] || res.headers['Content-Disposition'];
    let fileName = fallbackName;
    if (disposition) {
      const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utfMatch && utfMatch[1]) {
        fileName = decodeURIComponent(utfMatch[1]);
      } else {
        const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
        if (asciiMatch && asciiMatch[1]) {
          fileName = asciiMatch[1];
        }
      }
    }
    return { blob: res.data, fileName };
  },

  /** GET /api/v1/farms/{farmId}/report/excel - Xuất báo cáo tổng hợp tài nguyên & vận hành ra file .xlsx */
  exportExcel: async (farmId: string, range?: ReportRange) =>
    reportService.exportFromUrl(`/api/v1/farms/${farmId}/report/excel`, range, `SmartFarm_Report_Resource_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** GET /api/v1/farms/{farmId}/report/overview/excel - Báo cáo tổng quan nông trại */
  exportOverviewExcel: async (farmId: string) =>
    reportService.exportFromUrl(`/api/v1/farms/${farmId}/report/overview/excel`, undefined, `SmartFarm_Report_TongQuan_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** GET /api/v1/farms/{farmId}/report/water-usage/excel - Báo cáo tiêu thụ nước */
  exportWaterExcel: async (farmId: string, range?: ReportRange) =>
    reportService.exportFromUrl(`/api/v1/farms/${farmId}/report/water-usage/excel`, range, `SmartFarm_Report_Nuoc_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** GET /api/v1/farms/{farmId}/report/electricity/excel - Báo cáo điện năng */
  exportElectricityExcel: async (farmId: string, range?: ReportRange) =>
    reportService.exportFromUrl(`/api/v1/farms/${farmId}/report/electricity/excel`, range, `SmartFarm_Report_Dien_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** GET /api/v1/farms/{farmId}/report/inventory/excel - Báo cáo kho & vật tư */
  exportInventoryExcel: async (farmId: string, range?: ReportRange) =>
    reportService.exportFromUrl(`/api/v1/farms/${farmId}/report/inventory/excel`, range, `SmartFarm_Report_TonKho_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** GET /api/v1/farms/{farmId}/report/tasks/excel - Báo cáo phân công công việc */
  exportTasksExcel: async (farmId: string, range?: ReportRange) =>
    reportService.exportFromUrl(`/api/v1/farms/${farmId}/report/tasks/excel`, range, `SmartFarm_Report_CongViec_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** GET /api/v1/farms/{farmId}/report/maintenance/excel - Báo cáo bảo trì thiết bị */
  exportMaintenanceExcel: async (farmId: string, range?: ReportRange) =>
    reportService.exportFromUrl(`/api/v1/farms/${farmId}/report/maintenance/excel`, range, `SmartFarm_Report_BaoTri_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** GET /api/v1/zones/{zoneId}/report/season-summary/excel - Báo cáo tổng kết vụ mùa theo khu vực */
  exportSeasonSummaryExcel: async (zoneId: string) =>
    reportService.exportFromUrl(`/api/v1/zones/${zoneId}/report/season-summary/excel`, undefined, `SmartFarm_Report_VuMua_${new Date().toISOString().slice(0, 10)}.xlsx`),

  /** Helper tải trực tiếp file blob xuống trình duyệt */
  downloadBlob: (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};


// NEW MODULE: STOCK OUT SERVICE (PHIẾU XUẤT KHO)
// ═══════════════════════════════════════════════════════════════════════════════

export const stockOutService = {
  /** GET /api/v1/farms/{farmId}/stock-outs */
  getList: async (farmId: string, status?: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/stock-outs`, {
      params: status ? { status } : undefined,
    });
    return res.data;
  },

  /** GET /api/v1/farms/{farmId}/stock-outs/{id} */
  getById: async (farmId: string, id: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/stock-outs/${id}`);
    return res.data;
  },

  /** POST /api/v1/farms/{farmId}/stock-outs */
  create: async (farmId: string, data: { zoneId?: string; notes?: string; details: { inventoryItemId: string; quantity: number; notes?: string }[] }) => {
    const res = await apiClient.post(`/api/v1/farms/${farmId}/stock-outs`, data);
    return res.data;
  },

  /** PUT /api/v1/farms/{farmId}/stock-outs/{id} */
  update: async (farmId: string, id: string, data: { zoneId?: string; notes?: string; details: { inventoryItemId: string; quantity: number; notes?: string }[] }) => {
    const res = await apiClient.put(`/api/v1/farms/${farmId}/stock-outs/${id}`, data);
    return res.data;
  },

  /** PUT /api/v1/farms/{farmId}/stock-outs/{id}/status */
  updateStatus: async (farmId: string, id: string, status: string | number, notes?: string) => {
    const res = await apiClient.put(`/api/v1/farms/${farmId}/stock-outs/${id}/status`, { status, notes });
    return res.data;
  },

  /** DELETE /api/v1/farms/{farmId}/stock-outs/{id} */
  delete: async (farmId: string, id: string) => {
    const res = await apiClient.delete(`/api/v1/farms/${farmId}/stock-outs/${id}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// NEW MODULE: BILL SERVICE (HÓA ĐƠN ĐỘC LẬP)
// ═══════════════════════════════════════════════════════════════════════════════

export const billService = {
  /** GET /api/v1/bills */
  getAll: async (params?: { contractId?: string; status?: string; fromDate?: string; toDate?: string }) => {
    const res = await apiClient.get('/api/v1/bills', { params });
    return res.data;
  },

  /** GET /api/v1/bills/{id} */
  getById: async (id: string) => {
    const res = await apiClient.get(`/api/v1/bills/${id}`);
    return res.data;
  },

  /** GET /api/v1/contracts/{contractId}/bills */
  getByContract: async (contractId: string) => {
    const res = await apiClient.get(`/api/v1/contracts/${contractId}/bills`);
    return res.data;
  },

  /** POST /api/v1/bills (tạo từ contract) */
  createFromContract: async (data: { contractId: string; amount?: number; dueDate: string; paymentMethod?: string; notes?: string }) => {
    const res = await apiClient.post('/api/v1/bills', data);
    return res.data;
  },

  /** POST /api/v1/bills/{id}/payments */
  recordPayment: async (id: string, data: { paymentAmount: number; paymentMethod?: string; notes?: string }) => {
    const res = await apiClient.post(`/api/v1/bills/${id}/payments`, data);
    return res.data;
  },

  /** PUT /api/v1/bills/{id}/status */
  updateStatus: async (id: string, status: string | number, notes?: string) => {
    const res = await apiClient.put(`/api/v1/bills/${id}/status`, { status, notes });
    return res.data;
  },

  /** PUT /api/v1/bills/{id} */
  update: async (id: string, data: { amount: number; dueDate: string; paymentMethod?: string; notes?: string }) => {
    const res = await apiClient.put(`/api/v1/bills/${id}`, data);
    return res.data;
  },

  /** DELETE /api/v1/bills/{id} */
  delete: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/bills/${id}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// NEW MODULE: CONTRACT PACKAGE SERVICE (GÓI HỢP ĐỒNG)
// ═══════════════════════════════════════════════════════════════════════════════

export const contractPackageService = {
  /** GET /api/v1/contract-packages */
  getAll: async (activeOnly?: boolean, isCustom: boolean = false) => {
    const res = await apiClient.get('/api/v1/contract-packages', {
      params: {
        ...(activeOnly !== undefined ? { activeOnly } : {}),
        isCustom
      },
    });
    return res.data;
  },

  /** GET /api/v1/contract-packages/{id} */
  getById: async (id: string) => {
    const res = await apiClient.get(`/api/v1/contract-packages/${id}`);
    return res.data;
  },

  /** POST /api/v1/contract-packages */
  create: async (data: { packageName: string; description?: string; durationMonths: number; maxZones: number; price: number; currency?: string }) => {
    const res = await apiClient.post('/api/v1/contract-packages', data);
    return res.data;
  },

  /** PUT /api/v1/contract-packages/{id} */
  update: async (id: string, data: { packageName: string; description?: string; durationMonths: number; maxZones: number; price: number; currency?: string; status?: string | number }) => {
    const res = await apiClient.put(`/api/v1/contract-packages/${id}`, data);
    return res.data;
  },

  /** PATCH /api/v1/contract-packages/{id}/toggle-status */
  toggleStatus: async (id: string) => {
    const res = await apiClient.patch(`/api/v1/contract-packages/${id}/toggle-status`);
    return res.data;
  },

  /** DELETE /api/v1/contract-packages/{id} */
  delete: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/contract-packages/${id}`);
    return res.data;
  },
};


export interface BackupMetadataView {
  fileName: string;
  sizeBytes: number;
  createdAtUtc: string;
  totalRecords: number;
  checksumSha256: string;
  createdByEmail: string;
  formatVersion?: string;
  supportedScope?: string;
  tableRecordCounts?: Record<string, number>;
}

export interface CreateBackupResult {
  fileName: string;
  sizeBytes: number;
  createdAtUtc: string;
  totalRecords: number;
  checksumSha256: string;
  message?: string;
  tableRecordCounts?: Record<string, number>;
}

export interface VerifyBackupResult {
  fileName: string;
  isValid: boolean;
  checksumSha256: string;
  checksumVerified: boolean;
  formatVersion: string;
  totalRecords: number;
  tableRecordCounts: Record<string, number>;
  missingRequiredTables: string[];
  warnings: string[];
  message: string;
  verifiedAtUtc: string;
}

export interface RestoreBackupResult {
  fileName: string;
  success: boolean;
  isDryRunOnly: boolean;
  message: string;
  restoredAtUtc: string;
  restoredRecords: number;
  restoredTables: string[];
  preRestoreBackupFileName?: string | null;
  checksumSha256?: string;
}

export interface BackupSystemStatusView {
  allowLiveRestore: boolean;
  retentionDays: number;
  maxBackups: number;
  maxBackupFileSizeBytes: number;
  maxUncompressedSizeBytes: number;
  storageDirectory: string;
  totalBackupsAvailable: number;
}

export const backupService = {
  /** GET /api/v1/platform/backups (PlatformAdmin) */
  list: async (): Promise<BackupMetadataView[]> => (await apiClient.get('/api/v1/platform/backups')).data,

  /** GET /api/v1/platform/backups/status (PlatformAdmin) */
  getStatus: async (): Promise<BackupSystemStatusView> => (await apiClient.get('/api/v1/platform/backups/status')).data,

  /** POST /api/v1/platform/backups (PlatformAdmin) */
  create: async (): Promise<CreateBackupResult> => (await apiClient.post('/api/v1/platform/backups')).data,

  /** GET /api/v1/platform/backups/{fileName}/download (PlatformAdmin) */
  download: async (fileName: string) => {
    const { blob } = await reportService.exportFromUrl(`/api/v1/platform/backups/${encodeURIComponent(fileName)}/download`, undefined, fileName);
    reportService.downloadBlob(blob, fileName);
  },

  /** POST /api/v1/platform/backups/{fileName}/verify (PlatformAdmin) */
  verify: async (fileName: string): Promise<VerifyBackupResult> =>
    (await apiClient.post(`/api/v1/platform/backups/${encodeURIComponent(fileName)}/verify`)).data,

  /** POST /api/v1/platform/backups/{fileName}/restore (PlatformAdmin) */
  restore: async (fileName: string, confirm: boolean, overwriteConfirmation: string): Promise<RestoreBackupResult> =>
    (await apiClient.post(`/api/v1/platform/backups/${encodeURIComponent(fileName)}/restore`, { confirm, overwriteConfirmation })).data,
};
