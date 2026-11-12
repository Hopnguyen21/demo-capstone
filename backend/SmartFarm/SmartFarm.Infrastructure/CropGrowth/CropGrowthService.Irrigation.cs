using System.Data;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.CropGrowth;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Platform;

namespace SmartFarm.Infrastructure.CropGrowth;

/// <summary>
/// Lịch tưới thuộc Growth Profile (theo giai đoạn). Lịch này là lịch KHUYẾN NGHỊ của profile; lịch điều khiển thiết bị
/// (ControlSchedule) chỉ được sinh khi chủ trang trại đồng bộ. Không ghi gì vào Crop.CalendarIrrigationPlan.
/// </summary>
internal sealed partial class CropGrowthService
{
    private const int MaxSessionsPerStage = 8;
    private static readonly string[] TimeFormats = ["HH:mm", "H:mm", "HH:mm:ss"];

    public async Task<ProfileIrrigationView> GetProfileIrrigationAsync(Guid userId, Guid? tenantId, Guid profileId, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, false, ct);
        var profile = await dbContext.GrowthProfiles.AsNoTracking().AsSplitQuery()
            .Include(x => x.Crop)
            .Include(x => x.Stages).ThenInclude(x => x.IrrigationSessions)
            .SingleOrDefaultAsync(x => x.Id == profileId && (x.TenantId == null || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException("Growth Profile was not found in the visible catalog.");
        return await BuildIrrigationViewAsync(profile, user, tenantId, ct);
    }

    public async Task<ProfileIrrigationView> UpdateProfileIrrigationAsync(
        Guid userId, Guid? tenantId, Guid profileId, UpdateProfileIrrigationCommand command, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct);
        // Cùng quy tắc sở hữu với sửa profile/giai đoạn: Owner chỉ sửa bản sao của Tenant mình; profile hệ thống và profile của Tenant khác không thấy được.
        var profile = await dbContext.GrowthProfiles.AsSplitQuery()
            .Include(x => x.Crop)
            .Include(x => x.Stages).ThenInclude(x => x.IrrigationSessions)
            .SingleOrDefaultAsync(x => x.Id == profileId && (x.TenantId == tenantId || (x.TenantId == null && user.Role == UserRole.PlatformAdmin)), ct)
            ?? throw new ResourceNotFoundException("Growth Profile was not found.");

        var stageIds = command.Stages.Select(x => x.StageId).ToList();
        if (stageIds.Distinct().Count() != stageIds.Count)
            throw new RequestValidationException("stages", "Mỗi giai đoạn chỉ được xuất hiện một lần.");
        var planned = new List<(GrowthStage Stage, List<GrowthStageIrrigationSession> Sessions)>();
        foreach (var input in command.Stages)
        {
            var stage = profile.Stages.SingleOrDefault(x => x.Id == input.StageId)
                ?? throw new RequestValidationException("stages", "Giai đoạn không thuộc profile này.");
            planned.Add((stage, BuildSessions(input.Sessions)));
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        // Xóa rồi mới thêm ở hai lần lưu riêng để không vướng chỉ mục duy nhất (giai đoạn, thứ tự).
        foreach (var (stage, _) in planned) dbContext.GrowthStageIrrigationSessions.RemoveRange(stage.IrrigationSessions);
        await dbContext.SaveChangesAsync(ct);
        foreach (var (stage, sessions) in planned)
        {
            // Add tường minh để EF coi là bản ghi MỚI (khóa Guid đã có giá trị nên nếu chỉ nối vào navigation sẽ bị hiểu là cập nhật).
            foreach (var x in sessions)
            {
                x.GrowthStageId = stage.Id;
                dbContext.GrowthStageIrrigationSessions.Add(x);
            }
            stage.UpdatedAtUtc = DateTime.UtcNow;
        }
        profile.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await BuildIrrigationViewAsync(profile, user, tenantId, ct);
    }

    internal sealed record ParsedSession(int SortOrder, string Title, TimeOnly StartTime, int DurationSeconds, bool Enabled, string? Method, int? WaterPerPlantMl);

    /// <summary>Kiểm tra và chuẩn hóa danh sách ca tưới (giờ HH:mm, 1–1800 giây, không trùng giờ, tối đa 8 ca). Dùng chung cho lịch profile và lịch theo ngày của vụ.</summary>
    private static List<ParsedSession> ParseSessions(IReadOnlyList<IrrigationSessionInput> inputs)
    {
        if (inputs.Count > MaxSessionsPerStage)
            throw new RequestValidationException("sessions", $"Tối đa {MaxSessionsPerStage} ca tưới cho mỗi giai đoạn hoặc mỗi ngày.");
        var result = new List<ParsedSession>();
        foreach (var (input, index) in inputs.Select((x, i) => (x, i)))
        {
            var title = Required(input.Title, "title", 150);
            if (!TimeOnly.TryParseExact(input.StartTime?.Trim() ?? string.Empty, TimeFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
                throw new RequestValidationException("startTime", "Giờ bắt đầu phải có dạng HH:mm (00:00–23:59).");
            if (input.DurationSeconds is < 1 or > CropIrrigationPlanReader.MaxDurationSeconds)
                throw new RequestValidationException("durationSeconds", $"Thời lượng mỗi ca phải từ 1 đến {CropIrrigationPlanReader.MaxDurationSeconds} giây (tối đa 30 phút).");
            if (input.WaterPerPlantMl is < 0 or > 100000)
                throw new RequestValidationException("waterPerPlantMl", "Lượng nước mỗi gốc (ml) phải từ 0 đến 100000.");
            result.Add(new ParsedSession(index, title, new TimeOnly(time.Hour, time.Minute), input.DurationSeconds, input.Enabled, Optional(input.Method, 100), input.WaterPerPlantMl));
        }
        if (result.Select(x => x.StartTime).Distinct().Count() != result.Count)
            throw new RequestValidationException("sessions", "Hai ca tưới trong cùng giai đoạn/ngày không được trùng giờ bắt đầu.");
        return result;
    }

    private static List<GrowthStageIrrigationSession> BuildSessions(IReadOnlyList<IrrigationSessionInput> inputs) =>
        ParseSessions(inputs).Select(x => new GrowthStageIrrigationSession
        {
            SortOrder = x.SortOrder, Title = x.Title, StartTime = x.StartTime, DurationSeconds = x.DurationSeconds,
            Enabled = x.Enabled, Method = x.Method, WaterPerPlantMl = x.WaterPerPlantMl
        }).ToList();

    private async Task<ProfileIrrigationView> BuildIrrigationViewAsync(GrowthProfile profile, AppUser user, Guid? tenantId, CancellationToken ct)
    {
        var farmTimeZone = tenantId.HasValue
            ? await dbContext.Farms.AsNoTracking().Where(x => x.TenantId == tenantId).Select(x => x.TimeZone).FirstOrDefaultAsync(ct)
            : null;
        var cropFallback = ReadCropSessions(profile.Crop?.CalendarIrrigationPlan, profile.Crop?.Name ?? "profile");
        var stages = profile.Stages.OrderBy(x => x.StageOrder).Select(stage =>
        {
            var own = stage.IrrigationSessions.OrderBy(x => x.SortOrder).Select(x => new IrrigationSessionView(
                x.Id, x.Title, x.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture), x.DurationSeconds, x.Enabled, x.Method, x.WaterPerPlantMl)).ToList();
            if (own.Count > 0) return new StageIrrigationView(stage.Id, stage.Name, stage.StageOrder, stage.DurationDays, "Profile", own);
            if (cropFallback.Count == 0) return new StageIrrigationView(stage.Id, stage.Name, stage.StageOrder, stage.DurationDays, "None", []);
            // Profile chưa có ca: chỉ HIỂN THỊ lịch mẫu của cây (SessionId rỗng vì chưa lưu ở profile).
            var shown = cropFallback.Select(c => new IrrigationSessionView(Guid.Empty, c.Title, $"{c.Hour:D2}:{c.Minute:D2}", c.DurationSeconds, true, null, null)).ToList();
            return new StageIrrigationView(stage.Id, stage.Name, stage.StageOrder, stage.DurationDays, "Crop", shown);
        }).ToList();
        var editable = (profile.TenantId.HasValue && profile.TenantId == tenantId && user.Role == UserRole.FarmOwner)
                       || (profile.TenantId == null && user.Role == UserRole.PlatformAdmin);
        return new ProfileIrrigationView(profile.Id, profile.Name, profile.IsSystemDefined, editable, "DAILY", farmTimeZone ?? "Asia/Ho_Chi_Minh", stages);
    }

    /// <summary>
    /// Sao chép lịch tưới theo giai đoạn của profile nguồn. Nếu profile nguồn chưa có ca nào nhưng cây có lịch mẫu hợp lệ thì dựng
    /// các ca đó cho mọi giai đoạn của bản sao để chủ trang trại có lịch riêng để chỉnh (Crop không bị sửa).
    /// </summary>
    private static void CloneIrrigation(GrowthProfile source, GrowthProfile result)
    {
        var anySession = source.Stages.Any(x => x.IrrigationSessions.Count > 0);
        var cropSessions = anySession ? [] : ReadCropSessions(source.Crop?.CalendarIrrigationPlan, source.Crop?.Name ?? "profile");
        foreach (var target in result.Stages)
        {
            var from = source.Stages.SingleOrDefault(x => x.StageOrder == target.StageOrder);
            if (anySession && from is not null)
            {
                foreach (var x in from.IrrigationSessions.OrderBy(i => i.SortOrder))
                    target.IrrigationSessions.Add(new GrowthStageIrrigationSession { SortOrder = x.SortOrder, Title = x.Title, StartTime = x.StartTime, DurationSeconds = x.DurationSeconds, Enabled = x.Enabled, Method = x.Method, WaterPerPlantMl = x.WaterPerPlantMl });
            }
            else
            {
                var order = 0;
                foreach (var c in cropSessions)
                    target.IrrigationSessions.Add(new GrowthStageIrrigationSession { SortOrder = order++, Title = c.Title, StartTime = new TimeOnly(c.Hour, c.Minute), DurationSeconds = c.DurationSeconds, Enabled = true });
            }
        }
    }

    /// <summary>Đọc lịch mẫu của cây; thiếu, hỏng hoặc không hỗ trợ thì coi là "không có lịch" (không bịa giờ, không ném lỗi).</summary>
    internal static IReadOnlyList<CropIrrigationPlanReader.Session> ReadCropSessions(string? plan, string cropName)
    {
        if (string.IsNullOrWhiteSpace(plan)) return [];
        try { return CropIrrigationPlanReader.ReadDailySessions(plan, cropName); }
        catch (ResourceConflictException) { return []; }
    }
}