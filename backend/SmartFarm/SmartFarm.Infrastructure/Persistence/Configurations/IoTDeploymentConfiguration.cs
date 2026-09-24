using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal static class IoTSeed
{
    internal static readonly Guid EnvironmentalNodeModelId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    internal static readonly DateTime SeededAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
}

internal sealed class DeviceModelDefinitionConfiguration : IEntityTypeConfiguration<DeviceModelDefinition>
{
    public void Configure(EntityTypeBuilder<DeviceModelDefinition> b)
    {
        b.ToTable("device_model_definitions", t => t.HasCheckConstraint("ck_device_models_coverage", "coverage_area_m2 > 0")); b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id"); b.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired(); b.Property(x => x.DeviceType).HasColumnName("device_type").HasConversion<string>().HasMaxLength(30); b.Property(x => x.CoverageAreaM2).HasColumnName("coverage_area_m2").HasPrecision(18, 2); b.Property(x => x.IsActive).HasColumnName("is_active"); b.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc"); b.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        b.HasIndex(x => x.Name).IsUnique(); b.HasData(new { Id = IoTSeed.EnvironmentalNodeModelId, Name = "Environmental Sensor Node 4-in-1", DeviceType = DeviceType.SensorNode, CoverageAreaM2 = 250m, IsActive = true, CreatedAtUtc = IoTSeed.SeededAt });
    }
}

internal sealed class DeviceModelCapabilityConfiguration : IEntityTypeConfiguration<DeviceModelCapability>
{
    public void Configure(EntityTypeBuilder<DeviceModelCapability> b)
    {
        b.ToTable("device_model_capabilities"); b.HasKey(x => new { x.DeviceModelDefinitionId, x.ParameterCode }); b.Property(x => x.DeviceModelDefinitionId).HasColumnName("device_model_definition_id"); b.Property(x => x.ParameterCode).HasColumnName("parameter_code").HasConversion<string>().HasMaxLength(30); b.HasOne(x => x.DeviceModelDefinition).WithMany(x => x.Capabilities).HasForeignKey(x => x.DeviceModelDefinitionId).OnDelete(DeleteBehavior.Cascade);
        b.HasData(Enum.GetValues<EnvironmentalParameterCode>().Select(x => new { DeviceModelDefinitionId = IoTSeed.EnvironmentalNodeModelId, ParameterCode = x }).ToArray());
    }
}

internal sealed class DeploymentRequestConfiguration : IEntityTypeConfiguration<DeploymentRequest>
{
    public void Configure(EntityTypeBuilder<DeploymentRequest> b)
    {
        b.ToTable("deployment_requests"); b.HasKey(x => x.Id); IdAudit(b); b.Property(x => x.TenantId).HasColumnName("tenant_id"); b.Property(x => x.FarmId).HasColumnName("farm_id"); b.Property(x => x.ZoneId).HasColumnName("zone_id"); b.Property(x => x.PlantingSeasonId).HasColumnName("planting_season_id"); b.Property(x => x.OwnerUserId).HasColumnName("owner_user_id"); b.Property(x => x.TechnicianUserId).HasColumnName("technician_user_id"); b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30); b.Property(x => x.RequiredParametersCsv).HasColumnName("required_parameters_csv").HasMaxLength(500); b.Property(x => x.OwnerNotes).HasColumnName("owner_notes").HasMaxLength(1000); b.Property(x => x.FailureCode).HasColumnName("failure_code").HasMaxLength(100); b.Property(x => x.FailureDescription).HasColumnName("failure_description").HasMaxLength(2000); b.Property(x => x.SubmittedAtUtc).HasColumnName("submitted_at_utc"); b.Property(x => x.CompletedAtUtc).HasColumnName("completed_at_utc");
        b.HasIndex(x => x.ZoneId).IsUnique().HasFilter("status IN ('Submitted','Accepted','Surveyed','PlanConfirmed','Installing')");
        b.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.PlantingSeason).WithMany().HasForeignKey(x => x.PlantingSeasonId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.OwnerUser).WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.TechnicianUser).WithMany().HasForeignKey(x => x.TechnicianUserId).OnDelete(DeleteBehavior.Restrict);
    }
    internal static void IdAudit<T>(EntityTypeBuilder<T> b) where T : SmartFarm.Domain.Common.AuditableEntity { b.Property(x => x.Id).HasColumnName("id"); b.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc"); b.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc"); }
}

