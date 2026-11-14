namespace SmartFarm.Application.Features.Platform;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
public sealed record AuditLogView(
    Guid Id,
    Guid? ActorUserId,
    string ActorName,
    string ActorRole,
    string Action,
    string EntityName,
    string EntityId,
    string? IpAddress,
    string? Details,
    DateTime CreatedAtUtc);

public sealed record AuditLogPagedResult(IReadOnlyList<AuditLogView> Items, int TotalCount, int Page, int PageSize);

// ─── Platform Settings ────────────────────────────────────────────────────────
/// <summary>Tham số nghiệp vụ hiện hành mà web/mobile cần để hiển thị; đọc từ platform_settings (mọi vai trò đã đăng nhập đều đọc được).</summary>
public sealed record BusinessParametersView(decimal DepositPercent, decimal RainGuardThresholdPercent, decimal RepeatPurchaseDiscountPercent, decimal RenewalDiscountPercent);
public sealed record PlatformSettingView(string Key, string Value, string Group, string DataType, string? Description, bool IsSecret, DateTime? UpdatedAtUtc);
public sealed record UpdatePlatformSettingItem(string Key, string Value);

// ─── Platform Hardware Items ──────────────────────────────────────────────────
public sealed record PlatformHardwareItemView(Guid Id, string Code, string Name, string Category, string? Model, string? Manufacturer, string? SerialNumber, string? MacAddress, int QuantityInStock, string? LocationRack, decimal UnitPrice, string Status, Guid? AssignedTechnicianId, DateTime CreatedAtUtc, string? EstimateRole = null, int EstimateUnits = 1, IReadOnlyList<string>? MeasuredParameters = null, Guid? DeviceModelDefinitionId = null);
public sealed record CreateHardwareItemCommand(string Code, string Name, string Category, string? Model, string? Manufacturer, string? SerialNumber, string? MacAddress, int QuantityInStock, string? LocationRack, decimal UnitPrice, string? Status, string? EstimateRole = null, int? EstimateUnits = null, IReadOnlyList<string>? MeasuredParameters = null, Guid? DeviceModelDefinitionId = null);
/// <summary>PUT: UnitPrice/EstimateRole/EstimateUnits/MeasuredParameters = null nghĩa là GIỮ NGUYÊN giá trị hiện có (client cũ không được vô tình xóa giá). EstimateRole rỗng hoặc MeasuredParameters rỗng = xóa.</summary>
public sealed record UpdateHardwareItemCommand(string Name, string Category, string? Model, string? Manufacturer, string? SerialNumber, string? MacAddress, int QuantityInStock, string? LocationRack, decimal? UnitPrice, string Status, string? EstimateRole = null, int? EstimateUnits = null, IReadOnlyList<string>? MeasuredParameters = null, Guid? DeviceModelDefinitionId = null);
public sealed record AssignHardwareItemCommand(Guid TechnicianUserId, int Quantity = 1);

// ─── Service Request Quotation ────────────────────────────────────────────────
public sealed record QuotationItemInput(string Code, string Name, string Category, string Unit, int Quantity, decimal UnitPrice, decimal VatPercent, string? Notes);
/// <summary>VAT mặc định của báo giá lắp đặt thiết bị (8% theo các báo giá hiện có); kỹ thuật viên chỉnh được khi lập báo giá.</summary>
public static class QuotationDefaults
{
    public const decimal VatPercent = 8m;
}
/// <summary>Bản nháp báo giá dựng từ dự toán Owner đã lưu kèm Deployment Request. Kỹ thuật viên chỉnh sửa rồi gửi bằng POST quotation.</summary>
public sealed record QuotationEstimateDraftView(Guid ServiceRequestId, Guid DeploymentRequestId, decimal VatPercent, IReadOnlyList<QuotationItemInput> Items, decimal Subtotal, decimal Total);
public sealed record CreateQuotationCommand(IReadOnlyList<QuotationItemInput> Items, string? Notes, string? ContractTerms);

