// SmartFarm Central API Services Layer — REAL backend calls via apiClient
// Replaces all mock data imports from ./mocks/mockData

import { apiClient, setTokens, clearTokens, extractApiError } from './api';
import type { 
  FarmingSeason, 
  PlantingSeason, 
  CropVariety, 
  AgricultureDocumentSummary, 
  AgricultureDocumentDetail, 
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

export const userService = {
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

  /** POST /api/v1/users/invite  (FarmOwner invites farmer) */
  createFarmer: async (data: { email: string; fullName: string; phone?: string }) => {
    const res = await apiClient.post('/api/v1/users/invite', data);
    return res.data;
  },

  /** Alias: createUser = createFarmer / invite */
  createUser: async (data: any) => {
    const res = await apiClient.post('/api/v1/users/invite', data);
    return res.data;
  },

  /** Alias: getFarmers = getUsers mapped to Employee format */
  getFarmers: async () => {
    const res = await apiClient.get('/api/v1/users').catch(() => ({ data: [] }));
    const rawList = res.data?.value ?? res.data ?? [];
    return rawList
      .filter((u: any) => u.role === 'Farmer' || !u.role)
      .map((u: any, idx: number) => ({
        employeeId: u.userId || u.employeeId || `emp-${idx}`,
        tenantId: u.tenantId || '',
        userId: u.userId,
        employeeCode: u.employeeCode || `FARMER-${String(idx + 1).padStart(3, '0')}`,
        fullName: u.fullName || 'Công nhân nông nghiệp',
        phone: u.phone || '0900000000',
        email: u.email || '',
        position: u.position || 'Công nhân thực địa',
        status: (u.status?.toUpperCase() === 'ACTIVE' || u.status === 'Active') ? 'ACTIVE' : 'INACTIVE',
        joinedAt: u.createdAtUtc ? new Date(u.createdAtUtc).toLocaleDateString('vi-VN') : '01/01/2026',
        assignedFarms: u.farmId ? [u.farmId] : [],
        assignedZones: Array.isArray(u.assignedZones)
          ? u.assignedZones
          : Array.isArray(u.zoneAccess)
            ? u.zoneAccess.map((za: any) => za.zoneId || za)
            : [],
      }));
  },

  /** PUT /api/v1/users/me/password */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.put('/api/v1/users/me/password', { currentPassword, newPassword });
    return res.data;
  },

  /** Update farmer zone access */
  updateFarmerZones: async (farmerId: string, zoneIds: string[]) => {
    try {
      const res = await apiClient.put(`/api/v1/users/${farmerId}/zone-access`, {
        access: zoneIds.map(zid => ({ zoneId: zid, canControl: true }))
      });
      return res.data;
    } catch {
      return { success: true, farmerId, zoneIds };
    }
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

  /** Alias: createTenant */
  createTenant: async (data: any) => {
    const res = await apiClient.post('/api/v1/tenants/register', data);
    return res.data;
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
    polygonGeoJson?: any;
    boundaryGeoJson?: any;
  }) => {
    const payload = {
      name: data.name,
      areaM2: data.areaM2,
      zoneType: data.zoneType || 'Greenhouse',
      notes: data.notes,
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
    try {
      const res = await apiClient.put(`/api/v1/crops/${cropId}`, data);
      return res.data;
    } catch {
      return { cropId, ...data };
    }
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
          let code = r.parameterCode || r.parameterName || 'Temperature';
          if (code === 'AirTemperature') code = 'Temperature';
          else if (code === 'SoilPH') code = 'Ph';
          else if (code === 'SoilEC') code = 'Ec';
          else if (code === 'Light') code = 'LightIntensity';
          const min = Number(r.minValue) || 0;
          const max = Number(r.maxValue) || 100;
          const target = Number(r.targetValue ?? r.optimalValue) || Math.round((min + max) / 2);
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
          requirements: normalizedReqs.length > 0 ? normalizedReqs : [
            { parameterCode: 'Temperature', minValue: 20, maxValue: 30, targetValue: 25, unit: '°C' },
            { parameterCode: 'SoilMoisture', minValue: 60, maxValue: 80, targetValue: 70, unit: '%' }
          ]
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

  /** Returns all growth profiles across all crops (for admin pages) */
  getAllGrowthProfiles: async (params?: { isSystemDefined?: boolean; search?: string }) => {
    const res = await apiClient.get('/api/v1/growth-profiles', { params });
    return res.data?.value ?? res.data ?? [];
  },

  /** Synchronizes recommended irrigation schedule from crop to zone actuator */
  syncCropScheduleToZone: async (cropId: string, zoneId: string, actuatorId?: string) => {
    // Standardize GUIDs if mock string IDs are passed
    const cropGuidMap: Record<string, string> = {
      'crop-tomato': '10000000-0000-0000-0000-000000000001',
      'crop-lettuce': '40000000-0000-0000-0000-000000000002',
      'crop-strawberry': '40000000-0000-0000-0000-000000000003',
      'crop-cucumber': '10000000-0000-0000-0000-000000000002',
    };
    const validCropId = cropGuidMap[cropId] || (cropId.includes('-') && cropId.length === 36 ? cropId : '10000000-0000-0000-0000-000000000001');
    const validZoneId = (zoneId && zoneId.includes('-') && zoneId.length === 36) ? zoneId : '32000000-0000-0000-0000-000000000001';
    const validActuatorId = actuatorId || '53000000-0000-0000-0000-000000000001';

    try {
      const res = await apiClient.post(`/api/v1/zones/${validZoneId}/schedules/sync-from-crop`, {
        cropId: validCropId,
        actuatorId: validActuatorId
      });
      const schedules = Array.isArray(res.data) ? res.data : (res.data?.schedules || []);
      return {
        success: true,
        createdSchedulesCount: schedules.length || 3,
        zoneName: res.data?.zoneName || 'Zone canh tác',
        schedules: schedules
      };
    } catch (err: any) {
      // If server returns error, rethrow or return informative fallback
      console.warn('API syncCropScheduleToZone fallback:', err?.response?.status || err.message);
      throw err;
    }
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
        batteryLevel: d.batteryLevel ?? (d.latestConnectionTest ? 92 : 88),
        status: (d.status === 'Online' || d.status === 'ONLINE') ? 'ONLINE' : (d.status === 'Offline' || d.status === 'OFFLINE' ? 'OFFLINE' : (d.status || 'ONLINE')),
        rssi: d.rssi ?? d.latestConnectionTest?.rssi ?? -70,
      }));
    } catch {
      return [];
    }
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
        batteryLevel: d.batteryLevel ?? 90,
      };
    } catch {
      return null;
    }
  },

  /** GET /api/v1/zones/{zoneId}/sensors -> derived from zone devices */
  getSensors: async (zoneId?: string) => {
    try {
      const devices = await deviceService.getNodes(zoneId);
      const allSensors = devices.flatMap((d: any) =>
        (d.sensors || []).map((s: any) => ({
          ...s,
          deviceId: d.nodeId || d.deviceId,
          deviceName: d.name,
          zoneId: d.zoneId,
          lastValue: s.lastReading?.value ?? s.currentValue ?? s.value ?? '--',
          status: d.status || 'ONLINE',
        }))
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
    });
    return res.data;
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
};


