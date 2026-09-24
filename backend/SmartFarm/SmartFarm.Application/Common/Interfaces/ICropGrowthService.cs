using SmartFarm.Application.Features.CropGrowth;

namespace SmartFarm.Application.Common.Interfaces;

public interface ICropGrowthService
{
    Task<IReadOnlyList<CropView>> ListCropsAsync(Guid userId, Guid? tenantId, bool? systemDefined, CancellationToken cancellationToken);
    Task<CropView> CreateCropAsync(Guid userId, Guid tenantId, CreateCropCommand command, CancellationToken cancellationToken);
    Task<IReadOnlyList<VarietyView>> ListVarietiesAsync(Guid userId, Guid? tenantId, Guid cropId, CancellationToken cancellationToken);
    Task<VarietyView> CreateVarietyAsync(Guid userId, Guid tenantId, Guid cropId, CreateVarietyCommand command, CancellationToken cancellationToken);
    Task<IReadOnlyList<GrowthProfileView>> ListProfilesAsync(Guid userId, Guid? tenantId, Guid cropId, Guid? varietyId, CancellationToken cancellationToken);
    Task<GrowthProfileView> CreateProfileAsync(Guid userId, Guid tenantId, CreateGrowthProfileCommand command, CancellationToken cancellationToken);
    Task<GrowthProfileView> GetProfileAsync(Guid userId, Guid? tenantId, Guid profileId, CancellationToken cancellationToken);
    Task<RequirementUpdateView> UpdateRequirementsAsync(Guid userId, Guid tenantId, Guid stageId, IReadOnlyList<RequirementInput> requirements, CancellationToken cancellationToken);
    Task<IReadOnlyList<PlantingSeasonView>> ListSeasonsAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
    Task<PlantingSeasonView> CreateSeasonAsync(Guid userId, Guid tenantId, Guid zoneId, CreatePlantingSeasonCommand command, CancellationToken cancellationToken);
    Task<PlantingSeasonView> GetSeasonAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, CancellationToken cancellationToken);
    Task<PlantingSeasonView> TransitionStageAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, TransitionStageCommand command, CancellationToken cancellationToken);
    Task<PlantingSeasonView> CloseSeasonAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, CloseSeasonCommand command, CancellationToken cancellationToken);
}