public sealed record QuotationItemView(Guid Id, string Code, string Name, string Category, string Unit, int Quantity, decimal UnitPrice, decimal VatPercent, decimal TotalAmount, string? Notes);
public sealed record QuotationView(
    Guid Id,
    Guid ServiceRequestId,
    Guid TechnicianUserId,
    decimal Subtotal,
    decimal VatPercent,
    decimal VatAmount,
    decimal TotalAmount,
    decimal Deposit30Percent,
    decimal Remaining70Percent,
    string? Notes,
    string? ContractTerms,
    string Status,
    IReadOnlyList<QuotationItemView> Items,
    DateTime CreatedAtUtc);

// ─── Contract Signing & Payments ──────────────────────────────────────────────
public sealed record SignContractDepositCommand(string SignerFullName, string PaymentMethod, string? TransactionReference, string? Notes, decimal? ExpectedDepositAmount = null);
public sealed record SignAcceptanceFinalCommand(string SignerFullName, string PaymentMethod, string? TransactionReference, string? Notes);
public sealed record ServiceRequestPaymentView(Guid Id, string PaymentStage, decimal Amount, string PaymentMethod, string? TransactionReference, string SignerFullName, string Status, DateTime PaidAtUtc);

// ─── GIS Node Mapping ─────────────────────────────────────────────────────────
public sealed record NodeLocationInput(Guid DeviceId, decimal Latitude, decimal Longitude, int? BatteryLevel, decimal? Rssi, string? HardwareAddress = null, string? DeviceType = null, string? DeviceName = null, string? LocationSource = null, string? InstallationNotes = null);
public sealed record BulkUpdateNodeLocationsCommand(Guid? ServiceRequestId, IReadOnlyList<NodeLocationInput> Nodes, Guid? DeploymentRequestId = null);
public sealed record DeviceMapLocationView(Guid DeviceId, string HardwareAddress, string DeviceType, decimal? Latitude, decimal? Longitude, int? BatteryLevel, decimal? Rssi, string Status, string? DeviceName = null);

// ─── Farm Wizard Setup ────────────────────────────────────────────────────────
public sealed record FarmWizardFarmInput(string Name, string? LocationText, decimal? Latitude, decimal? Longitude, decimal? TotalAreaM2, string? TimeZone);
public sealed record FarmWizardFieldInput(string Name, decimal? AreaM2, string? SoilType, string? BoundaryGeoJson);
public sealed record FarmWizardZoneInput(string Name, decimal? AreaM2, string? ZoneType, string? BoundaryGeoJson);
public sealed record FarmWizardSeasonInput(string Name, Guid CropId, Guid? VarietyId, Guid? GrowthProfileId, DateTime StartDate, DateTime? ExpectedEndDate);
/// <summary>Một dòng dự toán gửi kèm yêu cầu. Có HardwareItemId: server lấy mã/tên/giá từ kho (bỏ qua giá client). Role "Installation": chi phí thi công, cần UnitPrice.</summary>
public sealed record FarmWizardEstimateItemInput(Guid? HardwareItemId, string Role, int Quantity, decimal? UnitPrice = null, string? Name = null, string? Notes = null);
public sealed record FarmWizardDeploymentInput(IReadOnlyList<string>? RequiredParameters, string? OwnerNotes, IReadOnlyList<FarmWizardEstimateItemInput>? EstimateItems = null);
public sealed record FarmWizardSetupCommand(
    FarmWizardFarmInput Farm,
    FarmWizardFieldInput? Field,
    FarmWizardZoneInput? Zone,
    FarmWizardSeasonInput? Season,
    FarmWizardDeploymentInput? InitialDeploymentRequest);

public sealed record FarmWizardResult(Guid FarmId, Guid? FieldId, Guid? ZoneId, Guid? SeasonId, Guid? DeploymentRequestId);

