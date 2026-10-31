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
  locationText?: string;
  latitude?: number;
  longitude?: number;
  boundary?: GeoPolygon;
  boundaryGeoJson?: any;
  center?: [number, number]; // [lat, lng]
  areaM2: number;
  totalAreaM2?: number;
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
  latitude?: number;
  longitude?: number;
  boundary?: GeoPolygon;
  boundaryGeoJson?: any;
  areaM2: number;
  availableAreaM2?: number;
  soilType?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface Zone {
  zoneId: string;
  fieldId: string;
  farmId: string;
  farmName?: string;
  name: string;
  description?: string;
  zoneType?: string;
  notes?: string;
  boundary?: GeoPolygon;
  boundaryGeoJson?: any;
  areaM2: number;
  status: 'ACTIVE' | 'INACTIVE';
  currentCrop?: string | null;
  currentStage?: string | null;
  cropId?: string | null;
  varietyId?: string | null;
  cropName?: string | null;
  varietyName?: string | null;
  /** None | InProgress | Mismatch | PlannedOnly */
  seasonStatus?: 'None' | 'InProgress' | 'Mismatch' | 'PlannedOnly';
  seasonName?: string | null;
  seasonCropName?: string | null;
  plannedCrop?: string | null;
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
  /** Quyền Zone của nhân công: xem/được giao việc và (riêng biệt) được điều khiển thiết bị. */
  zoneAccess?: { zoneId: string; canControl: boolean }[];
}

export type FarmInvitationStatus = 'Pending' | 'Accepted' | 'Declined' | 'Cancelled' | 'Expired';

export interface FarmInvitation {
  id: string;
  farmId: string;
  farmName: string;
  email: string;
  status: FarmInvitationStatus;
  createdAtUtc: string;
  expiresAtUtc: string;
  respondedAtUtc?: string | null;
  sendCount: number;
  lastSentAtUtc?: string | null;
}

export type TaskAssignmentStatus =
  | 'Pending' | 'Accepted' | 'InProgress' | 'CompletedPendingReview' | 'Approved' | 'Failed' | 'Overdue' | 'Cancelled' | 'Declined';

export interface FarmTaskAssignment {
  id: string;
  farmerId: string;
  farmerName: string;
  status: TaskAssignmentStatus;
  progressPercent: number;
  progressNote?: string | null;
  result?: string | null;
  failureReason?: string | null;
  assignmentVersion: number;
  assignedAtUtc: string;
  acceptedAtUtc?: string | null;
  startedAtUtc?: string | null;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
}

export interface FarmTaskDetail {
  id: string;
  farmId: string;
  zoneId: string;
  title: string;
  description?: string | null;
  requirements?: string | null;
  dueAtUtc: string;
  status: TaskAssignmentStatus;
  createdAtUtc: string;
  assignments: FarmTaskAssignment[];
  history: { id: string; eventType: string; fromStatus?: string | null; toStatus: string; actorUserId: string; subjectFarmerId?: string | null; notes?: string | null; createdAtUtc: string }[];
}

export interface IrrigationSession {
  session: 'MORNING' | 'NOON' | 'AFTERNOON'; // Tưới Sáng, Trưa, Chiều
  title: string;          // ví dụ: "Tưới Sáng Khởi Động", "Tưới Trưa Giảm Nhiệt", "Tưới Chiều Bổ Sung"
  startTime: string;      // "07:30", "12:00", "16:30"
  durationMinutes: number;// số phút tưới
  volumeMl?: number;      // ml/lần/gốc
  enabled: boolean;
  daysOfWeek: string[];   // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] hoặc ['Everyday']
}

export interface CalendarIrrigationPlan {
  repeatType: 'DAILY' | 'INTERVAL_DAYS' | 'CUSTOM_DAYS';
  intervalDays?: number;
  sessions: IrrigationSession[];
  lunarSyncEnabled?: boolean;
  notes?: string;
}

export interface GrowthStageTemplate {
  stageName: string;
  durationDays: number;
  targetSoilMoisture: number;
  targetTemperature: number;
  targetpH?: number;
  targetEC?: number;
  targetLux?: number;
}

export interface Crop {
  cropId: string;
  name: string;
  scientificName?: string;
  description?: string;
  category?: string;           // Rau ăn quả, Rau ăn lá, Cây ăn trái, Cây củ...
  growthCycleDays?: number;    // Tổng chu kỳ (ví dụ 90 ngày)
  isSystemDefined: boolean;
  createdAt: string;
  varietiesCount?: number;

