using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Application.Features.Control;

namespace SmartFarm.Application.Common.Interfaces;

public interface IFirmwareOtaTransport
{
    Task<CommandTransportResult> PublishAsync(Guid gatewayId, string commandId, string version, string firmwareUrl, string artifactSha256, CancellationToken cancellationToken);
}