// ─── Weather Forecast ─────────────────────────────────────────────────────────
public sealed record FarmWeatherView(
    decimal? Temperature,
    decimal? Humidity,
    decimal? PrecipitationProbability,
    decimal? WindSpeed,
    string? WeatherDescription,
    IReadOnlyList<DailyForecastView> DailyForecast,
    DateTime LastUpdatedAtUtc);

public sealed record DailyForecastView(DateTime Date, decimal? MaxTemperature, decimal? MinTemperature, decimal? PrecipitationProbability, string? Description);

// ─── Farmer My-Tasks ──────────────────────────────────────────────────────────
public sealed record FarmerCompleteTaskCommand(string? ResultNotes);

// ─── Farmer Assigned Zones ────────────────────────────────────────────────────
public sealed record FarmerZoneView(Guid ZoneId, string ZoneName, Guid FieldId, Guid FarmId, bool CanControl, DateTime GrantedAtUtc);

// ─── Interfaces ───────────────────────────────────────────────────────────────
public interface IPlatformAdminService
{
    // Audit logs
    Task<AuditLogPagedResult> GetAuditLogsAsync(int page, int pageSize, string? search, string? action, string? entity, DateTime? fromDate, DateTime? toDate, CancellationToken ct);

    // Platform settings
    Task<IReadOnlyList<PlatformSettingView>> GetSettingsAsync(CancellationToken ct);
    Task<BusinessParametersView> GetBusinessParametersAsync(CancellationToken ct);
    Task<IReadOnlyList<PlatformSettingView>> UpdateSettingsAsync(IReadOnlyList<UpdatePlatformSettingItem> updates, Guid updatedByUserId, CancellationToken ct);

    // Hardware items
    Task<IReadOnlyList<PlatformHardwareItemView>> ListHardwareItemsAsync(CancellationToken ct);
    Task<PlatformHardwareItemView> CreateHardwareItemAsync(CreateHardwareItemCommand command, CancellationToken ct);
    Task<PlatformHardwareItemView> UpdateHardwareItemAsync(Guid id, UpdateHardwareItemCommand command, CancellationToken ct);
    Task<PlatformHardwareItemView> AssignHardwareItemAsync(Guid id, AssignHardwareItemCommand command, CancellationToken ct);
    Task<PlatformHardwareItemView> ReturnHardwareItemAsync(Guid id, CancellationToken ct);
    Task DeleteHardwareItemAsync(Guid id, CancellationToken ct);

    // System health report
    Task<SystemHealthView> GetSystemHealthAsync(CancellationToken ct);

    // Growth profiles (all without crop filter)
    Task<IReadOnlyList<AllGrowthProfileView>> GetAllGrowthProfilesAsync(bool? isSystemDefined, string? search, CancellationToken ct);
}

public sealed record SystemHealthView(long ApiLatencyMs, long MemoryUsageBytes, long TotalMemoryBytes, int ActiveTenantsCount, int ActiveGatewaysCount, int ConnectedNodesCount, long TotalTelemetryRows, string MqttBrokerStatus, string DatabaseStatus, DateTime LastCheckedAtUtc);
public sealed record AllGrowthProfileView(Guid ProfileId, string ProfileName, Guid CropId, string CropName, int TotalDays, bool IsSystemDefined, DateTime CreatedAtUtc);

public interface IQuotationService
{
    Task<QuotationView> CreateAsync(Guid technicianId, Guid serviceRequestId, CreateQuotationCommand command, CancellationToken ct);
    Task<QuotationView?> GetAsync(Guid userId, Guid serviceRequestId, CancellationToken ct);
    Task<QuotationEstimateDraftView> GetEstimateDraftAsync(Guid technicianId, Guid serviceRequestId, decimal vatPercent, CancellationToken ct);
    Task<ServiceRequestPaymentView> SignContractDepositAsync(Guid ownerId, Guid serviceRequestId, SignContractDepositCommand command, CancellationToken ct);
    Task<ServiceRequestPaymentView> SignAcceptanceFinalAsync(Guid ownerId, Guid serviceRequestId, SignAcceptanceFinalCommand command, CancellationToken ct);
}

