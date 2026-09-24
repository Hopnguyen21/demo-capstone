using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal static class CropGrowthSeed
{
    internal static readonly Guid CropId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    internal static readonly Guid VarietyId = Guid.Parse("10000000-0000-0000-0000-000000000002");
    internal static readonly Guid ProfileId = Guid.Parse("10000000-0000-0000-0000-000000000003");
    internal static readonly Guid SeedlingStageId = Guid.Parse("10000000-0000-0000-0000-000000000004");
    internal static readonly Guid VegetativeStageId = Guid.Parse("10000000-0000-0000-0000-000000000005");
    internal static readonly DateTime SeededAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
}

internal sealed class CropConfiguration : IEntityTypeConfiguration<Crop>
{
    public void Configure(EntityTypeBuilder<Crop> builder)
    {
        builder.ToTable("crops", table => table.HasCheckConstraint("ck_crops_scope",
            "(is_system_defined = true AND tenant_id IS NULL) OR (is_system_defined = false AND tenant_id IS NOT NULL)"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id");
        builder.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        builder.Property(x => x.NormalizedName).HasColumnName("normalized_name").HasMaxLength(150).IsRequired();
        builder.Property(x => x.ScientificName).HasColumnName("scientific_name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").HasMaxLength(1000);
        builder.Property(x => x.IsSystemDefined).HasColumnName("is_system_defined");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => x.NormalizedName).IsUnique().HasFilter("tenant_id IS NULL");
        builder.HasIndex(x => new { x.TenantId, x.NormalizedName }).IsUnique().HasFilter("tenant_id IS NOT NULL");
        builder.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasData(new
        {
            Id = CropGrowthSeed.CropId, Name = "Tomato", NormalizedName = "TOMATO",
            ScientificName = "Solanum lycopersicum", Description = "System tomato crop",
            IsSystemDefined = true, CreatedAtUtc = CropGrowthSeed.SeededAt
        });
    }
}

internal sealed class CropVarietyConfiguration : IEntityTypeConfiguration<CropVariety>
{
    public void Configure(EntityTypeBuilder<CropVariety> builder)
    {
        builder.ToTable("crop_varieties", table => table.HasCheckConstraint("ck_crop_varieties_scope",
            "(is_system_defined = true AND tenant_id IS NULL) OR (is_system_defined = false AND tenant_id IS NOT NULL)"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CropId).HasColumnName("crop_id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id");
        builder.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        builder.Property(x => x.NormalizedName).HasColumnName("normalized_name").HasMaxLength(150).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").HasMaxLength(1000);
        builder.Property(x => x.IsSystemDefined).HasColumnName("is_system_defined");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => new { x.CropId, x.NormalizedName }).IsUnique().HasFilter("tenant_id IS NULL");
        builder.HasIndex(x => new { x.CropId, x.TenantId, x.NormalizedName }).IsUnique().HasFilter("tenant_id IS NOT NULL");
        builder.HasOne(x => x.Crop).WithMany(x => x.Varieties).HasForeignKey(x => x.CropId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasData(new
        {
            Id = CropGrowthSeed.VarietyId, CropId = CropGrowthSeed.CropId, Name = "Beef F1",
            NormalizedName = "BEEF F1", Description = "System tomato variety",
            IsSystemDefined = true, CreatedAtUtc = CropGrowthSeed.SeededAt
        });
    }
}

internal sealed class GrowthProfileConfiguration : IEntityTypeConfiguration<GrowthProfile>
{
    public void Configure(EntityTypeBuilder<GrowthProfile> builder)
    {
        builder.ToTable("growth_profiles", table => table.HasCheckConstraint("ck_growth_profiles_scope",
            "(is_system_defined = true AND tenant_id IS NULL) OR (is_system_defined = false AND tenant_id IS NOT NULL)"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CropId).HasColumnName("crop_id");
        builder.Property(x => x.VarietyId).HasColumnName("variety_id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id");
        builder.Property(x => x.SourceProfileId).HasColumnName("source_profile_id");
        builder.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.NormalizedName).HasColumnName("normalized_name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").HasMaxLength(1000);
        builder.Property(x => x.IsDefault).HasColumnName("is_default");
        builder.Property(x => x.IsSystemDefined).HasColumnName("is_system_defined");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => new { x.CropId, x.VarietyId, x.TenantId, x.NormalizedName }).IsUnique();
        builder.HasOne(x => x.Crop).WithMany(x => x.GrowthProfiles).HasForeignKey(x => x.CropId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Variety).WithMany(x => x.GrowthProfiles).HasForeignKey(x => x.VarietyId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.SourceProfile).WithMany().HasForeignKey(x => x.SourceProfileId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasData(new
        {
            Id = CropGrowthSeed.ProfileId, CropId = CropGrowthSeed.CropId, VarietyId = (Guid?)CropGrowthSeed.VarietyId,
            Name = "Default Tomato Beef Profile", NormalizedName = "DEFAULT TOMATO BEEF PROFILE",
            Description = "System default profile", IsDefault = true, IsSystemDefined = true,
            CreatedAtUtc = CropGrowthSeed.SeededAt
        });
    }
}

internal sealed class GrowthStageConfiguration : IEntityTypeConfiguration<GrowthStage>
{
    public void Configure(EntityTypeBuilder<GrowthStage> builder)
    {
        builder.ToTable("growth_stages", table =>
        {
            table.HasCheckConstraint("ck_growth_stages_order", "stage_order > 0");
            table.HasCheckConstraint("ck_growth_stages_duration", "duration_days > 0");
        });
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.GrowthProfileId).HasColumnName("growth_profile_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        builder.Property(x => x.StageOrder).HasColumnName("stage_order");
        builder.Property(x => x.DurationDays).HasColumnName("duration_days");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => new { x.GrowthProfileId, x.StageOrder }).IsUnique();
        builder.HasIndex(x => new { x.GrowthProfileId, x.Name }).IsUnique();
        builder.HasOne(x => x.GrowthProfile).WithMany(x => x.Stages).HasForeignKey(x => x.GrowthProfileId).OnDelete(DeleteBehavior.Cascade);
        builder.HasData(
            new { Id = CropGrowthSeed.SeedlingStageId, GrowthProfileId = CropGrowthSeed.ProfileId, Name = "Seedling", StageOrder = 1, DurationDays = 20, CreatedAtUtc = CropGrowthSeed.SeededAt },
            new { Id = CropGrowthSeed.VegetativeStageId, GrowthProfileId = CropGrowthSeed.ProfileId, Name = "Vegetative", StageOrder = 2, DurationDays = 30, CreatedAtUtc = CropGrowthSeed.SeededAt });
    }
}

internal sealed class EnvironmentalRequirementConfiguration : IEntityTypeConfiguration<EnvironmentalRequirement>
{
    public void Configure(EntityTypeBuilder<EnvironmentalRequirement> builder)
    {
        builder.ToTable("environmental_requirements", table => table.HasCheckConstraint(
            "ck_environmental_requirement_range", "min_value <= target_value AND target_value <= max_value"));
        builder.HasKey(x => new { x.GrowthStageId, x.ParameterCode });
        builder.Property(x => x.GrowthStageId).HasColumnName("growth_stage_id");
        builder.Property(x => x.ParameterCode).HasColumnName("parameter_code").HasConversion<string>().HasMaxLength(30);
        builder.Property(x => x.MinValue).HasColumnName("min_value").HasPrecision(12, 3);
        builder.Property(x => x.MaxValue).HasColumnName("max_value").HasPrecision(12, 3);
        builder.Property(x => x.TargetValue).HasColumnName("target_value").HasPrecision(12, 3);
        builder.Property(x => x.Unit).HasColumnName("unit").HasMaxLength(30).IsRequired();
        builder.HasOne(x => x.GrowthStage).WithMany(x => x.Requirements).HasForeignKey(x => x.GrowthStageId).OnDelete(DeleteBehavior.Cascade);
        builder.HasData(DefaultRequirements(CropGrowthSeed.SeedlingStageId, 20, 28, 24, 65, 80, 72, 60, 75, 70, 5.5m, 6.5m, 6)
            .Concat(DefaultRequirements(CropGrowthSeed.VegetativeStageId, 21, 30, 25, 60, 78, 70, 55, 75, 65, 5.5m, 6.8m, 6.2m)).ToArray());
    }

