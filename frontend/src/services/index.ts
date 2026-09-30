// SmartFarm Central API Services Layer

import {
  mockTenants, mockUsers, mockFarms, mockFields, mockZones, mockEmployees,
  mockCrops, mockVarieties, mockGrowthProfileTomato, mockPlantingSeasons,
  mockGateways, mockNodes, mockSensors, mockActuators, mockTelemetryHistory,
  mockAlerts, mockSchedules, mockAutomationRules, mockWeather, mockAIRecommendations,
  mockAIMessages, mockTasks, mockInventory, mockServiceRequests, mockAuditLogs,
  mockEnvironmentalConfigs, mockControlLogs
} from '../mocks/mockData';
import { User, Tenant, Farm, Field, Zone, Employee, Crop, CropVariety, GrowthProfile, PlantingSeason, Gateway, SensorNode, Sensor, Actuator, TelemetryReading, Alert, ControlSchedule, AutomationRule, AIRecommendation, AIMessage, TaskItem, MaterialInventory, ServiceRequest, AuditLog, ControlExecutionLog, EnvironmentalTargetConfig, CF3StepDetail, CF3StepNumber, ContractDetails, QuotationItem } from '../types';

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
  
  createCrop: async (data: Partial<Crop>): Promise<Crop> => {
    const created: Crop = {
      cropId: `crop-${Date.now()}`,
      name: data.name || 'Cây trồng mới',
      scientificName: data.scientificName || '',
      category: data.category || 'Rau ăn quả',
      growthCycleDays: data.growthCycleDays || 90,
      description: data.description || '',
      isSystemDefined: true,
      createdAt: new Date().toISOString(),
      varietiesCount: 0,
      optimalTemperatureMin: data.optimalTemperatureMin || 20,
      optimalTemperatureMax: data.optimalTemperatureMax || 28,
      optimalSoilMoistureMin: data.optimalSoilMoistureMin || 65,
      optimalSoilMoistureMax: data.optimalSoilMoistureMax || 80,
      optimalpHMin: data.optimalpHMin || 6.0,
      optimalpHMax: data.optimalpHMax || 6.8,
      optimalECMin: data.optimalECMin || 1.8,
      optimalECMax: data.optimalECMax || 2.5,
      optimalLux: data.optimalLux || 25000,
      calendarIrrigationPlan: data.calendarIrrigationPlan || {
        repeatType: 'DAILY',
        lunarSyncEnabled: true,
        sessions: [
          { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
        ]
      },
      growthStages: data.growthStages || []
    };
    mockCrops.unshift(created);
    return created;
  },

  updateCrop: async (cropId: string, data: Partial<Crop>): Promise<Crop | undefined> => {
    const crop = mockCrops.find(c => c.cropId === cropId);
    if (crop) {
      Object.assign(crop, data);
    }
    return crop;
  },

  syncCropScheduleToZone: async (cropId: string, zoneId: string) => {
    const crop = mockCrops.find(c => c.cropId === cropId);
    const zone = mockZones.find(z => z.zoneId === zoneId) || mockZones[0];
    const targetActuator = mockActuators.find(a => a.zoneId === zoneId && a.actuatorType === 'PUMP') || mockActuators[0];

    if (!crop || !crop.calendarIrrigationPlan) {
      return { success: false, createdSchedulesCount: 0, zoneName: zone.name };
    }

    const sessions = crop.calendarIrrigationPlan.sessions.filter(s => s.enabled);
    let createdCount = 0;

    // Remove old schedules for this zone if matching names or clear to re-sync
    sessions.forEach(sess => {
      const scheduleName = `[${crop.name}] ${sess.title}`;
      // Remove any existing schedule with same name
      const existingIdx = mockSchedules.findIndex(s => s.zoneId === zoneId && s.name === scheduleName);
      if (existingIdx !== -1) {
        mockSchedules.splice(existingIdx, 1);
      }

      // Add fresh schedule synced from crop library
      const newSchedule: ControlSchedule = {
        scheduleId: `sched-synced-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        zoneId: zone.zoneId,
        zoneName: zone.name,
        actuatorId: targetActuator.actuatorId,
        actuatorName: targetActuator.name,
        name: scheduleName,
        startTime: sess.startTime,
        endTime: calculateEndTime(sess.startTime, sess.durationMinutes),
        daysOfWeek: sess.daysOfWeek.length > 0 ? sess.daysOfWeek : ['Everyday'],
        actionType: 'TURN_ON',
        durationMinutes: sess.durationMinutes,
        isActive: true,
        seasonName: `Mùa vụ ${crop.name}`,
        growthStageName: `Ca ${sess.session === 'MORNING' ? 'Sáng' : sess.session === 'NOON' ? 'Trưa' : 'Chiều'} (Từ Thư viện Cây)`
      };
      mockSchedules.unshift(newSchedule);
      createdCount++;
    });

    // Also update environmental target configs for this zone to match crop requirements!
    const envConfig = mockEnvironmentalConfigs.find(c => c.zoneId === zoneId);
    if (envConfig) {
      if (crop.optimalSoilMoistureMin && crop.optimalSoilMoistureMax) {
        envConfig.minSoilMoisture = crop.optimalSoilMoistureMin;
        envConfig.maxSoilMoisture = crop.optimalSoilMoistureMax;
        envConfig.targetSoilMoisture = Math.round((crop.optimalSoilMoistureMin + crop.optimalSoilMoistureMax) / 2);
      }
      if (crop.optimalTemperatureMax) {
        envConfig.maxTemperature = crop.optimalTemperatureMax;
      }
      if (crop.optimalLux) {
        envConfig.targetLux = crop.optimalLux;
      }
    }

    // Update zone current crop label
    zone.currentCrop = crop.name;

    return { success: true, createdSchedulesCount: createdCount, zoneName: zone.name };
  }
};

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + durationMinutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

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

  createServiceRequest: async (data: Partial<ServiceRequest>): Promise<ServiceRequest> => {
    const isInst = data.requestType === 'INSTALLATION';
    const newReq: ServiceRequest = {
      serviceRequestId: `sr-${isInst ? 'inst' : 'maint'}-${Date.now().toString().slice(-4)}`,
      tenantId: 'tenant-01',
      farmId: data.farmId || 'farm-01',
      farmName: data.farmName || 'Trang trại Nông nghiệp Đà Lạt',
      zoneId: data.zoneId || 'zone-01',
      zoneName: data.zoneName || 'Nhà màng 01',
      deviceName: data.deviceName || 'Hệ thống Gateway + Cụm Node Cảm biến',
      requestedBy: data.requestedBy || 'Admin (Khởi tạo thay Chủ trang trại)',
      assignedOwnerName: data.assignedOwnerName || 'Lê Văn An',
      assignedTechnician: data.assignedTechnician || 'user-tech',
      assignedTechnicianName: data.assignedTechnicianName || 'Trần Minh Trí (Kỹ thuật viên IoT)',
      title: data.title || (isInst ? 'Lắp đặt & Cấp phát IoT Mới' : 'Bảo trì Phần cứng & Thay thế Node'),
      description: data.description || 'Nhiệm vụ được khởi tạo và điều phối kỹ thuật viên.',
      priority: data.priority || 'HIGH',
      status: data.assignedTechnician ? 'IN_PROGRESS' : 'OPEN',
      requestType: data.requestType || 'INSTALLATION',
      isAcceptedByOwner: false,
      mappedNodesCount: 0,
      createdAt: new Date().toISOString(),
    };
    mockServiceRequests.unshift(newReq);
    return newReq;
  },

  sendContract: async (requestId: string, contract: Partial<ContractDetails>): Promise<ServiceRequest | undefined> => {
    const req = mockServiceRequests.find(r => r.serviceRequestId === requestId);
    if (req) {
      const items = contract.items || [];
      const subtotal = items.reduce((acc: number, item: QuotationItem) => acc + item.unitPrice * item.quantity, 0);
      const vatTotal = items.reduce((acc: number, item: QuotationItem) => acc + (item.unitPrice * item.quantity * (item.vatPercent / 100)), 0);
      const totalAmount = subtotal + vatTotal;
      const deposit30 = Math.round(totalAmount * 0.3);
      const remaining70 = totalAmount - deposit30;

      req.contractDetails = {
        contractId: `HD-2026-${req.serviceRequestId.toUpperCase()}`,
        createdAt: new Date().toISOString(),
        items,
        subtotal,
        vatTotal,
        totalAmount,
        deposit30Percent: deposit30,
        remaining70Percent: remaining70,
        isContractSent: true,
        contractSentAt: new Date().toISOString(),
        isSignedByOwner: false,
        is30PercentPaid: false,
      };
      req.status = 'CONTRACT_SENT';
    }
    return req;
  },

  signContractAndPay30: async (
    requestId: string,
    signatureName: string,
    paymentMethod: 'CASH' | 'BANK_TRANSFER'
  ): Promise<ServiceRequest | undefined> => {
    const req = mockServiceRequests.find(r => r.serviceRequestId === requestId);
    if (req && req.contractDetails) {
      req.contractDetails.isSignedByOwner = true;
      req.contractDetails.signedAtByOwner = new Date().toISOString();
      req.contractDetails.ownerSignatureName = signatureName || req.assignedOwnerName || 'Chủ trang trại';
      req.contractDetails.is30PercentPaid = true;
      req.contractDetails.paid30At = new Date().toISOString();
      req.contractDetails.payment30Method = paymentMethod;
      req.contractDetails.payment30Ref = `PAY30-${Date.now().toString().slice(-6)}`;
      req.status = 'CONTRACT_SIGNED_30PAID';
    }
    return req;
  },

  signAcceptanceAndPay70: async (
    requestId: string,
    signatureName: string,
    paymentMethod: 'CASH' | 'BANK_TRANSFER'
  ): Promise<ServiceRequest | undefined> => {
    const req = mockServiceRequests.find(r => r.serviceRequestId === requestId);
    if (req) {
      req.isAcceptedByOwner = true;
      req.acceptedAtByOwner = new Date().toISOString();
      req.status = 'RESOLVED';
      req.acceptanceDetails = {
        isAcceptanceSigned: true,
        signedAt: new Date().toISOString(),
        ownerSignatureName: signatureName || req.assignedOwnerName || 'Chủ trang trại',
        is70PercentPaid: true,
        paid70At: new Date().toISOString(),
        payment70Method: paymentMethod,
        payment70Ref: `PAY70-${Date.now().toString().slice(-6)}`,
        notes: 'Owner đã ký biên bản nghiệm thu bàn giao và hoàn tất thanh toán 70% còn lại.'
      };
    }
    return req;
  },

  acceptByOwner: async (requestId: string): Promise<ServiceRequest | undefined> => {
    const req = mockServiceRequests.find(r => r.serviceRequestId === requestId);
    if (req) {
      req.isAcceptedByOwner = true;
      req.acceptedAtByOwner = new Date().toISOString();
      req.status = 'ACCEPTED_BY_OWNER';
    }
    return req;
  },

  completeByTechnician: async (requestId: string, resolution?: string): Promise<ServiceRequest | undefined> => {
    const req = mockServiceRequests.find(r => r.serviceRequestId === requestId);
    if (req) {
      req.status = 'RESOLVED';
      req.completedAtByTech = new Date().toISOString();
      req.resolution = resolution || 'Kỹ thuật viên đã hoàn tất chấm node và nghiệm thu thực địa thành công.';
    }
    return req;
  },

  updateMappedNodes: async (requestId: string, count: number): Promise<ServiceRequest | undefined> => {
    const req = mockServiceRequests.find(r => r.serviceRequestId === requestId);
    if (req) {
      req.mappedNodesCount = count;
    }
    return req;
  }
};
