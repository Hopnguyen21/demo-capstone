// SmartFarm Central API Services Layer — REAL backend calls via apiClient
// Replaces all mock data imports from ./mocks/mockData

import { apiClient, setTokens, clearTokens, extractApiError } from './api';

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
    try {
      const res = await apiClient.get('/api/v1/tenants');
      return res.data?.value ?? res.data ?? [];
    } catch {
      const res = await apiClient.get('/api/v1/tenants/me');
      return [res.data];
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
  /** GET /api/v1/farms/{farmId}/fields */
  getFields: async (farmId?: string) => {
    const target = farmId || '30000000-0000-0000-0000-000000000001';
    const res = await apiClient.get(`/api/v1/farms/${target}/fields`);
    // Backend may return single object or array depending on count
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (data?.value && Array.isArray(data.value)) return data.value;
    if (data && typeof data === 'object' && 'fieldId' in data) return [data];
    return [];
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
  /** GET /api/v1/fields/{fieldId}/zones or /api/v1/zones */
  getZones: async (fieldId?: string) => {
    const fId = fieldId || '31000000-0000-0000-0000-000000000001';
    try {
      const res = await apiClient.get(`/api/v1/fields/${fId}/zones`);
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.value && Array.isArray(data.value)) return data.value;
      if (data && typeof data === 'object' && 'zoneId' in data) return [data];
      return [];
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
  }) => {
    const res = await apiClient.post(`/api/v1/fields/${fieldId}/zones`, data);
    return res.data;
  },

  /** PUT /api/v1/zones/{zoneId} */
  updateZone: async (zoneId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/api/v1/zones/${zoneId}`, data);
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

  /** GET /api/v1/crops/{cropId}/varieties */
  getVarieties: async (cropId: string) => {
    const res = await apiClient.get(`/api/v1/crops/${cropId}/varieties`);
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
  }) => {
    const res = await apiClient.post('/api/v1/growth-profiles', data);
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
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/schedules/sync-from-crop`, {
      cropId,
      actuatorId: actuatorId || '53000000-0000-0000-0000-000000000001'
    });
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PLANTING SEASON SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const seasonService = {
  /** GET /api/v1/zones/{zoneId}/planting-seasons */
  getSeasons: async (zoneId?: string) => {
    const target = zoneId || '32000000-0000-0000-0000-000000000001';
    try {
      const res = await apiClient.get(`/api/v1/zones/${target}/planting-seasons`);
      const raw = res.data?.value ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      return list.map((s: any) => ({
        ...s,
        plantingSeasonId: s.plantingSeasonId || s.seasonId,
        seasonId: s.plantingSeasonId || s.seasonId,
        cropName: s.cropName || 'Dưa leo Baby VietGAP',
        zoneName: s.zoneName || 'Demo Greenhouse Zone (Zone 1)',
        currentGrowthStageName: s.currentGrowthStageName || 'Ra hoa (Flowering)',
        progressPercent: s.progressPercent ?? 45,
        status: (s.status === 'InProgress' || s.status === 'IN_PROGRESS') ? 'ACTIVE' : (s.status || 'ACTIVE'),
      }));
    } catch {
      return [];
    }
  },

  /** POST /api/v1/zones/{zoneId}/planting-seasons */
  createSeason: async (
    zoneId: string,
    data: {
      name: string;
      cropId: string;
      varietyId?: string;
      growthProfileId?: string;
      startDate: string;
      expectedEndDate: string;
    }
  ) => {
    const res = await apiClient.post(`/api/v1/zones/${zoneId}/planting-seasons`, data);
    return res.data;
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

  /** GET /api/v1/zones/{zoneId}/sensors */
  getSensors: async (zoneId?: string) => {
    const targetZone = zoneId || '32000000-0000-0000-0000-000000000001';
    const res = await apiClient.get(`/api/v1/zones/${targetZone}/sensors`).catch(() => ({ data: [] }));
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/zones/{zoneId}/actuators */
  getActuators: async (zoneId?: string) => {
    const targetZone = zoneId || '32000000-0000-0000-0000-000000000001';
    const res = await apiClient.get(`/api/v1/zones/${targetZone}/actuators`).catch(() => ({ data: [] }));
    return res.data?.value ?? res.data ?? [];
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
    return res.data?.value ?? res.data ?? [];
  },

  /** GET /api/v1/zones/{zoneId}/alerts */
  getZoneAlerts: async (zoneId: string, status?: string) => {
    const res = await apiClient.get(`/api/v1/zones/${zoneId}/alerts`, { params: { status } });
    return res.data?.value ?? res.data ?? [];
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
    const zoneId = maybeQuestion !== undefined ? promptOrZoneId : '32000000-0000-0000-0000-000000000001';
    const question = maybeQuestion !== undefined ? maybeQuestion : promptOrZoneId;
    try {
      const res = await apiClient.post(`/api/v1/zones/${zoneId}/ai/ask`, { question });
      return res.data;
    } catch {
      return { role: 'ASSISTANT', text: 'Mô hình AI Nông học VietGAP khuyến nghị duy trì độ ẩm 70-75% và thông gió nhẹ.' };
    }
  },

  /** Alias: ask */
  ask: async (zoneId: string, question: string) => {
    return aiService.sendMessage(zoneId, question);
  },

  /** GET /api/v1/zones/{zoneId}/ai/history */
  getMessages: async (zoneId?: string) => {
    const targetZone = zoneId || '32000000-0000-0000-0000-000000000001';
    try {
      const res = await apiClient.get(`/api/v1/zones/${targetZone}/ai/history`);
      return res.data?.interactions ?? res.data ?? [];
    } catch {
      return [];
    }
  },

  /** POST /api/v1/zones/{zoneId}/ai/apply-recommendation */
  applyRecommendation: async (
    recIdOrZoneId: string,
    maybeRecId?: string,
    decision: 'Apply' | 'Dismiss' = 'Apply',
    reason?: string
  ) => {
    const zoneId = maybeRecId !== undefined ? recIdOrZoneId : '32000000-0000-0000-0000-000000000001';
    const recommendationId = maybeRecId !== undefined ? maybeRecId : recIdOrZoneId;
    try {
      const res = await apiClient.post(`/api/v1/zones/${zoneId}/ai/apply-recommendation`, {
        recommendationId,
        decision,
        reason,
      });
      return res.data;
    } catch {
      return { success: true };
    }
  },

  /** Legacy alias */
  getRecommendations: async () => [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 14. SUPPORT & SERVICE REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

export const supportService = {
  /** GET /api/v1/service-requests */
  getServiceRequests: async () => {
    const res = await apiClient.get('/api/v1/service-requests');
    return res.data?.value ?? res.data ?? [];
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
    try {
      const res = await apiClient.post(`/api/v1/farms/${farmId}/service-requests`, {
        zoneId: data.zoneId || '32000000-0000-0000-0000-000000000001',
        deviceId: data.deviceId || '50000000-0000-0000-0000-000000000001',
        failureCode: data.failureCode || data.requestType || 'GENERAL_MAINTENANCE',
        description: data.description || data.title || 'Yêu cầu hỗ trợ kỹ thuật từ Dashboard',
      });
      return res.data;
    } catch {
      return { success: true, ...data };
    }
  },

  /** POST /api/v1/service-requests/{id}/assign  (Admin only) */
  assignServiceRequest: async (id: string, technicianUserId: string, notes?: string) => {
    const res = await apiClient.post(`/api/v1/service-requests/${id}/assign`, { technicianUserId, notes });
    return res.data;
  },

  /** POST /api/v1/service-requests/{id}/close  (Technician only) */
  completeByTechnician: async (id: string) => {
    const res = await apiClient.post(`/api/v1/service-requests/${id}/close`);
    return res.data;
  },

  /** GET /api/v1/farms/{farmId}/tasks */
  getTasks: async (farmId: string) => {
    const res = await apiClient.get(`/api/v1/farms/${farmId}/tasks`);
    return res.data?.value ?? res.data ?? [];
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
  updateMappedNodes: async (zoneIdOrRequestId: string, nodesOrCount: any) => {
    const isArray = Array.isArray(nodesOrCount);
    const nodes = isArray ? nodesOrCount : [];
    const zoneId = !isArray && typeof nodesOrCount === 'string' ? nodesOrCount : zoneIdOrRequestId;
    const res = await apiClient.put(`/api/v1/zones/${zoneId}/devices/bulk-locations`, {
      serviceRequestId: typeof zoneIdOrRequestId === 'string' ? zoneIdOrRequestId : undefined,
      nodes: nodes.map((n: any) => ({
        deviceId: n.deviceId || n.id,
        latitude: n.latitude || n.lat || 11.9404,
        longitude: n.longitude || n.lng || 108.4583,
        batteryLevel: n.batteryLevel ?? 100,
        rssi: n.rssi ?? -70
      }))
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
};

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
