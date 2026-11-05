// SmartFarm Centralized Mock Data Engine

import {
  Tenant, User, Farm, Field, Zone, Employee, Crop, CropVariety,
  GrowthProfile, PlantingSeason, Gateway, SensorNode, Sensor, Actuator,
  TelemetryReading, AlertRule, Alert, ControlSchedule, AutomationRule,
  WeatherData, AIMessage, AIRecommendation, TaskItem, MaterialInventory,
  ServiceRequest, AuditLog
} from '../types';

export const mockTenants: Tenant[] = [
  {
    tenantId: 'tenant-01',
    name: 'Tập đoàn Nông nghiệp Xanh Valley',
    code: 'GREEN_VALLEY',
    email: 'contact@greenvalley.vn',
    phone: '0908 123 456',
    address: 'Đường Tuyền Lâm, Phường 3, TP. Đà Lạt, Lâm Đồng',
    status: 'ACTIVE',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    farmsCount: 2,
    usersCount: 5,
  },
  {
    tenantId: 'tenant-02',
    name: 'Hợp tác xã Nông nghiệp Công nghệ cao EcoFarm',
    code: 'ECO_FARM',
    email: 'info@ecofarm.vn',
    phone: '0912 987 654',
    address: 'Xã Tu Tra, Huyện Đơn Dương, Lâm Đồng',
    status: 'ACTIVE',
    createdAt: '2026-03-20T09:30:00Z',
    updatedAt: '2026-08-15T14:20:00Z',
    farmsCount: 1,
    usersCount: 3,
  }
];

export const mockUsers: User[] = [
  {
    userId: 'user-admin',
    username: 'admin',
    email: 'admin@smartfarm.vn',
    fullName: 'Quản trị viên Hệ thống (Platform Admin)',
    phone: '0900 000 001',
    role: 'PLATFORM_ADMIN',
    status: 'ACTIVE',
    lastLoginAt: '2026-09-22T20:15:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    userId: 'user-tech',
    username: 'technician',
    email: 'technician@smartfarm.vn',
    fullName: 'Trần Minh Trí (Kỹ thuật viên IoT)',
    phone: '0909 888 777',
    role: 'PLATFORM_TECHNICIAN',
    status: 'ACTIVE',
    lastLoginAt: '2026-09-22T19:30:00Z',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    userId: 'user-owner',
    tenantId: 'tenant-01',
    username: 'farmowner',
    email: 'owner@smartfarm.vn',
    fullName: 'Lê Văn An (Chủ trang trại Dalat Farm)',
    phone: '0908 123 456',
    role: 'FARM_OWNER',
    status: 'ACTIVE',
    lastLoginAt: '2026-09-22T21:00:00Z',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    userId: 'user-farmer',
    tenantId: 'tenant-01',
    username: 'farmer',
    email: 'farmer@smartfarm.vn',
    fullName: 'Trần Văn Bình (Công nhân thực địa)',
    phone: '0903 555 444',
    role: 'FARMER',
    status: 'ACTIVE',
    lastLoginAt: '2026-09-22T18:45:00Z',
    createdAt: '2026-02-01T08:00:00Z',
  }
];

export const mockFarms: Farm[] = [
  {
    farmId: 'farm-01',
    tenantId: 'tenant-01',
    name: 'Trang trại Nông nghiệp Thông minh Đà Lạt',
    description: 'Khu phức hợp nhà màng trồng Cà chua và Ớt chuông công nghệ cao',
    address: 'Phường 11, TP. Đà Lạt, Lâm Đồng',
    areaM2: 50000,
    status: 'ACTIVE',
    createdAt: '2026-01-20T08:00:00Z',
    fieldsCount: 2,
    zonesCount: 4,
    devicesCount: 8,
    center: [11.9404, 108.4583],
    boundary: {
      type: 'Polygon',
      coordinates: [[
        [108.456, 11.942],
        [108.460, 11.942],
        [108.460, 11.938],
        [108.456, 11.938],
        [108.456, 11.942]
      ]]
    }
  },
  {
    farmId: 'farm-02',
    tenantId: 'tenant-01',
    name: 'Nông trang Rau Thủy canh Đức Trọng',
    description: 'Chuyên canh Xà lách Thủy canh và Dưa leo',
    address: 'Thị trấn Liên Nghĩa, Huyện Đức Trọng, Lâm Đồng',
    areaM2: 32000,
    status: 'ACTIVE',
    createdAt: '2026-04-10T08:00:00Z',
    fieldsCount: 1,
    zonesCount: 2,
    devicesCount: 4,
    center: [11.7450, 108.3750],
  }
];

