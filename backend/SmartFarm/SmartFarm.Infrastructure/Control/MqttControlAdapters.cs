using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Control;

public sealed class MqttActuatorCommandTransport(
    IServiceProvider serviceProvider,
    IConfiguration configuration) : IActuatorCommandTransport
{
    private bool IsSimulationEnabled
    {
        get
        {
            var env = configuration.GetValue<string>("ASPNETCORE_ENVIRONMENT")
                ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                ?? "Production";
            var isDev = string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase);
            return isDev && configuration.GetValue<bool>("SimulatedIot:Enabled", false);
        }
    }

    public Task<CommandTransportResult> PublishAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
    {
        if (!IsSimulationEnabled)
        {
            return Task.FromResult(new CommandTransportResult(
                false,
                "MQTT_NOT_CONFIGURED",
                "No MQTT downlink publisher is configured; simulated dispatch is disabled."));
        }

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(1500, CancellationToken.None);
                using (var scope = serviceProvider.CreateScope())
                {
                    var control = scope.ServiceProvider.GetRequiredService<IControlService>();
                    await control.ApplyFeedbackAsync(new ActuatorFeedbackEnvelope(
                        command.GatewayId,
                        command.CommandId,
                        command.DeviceId,
                        ActuatorCommandStatus.Acknowledged,
                        command.Action == ActuatorCommandAction.TurnOn ? "Running" : "Off",
                        DateTime.UtcNow,
                        null,
                        null), CancellationToken.None);
                }

                if (command.Action != ActuatorCommandAction.TurnOn)
                {
                    return;
                }

                var demoDuration = configuration.GetValue<int>("SimulatedIot:DemoIrrigationSeconds", 30);
                var runSeconds = demoDuration > 0 ? demoDuration : command.DurationSeconds;
                await Task.Delay(TimeSpan.FromSeconds(runSeconds), CancellationToken.None);

                using var completionScope = serviceProvider.CreateScope();
                var db = completionScope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
                var notif = completionScope.ServiceProvider.GetRequiredService<INotificationService>();
                var cmd = await db.ActuatorCommands
                    .Include(c => c.Events)
                    .Include(c => c.Zone)
                    .Include(c => c.Actuator)
                    .SingleOrDefaultAsync(c => c.Id == command.CommandId, CancellationToken.None);

                if (cmd == null || cmd.Status != ActuatorCommandStatus.Acknowledged || cmd.CancellationRequestedAtUtc != null)
                {
                    return;
                }

                var now = DateTime.UtcNow;
                cmd.TerminalAtUtc = now;
                cmd.ExecutionEndsAtUtc = now;
                cmd.ObservedState = "Off";
                db.ActuatorCommandEvents.Add(new ActuatorCommandEvent
                {
                    CommandId = cmd.Id,
                    EventKind = CommandEventKind.Feedback,
                    Status = ActuatorCommandStatus.Acknowledged,
                    OccurredAtUtc = now,
                    Detail = $"Hoàn tất chu kỳ tưới mô phỏng ({command.DurationSeconds / 60} phút).",
                    ObservedState = "Off"
                });
                db.TelemetryReadings.Add(new TelemetryReading
                {
                    TenantId = cmd.TenantId,
                    FarmId = cmd.FarmId,
                    ZoneId = cmd.ZoneId,
                    DeviceId = cmd.DeviceId,
                    GatewayId = cmd.GatewayId,
                    MessageId = $"sim-irrigation-complete-{now.Ticks}",
                    ParameterCode = EnvironmentalParameterCode.SoilMoisture,
                    Value = (decimal)(72.0 + Random.Shared.NextDouble() * 5.0),
                    Unit = "%",
                    CapturedAtUtc = now,
                    ReceivedAtUtc = now
                });
                await db.SaveChangesAsync(CancellationToken.None);

                try
                {
                    var zoneName = cmd.Zone?.Name ?? "Khu vực canh tác";
                    var actuatorName = cmd.Actuator?.ActuatorType ?? "Máy bơm tưới";
                    var recipients = await db.AppUsers.AsNoTracking()
                        .Where(u => u.TenantId == cmd.TenantId && (
                            u.Role == UserRole.FarmOwner ||
                            (u.Role == UserRole.Farmer && u.ZoneAccesses.Any(za => za.ZoneId == cmd.ZoneId))))
                        .Select(u => u.Id)
                        .ToListAsync(CancellationToken.None);

                    foreach (var recipientId in recipients)
                    {
                        await notif.CreateNotificationAsync(new(
                            UserId: recipientId,
                            TenantId: cmd.TenantId,
                            Title: $"[HOÀN TẤT TƯỚI MÔ PHỎNG] {actuatorName} tại {zoneName}",
                            Message: $"Chu kỳ tưới mô phỏng đã hoàn tất ({command.DurationSeconds / 60} phút). Không có xác nhận từ thiết bị phần cứng.",
                            Type: NotificationType.System,
                            Severity: AlertSeverity.Info,
                            TargetUrl: "/owner/ai-assistant",
                            ReferenceId: cmd.Id.ToString()
                        ), CancellationToken.None);
                    }
                }
                catch
                {
                    // Notification failure must not alter the command execution record.
                }
            }
            catch
            {
                // Failed simulated feedback remains unconfirmed and will follow command timeout handling.
            }
        }, CancellationToken.None);

        return Task.FromResult(new CommandTransportResult(true));
    }

    public Task<CommandTransportResult> PublishEmergencyStopAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
    {
        if (!IsSimulationEnabled)
        {
            return Task.FromResult(new CommandTransportResult(
                false,
                "MQTT_NOT_CONFIGURED",
                "No MQTT emergency-stop publisher is configured; simulated dispatch is disabled."));
        }

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(1000, CancellationToken.None);
                using var scope = serviceProvider.CreateScope();
                var control = scope.ServiceProvider.GetRequiredService<IControlService>();
                await control.ApplyFeedbackAsync(new ActuatorFeedbackEnvelope(
                    command.GatewayId,
                    command.CommandId,
                    command.DeviceId,
                    ActuatorCommandStatus.Cancelled,
                    "Off",
                    DateTime.UtcNow,
                    null,
                    null), CancellationToken.None);
            }
            catch
            {
                // Failed simulated feedback remains unconfirmed and will follow command timeout handling.
            }
        }, CancellationToken.None);

        return Task.FromResult(new CommandTransportResult(true));
    }
}

public sealed class UnavailableRainForecastProvider(IServiceProvider serviceProvider) : IRainForecastProvider
{
    public async Task<RainForecastResult> GetAsync(Guid farmId, CancellationToken cancellationToken)
    {
        try
        {
            var weatherProvider = serviceProvider.GetService<IAiWeatherProvider>();
            if (weatherProvider is not null)
            {
                var weather = await weatherProvider.GetAsync(farmId, Guid.Empty, cancellationToken);
                var probability = weather.RainProbabilityNext6HoursMaxPercent;
                if (weather.Available && probability is >= 0 and <= 100)
                {
                    return new RainForecastResult(true, probability);
                }
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            // Fallback gracefully below
        }

        // Fail-safe: Khi không có dữ liệu thời tiết thực tế từ Open-Meteo hoặc gặp sự cố mạng,
        // trả về Available = false (Probability = null) để kích hoạt cơ chế tạm hoãn tưới tự động
        // theo đúng CONTROL_CONTRACT_V1 và SRS, không diễn giải outage thành 0% gây nguy cơ ngập úng.
        return new RainForecastResult(false, null);
    }
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
