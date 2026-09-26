// SmartFarm TypeScript Domain Types & DTOs

export type UserRole = 'PLATFORM_ADMIN' | 'PLATFORM_TECHNICIAN' | 'FARM_OWNER' | 'FARMER';

export interface User {
  userId: string;
  tenantId?: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLoginAt?: string;
  createdAt: string;
}

export interface Tenant {
  tenantId: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  farmsCount?: number;
  usersCount?: number;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [lng, lat]
}

export interface Farm {
  farmId: string;
  tenantId: string;
  name: string;
  description?: string;
  address?: string;
  boundary?: GeoPolygon;
  center?: [number, number]; // [lat, lng]
  areaM2: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  fieldsCount?: number;
  zonesCount?: number;
  devicesCount?: number;
}

export interface Field {
  fieldId: string;
  farmId: string;
  name: string;
  description?: string;
  boundary?: GeoPolygon;
  areaM2: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface Zone {
  zoneId: string;
  fieldId: string;
  farmId: string;
  name: string;
  description?: string;
  boundary?: GeoPolygon;
  areaM2: number;
  status: 'ACTIVE' | 'INACTIVE';
  currentCrop?: string;
  currentStage?: string;
  createdAt: string;
}

export interface Employee {
  employeeId: string;
  tenantId: string;
  userId?: string;
  employeeCode: string;
  fullName: string;
  phone: string;
  email: string;
  position: string;
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: string;
  assignedFarms: string[]; // farmIds
  assignedZones: string[]; // zoneIds
}

export interface Crop {
  cropId: string;
  name: string;
  scientificName?: string;
  description?: string;
  isSystemDefined: boolean;
  createdAt: string;
  varietiesCount?: number;
}

export interface CropVariety {
  varietyId: string;
  cropId: string;
  name: string;
  description?: string;
  isSystemDefined: boolean;
}

export interface GrowthStage {
  growthStageId: string;
  growthProfileId: string;
  name: string;
  stageOrder: number;
  description?: string;
  durationDays: number;
}

export interface EnvironmentalRequirement {
  requirementId: string;
  growthStageId: string;
  parameterCode: 'SOIL_MOISTURE' | 'TEMPERATURE' | 'AIR_HUMIDITY' | 'LIGHT_INTENSITY' | 'PH' | 'EC';
  minValue: number;
  maxValue: number;
  targetValue: number;
  unit: string;
  description?: string;
}

export interface GrowthProfile {
  growthProfileId: string;
  cropId: string;
  varietyId?: string;
  name: string;
  description?: string;
  isDefault: boolean;
  stages: GrowthStage[];
  requirements: Record<string, EnvironmentalRequirement[]>; // keyed by stageId
}

export interface PlantingSeason {
  plantingSeasonId: string;
  zoneId: string;
  zoneName?: string;
  farmId: string;
  cropId: string;
  cropName: string;
  varietyId?: string;
  varietyName?: string;
  growthProfileId: string;
  name: string;
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  currentGrowthStageId: string;
  currentGrowthStageName?: string;
  status: 'PLANNED' | 'ACTIVE' | 'HARVESTED' | 'CANCELLED';
  progressPercent: number;
  schedulesCount?: number;
  assignedFarmerNames?: string[];
  irrigationPlanNote?: string;
}

export interface Gateway {
  gatewayId: string;
  farmId: string;
  farmName?: string;
  name: string;
  deviceCode: string;
  serialNumber: string;
  macAddress: string;
  latitude: number;
  longitude: number;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  firmwareVersion: string;
  lastSeenAt: string;
  installedAt: string;
  rssi?: number;
  connectedNodesCount?: number;
}

export interface SensorNode {
  nodeId: string;
  gatewayId?: string;
  farmId: string;
  fieldId?: string;
  zoneId?: string;
  zoneName?: string;
  name: string;
  nodeCode: string;
  serialNumber: string;
  latitude: number;
  longitude: number;
  status: 'ONLINE' | 'OFFLINE' | 'WARNING' | 'CRITICAL';
  firmwareVersion: string;
  batteryLevel: number; // 0-100%
  rssi: number;
  lastSeenAt: string;
  sensorsCount: number;
  actuatorsCount: number;
}

export interface Sensor {
  sensorId: string;
  nodeId: string;
  nodeName?: string;
  parameterCode: 'SOIL_MOISTURE' | 'TEMPERATURE' | 'AIR_HUMIDITY' | 'LIGHT_INTENSITY' | 'PH' | 'EC';
  name: string;
  sensorCode: string;
  unit: string;
  status: 'ACTIVE' | 'FAULTY' | 'OFFLINE';
  lastReading?: number;
  lastReadingAt?: string;
}

export interface Actuator {
  actuatorId: string;
  nodeId?: string;
  farmId: string;
  zoneId?: string;
  zoneName?: string;
  name: string;
  actuatorCode: string;
  actuatorType: 'PUMP' | 'VALVE' | 'FAN' | 'GROW_LIGHT';
  status: 'OFF' | 'ON' | 'ERROR' | 'MAINTENANCE';
  lastStateChangeAt?: string;
}

export interface TelemetryReading {
  readingId: string;
  zoneId: string;
  sensorId: string;
  parameterCode: string;
  recordedAt: string;
  value: number;
  unit: string;
  qualityStatus: 'VALID' | 'ANOMALY';
}

export interface AlertRule {
  alertRuleId: string;
  zoneId: string;
  growthStageId?: string;
  parameterCode: string;
  ruleName: string;
  minThreshold?: number;
  maxThreshold?: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  isActive: boolean;
}

export interface Alert {
  alertId: string;
  zoneId: string;
  zoneName?: string;
  sensorId?: string;
  sensorName?: string;
  alertRuleId?: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  triggeredValue: number;
  targetRange?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  triggeredAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface ControlSchedule {
  scheduleId: string;
  zoneId: string;
  zoneName?: string;
  actuatorId: string;
  actuatorName?: string;
  name: string;
  startTime: string; // HH:mm
  endTime?: string;  // HH:mm
  daysOfWeek: string[]; // ['MON', 'WED', 'FRI']
  actionType: 'TURN_ON' | 'TURN_OFF';
  durationMinutes?: number;
  isActive: boolean;
  plantingSeasonId?: string;
  seasonName?: string;
  growthStageName?: string;
}

export interface AutomationRule {
  ruleId: string;
  zoneId: string;
  zoneName?: string;
  name: string;
  parameterCode: string;
  operator: '<' | '>' | '<=' | '>=';
  thresholdValue: number;
  actuatorId: string;
  actuatorName?: string;
  actionType: 'TURN_ON' | 'TURN_OFF';
  actionDurationMinutes?: number;
  isActive: boolean;
}

export interface WeatherData {
  farmId: string;
  temperature: number;
  humidity: number;
  rainfallMm: number;
  windSpeedKmH: number;
  condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Thunderstorm';
  rainProbability: number;
  recordedAt: string;
  forecast: {
    time: string;
    temp: number;
    condition: string;
    rainProb: number;
  }[];
}

export interface AIMessage {
  messageId: string;
  conversationId: string;
  senderType: 'USER' | 'AI';
  messageText: string;
  createdAt: string;
  recommendation?: AIRecommendation;
}

export interface AIRecommendation {
  recommendationId: string;
  farmId: string;
  zoneId: string;
  zoneName: string;
  cropName: string;
  recommendationType: 'IRRIGATION' | 'ENVIRONMENTAL' | 'PEST' | 'FERTILIZATION';
  title: string;
  recommendationText: string;
  reasoning: string;
  expectedImpact: string;
  confidenceScore: number; // 0-100%
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface TaskItem {
  taskId: string;
  farmId: string;
  zoneId?: string;
  zoneName?: string;
  title: string;
  description: string;
  taskType: 'IRRIGATION' | 'FERTILIZATION' | 'PEST_CONTROL' | 'MAINTENANCE' | 'HARVEST';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedToUser?: string;
  assignedToName?: string;
  dueDate: string;
  completedAt?: string;
  resultNotes?: string;
}

export interface MaterialInventory {
  inventoryId: string;
  farmId: string;
  materialName: string;
  code: string;
  category: 'SEED' | 'FERTILIZER' | 'PESTICIDE' | 'GROWING_MEDIA' | 'EQUIPMENT';
  quantity: number;
  unit: string;
  minimumStock: number;
  storageLocation: string;
  updatedAt: string;
}

export interface ServiceRequest {
  serviceRequestId: string;
  tenantId: string;
  farmId: string;
  farmName: string;
  gatewayId?: string;
  nodeId?: string;
  deviceName: string;
  requestedBy: string;
  assignedTechnician?: string;
  assignedTechnicianName?: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  requestType: 'MAINTENANCE' | 'REPAIR' | 'REPLACEMENT' | 'INITIAL_SETUP';
  createdAt: string;
  resolution?: string;
}

export interface AuditLog {
  auditLogId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityName: string;
  entityId: string;
  ipAddress: string;
  createdAt: string;
  details?: string;
}

// CF3 - Environmental Control & Actuation Domain Types
export type CF3StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface CF3StepDetail {
  stepNumber: CF3StepNumber;
  title: string;
  subtitle: string;
  description: string;
  status: 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  detailPayload?: string;
  timestamp?: string;
}

export interface ControlExecutionLog {
  logId: string;
  actuatorId: string;
  actuatorName: string;
  actuatorType: 'PUMP' | 'VALVE' | 'FAN' | 'GROW_LIGHT';
  zoneId: string;
  zoneName: string;
  action: 'TURN_ON' | 'TURN_OFF';
  durationMinutes?: number;
  triggerSource: 'MANUAL' | 'SCHEDULE' | 'AUTO_RULE' | 'AI_APPROVED';
  gatewayCode: string;
  nodeCode: string;
  rssi?: number;
  executionStatus: 'SUCCESS' | 'FAILED' | 'EMERGENCY_STOP' | 'INTERLOCK_BLOCKED';
  executedAt: string;
  completedAt?: string;
  failureReason?: string;
  parametersSnapshot?: {
    soilMoisture?: number;
    temperature?: number;
    humidity?: number;
    lightIntensity?: number;
  };
}

export interface EnvironmentalTargetConfig {
  zoneId: string;
  zoneName: string;
  targetSoilMoisture: number; // %
  minSoilMoisture: number;
  maxSoilMoisture: number;
  maxTemperature: number; // °C
  targetHumidity: number; // %
  targetLux: number; // lux
  powerWatts?: number; // Device power rating e.g. 750W
}

export interface SafetyCheckResult {
  passed: boolean;
  interlockBlocked: boolean;
  rainDelayActive: boolean;
  failsafeTimerMinutes: number;
  warnings: string[];
}

