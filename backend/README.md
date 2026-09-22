# SmartFarm Backend (.NET Clean Architecture)

Dự án Backend cho nền tảng Quản lý Nông nghiệp Thông minh SmartFarm, được tổ chức theo kiến trúc Clean Architecture.

## Cấu trúc thư mục

```text
backend/
│
├── src/
│   ├── Domain/                                     # DỰ ÁN 1: DOMAIN LAYER (CORE)
│   │   ├── Entities/                               # [PHÂN FOLDER THEO MODULE]
│   │   │   ├── Identity/                           # User.cs, Role.cs, Tenant.cs
│   │   │   ├── FarmManagement/                     # Farm.cs, Field.cs, Zone.cs, Crop.cs, CropProfile.cs
│   │   │   ├── DeviceIoT/                          # Gateway.cs, Node.cs, Sensor.cs, Actuator.cs
│   │   │   ├── Monitoring/                         # SensorReading.cs, Alert.cs
│   │   │   ├── AutomationControl/                  # ControlRule.cs, ControlSchedule.cs
│   │   │   └── AiAdvisory/                         # ChatSession.cs, ChatMessage.cs
│   │   │
│   │   └── Enum/                                   # [PHÂN FOLDER THEO MODULE]
│   │       ├── Identity/                           # UserRole.cs
│   │       ├── DeviceIoT/                          # DeviceStatus.cs, SensorType.cs
│   │       └── Monitoring/                         # AlertSeverity.cs
│   │
│   ├── Application/                                # DỰ ÁN 2: APPLICATION LAYER
│   │   ├── DTOs/                                   # [PHÂN FOLDER THEO MODULE]
│   │   │   ├── Identity/                           # LoginRequestDto.cs, UserResponseDto.cs
│   │   │   ├── FarmManagement/                     # CreateFarmDto.cs, ZoneDetailDto.cs
│   │   │   ├── DeviceIoT/                          # ProvisionNodeDto.cs, DeviceHealthDto.cs
│   │   │   ├── Monitoring/                         # TelemetryDataDto.cs, AlertDto.cs
│   │   │   ├── AutomationControl/                  # TriggerActuatorDto.cs, RuleDto.cs
│   │   │   └── AiAdvisory/                         # ChatPromptDto.cs, RecommendationDto.cs
│   │   │
│   │   ├── Interfaces/                             # [PHÂN FOLDER THEO MODULE]
│   │   │   ├── Identity/                           # IUserRepository.cs, ITenantRepository.cs
│   │   │   ├── FarmManagement/                     # IFarmRepository.cs, IZoneRepository.cs
│   │   │   ├── DeviceIoT/                          # IDeviceRepository.cs, IMqttService.cs
│   │   │   ├── Monitoring/                         # ISensorReadingRepository.cs
│   │   │   ├── AutomationControl/                  # IControlRuleRepository.cs
│   │   │   └── AiAdvisory/                         # IAiServiceClient.cs
│   │   │
│   │   ├── Services/                               # [PHÂN FOLDER THEO MODULE]
│   │   │   ├── Identity/                           # AuthService.cs, UserService.cs, TenantService.cs
│   │   │   ├── FarmManagement/                     # FarmService.cs, ZoneService.cs, CropProfileService.cs
│   │   │   ├── DeviceIoT/                          # DeviceProvisioningService.cs, DeviceHealthService.cs
│   │   │   ├── Monitoring/                         # TelemetryProcessingService.cs, AlertEngineService.cs
│   │   │   ├── AutomationControl/                  # SmartIrrigationService.cs, ControlRuleEngineService.cs
│   │   │   └── AiAdvisory/                         # AiAdvisoryService.cs, ContextBuilderService.cs
│   │   │
│   │   └── Mappings/                               # AutoMapper Profiles / Mapster Configs
│   │       ├── IdentityProfile.cs
│   │       ├── FarmProfile.cs
│   │       └── DeviceProfile.cs
│   │
│   ├── Infrastructure/                             # DỰ ÁN 3: INFRASTRUCTURE LAYER
│   │   ├── Repositories/                           # [PHÂN FOLDER THEO MODULE]
│   │   │   ├── Identity/                           # UserRepository.cs, TenantRepository.cs
│   │   │   ├── FarmManagement/                     # FarmRepository.cs, ZoneRepository.cs
│   │   │   ├── DeviceIoT/                          # DeviceRepository.cs
│   │   │   ├── Monitoring/                         # SensorReadingRepository.cs
│   │   │   └── AutomationControl/                  # ControlRuleRepository.cs
│   │   │
│   │   ├── EntitiesConfigurations/                 # [PHÂN FOLDER THEO MODULE] (EF Core Configs)
│   │   │   ├── Identity/                           # UserConfiguration.cs, TenantConfiguration.cs
│   │   │   ├── FarmManagement/                     # FarmConfiguration.cs, ZoneConfiguration.cs
│   │   │   └── DeviceIoT/                          # GatewayConfiguration.cs, NodeConfiguration.cs
│   │   │
│   │   ├── Migration/                              # EF Core Migrations
│   │   │
│   │   └── Configurations/                         # Implementations kỹ thuật
│   │       ├── Mqtt/                               # MqttClientService.cs (LoRa Gateway)
│   │       ├── AiService/                          # AiServiceClient.cs, WeatherApiClient.cs
│   │       ├── Identity/                           # JwtTokenGenerator.cs
│   │       ├── Persistence/                        # ApplicationDbContext.cs (MultiTenantInterceptor)
│   │       └── Jobs/                               # Quartz.NET Jobs (ScheduledIrrigationJob.cs)
│   │
│   └── WebAPI/                                     # DỰ ÁN 4: PRESENTATION LAYER (.NET NEW PATTERN)
│       ├── Controllers/                            # [PHÂN FOLDER THEO MODULE]
│       │   ├── Identity/                           # AuthController.cs, UsersController.cs, TenantsController.cs
│       │   ├── FarmManagement/                     # FarmsController.cs, ZonesController.cs, CropsController.cs
│       │   ├── DeviceIoT/                          # GatewaysController.cs, NodesController.cs
│       │   ├── Monitoring/                         # EnvironmentalDataController.cs, AlertsController.cs
│       │   ├── AutomationControl/                  # ActuatorsController.cs, SchedulesController.cs
│       │   ├── AiAdvisory/                         # ChatbotController.cs
│       │   └── Reporting/                          # DashboardsController.cs, ExportsController.cs
│       │
│       ├── Extensions/                             # Gom cấu hình DI, Swagger gọn nhẹ
│       │   ├── SwaggerExtensions.cs                # Cấu hình Swagger UI, Bearer Token Auth
│       │   └── ServiceCollectionExtensions.cs      # Đăng ký App Services, Infrastructure DI
│       │
│       ├── Middlewares/                            # Middlewares chạy trong HTTP Pipeline
│       │   ├── TenantResolverMiddleware.cs         # Đọc TenantId từ JWT Token
│       │   └── ExceptionHandlingMiddleware.cs      # Bắt lỗi toàn cục
│       │
│       └── Program.cs                              # Entry Point gộp duy nhất (Gồm DI & HTTP Pipeline)
│
├── tests/
│   └── Application.UnitTest/                       # Unit Test
│       └── Services/
│           ├── Identity/
│           └── DeviceIoT/
│
├── appsettings.json                               # Configs (DB Connection, MQTT, JWT)
└── README.md
```
