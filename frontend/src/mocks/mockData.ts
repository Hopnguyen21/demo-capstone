// SmartFarm Data Engine - Mock data removed for all API-integrated entities.
// Entities with Backend API endpoints now fetch directly via frontend/src/services.

import {
  Tenant, User, Farm, Field, Zone, Employee, Crop, CropVariety,
  GrowthProfile, PlantingSeason, Gateway, SensorNode, Sensor, Actuator,
  TelemetryReading, Alert, ControlSchedule, AutomationRule,
  WeatherData, AIMessage, AIRecommendation, TaskItem, MaterialInventory,
  ServiceRequest, AuditLog, ControlExecutionLog, EnvironmentalTargetConfig
} from '../types';

// ============================================================================
// 1. ENTITIES WITH BACKEND APIS (MOCK DATA REMOVED - EMPTY ARRAYS)
// ============================================================================

// Replaced by tenantService.getTenants() -> /api/v1/tenants
export const mockTenants: Tenant[] = [];

// Replaced by userService.getUsers() -> /api/v1/users
export const mockUsers: User[] = [];

// Replaced by farmService.getFarms() -> /api/v1/farms
export const mockFarms: Farm[] = [];

// Replaced by fieldService.getFields() -> /api/v1/fields
export const mockFields: Field[] = [];

// Replaced by zoneService.getZones() -> /api/v1/zones
export const mockZones: Zone[] = [];

// Replaced by userService.getFarmers() -> /api/v1/users
export const mockEmployees: Employee[] = [];

// Replaced by cropService.getCrops() -> /api/v1/crops
export const mockCrops: Crop[] = [];

// Replaced by cropService.getVarieties() -> /api/v1/crops/{cropId}/varieties
export const mockVarieties: CropVariety[] = [];

// Replaced by cropService.getGrowthProfiles() -> /api/v1/crops/{cropId}/growth-profiles
export const mockGrowthProfileTomato: GrowthProfile = {
  growthProfileId: 'profile-tomato-std',
  cropId: 'crop-tomato',
  varietyId: 'var-beefsteak',
  name: 'Quy trình Cà chua Beefsteak Chuẩn 90 ngày',
  description: 'Hồ sơ sinh trưởng 5 giai đoạn thích ứng vi khí hậu',
  isDefault: true,
  stages: [],
  requirements: {}
};

// Replaced by seasonService.getSeasons() -> /api/v1/farms/{farmId}/seasons
export const mockPlantingSeasons: PlantingSeason[] = [];

// Replaced by deviceService.getGateways() -> /api/v1/gateways
export const mockGateways: Gateway[] = [];

// Replaced by deviceService.getNodes() -> /api/v1/nodes
export const mockNodes: SensorNode[] = [];

// Replaced by deviceService.getSensors() -> /api/v1/sensors
export const mockSensors: Sensor[] = [];

// Replaced by deviceService.getActuators() -> /api/v1/actuators
export const mockActuators: Actuator[] = [];

// Replaced by telemetryService.getTelemetryHistory() -> /api/v1/telemetry
export const mockTelemetryHistory: TelemetryReading[] = [];

// Replaced by alertService.getAlerts() -> /api/v1/alerts
export const mockAlerts: Alert[] = [];

// Replaced by controlService.getSchedules() -> /api/v1/schedules
export const mockSchedules: ControlSchedule[] = [];

// Replaced by controlService.getAutoRules() -> /api/v1/auto-rules
export const mockAutomationRules: AutomationRule[] = [];

// Replaced by aiService.getRecommendations() -> /api/v1/ai/recommendations
export const mockAIRecommendations: AIRecommendation[] = [];

// Replaced by aiService.chat() -> /api/v1/ai/chat
export const mockAIMessages: AIMessage[] = [];

// Replaced by supportService.getTasks() -> /api/v1/farms/{farmId}/tasks
export const mockTasks: TaskItem[] = [];

// Replaced by supportService.getInventory() -> /api/v1/farms/{farmId}/inventory
export const mockInventory: MaterialInventory[] = [];

// Replaced by supportService.getServiceRequests() -> /api/v1/service-requests
export const mockServiceRequests: ServiceRequest[] = [];

// Replaced by adminService.getAuditLogs() -> /api/v1/audit-logs
export const mockAuditLogs: AuditLog[] = [];

// Replaced by controlService.getTargetConfig() -> /api/v1/environmental-configs
export const mockEnvironmentalConfigs: EnvironmentalTargetConfig[] = [];

// Replaced by controlService.getExecutionLogs() -> /api/v1/control-logs
export const mockControlLogs: ControlExecutionLog[] = [];

// ============================================================================
// 2. UNMODIFIED EXTERNAL MOCKS (NO BACKEND ENDPOINT AVAILABLE)
// ============================================================================

export const mockWeather: WeatherData = {
  farmId: '30000000-0000-0000-0000-000000000001',
  temperature: 24.5,
  humidity: 78,
  rainfallMm: 0,
  windSpeedKmH: 12,
  condition: 'Cloudy',
  rainProbability: 25,
  recordedAt: '2026-09-22T10:00:00Z',
  forecast: [
    { time: '12:00', temp: 26, condition: 'Sunny', rainProb: 10 },
    { time: '15:00', temp: 25, condition: 'Cloudy', rainProb: 40 },
    { time: '18:00', temp: 22, condition: 'Rainy', rainProb: 60 },
    { time: '21:00', temp: 19, condition: 'Rainy', rainProb: 20 },
  ],
};
