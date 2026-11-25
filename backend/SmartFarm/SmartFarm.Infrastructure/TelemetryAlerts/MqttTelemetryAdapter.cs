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
        if (segments.Length != 4 || segments[0] != "smartfarm" || segments[1] != "gateways" || segments[3] != "telemetry")
            throw new RequestValidationException("topic", "Topic must match smartfarm/gateways/{gatewayId|serial}/telemetry.");

        var clientId = message.Identity.ClientId.Trim();
        var fingerprint = NormalizeFingerprint(message.Identity.CertificateFingerprint);
        var gatewayId = Guid.TryParse(segments[2], out var parsedGatewayId)
            ? parsedGatewayId
            : await db.Gateways.AsNoTracking().Where(x => x.GatewaySerial == segments[2])
                .Select(x => x.Id).SingleOrDefaultAsync(cancellationToken);
        var authenticated = gatewayId != Guid.Empty && await db.Gateways.AsNoTracking().AnyAsync(
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

        var device = payload.DeviceId != Guid.Empty
            ? await db.Devices.AsNoTracking().SingleOrDefaultAsync(x => x.Id == payload.DeviceId && x.GatewayId == gatewayId, cancellationToken)
            : await db.Devices.AsNoTracking().SingleOrDefaultAsync(x => x.GatewayId == gatewayId && x.HardwareAddress == (payload.NodeHardwareAddress ?? string.Empty), cancellationToken);
        if (device is null || !device.ZoneId.HasValue)
            throw new ResourceNotFoundException("Telemetry Node is not assigned to a Zone.");
        var envelope = new TelemetryEnvelope(
            payload.MessageId ?? $"mqtt-{gatewayId:N}-{device.Id:N}-{DateTime.UtcNow.Ticks}",
            device.Id,
            payload.ZoneId == Guid.Empty ? device.ZoneId.Value : payload.ZoneId,
            payload.CapturedAtUtc == default ? DateTime.UtcNow : payload.CapturedAtUtc,
            (payload.Readings ?? []).Select(x => new TelemetryValueInput(x.ParameterCode, x.Value, x.Unit ?? string.Empty)).ToList(),
            payload.SequenceNumber);
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
        public string? GatewaySerial { get; init; }
        public string? MacAddress { get; init; }
        public long? SequenceNumber { get; init; }
        public Guid DeviceId { get; init; }
        public Guid ZoneId { get; init; }
        public DateTime CapturedAtUtc { get; init; }
        public string? NodeHardwareAddress { get; init; }
        public List<TelemetryValuePayload>? Readings { get; init; }
    }

    private sealed class TelemetryValuePayload
    {
        public EnvironmentalParameterCode ParameterCode { get; init; }
        public decimal Value { get; init; }
        public string? Unit { get; init; }
    }
}
