using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.IoTDeployment;

public static class IoTDeploymentMapping
{
    public static DeploymentRequestView ToView(this DeploymentRequest x) => new(x.Id, x.TenantId, x.FarmId, x.ZoneId, x.PlantingSeasonId, x.OwnerUserId, x.TechnicianUserId, x.Status, ParseParameters(x.RequiredParametersCsv), x.OwnerNotes, x.FailureCode, x.FailureDescription, x.PlanItems.OrderBy(i => i.CreatedAtUtc).Select(i => new PlanItemView(i.Id, i.DeviceModelDefinitionId, i.DeviceModelDefinition.Name, i.DeviceModelDefinition.DeviceType, i.Quantity, i.InstallationNotes)).ToList(), x.Surveys.OrderBy(s => s.CreatedAtUtc).Select(s => new SurveyView(s.Id, s.TechnicianUserId, s.IsFeasible, s.SiteConditions, s.Notes, s.CreatedAtUtc)).ToList(), x.Decisions.OrderBy(d => d.CreatedAtUtc).Select(d => new DecisionView(d.Id, d.ActorUserId, d.DecisionType, d.FromStatus, d.ToStatus, d.Notes, d.CreatedAtUtc)).ToList());
    public static GatewayView ToView(this Gateway x) => new(x.Id, x.FarmId, x.DeploymentRequestId, x.MacAddress, x.GatewaySerial, x.FrequencyBand, x.FirmwareVersion, x.MqttClientId, x.Status, x.LastSeenAtUtc, x.Devices.Count(d => d.Status != DeviceStatus.Decommissioned));
    public static DeviceView ToView(this Device x)
    {
        var test = x.ConnectionTests.OrderByDescending(t => t.ObservedAtUtc).FirstOrDefault();
        return new(x.Id, x.FarmId, x.GatewayId, x.DeploymentRequestId, x.ZoneId, x.DeviceModelDefinitionId, x.HardwareAddress, x.DeviceType, x.Status, x.InstallationNotes, x.Sensors.Select(s => s.SensorType).ToList(), x.Actuators.Select(a => a.ActuatorType).ToList(), test is null ? null : new(test.Id, test.Succeeded, test.Rssi, test.Snr, test.RoundTripLatencyMs, test.ObservedAtUtc, test.ErrorCode, test.ErrorMessage));
    }
    private static IReadOnlyList<EnvironmentalParameterCode> ParseParameters(string csv) => csv.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Enum.Parse<EnvironmentalParameterCode>).ToList();
}