export const mockFields: Field[] = [
  {
    fieldId: 'field-01',
    farmId: 'farm-01',
    name: 'Lô A - Phân khu Cà chua',
    description: 'Lô đất 2.5 ha trang bị hệ thống phun sương tự động',
    areaM2: 25000,
    status: 'ACTIVE',
    createdAt: '2026-01-22T08:00:00Z',
  },
  {
    fieldId: 'field-02',
    farmId: 'farm-01',
    name: 'Lô B - Phân khu Ớt & Dưa',
    description: 'Lô đất 2.5 ha có mái che thông minh',
    areaM2: 25000,
    status: 'ACTIVE',
    createdAt: '2026-01-22T08:00:00Z',
  }
];

export const mockZones: Zone[] = [
  {
    zoneId: 'zone-01',
    fieldId: 'field-01',
    farmId: 'farm-01',
    name: 'Nhà màng 01 - Cà chua Beefsteak A',
    description: 'Trồng cà chua Beefsteak giai đoạn Ra hoa',
    areaM2: 5000,
    status: 'ACTIVE',
    currentCrop: 'Cà chua (Tomato)',
    currentStage: 'Ra hoa (Flowering)',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    zoneId: 'zone-02',
    fieldId: 'field-01',
    farmId: 'farm-01',
    name: 'Nhà màng 02 - Cà chua Cherry B',
    description: 'Trồng cà chua Cherry giai đoạn Nuôi trái',
    areaM2: 5000,
    status: 'ACTIVE',
    currentCrop: 'Cà chua Cherry',
    currentStage: 'Nuôi trái (Fruit Development)',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    zoneId: 'zone-03',
    fieldId: 'field-02',
    farmId: 'farm-01',
    name: 'Nhà màng 03 - Ớt ngọt C',
    description: 'Trồng ớt ngọt Hà Lan giai đoạn Sinh trưởng',
    areaM2: 6000,
    status: 'ACTIVE',
    currentCrop: 'Ớt ngọt (Chili)',
    currentStage: 'Sinh trưởng (Vegetative)',
    createdAt: '2026-02-15T08:00:00Z',
  },
  {
    zoneId: 'zone-04',
    fieldId: 'field-02',
    farmId: 'farm-01',
    name: 'Nhà màng 04 - Dưa leo Baby D',
    description: 'Trồng dưa leo baby giai đoạn Cây non',
    areaM2: 4000,
    status: 'ACTIVE',
    currentCrop: 'Dưa leo (Cucumber)',
    currentStage: 'Cây non (Seedling)',
    createdAt: '2026-03-01T08:00:00Z',
  }
];

export const mockEmployees: Employee[] = [
  {
    employeeId: 'emp-01',
    tenantId: 'tenant-01',
    userId: 'user-farmer',
    employeeCode: 'EMP-001',
    fullName: 'Trần Văn Bình',
    phone: '0903 555 444',
    email: 'farmer@smartfarm.vn',
    position: 'Kỹ thuật viên Nông nghiệp',
    status: 'ACTIVE',
    joinedAt: '2026-02-01',
    assignedFarms: ['farm-01'],
    assignedZones: ['zone-01', 'zone-02'],
  },
  {
    employeeId: 'emp-02',
    tenantId: 'tenant-01',
    employeeCode: 'EMP-002',
    fullName: 'Nguyễn Văn Cường',
    phone: '0903 666 555',
    email: 'cuong.nguyen@smartfarm.vn',
    position: 'Công nhân tưới tiêu',
    status: 'ACTIVE',
    joinedAt: '2026-03-15',
    assignedFarms: ['farm-01'],
    assignedZones: ['zone-03', 'zone-04'],
  }
];