  // Vi khí hậu tối ưu
  optimalTemperatureMin?: number; // °C
  optimalTemperatureMax?: number; // °C
  optimalSoilMoistureMin?: number;// %
  optimalSoilMoistureMax?: number;// %
  optimalpHMin?: number;          // pH
  optimalpHMax?: number;          // pH
  optimalECMin?: number;           // mS/cm
  optimalECMax?: number;           // mS/cm
  optimalLux?: number;             // Lux

  // Lịch tưới theo định dạng cuốn lịch (Sáng - Trưa - Chiều)
  calendarIrrigationPlan?: CalendarIrrigationPlan;

  // Giai đoạn sinh trưởng mẫu
  growthStages?: GrowthStageTemplate[];
}

export interface CropVariety {
  varietyId: string;
  cropId: string;
  name: string;
  description?: string;
  isSystemDefined: boolean;
}

export type PlantVariety = CropVariety;


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

export interface FarmingSeason {
  id: string;
  code: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  description?: string;
  status: 'Active' | 'Upcoming' | 'Completed' | string;
  isActive: boolean;
  linkedBatchesCount?: number;
}

export interface PlantingSeason {
  plantingSeasonId: string;
  seasonId?: string;
  zoneId: string;
  zoneName?: string;
  farmId: string;
  farmName?: string;
  cropId: string;
  cropName: string;
  varietyId?: string;
  varietyName?: string;
  farmingSeasonId?: string;
  farmingSeasonName?: string;
  growthProfileId: string;
  name: string;
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  currentGrowthStageId: string;
  currentGrowthStageName?: string;
  status: 'PLANNED' | 'ACTIVE' | 'HARVESTED' | 'CANCELLED' | string;
  progressPercent?: number;
  schedulesCount?: number;
  assignedFarmerNames?: string[];
  irrigationPlanNote?: string;
  actualYieldKg?: number;
  closeNotes?: string;
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
  farmId?: string;
  zoneId?: string;
  zoneName?: string;
  name: string;
  actuatorCode: string;
  actuatorType: 'PUMP' | 'VALVE' | 'FAN' | 'GROW_LIGHT';
  status: 'OFF' | 'ON' | 'ERROR' | 'MAINTENANCE';
  lastStateChangeAt?: string;
  relayChannel?: number;
  ratedPowerWatt?: number;
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
  condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Thunderstorm' | string;
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
  farmId?: string;
  zoneId?: string;
  zoneName?: string;
  cropName?: string;
  recommendationType?: 'IRRIGATION' | 'ENVIRONMENTAL' | 'PEST' | 'FERTILIZATION' | string;
  title: string;
  recommendationText: string;
  reasoning: string;
  expectedImpact?: string;
  confidenceScore: number; // 0-100%
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'READY' | string;
  createdAt?: string;
  proposedAction?: string;
  proposedDurationSeconds?: number;
  validUntilUtc?: string;
  sources?: string[];
  commandStatus?: string;
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

export interface QuotationItem {
  id: string;
  code: string;          // Mã hàng / SKU (VD: GW-ESP32-DL01, BAT003BD)
  name: string;          // Tên hàng / Mô tả chi tiết
  imageUrl?: string;     // Ảnh đại diện sản phẩm (như hình 2)
  unit: string;          // ĐVT (Bộ, Cái, Trạm)
  unitPrice: number;     // Đơn giá (VNĐ)
  vatPercent: number;    // Thuế VAT % (8% hoặc 10%)
  quantity: number;      // Số lượng
  totalAmount: number;   // Thành tiền (VNĐ) = SL * Đơn giá * (1 + VAT/100)
  notes?: string;        // Ghi chú (VD: Bảo hành 24t, Giảm 5%)
  isSelected?: boolean;
}

export interface ContractDetails {
  contractId: string;           // VD: HD-2026-0101
  createdAt: string;
  items: QuotationItem[];
  subtotal: number;             // Tổng chưa thuế
  vatTotal: number;             // Tổng VAT (8%)
  totalAmount: number;          // Tổng hợp đồng (VNĐ)
  deposit30Percent: number;     // Tiền cọc 30% khi ký Hợp đồng (VNĐ)
  remaining70Percent: number;   // Tiền 70% còn lại khi Nghiệm thu (VNĐ)
  
