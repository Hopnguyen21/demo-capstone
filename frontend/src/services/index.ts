// SmartFarm Central API Services Layer

import {
  mockTenants, mockUsers, mockFarms, mockFields, mockZones, mockEmployees,
  mockCrops, mockVarieties, mockGrowthProfileTomato, mockPlantingSeasons,
  mockGateways, mockNodes, mockSensors, mockActuators, mockTelemetryHistory,
  mockAlerts, mockSchedules, mockAutomationRules, mockWeather, mockAIRecommendations,
  mockAIMessages, mockTasks, mockInventory, mockServiceRequests, mockAuditLogs,
  mockEnvironmentalConfigs, mockControlLogs
} from '../mocks/mockData';
import { User, Tenant, Farm, Field, Zone, Employee, Crop, CropVariety, GrowthProfile, PlantingSeason, Gateway, SensorNode, Sensor, Actuator, TelemetryReading, Alert, ControlSchedule, AutomationRule, AIRecommendation, AIMessage, TaskItem, MaterialInventory, ServiceRequest, AuditLog, ControlExecutionLog, EnvironmentalTargetConfig, CF3StepDetail, CF3StepNumber } from '../types';

// Auth Service
export const authService = {
  login: async (email: string, role: string): Promise<User> => {
    const user = mockUsers.find(u => u.role === role) || mockUsers[2];
    return user;
  },
  logout: async () => true,
  refreshToken: async () => 'mock-jwt-token-refreshed',
};

// User & Employee Service
export const userService = {
  getUsers: async (): Promise<User[]> => mockUsers,
  getUserById: async (id: string) => mockUsers.find(u => u.userId === id),
  getEmployees: async (): Promise<Employee[]> => mockEmployees,
  createFarmer: async (data: Partial<Employee>) => {
    const newEmp: Employee = {
      employeeId: `emp-${Date.now()}`,
      tenantId: 'tenant-01',
      employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      fullName: data.fullName || 'Công nhân mới',
      phone: data.phone || '0900 000 000',
      email: data.email || 'worker@smartfarm.vn',
      position: data.position || 'Nông dân',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString().split('T')[0],
      assignedFarms: data.assignedFarms || ['farm-01'],
      assignedZones: data.assignedZones || ['zone-01'],
    };
    mockEmployees.push(newEmp);
    return newEmp;
  },
  updateFarmerZones: async (employeeId: string, assignedZones: string[]) => {
    const emp = mockEmployees.find(e => e.employeeId === employeeId);
    if (emp) {
      emp.assignedZones = assignedZones;
    }
    return emp;
  }
};

// Tenant Service
export const tenantService = {
  getTenants: async (): Promise<Tenant[]> => mockTenants,
  getTenantById: async (id: string) => mockTenants.find(t => t.tenantId === id),
};

// Farm Service
export const farmService = {
  getFarms: async (): Promise<Farm[]> => mockFarms,
  getFarmById: async (id: string) => mockFarms.find(f => f.farmId === id) || mockFarms[0],
  createFarm: async (data: Partial<Farm>): Promise<Farm> => {
    const newFarm: Farm = {
      farmId: `farm-${Date.now()}`,
      tenantId: 'tenant-01',
      name: data.name || 'Trang trại mới',
      description: data.description || '',
      address: data.address || 'Đà Lạt, Lâm Đồng',
      areaM2: data.areaM2 || 10000,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      fieldsCount: 1,
      zonesCount: 1,
      devicesCount: 2,
      center: [11.9404, 108.4583]
    };
    mockFarms.push(newFarm);
    return newFarm;
  }
};

// Field & Zone Service
export const fieldService = {
  getFields: async (farmId?: string): Promise<Field[]> => mockFields.filter(f => !farmId || f.farmId === farmId),
};

export const zoneService = {
  getZones: async (farmId?: string): Promise<Zone[]> => mockZones.filter(z => !farmId || z.farmId === farmId),
  getZoneById: async (id: string) => mockZones.find(z => z.zoneId === id) || mockZones[0],
};

// Crop Service
export const cropService = {
  getCrops: async (): Promise<Crop[]> => mockCrops,
  getVarieties: async (): Promise<CropVariety[]> => mockVarieties,
  getGrowthProfiles: async (): Promise<GrowthProfile[]> => [mockGrowthProfileTomato],
};

// Season Service
export const seasonService = {
  getSeasons: async (): Promise<PlantingSeason[]> => mockPlantingSeasons,
};

// Gateway & IoT Device Service
export const deviceService = {
  getGateways: async (): Promise<Gateway[]> => mockGateways,
  getNodes: async (zoneId?: string): Promise<SensorNode[]> => mockNodes.filter(n => !zoneId || n.zoneId === zoneId),
  getSensors: async (nodeId?: string): Promise<Sensor[]> => mockSensors.filter(s => !nodeId || s.nodeId === nodeId),
  getActuators: async (zoneId?: string): Promise<Actuator[]> => mockActuators.filter(a => !zoneId || a.zoneId === zoneId),
};

// Telemetry Service
export const telemetryService = {
  getRealtime: async () => mockSensors,
  getHistory: async (zoneId?: string) => mockTelemetryHistory,
};

// Alert Service
export const alertService = {
  getAlerts: async (): Promise<Alert[]> => mockAlerts,
  acknowledgeAlert: async (id: string) => {
    const alert = mockAlerts.find(a => a.alertId === id);
    if (alert) {
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedBy = 'Người dùng';
      alert.acknowledgedAt = new Date().toISOString();
    }
    return alert;
  }
};