public interface IGisService
{
    Task BulkUpdateNodeLocationsAsync(Guid technicianId, Guid zoneId, BulkUpdateNodeLocationsCommand command, CancellationToken ct);
    Task<IReadOnlyList<DeviceMapLocationView>> GetMapLocationsAsync(Guid userId, Guid zoneId, CancellationToken ct);
}

public interface IFarmWizardService
{
    Task<FarmWizardResult> SetupAsync(Guid ownerId, Guid tenantId, FarmWizardSetupCommand command, CancellationToken ct);
}

public interface IWeatherService
{
    Task<FarmWeatherView> GetFarmWeatherAsync(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct);
}

public interface IFarmerService
{
    Task<IReadOnlyList<object>> GetMyTasksAsync(Guid farmerId, CancellationToken ct);
    Task CompleteTaskAsync(Guid farmerId, Guid taskId, FarmerCompleteTaskCommand command, CancellationToken ct);
    Task<IReadOnlyList<FarmerZoneView>> GetMyZonesAsync(Guid farmerId, CancellationToken ct);
    Task<IReadOnlyList<PlatformHardwareItemView>> GetMySparePartsAsync(Guid technicianId, CancellationToken ct);
}

// ─── Control Automation & Safety Interlocks ───────────────────────────────────
public sealed record EnvironmentalTargetConfigView(
    Guid ZoneId,
    string ZoneName,
    decimal TargetSoilMoisture,
    decimal MinSoilMoisture,
    decimal MaxSoilMoisture,
    decimal MaxTemperature,
    decimal TargetHumidity,
    decimal TargetLux,
    decimal PowerWatts);

public sealed record UpdateEnvironmentalTargetConfigCommand(
    Guid ZoneId,
    decimal TargetSoilMoisture,
    decimal MinSoilMoisture,
    decimal MaxSoilMoisture,
    decimal MaxTemperature,
    decimal TargetHumidity,
    decimal TargetLux,
    decimal? PowerWatts);

public sealed record EmergencyStopResult(bool Success, int StoppedCount, string Message);

public interface IControlAutomationService
{
    Task<EmergencyStopResult> EmergencyStopAllAsync(Guid userId, Guid tenantId, Guid? zoneId, CancellationToken ct);
    Task<IReadOnlyList<EnvironmentalTargetConfigView>> GetEnvironmentalConfigsAsync(Guid userId, Guid tenantId, Guid? zoneId, CancellationToken ct);
    Task<EnvironmentalTargetConfigView> UpdateEnvironmentalConfigAsync(Guid userId, Guid tenantId, UpdateEnvironmentalTargetConfigCommand command, CancellationToken ct);
}

public interface IScheduleSyncService
{
    Task<IReadOnlyList<object>> SyncFromCropAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid cropId, Guid actuatorId, CancellationToken ct);

    /// <summary>Đồng bộ lịch tưới của HỒ SƠ đang gắn trên Zone (không nhận cây tùy ý) thành ControlSchedule cho một thiết bị của Zone.</summary>
    Task<ProfileScheduleSyncResult> SyncFromProfileAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid actuatorId, Guid? growthStageId, CancellationToken ct);
}

/// <summary>Source: Profile (ca lưu trong profile) hoặc Crop (profile chưa có ca nên dùng lịch mẫu của cây).</summary>
public sealed record ProfileScheduleSyncResult(Guid ProfileId, string ProfileName, Guid StageId, string StageName, string Source, Guid ActuatorId, IReadOnlyList<ProfileSyncedScheduleView> Schedules, Guid? SeasonId = null, int? DayNumber = null);
public sealed record ProfileSyncedScheduleView(Guid ScheduleId, string Name, string CronExpression, int DurationSeconds, bool IsActive, DateTime NextRunAtUtc);