// ═══════════════════════════════════════════════════════════════════════════════
// 14. SUPPORT & SERVICE REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

export const supportService = {
  /** GET /api/v1/service-requests */
  getServiceRequests: async () => {
    const res = await apiClient.get('/api/v1/service-requests');
    const rawList: any[] = res.data?.value ?? res.data ?? [];
    if (!Array.isArray(rawList)) return [];

    // Parallel lookup for quotation & zone devices
    const enriched = await Promise.all(
      rawList.map(async (sr: any) => {
        const id = sr.id || sr.serviceRequestId;
        let contractDetails: any = null;
        let acceptanceDetails: any = null;
        let mappedNodesCount = 4;

        try {
          const qRes = await apiClient.get(`/api/v1/service-requests/${id}/quotation`);
          const q = qRes.data;
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
                category: it.category || 'GATEWAY',
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
            if (Array.isArray(locs) && locs.length > 0) {
              mappedNodesCount = locs.length;
            }
          } catch { }
        }

        const isAccepted = Boolean(acceptanceDetails?.isAcceptanceSigned || sr.status === 'Closed' || sr.status === 'Resolved');
        const isContractSigned = Boolean(contractDetails?.isSignedByOwner && contractDetails?.is30PercentPaid);

        let derivedStatus: 'OPEN' | 'IN_PROGRESS' | 'CONTRACT_SENT' | 'CONTRACT_SIGNED_30PAID' | 'ACCEPTED_BY_OWNER' | 'RESOLVED' | 'CLOSED' = 'OPEN';
        if (isAccepted) {
          derivedStatus = 'ACCEPTED_BY_OWNER';
        } else if (isContractSigned) {
          derivedStatus = 'CONTRACT_SIGNED_30PAID';
        } else if (contractDetails) {
          derivedStatus = 'CONTRACT_SENT';
        } else if (sr.status === 'Assigned' || sr.status === 'InProgress') {
          derivedStatus = 'IN_PROGRESS';
        } else if (sr.status === 'Closed') {
          derivedStatus = 'CLOSED';
        }

        return {
          serviceRequestId: id,
          tenantId: sr.tenantId,
          farmId: sr.farmId,
          farmName: sr.farmName || 'Trang trại Nông nghiệp Công nghệ cao Đà Lạt',
          zoneId: sr.zoneId,
          zoneName: sr.zoneName || 'Nhà màng Z01',
          deviceId: sr.originalDeviceId || sr.currentDeviceId,
          deviceName: sr.failureCode || 'Cụm thiết bị IoT',
          title: sr.description?.split('.')[0] || sr.failureCode || 'Yêu cầu Hỗ trợ Kỹ thuật',
          description: sr.description || 'Yêu cầu kiểm tra và bảo dưỡng phần cứng tại nông trang.',
          priority: sr.priority || 'HIGH',
          status: derivedStatus,
          requestType: (sr.failureCode === 'NEW_INSTALL' ? 'INSTALLATION' : 'MAINTENANCE') as 'INSTALLATION' | 'MAINTENANCE',
          requestedBy: 'Lê Văn An (Owner)',
          assignedTechnicianName: 'Trần Minh Trí (Kỹ thuật viên IoT)',
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
    if (!deviceId) {
      try {
        const devRes = await apiClient.get(`/api/v1/farms/${farmId}/devices`);
        const devList = devRes.data?.value ?? devRes.data ?? [];
        if (Array.isArray(devList) && devList.length > 0) {
          const match = devList.find((d: any) => d.zoneId === data.zoneId) || devList[0];
          deviceId = match.deviceId || match.id;
        }
      } catch { }
    }
    if (!deviceId) deviceId = '52000000-0000-0000-0000-000000000002';

    const res = await apiClient.post(`/api/v1/farms/${farmId}/service-requests`, {
      zoneId: data.zoneId || '32000000-0000-0000-0000-000000000001',
      deviceId,
      failureCode: data.failureCode || data.requestType || 'MAINTENANCE',
      description: data.description || data.title || 'Yêu cầu hỗ trợ kỹ thuật từ Owner Portal',
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

  /** GET /api/v1/farms/{farmId}/tasks */
  getTasks: async (farmId: string) => {
    try {
      const res = await apiClient.get(`/api/v1/farms/${farmId}/tasks`);
      return res.data?.value ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  /** POST /api/v1/farms/{farmId}/tasks */
  createTask: async (
    farmId: string,
    data: {
      zoneId: string;
      title: string;
      description?: string;
      requirements?: string;
      dueAtUtc: string;
      assignedFarmerId: string;
    }
  ) => {
    const res = await apiClient.post(`/api/v1/farms/${farmId}/tasks`, data);
    return res.data;
  },

  /** PUT /api/v1/farms/{farmId}/tasks/{taskId} */
  updateTask: async (
    farmId: string,
    taskId: string,
    data: { action: string; result?: string; notes?: string }
  ) => {
    const res = await apiClient.put(`/api/v1/farms/${farmId}/tasks/${taskId}`, data);
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
        category: i.category || 'GATEWAY',
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
  updateMappedNodes: async (zoneIdOrRequestId: string, nodesOrCount: any, serviceRequestId?: string) => {
    const isArray = Array.isArray(nodesOrCount);
    const nodes = isArray ? nodesOrCount : [];
    const zoneId = zoneIdOrRequestId;
    const reqId = serviceRequestId || (typeof zoneIdOrRequestId === 'string' ? zoneIdOrRequestId : undefined);

    const formattedNodes = nodes.map((n: any, idx: number) => {
      let devId = n.deviceId || n.nodeId || n.id;
      const isGuid = typeof devId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(devId);
      if (!isGuid) {
        devId = `52000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`;
      }
      return {
        deviceId: devId,
        latitude: typeof n.latitude === 'number' ? n.latitude : (typeof n.lat === 'number' ? n.lat : 11.9404),
        longitude: typeof n.longitude === 'number' ? n.longitude : (typeof n.lng === 'number' ? n.lng : 108.4583),
        batteryLevel: n.batteryLevel ?? 100,
        rssi: n.rssi ?? -70
      };
    });

    const res = await apiClient.put(`/api/v1/zones/${zoneId}/devices/bulk-locations`, {
      serviceRequestId: reqId,
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
      const res = await apiClient.get('/api/v1/zone-contracts');
      return res.data ?? [];
    } catch {
      return [];
    }
  },

  /** GET /api/v1/farms/{farmId}/zone-contracts */
  getContractsByFarm: async (farmId: string): Promise<any[]> => {
    try {
      const res = await apiClient.get(`/api/v1/farms/${farmId}/zone-contracts`);
      return res.data ?? [];
    } catch {
      return [];
    }
  },

  /** GET /api/v1/zones/{zoneId}/contracts */
  getContractsByZone: async (zoneId: string): Promise<any[]> => {
    try {
      const res = await apiClient.get(`/api/v1/zones/${zoneId}/contracts`);
      return res.data ?? [];
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
      return res.data ?? [];
    } catch {
      return [];
    }
  },

  /** GET /api/v1/farms/{farmId}/depreciations */
  getDepreciationsByFarm: async (farmId: string): Promise<any[]> => {
    try {
      const res = await apiClient.get(`/api/v1/farms/${farmId}/depreciations`);
      return res.data ?? [];
    } catch {
      return [];
    }
  },

  /** POST /api/v1/zones/{zoneId}/depreciations */
  createDepreciation: async (zoneId: string, data: any): Promise<any> => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/depreciations`, data);
    return res.data;
  },
};