// Control Service (CF3 - Smart Environmental Control & Actuation)
export const controlService = {
  getActuators: async (): Promise<Actuator[]> => mockActuators,
  getSchedules: async (): Promise<ControlSchedule[]> => mockSchedules,
  getAutoRules: async (): Promise<AutomationRule[]> => mockAutomationRules,
  getEnvironmentalConfigs: async (): Promise<EnvironmentalTargetConfig[]> => mockEnvironmentalConfigs,
  getControlLogs: async (): Promise<ControlExecutionLog[]> => mockControlLogs,

  createSeasonSchedule: async (data: Partial<ControlSchedule>): Promise<ControlSchedule> => {
    const act = mockActuators.find(a => a.actuatorId === data.actuatorId) || mockActuators[0];
    const zone = mockZones.find(z => z.zoneId === data.zoneId) || mockZones[0];
    
    const newSchedule: ControlSchedule = {
      scheduleId: `sched-${Date.now()}`,
      zoneId: zone.zoneId,
      zoneName: zone.name,
      actuatorId: act.actuatorId,
      actuatorName: act.name,
      name: data.name || `Lịch tưới mùa vụ (${data.growthStageName || 'Tự động'})`,
      startTime: data.startTime || '07:00',
      endTime: data.endTime || '07:20',
      daysOfWeek: data.daysOfWeek || ['Mon', 'Wed', 'Fri', 'Sun'],
      actionType: 'TURN_ON',
      durationMinutes: data.durationMinutes || 20,
      isActive: true,
      plantingSeasonId: data.plantingSeasonId,
      seasonName: data.seasonName,
      growthStageName: data.growthStageName,
    };

    mockSchedules.unshift(newSchedule);
    return newSchedule;
  },

  toggleActuator: async (actuatorId: string, newState: 'ON' | 'OFF') => {
    const act = mockActuators.find(a => a.actuatorId === actuatorId);
    if (act) {
      act.status = newState;
      act.lastStateChangeAt = 'Vừa xong';
      
      // Add log entry
      const newLog: ControlExecutionLog = {
        logId: `ctl-log-${Date.now()}`,
        actuatorId: act.actuatorId,
        actuatorName: act.name,
        actuatorType: act.actuatorType,
        zoneId: act.zoneId || 'zone-01',
        zoneName: act.zoneName || 'Nhà màng 01',
        action: newState === 'ON' ? 'TURN_ON' : 'TURN_OFF',
        durationMinutes: 15,
        triggerSource: 'MANUAL',
        gatewayCode: 'GW-ESP32-DL01',
        nodeCode: 'SN-LORA-001',
        rssi: -78,
        executionStatus: 'SUCCESS',
        executedAt: new Date().toISOString(),
        completedAt: newState === 'OFF' ? new Date().toISOString() : undefined,
        parametersSnapshot: { soilMoisture: 68.4, temperature: 24.8, humidity: 71.5, lightIntensity: 740 }
      };
      mockControlLogs.unshift(newLog);
    }
    return act;
  },

  emergencyStopAll: async (): Promise<{ stoppedCount: number }> => {
    let count = 0;
    mockActuators.forEach(act => {
      if (act.status === 'ON') {
        act.status = 'OFF';
        act.lastStateChangeAt = 'Hủy khẩn cấp (Emergency Stop)';
        count++;
      }
    });

    const emergencyLog: ControlExecutionLog = {
      logId: `ctl-log-emerg-${Date.now()}`,
      actuatorId: 'ALL',
      actuatorName: 'TẤT CẢ THIẾT BỊ CHẤP HÀNH',
      actuatorType: 'PUMP',
      zoneId: 'farm-01',
      zoneName: 'Toàn bộ Trang trại',
      action: 'TURN_OFF',
      triggerSource: 'MANUAL',
      gatewayCode: 'GW-ESP32-DL01',
      nodeCode: 'BROADCAST_ALL',
      executionStatus: 'EMERGENCY_STOP',
      executedAt: new Date().toISOString(),
      failureReason: 'BR-CANCEL-01: Phát lệnh HỦY KHẨN CẤP qua MQTT Broadcast Downlink'
    };
    mockControlLogs.unshift(emergencyLog);

    return { stoppedCount: count };
  }
};

// AI Service
export const aiService = {
  getMessages: async (): Promise<AIMessage[]> => mockAIMessages,
  sendMessage: async (text: string): Promise<AIMessage> => {
    const userMsg: AIMessage = {
      messageId: `msg-${Date.now()}`,
      conversationId: 'conv-01',
      senderType: 'USER',
      messageText: text,
      createdAt: new Date().toISOString(),
    };
    mockAIMessages.push(userMsg);
    
    // Simulate AI response
    setTimeout(() => {
      const aiMsg: AIMessage = {
        messageId: `msg-${Date.now() + 1}`,
        conversationId: 'conv-01',
        senderType: 'AI',
        messageText: `[SmartFarm AI Agronomist]: Tôi đã ghi nhận câu hỏi "${text}". Dữ liệu vi khí hậu hiện tại của trang trại đang ở trạng thái an toàn.`,
        createdAt: new Date().toISOString(),
      };
      mockAIMessages.push(aiMsg);
    }, 500);

    return userMsg;
  },
  getRecommendations: async (): Promise<AIRecommendation[]> => mockAIRecommendations,
  applyRecommendation: async (id: string) => {
    const rec = mockAIRecommendations.find(r => r.recommendationId === id);
    if (rec) rec.status = 'ACCEPTED';
    return rec;
  }
};

// Tasks & Support Service
export const supportService = {
  getTasks: async (): Promise<TaskItem[]> => mockTasks,
  getInventory: async (): Promise<MaterialInventory[]> => mockInventory,
  getServiceRequests: async (): Promise<ServiceRequest[]> => mockServiceRequests,
  getAuditLogs: async (): Promise<AuditLog[]> => mockAuditLogs,
  getWeather: async () => mockWeather,
};
