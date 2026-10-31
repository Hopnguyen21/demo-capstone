using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Notifications;
using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Identity;

public sealed class InvitationOptions
{
    public const string SectionName = "Invitations";
    public int ExpiryDays { get; set; } = 7;
}

/// <summary>
/// Mời Farmer vào nhân công của Farm bằng thông báo trong ứng dụng. Lời mời không gắn Farmer vào Farm cho tới khi chính Farmer đó (đăng nhập, email khớp, role Farmer) chấp nhận.
/// Không cấp quyền Zone hay quyền điều khiển thiết bị.
/// </summary>
internal sealed class FarmInvitationService(
    SmartFarmDbContext db,
    TimeProvider clock,
    INotificationService notifications,
    IOptions<InvitationOptions> options,
    ILogger<FarmInvitationService> logger) : IFarmInvitationService
{
    private const string NoEligibleFarmerMessage =
        "Không tìm thấy tài khoản Farmer phù hợp với email này. Hãy nhờ người nhận đăng ký tài khoản với vai trò Farmer trước, rồi mời lại.";

    public async Task<FarmInvitationView> InviteAsync(Guid ownerId, InviteFarmerByEmailCommand command, CancellationToken ct)
    {
        var owner = await GetOwnerAsync(ownerId, ct);
        var farm = await db.Farms.SingleOrDefaultAsync(x => x.Id == command.FarmId && x.TenantId == owner.TenantId && x.ArchivedAtUtc == null, ct)
            ?? throw new ResourceNotFoundException("Farm was not found in the current Tenant.");

        string normalized;
        try { normalized = AuthService.NormalizeEmail(command.Email); }
        catch (RequestValidationException) { throw new RequestValidationException("email", "Email không hợp lệ."); }

        var farmer = await db.AppUsers.SingleOrDefaultAsync(x => x.NormalizedEmail == normalized && x.Role == UserRole.Farmer, ct);
        // Không phân biệt "không có tài khoản" với "tài khoản thuộc tổ chức khác" để không lộ sự tồn tại của tài khoản ngoài Tenant.
        if (farmer is null || (farmer.TenantId.HasValue && farmer.TenantId != owner.TenantId))
            throw new ResourceNotFoundException(NoEligibleFarmerMessage);
        if (farmer.Status != AccountStatus.Active)
            throw new ResourceConflictException("Tài khoản Farmer này đang không hoạt động.");
        if (farmer.FarmId == farm.Id)
            throw new ResourceConflictException("Farmer này đã là nhân công của Farm.");
        if (farmer.FarmId.HasValue)
            throw new ResourceConflictException("Farmer này đã thuộc một Farm khác trong tổ chức của bạn. Hiện mỗi Farmer chỉ thuộc một Farm.");

        var now = clock.GetUtcNow().UtcDateTime;
        await ExpireOverdueAsync(farm.Id, ct);
        if (await db.FarmInvitations.AnyAsync(x => x.FarmId == farm.Id && x.NormalizedEmail == normalized && x.Status == FarmInvitationStatus.Pending, ct))
            throw new ResourceConflictException("Đã có lời mời đang chờ cho email này. Hãy gửi lại hoặc hủy lời mời cũ.");

        var invitation = new FarmInvitation
        {
            TenantId = owner.TenantId!.Value, FarmId = farm.Id, Farm = farm, InvitedByOwnerId = owner.Id,
            Email = farmer.Email, NormalizedEmail = normalized, InviteeUserId = farmer.Id,
            Status = FarmInvitationStatus.Pending, ExpiresAtUtc = now.AddDays(Math.Max(1, options.Value.ExpiryDays))
        };
        db.FarmInvitations.Add(invitation);
        await db.SaveChangesAsync(ct);

        await DeliverAsync(invitation, farm.Name, owner.FullName, farmer.Id, ct);
        return ToView(invitation);
    }

    public async Task<IReadOnlyList<FarmInvitationView>> ListForFarmAsync(Guid ownerId, Guid farmId, CancellationToken ct)
    {
        var owner = await GetOwnerAsync(ownerId, ct);
        if (!await db.Farms.AnyAsync(x => x.Id == farmId && x.TenantId == owner.TenantId, ct))
            throw new ResourceNotFoundException("Farm was not found in the current Tenant.");
        await ExpireOverdueAsync(farmId, ct);
        var rows = await db.FarmInvitations.AsNoTracking().Include(x => x.Farm)
            .Where(x => x.FarmId == farmId && x.TenantId == owner.TenantId)
            .OrderByDescending(x => x.CreatedAtUtc).Take(200).ToListAsync(ct);
        return rows.Select(ToView).ToList();
    }

    public async Task<FarmInvitationView> ResendAsync(Guid ownerId, Guid invitationId, CancellationToken ct)
    {
        var owner = await GetOwnerAsync(ownerId, ct);
        var invitation = await OwnedInvitationAsync(owner, invitationId, ct);
        await ExpireIfDueAsync(invitation, ct);
        if (invitation.Status != FarmInvitationStatus.Pending)
            throw new ResourceConflictException("Chỉ có thể gửi lại lời mời đang chờ. Hãy tạo lời mời mới.");

        invitation.ExpiresAtUtc = clock.GetUtcNow().UtcDateTime.AddDays(Math.Max(1, options.Value.ExpiryDays));
        await db.SaveChangesAsync(ct);

        await DeliverAsync(invitation, invitation.Farm.Name, owner.FullName, invitation.InviteeUserId, ct);
        return ToView(invitation);
    }

    public async Task<FarmInvitationView> CancelAsync(Guid ownerId, Guid invitationId, CancellationToken ct)
    {
        var owner = await GetOwnerAsync(ownerId, ct);
        var invitation = await OwnedInvitationAsync(owner, invitationId, ct);
        await ExpireIfDueAsync(invitation, ct);
        if (invitation.Status != FarmInvitationStatus.Pending)
            throw new ResourceConflictException("Chỉ có thể hủy lời mời đang chờ.");
        invitation.Status = FarmInvitationStatus.Cancelled;
        invitation.RespondedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return ToView(invitation);
    }

    public async Task<IReadOnlyList<FarmInvitationView>> ListMineAsync(Guid farmerId, CancellationToken ct)
    {
        var farmer = await GetFarmerAsync(farmerId, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        var rows = await db.FarmInvitations.Include(x => x.Farm)
            .Where(x => x.NormalizedEmail == farmer.NormalizedEmail && x.Status == FarmInvitationStatus.Pending).ToListAsync(ct);
        foreach (var expired in rows.Where(x => x.ExpiresAtUtc <= now)) { expired.Status = FarmInvitationStatus.Expired; expired.RespondedAtUtc = now; }
        if (rows.Any(x => x.Status == FarmInvitationStatus.Expired)) await db.SaveChangesAsync(ct);
        return rows.Where(x => x.Status == FarmInvitationStatus.Pending).OrderByDescending(x => x.CreatedAtUtc).Select(ToView).ToList();
    }

    public async Task<FarmInvitationView> AcceptAsync(Guid farmerId, Guid invitationId, CancellationToken ct)
    {
        var farmer = await GetFarmerAsync(farmerId, ct);
        // Email phải khớp tài khoản đang đăng nhập; không khớp thì coi như không tồn tại, không lộ lời mời của người khác.
        var invitation = await db.FarmInvitations.Include(x => x.Farm).SingleOrDefaultAsync(x => x.Id == invitationId && x.NormalizedEmail == farmer.NormalizedEmail, ct)
            ?? throw new ResourceNotFoundException("Lời mời không tồn tại.");
        return await AcceptCoreAsync(farmer, invitation, ct);
    }

    public async Task<FarmInvitationView> DeclineAsync(Guid farmerId, Guid invitationId, CancellationToken ct)
    {
        var farmer = await GetFarmerAsync(farmerId, ct);
        var invitation = await db.FarmInvitations.Include(x => x.Farm).SingleOrDefaultAsync(x => x.Id == invitationId && x.NormalizedEmail == farmer.NormalizedEmail, ct)
            ?? throw new ResourceNotFoundException("Lời mời không tồn tại.");
        await ExpireIfDueAsync(invitation, ct);
        EnsurePending(invitation);
        invitation.Status = FarmInvitationStatus.Declined;
        invitation.RespondedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        await NotifyAsync(invitation.InvitedByOwnerId, invitation.TenantId, "Farmer từ chối lời mời",
            $"{farmer.FullName} đã từ chối lời mời tham gia {invitation.Farm.Name}.", $"farm-invitation:{invitation.Id}:declined", "/owner/farmers", ct);
        return ToView(invitation);
    }

    private async Task<FarmInvitationView> AcceptCoreAsync(AppUser farmer, FarmInvitation invitation, CancellationToken ct)
    {
        try
        {
            return await AcceptWithinTransactionAsync(farmer, invitation, ct);
        }
        // Hai lần chấp nhận đồng thời: bên thua bị cơ sở dữ liệu từ chối (lỗi tuần tự hóa); trả 409 thay vì lỗi máy chủ.
        catch (Exception ex) when (IsConcurrencyConflict(ex))
        {
            throw new ResourceConflictException("Lời mời vừa được xử lý ở nơi khác. Hãy tải lại danh sách lời mời.");
        }
    }

    private static bool IsConcurrencyConflict(Exception ex)
    {
        for (var e = ex; e is not null; e = e.InnerException)
            if (e is Npgsql.PostgresException { SqlState: "40001" or "40P01" or "23505" }) return true;
        return ex is DbUpdateConcurrencyException;
    }

    private async Task<FarmInvitationView> AcceptWithinTransactionAsync(AppUser farmer, FarmInvitation invitation, CancellationToken ct)
    {
        await using var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;

        // Đọc lại trong transaction để hai lần chấp nhận đồng thời không cùng thành công.
        await db.Entry(invitation).ReloadAsync(ct);
        await db.Entry(farmer).ReloadAsync(ct);
        await ExpireIfDueAsync(invitation, ct);
        EnsurePending(invitation);
        if (farmer.Status != AccountStatus.Active) throw new ResourceConflictException("Tài khoản Farmer này đang không hoạt động.");
        if (farmer.FarmId.HasValue || farmer.TenantId.HasValue)
            throw new ResourceConflictException(farmer.FarmId == invitation.FarmId
                ? "Bạn đã là nhân công của Farm này."
                : "Bạn đang thuộc một Farm khác nên chưa thể tham gia Farm này. Hiện mỗi Farmer chỉ thuộc một Farm.");
        if (!await db.Farms.AnyAsync(x => x.Id == invitation.FarmId && x.TenantId == invitation.TenantId && x.ArchivedAtUtc == null, ct))
            throw new ResourceConflictException("Farm này không còn hoạt động.");

        var now = clock.GetUtcNow().UtcDateTime;
        farmer.TenantId = invitation.TenantId;
        farmer.FarmId = invitation.FarmId;
        invitation.Status = FarmInvitationStatus.Accepted;
        invitation.RespondedAtUtc = now;
        // Không tạo UserZoneAccess nào: quyền Zone/điều khiển là quyền riêng do Owner cấp.
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);

        await NotifyAsync(invitation.InvitedByOwnerId, invitation.TenantId, "Farmer đã tham gia Farm",
            $"{farmer.FullName} đã chấp nhận lời mời tham gia {invitation.Farm.Name}. Hãy cấp quyền truy cập Zone cho Farmer nếu cần giao việc.",
            $"farm-invitation:{invitation.Id}:accepted", "/owner/farmers", ct);
        return ToView(invitation);
    }

    private static void EnsurePending(FarmInvitation invitation)
    {
        if (invitation.Status == FarmInvitationStatus.Pending) return;
        throw new ResourceConflictException(invitation.Status switch
        {
            FarmInvitationStatus.Accepted => "Lời mời này đã được chấp nhận trước đó.",
            FarmInvitationStatus.Declined => "Lời mời này đã bị từ chối.",
            FarmInvitationStatus.Cancelled => "Lời mời này đã bị chủ trang trại hủy.",
            _ => "Lời mời này đã hết hạn. Hãy nhờ chủ trang trại gửi lời mời mới."
        });
    }

    private async Task ExpireIfDueAsync(FarmInvitation invitation, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        if (invitation.Status != FarmInvitationStatus.Pending || invitation.ExpiresAtUtc > now) return;
        invitation.Status = FarmInvitationStatus.Expired;
        invitation.RespondedAtUtc = now;
        await db.SaveChangesAsync(ct);
    }

    private async Task ExpireOverdueAsync(Guid farmId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var overdue = await db.FarmInvitations.Where(x => x.FarmId == farmId && x.Status == FarmInvitationStatus.Pending && x.ExpiresAtUtc <= now).ToListAsync(ct);
        foreach (var invitation in overdue) { invitation.Status = FarmInvitationStatus.Expired; invitation.RespondedAtUtc = now; }
        if (overdue.Count > 0) await db.SaveChangesAsync(ct);
    }

    /// <summary>Gửi thông báo trong ứng dụng cho Farmer (kênh gửi lời mời). Mỗi lần gửi có ReferenceId riêng nên thử lại không tạo thông báo trùng.</summary>
    private async Task DeliverAsync(FarmInvitation invitation, string farmName, string ownerName, Guid? inviteeUserId, CancellationToken ct)
    {
        invitation.SendCount++;
        invitation.LastSentAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        if (inviteeUserId.HasValue)
            await NotifyAsync(inviteeUserId.Value, invitation.TenantId, "Lời mời tham gia Farm",
                $"{ownerName} mời bạn tham gia nhân công của {farmName}. Mở để chấp nhận hoặc từ chối.",
                $"farm-invitation:{invitation.Id}:sent:{invitation.SendCount}", "/farmer/invitations", ct);
    }

    /// <summary>Thông báo trong ứng dụng không bao giờ làm hỏng thao tác chính; trùng ReferenceId (thử lại) thì không tạo thêm.</summary>
    private async Task NotifyAsync(Guid userId, Guid? tenantId, string title, string message, string reference, string targetUrl, CancellationToken ct)
    {
        try
        {
            await notifications.CreateNotificationAsync(new CreateNotificationCommand(userId, tenantId, title, message, NotificationType.System, AlertSeverity.Info,
                targetUrl, reference, null, DeduplicateByReference: true), ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) { logger.LogWarning(ex, "Invitation notification could not be created."); }
    }

    private async Task<AppUser> GetOwnerAsync(Guid userId, CancellationToken ct)
    {
        var owner = await db.AppUsers.SingleOrDefaultAsync(x => x.Id == userId, ct);
        if (owner is null || owner.Role != UserRole.FarmOwner || !owner.TenantId.HasValue || owner.Status != AccountStatus.Active)
            throw new AuthorizationException("A FarmOwner with a Tenant is required.");
        return owner;
    }

    private async Task<AppUser> GetFarmerAsync(Guid userId, CancellationToken ct)
    {
        var farmer = await db.AppUsers.SingleOrDefaultAsync(x => x.Id == userId, ct);
        if (farmer is null || farmer.Role != UserRole.Farmer) throw new AuthorizationException("Chỉ tài khoản Farmer mới được phản hồi lời mời.");
        return farmer;
    }

    private async Task<FarmInvitation> OwnedInvitationAsync(AppUser owner, Guid invitationId, CancellationToken ct) =>
        await db.FarmInvitations.Include(x => x.Farm).SingleOrDefaultAsync(x => x.Id == invitationId && x.TenantId == owner.TenantId, ct)
            ?? throw new ResourceNotFoundException("Lời mời không tồn tại trong tổ chức này.");

    private static FarmInvitationView ToView(FarmInvitation x) => new(x.Id, x.FarmId, x.Farm?.Name ?? string.Empty, x.Email, x.Status, x.CreatedAtUtc, x.ExpiresAtUtc,
        x.RespondedAtUtc, x.SendCount, x.LastSentAtUtc);
}
