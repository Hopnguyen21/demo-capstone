using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Users;

public sealed record InviteFarmerByEmailCommand(string Email, Guid FarmId);

/// <summary>Lời mời gửi tới tài khoản Farmer bằng thông báo trong ứng dụng.</summary>
public sealed record FarmInvitationView(
    Guid Id,
    Guid FarmId,
    string FarmName,
    string Email,
    FarmInvitationStatus Status,
    DateTime CreatedAtUtc,
    DateTime ExpiresAtUtc,
    DateTime? RespondedAtUtc,
    int SendCount,
    DateTime? LastSentAtUtc);

public interface IFarmInvitationService
{
    Task<FarmInvitationView> InviteAsync(Guid ownerId, InviteFarmerByEmailCommand command, CancellationToken ct);
    Task<IReadOnlyList<FarmInvitationView>> ListForFarmAsync(Guid ownerId, Guid farmId, CancellationToken ct);
    Task<FarmInvitationView> ResendAsync(Guid ownerId, Guid invitationId, CancellationToken ct);
    Task<FarmInvitationView> CancelAsync(Guid ownerId, Guid invitationId, CancellationToken ct);
    Task<IReadOnlyList<FarmInvitationView>> ListMineAsync(Guid farmerId, CancellationToken ct);
    Task<FarmInvitationView> AcceptAsync(Guid farmerId, Guid invitationId, CancellationToken ct);
    Task<FarmInvitationView> DeclineAsync(Guid farmerId, Guid invitationId, CancellationToken ct);
}