export const mockCrops: Crop[] = [
  {
    cropId: 'crop-tomato',
    name: 'Cà chua (Tomato)',
    scientificName: 'Solanum lycopersicum',
    description: 'Cây cà chua trồng trong nhà màng đạt chuẩn VietGAP/GlobalGAP',
    isSystemDefined: true,
    createdAt: '2026-01-01T00:00:00Z',
    varietiesCount: 2,
  },
  {
    cropId: 'crop-chili',
    name: 'Ớt ngọt (Chili / Bell Pepper)',
    scientificName: 'Capsicum annuum',
    description: 'Ớt ngọt trồng giá thể có nhu cầu dinh dưỡng và độ ẩm cao',
    isSystemDefined: true,
    createdAt: '2026-01-01T00:00:00Z',
    varietiesCount: 1,
  },
  {
    cropId: 'crop-cucumber',
    name: 'Dưa leo (Cucumber)',
    scientificName: 'Cucumis sativus',
    description: 'Dưa leo canh tác nhà màng khép kín',
    isSystemDefined: true,
    createdAt: '2026-01-01T00:00:00Z',
    varietiesCount: 1,
  }
];

export const mockVarieties: CropVariety[] = [
  { varietyId: 'var-beefsteak', cropId: 'crop-tomato', name: 'Beefsteak Đà Lạt', description: 'Trái to, mọng nước, năng suất cao', isSystemDefined: true },
  { varietyId: 'var-cherry', cropId: 'crop-tomato', name: 'Cherry Đỏ F1', description: 'Trái nhỏ, vị ngọt đậm, dễ thu hoạch', isSystemDefined: true },
  { varietyId: 'var-sweetpepper', cropId: 'crop-chili', name: 'Ớt ngọt Hà Lan Red', description: 'Vỏ dày, chịu nhiệt tốt', isSystemDefined: true },
];

export const mockGrowthProfileTomato: GrowthProfile = {
  growthProfileId: 'profile-tomato-std',
  cropId: 'crop-tomato',
  varietyId: 'var-beefsteak',
  name: 'Quy trình Cà chua Beefsteak Chuẩn 90 ngày',
  description: 'Hồ sơ sinh trưởng 5 giai đoạn thích ứng vi khí hậu',
  isDefault: true,
  stages: [
    { growthStageId: 'stage-1', growthProfileId: 'profile-tomato-std', name: 'Cây non (Seedling)', stageOrder: 1, durationDays: 14, description: 'Yêu cầu độ ẩm đất cao và ánh sáng vừa phải' },
    { growthStageId: 'stage-2', growthProfileId: 'profile-tomato-std', name: 'Sinh trưởng (Vegetative)', stageOrder: 2, durationDays: 25, description: 'Cần dinh dưỡng NPK cân bằng và độ ẩm 65-75%' },
    { growthStageId: 'stage-3', growthProfileId: 'profile-tomato-std', name: 'Ra hoa (Flowering)', stageOrder: 3, durationDays: 15, description: 'Giai đoạn nhạy cảm nhiệt độ (tối ưu 22-26°C), duy trì ẩm đất 70%' },
    { growthStageId: 'stage-4', growthProfileId: 'profile-tomato-std', name: 'Nuôi trái (Fruit Dev)', stageOrder: 4, durationDays: 26, description: 'Nhu cầu nước lớn nhất, ánh sáng mạnh 700-900 lux' },
    { growthStageId: 'stage-5', growthProfileId: 'profile-tomato-std', name: 'Thu hoạch (Harvest)', stageOrder: 5, durationDays: 10, description: 'Giảm lượng nước tưới nhẹ để tăng độ đường brix' },
  ],
  requirements: {
    'stage-3': [
      { requirementId: 'req-1', growthStageId: 'stage-3', parameterCode: 'SOIL_MOISTURE', minValue: 60, maxValue: 80, targetValue: 70, unit: '%', description: 'Độ ẩm đất tối ưu cho thụ phấn ra hoa' },
      { requirementId: 'req-2', growthStageId: 'stage-3', parameterCode: 'TEMPERATURE', minValue: 18, maxValue: 28, targetValue: 24, unit: '°C', description: 'Nhiệt độ không khí duy trì độ nảy mầm hạt phấn' },
      { requirementId: 'req-3', growthStageId: 'stage-3', parameterCode: 'AIR_HUMIDITY', minValue: 60, maxValue: 80, targetValue: 70, unit: '%', description: 'Tránh nấm phấn trắng khi ẩm quá cao' },
      { requirementId: 'req-4', growthStageId: 'stage-3', parameterCode: 'LIGHT_INTENSITY', minValue: 500, maxValue: 950, targetValue: 750, unit: 'lux', description: 'Ánh sáng tổng hợp diệp lục' },
    ]
  }
};

