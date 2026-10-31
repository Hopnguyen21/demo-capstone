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

public sealed record CreatePlantingSeasonCommand(Guid CropId, Guid? VarietyId, Guid GrowthProfileId, string Name, DateOnly StartDate, DateOnly ExpectedEndDate, Guid? FarmingSeasonId = null, bool SetZoneCrop = false);
/// <summary>Một Zone trong thao tác tạo vụ hàng loạt; ngày để trống thì dùng ngày chung. SetZoneCrop là xác nhận riêng của Owner cho Zone này.</summary>
public sealed record BulkSeasonZoneItem(Guid ZoneId, DateOnly? StartDate, DateOnly? ExpectedEndDate, bool SetZoneCrop);
public sealed record BulkCreateSeasonsCommand(
    Guid FarmingSeasonId, Guid CropId, Guid? VarietyId, Guid GrowthProfileId, string NamePrefix, DateOnly StartDate, DateOnly ExpectedEndDate,
    IReadOnlyList<BulkSeasonZoneItem> Zones, bool DryRun, bool SkipInvalid);
public sealed record BulkSeasonZoneResult(Guid ZoneId, string? ZoneName, bool Valid, IReadOnlyList<string> Problems, Guid? PlantingSeasonId);
public sealed record BulkCreateSeasonsResult(bool Created, bool DryRun, int ValidCount, int InvalidCount, IReadOnlyList<BulkSeasonZoneResult> Zones);
public sealed record StageDurationView(Guid ProfileId, Guid StageId, int DurationDays);
public sealed record TransitionStageCommand(Guid GrowthStageId, string? Notes);
public sealed record CloseSeasonCommand(DateOnly ActualEndDate, decimal? ActualYieldKg, string? Notes);
public sealed record RecordSeasonYieldCommand(decimal ActualYieldKg, DateOnly? ActualEndDate, string? Notes, bool MarkCompleted);
public sealed record StageTransitionView(Guid TransitionId, Guid PreviousStageId, Guid CurrentStageId, DateTime ChangedAtUtc, string? Notes);
public sealed record PlantingSeasonView(Guid SeasonId, Guid ZoneId, Guid CropId, string CropName, Guid? VarietyId, string? VarietyName, Guid GrowthProfileId, string GrowthProfileName, Guid CurrentGrowthStageId, string CurrentGrowthStageName, string Name, DateOnly StartDate, DateOnly ExpectedEndDate, DateOnly? ActualEndDate, decimal? ActualYieldKg, PlantingSeasonStatus Status, IReadOnlyList<RequirementView> AppliedRequirements, IReadOnlyList<StageTransitionView> StageTransitions, Guid? FarmingSeasonId = null, string? FarmingSeasonName = null);

public sealed record FarmingSeasonView(Guid Id, string Code, string Name, int Year, DateOnly StartDate, DateOnly EndDate, string? Description, string Status, bool IsActive, int LinkedBatchesCount);
public sealed record CreateFarmingSeasonRequest(string Code, string Name, int Year, DateOnly StartDate, DateOnly EndDate, string? Description, string? Status);
public sealed record UpdateFarmingSeasonRequest(string Code, string Name, int Year, DateOnly StartDate, DateOnly EndDate, string? Description, string? Status);
