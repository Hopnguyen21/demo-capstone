using System.Text.Json;
using System.Collections.Concurrent;
using MQTTnet;
using MQTTnet.Protocol;
using MQTTnet.Server;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Application.Features.TelemetryAlerts;
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
        if (message.Topic.EndsWith("/telemetry", StringComparison.Ordinal))
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
    }

    public Task<CommandTransportResult> PublishAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
        => PublishCommandAsync(command, cancellationToken);

    public Task<CommandTransportResult> PublishEmergencyStopAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
        => PublishCommandAsync(command, cancellationToken);

    private async Task<CommandTransportResult> PublishCommandAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken)
    {
        if (server is null || !server.IsStarted)
            return new(false, "BROKER_OFFLINE", "MQTT host is not running.");

        var payload = JsonSerializer.Serialize(new
        {
            commandId = command.CommandId,
            deviceId = command.DeviceId,
            actuatorId = command.ActuatorId,
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
        return new(true);
    }
}