export const mockPlantingSeasons: PlantingSeason[] = [
  {
    plantingSeasonId: 'season-01',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01 - Cà chua Beefsteak A',
    farmId: 'farm-01',
    cropId: 'crop-tomato',
    cropName: 'Cà chua (Tomato)',
    varietyId: 'var-beefsteak',
    varietyName: 'Beefsteak Đà Lạt',
    growthProfileId: 'profile-tomato-std',
    name: 'Vụ Cà chua Thu Đông 2026',
    startDate: '2026-08-01',
    expectedEndDate: '2026-11-15',
    currentGrowthStageId: 'stage-3',
    currentGrowthStageName: 'Ra hoa (Flowering)',
    status: 'ACTIVE',
    progressPercent: 45,
  },
  {
    plantingSeasonId: 'season-02',
    zoneId: 'zone-03',
    zoneName: 'Nhà màng 03 - Ớt ngọt C',
    farmId: 'farm-01',
    cropId: 'crop-chili',
    cropName: 'Ớt ngọt (Chili)',
    varietyId: 'var-sweetpepper',
    varietyName: 'Ớt ngọt Hà Lan Red',
    growthProfileId: 'profile-chili-std',
    name: 'Vụ Ớt ngọt Mùa Khô 2026',
    startDate: '2026-08-15',
    expectedEndDate: '2026-12-01',
    currentGrowthStageId: 'stage-2',
    currentGrowthStageName: 'Sinh trưởng (Vegetative)',
    status: 'ACTIVE',
    progressPercent: 30,
  }
];

export const mockGateways: Gateway[] = [
  {
    gatewayId: 'gw-01',
    farmId: 'farm-01',
    farmName: 'Trang trại Đà Lạt',
    name: 'Gateway Trạm Trung tâm GW-DL-01',
    deviceCode: 'GW-ESP32-DL01',
    serialNumber: 'SN-GW-2026-0089',
    macAddress: '24:DC:C3:98:A1:04',
    latitude: 11.9404,
    longitude: 108.4583,
    status: 'ONLINE',
    firmwareVersion: 'v2.4.1-LoRa',
    lastSeenAt: '1 phút trước',
    installedAt: '2026-01-20',
    rssi: -78,
    connectedNodesCount: 6,
  },
  {
    gatewayId: 'gw-02',
    farmId: 'farm-02',
    farmName: 'Nông trang Đức Trọng',
    name: 'Gateway Phụ GW-DT-02',
    deviceCode: 'GW-ESP32-DT02',
    serialNumber: 'SN-GW-2026-0092',
    macAddress: '24:DC:C3:98:B5:12',
    latitude: 11.7450,
    longitude: 108.3750,
    status: 'ONLINE',
    firmwareVersion: 'v2.4.1-LoRa',
    lastSeenAt: '3 phút trước',
    installedAt: '2026-04-10',
    rssi: -84,
    connectedNodesCount: 3,
  }
];

