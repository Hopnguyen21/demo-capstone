using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;

namespace SmartFarm.Infrastructure.IoTDeployment;

internal sealed partial class IoTDeploymentService(SmartFarmDbContext db, IConfiguration configuration, HttpClient httpClient) : IIoTDeploymentService
{
    private static readonly DeploymentRequestStatus[] ActiveStatuses = [DeploymentRequestStatus.Submitted, DeploymentRequestStatus.Accepted, DeploymentRequestStatus.Surveyed, DeploymentRequestStatus.PlanConfirmed, DeploymentRequestStatus.Installing];

    public async Task<IReadOnlyList<DeviceRecommendationView>> ListPlanModelsAsync(Guid technicianId, Guid requestId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var request = await TechnicianRequestAsync(technicianId, requestId, ct);
        return await db.DeviceModelDefinitions.AsNoTracking()
            .Where(x => request.PlanItems.Select(p => p.DeviceModelDefinitionId).Contains(x.Id))
            .Select(x => new DeviceRecommendationView(x.Id, x.Name, x.DeviceType, x.CoverageAreaM2,
                request.PlanItems.Where(p => p.DeviceModelDefinitionId == x.Id).Select(p => p.Quantity).FirstOrDefault(),
                x.Capabilities.Select(c => c.ParameterCode).ToList()))
            .ToListAsync(ct);
    }

    public async Task<DeploymentRequestView> SubmitWithEstimateAsync(Guid ownerId, Guid tenantId, Guid zoneId, SubmitDeploymentRequestCommand command, CancellationToken ct)
    {
        var request = await CreateRequestAsync(ownerId, tenantId, zoneId,
            new CreateDeploymentRequestCommand([], command.OwnerNotes), ct);
        var entity = await LoadRequestEntityAsync(request.RequestId, ct);
        var items = await EstimateItemBuilder.BuildAsync(db, command.EstimateItems, ct);
        foreach (var item in items) entity.EstimateItems.Add(item);
        if (entity.PlanItems.Count == 0) throw new ResourceConflictException("A deployment plan is required before submission.");
        Transition(entity, ownerId, "Submitted", DeploymentRequestStatus.Submitted, command.OwnerNotes);
        entity.SubmittedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return await LoadRequestAsync(entity.Id, ct);
    }

    public async Task<DeploymentRequestView> CancelAsync(Guid ownerId, Guid tenantId, Guid requestId, string? reason, CancellationToken ct)
    {
        await EnsureOwnerAsync(ownerId, tenantId, ct);
        var request = await OwnerRequestAsync(ownerId, tenantId, requestId, ct);
        if (request.Status is DeploymentRequestStatus.Completed or DeploymentRequestStatus.MaintenanceRequired)
            throw new ResourceConflictException("A terminal deployment request cannot be cancelled.");
        Transition(request, ownerId, "Cancelled", DeploymentRequestStatus.Cancelled, reason);
        request.FailureCode = "OWNER_CANCELLED";
        request.FailureDescription = Optional(reason, 2000);
        await db.SaveChangesAsync(ct);
        return await LoadRequestAsync(request.Id, ct);
    }