  // Trạng thái gửi & ký Hợp đồng
  isContractSent: boolean;
  contractSentAt?: string;
  isSignedByOwner: boolean;
  signedAtByOwner?: string;
  ownerSignatureName?: string;
  
  // Thanh toán cọc 30%
  is30PercentPaid: boolean;
  paid30At?: string;
  payment30Method?: 'CASH' | 'BANK_TRANSFER'; // Tiền mặt hoặc Chuyển khoản
  payment30Ref?: string;
  notes?: string;
  contractTerms?: string;
}

export interface AcceptanceDetails {
  isAcceptanceSigned: boolean;
  signedAt?: string;
  ownerSignatureName?: string;
  is70PercentPaid: boolean;
  paid70At?: string;
  payment70Method?: 'CASH' | 'BANK_TRANSFER'; // Tiền mặt hoặc Chuyển khoản
  payment70Ref?: string;
  notes?: string;
}

export interface ServiceRequest {
  serviceRequestId: string;
  tenantId: string;
  farmId: string;
  farmName: string;
  zoneId?: string;
  zoneName?: string;
  gatewayId?: string;
  nodeId?: string;
  deviceName: string;
  requestedBy: string;
  assignedOwnerName?: string;
  assignedTechnician?: string;
  assignedTechnicianName?: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'CONTRACT_SENT' | 'CONTRACT_SIGNED_30PAID' | 'ACCEPTED_BY_OWNER' | 'RESOLVED' | 'CLOSED';
  requestType: 'INSTALLATION' | 'MAINTENANCE' | 'REPAIR' | 'REPLACEMENT' | 'INITIAL_SETUP';
  isAcceptedByOwner?: boolean;
  acceptedAtByOwner?: string;
  completedAtByTech?: string;
  mappedNodesCount?: number;
  createdAt: string;
  resolution?: string;

  // Trạng thái ký HĐ & thanh toán
  isContractSigned?: boolean;
  isDepositPaid?: boolean;
  isFullyPaid?: boolean;