export const mockNodes: SensorNode[] = [
  {
    nodeId: 'node-01',
    gatewayId: 'gw-01',
    farmId: 'farm-01',
    fieldId: 'field-01',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01 (Cà chua A)',
    name: 'Node Cảm biến Vi khí hậu SN-TOM-01',
    nodeCode: 'SN-LORA-001',
    serialNumber: 'SN-NODE-9901',
    latitude: 11.9406,
    longitude: 108.4585,
    status: 'ONLINE',
    firmwareVersion: 'v1.8.0',
    batteryLevel: 92,
    rssi: -75,
    lastSeenAt: '20 giây trước',
    sensorsCount: 4,
    actuatorsCount: 1,
  },
  {
    nodeId: 'node-02',
    gatewayId: 'gw-01',
    farmId: 'farm-01',
    fieldId: 'field-01',
    zoneId: 'zone-02',
    zoneName: 'Nhà màng 02 (Cà chua B)',
    name: 'Node Cảm biến SN-TOM-02',
    nodeCode: 'SN-LORA-002',
    serialNumber: 'SN-NODE-9902',
    latitude: 11.9408,
    longitude: 108.4588,
    status: 'ONLINE',
    firmwareVersion: 'v1.8.0',
    batteryLevel: 85,
    rssi: -81,
    lastSeenAt: '45 giây trước',
    sensorsCount: 4,
    actuatorsCount: 1,
  },
  {
    nodeId: 'node-03',
    gatewayId: 'gw-01',
    farmId: 'farm-01',
    fieldId: 'field-02',
    zoneId: 'zone-03',
    zoneName: 'Nhà màng 03 (Ớt C)',
    name: 'Node Cảm biến Ớt SN-CHILI-01',
    nodeCode: 'SN-LORA-003',
    serialNumber: 'SN-NODE-9903',
    latitude: 11.9398,
    longitude: 108.4578,
    status: 'WARNING',
    firmwareVersion: 'v1.7.9',
    batteryLevel: 24, // Low battery warning
    rssi: -95,
    lastSeenAt: '5 phút trước',
    sensorsCount: 4,
    actuatorsCount: 1,
  }
];

export const mockSensors: Sensor[] = [
  { sensorId: 'sen-01', nodeId: 'node-01', parameterCode: 'SOIL_MOISTURE', name: 'Cảm biến Độ ẩm đất (Soil Moisture)', sensorCode: 'SEN-SM-01', unit: '%', status: 'ACTIVE', lastReading: 68.4, lastReadingAt: 'Vừa xong' },
  { sensorId: 'sen-02', nodeId: 'node-01', parameterCode: 'TEMPERATURE', name: 'Cảm biến Nhiệt độ Không khí', sensorCode: 'SEN-TEMP-01', unit: '°C', status: 'ACTIVE', lastReading: 24.8, lastReadingAt: 'Vừa xong' },
  { sensorId: 'sen-03', nodeId: 'node-01', parameterCode: 'AIR_HUMIDITY', name: 'Cảm biến Độ ẩm Không khí', sensorCode: 'SEN-HUM-01', unit: '%', status: 'ACTIVE', lastReading: 71.5, lastReadingAt: 'Vừa xong' },
  { sensorId: 'sen-04', nodeId: 'node-01', parameterCode: 'LIGHT_INTENSITY', name: 'Cảm biến Cường độ Ánh sáng', sensorCode: 'SEN-LUX-01', unit: 'lux', status: 'ACTIVE', lastReading: 740, lastReadingAt: 'Vừa xong' },
];

export const mockActuators: Actuator[] = [
  { actuatorId: 'act-01', nodeId: 'node-01', farmId: 'farm-01', zoneId: 'zone-01', zoneName: 'Nhà màng 01', name: 'Bơm Tưới Nhỏ Giọt Chính', actuatorCode: 'PUMP-ZONE-A', actuatorType: 'PUMP', status: 'OFF', lastStateChangeAt: '15 phút trước' },
  { actuatorId: 'act-02', nodeId: 'node-01', farmId: 'farm-01', zoneId: 'zone-01', zoneName: 'Nhà màng 01', name: 'Van Điện Từ Solenoid V1', actuatorCode: 'VALVE-SOL-01', actuatorType: 'VALVE', status: 'OFF', lastStateChangeAt: '15 phút trước' },
  { actuatorId: 'act-03', nodeId: 'node-02', farmId: 'farm-01', zoneId: 'zone-02', zoneName: 'Nhà màng 02', name: 'Quạt Thông Gió Đối Lưu F1', actuatorCode: 'FAN-CONV-01', actuatorType: 'FAN', status: 'ON', lastStateChangeAt: '2 giờ trước' },
  { actuatorId: 'act-04', nodeId: 'node-03', farmId: 'farm-01', zoneId: 'zone-03', zoneName: 'Nhà màng 03', name: 'Đèn Quang Hợp GrowLight L1', actuatorCode: 'LIGHT-LED-01', actuatorType: 'GROW_LIGHT', status: 'OFF', lastStateChangeAt: 'Hôm qua' },
];