    public async Task<IoTRequirementsView> GetRequirementsAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        await EnsureOwnerAsync(ownerId, tenantId, ct);
        var season = await db.PlantingSeasons.AsNoTracking().Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm).Include(x => x.AppliedRequirements).SingleOrDefaultAsync(x => x.ZoneId == zoneId && x.Status == PlantingSeasonStatus.InProgress && x.Zone.Field.Farm.TenantId == tenantId, ct) ?? throw new ResourceNotFoundException("Zone has no InProgress Planting Season in the current Tenant.");
        return new(zoneId, season.Id, season.CurrentGrowthStageId, season.Zone.AreaM2, season.AppliedRequirements.Select(x => x.ParameterCode).Distinct().Order().ToList());
    }

    public async Task<IReadOnlyList<DeviceRecommendationView>> RecommendAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        var requirements = await GetRequirementsAsync(ownerId, tenantId, zoneId, ct);
        var models = await db.DeviceModelDefinitions.AsNoTracking().Include(x => x.Capabilities).Where(x => x.IsActive).ToListAsync(ct);
        var compatible = models.Where(x => requirements.Parameters.All(p => x.Capabilities.Any(c => c.ParameterCode == p))).ToList();
        if (compatible.Count == 0) throw new ResourceConflictException("No active Device Model covers every required environmental parameter.");
        return compatible.Select(x => new DeviceRecommendationView(x.Id, x.Name, x.DeviceType, x.CoverageAreaM2, Math.Max(1, (int)Math.Ceiling(requirements.ZoneAreaM2 / x.CoverageAreaM2)), x.Capabilities.Select(c => c.ParameterCode).Order().ToList())).ToList();
    }

    public async Task<DeploymentRequestView> CreateRequestAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateDeploymentRequestCommand command, CancellationToken ct)
    {
        var reqs = await GetRequirementsAsync(ownerId, tenantId, zoneId, ct); ValidatePlan(command.Items);
        var zone = await db.Zones.Include(x => x.Field).ThenInclude(x => x.Farm).SingleAsync(x => x.Id == zoneId, ct);
        await ValidateModelsCoverAsync(command.Items, reqs.Parameters, ct);
        var request = new DeploymentRequest { TenantId = tenantId, FarmId = zone.Field.FarmId, ZoneId = zoneId, PlantingSeasonId = reqs.PlantingSeasonId, OwnerUserId = ownerId, Status = DeploymentRequestStatus.Draft, RequiredParametersCsv = string.Join(',', reqs.Parameters), OwnerNotes = Optional(command.Notes, 1000) };
        AddPlan(request, command.Items); db.DeploymentRequests.Add(request); AddDecision(request, ownerId, "DraftCreated", request.Status, request.Status, command.Notes); await db.SaveChangesAsync(ct); return await LoadRequestAsync(request.Id, ct);
    }

    public async Task<DeploymentRequestView> UpdateOwnerPlanAsync(Guid ownerId, Guid tenantId, Guid requestId, IReadOnlyList<PlanItemInput> items, CancellationToken ct)
    {
        await EnsureOwnerAsync(ownerId, tenantId, ct); ValidatePlan(items); var request = await OwnerRequestAsync(ownerId, tenantId, requestId, ct); EnsureStatus(request, DeploymentRequestStatus.Draft); await ValidateModelsCoverAsync(items, Parse(request.RequiredParametersCsv), ct); ReplacePlan(request, items); AddDecision(request, ownerId, "OwnerPlanAdjusted", request.Status, request.Status, null); await db.SaveChangesAsync(ct); return await LoadRequestAsync(request.Id, ct);
    }

    public async Task<DeploymentRequestView> SubmitAsync(Guid ownerId, Guid tenantId, Guid requestId, CancellationToken ct)
    {
        await EnsureOwnerAsync(ownerId, tenantId, ct); var request = await OwnerRequestAsync(ownerId, tenantId, requestId, ct); EnsureStatus(request, DeploymentRequestStatus.Draft); if (request.PlanItems.Count == 0) throw new ResourceConflictException("A Deployment Request requires at least one plan item.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct); if (await db.DeploymentRequests.AnyAsync(x => x.ZoneId == request.ZoneId && x.Id != request.Id && ActiveStatuses.Contains(x.Status), ct)) throw new ResourceConflictException("Zone already has a non-terminal Deployment Request."); Transition(request, ownerId, "Submitted", DeploymentRequestStatus.Submitted, request.OwnerNotes); request.SubmittedAtUtc = DateTime.UtcNow; await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return await LoadRequestAsync(request.Id, ct);
    }

    public async Task<DeploymentRequestView> GetRequestAsync(Guid userId, Guid? tenantId, Guid requestId, CancellationToken ct)
    {
        var user = await UserAsync(userId, ct); var request = await LoadRequestEntityAsync(requestId, ct);
        if (user.Role == UserRole.FarmOwner && (tenantId != request.TenantId || user.TenantId != request.TenantId)) throw new ResourceNotFoundException("Deployment Request was not found in the current Tenant.");
        if (user.Role == UserRole.PlatformTechnician && request.TechnicianUserId != userId) throw new ResourceNotFoundException("Deployment Request is not assigned to this Technician.");
        if (user.Role is not (UserRole.FarmOwner or UserRole.PlatformTechnician)) throw new AuthorizationException(); return request.ToView();
    }

    public async Task<IReadOnlyList<DeploymentRequestView>> ListOwnerRequestsAsync(Guid ownerId, Guid tenantId, Guid? zoneId, CancellationToken ct)
    {
        var user = await UserAsync(ownerId, ct);
        if (user.Role != UserRole.FarmOwner || user.TenantId != tenantId) throw new AuthorizationException();
        var query = RequestQuery().AsNoTracking().Where(x => x.TenantId == tenantId);
        if (zoneId.HasValue) query = query.Where(x => x.ZoneId == zoneId.Value);
        return (await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)).Select(x => x.ToView()).ToList();
    }

    public async Task<IReadOnlyList<DeploymentRequestView>> ListTechnicianRequestsAsync(Guid technicianId, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); return (await RequestQuery().AsNoTracking().Where(x => x.TechnicianUserId == technicianId || db.ServiceRequests.Any(s => s.DeploymentRequestId == x.Id && s.AssignedTechnicianId == technicianId)).OrderByDescending(x => x.SubmittedAtUtc).ToListAsync(ct)).Select(x => x.ToView() with { TechnicianUserId = technicianId }).ToList(); }
    public async Task<DeploymentRequestView> AcceptAsync(Guid technicianId, Guid requestId, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct); var r = await LoadRequestEntityAsync(requestId, ct); EnsureStatus(r, DeploymentRequestStatus.Submitted); if (r.TechnicianUserId.HasValue) throw new ResourceConflictException("Deployment Request was already accepted."); r.TechnicianUserId = technicianId; Transition(r, technicianId, "Accepted", DeploymentRequestStatus.Accepted, null); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return await LoadRequestAsync(r.Id, ct); }
    public async Task<DeploymentRequestView> SurveyAsync(Guid technicianId, Guid requestId, SurveyCommand command, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var r = await TechnicianRequestAsync(technicianId, requestId, ct); if (r.Status is not (DeploymentRequestStatus.Accepted or DeploymentRequestStatus.Surveyed)) throw new ResourceConflictException("Survey requires an Accepted request."); var survey = new DeploymentSurvey { DeploymentRequestId = r.Id, TechnicianUserId = technicianId, IsFeasible = command.IsFeasible, SiteConditions = Required(command.SiteConditions, "siteConditions", 2000), Notes = Required(command.Notes, "notes", 2000) }; db.DeploymentSurveys.Add(survey); Transition(r, technicianId, command.IsFeasible ? "SurveyFeasible" : "SurveyInfeasible", DeploymentRequestStatus.Surveyed, command.Notes); await db.SaveChangesAsync(ct); return await LoadRequestAsync(r.Id, ct); }
    public async Task<DeploymentRequestView> UpdateTechnicianPlanAsync(Guid technicianId, Guid requestId, IReadOnlyList<PlanItemInput> items, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); ValidatePlan(items); var r = await TechnicianRequestAsync(technicianId, requestId, ct); EnsureStatus(r, DeploymentRequestStatus.Surveyed); await ValidateModelsCoverAsync(items, Parse(r.RequiredParametersCsv), ct); ReplacePlan(r, items); AddDecision(r, technicianId, "TechnicianPlanAdjusted", r.Status, r.Status, null); await db.SaveChangesAsync(ct); return await LoadRequestAsync(r.Id, ct); }
    public async Task<DeploymentRequestView> ConfirmAsync(Guid technicianId, Guid requestId, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var r = await TechnicianRequestAsync(technicianId, requestId, ct); EnsureStatus(r, DeploymentRequestStatus.Surveyed); if (!r.Surveys.OrderByDescending(x => x.CreatedAtUtc).First().IsFeasible) throw new ResourceConflictException("The latest survey is not feasible."); Transition(r, technicianId, "PlanConfirmed", DeploymentRequestStatus.PlanConfirmed, null); await db.SaveChangesAsync(ct); return await LoadRequestAsync(r.Id, ct); }
    public async Task<DeploymentRequestView> StartInstallationAsync(Guid technicianId, Guid requestId, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var r = await TechnicianRequestAsync(technicianId, requestId, ct); EnsureStatus(r, DeploymentRequestStatus.PlanConfirmed); Transition(r, technicianId, "InstallationStarted", DeploymentRequestStatus.Installing, null); await db.SaveChangesAsync(ct); return await LoadRequestAsync(r.Id, ct); }

    public async Task<DeviceConnectionTestView> RecordConnectionTestAsync(Guid technicianId, Guid requestId, ConnectionTestCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct); var r = await TechnicianRequestAsync(technicianId, requestId, ct); EnsureStatus(r, DeploymentRequestStatus.Installing); var d = await db.Devices.SingleOrDefaultAsync(x => x.Id == command.DeviceId && x.DeploymentRequestId == requestId && (!x.ZoneId.HasValue || x.ZoneId == r.ZoneId), ct) ?? throw new ResourceNotFoundException("Device was not found in this deployment request.");
        if (command.ObservedAtUtc == default || command.ObservedAtUtc > DateTime.UtcNow.AddMinutes(5)) throw new RequestValidationException("observedAtUtc", "Observed time is required and cannot be in the future."); if (!command.Succeeded && string.IsNullOrWhiteSpace(command.ErrorCode)) throw new RequestValidationException("errorCode", "A failed test requires an error code.");
        var test = new DeviceConnectionTest { DeviceId = d.Id, DeploymentRequestId = r.Id, TechnicianUserId = technicianId, Succeeded = command.Succeeded, Rssi = command.Rssi, Snr = command.Snr, RoundTripLatencyMs = command.RoundTripLatencyMs, ObservedAtUtc = command.ObservedAtUtc.ToUniversalTime(), ErrorCode = Optional(command.ErrorCode, 100), ErrorMessage = Optional(command.ErrorMessage, 1000) }; db.DeviceConnectionTests.Add(test); d.Status = command.Succeeded ? DeviceStatus.Online : DeviceStatus.MaintenanceRequired; AddDecision(r, technicianId, command.Succeeded ? "ConnectionTestPassed" : "ConnectionTestFailed", r.Status, r.Status, command.ErrorCode); await db.SaveChangesAsync(ct); return TestView(test);
    }

    public async Task<DeploymentRequestView> CompleteAsync(Guid technicianId, Guid requestId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var r = await TechnicianRequestAsync(technicianId, requestId, ct);
        EnsureStatus(r, DeploymentRequestStatus.Installing);
        var devices = await db.Devices
            .Include(x => x.ConnectionTests)
            .Where(x => x.DeploymentRequestId == r.Id && x.ZoneId == r.ZoneId && x.Status != DeviceStatus.Decommissioned)
            .ToListAsync(ct);
        var planned = r.PlanItems.Sum(x => x.Quantity);
        if (devices.Count != planned || devices.Any(x => x.ConnectionTests.OrderByDescending(t => t.ObservedAtUtc).FirstOrDefault()?.Succeeded != true))
            throw new ResourceConflictException("Every planned Device must be assigned and have a successful latest connection test.");

        // The deployment is the point at which hardware leaves the Technician
        // stock. Move every linked physical item (nodes, gateway and consumed
        // components) to Deployed atomically with the deployment transition.
        var deviceIds = devices.Select(d => d.Id).ToList();
        var componentHardwareIds = await db.DeviceComponents
            .Where(x => deviceIds.Contains(x.DeviceId))
            .Select(x => x.HardwareItemId)
            .ToListAsync(ct);
        var linkedHardwareIds = devices.SelectMany(d =>
                (d.HardwareItemId.HasValue ? new[] { d.HardwareItemId.Value } : Array.Empty<Guid>()))
            .Concat(componentHardwareIds)
            .Distinct()
            .ToList();
        if (linkedHardwareIds.Count > 0)
        {
            var linkedHardware = await db.PlatformHardwareItems
                .Where(x => linkedHardwareIds.Contains(x.Id))
                .ToListAsync(ct);
            foreach (var item in linkedHardware)
            {
                item.Status = "Deployed";
                item.AssignedTechnicianId = null;
                item.LocationRack = $"Đã triển khai · Zone {r.ZoneId}";
            }
        }

        Transition(r, technicianId, "DeploymentCompleted", DeploymentRequestStatus.Completed, null);
        r.CompletedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return await LoadRequestAsync(r.Id, ct);
    }

    public async Task<ServiceHandoffView> FailAsync(Guid technicianId, Guid requestId, FailDeploymentCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct); var r = await TechnicianRequestAsync(technicianId, requestId, ct); if (r.Status is DeploymentRequestStatus.Completed or DeploymentRequestStatus.MaintenanceRequired) throw new ResourceConflictException("Deployment is already terminal."); var code = Required(command.FailureCode, "failureCode", 100); var description = Required(command.Description, "description", 2000); if (command.DeviceId.HasValue && !await db.Devices.AnyAsync(x => x.Id == command.DeviceId && x.DeploymentRequestId == requestId, ct)) throw new ResourceNotFoundException("Device was not found in this Deployment Request."); await using var tx = await db.Database.BeginTransactionAsync(ct); r.FailureCode = code; r.FailureDescription = description; Transition(r, technicianId, "DeploymentFailed", DeploymentRequestStatus.MaintenanceRequired, description); var affected = await db.Devices.Where(x => x.DeploymentRequestId == requestId && (!command.DeviceId.HasValue || x.Id == command.DeviceId)).ToListAsync(ct); foreach (var d in affected) d.Status = DeviceStatus.MaintenanceRequired; var service = new ServiceRequest { TenantId = r.TenantId, FarmId = r.FarmId, ZoneId = r.ZoneId, DeploymentRequestId = r.Id, DeviceId = command.DeviceId, Source = "DeploymentFailure", FailureCode = code, Description = description }; db.ServiceRequests.Add(service); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(service.Id, r.Id, service.Status);
    }

    public async Task<IReadOnlyList<GatewayView>> ListGatewaysAsync(Guid userId, Guid? tenantId, Guid farmId, CancellationToken ct) { await EnsureFarmReadAsync(userId, tenantId, farmId, ct); return (await db.Gateways.AsNoTracking().Include(x => x.Devices).Where(x => x.FarmId == farmId).ToListAsync(ct)).Select(x => x.ToView()).ToList(); }
    public async Task<GatewayView> ProvisionGatewayAsync(Guid technicianId, ProvisionGatewayCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var r = await TechnicianRequestAsync(technicianId, command.DeploymentRequestId, ct);
        if (r.Status is DeploymentRequestStatus.Draft or DeploymentRequestStatus.Completed) throw new ResourceConflictException("Deployment Request is not ready for Gateway provisioning.");
        if (r.FarmId != command.FarmId) throw new RequestValidationException("farmId", "Farm does not match the Deployment Request.");
        var depositPaid = await db.ServiceRequests.AnyAsync(x => x.DeploymentRequestId == r.Id && x.IsDepositPaid, ct);
        if (!depositPaid) throw new ResourceConflictException("Owner must sign the contract and pay the 30% deposit before Gateway provisioning.");
        if (!MacRegex().IsMatch(command.MacAddress)) throw new RequestValidationException("macAddress", "MAC address must use XX:XX:XX:XX:XX:XX format.");
        var fingerprint = Required(command.ClientCertificateFingerprint, "clientCertificateFingerprint", 128).Replace(":", "", StringComparison.Ordinal).ToUpperInvariant();
        if (fingerprint.Length != 64 || fingerprint.Any(c => !Uri.IsHexDigit(c))) throw new RequestValidationException("clientCertificateFingerprint", "Certificate fingerprint must be a SHA-256 hexadecimal value.");
        var serial = Required(command.GatewaySerial, "gatewaySerial", 100);
        if (await db.Gateways.AnyAsync(x => x.MacAddress == command.MacAddress, ct)) throw new ResourceConflictException("Gateway MAC address is already registered.");
        if (await db.Gateways.AnyAsync(x => x.GatewaySerial == serial, ct)) throw new ResourceConflictException("Gateway serial is already registered.");
        if (await db.Gateways.AnyAsync(x => x.ClientCertificateFingerprint == fingerprint, ct)) throw new ResourceConflictException("Gateway certificate fingerprint is already registered.");

        var gateway = new Gateway
        {
            DeploymentRequestId = r.Id, FarmId = r.FarmId, MacAddress = command.MacAddress.ToUpperInvariant(), GatewaySerial = serial,
            FrequencyBand = Required(command.FrequencyBand, "frequencyBand", 30), FirmwareVersion = Required(command.FirmwareVersion, "firmwareVersion", 50),
            // The transport identity is canonical per Gateway, never per request.
            MqttClientId = $"smartfarm-gateway-{Guid.NewGuid():N}", ClientCertificateFingerprint = fingerprint
        };
        gateway.MqttClientId = $"smartfarm-gateway-{gateway.Id:N}";
        if (await db.Gateways.AnyAsync(x => x.MqttClientId == gateway.MqttClientId, ct)) throw new ResourceConflictException("Gateway MQTT client ID is already registered.");
        db.Gateways.Add(gateway); AddDecision(r, technicianId, "GatewayProvisioned", r.Status, r.Status, gateway.GatewaySerial); await db.SaveChangesAsync(ct); return gateway.ToView();
    }
    public async Task<GatewayView> GetGatewayAsync(Guid userId, Guid? tenantId, Guid gatewayId, CancellationToken ct) { var g = await db.Gateways.AsNoTracking().Include(x => x.Devices).Include(x => x.Farm).SingleOrDefaultAsync(x => x.Id == gatewayId, ct) ?? throw new ResourceNotFoundException("Gateway was not found."); await EnsureHardwareReadAsync(userId, tenantId, g.Farm.TenantId, g.DeploymentRequestId, ct); return g.ToView(); }
    public async Task<GatewayFirmwareConfigView> GetFirmwareConfigAsync(Guid technicianId, Guid gatewayId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var gateway = await TechnicianGatewayAsync(technicianId, gatewayId, ct);
        // Query by the FK explicitly. This must not depend on the navigation
        // collection being populated by a previous tracked Gateway instance.
        // Provisioned-but-not-yet-GIS-assigned nodes still belong here.
        var provisionedNodes = await db.Devices.AsNoTracking()
            .Where(x => x.GatewayId == gateway.Id && x.Status != DeviceStatus.Decommissioned)
            .OrderBy(x => x.CreatedAtUtc)
            .ToListAsync(ct);
        // Only nodes explicitly selected in Gateway configuration are sent to
        // the ESP. Provisioning and Gateway service membership are separate
        // states; a Ready/provisioned node that was unchecked must not leak
        // into the runtime MQTT configuration.
        var configuredNodeIds = (gateway.ConfiguredNodeIdsCsv ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(value => Guid.TryParse(value, out _))
            .Select(Guid.Parse)
            .ToHashSet();
        provisionedNodes = configuredNodeIds.Count == 0
            ? []
            : provisionedNodes.Where(node => configuredNodeIds.Contains(node.Id)).ToList();
        var hardwareItemIds = provisionedNodes.Where(x => x.HardwareItemId.HasValue).Select(x => x.HardwareItemId!.Value).ToList();
        // Some legacy provisioning records were created before the platform
        // hardware FK was linked. Resolve those records by their stable stock
        // code so a verified Hardware Preparation session is still honored.
        var hardwareItemsByCode = await db.PlatformHardwareItems.AsNoTracking()
            .Where(x => provisionedNodes.Select(n => n.HardwareAddress).Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);
        var resolvedHardwareItemIds = hardwareItemIds
            .Concat(provisionedNodes.Select(x => hardwareItemsByCode.TryGetValue(x.HardwareAddress, out var id) ? id : Guid.Empty))
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();
        var preparationAddresses = await db.HardwarePreparationSessions.AsNoTracking()
            .Where(x => resolvedHardwareItemIds.Contains(x.HardwareItemId) && x.LoRaAddress.HasValue && x.Status != HardwarePreparationStatus.Faulty && x.Status != HardwarePreparationStatus.Maintenance)
            .GroupBy(x => x.HardwareItemId)
            .ToDictionaryAsync(x => x.Key, x => x.OrderByDescending(s => s.UpdatedAtUtc).Select(s => s.LoRaAddress!.Value).First(), ct);
        var nodes = provisionedNodes.Select(x =>
        {
            var resolvedId = x.HardwareItemId ?? (hardwareItemsByCode.TryGetValue(x.HardwareAddress, out var codeId) ? codeId : Guid.Empty);
            if (resolvedId == Guid.Empty || !preparationAddresses.TryGetValue(resolvedId, out var loraAddress) || loraAddress <= 0)
                throw new ResourceConflictException($"Node {x.HardwareAddress} has no verified LoRa address from Hardware Preparation.");
            return new FirmwareNodeConfigView(x.Id, x.HardwareAddress, x.ZoneId ?? gateway.DeploymentRequest.ZoneId, loraAddress, x.DeviceType);
        }).ToList();
        var baseTopic = $"smartfarm/gateways/{gateway.Id}";
        var mqttHost = configuration["Mqtt:Host"] ?? throw new InvalidOperationException("Mqtt:Host is not configured.");
        var mqttPort = configuration.GetValue<int?>("Mqtt:Port") ?? 1883;
        return new GatewayFirmwareConfigView(gateway.Id, gateway.FarmId, gateway.DeploymentRequest.ZoneId, gateway.DeploymentRequestId, gateway.GatewaySerial, gateway.MqttClientId, gateway.ClientCertificateFingerprint, mqttHost, mqttPort, $"{baseTopic}/telemetry", $"{baseTopic}/commands", $"{baseTopic}/actuator-feedback", nodes, gateway.ConfigVersion, gateway.TelemetryIntervalSec, gateway.SamplesPerInterval, gateway.PollingIntervalSeconds, gateway.HeartbeatIntervalSeconds, gateway.ResponseTimeoutMs, gateway.RetryCount, new MqttIdentityView(mqttHost, mqttPort, gateway.MqttClientId, gateway.ClientCertificateFingerprint));
    }
    public async Task<GatewayView> ConfigureGatewayAsync(Guid technicianId, Guid gatewayId, GatewayConfigurationCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var gateway = await TechnicianGatewayAsync(technicianId, gatewayId, ct) ?? throw new ResourceNotFoundException("Gateway was not found for this Technician.");
        if (command.TelemetryIntervalSec is < 10 or > 86400) throw new RequestValidationException("telemetryIntervalSec", "Telemetry interval must be between 10 and 86400 seconds.");
        if (command.SamplesPerInterval is < 1 or > 60) throw new RequestValidationException("samplesPerInterval", "Samples per interval must be between 1 and 60.");
        var nodeIds = command.NodeIds.Distinct().ToList();
        // Gateway configuration is allowed before GIS surveying. At this stage
        // the Node only needs to be provisioned into this Gateway; the GIS save
        // step assigns ZoneId and GPS coordinates afterwards.
        var allowed = gateway.Devices.Where(x => x.Status != DeviceStatus.Decommissioned).Select(x => x.Id).ToHashSet();
        if (nodeIds.Any(x => !allowed.Contains(x))) throw new RequestValidationException("nodeIds", "Every selected node must already be provisioned into this Gateway.");
        gateway.TelemetryIntervalSec = command.TelemetryIntervalSec;
        gateway.SamplesPerInterval = command.SamplesPerInterval;
        gateway.InstallationLocation = Optional(command.InstallationLocation, 500);
        gateway.ConfiguredNodeIdsCsv = string.Join(',', nodeIds);
        gateway.ConfiguredAtUtc = DateTime.UtcNow;
        if (command.PollingIntervalSeconds.HasValue) gateway.PollingIntervalSeconds = command.PollingIntervalSeconds.Value;
        if (command.HeartbeatIntervalSeconds.HasValue) gateway.HeartbeatIntervalSeconds = command.HeartbeatIntervalSeconds.Value;
        if (command.ResponseTimeoutMs.HasValue) gateway.ResponseTimeoutMs = command.ResponseTimeoutMs.Value;
        if (command.RetryCount.HasValue) gateway.RetryCount = command.RetryCount.Value;
        gateway.ConfigVersion += 1;
        gateway.ConfigSyncStatus = "PendingApply";
        await db.SaveChangesAsync(ct);
        return gateway.ToView();
    }

    public async Task<GatewayView> AckGatewayConfigurationAsync(Guid technicianId, Guid gatewayId, int configVersion, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var gateway = await TechnicianGatewayAsync(technicianId, gatewayId, ct)
            ?? throw new ResourceNotFoundException("Gateway was not found.");
        if (gateway.ConfigVersion == configVersion)
        {
            gateway.ConfigSyncStatus = "Applied";
            await db.SaveChangesAsync(ct);
        }
        return gateway.ToView();
    }

    public async Task<NodeRegistryPackageView> GetNodeRegistryAsync(Guid gatewayId, CancellationToken ct)
    {
        var gateway = await db.Gateways.Include(x => x.Devices).AsNoTracking().SingleOrDefaultAsync(x => x.Id == gatewayId, ct)
            ?? throw new ResourceNotFoundException("Gateway was not found.");
        var nodes = gateway.Devices
            .Where(x => x.Status != DeviceStatus.Decommissioned)
            .Where(x => string.IsNullOrWhiteSpace(gateway.ConfiguredNodeIdsCsv) || gateway.ConfiguredNodeIdsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Contains(x.Id.ToString(), StringComparer.OrdinalIgnoreCase))
            .Select(x => new NodeRegistryItemView(x.Id, x.HardwareAddress, x.DeviceType, x.ZoneId, x.Status.ToString()))
            .ToList();
        return new NodeRegistryPackageView(gateway.Id, gateway.ConfigVersion, gateway.ConfigVersion, gateway.GatewaySerial, nodes);
    }
    public async Task<FirmwareJobView> ScheduleFirmwareAsync(Guid technicianId, Guid gatewayId, FirmwareCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var g = await TechnicianGatewayAsync(technicianId, gatewayId, ct);
        if (await db.FirmwareJobs.AnyAsync(x => x.GatewayId == gatewayId && (x.Status == FirmwareJobStatus.Scheduled || x.Status == FirmwareJobStatus.InProgress), ct)) throw new ResourceConflictException("Gateway already has an active firmware job.");
        var release = await db.FirmwareReleases.SingleOrDefaultAsync(x => x.Id == command.FirmwareReleaseId && x.Status == FirmwareReleaseStatus.Approved, ct) ?? throw new ResourceConflictException("Only an Approved Firmware Registry release can be scheduled.");
        if (!release.HardwareTarget.Contains("ESP32", StringComparison.OrdinalIgnoreCase) || !release.HardwareTarget.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase)) throw new ResourceConflictException("The selected release is not compatible with an ESP32 Gateway.");
        var job = new FirmwareJob { GatewayId = g.Id, FirmwareReleaseId = release.Id, TargetVersion = release.Version, FirmwareUrl = Required(release.ArtifactUrl, "artifactUrl", 1000), ArtifactSha256 = release.ArtifactSha256, ScheduledAtUtc = command.ScheduledAtUtc.ToUniversalTime() };
        db.FirmwareJobs.Add(job); await db.SaveChangesAsync(ct);
        return new(job.Id, g.Id, release.Id, job.TargetVersion, job.FirmwareUrl, job.ArtifactSha256, job.ScheduledAtUtc, job.Status);
    }
    public async Task<FirmwareJobView?> GetLatestFirmwareJobAsync(Guid userId, Guid gatewayId, CancellationToken ct)
    {
        var gateway = await db.Gateways.AsNoTracking().Include(x => x.Farm).SingleOrDefaultAsync(x => x.Id == gatewayId, ct)
            ?? throw new ResourceNotFoundException("Gateway was not found.");
        await EnsureHardwareReadAsync(userId, null, gateway.Farm.TenantId, gateway.DeploymentRequestId, ct);
        var job = await db.FirmwareJobs.AsNoTracking().Where(x => x.GatewayId == gatewayId)
            .OrderByDescending(x => x.ScheduledAtUtc).FirstOrDefaultAsync(ct);
        return job is null ? null : new(job.Id, job.GatewayId, job.FirmwareReleaseId, job.TargetVersion, job.FirmwareUrl, job.ArtifactSha256, job.ScheduledAtUtc, job.Status);
    }
    public async Task<FirmwareJobView> RetryFirmwareAsync(Guid technicianId, Guid gatewayId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var gateway = await TechnicianGatewayAsync(technicianId, gatewayId, ct);
        var job = await db.FirmwareJobs.Include(x => x.FirmwareRelease)
            .Where(x => x.GatewayId == gateway.Id)
            .OrderByDescending(x => x.ScheduledAtUtc)
            .FirstOrDefaultAsync(ct)
            ?? throw new ResourceNotFoundException("No OTA job exists for this Gateway.");
        if (job.Status is FirmwareJobStatus.Scheduled or FirmwareJobStatus.InProgress)
            throw new ResourceConflictException("The OTA job is still active; retry is not allowed yet.");
        if (job.Status == FirmwareJobStatus.Succeeded)
            throw new ResourceConflictException("The latest OTA job already succeeded.");
        if (job.FirmwareRelease.Status != FirmwareReleaseStatus.Approved || string.IsNullOrWhiteSpace(job.ArtifactSha256))
            throw new ResourceConflictException("The OTA release is no longer approved or has no checksum.");
        job.Status = FirmwareJobStatus.Scheduled;
        job.ScheduledAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return new(job.Id, job.GatewayId, job.FirmwareReleaseId, job.TargetVersion, job.FirmwareUrl, job.ArtifactSha256, job.ScheduledAtUtc, job.Status);
    }
    public async Task<IReadOnlyList<FirmwareReleaseView>> ListFirmwareReleasesAsync(Guid adminId, CancellationToken ct)
    {
        await EnsureAdminAsync(adminId, ct);
        var releases = await db.FirmwareReleases.AsNoTracking().OrderByDescending(x => x.PublishedAtUtc).ThenByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        return releases.Select(ToFirmwareReleaseView).ToList();
    }
    public async Task<IReadOnlyList<FirmwareReleaseView>> ListApprovedFirmwareReleasesAsync(CancellationToken ct) => (await db.FirmwareReleases.AsNoTracking().Where(x => x.Status == FirmwareReleaseStatus.Approved).OrderByDescending(x => x.PublishedAtUtc).ToListAsync(ct)).Select(ToFirmwareReleaseView).ToList();
    public async Task<FirmwareReleaseView> CreateFirmwareReleaseAsync(Guid adminId, CreateFirmwareReleaseCommand command, CancellationToken ct)
    {
        await EnsureAdminAsync(adminId, ct);
        var target = Required(command.HardwareTarget, "hardwareTarget", 80); var version = Required(command.Version, "version", 50);
        if (await db.FirmwareReleases.AnyAsync(x => x.HardwareTarget == target && x.Version == version, ct)) throw new ResourceConflictException("A release with this hardware target and version already exists.");
        var release = new FirmwareRelease { HardwareTarget = target, Version = version, ProtocolVersion = Required(command.ProtocolVersion, "protocolVersion", 50), ArtifactUrl = Required(command.ArtifactUrl, "artifactUrl", 1500), SourceRepository = Optional(command.SourceRepository, 500), GitTag = Optional(command.GitTag, 150), CommitSha = Optional(command.CommitSha, 100), ArtifactSha256 = Optional(command.ArtifactSha256, 128), ReleaseNotes = Optional(command.ReleaseNotes, 4000), PublishedAtUtc = command.PublishedAtUtc?.ToUniversalTime(), Status = FirmwareReleaseStatus.PendingReview };
        db.FirmwareReleases.Add(release); await db.SaveChangesAsync(ct); return ToFirmwareReleaseView(release);
    }
    public async Task<IReadOnlyList<FirmwareReleaseView>> ImportGitHubReleaseAsync(GitHubReleaseWebhookCommand command, CancellationToken ct)
    {
        var repository = Required(command.RepositoryUrl, "repositoryUrl", 500);
        var tag = Required(command.Tag, "tag", 150);
        var version = tag.TrimStart('v', 'V');
        var commit = Required(command.CommitSha, "commitSha", 100);
        var imported = new List<FirmwareRelease>();
        var importedTargets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var checksums = await LoadReleaseChecksumsAsync(command.Assets, ct);
        foreach (var asset in command.Assets.OrderByDescending(x => x.Name.Contains("ota", StringComparison.OrdinalIgnoreCase)).ThenByDescending(x => x.Name.EndsWith(".bin", StringComparison.OrdinalIgnoreCase)).Where(x => !string.IsNullOrWhiteSpace(x.Name) && Uri.TryCreate(x.DownloadUrl, UriKind.Absolute, out _)))
        {
            var target = asset.Name.Contains("gateway", StringComparison.OrdinalIgnoreCase) || asset.Name.Contains("esp32", StringComparison.OrdinalIgnoreCase)
                ? asset.Name.Contains("bootstrap", StringComparison.OrdinalIgnoreCase) ? "ESP32_GATEWAY_BOOTSTRAP" : "ESP32_GATEWAY_RUNTIME"
                : asset.Name.Contains("nano", StringComparison.OrdinalIgnoreCase) || asset.Name.Contains("node", StringComparison.OrdinalIgnoreCase)
                    ? "ARDUINO_NANO_NODE" : null;
            if (target is null || !importedTargets.Add(target)) continue;
            var existing = await db.FirmwareReleases.SingleOrDefaultAsync(x => x.HardwareTarget == target && x.Version == version, ct);
            if (existing is not null)
            {
                if (target == "ESP32_GATEWAY_RUNTIME" && asset.Name.Contains("ota", StringComparison.OrdinalIgnoreCase) && !existing.ArtifactUrl.Contains("ota", StringComparison.OrdinalIgnoreCase) && existing.Status != FirmwareReleaseStatus.Approved)
                { existing.ArtifactUrl = asset.DownloadUrl; existing.ArtifactSha256 = checksums.GetValueOrDefault(asset.Name); }
                continue;
            }
            var release = new FirmwareRelease
            {
                HardwareTarget = target,
                Version = version,
                ProtocolVersion = "1.0",
                SourceRepository = repository,
                GitTag = tag,
                CommitSha = commit,
                ArtifactUrl = asset.DownloadUrl,
                ArtifactSha256 = checksums.GetValueOrDefault(asset.Name),
                ReleaseNotes = command.ReleaseNotes ?? command.ReleaseName,
                PublishedAtUtc = command.PublishedAtUtc?.ToUniversalTime(),
                Status = FirmwareReleaseStatus.PendingReview
            };
            db.FirmwareReleases.Add(release); imported.Add(release);
        }
        if (imported.Count > 0) await db.SaveChangesAsync(ct);
        return imported.Select(ToFirmwareReleaseView).ToList();
    }

    private async Task<Dictionary<string, string>> LoadReleaseChecksumsAsync(IReadOnlyList<GitHubReleaseAssetInput> assets, CancellationToken ct)
    {
        var checksumAsset = assets.FirstOrDefault(x => x.Name.Equals("SHA256SUMS.txt", StringComparison.OrdinalIgnoreCase));
        if (checksumAsset is null || !Uri.TryCreate(checksumAsset.DownloadUrl, UriKind.Absolute, out _)) return new(StringComparer.OrdinalIgnoreCase);

        try
        {
            var text = await httpClient.GetStringAsync(checksumAsset.DownloadUrl, ct);
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var line in text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
            {
                var parts = line.Trim().Split((char[]?)null, 2, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length != 2 || !Regex.IsMatch(parts[0], "^[A-Fa-f0-9]{64}$")) continue;
                result[Path.GetFileName(parts[1].Trim().TrimStart('*'))] = parts[0].ToLowerInvariant();
            }
            return result;
        }
        catch (HttpRequestException)
        {
            return new(StringComparer.OrdinalIgnoreCase);
        }
    }
    public async Task<FirmwareReleaseView> SetFirmwareReleaseStatusAsync(Guid adminId, Guid releaseId, FirmwareReleaseStatus status, string? artifactSha256, CancellationToken ct)
    {
        await EnsureAdminAsync(adminId, ct); var release = await db.FirmwareReleases.SingleOrDefaultAsync(x => x.Id == releaseId, ct) ?? throw new ResourceNotFoundException("Firmware release was not found.");
        if (status == FirmwareReleaseStatus.Approved)
        {
            if (!string.IsNullOrWhiteSpace(artifactSha256)) release.ArtifactSha256 = artifactSha256.Trim();
            if (!Uri.TryCreate(release.ArtifactUrl, UriKind.Absolute, out var artifactUri) || (artifactUri.Scheme != Uri.UriSchemeHttps && artifactUri.Scheme != Uri.UriSchemeHttp)) throw new RequestValidationException("artifactUrl", "A valid HTTP(S) artifact URL is required before approval.");
            if (string.IsNullOrWhiteSpace(release.ArtifactSha256) || !Regex.IsMatch(release.ArtifactSha256.Trim(), "^[A-Fa-f0-9]{64}$")) throw new RequestValidationException("artifactSha256", "A 64-character SHA-256 checksum is required before approval.");
            using var artifactResponse = await httpClient.GetAsync(artifactUri, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!artifactResponse.IsSuccessStatusCode) throw new RequestValidationException("artifactUrl", $"Artifact download failed with HTTP {(int)artifactResponse.StatusCode}.");
            await using var artifactStream = await artifactResponse.Content.ReadAsStreamAsync(ct);
            var actualSha256 = Convert.ToHexString(await SHA256.HashDataAsync(artifactStream, ct));
            if (!string.Equals(actualSha256, release.ArtifactSha256.Trim(), StringComparison.OrdinalIgnoreCase)) throw new RequestValidationException("artifactSha256", "SHA-256 does not match the selected artifact.");
            if (string.IsNullOrWhiteSpace(release.SourceRepository) || string.IsNullOrWhiteSpace(release.GitTag) || string.IsNullOrWhiteSpace(release.CommitSha)) throw new RequestValidationException("provenance", "Repository, Git tag and commit SHA are required before approval.");
            release.ApprovedByUserId = adminId; release.Status = status;

            // Approval only makes a release available for an explicit OTA job.
            // It must never push firmware to already activated gateways.
        }
        else { release.Status = status; if (status is FirmwareReleaseStatus.Denied or FirmwareReleaseStatus.Revoked) release.ApprovedByUserId = null; }
        await db.SaveChangesAsync(ct); return ToFirmwareReleaseView(release);
    }
    public async Task<IReadOnlyList<DeviceView>> ListFarmDevicesAsync(Guid userId, Guid? tenantId, Guid farmId, CancellationToken ct) { await EnsureFarmReadAsync(userId, tenantId, farmId, ct); return (await DeviceQuery().AsNoTracking().Where(x => x.FarmId == farmId && x.Status != DeviceStatus.Decommissioned).ToListAsync(ct)).Select(x => x.ToView()).ToList(); }
    public async Task<IReadOnlyList<DeviceView>> ListZoneDevicesAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct) { var user = await UserAsync(ownerId, ct); if (user.Role is UserRole.FarmOwner or UserRole.Farmer) { if (!await db.Zones.AnyAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == user.TenantId, ct)) throw new ResourceNotFoundException("Zone was not found in the current Tenant."); } else if (user.Role is not (UserRole.PlatformTechnician or UserRole.PlatformAdmin)) { throw new AuthorizationException("Access denied."); } return (await DeviceQuery().AsNoTracking().Where(x => x.ZoneId == zoneId && x.Status != DeviceStatus.Decommissioned).ToListAsync(ct)).Select(x => x.ToView()).ToList(); }
    public async Task<DeviceView> GetDeviceAsync(Guid userId, Guid? tenantId, Guid deviceId, CancellationToken ct) { var d = await DeviceQuery().AsNoTracking().Include(x => x.Farm).SingleOrDefaultAsync(x => x.Id == deviceId, ct) ?? throw new ResourceNotFoundException("Device was not found."); await EnsureHardwareReadAsync(userId, tenantId, d.Farm.TenantId, d.DeploymentRequestId, ct); return d.ToView(); }

    public async Task<ProvisionDevicesView> ProvisionDevicesAsync(Guid technicianId, ProvisionDevicesCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        if (command.Nodes.Count is < 1 or > 50) throw new RequestValidationException("nodes", "Provide between 1 and 50 nodes.");
        if (command.Nodes.Select(x => x.HardwareAddress.Trim().ToUpperInvariant()).Distinct().Count() != command.Nodes.Count) throw new RequestValidationException("nodes", "Hardware addresses must be unique.");
        var r = await TechnicianRequestAsync(technicianId, command.DeploymentRequestId, ct);
        EnsureStatus(r, DeploymentRequestStatus.Installing);
        var g = await db.Gateways.SingleOrDefaultAsync(x => x.Id == command.GatewayId && x.DeploymentRequestId == r.Id && x.FarmId == r.FarmId, ct) ?? throw new ResourceNotFoundException("Gateway was not found in this Deployment Request.");
        if (command.FarmId != r.FarmId) throw new RequestValidationException("farmId", "Farm does not match the Deployment Request.");
        var addresses = command.Nodes.Select(x => x.HardwareAddress.Trim().ToUpperInvariant()).ToList();
        var requestedHardwareIds = command.Nodes.Where(x => x.HardwareItemId.HasValue).Select(x => x.HardwareItemId!.Value).Distinct().ToList();
        var readyPreparations = await db.HardwarePreparationSessions.AsNoTracking()
            .Where(x => requestedHardwareIds.Contains(x.HardwareItemId) && x.Status == HardwarePreparationStatus.ReadyForDeployment)
            .ToListAsync(ct);
        foreach (var node in command.Nodes)
        {
            var address = node.HardwareAddress.Trim().ToUpperInvariant();
            if (!node.HardwareItemId.HasValue || !readyPreparations.Any(x => x.HardwareItemId == node.HardwareItemId.Value && string.Equals(x.NodeId, address, StringComparison.OrdinalIgnoreCase)))
                throw new ResourceConflictException($"Node {address} must have a matching Hardware Preparation in ReadyForDeployment before provisioning.");
        }
        var existing = await db.Devices.Where(x => addresses.Contains(x.HardwareAddress)).ToListAsync(ct);
        var owned = existing.Where(x => x.GatewayId == g.Id && x.DeploymentRequestId == r.Id && x.FarmId == r.FarmId && x.Status != DeviceStatus.Decommissioned).ToList();
        // A previous attempt may have created the Device before attaching it
        // to the selected Gateway. Reattach only an unassigned Device from the
        // same Farm/Deployment; never move an installed node silently.
        var reattachable = existing.Except(owned)
            .Where(x => x.FarmId == r.FarmId && x.DeploymentRequestId == r.Id && !x.ZoneId.HasValue && x.Status == DeviceStatus.Unassigned)
            .ToList();
        foreach (var device in reattachable)
        {
            device.GatewayId = g.Id;
            var requested = command.Nodes.First(x => string.Equals(x.HardwareAddress.Trim(), device.HardwareAddress, StringComparison.OrdinalIgnoreCase));
            device.HardwareItemId = requested.HardwareItemId;
        }
        owned.AddRange(reattachable);
        var conflicting = existing.Except(owned).ToList();
        if (conflicting.Count > 0) throw new ResourceConflictException($"A hardware address is already provisioned on another Gateway: {string.Join(", ", conflicting.Select(x => x.HardwareAddress))}.");
        var modelIds = command.Nodes.Where(x => x.DeviceModelId.HasValue).Select(x => x.DeviceModelId!.Value).Distinct().ToList();
        if (await db.DeviceModelDefinitions.CountAsync(x => modelIds.Contains(x.Id) && x.IsActive, ct) != modelIds.Count) throw new RequestValidationException("deviceModelId", "One or more Device Models are invalid.");
        var newDevices = command.Nodes.Where(x => !owned.Any(d => d.HardwareAddress == x.HardwareAddress.Trim().ToUpperInvariant())).Select(x => new Device { FarmId = r.FarmId, GatewayId = g.Id, DeploymentRequestId = r.Id, HardwareAddress = x.HardwareAddress.Trim().ToUpperInvariant(), DeviceType = x.DeviceType, DeviceModelDefinitionId = x.DeviceModelId, HardwareItemId = x.HardwareItemId }).ToList();
        db.Devices.AddRange(newDevices);
        AddDecision(r, technicianId, "DevicesProvisioned", r.Status, r.Status, $"Count={owned.Count + newDevices.Count}");
        await db.SaveChangesAsync(ct);
        foreach (var device in owned)
        {
            var requested = command.Nodes.FirstOrDefault(x => string.Equals(x.HardwareAddress.Trim(), device.HardwareAddress, StringComparison.OrdinalIgnoreCase));
            if (requested?.HardwareItemId is { } hardwareItemId) device.HardwareItemId = hardwareItemId;
        }
        await db.SaveChangesAsync(ct);
        var result = owned.Concat(newDevices).Select(x => x.ToView()).ToList();
        return new(result.Count, result);
    }

    public async Task<DeviceView> ConfigureSensorsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<SensorInput> sensors, CancellationToken ct) {
        await EnsureTechnicianAsync(technicianId, ct);
        var d = await TechnicianDeviceAsync(technicianId, deviceId, ct);
        if (d.DeviceType != DeviceType.SensorNode) throw new ResourceConflictException("Only a SensorNode accepts sensor configuration.");
        if (sensors.Count == 0 || sensors.Any(x => x.SamplingIntervalSec is < 10 or > 3600) || sensors.Where(x => x.Pin != null).GroupBy(x => x.Pin).Any(g => g.Count() > 1)) throw new RequestValidationException("sensors", "Sensors require unique pins and sampling interval 10–3600 seconds.");

        var requested = sensors.Select(x => Required(x.SensorType, "sensorType", 50)).ToList();
        var old = d.Sensors.Select(x => x.SensorType).ToList();
        var added = requested.Where(code => !old.Contains(code, StringComparer.OrdinalIgnoreCase)).ToList();
        var removed = old.Where(code => !requested.Contains(code, StringComparer.OrdinalIgnoreCase)).ToList();
        var stock = await db.PlatformHardwareItems.Where(x => x.AssignedTechnicianId == technicianId).ToListAsync(ct);
        foreach (var code in added) {
            // Duplicate stock rows can exist after partial allocations. Always
            // consume a row that still has quantity, rather than the first
            // zero-quantity historical row.
            var item = stock.Where(x => string.Equals(x.Code, code, StringComparison.OrdinalIgnoreCase) && x.QuantityInStock > 0)
                .OrderByDescending(x => x.QuantityInStock)
                .FirstOrDefault();
            if (item is null || item.QuantityInStock < 1) throw new ResourceConflictException($"Cảm biến '{code}' không còn trong kho Technician.");
            item.QuantityInStock--;
        }
        foreach (var code in removed) {
            var item = stock.Where(x => string.Equals(x.Code, code, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(x => x.QuantityInStock)
                .FirstOrDefault();
            if (item is not null) item.QuantityInStock++;
        }
        db.DeviceSensors.RemoveRange(d.Sensors);
        var rows = sensors.Select(x => new DeviceSensor { DeviceId = d.Id, SensorType = Required(x.SensorType, "sensorType", 50), Pin = Optional(x.Pin, 30), Model = Optional(x.Model, 100), Interface = Optional(x.Interface, 30), Unit = Optional(x.Unit, 30) ?? "", MinValue = x.MinValue, MaxValue = x.MaxValue, SamplingIntervalSec = x.SamplingIntervalSec }).ToList();
        db.DeviceSensors.AddRange(rows);
        d.Status = DeviceStatus.SensorsConfigured;
        await db.SaveChangesAsync(ct);
        return await LoadDeviceAsync(d.Id, ct);
    }

    public async Task<IReadOnlyList<DeviceComponentView>> ConfigureComponentsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<DeviceComponentInput> components, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var device = await TechnicianDeviceAsync(technicianId, deviceId, ct);
        if (components.Any(x => x.Quantity < 1 || string.IsNullOrWhiteSpace(x.ComponentType))) throw new RequestValidationException("components", "Component type and quantity are required.");
        if (components.Any(x => x.ComponentType.Equals("RELAY", StringComparison.OrdinalIgnoreCase) || x.ComponentType.Equals("VALVE", StringComparison.OrdinalIgnoreCase) || x.ComponentType.Equals("PUMP", StringComparison.OrdinalIgnoreCase))) throw new RequestValidationException("components", "Relay, valve and pump must be configured as actuators.");
        var requested = components.GroupBy(x => x.HardwareItemId).Select(g => new { HardwareItemId = g.Key, Quantity = g.Sum(x => x.Quantity), Component = g.First() }).ToList();
        var current = await db.DeviceComponents.Where(x => x.DeviceId == deviceId).ToListAsync(ct);
        var stock = await db.PlatformHardwareItems.Where(x => x.AssignedTechnicianId == technicianId).ToListAsync(ct);
        foreach (var old in current) { var item = stock.FirstOrDefault(x => x.Id == old.HardwareItemId); if (item is not null) item.QuantityInStock += old.Quantity; }
        db.DeviceComponents.RemoveRange(current);
        var result = new List<DeviceComponent>();
        foreach (var row in requested)
        {
            var item = stock.FirstOrDefault(x => x.Id == row.HardwareItemId && x.Status == "InTechnicianStock");
            if (item is null || item.QuantityInStock < row.Quantity) throw new ResourceConflictException($"Không đủ tồn kho cho component {row.HardwareItemId}.");
            // Do not inspect Category here: consumable LoRa inventory may be
            // categorized as NODE_MODULE even though it is not a node.
            var itemIdentity = $"{item.Code} {item.Name} {item.Model}";
            if (System.Text.RegularExpressions.Regex.IsMatch(itemIdentity, @"SIM[-_ ]?NODE|\bNODE\b|NODE_MODULE|GATEWAY|ESP32|RELAY|VALVE|PUMP|ACTUATOR", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                throw new ResourceConflictException("Node, Gateway và thiết bị actuator không được khai báo là vật tư phụ.");
            item.QuantityInStock -= row.Quantity;
            result.Add(new DeviceComponent { DeviceId = deviceId, HardwareItemId = row.HardwareItemId, ComponentType = row.Component.ComponentType.Trim().ToUpperInvariant(), Quantity = row.Quantity, Unit = string.IsNullOrWhiteSpace(row.Component.Unit) ? item.Unit : row.Component.Unit!.Trim(), Notes = row.Component.Notes?.Trim() });
        }
        db.DeviceComponents.AddRange(result); await db.SaveChangesAsync(ct);
        return await db.DeviceComponents.AsNoTracking().Include(x => x.HardwareItem).Where(x => x.DeviceId == deviceId).Select(x => new DeviceComponentView(x.Id, x.DeviceId, x.HardwareItemId, x.HardwareItem.Code, x.HardwareItem.Name, x.ComponentType, x.Quantity, x.Unit, x.Notes)).ToListAsync(ct);
    }
    public async Task<IReadOnlyList<DeviceComponentView>> GetComponentsAsync(Guid technicianId, Guid deviceId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        await TechnicianDeviceAsync(technicianId, deviceId, ct);
        return await db.DeviceComponents.AsNoTracking().Include(x => x.HardwareItem).Where(x => x.DeviceId == deviceId)
            .Select(x => new DeviceComponentView(x.Id, x.DeviceId, x.HardwareItemId, x.HardwareItem.Code, x.HardwareItem.Name, x.ComponentType, x.Quantity, x.Unit, x.Notes)).ToListAsync(ct);
    }
    public async Task<DeviceView> ConfigureActuatorsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<ActuatorInput> actuators, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var d = await TechnicianDeviceAsync(technicianId, deviceId, ct); if (d.DeviceType != DeviceType.ActuatorNode) throw new ResourceConflictException("Only an ActuatorNode accepts actuator configuration."); if (actuators.Count == 0 || actuators.Any(x => x.RelayChannel is < 1 or > 8 || x.MaxDurationMinutes is < 1 or > 30 || x.RatedPowerWatt is <= 0 || x.FlowRateLitersPerMinute is <= 0) || actuators.GroupBy(x => x.RelayChannel).Any(g => g.Count() > 1)) throw new RequestValidationException("actuators", "Relay channels must be unique (1–8), duration must be 1–30 minutes, and optional power/flow ratings must be positive."); db.DeviceActuators.RemoveRange(d.Actuators); db.DeviceActuators.AddRange(actuators.Select(x => new DeviceActuator { DeviceId = d.Id, ActuatorType = Required(x.ActuatorType, "actuatorType", 50), RelayChannel = x.RelayChannel, RatedPowerWatt = x.RatedPowerWatt, FlowRateLitersPerMinute = x.FlowRateLitersPerMinute, MaxDurationMinutes = x.MaxDurationMinutes })); d.Status = DeviceStatus.ActuatorsConfigured; await db.SaveChangesAsync(ct); return await LoadDeviceAsync(d.Id, ct); }
    public async Task<DeviceView> AssignAsync(Guid technicianId, Guid zoneId, Guid deviceId, AssignDeviceCommand command, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var d = await TechnicianDeviceAsync(technicianId, deviceId, ct); var r = await TechnicianRequestAsync(technicianId, d.DeploymentRequestId, ct); EnsureStatus(r, DeploymentRequestStatus.Installing); if (r.ZoneId != zoneId || d.FarmId != r.FarmId) throw new ResourceNotFoundException("Zone is outside the Device Deployment Request."); if (d.ZoneId.HasValue || d.Status is DeviceStatus.Assigned or DeviceStatus.Offline) throw new ResourceConflictException("Device is already assigned."); if (d.Status is not (DeviceStatus.SensorsConfigured or DeviceStatus.ActuatorsConfigured or DeviceStatus.Online)) throw new ResourceConflictException("Device must complete Hardware Preparation and peripheral configuration before GIS assignment."); var latestTest = await db.DeviceConnectionTests.Where(x => x.DeviceId == d.Id).OrderByDescending(x => x.ObservedAtUtc).FirstOrDefaultAsync(ct); if (latestTest?.Succeeded != true) throw new ResourceConflictException("Device must have a successful latest connectivity test before GIS assignment."); if (d.DeviceModelDefinitionId is null || !r.PlanItems.Any(x => x.DeviceModelDefinitionId == d.DeviceModelDefinitionId)) throw new ResourceConflictException("Device Model is not in the confirmed deployment plan."); var assignedCount = await db.Devices.CountAsync(x => x.DeploymentRequestId == r.Id && x.ZoneId == zoneId && x.DeviceModelDefinitionId == d.DeviceModelDefinitionId, ct); var planned = r.PlanItems.Single(x => x.DeviceModelDefinitionId == d.DeviceModelDefinitionId).Quantity; if (assignedCount >= planned) throw new ResourceConflictException("Confirmed quantity for this Device Model is already assigned.");         d.ZoneId = zoneId;
        if (!d.HardwareItemId.HasValue || !await db.HardwarePreparationSessions.AnyAsync(x => x.HardwareItemId == d.HardwareItemId && x.Status == HardwarePreparationStatus.ReadyForDeployment, ct)) throw new ResourceConflictException("Physical hardware must be ReadyForDeployment before GIS assignment.");
        d.Status = DeviceStatus.Assigned;
        d.InstallationNotes = Optional(command.InstallationNotes, 1000);
        ValidateGps(command.GpsLatitude, command.GpsLongitude);
        d.GpsLatitude = command.GpsLatitude;
        d.GpsLongitude = command.GpsLongitude;
        if (command.HeartbeatIntervalSeconds.HasValue)
        {
            var hb = command.HeartbeatIntervalSeconds.Value;
            if (hb is < 5 or > 86400)
            {
                throw new RequestValidationException("heartbeatIntervalSeconds", "Khoảng thời gian nhịp tim (heartbeat) phải nằm trong khoảng từ 5 giây đến 86400 giây (1 ngày).");
            }
            d.HeartbeatIntervalSeconds = hb;
        }
        var history = new DeviceAssignmentHistory { DeviceId = d.Id, ZoneId = zoneId, TechnicianUserId = technicianId, Action = "Assigned", Notes = d.InstallationNotes }; db.DeviceAssignmentHistory.Add(history); AddDecision(r, technicianId, "DeviceAssigned", r.Status, r.Status, d.HardwareAddress); await db.SaveChangesAsync(ct); return await LoadDeviceAsync(d.Id, ct); }
    public async Task<DeviceView> UnassignAsync(Guid technicianId, Guid zoneId, Guid deviceId, UnassignDeviceCommand command, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var d = await TechnicianDeviceAsync(technicianId, deviceId, ct); if (d.ZoneId != zoneId) throw new ResourceNotFoundException("Device is not assigned to this Zone."); var reason = Required(command.Reason, "reason", 1000); db.DeviceAssignmentHistory.Add(new DeviceAssignmentHistory { DeviceId = d.Id, ZoneId = zoneId, TechnicianUserId = technicianId, Action = "Unassigned", Notes = reason }); d.ZoneId = null; d.Status = DeviceStatus.Unassigned; await db.SaveChangesAsync(ct); return await LoadDeviceAsync(d.Id, ct); }
    public async Task<DeviceConnectionTestView> GetLatestConnectionTestAsync(Guid technicianId, Guid deviceId, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); await TechnicianDeviceAsync(technicianId, deviceId, ct); var t = await db.DeviceConnectionTests.AsNoTracking().Where(x => x.DeviceId == deviceId).OrderByDescending(x => x.ObservedAtUtc).FirstOrDefaultAsync(ct) ?? throw new ResourceNotFoundException("No connection test has been recorded for this Device."); return TestView(t); }
    public async Task<DiagnosticJobView> DiagnoseAsync(Guid technicianId, Guid deviceId, DiagnoseCommand command, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var d = await TechnicianDeviceAsync(technicianId, deviceId, ct); var allowed = new[] { "REBOOT_NODE", "CHANGE_CHANNEL", "REBOOT_AND_CHANGE_CHANNEL", "CALIBRATE_SENSOR", "FACTORY_RESET" }; if (!allowed.Contains(command.Action)) throw new RequestValidationException("action", "Unsupported diagnostic action."); var r = await TechnicianRequestAsync(technicianId, d.DeploymentRequestId, ct); var job = new DeviceDiagnosticJob { DeviceId = d.Id, TechnicianUserId = technicianId, Action = command.Action, NewFrequencyChannel = command.NewFrequencyChannel, IncreaseTxPowerDbm = command.IncreaseTxPowerDbm }; db.DeviceDiagnosticJobs.Add(job); AddDecision(r, technicianId, "DiagnosticQueued", r.Status, r.Status, command.Action); await db.SaveChangesAsync(ct); return new(job.Id, d.Id, job.Action, job.Status, job.CreatedAtUtc); }
    public async Task DecommissionAsync(Guid technicianId, Guid deviceId, CancellationToken ct) { await EnsureTechnicianAsync(technicianId, ct); var d = await TechnicianDeviceAsync(technicianId, deviceId, ct); if (d.ZoneId.HasValue || d.Status != DeviceStatus.Unassigned) throw new ResourceConflictException("Only an Unassigned Device can be decommissioned."); d.Status = DeviceStatus.Decommissioned; d.DecommissionedAtUtc = DateTime.UtcNow; await db.SaveChangesAsync(ct); }

    public async Task<HardwarePreparationView> StartHardwarePreparationAsync(Guid technicianId, Guid hardwareItemId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == hardwareItemId && x.AssignedTechnicianId == technicianId && x.Status == "InTechnicianStock", ct) ?? throw new ResourceNotFoundException("Hardware item is not assigned to this Technician.");
        var active = await db.HardwarePreparationSessions.SingleOrDefaultAsync(x => x.HardwareItemId == item.Id && x.TechnicianUserId == technicianId && x.Status != HardwarePreparationStatus.Faulty && x.Status != HardwarePreparationStatus.Maintenance && x.Status != HardwarePreparationStatus.ReadyForDeployment, ct);
        if (active is not null) return PreparationView(active);
        var session = new HardwarePreparationSession { HardwareItemId = item.Id, TechnicianUserId = technicianId, DeviceType = item.Category, Status = HardwarePreparationStatus.HardwarePreparation };
        db.HardwarePreparationSessions.Add(session); await db.SaveChangesAsync(ct); return PreparationView(session);
    }

    public async Task<IReadOnlyList<HardwarePreparationView>> ListHardwarePreparationsAsync(Guid technicianId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        return (await db.HardwarePreparationSessions.AsNoTracking().Where(x => x.TechnicianUserId == technicianId).OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)).Select(PreparationView).ToList();
    }

    public async Task<HardwarePreparationView> AdvanceHardwarePreparationAsync(Guid technicianId, Guid preparationId, HardwarePreparationStatus nextStatus, string? nodeId, int? loraAddress, string? boardProfile, string? notes, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var session = await db.HardwarePreparationSessions.SingleOrDefaultAsync(x => x.Id == preparationId && x.TechnicianUserId == technicianId, ct) ?? throw new ResourceNotFoundException("Preparation session was not found.");
        var allowed = (session.Status, nextStatus) switch { (HardwarePreparationStatus.HardwarePreparation, HardwarePreparationStatus.FirmwarePrepared) => true, (HardwarePreparationStatus.FirmwarePrepared, HardwarePreparationStatus.IdentityVerified) => true, (HardwarePreparationStatus.IdentityVerified, HardwarePreparationStatus.ConnectivityVerified) => true, (HardwarePreparationStatus.ConnectivityVerified, HardwarePreparationStatus.ReadyForDeployment) => true, (_, HardwarePreparationStatus.Faulty) => true, (_, HardwarePreparationStatus.Maintenance) => true, _ => false };
        if (!allowed) throw new ResourceConflictException($"Invalid preparation transition {session.Status} -> {nextStatus}.");
        if ((nextStatus == HardwarePreparationStatus.FirmwarePrepared || nextStatus == HardwarePreparationStatus.ReadyForDeployment) && !await db.FirmwareInstallations.AnyAsync(x => x.PreparationSessionId == session.Id && x.Result == FirmwareInstallationResult.Succeeded, ct))
            throw new ResourceConflictException("A successful firmware installation record is required before this transition.");
        if (nextStatus == HardwarePreparationStatus.IdentityVerified && !session.DeviceType.Contains("Gateway", StringComparison.OrdinalIgnoreCase))
        {
            var identity = Required(nodeId ?? session.NodeId, "nodeId", 100);
            if (!loraAddress.HasValue || loraAddress is < 0 or > 65535) throw new RequestValidationException("loRaAddress", "LoRa Address must be between 0 and 65535.");
            if (await db.HardwarePreparationSessions.AnyAsync(x => x.Id != session.Id && x.NodeId == identity, ct) || await db.Devices.AnyAsync(x => x.HardwareAddress == identity, ct)) throw new ResourceConflictException("Node ID is already registered.");
            if (await db.HardwarePreparationSessions.AnyAsync(x => x.Id != session.Id && x.LoRaAddress == loraAddress, ct)) throw new ResourceConflictException("LoRa Address is already assigned to another preparation session.");
        }
        if (nextStatus == HardwarePreparationStatus.ConnectivityVerified && session.ConnectivityCheckPassed != true)
        {
            throw new ResourceConflictException("A successful hardware connectivity check is required before ConnectivityVerified.");
        }
        if (nextStatus == HardwarePreparationStatus.ConnectivityVerified && session.DeviceType.Contains("Gateway", StringComparison.OrdinalIgnoreCase))
        {
            var gateway = await db.GatewayEnrollments.Include(x => x.Gateway).SingleOrDefaultAsync(x => x.HardwareItemId == session.HardwareItemId && x.Status == "Activated", ct);
            if (gateway?.Gateway?.LastSeenAtUtc is null) throw new ResourceConflictException("Gateway heartbeat has not been received after activation.");
        }
        session.Status = nextStatus; session.NodeId = nodeId ?? session.NodeId; session.LoRaAddress = loraAddress ?? session.LoRaAddress; session.BoardProfile = boardProfile ?? session.BoardProfile; session.Notes = notes ?? session.Notes; session.CompletedAtUtc = nextStatus == HardwarePreparationStatus.ReadyForDeployment ? DateTime.UtcNow : null;
        await db.SaveChangesAsync(ct); return PreparationView(session);
    }

    private static HardwarePreparationView PreparationView(HardwarePreparationSession x) => new(x.Id, x.HardwareItemId, x.TechnicianUserId, x.DeviceType, x.Status, x.NodeId, x.LoRaAddress, x.BoardProfile, x.Notes, x.CreatedAtUtc, x.CompletedAtUtc, x.ConnectivityCheckPassed, x.ConnectivityCheckedAtUtc, x.ConnectivityEvidence);
    public async Task<HardwarePreparationView> RecordHardwareConnectivityCheckAsync(Guid technicianId, Guid preparationId, HardwareConnectivityCheckCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct); var session = await db.HardwarePreparationSessions.SingleOrDefaultAsync(x => x.Id == preparationId && x.TechnicianUserId == technicianId, ct) ?? throw new ResourceNotFoundException("Preparation session was not found.");
        if (string.IsNullOrWhiteSpace(command.Evidence)) throw new RequestValidationException("evidence", "Connectivity evidence is required."); session.ConnectivityCheckPassed = command.Passed; session.ConnectivityCheckedAtUtc = DateTime.UtcNow; session.ConnectivityEvidence = command.Evidence.Trim(); if (!command.Passed) session.Status = HardwarePreparationStatus.Faulty; await db.SaveChangesAsync(ct); return PreparationView(session);
    }
    public async Task<FirmwareInstallationView> RecordFirmwareInstallationAsync(Guid technicianId, Guid preparationId, Guid firmwareReleaseId, FirmwareUploadMethod uploadMethod, FirmwareInstallationResult result, string? boardProfile, string? bootloaderProfile, string? errorMessage, string? notes, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var session = await db.HardwarePreparationSessions.Include(x => x.HardwareItem).SingleOrDefaultAsync(x => x.Id == preparationId && x.TechnicianUserId == technicianId, ct) ?? throw new ResourceNotFoundException("Preparation session was not found.");
        var release = await db.FirmwareReleases.SingleOrDefaultAsync(x => x.Id == firmwareReleaseId && x.Status == FirmwareReleaseStatus.Approved, ct) ?? throw new ResourceConflictException("Only an Approved Firmware Registry release can be installed.");
        var isGateway = session.HardwareItem.Category.Contains("Gateway", StringComparison.OrdinalIgnoreCase);
        var targetMatches = isGateway
            ? release.HardwareTarget.Contains("ESP32", StringComparison.OrdinalIgnoreCase) && release.HardwareTarget.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase)
            : release.HardwareTarget.Contains("NANO", StringComparison.OrdinalIgnoreCase) || release.HardwareTarget.Contains("NODE", StringComparison.OrdinalIgnoreCase);
        if (!targetMatches) throw new ResourceConflictException("The selected firmware release is not compatible with this hardware item.");
        var installation = new FirmwareInstallation { PreparationSessionId = session.Id, TechnicianUserId = technicianId, FirmwareReleaseId = release.Id, FirmwareVersion = release.Version, UploadMethod = uploadMethod, Result = result, BoardProfile = boardProfile, BootloaderProfile = bootloaderProfile, ErrorMessage = errorMessage, Notes = notes, CompletedAtUtc = result == FirmwareInstallationResult.Started ? null : DateTime.UtcNow };
        db.FirmwareInstallations.Add(installation); if (result == FirmwareInstallationResult.Failed) session.Status = HardwarePreparationStatus.Faulty; await db.SaveChangesAsync(ct); return InstallationView(installation);
    }
    public async Task<IReadOnlyList<FirmwareInstallationView>> ListFirmwareInstallationsAsync(Guid technicianId, Guid preparationId, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct); if (!await db.HardwarePreparationSessions.AnyAsync(x => x.Id == preparationId && x.TechnicianUserId == technicianId, ct)) throw new ResourceNotFoundException("Preparation session was not found.");
        return (await db.FirmwareInstallations.AsNoTracking().Where(x => x.PreparationSessionId == preparationId).OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)).Select(InstallationView).ToList();
    }
    private static FirmwareInstallationView InstallationView(FirmwareInstallation x) => new(x.Id, x.PreparationSessionId, x.TechnicianUserId, x.FirmwareReleaseId, x.FirmwareVersion, x.UploadMethod, x.BoardProfile, x.BootloaderProfile, x.Result, x.ErrorMessage, x.Notes, x.CreatedAtUtc, x.CompletedAtUtc);
    public async Task<GatewayEnrollmentView> EnrollGatewayAsync(Guid technicianId, GatewayEnrollmentCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == command.HardwareItemId && x.AssignedTechnicianId == technicianId && x.Status == "InTechnicianStock" && x.Category.Contains("Gateway"), ct) ?? throw new ResourceNotFoundException("Gateway hardware item is not assigned to this Technician.");
        var mac = Required(command.MacAddress, "macAddress", 32).ToUpperInvariant(); var chip = Required(command.ChipId, "chipId", 128); var serial = Required(command.GatewaySerial, "gatewaySerial", 100); var token = Required(command.BootstrapToken, "bootstrapToken", 256);
        if (!string.Equals(item.MacAddress?.Replace(":", "", StringComparison.Ordinal).ToUpperInvariant(), mac.Replace(":", "", StringComparison.Ordinal), StringComparison.Ordinal)) throw new ResourceConflictException("Gateway MAC does not match the inventory record.");
        if (await db.GatewayEnrollments.AnyAsync(x => x.HardwareItemId == item.Id && x.Status == "Enrolled", ct)) throw new ResourceConflictException("Gateway is already enrolled.");
        var enrollment = new GatewayEnrollment { HardwareItemId = item.Id, TechnicianUserId = technicianId, MacAddress = mac, ChipId = chip, GatewaySerial = serial, BootstrapTokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))), BootstrapFirmwareVersion = Required(command.BootstrapFirmwareVersion, "bootstrapFirmwareVersion", 80), Status = "Enrolled", EnrolledAtUtc = DateTime.UtcNow };
        db.GatewayEnrollments.Add(enrollment); await db.SaveChangesAsync(ct); return new(enrollment.Id, enrollment.HardwareItemId, enrollment.MacAddress, enrollment.ChipId, enrollment.GatewaySerial, enrollment.Status, enrollment.EnrolledAtUtc);
    }
    public async Task<GatewayEnrollmentView> VerifyGatewayEnrollmentHandshakeAsync(Guid enrollmentId, GatewayEnrollmentHandshakeCommand command, CancellationToken ct)
    {
        var enrollment = await db.GatewayEnrollments.SingleOrDefaultAsync(x => x.Id == enrollmentId && x.Status == "Enrolled", ct)
            ?? throw new ResourceNotFoundException("Gateway enrollment was not found or is not pending handshake.");
        var mac = Required(command.MacAddress, "macAddress", 32).ToUpperInvariant();
        var chip = Required(command.ChipId, "chipId", 128);
        var token = Required(command.BootstrapToken, "bootstrapToken", 256);
        if (!string.Equals(NormalizeMac(enrollment.MacAddress), NormalizeMac(mac), StringComparison.Ordinal) || !string.Equals(enrollment.ChipId, chip, StringComparison.Ordinal))
            throw new ResourceConflictException("Gateway identity does not match the enrollment.");
        var presentedHash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        var storedHash = Convert.FromHexString(enrollment.BootstrapTokenHash);
        if (!CryptographicOperations.FixedTimeEquals(presentedHash, storedHash))
            throw new ResourceConflictException("Bootstrap token is invalid.");
        enrollment.HandshakeVerifiedAtUtc = DateTime.UtcNow;
        enrollment.Notes = "Bootstrap handshake verified by Gateway.";
        await db.SaveChangesAsync(ct);
        return new(enrollment.Id, enrollment.HardwareItemId, enrollment.MacAddress, enrollment.ChipId, enrollment.GatewaySerial, enrollment.Status, enrollment.EnrolledAtUtc);
    }
    public async Task<GatewayEnrollmentView> AutoEnrollGatewayAsync(AutoGatewayEnrollmentCommand command, CancellationToken ct)
    {
        var mac = Required(command.MacAddress, "macAddress", 32).ToUpperInvariant();
        var chip = Required(command.ChipId, "chipId", 128);
        var candidates = await db.PlatformHardwareItems
            .Where(x => x.MacAddress != null && x.Category.ToUpper().Contains("GATEWAY"))
            .ToListAsync(ct);
        var item = candidates.SingleOrDefault(x => NormalizeMac(x.MacAddress!) == NormalizeMac(mac))
            ?? throw new ResourceNotFoundException("No allocated Gateway matches this MAC address.");
        if (!string.Equals(item.Status, "InTechnicianStock", StringComparison.OrdinalIgnoreCase) || item.AssignedTechnicianId is null)
            throw new ResourceConflictException("Gateway MAC matches inventory, but it is not assigned to a Technician yet.");
        var existing = await db.GatewayEnrollments.SingleOrDefaultAsync(x => x.HardwareItemId == item.Id && x.Status == "Enrolled", ct);
        if (existing is not null) return new(existing.Id, existing.HardwareItemId, existing.MacAddress, existing.ChipId, existing.GatewaySerial, existing.Status, existing.EnrolledAtUtc);
        if (await db.GatewayEnrollments.AnyAsync(x => x.HardwareItemId == item.Id && x.Status == "Activated", ct))
            throw new ResourceConflictException("Gateway is already activated and cannot be enrolled again.");
        var serial = Optional(command.GatewaySerial, 100) ?? item.SerialNumber ?? chip;
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var enrollment = new GatewayEnrollment { HardwareItemId = item.Id, TechnicianUserId = item.AssignedTechnicianId ?? Guid.Empty, MacAddress = mac, ChipId = chip, GatewaySerial = serial, BootstrapTokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))), BootstrapFirmwareVersion = Required(command.BootstrapFirmwareVersion, "bootstrapFirmwareVersion", 80), Status = "Enrolled", EnrolledAtUtc = DateTime.UtcNow, HandshakeVerifiedAtUtc = DateTime.UtcNow, Notes = "Auto-enrolled after Technician confirmation on Gateway." };
        db.GatewayEnrollments.Add(enrollment); await db.SaveChangesAsync(ct);
        return new(enrollment.Id, enrollment.HardwareItemId, enrollment.MacAddress, enrollment.ChipId, enrollment.GatewaySerial, enrollment.Status, enrollment.EnrolledAtUtc);
    }

    public async Task<GatewayEnrollmentView?> GetGatewayEnrollmentAsync(Guid technicianId, Guid hardwareItemId, CancellationToken ct)
    {
        var enrollment = await db.GatewayEnrollments.AsNoTracking().Include(x => x.Gateway)
            .Where(x => x.HardwareItemId == hardwareItemId && x.TechnicianUserId == technicianId)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(ct);
        return enrollment is null ? null : new(enrollment.Id, enrollment.HardwareItemId, enrollment.MacAddress, enrollment.ChipId, enrollment.GatewaySerial, enrollment.Status, enrollment.EnrolledAtUtc, enrollment.Gateway?.Id);
    }
    public async Task<GatewayEnrollmentView> ActivateGatewayEnrollmentAsync(Guid technicianId, Guid enrollmentId, ActivateGatewayEnrollmentCommand command, CancellationToken ct)
    {
        await EnsureTechnicianAsync(technicianId, ct);
        var enrollment = await db.GatewayEnrollments.SingleOrDefaultAsync(x => x.Id == enrollmentId && x.TechnicianUserId == technicianId && x.Status == "Enrolled", ct) ?? throw new ResourceNotFoundException("Gateway enrollment was not found or is not pending activation.");
        if (enrollment.HandshakeVerifiedAtUtc is null) throw new ResourceConflictException("Gateway bootstrap handshake has not been verified.");
        var request = await TechnicianRequestAsync(technicianId, command.DeploymentRequestId, ct); if (request.FarmId != command.FarmId) throw new ResourceConflictException("Farm does not match the Deployment Request.");
        if (await db.Gateways.AnyAsync(x => x.GatewaySerial == enrollment.GatewaySerial || x.MacAddress == enrollment.MacAddress, ct)) throw new ResourceConflictException("Gateway identity is already registered.");
        var gateway = new Gateway { FarmId = command.FarmId, DeploymentRequestId = request.Id, MacAddress = enrollment.MacAddress, GatewaySerial = enrollment.GatewaySerial, FrequencyBand = Required(command.FrequencyBand, "frequencyBand", 30), FirmwareVersion = enrollment.BootstrapFirmwareVersion, MqttClientId = $"smartfarm-gateway-{Guid.NewGuid():N}", ClientCertificateFingerprint = Convert.ToHexString(SHA256.HashData(Guid.NewGuid().ToByteArray())), Status = GatewayStatus.Provisioned };
        db.Gateways.Add(gateway); enrollment.Gateway = gateway; enrollment.Status = "Activated"; enrollment.EnrolledAtUtc ??= DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return new(enrollment.Id, enrollment.HardwareItemId, enrollment.MacAddress, enrollment.ChipId, enrollment.GatewaySerial, enrollment.Status, enrollment.EnrolledAtUtc, gateway.Id);
    }
    public async Task<GatewayRuntimeUpdateView?> GetGatewayRuntimeUpdateAsync(string macAddress, string currentVersion, CancellationToken ct)
    {
        var normalized = NormalizeMac(Required(macAddress, "macAddress", 32));
        var enrollments = await db.GatewayEnrollments.Include(x => x.Gateway).Where(x => x.Status == "Activated" && x.Gateway != null).ToListAsync(ct);
        var enrollment = enrollments.SingleOrDefault(x => NormalizeMac(x.MacAddress) == normalized);
        if (enrollment?.Gateway is null) return null;
        var job = await db.FirmwareJobs.Include(x => x.FirmwareRelease).Where(x => x.GatewayId == enrollment.Gateway.Id && x.Status == FirmwareJobStatus.Scheduled && x.FirmwareRelease.Status == FirmwareReleaseStatus.Approved).OrderBy(x => x.ScheduledAtUtc).FirstOrDefaultAsync(ct);
        if (job is null || string.Equals(job.TargetVersion, currentVersion, StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(job.ArtifactSha256)) return null;
        return new(job.Id, job.TargetVersion, job.FirmwareUrl, job.ArtifactSha256, job.Status.ToString());
    }
    public async Task<GatewayFirmwareConfigView?> GetGatewayRuntimeConfigAsync(string macAddress, CancellationToken ct)
    {
        var normalized = NormalizeMac(Required(macAddress, "macAddress", 32));
        // NormalizeMac is application code and cannot be translated by EF Core.
        // Load the small gateway set first, then compare normalized values in memory.
        var gateway = (await db.Gateways.Include(x => x.DeploymentRequest).ToListAsync(ct))
            .SingleOrDefault(x => NormalizeMac(x.MacAddress) == normalized);
        if (gateway is null) return null;
        var nodes = await db.Devices.AsNoTracking().Where(x => x.GatewayId == gateway.Id && x.Status != DeviceStatus.Decommissioned).OrderBy(x => x.CreatedAtUtc).ToListAsync(ct);
        var nodeConfig = nodes.Select((x, index) => new FirmwareNodeConfigView(x.Id, x.HardwareAddress, x.ZoneId ?? gateway.DeploymentRequest.ZoneId, index + 1, x.DeviceType)).ToList();
        var baseTopic = $"smartfarm/gateways/{gateway.Id}";
        var mqttHost = configuration["Mqtt:Host"] ?? throw new InvalidOperationException("Mqtt:Host is not configured.");
        var mqttPort = configuration.GetValue<int?>("Mqtt:Port") ?? 1883;
        return new GatewayFirmwareConfigView(gateway.Id, gateway.FarmId, gateway.DeploymentRequest.ZoneId, gateway.DeploymentRequestId, gateway.GatewaySerial, gateway.MqttClientId, gateway.ClientCertificateFingerprint, mqttHost, mqttPort, $"{baseTopic}/telemetry", $"{baseTopic}/commands", $"{baseTopic}/actuator-feedback", nodeConfig, gateway.ConfigVersion, gateway.TelemetryIntervalSec, gateway.SamplesPerInterval, gateway.PollingIntervalSeconds, gateway.HeartbeatIntervalSeconds, gateway.ResponseTimeoutMs, gateway.RetryCount, new MqttIdentityView(mqttHost, mqttPort, gateway.MqttClientId, gateway.ClientCertificateFingerprint));
    }

    public async Task RecordGatewayOtaResultAsync(GatewayOtaResultCommand command, CancellationToken ct)
    {
        var mac = NormalizeMac(Required(command.MacAddress, "macAddress", 32));
        var gateway = (await db.Gateways.ToListAsync(ct)).SingleOrDefault(x => NormalizeMac(x.MacAddress) == mac)
            ?? throw new ResourceNotFoundException("Gateway was not found for OTA result.");
        var job = await db.FirmwareJobs.Include(x => x.FirmwareRelease)
            .Where(x => x.GatewayId == gateway.Id && x.Status != FirmwareJobStatus.Succeeded)
            .OrderByDescending(x => x.ScheduledAtUtc).FirstOrDefaultAsync(ct);
        if (job is null) return;
        var started = string.Equals(command.Result, "Started", StringComparison.OrdinalIgnoreCase);
        var succeeded = string.Equals(command.Result, "Succeeded", StringComparison.OrdinalIgnoreCase) || string.Equals(command.Result, "Success", StringComparison.OrdinalIgnoreCase);
        if ((started || succeeded) && !string.Equals(job.TargetVersion, command.Version, StringComparison.OrdinalIgnoreCase)) return;
        job.Status = started ? FirmwareJobStatus.InProgress : succeeded ? FirmwareJobStatus.Succeeded : FirmwareJobStatus.Failed;
        if (succeeded)
        {
            gateway.FirmwareVersion = Required(command.Version, "version", 50);
            gateway.Status = GatewayStatus.Provisioned;
        }
        await db.SaveChangesAsync(ct);
    }

    private IQueryable<DeploymentRequest> RequestQuery() => db.DeploymentRequests.Include(x => x.PlanItems).ThenInclude(x => x.DeviceModelDefinition).Include(x => x.Surveys).Include(x => x.Decisions);
    private IQueryable<Device> DeviceQuery() => db.Devices.Include(x => x.Sensors).Include(x => x.Actuators).Include(x => x.ConnectionTests);
    private async Task<DeploymentRequest> LoadRequestEntityAsync(Guid id, CancellationToken ct) => await RequestQuery().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ResourceNotFoundException("Deployment Request was not found.");
    private async Task<DeploymentRequestView> LoadRequestAsync(Guid id, CancellationToken ct) { db.ChangeTracker.Clear(); return (await RequestQuery().AsNoTracking().SingleAsync(x => x.Id == id, ct)).ToView(); }
    private async Task<DeviceView> LoadDeviceAsync(Guid id, CancellationToken ct) { db.ChangeTracker.Clear(); return (await DeviceQuery().AsNoTracking().SingleAsync(x => x.Id == id, ct)).ToView(); }
    private async Task<DeploymentRequest> OwnerRequestAsync(Guid owner, Guid tenant, Guid id, CancellationToken ct) => await RequestQuery().SingleOrDefaultAsync(x => x.Id == id && x.OwnerUserId == owner && x.TenantId == tenant, ct) ?? throw new ResourceNotFoundException("Deployment Request was not found in the current Tenant.");
    private async Task<DeploymentRequest> TechnicianRequestAsync(Guid tech, Guid id, CancellationToken ct) => await RequestQuery().SingleOrDefaultAsync(x => x.Id == id && (x.TechnicianUserId == tech || db.ServiceRequests.Any(s => s.DeploymentRequestId == x.Id && s.AssignedTechnicianId == tech)), ct) ?? throw new ResourceNotFoundException("Deployment Request is not assigned to this Technician.");
    private async Task<Gateway> TechnicianGatewayAsync(Guid tech, Guid id, CancellationToken ct)
    {
        var gateway = await db.Gateways.Include(x => x.Devices).Include(x => x.DeploymentRequest).SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ResourceNotFoundException("Gateway was not found for this Technician.");
        var assignedToDeployment = gateway.DeploymentRequest.TechnicianUserId == tech;
        var assignedToService = await db.ServiceRequests.AnyAsync(x => x.DeploymentRequestId == gateway.DeploymentRequestId && x.AssignedTechnicianId == tech, ct);
        if (!assignedToDeployment && !assignedToService) throw new ResourceNotFoundException("Gateway was not found for this Technician.");
        return gateway;
    }
    private async Task<Device> TechnicianDeviceAsync(Guid tech, Guid id, CancellationToken ct) => await DeviceQuery().SingleOrDefaultAsync(x => x.Id == id && (x.DeploymentRequest.TechnicianUserId == tech || db.ServiceRequests.Any(s => s.DeploymentRequestId == x.DeploymentRequestId && s.AssignedTechnicianId == tech)), ct) ?? throw new ResourceNotFoundException("Device was not found for this Technician.");
    private async Task EnsureOwnerAsync(Guid id, Guid tenant, CancellationToken ct) { if (!await db.AppUsers.AnyAsync(x => x.Id == id && x.Role == UserRole.FarmOwner && x.TenantId == tenant, ct)) throw new AuthorizationException("FarmOwner role in the current Tenant is required."); }
    private async Task EnsureAdminAsync(Guid id, CancellationToken ct) { if (!await db.AppUsers.AnyAsync(x => x.Id == id && x.Role == UserRole.PlatformAdmin && x.TenantId == null, ct)) throw new AuthorizationException("PlatformAdmin role is required."); }
    private async Task EnsureTechnicianAsync(Guid id, CancellationToken ct) { if (!await db.AppUsers.AnyAsync(x => x.Id == id && x.Role == UserRole.PlatformTechnician && x.TenantId == null, ct)) throw new AuthorizationException("PlatformTechnician role is required."); }
    private async Task<AppUser> UserAsync(Guid id, CancellationToken ct) => await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AuthorizationException();
    private async Task EnsureFarmReadAsync(Guid userId, Guid? tenantId, Guid farmId, CancellationToken ct) { var user = await UserAsync(userId, ct); if (user.Role is UserRole.FarmOwner or UserRole.Farmer) { if (!await db.Farms.AnyAsync(x => x.Id == farmId && x.TenantId == user.TenantId, ct)) throw new ResourceNotFoundException("Farm was not found in the current Tenant."); } else if (user.Role is UserRole.PlatformTechnician or UserRole.PlatformAdmin) { if (!await db.Farms.AnyAsync(x => x.Id == farmId, ct)) throw new ResourceNotFoundException("Farm was not found."); } else throw new AuthorizationException(); }
    private async Task EnsureHardwareReadAsync(Guid userId, Guid? tenantId, Guid resourceTenant, Guid requestId, CancellationToken ct) { var user = await UserAsync(userId, ct); if (user.Role is UserRole.FarmOwner or UserRole.Farmer && (tenantId != resourceTenant || user.TenantId != resourceTenant)) throw new ResourceNotFoundException("Hardware was not found in the current Tenant."); if (user.Role is not (UserRole.FarmOwner or UserRole.Farmer or UserRole.PlatformTechnician or UserRole.PlatformAdmin)) throw new AuthorizationException(); }
    private async Task ValidateModelsCoverAsync(IReadOnlyList<PlanItemInput> items, IReadOnlyList<EnvironmentalParameterCode> required, CancellationToken ct) { var ids = items.Select(x => x.DeviceModelId).Distinct().ToList(); var models = await db.DeviceModelDefinitions.Include(x => x.Capabilities).Where(x => ids.Contains(x.Id) && x.IsActive).ToListAsync(ct); if (models.Count != ids.Count) throw new RequestValidationException("items", "One or more Device Models are invalid."); var covered = models.SelectMany(x => x.Capabilities).Select(x => x.ParameterCode).Distinct(); if (required.Except(covered).Any()) throw new RequestValidationException("items", "The plan does not cover every required environmental parameter."); }
    private static void ValidatePlan(IReadOnlyList<PlanItemInput> items) { if (items.Count == 0 || items.Any(x => x.Quantity is < 1 or > 100) || items.Select(x => x.DeviceModelId).Distinct().Count() != items.Count) throw new RequestValidationException("items", "Plan items must be non-empty, unique by model and quantity 1–100."); }
    private static FirmwareReleaseView ToFirmwareReleaseView(FirmwareRelease x) => new(x.Id, x.HardwareTarget, x.Version, x.ProtocolVersion, x.SourceRepository, x.GitTag, x.CommitSha, x.ArtifactUrl, x.ArtifactSha256, x.ReleaseNotes, x.Status, x.PublishedAtUtc, x.ApprovedByUserId);
    private void ReplacePlan(DeploymentRequest r, IReadOnlyList<PlanItemInput> items) { db.DeploymentPlanItems.RemoveRange(r.PlanItems); foreach (var old in r.PlanItems.ToList()) r.PlanItems.Remove(old); AddPlan(r, items); }
    private void AddPlan(DeploymentRequest r, IEnumerable<PlanItemInput> items) { foreach (var x in items) { var item = new DeploymentPlanItem { DeploymentRequestId = r.Id, DeviceModelDefinitionId = x.DeviceModelId, Quantity = x.Quantity, InstallationNotes = Optional(x.InstallationNotes, 1000) }; r.PlanItems.Add(item); if (db.Entry(r).State != EntityState.Detached && db.Entry(r).State != EntityState.Added) db.DeploymentPlanItems.Add(item); } }
    private void AddDecision(DeploymentRequest r, Guid actor, string type, DeploymentRequestStatus from, DeploymentRequestStatus to, string? notes) { var d = new DeploymentDecisionHistory { DeploymentRequestId = r.Id, ActorUserId = actor, DecisionType = type, FromStatus = from.ToString(), ToStatus = to.ToString(), Notes = Optional(notes, 2000) }; r.Decisions.Add(d); if (db.Entry(r).State != EntityState.Detached && db.Entry(r).State != EntityState.Added) db.DeploymentDecisionHistory.Add(d); }
    private void Transition(DeploymentRequest r, Guid actor, string type, DeploymentRequestStatus next, string? notes) { var old = r.Status; r.Status = next; AddDecision(r, actor, type, old, next, notes); }
    private static void EnsureStatus(DeploymentRequest r, DeploymentRequestStatus expected) { if (expected == DeploymentRequestStatus.Installing && r.Status is DeploymentRequestStatus.Submitted or DeploymentRequestStatus.Accepted or DeploymentRequestStatus.Surveyed or DeploymentRequestStatus.PlanConfirmed) return; if (r.Status != expected) throw new ResourceConflictException($"Deployment Request must be {expected}; current status is {r.Status}."); }
    private static IReadOnlyList<EnvironmentalParameterCode> Parse(string csv) => csv.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Enum.Parse<EnvironmentalParameterCode>).ToList();
    private static DeviceConnectionTestView TestView(DeviceConnectionTest x) => new(x.Id, x.Succeeded, x.Rssi, x.Snr, x.RoundTripLatencyMs, x.ObservedAtUtc, x.ErrorCode, x.ErrorMessage);
    private static string Required(string? value, string field, int max) { var x = value?.Trim(); if (string.IsNullOrWhiteSpace(x) || x.Length > max) throw new RequestValidationException(field, $"Value is required and limited to {max} characters."); return x; }
    private static string? Optional(string? value, int max) { if (string.IsNullOrWhiteSpace(value)) return null; var x = value.Trim(); if (x.Length > max) throw new RequestValidationException("value", $"Value is limited to {max} characters."); return x; }
    private static void ValidateGps(decimal? lat, decimal? lng) { if (lat is < -90 or > 90 || lng is < -180 or > 180 || lat.HasValue != lng.HasValue) throw new RequestValidationException("gps", "Latitude and longitude must be supplied together and within valid ranges."); }
    private static string NormalizeMac(string value)
        => new(value.Where(Uri.IsHexDigit).Select(char.ToUpperInvariant).ToArray());
    [GeneratedRegex("^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}$")] private static partial Regex MacRegex();
}