internal sealed class DeploymentPlanItemConfiguration : IEntityTypeConfiguration<DeploymentPlanItem>
{
    public void Configure(EntityTypeBuilder<DeploymentPlanItem> b) { b.ToTable("deployment_plan_items", t => t.HasCheckConstraint("ck_deployment_plan_quantity", "quantity > 0")); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeploymentRequestId).HasColumnName("deployment_request_id"); b.Property(x => x.DeviceModelDefinitionId).HasColumnName("device_model_definition_id"); b.Property(x => x.Quantity).HasColumnName("quantity"); b.Property(x => x.InstallationNotes).HasColumnName("installation_notes").HasMaxLength(1000); b.HasIndex(x => new { x.DeploymentRequestId, x.DeviceModelDefinitionId }).IsUnique(); b.HasOne(x => x.DeploymentRequest).WithMany(x => x.PlanItems).HasForeignKey(x => x.DeploymentRequestId).OnDelete(DeleteBehavior.Cascade); b.HasOne(x => x.DeviceModelDefinition).WithMany().HasForeignKey(x => x.DeviceModelDefinitionId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class DeploymentSurveyConfiguration : IEntityTypeConfiguration<DeploymentSurvey>
{
    public void Configure(EntityTypeBuilder<DeploymentSurvey> b) { b.ToTable("deployment_surveys"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeploymentRequestId).HasColumnName("deployment_request_id"); b.Property(x => x.TechnicianUserId).HasColumnName("technician_user_id"); b.Property(x => x.IsFeasible).HasColumnName("is_feasible"); b.Property(x => x.SiteConditions).HasColumnName("site_conditions").HasMaxLength(2000); b.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(2000); b.HasOne(x => x.DeploymentRequest).WithMany(x => x.Surveys).HasForeignKey(x => x.DeploymentRequestId).OnDelete(DeleteBehavior.Cascade); b.HasOne(x => x.TechnicianUser).WithMany().HasForeignKey(x => x.TechnicianUserId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class DeploymentDecisionHistoryConfiguration : IEntityTypeConfiguration<DeploymentDecisionHistory>
{
    public void Configure(EntityTypeBuilder<DeploymentDecisionHistory> b) { b.ToTable("deployment_decision_history"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeploymentRequestId).HasColumnName("deployment_request_id"); b.Property(x => x.ActorUserId).HasColumnName("actor_user_id"); b.Property(x => x.DecisionType).HasColumnName("decision_type").HasMaxLength(80); b.Property(x => x.FromStatus).HasColumnName("from_status").HasMaxLength(30); b.Property(x => x.ToStatus).HasColumnName("to_status").HasMaxLength(30); b.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(2000); b.HasOne(x => x.DeploymentRequest).WithMany(x => x.Decisions).HasForeignKey(x => x.DeploymentRequestId).OnDelete(DeleteBehavior.Cascade); b.HasOne(x => x.ActorUser).WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class GatewayConfiguration : IEntityTypeConfiguration<Gateway>
{
    public void Configure(EntityTypeBuilder<Gateway> b) { b.ToTable("gateways"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.FarmId).HasColumnName("farm_id"); b.Property(x => x.DeploymentRequestId).HasColumnName("deployment_request_id"); b.Property(x => x.MacAddress).HasColumnName("mac_address").HasMaxLength(17); b.Property(x => x.GatewaySerial).HasColumnName("gateway_serial").HasMaxLength(100); b.Property(x => x.FrequencyBand).HasColumnName("frequency_band").HasMaxLength(30); b.Property(x => x.FirmwareVersion).HasColumnName("firmware_version").HasMaxLength(50); b.Property(x => x.MqttClientId).HasColumnName("mqtt_client_id").HasMaxLength(150); b.Property(x => x.ClientCertificateFingerprint).HasColumnName("client_certificate_fingerprint").HasMaxLength(128); b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20); b.Property(x => x.LastSeenAtUtc).HasColumnName("last_seen_at_utc"); b.HasIndex(x => x.MacAddress).IsUnique(); b.HasIndex(x => x.GatewaySerial).IsUnique(); b.HasIndex(x => x.MqttClientId).IsUnique(); b.HasIndex(x => x.ClientCertificateFingerprint).IsUnique(); b.HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.DeploymentRequest).WithMany().HasForeignKey(x => x.DeploymentRequestId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class FirmwareJobConfiguration : IEntityTypeConfiguration<FirmwareJob>
{
    public void Configure(EntityTypeBuilder<FirmwareJob> b) { b.ToTable("firmware_jobs"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.GatewayId).HasColumnName("gateway_id"); b.Property(x => x.TargetVersion).HasColumnName("target_version").HasMaxLength(50); b.Property(x => x.FirmwareUrl).HasColumnName("firmware_url").HasMaxLength(1000); b.Property(x => x.ScheduledAtUtc).HasColumnName("scheduled_at_utc"); b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20); b.HasOne(x => x.Gateway).WithMany().HasForeignKey(x => x.GatewayId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class DeviceConfiguration : IEntityTypeConfiguration<Device>
{
    public void Configure(EntityTypeBuilder<Device> b) { b.ToTable("devices"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.FarmId).HasColumnName("farm_id"); b.Property(x => x.GatewayId).HasColumnName("gateway_id"); b.Property(x => x.DeploymentRequestId).HasColumnName("deployment_request_id"); b.Property(x => x.ZoneId).HasColumnName("zone_id"); b.Property(x => x.DeviceModelDefinitionId).HasColumnName("device_model_definition_id"); b.Property(x => x.HardwareAddress).HasColumnName("hardware_address").HasMaxLength(100); b.Property(x => x.DeviceType).HasColumnName("device_type").HasConversion<string>().HasMaxLength(30); b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30); b.Property(x => x.InstallationNotes).HasColumnName("installation_notes").HasMaxLength(1000); b.Property(x => x.GpsLatitude).HasColumnName("gps_latitude").HasPrecision(9, 6); b.Property(x => x.GpsLongitude).HasColumnName("gps_longitude").HasPrecision(9, 6); b.Property(x => x.DecommissionedAtUtc).HasColumnName("decommissioned_at_utc"); b.HasIndex(x => x.HardwareAddress).IsUnique(); b.HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.Gateway).WithMany(x => x.Devices).HasForeignKey(x => x.GatewayId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.DeploymentRequest).WithMany().HasForeignKey(x => x.DeploymentRequestId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.DeviceModelDefinition).WithMany().HasForeignKey(x => x.DeviceModelDefinitionId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class DeviceSensorConfiguration : IEntityTypeConfiguration<DeviceSensor>
{
    public void Configure(EntityTypeBuilder<DeviceSensor> b) { b.ToTable("device_sensors", t => t.HasCheckConstraint("ck_device_sensor_interval", "sampling_interval_sec BETWEEN 10 AND 3600")); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeviceId).HasColumnName("device_id"); b.Property(x => x.SensorType).HasColumnName("sensor_type").HasMaxLength(50); b.Property(x => x.Pin).HasColumnName("pin").HasMaxLength(30); b.Property(x => x.Model).HasColumnName("model").HasMaxLength(100); b.Property(x => x.Interface).HasColumnName("interface").HasMaxLength(30); b.Property(x => x.Unit).HasColumnName("unit").HasMaxLength(30); b.Property(x => x.MinValue).HasColumnName("min_value").HasPrecision(12, 3); b.Property(x => x.MaxValue).HasColumnName("max_value").HasPrecision(12, 3); b.Property(x => x.SamplingIntervalSec).HasColumnName("sampling_interval_sec"); b.HasIndex(x => new { x.DeviceId, x.Pin }).IsUnique(); b.HasOne(x => x.Device).WithMany(x => x.Sensors).HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade); }
}

internal sealed class DeviceActuatorConfiguration : IEntityTypeConfiguration<DeviceActuator>
{
    public void Configure(EntityTypeBuilder<DeviceActuator> b) { b.ToTable("device_actuators", t => { t.HasCheckConstraint("ck_actuator_relay", "relay_channel BETWEEN 1 AND 8"); t.HasCheckConstraint("ck_actuator_duration", "max_duration_minutes BETWEEN 1 AND 30"); }); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeviceId).HasColumnName("device_id"); b.Property(x => x.ActuatorType).HasColumnName("actuator_type").HasMaxLength(50); b.Property(x => x.RelayChannel).HasColumnName("relay_channel"); b.Property(x => x.RatedPowerWatt).HasColumnName("rated_power_watt").HasPrecision(12, 2); b.Property(x => x.MaxDurationMinutes).HasColumnName("max_duration_minutes"); b.HasIndex(x => new { x.DeviceId, x.RelayChannel }).IsUnique(); b.HasOne(x => x.Device).WithMany(x => x.Actuators).HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade); }
}

internal sealed class DeviceAssignmentHistoryConfiguration : IEntityTypeConfiguration<DeviceAssignmentHistory>
{
    public void Configure(EntityTypeBuilder<DeviceAssignmentHistory> b) { b.ToTable("device_assignment_history"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeviceId).HasColumnName("device_id"); b.Property(x => x.ZoneId).HasColumnName("zone_id"); b.Property(x => x.TechnicianUserId).HasColumnName("technician_user_id"); b.Property(x => x.Action).HasColumnName("action").HasMaxLength(30); b.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000); b.HasOne(x => x.Device).WithMany(x => x.AssignmentHistory).HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade); b.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.TechnicianUser).WithMany().HasForeignKey(x => x.TechnicianUserId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class DeviceConnectionTestConfiguration : IEntityTypeConfiguration<DeviceConnectionTest>
{
    public void Configure(EntityTypeBuilder<DeviceConnectionTest> b) { b.ToTable("device_connection_tests"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeviceId).HasColumnName("device_id"); b.Property(x => x.DeploymentRequestId).HasColumnName("deployment_request_id"); b.Property(x => x.TechnicianUserId).HasColumnName("technician_user_id"); b.Property(x => x.Succeeded).HasColumnName("succeeded"); b.Property(x => x.Rssi).HasColumnName("rssi").HasPrecision(8, 2); b.Property(x => x.Snr).HasColumnName("snr").HasPrecision(8, 2); b.Property(x => x.RoundTripLatencyMs).HasColumnName("round_trip_latency_ms"); b.Property(x => x.ObservedAtUtc).HasColumnName("observed_at_utc"); b.Property(x => x.ErrorCode).HasColumnName("error_code").HasMaxLength(100); b.Property(x => x.ErrorMessage).HasColumnName("error_message").HasMaxLength(1000); b.HasOne(x => x.Device).WithMany(x => x.ConnectionTests).HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade); b.HasOne(x => x.DeploymentRequest).WithMany().HasForeignKey(x => x.DeploymentRequestId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.TechnicianUser).WithMany().HasForeignKey(x => x.TechnicianUserId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class DeviceDiagnosticJobConfiguration : IEntityTypeConfiguration<DeviceDiagnosticJob>
{
    public void Configure(EntityTypeBuilder<DeviceDiagnosticJob> b) { b.ToTable("device_diagnostic_jobs"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.DeviceId).HasColumnName("device_id"); b.Property(x => x.TechnicianUserId).HasColumnName("technician_user_id"); b.Property(x => x.Action).HasColumnName("action").HasMaxLength(50); b.Property(x => x.NewFrequencyChannel).HasColumnName("new_frequency_channel").HasPrecision(8, 3); b.Property(x => x.IncreaseTxPowerDbm).HasColumnName("increase_tx_power_dbm"); b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30); b.HasOne(x => x.Device).WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.TechnicianUser).WithMany().HasForeignKey(x => x.TechnicianUserId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class ServiceRequestConfiguration : IEntityTypeConfiguration<ServiceRequest>
{
    public void Configure(EntityTypeBuilder<ServiceRequest> b) { b.ToTable("service_requests"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.TenantId).HasColumnName("tenant_id"); b.Property(x => x.FarmId).HasColumnName("farm_id"); b.Property(x => x.ZoneId).HasColumnName("zone_id"); b.Property(x => x.DeploymentRequestId).HasColumnName("deployment_request_id"); b.Property(x => x.DeviceId).HasColumnName("device_id"); b.Property(x => x.Source).HasColumnName("source").HasMaxLength(50); b.Property(x => x.FailureCode).HasColumnName("failure_code").HasMaxLength(100); b.Property(x => x.Description).HasColumnName("description").HasMaxLength(2000); b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30); b.HasIndex(x => new { x.DeploymentRequestId, x.Status }); b.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.DeploymentRequest).WithMany().HasForeignKey(x => x.DeploymentRequestId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.Device).WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Restrict); }
}