    private static object[] DefaultRequirements(Guid stageId,
        decimal tempMin, decimal tempMax, decimal tempTarget,
        decimal soilMin, decimal soilMax, decimal soilTarget,
        decimal airMin, decimal airMax, decimal airTarget,
        decimal phMin, decimal phMax, decimal phTarget) =>
    [
        Row(stageId, EnvironmentalParameterCode.Temperature, tempMin, tempMax, tempTarget, "C"),
        Row(stageId, EnvironmentalParameterCode.SoilMoisture, soilMin, soilMax, soilTarget, "%"),
        Row(stageId, EnvironmentalParameterCode.AirHumidity, airMin, airMax, airTarget, "%"),
        Row(stageId, EnvironmentalParameterCode.Ph, phMin, phMax, phTarget, "pH")
    ];

    private static object Row(Guid stageId, EnvironmentalParameterCode code, decimal min, decimal max, decimal target, string unit) =>
        new { GrowthStageId = stageId, ParameterCode = code, MinValue = min, MaxValue = max, TargetValue = target, Unit = unit };
}

internal sealed class PlantingSeasonConfiguration : IEntityTypeConfiguration<PlantingSeason>
{
    public void Configure(EntityTypeBuilder<PlantingSeason> builder)
    {
        builder.ToTable("planting_seasons", table =>
        {
            table.HasCheckConstraint("ck_planting_seasons_dates", "expected_end_date >= start_date + 20");
            table.HasCheckConstraint("ck_planting_seasons_yield", "actual_yield_kg IS NULL OR actual_yield_kg >= 0");
        });
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.ZoneId).HasColumnName("zone_id");
        builder.Property(x => x.CropId).HasColumnName("crop_id");
        builder.Property(x => x.VarietyId).HasColumnName("variety_id");
        builder.Property(x => x.GrowthProfileId).HasColumnName("growth_profile_id");
        builder.Property(x => x.CurrentGrowthStageId).HasColumnName("current_growth_stage_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.StartDate).HasColumnName("start_date");
        builder.Property(x => x.ExpectedEndDate).HasColumnName("expected_end_date");
        builder.Property(x => x.ActualEndDate).HasColumnName("actual_end_date");
        builder.Property(x => x.ActualYieldKg).HasColumnName("actual_yield_kg").HasPrecision(18, 2);
        builder.Property(x => x.CloseNotes).HasColumnName("close_notes").HasMaxLength(1000);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => x.ZoneId).IsUnique().HasFilter("status = 'InProgress'");
        builder.HasOne(x => x.Zone).WithMany(x => x.PlantingSeasons).HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Crop).WithMany().HasForeignKey(x => x.CropId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Variety).WithMany().HasForeignKey(x => x.VarietyId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.GrowthProfile).WithMany().HasForeignKey(x => x.GrowthProfileId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CurrentGrowthStage).WithMany().HasForeignKey(x => x.CurrentGrowthStageId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class SeasonAppliedRequirementConfiguration : IEntityTypeConfiguration<SeasonAppliedRequirement>
{
    public void Configure(EntityTypeBuilder<SeasonAppliedRequirement> builder)
    {
        builder.ToTable("season_applied_requirements", table => table.HasCheckConstraint(
            "ck_season_applied_requirement_range", "min_value <= target_value AND target_value <= max_value"));
        builder.HasKey(x => new { x.PlantingSeasonId, x.ParameterCode });
        builder.Property(x => x.PlantingSeasonId).HasColumnName("planting_season_id");
        builder.Property(x => x.ParameterCode).HasColumnName("parameter_code").HasConversion<string>().HasMaxLength(30);
        builder.Property(x => x.MinValue).HasColumnName("min_value").HasPrecision(12, 3);
        builder.Property(x => x.MaxValue).HasColumnName("max_value").HasPrecision(12, 3);
        builder.Property(x => x.TargetValue).HasColumnName("target_value").HasPrecision(12, 3);
        builder.Property(x => x.Unit).HasColumnName("unit").HasMaxLength(30).IsRequired();
        builder.HasOne(x => x.PlantingSeason).WithMany(x => x.AppliedRequirements).HasForeignKey(x => x.PlantingSeasonId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SeasonStageTransitionConfiguration : IEntityTypeConfiguration<SeasonStageTransition>
{
    public void Configure(EntityTypeBuilder<SeasonStageTransition> builder)
    {
        builder.ToTable("season_stage_transitions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.PlantingSeasonId).HasColumnName("planting_season_id");
        builder.Property(x => x.PreviousGrowthStageId).HasColumnName("previous_growth_stage_id");
        builder.Property(x => x.CurrentGrowthStageId).HasColumnName("current_growth_stage_id");
        builder.Property(x => x.ChangedByUserId).HasColumnName("changed_by_user_id");
        builder.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000);
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasOne(x => x.PlantingSeason).WithMany(x => x.StageTransitions).HasForeignKey(x => x.PlantingSeasonId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.PreviousGrowthStage).WithMany().HasForeignKey(x => x.PreviousGrowthStageId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CurrentGrowthStage).WithMany().HasForeignKey(x => x.CurrentGrowthStageId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.ChangedByUser).WithMany().HasForeignKey(x => x.ChangedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
