using System.Text.Json;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using MQTTnet;
using MQTTnet.Protocol;
using MQTTnet.Server;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Application.Features.TelemetryAlerts;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.HostedServices;

/// <summary>
/// Development MQTT host for the ESP32-C3 v2 firmware. The firmware remains the
/// source of gateway/node configuration; this host only transports messages and
/// delegates validation/persistence to the existing application adapters.
/// </summary>
public sealed class MqttBrokerHost(
    IConfiguration configuration,
    IServiceScopeFactory scopes,
    ILogger<MqttBrokerHost> logger) : BackgroundService, IActuatorCommandTransport
{
    private MqttServer? server;
    private readonly ConcurrentDictionary<string, byte> connectedClients = new(StringComparer.Ordinal);

    public bool IsConnected(string clientId) => connectedClients.ContainsKey(clientId);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Mqtt:Enabled=false: không mở cổng (dùng cho kiểm thử tự động, nơi nhiều host chạy song song và sẽ tranh cổng 1883 với nhau và với backend đang chạy).
        if (!configuration.GetValue("Mqtt:Enabled", true))
        {
            logger.LogInformation("MQTT host disabled by configuration (Mqtt:Enabled=false).");
            return;
        }

        var port = configuration.GetValue<int>("Mqtt:Port", 1883);
        var listenAddress = configuration.GetValue<string>("Mqtt:ListenAddress") ?? "0.0.0.0";
        var options = new MqttServerOptionsBuilder()
            .WithDefaultEndpoint()
            .WithDefaultEndpointPort(port)
            .WithDefaultEndpointBoundIPAddress(System.Net.IPAddress.Parse(listenAddress))
            .WithConnectionBacklog(100)
            .Build();

        server = new MqttFactory().CreateMqttServer(options);
        server.ValidatingConnectionAsync += ValidateConnectionAsync;
        server.ClientConnectedAsync += args => { connectedClients[args.ClientId] = 0; logger.LogInformation("MQTT client connected: {ClientId}", args.ClientId); return Task.CompletedTask; };
        server.ClientDisconnectedAsync += args => { connectedClients.TryRemove(args.ClientId, out _); logger.LogInformation("MQTT client disconnected: {ClientId}", args.ClientId); return Task.CompletedTask; };
        server.InterceptingPublishAsync += HandlePublishAsync;
        server.StartedAsync += _ =>
        {
            logger.LogInformation("MQTT host started on {Address}:{Port}.", listenAddress, port);
            return Task.CompletedTask;
        };

        await server.StartAsync();
        try
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        finally
        {
            if (server.IsStarted)
                await server.StopAsync();
        }
    }

    private async Task ValidateConnectionAsync(ValidatingConnectionEventArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.ClientId))
        {
            args.ReasonCode = MQTTnet.Protocol.MqttConnectReasonCode.ClientIdentifierNotValid;
            args.ReasonString = "MQTT client ID is required.";
            return;
        }

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var exists = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AnyAsync(
            db.Gateways, gateway => gateway.MqttClientId == args.ClientId, CancellationToken.None);
        if (!exists)
        {
            args.ReasonCode = MQTTnet.Protocol.MqttConnectReasonCode.NotAuthorized;
            args.ReasonString = "MQTT client ID is not provisioned in SmartFarm.";
        }
    }

    private async Task HandlePublishAsync(InterceptingPublishEventArgs args)
    {
        var message = args.ApplicationMessage;
        if (message.Topic.EndsWith("/heartbeat", StringComparison.Ordinal))
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var gateway = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                db.Gateways, x => x.MqttClientId == args.ClientId, CancellationToken.None);
            if (gateway is null) return;

            var segments = message.Topic.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (segments.Length != 4 || segments[0] != "smartfarm" || segments[1] != "gateways" ||
                !Guid.TryParse(segments[2], out var topicGatewayId) || topicGatewayId != gateway.Id)
            {
                logger.LogWarning("MQTT heartbeat rejected because topic identity does not match client {ClientId}.", args.ClientId);
                return;
            }

            gateway.LastSeenAtUtc = DateTime.UtcNow;
            gateway.Status = SmartFarm.Domain.Enums.GatewayStatus.Online;
            await db.SaveChangesAsync(CancellationToken.None);
            logger.LogDebug("MQTT heartbeat accepted from {ClientId} for gateway {GatewayId}.", args.ClientId, gateway.Id);
        }
        else if (message.Topic.EndsWith("/telemetry", StringComparison.Ordinal))
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var gateway = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                db.Gateways, x => x.MqttClientId == args.ClientId, CancellationToken.None);
            if (gateway is null) return;

            var adapter = scope.ServiceProvider.GetRequiredService<IMqttTelemetryAdapter>();
            try
            {
                var result = await adapter.ReceiveAsync(
                    new MqttInboundMessage(message.Topic,
                        new GatewayTransportIdentity(args.ClientId, gateway.ClientCertificateFingerprint),
                        message.PayloadSegment), CancellationToken.None);
                logger.LogInformation("MQTT telemetry accepted from {ClientId} on {Topic}: device={DeviceId}, readings={ReadingCount}.",
                    args.ClientId, message.Topic, result.DeviceId, result.StoredReadings);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "MQTT telemetry rejected from {ClientId} on {Topic}.", args.ClientId, message.Topic);
            }
        }
        else if (message.Topic.EndsWith("/actuator-feedback", StringComparison.Ordinal))
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var gateway = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                db.Gateways, x => x.MqttClientId == args.ClientId, CancellationToken.None);
            if (gateway is null) return;
            var adapter = scope.ServiceProvider.GetRequiredService<IActuatorFeedbackAdapter>();
            await adapter.ReceiveAsync(
                new MqttActuatorFeedbackMessage(message.Topic,
                    new GatewayTransportIdentity(args.ClientId, gateway.ClientCertificateFingerprint),
                    message.PayloadSegment), CancellationToken.None);
        }
        else if (message.Topic.EndsWith("/config-ack", StringComparison.Ordinal))
        {
            var segments = message.Topic.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (segments.Length != 4 || !Guid.TryParse(segments[2], out var gatewayId)) return;
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var gateway = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                db.Gateways, x => x.Id == gatewayId && x.MqttClientId == args.ClientId, CancellationToken.None);
            if (gateway is null) return;
            try
            {
                using var document = JsonDocument.Parse(message.PayloadSegment);
                var acknowledgedVersion = document.RootElement.GetProperty("configVersion").GetInt32();
                if (acknowledgedVersion == gateway.ConfigVersion)
                {
                    gateway.ConfigSyncStatus = "Applied";
                    await db.SaveChangesAsync();
                    logger.LogInformation("Gateway configuration acknowledged: {GatewayId} version {ConfigVersion}.", gatewayId, acknowledgedVersion);
                }
            }
            catch (JsonException) { logger.LogWarning("Invalid configuration ACK from MQTT client {ClientId}.", args.ClientId); }
        }
    }

    public Task<CommandTransportResult> PublishAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
        => PublishCommandAsync(command, cancellationToken, isEmergencyStop: false);

    public Task<CommandTransportResult> PublishEmergencyStopAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
        => PublishCommandAsync(command, cancellationToken, isEmergencyStop: true);

    public async Task PublishGatewayConfigurationAsync(GatewayFirmwareConfigView config, CancellationToken cancellationToken)
    {
        if (server is null || !server.IsStarted) return;
        var payload = JsonSerializer.Serialize(new
        {
            type = "CONFIG",
            configVersion = config.ConfigVersion,
            gatewayId = config.GatewayId,
            gatewaySerial = config.GatewaySerial,
            farmId = config.FarmId,
            zoneId = config.ZoneId,
            telemetryIntervalSec = config.TelemetryIntervalSec,
            samplesPerInterval = config.SamplesPerInterval,
            pollingIntervalSeconds = config.PollingIntervalSeconds,
            heartbeatIntervalSeconds = config.HeartbeatIntervalSeconds,
            responseTimeoutMs = config.ResponseTimeoutMs,
            retryCount = config.RetryCount,
            mqtt = new { host = config.MqttHost, port = config.MqttPort, clientId = config.MqttClientId, fingerprint = config.ClientCertificateFingerprint },
            nodes = config.Nodes
        });
        var message = new MqttApplicationMessageBuilder()
            .WithTopic(config.CommandTopic)
            .WithPayload(payload)
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build();
        await server.InjectApplicationMessage(new InjectedMqttApplicationMessage(message) { SenderClientId = "smartfarm-backend" });
    }

    private async Task<CommandTransportResult> PublishCommandAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken, bool isEmergencyStop)
    {
        if (server is null || !server.IsStarted)
            return new(false, "BROKER_OFFLINE", "MQTT host is not running.");

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var actuator = await db.DeviceActuators
            .Include(x => x.Device)
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == command.ActuatorId, cancellationToken);
        if (actuator?.Device is null)
            return new(false, "ACTUATOR_NOT_FOUND", "Actuator mapping was not found.");

        var payload = JsonSerializer.Serialize(new
        {
            commandId = command.CommandId,
            deviceId = command.DeviceId,
            actuatorId = command.ActuatorId,
            nodeHardwareAddress = actuator.Device.HardwareAddress,
            relayChannel = actuator.RelayChannel,
            action = command.Action.ToString(),
            durationSeconds = command.DurationSeconds,
            hardwareCutoffAtUtc = command.HardwareCutoffAtUtc
        });
        var topic = $"smartfarm/gateways/{command.GatewayId}/commands";
        var message = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(payload)
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build();
        await server.InjectApplicationMessage(new InjectedMqttApplicationMessage(message)
        {
            SenderClientId = "smartfarm-backend"
        });

        if (configuration.GetValue<bool>("SimulatedIot:Enabled", false))
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(isEmergencyStop ? 800 : 1500, CancellationToken.None);
                    using var scope = scopes.CreateScope();
                    var control = scope.ServiceProvider.GetRequiredService<IControlService>();

                    if (isEmergencyStop)
                    {
                        await control.ApplyFeedbackAsync(new ActuatorFeedbackEnvelope(
                            command.GatewayId,
                            command.CommandId,
                            command.DeviceId,
                            ActuatorCommandStatus.Cancelled,
                            "Off",
                            DateTime.UtcNow,
                            null,
                            null), CancellationToken.None);
                        return;
                    }

                    await control.ApplyFeedbackAsync(new ActuatorFeedbackEnvelope(
                        command.GatewayId,
                        command.CommandId,
                        command.DeviceId,
                        ActuatorCommandStatus.Acknowledged,
                        command.Action == ActuatorCommandAction.TurnOn ? "Running" : "Off",
                        DateTime.UtcNow,
                        null,
                        null), CancellationToken.None);

                    if (command.Action != ActuatorCommandAction.TurnOn) return;

                    var demoDuration = configuration.GetValue<int>("SimulatedIot:DemoIrrigationSeconds", 30);
                    var runSeconds = demoDuration > 0 ? demoDuration : command.DurationSeconds;
                    await Task.Delay(TimeSpan.FromSeconds(runSeconds), CancellationToken.None);

                    using var completionScope = scopes.CreateScope();
                    var db = completionScope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
                    var notif = completionScope.ServiceProvider.GetRequiredService<INotificationService>();
                    var cmd = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleOrDefaultAsync(
                        db.ActuatorCommands
                            .Include(c => c.Events)
                            .Include(c => c.Zone)
                            .Include(c => c.Actuator),
                        c => c.Id == command.CommandId, CancellationToken.None);

                    if (cmd == null || cmd.Status != ActuatorCommandStatus.Acknowledged || cmd.CancellationRequestedAtUtc != null)
                        return;

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
                        Detail = $"Hoàn tất chu kỳ điều khiển mô phỏng ({command.DurationSeconds / 60} phút).",
                        ObservedState = "Off"
                    });
                    await db.SaveChangesAsync(CancellationToken.None);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Simulated feedback failed for command {CommandId}", command.CommandId);
                }
            });
        }

        return new(true);
    }
}
