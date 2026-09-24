using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.CropGrowth;

public sealed record CreateCropCommand(string Name, string ScientificName, string? Description);
public sealed record CropView(Guid CropId, string Name, string ScientificName, string? Description, bool IsSystemDefined, Guid? TenantId);
public sealed record CreateVarietyCommand(string Name, string? Description);
public sealed record VarietyView(Guid VarietyId, Guid CropId, string Name, string? Description, bool IsSystemDefined, Guid? TenantId);

public sealed record RequirementInput(EnvironmentalParameterCode ParameterCode, decimal MinValue, decimal MaxValue, decimal TargetValue, string Unit);
public sealed record StageInput(string Name, int StageOrder, int DurationDays, IReadOnlyList<RequirementInput> Requirements);
public sealed record CreateGrowthProfileCommand(Guid CropId, Guid? VarietyId, string Name, string? Description, bool IsDefault, Guid? SourceProfileId, IReadOnlyList<StageInput>? Stages);
public sealed record RequirementView(EnvironmentalParameterCode ParameterCode, decimal MinValue, decimal MaxValue, decimal TargetValue, string Unit);
public sealed record GrowthStageView(Guid StageId, string Name, int StageOrder, int DurationDays, IReadOnlyList<RequirementView> Requirements);
public sealed record GrowthProfileView(Guid ProfileId, Guid CropId, Guid? VarietyId, string Name, string? Description, bool IsDefault, bool IsSystemDefined, Guid? TenantId, Guid? SourceProfileId, IReadOnlyList<GrowthStageView> Stages);
public sealed record RequirementUpdateView(Guid EffectiveProfileId, Guid EffectiveStageId, bool ClonedFromSystem, IReadOnlyList<RequirementView> Requirements);

public sealed record CreatePlantingSeasonCommand(Guid CropId, Guid? VarietyId, Guid GrowthProfileId, string Name, DateOnly StartDate, DateOnly ExpectedEndDate);
public sealed record TransitionStageCommand(Guid GrowthStageId, string? Notes);
public sealed record CloseSeasonCommand(DateOnly ActualEndDate, decimal? ActualYieldKg, string? Notes);
public sealed record StageTransitionView(Guid TransitionId, Guid PreviousStageId, Guid CurrentStageId, DateTime ChangedAtUtc, string? Notes);
public sealed record PlantingSeasonView(Guid SeasonId, Guid ZoneId, Guid CropId, Guid? VarietyId, Guid GrowthProfileId, Guid CurrentGrowthStageId, string Name, DateOnly StartDate, DateOnly ExpectedEndDate, DateOnly? ActualEndDate, decimal? ActualYieldKg, PlantingSeasonStatus Status, IReadOnlyList<RequirementView> AppliedRequirements, IReadOnlyList<StageTransitionView> StageTransitions);
