using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Common;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence;

public sealed class SmartFarmDbContext(DbContextOptions<SmartFarmDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<Farm> Farms => Set<Farm>();
    public DbSet<Field> Fields => Set<Field>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<UserZoneAccess> UserZoneAccesses => Set<UserZoneAccess>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Crop> Crops => Set<Crop>();
    public DbSet<CropVariety> CropVarieties => Set<CropVariety>();
    public DbSet<GrowthProfile> GrowthProfiles => Set<GrowthProfile>();
    public DbSet<GrowthStage> GrowthStages => Set<GrowthStage>();
    public DbSet<EnvironmentalRequirement> EnvironmentalRequirements => Set<EnvironmentalRequirement>();
    public DbSet<PlantingSeason> PlantingSeasons => Set<PlantingSeason>();
    public DbSet<SeasonAppliedRequirement> SeasonAppliedRequirements => Set<SeasonAppliedRequirement>();
    public DbSet<SeasonStageTransition> SeasonStageTransitions => Set<SeasonStageTransition>();
    public DbSet<DeviceModelDefinition> DeviceModelDefinitions => Set<DeviceModelDefinition>();
    public DbSet<DeviceModelCapability> DeviceModelCapabilities => Set<DeviceModelCapability>();
    public DbSet<DeploymentRequest> DeploymentRequests => Set<DeploymentRequest>();
    public DbSet<DeploymentPlanItem> DeploymentPlanItems => Set<DeploymentPlanItem>();
    public DbSet<DeploymentSurvey> DeploymentSurveys => Set<DeploymentSurvey>();
    public DbSet<DeploymentDecisionHistory> DeploymentDecisionHistory => Set<DeploymentDecisionHistory>();
    public DbSet<Gateway> Gateways => Set<Gateway>();
    public DbSet<FirmwareJob> FirmwareJobs => Set<FirmwareJob>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<DeviceSensor> DeviceSensors => Set<DeviceSensor>();
    public DbSet<DeviceActuator> DeviceActuators => Set<DeviceActuator>();
    public DbSet<DeviceAssignmentHistory> DeviceAssignmentHistory => Set<DeviceAssignmentHistory>();
    public DbSet<DeviceConnectionTest> DeviceConnectionTests => Set<DeviceConnectionTest>();
    public DbSet<DeviceDiagnosticJob> DeviceDiagnosticJobs => Set<DeviceDiagnosticJob>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<TelemetryReading> TelemetryReadings => Set<TelemetryReading>();
    public DbSet<AlertRule> AlertRules => Set<AlertRule>();
    public DbSet<AlertRuleEvaluationState> AlertRuleEvaluationStates => Set<AlertRuleEvaluationState>();
    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<AlertHistoryEvent> AlertHistoryEvents => Set<AlertHistoryEvent>();
    public DbSet<ControlSchedule> ControlSchedules => Set<ControlSchedule>();
    public DbSet<AutoControlRule> AutoControlRules => Set<AutoControlRule>();
    public DbSet<ActuatorCommand> ActuatorCommands => Set<ActuatorCommand>();
    public DbSet<ActuatorCommandEvent> ActuatorCommandEvents => Set<ActuatorCommandEvent>();
    public DbSet<AiConsultationRequest> AiConsultationRequests => Set<AiConsultationRequest>();
    public DbSet<AiRecommendation> AiRecommendations => Set<AiRecommendation>();
    public DbSet<AiRecommendationDecision> AiRecommendationDecisions => Set<AiRecommendationDecision>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<MaterialRequirementLink> MaterialRequirementLinks => Set<MaterialRequirementLink>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<LowStockAlert> LowStockAlerts => Set<LowStockAlert>();
    public DbSet<FarmTask> FarmTasks => Set<FarmTask>();
    public DbSet<FarmTaskHistory> FarmTaskHistory => Set<FarmTaskHistory>();
    public DbSet<FinanceTransaction> FinanceTransactions => Set<FinanceTransaction>();
    public DbSet<ServiceRequestHistory> ServiceRequestHistories => Set<ServiceRequestHistory>();
    public DbSet<DeviceReplacement> DeviceReplacements => Set<DeviceReplacement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SmartFarmDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAtUtc = now;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
