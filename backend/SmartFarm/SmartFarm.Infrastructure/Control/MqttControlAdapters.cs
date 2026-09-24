using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Control;

public sealed class MqttActuatorCommandTransport : IActuatorCommandTransport
{
    public Task<CommandTransportResult> PublishAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken) => Task.FromResult(new CommandTransportResult(false, "MQTT_NOT_CONFIGURED", "No MQTT downlink publisher is configured."));
    public Task<CommandTransportResult> PublishEmergencyStopAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken) => Task.FromResult(new CommandTransportResult(false, "MQTT_NOT_CONFIGURED", "No MQTT emergency-stop publisher is configured."));
}

public sealed class UnavailableRainForecastProvider : IRainForecastProvider
{
    public Task<RainForecastResult> GetAsync(Guid farmId, CancellationToken cancellationToken) => Task.FromResult(new RainForecastResult(false, null));
}

public sealed class MqttActuatorFeedbackAdapter(SmartFarmDbContext db, IControlService control) : IActuatorFeedbackAdapter
{
    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, Converters = { new JsonStringEnumConverter() } };

    public async Task<ActuatorCommandView> ReceiveAsync(MqttActuatorFeedbackMessage message, CancellationToken cancellationToken)
    {
        var parts = message.Topic.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries); if (parts.Length != 4 || parts[0] != "smartfarm" || parts[1] != "gateways" || parts[3] != "actuator-feedback" || !Guid.TryParse(parts[2], out var gatewayId)) throw new RequestValidationException("topic", "Topic must match smartfarm/gateways/{gatewayId}/actuator-feedback.");
        var fingerprint = message.Identity.CertificateFingerprint.Trim().Replace(":", "", StringComparison.Ordinal).ToUpperInvariant(); if (fingerprint.Length != 64 || fingerprint.Any(c => !Uri.IsHexDigit(c))) throw new AuthenticationException("The MQTT certificate fingerprint is invalid.");
        var authenticated = await db.Gateways.AsNoTracking().AnyAsync(x => x.Id == gatewayId && x.MqttClientId == message.Identity.ClientId.Trim() && x.ClientCertificateFingerprint == fingerprint, cancellationToken); if (!authenticated) throw new AuthenticationException("The MQTT gateway identity is invalid.");
        FeedbackPayload? payload; try { payload = JsonSerializer.Deserialize<FeedbackPayload>(message.Payload.Span, Options); } catch (JsonException) { throw new RequestValidationException("payload", "Actuator feedback is not valid JSON."); } if (payload is null) throw new RequestValidationException("payload", "Actuator feedback is required.");
        return await control.ApplyFeedbackAsync(new(gatewayId, payload.CommandId, payload.DeviceId, payload.Status, payload.ObservedState, payload.OccurredAtUtc, payload.ErrorCode, payload.ErrorMessage), cancellationToken);
    }

    private sealed class FeedbackPayload { public Guid CommandId { get; init; } public Guid DeviceId { get; init; } public ActuatorCommandStatus Status { get; init; } public string? ObservedState { get; init; } public DateTime OccurredAtUtc { get; init; } public string? ErrorCode { get; init; } public string? ErrorMessage { get; init; } }
}
