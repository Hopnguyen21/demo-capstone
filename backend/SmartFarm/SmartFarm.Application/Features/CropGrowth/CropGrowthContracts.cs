using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.CropGrowth;

public sealed record CreateCropCommand(
    string Name, 
    string? ScientificName, 
    string? Description,
    string? Category = null,
    int? GrowthCycleDays = null,
    decimal? OptimalTemperatureMin = null,
    decimal? OptimalTemperatureMax = null,
    decimal? OptimalSoilMoistureMin = null,
    decimal? OptimalSoilMoistureMax = null,
    decimal? OptimalPhMin = null,
    decimal? OptimalPhMax = null,
    decimal? OptimalEcMin = null,
    decimal? OptimalEcMax = null,
    decimal? OptimalLux = null,
    string? CalendarIrrigationPlan = null);

public sealed record UpdateCropCommand(
    string Name, 
    string? ScientificName, 
    string? Description,
    string? Category = null,
    int? GrowthCycleDays = null,
    decimal? OptimalTemperatureMin = null,
    decimal? OptimalTemperatureMax = null,
    decimal? OptimalSoilMoistureMin = null,
    decimal? OptimalSoilMoistureMax = null,
    decimal? OptimalPhMin = null,
    decimal? OptimalPhMax = null,
    decimal? OptimalEcMin = null,
    decimal? OptimalEcMax = null,
    decimal? OptimalLux = null,
    string? CalendarIrrigationPlan = null);

public sealed record CropView(
    Guid CropId, 
    string Name, 
    string ScientificName, 
    string? Description, 
    bool IsSystemDefined, 
    Guid? TenantId,
    string? Category = null,
    int? GrowthCycleDays = null,
    decimal? OptimalTemperatureMin = null,
    decimal? OptimalTemperatureMax = null,
    decimal? OptimalSoilMoistureMin = null,
    decimal? OptimalSoilMoistureMax = null,
    decimal? OptimalPhMin = null,
    decimal? OptimalPhMax = null,
    decimal? OptimalEcMin = null,
    decimal? OptimalEcMax = null,
    decimal? OptimalLux = null,
    string? CalendarIrrigationPlan = null);

public sealed record CreateVarietyCommand(string Name, string? Description);
public sealed record VarietyView(Guid VarietyId, Guid CropId, string Name, string? Description, bool IsSystemDefined, Guid? TenantId);

public sealed record RequirementInput(EnvironmentalParameterCode ParameterCode, decimal MinValue, decimal MaxValue, decimal TargetValue, string Unit);
public sealed record StageInput(string Name, int StageOrder, int DurationDays, IReadOnlyList<RequirementInput> Requirements, string? Description = null, string? FertilizerAction = null, string? IpmAction = null);
public sealed record CreateGrowthProfileCommand(Guid CropId, Guid? VarietyId, string Name, string? Description, bool IsDefault, Guid? SourceProfileId, IReadOnlyList<StageInput>? Stages);
/// <summary>Sửa thông tin chung của profile; giai đoạn và ngưỡng sửa riêng (requirements).</summary>
public sealed record UpdateGrowthProfileCommand(string Name, string? Description, bool IsDefault);
public sealed record RequirementView(EnvironmentalParameterCode ParameterCode, decimal MinValue, decimal MaxValue, decimal TargetValue, string Unit);
public sealed record GrowthStageView(Guid StageId, string Name, int StageOrder, int DurationDays, IReadOnlyList<RequirementView> Requirements, string? Description = null, string? FertilizerAction = null, string? IpmAction = null);
public sealed record GrowthProfileView(Guid ProfileId, Guid CropId, string CropName, Guid? VarietyId, string? VarietyName, string Name, string? Description, bool IsDefault, bool IsSystemDefined, Guid? TenantId, Guid? SourceProfileId, IReadOnlyList<GrowthStageView> Stages);
public sealed record RequirementUpdateView(Guid EffectiveProfileId, Guid EffectiveStageId, bool ClonedFromSystem, IReadOnlyList<RequirementView> Requirements);

// ── Lịch tưới thuộc Growth Profile (theo giai đoạn) ──
// StartTime: "HH:mm" giờ ĐỊA PHƯƠNG theo múi giờ Farm. DurationSeconds: 1..1800. Mọi ngày trong giai đoạn lặp hằng ngày.
public sealed record IrrigationSessionInput(string Title, string StartTime, int DurationSeconds, bool Enabled = true, string? Method = null, int? WaterPerPlantMl = null);
public sealed record StageIrrigationInput(Guid StageId, IReadOnlyList<IrrigationSessionInput> Sessions);
/// <summary>Thay toàn bộ các ca tưới của những giai đoạn được liệt kê (giai đoạn không liệt kê giữ nguyên). Danh sách rỗng = xóa hết ca của giai đoạn.</summary>
public sealed record UpdateProfileIrrigationCommand(IReadOnlyList<StageIrrigationInput> Stages);
public sealed record IrrigationSessionView(Guid SessionId, string Title, string StartTime, int DurationSeconds, bool Enabled, string? Method, int? WaterPerPlantMl);
/// <summary>Source: Profile (ca đã lưu trong profile) | Crop (profile chưa có ca; hiển thị lịch mẫu của cây, chỉ đọc) | None.</summary>
public sealed record StageIrrigationView(Guid StageId, string StageName, int StageOrder, int DurationDays, string Source, IReadOnlyList<IrrigationSessionView> Sessions);
public sealed record ProfileIrrigationView(Guid ProfileId, string ProfileName, bool IsSystemDefined, bool IsEditable, string RepeatType, string TimeZone, IReadOnlyList<StageIrrigationView> Stages);