export const mockTelemetryHistory: TelemetryReading[] = Array.from({ length: 24 }).map((_, i) => {
  const hour = i;
  const timeStr = `${hour.toString().padStart(2, '0')}:00`;
  return [
    { readingId: `sm-${i}`, zoneId: 'zone-01', sensorId: 'sen-01', parameterCode: 'SOIL_MOISTURE', recordedAt: timeStr, value: 65 + Math.sin(i / 3) * 6, unit: '%', qualityStatus: 'VALID' },
    { readingId: `temp-${i}`, zoneId: 'zone-01', sensorId: 'sen-02', parameterCode: 'TEMPERATURE', recordedAt: timeStr, value: 20 + Math.sin(i / 4) * 5, unit: '°C', qualityStatus: 'VALID' },
    { readingId: `hum-${i}`, zoneId: 'zone-01', sensorId: 'sen-03', parameterCode: 'AIR_HUMIDITY', recordedAt: timeStr, value: 75 - Math.sin(i / 4) * 8, unit: '%', qualityStatus: 'VALID' },
    { readingId: `lux-${i}`, zoneId: 'zone-01', sensorId: 'sen-04', parameterCode: 'LIGHT_INTENSITY', recordedAt: timeStr, value: hour >= 6 && hour <= 18 ? 400 + Math.sin((hour - 6) / 3) * 450 : 0, unit: 'lux', qualityStatus: 'VALID' },
  ];
}).flat() as TelemetryReading[];

export const mockAlerts: Alert[] = [
  {
    alertId: 'alert-101',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01 - Cà chua A',
    sensorId: 'sen-01',
    sensorName: 'Soil Moisture Sensor 01',
    title: 'CẢNH BÁO: Độ ẩm đất dưới ngưỡng tối thiểu',
    message: 'Độ ẩm đất hiện tại 54.2% nằm dưới dải mục tiêu (60% - 80%) của giai đoạn Ra hoa.',
    severity: 'WARNING',
    triggeredValue: 54.2,
    targetRange: '60% - 80%',
    status: 'OPEN',
    triggeredAt: '2026-09-22T20:30:00Z',
  },
  {
    alertId: 'alert-102',
    zoneId: 'zone-03',
    zoneName: 'Nhà màng 03 - Ớt C',
    title: 'NGUY HIỂM: Pin Node SN-CHILI-01 còn 24%',
    message: 'Node cảm biến LoRa sắp hết pin, cần thay thế nguồn điện hoặc sạc solar.',
    severity: 'CRITICAL',
    triggeredValue: 24,
    targetRange: '> 30%',
    status: 'ACKNOWLEDGED',
    triggeredAt: '2026-09-22T19:00:00Z',
    acknowledgedBy: 'Trần Minh Trí (Tech)',
    acknowledgedAt: '2026-09-22T19:25:00Z',
  }
];

export const mockSchedules: ControlSchedule[] = [
  {
    scheduleId: 'sched-01',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01',
    actuatorId: 'act-01',
    actuatorName: 'Bơm Tưới Nhỏ Giọt',
    name: 'Lịch tưới sáng Cà chua',
    startTime: '07:30',
    endTime: '07:50',
    daysOfWeek: ['Mon', 'Wed', 'Fri', 'Sun'],
    actionType: 'TURN_ON',
    durationMinutes: 20,
    isActive: true,
  },
  {
    scheduleId: 'sched-02',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01',
    actuatorId: 'act-01',
    actuatorName: 'Bơm Tưới Nhỏ Giọt',
    name: 'Lịch tưới chiều bổ sung',
    startTime: '16:00',
    endTime: '16:15',
    daysOfWeek: ['Everyday'],
    actionType: 'TURN_ON',
    durationMinutes: 15,
    isActive: true,
  }
];

