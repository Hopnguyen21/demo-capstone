using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

/// <summary>
/// Lời mời một tài khoản Farmer tham gia nhân công của Farm. Chỉ khi Farmer chấp nhận mới có TenantId/FarmId trên tài khoản.
/// Lời mời được gửi bằng thông báo trong ứng dụng cho tài khoản Farmer đã đăng ký; Farmer phản hồi khi đã đăng nhập (không dùng token trong đường dẫn).
/// </summary>
public sealed class FarmInvitation : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public Guid InvitedByOwnerId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string NormalizedEmail { get; set; } = string.Empty;
    /// <summary>Tài khoản Farmer tồn tại lúc mời (để gửi thông báo trong ứng dụng).</summary>
    public Guid? InviteeUserId { get; set; }
    public FarmInvitationStatus Status { get; set; } = FarmInvitationStatus.Pending;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RespondedAtUtc { get; set; }
    /// <summary>Số lần đã gửi thông báo (gửi lại sẽ tăng số này và tạo thông báo mới).</summary>
    public int SendCount { get; set; }
    public DateTime? LastSentAtUtc { get; set; }
}