// ── Lịch tưới tùy chỉnh THEO NGÀY của vụ trồng (Zone + mùa vụ) ──
// Chỉ các ngày bị sửa mới được lưu (override, khóa theo số ngày canh tác, 1 = ngày bắt đầu vụ). Ngày không override dùng lịch theo giai đoạn của profile.
// Source mỗi ngày: Override (lịch tùy chỉnh của vụ) | Profile (ca đã lưu trong profile) | Crop (profile chưa có ca; lịch mẫu của cây, chỉ tham khảo) | None.
// Status: NoOverrides | Current | Stale (vụ đổi ngày bắt đầu/số ngày/profile sau lần lưu cuối, hoặc có ngày nằm ngoài vụ; dữ liệu KHÔNG bị xóa).
public sealed record SeasonIrrigationDayView(int DayNumber, DateOnly Date, Guid? StageId, string? StageName, string Source, bool IsOverride, bool OutOfRange, IReadOnlyList<IrrigationSessionView> Sessions);
public sealed record SeasonIrrigationCalendarView(Guid SeasonId, Guid ZoneId, string SeasonName, string SeasonStatus, Guid GrowthProfileId, string GrowthProfileName, DateOnly StartDate, int TotalDays, int? TodayDayNumber, string TimeZone, string RepeatType, string Status, IReadOnlyList<string> StaleReasons, bool HasOverrides, int OverrideDayCount, bool IsEditable, DateTime? UpdatedAtUtc, Guid? UpdatedByUserId, DateOnly? SnapshotStartDate, int? SnapshotTotalDays, IReadOnlyList<SeasonIrrigationDayView> Days);
public sealed record DayIrrigationInput(int DayNumber, IReadOnlyList<IrrigationSessionInput> Sessions);
/// <summary>Ghi đè (upsert) các ngày được liệt kê; ngày không liệt kê giữ nguyên. Danh sách ca rỗng = ngày đó cố ý không tưới.</summary>
public sealed record UpdateSeasonIrrigationCommand(IReadOnlyList<DayIrrigationInput> Days);

public sealed record CreatePlantingSeasonCommand(Guid CropId, Guid? VarietyId, Guid GrowthProfileId, string Name, DateOnly StartDate, DateOnly ExpectedEndDate, Guid? FarmingSeasonId = null, bool SetZoneCrop = false);
/// <summary>Một Zone trong thao tác tạo vụ hàng loạt; ngày để trống thì dùng ngày chung. SetZoneCrop là xác nhận riêng của Owner cho Zone này.</summary>
public sealed record BulkSeasonZoneItem(Guid ZoneId, DateOnly? StartDate, DateOnly? ExpectedEndDate, bool SetZoneCrop);
public sealed record BulkCreateSeasonsCommand(
    Guid FarmingSeasonId, Guid CropId, Guid? VarietyId, Guid GrowthProfileId, string NamePrefix, DateOnly StartDate, DateOnly ExpectedEndDate,
    IReadOnlyList<BulkSeasonZoneItem> Zones, bool DryRun, bool SkipInvalid);
public sealed record BulkSeasonZoneResult(Guid ZoneId, string? ZoneName, bool Valid, IReadOnlyList<string> Problems, Guid? PlantingSeasonId);
public sealed record BulkCreateSeasonsResult(bool Created, bool DryRun, int ValidCount, int InvalidCount, IReadOnlyList<BulkSeasonZoneResult> Zones);
public sealed record StageDurationView(Guid ProfileId, Guid StageId, int DurationDays);
/// <summary>Thêm giai đoạn vào hồ sơ có sẵn. InsertAtOrder trống = thêm vào cuối; có số thì giai đoạn mới nằm ở vị trí đó và các giai đoạn sau lùi một bậc.</summary>
public sealed record AddStageCommand(string Name, int DurationDays, int? InsertAtOrder, string? Description);
public sealed record TransitionStageCommand(Guid GrowthStageId, string? Notes);
public sealed record CloseSeasonCommand(DateOnly ActualEndDate, decimal? ActualYieldKg, string? Notes);
public sealed record RecordSeasonYieldCommand(decimal ActualYieldKg, DateOnly? ActualEndDate, string? Notes, bool MarkCompleted);
public sealed record StageTransitionView(Guid TransitionId, Guid PreviousStageId, Guid CurrentStageId, DateTime ChangedAtUtc, string? Notes);
public sealed record PlantingSeasonView(Guid SeasonId, Guid ZoneId, Guid CropId, string CropName, Guid? VarietyId, string? VarietyName, Guid GrowthProfileId, string GrowthProfileName, Guid CurrentGrowthStageId, string CurrentGrowthStageName, string Name, DateOnly StartDate, DateOnly ExpectedEndDate, DateOnly? ActualEndDate, decimal? ActualYieldKg, PlantingSeasonStatus Status, IReadOnlyList<RequirementView> AppliedRequirements, IReadOnlyList<StageTransitionView> StageTransitions, Guid? FarmingSeasonId = null, string? FarmingSeasonName = null);

public sealed record FarmingSeasonView(Guid Id, string Code, string Name, int Year, DateOnly StartDate, DateOnly EndDate, string? Description, string Status, bool IsActive, int LinkedBatchesCount);
public sealed record CreateFarmingSeasonRequest(string Code, string Name, int Year, DateOnly StartDate, DateOnly EndDate, string? Description, string? Status);
public sealed record UpdateFarmingSeasonRequest(string Code, string Name, int Year, DateOnly StartDate, DateOnly EndDate, string? Description, string? Status);