export const mockAutomationRules: AutomationRule[] = [
  {
    ruleId: 'rule-01',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01',
    name: 'Tự động kích quạt khi nhiệt độ > 29°C',
    parameterCode: 'TEMPERATURE',
    operator: '>',
    thresholdValue: 29.0,
    actuatorId: 'act-03',
    actuatorName: 'Quạt Thông GióĐối Lưu',
    actionType: 'TURN_ON',
    actionDurationMinutes: 30,
    isActive: true,
  },
  {
    ruleId: 'rule-02',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01',
    name: 'Bật bơm khẩn cấp khi độ ẩm đất < 55%',
    parameterCode: 'SOIL_MOISTURE',
    operator: '<',
    thresholdValue: 55.0,
    actuatorId: 'act-01',
    actuatorName: 'Bơm Tưới Nhỏ Giọt',
    actionType: 'TURN_ON',
    actionDurationMinutes: 15,
    isActive: true,
  }
];

export const mockWeather: WeatherData = {
  farmId: 'farm-01',
  temperature: 24.5,
  humidity: 72,
  rainfallMm: 0,
  windSpeedKmH: 12,
  condition: 'Sunny',
  rainProbability: 15,
  recordedAt: '2026-09-22T21:00:00Z',
  forecast: [
    { time: '22:00', temp: 22.0, condition: 'Clear', rainProb: 10 },
    { time: '01:00', temp: 19.5, condition: 'Cloudy', rainProb: 20 },
    { time: '04:00', temp: 18.0, condition: 'Cloudy', rainProb: 25 },
    { time: '07:00', temp: 21.0, condition: 'Sunny', rainProb: 10 },
    { time: '10:00', temp: 26.5, condition: 'Sunny', rainProb: 5 },
    { time: '13:00', temp: 28.0, condition: 'Rainy', rainProb: 65 },
  ]
};

export const mockAIRecommendations: AIRecommendation[] = [
  {
    recommendationId: 'rec-01',
    farmId: 'farm-01',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01',
    cropName: 'Cà chua Beefsteak (Giai đoạn Ra hoa)',
    recommendationType: 'IRRIGATION',
    title: 'Khuyến nghị: Trì hoãn tưới chiều đến 16:30 do dự báo mưa lớn',
    recommendationText: 'Dữ liệu thời tiết cho thấy khả năng mưa 65% vào chiều nay lúc 13:00-15:00. Bổ sung ẩm tự nhiên từ vi khí hậu giúp giảm 20% nước tưới.',
    reasoning: 'Độ ẩm đất hiện tại 68.4% vẫn ở mức an toàn. Hoãn chu kỳ tưới Bơm 01 30 phút giúp tiết kiệm 150 lít nước sạch và giảm nguy cơ ngập úng gốc.',
    expectedImpact: 'Tiết kiệm 150L nước & phòng ngừa nấm rễ',
    confidenceScore: 94,
    status: 'PENDING',
    createdAt: '2026-09-22T20:00:00Z',
  }
];

export const mockAIMessages: AIMessage[] = [
  {
    messageId: 'msg-01',
    conversationId: 'conv-01',
    senderType: 'USER',
    messageText: 'Chào Trợ lý AI! Kiểm tra giùm tôi trạng thái sức khỏe vi khí hậu của Nhà màng 01 Cà chua có cần điều chỉnh gì không?',
    createdAt: '2026-09-22T20:40:00Z',
  },
  {
    messageId: 'msg-02',
    conversationId: 'conv-01',
    senderType: 'AI',
    messageText: 'Xin chào anh Lê Văn An! Tôi đã phân tích toàn bộ số liệu thời gian thực từ 4 cảm biến tại Nhà màng 01 (Cà chua Beefsteak - Giai đoạn Ra hoa):\n\n• **Độ ẩm đất:** 68.4% (Tốt - Mục tiêu 70%)\n• **Nhiệt độ:** 24.8°C (Tốt - Dải 18-28°C)\n• **Độ ẩm không khí:** 71.5% (Tốt)\n• **Ánh sáng:** 740 lux (Đạt quang hợp)\n\n👉 **Khuyến nghị hành động:** Không cần can thiệp khẩn cấp. Tuy nhiên có 1 khuyến nghị hoãn lịch tưới chiều để tránh dư ẩm khi thời tiết có mưa.',
    createdAt: '2026-09-22T20:40:05Z',
    recommendation: mockAIRecommendations[0]
  }
];

