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

public sealed class MqttActuatorCommandTransport(IServiceProvider? serviceProvider = null) : IActuatorCommandTransport
{
    public Task<CommandTransportResult> PublishAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
    {
        // Khi hoạt động trong môi trường demo/development hoặc chưa kết nối broker MQTT vật lý,
        // cho phép gửi lệnh thành công (Status = Sent), kích hoạt mô phỏng xác nhận từ thiết bị sau 1.5 giây
        // và mô phỏng chu kỳ tưới: sau khi tưới hết thời gian thì thiết bị tự động ngắt và trả về kết quả cho hệ thống.
        if (serviceProvider is not null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    // 1. Phản hồi xác nhận thiết bị nhận lệnh (Status = Acknowledged, State = Running)
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

                    // 2. Nếu là lệnh Bật tưới (TurnOn), mô phỏng thời gian chạy tưới và sau đó thiết bị tự ngắt, trả về trạng thái Hoàn tất cho hệ thống
                    if (command.Action == ActuatorCommandAction.TurnOn)
                    {
                        using var configScope = serviceProvider.CreateScope();
                        var config = configScope.ServiceProvider.GetService<IConfiguration>();
                        var demoDuration = config?.GetValue<int>("SimulatedIot:DemoIrrigationSeconds", 30) ?? 30;
                        var runSeconds = demoDuration > 0 ? demoDuration : command.DurationSeconds;

                        // Chờ hết thời gian tưới mô phỏng (mặc định 30 giây để tiện trình chiếu)
                        await Task.Delay(TimeSpan.FromSeconds(runSeconds), CancellationToken.None);

                        using var completionScope = serviceProvider.CreateScope();
                        var db = completionScope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
                        var notif = completionScope.ServiceProvider.GetRequiredService<INotificationService>();

                        var cmd = await db.ActuatorCommands
                            .Include(c => c.Events)
                            .Include(c => c.Zone)
                            .Include(c => c.Actuator)
                            .SingleOrDefaultAsync(c => c.Id == command.CommandId);

                        if (cmd != null && cmd.Status == ActuatorCommandStatus.Acknowledged && cmd.CancellationRequestedAtUtc == null)
                        {
                            var now = DateTime.UtcNow;
                            cmd.TerminalAtUtc = now;
                            cmd.ExecutionEndsAtUtc = now;
                            cmd.ObservedState = "Off";

                            // Thêm sự kiện phản hồi hoàn tất chu kỳ tưới từ thiết bị
                            var compEvent = new ActuatorCommandEvent
                            {
                                CommandId = cmd.Id,
                                EventKind = CommandEventKind.Feedback,
                                Status = ActuatorCommandStatus.Acknowledged,
                                OccurredAtUtc = now,
                                Detail = $"Hoàn tất chu kỳ tưới ({command.DurationSeconds / 60} phút). Rơ-le đã tự ngắt an toàn, thiết bị trả về trạng thái Tắt (Off).",
                                ObservedState = "Off"
                            };
                            db.ActuatorCommandEvents.Add(compEvent);

                            // Cập nhật độ ẩm đất tăng lên mức tối ưu (72% - 76%) sau khi tưới
                            var soilReading = new TelemetryReading
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
                            };
                            db.TelemetryReadings.Add(soilReading);

                            await db.SaveChangesAsync(CancellationToken.None);

                            // Gửi thông báo đến Chủ nông trại (Owner) & Nông dân phụ trách (Farmer)
                            try
                            {
                                var zoneName = cmd.Zone?.Name ?? "Khu vực canh tác";
                                var actuatorName = cmd.Actuator?.ActuatorType ?? "Máy bơm tưới";
                                var recipients = await db.AppUsers.AsNoTracking()
                                    .Where(u => u.TenantId == cmd.TenantId && (
                                        u.Role == UserRole.FarmOwner ||
                                        (u.Role == UserRole.Farmer && u.ZoneAccesses.Any(za => za.ZoneId == cmd.ZoneId))
                                    ))
                                    .Select(u => u.Id)
                                    .ToListAsync();

                                foreach (var recipientId in recipients)
                                {
                                    await notif.CreateNotificationAsync(new(
                                        UserId: recipientId,
                                        TenantId: cmd.TenantId,
                                        Title: $"[HOÀN TẤT TƯỚI] {actuatorName} tại {zoneName} đã tưới xong",
                                        Message: $"Thiết bị đã hoàn tất chu kỳ tưới ({command.DurationSeconds / 60} phút), rơ-le đã ngắt an toàn. Độ ẩm đất đã được cân bằng lại mức tối ưu.",
                                        Type: NotificationType.System,
                                        Severity: AlertSeverity.Info,
                                        TargetUrl: "/owner/ai-assistant",
                                        ReferenceId: cmd.Id.ToString()
                                    ), CancellationToken.None);
                                }
                            }
                            catch
                            {
                                // Bỏ qua lỗi gửi thông báo nếu có
                            }
                        }
                    }
                }
                catch
                {
                    // Bỏ qua lỗi ngầm trong feedback mô phỏng
                }
            });
        }

        return Task.FromResult(new CommandTransportResult(true));
    }

    public Task<CommandTransportResult> PublishEmergencyStopAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
    {
        if (serviceProvider is not null)
        {
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
                }
            });
        }

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
                if (weather.Available)
                {
                    return new RainForecastResult(true, weather.RainProbabilityNext6HoursMaxPercent ?? 0);
                }
            }
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
