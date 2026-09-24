using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.TelemetryAlerts;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.TelemetryAlerts;

public sealed class MqttTelemetryAdapter(
    SmartFarmDbContext db,
    ITelemetryIngestionService ingestionService) : IMqttTelemetryAdapter
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        Converters = { new JsonStringEnumConverter() }
    };

    public async Task<TelemetryIngestionResult> ReceiveAsync(MqttInboundMessage message, CancellationToken cancellationToken)
    {
        var segments = message.Topic.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length != 4 || segments[0] != "smartfarm" || segments[1] != "gateways" || segments[3] != "telemetry" || !Guid.TryParse(segments[2], out var gatewayId))
            throw new RequestValidationException("topic", "Topic must match smartfarm/gateways/{gatewayId}/telemetry.");

        var clientId = message.Identity.ClientId.Trim();
        var fingerprint = NormalizeFingerprint(message.Identity.CertificateFingerprint);
        var authenticated = await db.Gateways.AsNoTracking().AnyAsync(
            x => x.Id == gatewayId && x.MqttClientId == clientId && x.ClientCertificateFingerprint == fingerprint,
            cancellationToken);
        if (!authenticated)
            throw new AuthenticationException("The MQTT gateway identity is invalid.");

        TelemetryPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<TelemetryPayload>(message.Payload.Span, JsonOptions);
        }
        catch (JsonException)
        {
            throw new RequestValidationException("payload", "Telemetry payload is not valid JSON or contains unsupported fields.");
        }

        if (payload is null)
            throw new RequestValidationException("payload", "Telemetry payload is required.");

        var envelope = new TelemetryEnvelope(
            payload.MessageId ?? string.Empty,
            payload.DeviceId,
            payload.ZoneId,
            payload.CapturedAtUtc,
            (payload.Readings ?? []).Select(x => new TelemetryValueInput(x.ParameterCode, x.Value, x.Unit ?? string.Empty)).ToList());
        return await ingestionService.IngestAsync(gatewayId, envelope, cancellationToken);
    }

    private static string NormalizeFingerprint(string value)
    {
        var normalized = value.Trim().Replace(":", "", StringComparison.Ordinal).ToUpperInvariant();
        if (normalized.Length != 64 || normalized.Any(c => !Uri.IsHexDigit(c)))
            throw new AuthenticationException("The MQTT certificate fingerprint is invalid.");
        return normalized;
    }

    private sealed class TelemetryPayload
    {
        public string? MessageId { get; init; }
        public Guid DeviceId { get; init; }
        public Guid ZoneId { get; init; }
        public DateTime CapturedAtUtc { get; init; }
        public List<TelemetryValuePayload>? Readings { get; init; }
    }

    private sealed class TelemetryValuePayload
    {
        public EnvironmentalParameterCode ParameterCode { get; init; }
        public decimal Value { get; init; }
        public string? Unit { get; init; }
    }
}