export const mockTasks: TaskItem[] = [
  {
    taskId: 'task-01',
    farmId: 'farm-01',
    zoneId: 'zone-01',
    zoneName: 'Nhà màng 01',
    title: 'Kiểm tra đường ống nhỏ giọt và vệ sinh đầu béc tưới',
    description: 'Rà soát béc tưới hàng số 3 và 4 có dấu hiệu đóng cặn phèn nhẹ',
    taskType: 'MAINTENANCE',
    priority: 'MEDIUM',
    status: 'PENDING',
    assignedToUser: 'user-farmer',
    assignedToName: 'Trần Văn Bình',
    dueDate: '2026-09-23',
  },
  {
    taskId: 'task-02',
    farmId: 'farm-01',
    zoneId: 'zone-03',
    zoneName: 'Nhà màng 03',
    title: 'Phun vi sinh phòng trừ bọ trĩ theo quy trình VietGAP',
    description: 'Sử dụng chế phẩm sinh học Chitosan pha tỉ lệ 1:500',
    taskType: 'PEST_CONTROL',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedToUser: 'user-farmer',
    assignedToName: 'Trần Văn Bình',
    dueDate: '2026-09-22',
  }
];

export const mockInventory: MaterialInventory[] = [
  { inventoryId: 'inv-01', farmId: 'farm-01', materialName: 'Phân bón NPK 16-16-8 Hòa tan', code: 'MAT-NPK-01', category: 'FERTILIZER', quantity: 450, unit: 'kg', minimumStock: 100, storageLocation: 'Kho Vật tư A1', updatedAt: '2026-09-20' },
  { inventoryId: 'inv-02', farmId: 'farm-01', materialName: 'Hạt giống Cà chua Beefsteak F1', code: 'MAT-SEED-TOM', category: 'SEED', quantity: 1200, unit: 'hạt', minimumStock: 500, storageLocation: 'Tủ lạnh bảo quản S1', updatedAt: '2026-09-18' },
  { inventoryId: 'inv-03', farmId: 'farm-01', materialName: 'Chế phẩm Sinh học Trichoderma', code: 'MAT-BIO-TRI', category: 'PESTICIDE', quantity: 25, unit: 'lit', minimumStock: 30, storageLocation: 'Kho Hóa chất B2', updatedAt: '2026-09-15' },
];

export const mockServiceRequests: ServiceRequest[] = [
  {
    serviceRequestId: 'sr-01',
    tenantId: 'tenant-01',
    farmId: 'farm-01',
    farmName: 'Trang trại Đà Lạt',
    nodeId: 'node-03',
    deviceName: 'Node Cảm biến Ớt SN-CHILI-01',
    requestedBy: 'Lê Văn An (Owner)',
    assignedTechnician: 'user-tech',
    assignedTechnicianName: 'Trần Minh Trí',
    title: 'Cần thay thế viên pin Lithium sạc Solar bị chai',
    description: 'Node SN-CHILI-01 liên tục báo dung lượng pin dưới 25% dù nắng tốt.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    requestType: 'REPLACEMENT',
    createdAt: '2026-09-22T19:30:00Z',
  }
];

export const mockAuditLogs: AuditLog[] = [
  { auditLogId: 'log-01', userId: 'user-owner', userName: 'Lê Văn An', userRole: 'FARM_OWNER', action: 'CREATE_AUTOMATION_RULE', entityName: 'AutomationRule', entityId: 'rule-01', ipAddress: '113.161.42.10', createdAt: '2026-09-22T20:15:00Z', details: 'Thêm luật tự động kích quạt khi nhiệt độ > 29°C' },
  { auditLogId: 'log-02', userId: 'user-tech', userName: 'Trần Minh Trí', userRole: 'PLATFORM_TECHNICIAN', action: 'PROVISION_GATEWAY', entityName: 'Gateway', entityId: 'gw-01', ipAddress: '42.112.98.15', createdAt: '2026-09-22T19:25:00Z', details: 'Nạp Whitelist MAC 24:DC:C3:98:A1:04 vào Gateway' }
];