  // Thông tin Hợp đồng & Nghiệm thu
  contractDetails?: ContractDetails;
  acceptanceDetails?: AcceptanceDetails;
}

export type ZoneContractStatusType = 'Active' | 'ExpiringSoon' | 'Expired' | 'Terminated' | 'Renewed';

export interface ZoneContractRenewal {
  id: string;
  contractId: string;
  createdByOwnerId?: string;
  newEndDate: string;
  newMonthlyRentVnd?: number;
  renewalValueVnd: number;
  extendedMonths?: number;
  renewalDate?: string;
  discountPercent?: number;
  newContractValueVnd?: number;
  notes?: string;
  createdAtUtc: string;
}

export interface ZoneContract {
  id: string;
  tenantId: string;
  farmId: string;
  farmName?: string;
  zoneId: string;
  zoneName?: string;
  createdByOwnerId?: string;
  parentContractId?: string;
  parentContractNumber?: string;
  contractNumber: string;
  title?: string;
  cropType?: string;
  monthlyRentVnd: number;
  depositVnd: number;
  totalContractValueVnd: number;
  subtotalVnd?: number;
  discountPercent?: number;
  discountVnd?: number;
  vatRatePercent?: number;
  vatPercent?: number;
  equipment?: { code: string; name: string; category: string; unit: string; quantity: number; unitPrice: number }[];
  vatAmountVnd?: number;
  durationMonths?: number;
  hardwareIncluded?: string;
  startDate: string;
  endDate: string;
  status: ZoneContractStatusType | number;
  statusText?: string;
  daysRemaining: number;
  lesseeName: string;
  lesseePhone?: string;
  lesseeIdentityNumber?: string;
  lesseeAddress?: string;
  specialTerms?: string;
  notes?: string;
  signedAtUtc?: string;
  renewals?: ZoneContractRenewal[];
  createdAtUtc?: string;
}

export interface DeviceDepreciation {
  id: string;
  zoneId: string;
  zoneName?: string;
  deviceId: string;
  deviceName?: string;
  deviceCode?: string;
  serialNumber?: string;
  hardwareAddress?: string;
  deviceType?: string;
  originalCostVnd: number;
  monthlyDepreciationVnd: number;
  accumulatedDepreciationVnd: number;
  currentBookValueVnd: number;
  depreciationLifetimeMonths: number;
  monthsElapsed: number;
  remainingMonths: number;
  remainingLifespanMonths?: number;
  warrantyMonths?: number;
  installationDate?: string;
  method: string;
  startDate: string;
  depreciationStatus: 'Active' | 'ExpiringSoon' | 'FullyDepreciated';
  status?: 'Active' | 'ExpiringSoon' | 'FullyDepreciated';
  isNearContractRenewal?: boolean;
  notes?: string;
  createdAtUtc?: string;
}

export interface ExpiringContractAlert {
  contractId: string;
  contractNumber: string;
  farmId: string;
  farmName: string;
  zoneId: string;
  zoneName: string;
  cropType?: string;
  endDate: string;
  daysRemaining: number;
  status: ZoneContractStatusType;
  totalContractValueVnd: number;
}

export interface AuditLog {
  auditLogId?: string;
  id?: string;
  userId?: string;
  actorUserId?: string;
  userName?: string;
  actorName?: string;
  userRole?: UserRole | string;
  actorRole?: string;
  action: string;
  entityName?: string;
  entityId?: string;
  ipAddress?: string;
  createdAt?: string;
  createdAtUtc?: string;
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

export interface AgricultureDocumentSummary {
  id: string;
  title: string;
  fileName?: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'seed' | string;
  authorOrganization?: string;
  category: 'irrigation' | 'pest' | 'nutrition' | 'climate' | 'record' | 'general' | string;
  cropScope: string;
  version?: string;
  isPublic: boolean;
  tenantId?: string;
  chunkCount: number;
  createdAtUtc: string;
  reviewStatus: 'PendingReview' | 'Approved' | 'NeedsCorrection' | 'Superseded' | string;
  topics?: string;
  detectedTopics?: string;
  reviewNotes?: string;
  reviewedAtUtc?: string;
  hasOriginalFile: boolean;
  documentType: 'OfficialStandard' | 'TechnicalGuide' | 'Thematic' | string;
}

export interface AgricultureChunk {
  id: string;
  chunkIndex: number;
  content: string;
  cropTags: string;
  keywords: string;
  hasEmbedding: boolean;
}

/** Trường VietGAP do AI trích; value chỉ có khi evidence là câu trích nguyên văn có trong toàn văn. */
export interface VietGapExtractedField {
  key: string;
  label: string;
  value: string | null;
  evidence: string | null;
  page: number | null;
}

export interface VietGapExtractedStage {
  stageOrder: number;
  name: string;
  durationDays: number | null;
  temperatureRange: string | null;
  moistureRange: string | null;
  ph: string | null;
  ec: string | null;
  fertilizerAction: string | null;
  ipmAction: string | null;
  evidence: string;
  page: number | null;
}

export interface VietGapStructuredExtraction {
  fields: VietGapExtractedField[];
  stages: VietGapExtractedStage[];
  extractedBy: string;
  extractedAtUtc: string;
  /** Phiên bản quy tắc kiểm chứng; thấp hơn EXTRACTION_RULES_VERSION là kết quả cũ. */
  rulesVersion?: number;
  /** Trường AI đề xuất nhưng bị loại vì không khớp nguyên văn tài liệu. */
  rejectedFields?: string[];
  proposedCount?: number;
}

export interface AgricultureDocumentDetail extends AgricultureDocumentSummary {
  contentText: string;
  chunks: AgricultureChunk[];
  /** null = chưa trích hoặc toàn văn đã sửa sau lần trích gần nhất. */
  extraction?: VietGapStructuredExtraction | null;
}

export interface KnowledgePassage {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  authorOrganization?: string;
  category: string;
  content: string;
  similarityScore: number;
}

export interface AiSource {
  documentId: string;
  title: string;
  organization?: string;
  authorOrganization?: string;
  category: string;
  similarity?: number;
  similarityScore?: number;
  pageNumber?: number;
  sectionTitle?: string;
  contentSnippet?: string;
  content?: string;
}

export interface AiRecommendationView {
  recommendationId: string;
  consultationRequestId: string;
  zoneId: string;
  question: string;
  summary: string;
  details: string;
  limitations: string[];
  confidence: number;
  status: string;
  isActionable: boolean;
  validUntilUtc: string;
  proposedActuatorId?: string;
  proposedAction?: 'TurnOn' | 'TurnOff' | string;
  proposedDurationSeconds?: number;
  createdAtUtc: string;
  sources?: AiSource[];
  contextSnapshotJson?: string;
}


