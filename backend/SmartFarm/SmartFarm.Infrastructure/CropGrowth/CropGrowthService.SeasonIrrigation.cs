using System.Data;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.CropGrowth;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Infrastructure.CropGrowth;

/// <summary>
/// Lịch tưới tùy chỉnh THEO NGÀY của vụ trồng (Zone + mùa vụ). Lịch theo giai đoạn của Growth Profile giữ nguyên làm lịch mẫu/đề xuất
/// và không bao giờ bị sửa ở đây; chỉ các ngày người dùng sửa mới được lưu (override).
/// Quy tắc khi vụ đổi: override khóa theo SỐ NGÀY CANH TÁC nên đổi ngày bắt đầu làm các ngày dịch theo; đổi số ngày làm ngày vượt quá cuối vụ
/// thành "ngoài vụ" (giữ nguyên, bị bỏ qua khi đồng bộ); đổi profile giữ các ngày override. Mọi trường hợp chỉ báo Status = Stale
/// cùng StaleReasons, KHÔNG xóa dữ liệu. Người dùng khôi phục tường minh (từng ngày hoặc cả vụ).
/// </summary>
internal sealed partial class CropGrowthService
{
    private const int MaxOverrideDaysPerRequest = 400;

    public async Task<SeasonIrrigationCalendarView> GetSeasonIrrigationAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, CancellationToken ct)
    {
        await EnsureZoneReadAsync(userId, tenantId, zoneId, ct); // Zone ngoài Tenant / Farmer không được cấp Zone => 404
        var role = await dbContext.AppUsers.AsNoTracking().Where(x => x.Id == userId).Select(x => x.Role).SingleAsync(ct);
        return await BuildSeasonIrrigationViewAsync(zoneId, seasonId, role, ct);
    }

    public async Task<SeasonIrrigationCalendarView> UpdateSeasonIrrigationAsync(
        Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, UpdateSeasonIrrigationCommand command, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, true, ct);
        var season = await LoadEditableSeasonAsync(tenantId, zoneId, seasonId, ct);
        var totalDays = SeasonTotalDays(season);

        if (command.Days.Count == 0 || command.Days.Count > MaxOverrideDaysPerRequest)
            throw new RequestValidationException("days", $"Mỗi lần lưu cần 1 đến {MaxOverrideDaysPerRequest} ngày.");
        if (command.Days.Select(x => x.DayNumber).Distinct().Count() != command.Days.Count)
            throw new RequestValidationException("days", "Mỗi ngày chỉ được xuất hiện một lần trong yêu cầu.");
        var parsed = new List<(int DayNumber, List<ParsedSession> Sessions)>();
        foreach (var day in command.Days)
        {
            if (day.DayNumber < 1 || day.DayNumber > totalDays)
                throw new RequestValidationException("dayNumber", $"Ngày {day.DayNumber} nằm ngoài vụ (vụ có {totalDays} ngày, từ ngày 1 đến ngày {totalDays}).");
            parsed.Add((day.DayNumber, ParseSessions(day.Sessions)));
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var plan = await dbContext.SeasonIrrigationPlans.Include(x => x.Days).ThenInclude(x => x.Sessions)
            .SingleOrDefaultAsync(x => x.PlantingSeasonId == seasonId, ct);
        if (plan is null)
        {
            plan = new SeasonIrrigationPlan { PlantingSeasonId = seasonId };
            dbContext.SeasonIrrigationPlans.Add(plan);
        }
        var existing = plan.Days.ToDictionary(x => x.DayNumber);
        // Xóa ca cũ của các ngày được ghi đè rồi mới thêm (lưu hai lần để không vướng chỉ mục duy nhất theo thứ tự).
        foreach (var (dayNumber, _) in parsed)
            if (existing.TryGetValue(dayNumber, out var old)) dbContext.SeasonIrrigationSessions.RemoveRange(old.Sessions);
        await dbContext.SaveChangesAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var (dayNumber, sessions) in parsed)
        {
            if (!existing.TryGetValue(dayNumber, out var day))
            {
                day = new SeasonIrrigationDay { SeasonIrrigationPlanId = plan.Id, DayNumber = dayNumber };
                dbContext.SeasonIrrigationDays.Add(day);
            }
            else day.UpdatedAtUtc = now;
            foreach (var s in sessions)
            {
                // Add tường minh để EF coi là bản ghi MỚI (khóa Guid đã có giá trị).
                dbContext.SeasonIrrigationSessions.Add(new SeasonIrrigationSession
                {
                    SeasonIrrigationDayId = day.Id, SortOrder = s.SortOrder, Title = s.Title, StartTime = s.StartTime, DurationSeconds = s.DurationSeconds,
                    Enabled = s.Enabled, Method = s.Method, WaterPerPlantMl = s.WaterPerPlantMl
                });
            }
        }
        plan.StartDateSnapshot = season.StartDate;
        plan.TotalDaysSnapshot = totalDays;
        plan.GrowthProfileIdSnapshot = season.GrowthProfileId;
        plan.UpdatedByUserId = userId;
        plan.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await BuildSeasonIrrigationViewAsync(zoneId, seasonId, UserRole.FarmOwner, ct);
    }

    public async Task<SeasonIrrigationCalendarView> ResetSeasonIrrigationAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, int? dayNumber, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, true, ct);
        await LoadEditableSeasonAsync(tenantId, zoneId, seasonId, ct);
        if (dayNumber is < 1) throw new RequestValidationException("dayNumber", "Số ngày phải từ 1 trở lên.");
        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var plan = await dbContext.SeasonIrrigationPlans.Include(x => x.Days).SingleOrDefaultAsync(x => x.PlantingSeasonId == seasonId, ct);
        if (plan is not null)
        {
            if (dayNumber is null) dbContext.SeasonIrrigationPlans.Remove(plan);
            else
            {
                var day = plan.Days.SingleOrDefault(x => x.DayNumber == dayNumber);
                if (day is not null) dbContext.SeasonIrrigationDays.Remove(day);
                plan.UpdatedByUserId = userId;
                plan.UpdatedAtUtc = DateTime.UtcNow;
            }
            await dbContext.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
        return await BuildSeasonIrrigationViewAsync(zoneId, seasonId, UserRole.FarmOwner, ct);
    }

    /// <summary>Vụ thuộc đúng Zone và đúng Tenant của người gọi; chỉ vụ Planned/InProgress mới sửa/khôi phục được.</summary>
    private async Task<PlantingSeason> LoadEditableSeasonAsync(Guid tenantId, Guid zoneId, Guid seasonId, CancellationToken ct)
    {
        var season = await dbContext.PlantingSeasons.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == seasonId && x.ZoneId == zoneId && x.Zone.Field.Farm.TenantId == tenantId, ct)
            ?? throw new ResourceNotFoundException("Planting Season was not found under this Zone in the current Tenant.");
        if (season.Status is not (PlantingSeasonStatus.Planned or PlantingSeasonStatus.InProgress))
            throw new ResourceConflictException("Vụ đã kết thúc hoặc đã hủy nên không thể sửa lịch tưới.");
        return season;
    }

    internal static int SeasonTotalDays(PlantingSeason s) => s.ExpectedEndDate.DayNumber - s.StartDate.DayNumber + 1;

    /// <summary>Giai đoạn của profile theo số ngày canh tác (cộng dồn số ngày từng giai đoạn); ngoài tổng số ngày của profile thì null.</summary>
    internal static GrowthStage? StageForDay(IEnumerable<GrowthStage> stages, int dayNumber)
    {
        var cumulative = 0;
        foreach (var stage in stages.OrderBy(x => x.StageOrder))
        {
            cumulative += stage.DurationDays;
            if (dayNumber <= cumulative) return stage;
        }
        return null;
    }

    private async Task<SeasonIrrigationCalendarView> BuildSeasonIrrigationViewAsync(Guid zoneId, Guid seasonId, UserRole role, CancellationToken ct)
    {
        var season = await dbContext.PlantingSeasons.AsNoTracking().AsSplitQuery()
            .Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm)
            .Include(x => x.GrowthProfile).ThenInclude(x => x.Crop)
            .Include(x => x.GrowthProfile).ThenInclude(x => x.Stages).ThenInclude(x => x.IrrigationSessions)
            .SingleOrDefaultAsync(x => x.Id == seasonId && x.ZoneId == zoneId, ct)
            ?? throw new ResourceNotFoundException("Planting Season was not found under this Zone.");
        var plan = await dbContext.SeasonIrrigationPlans.AsNoTracking().Include(x => x.Days).ThenInclude(x => x.Sessions)
            .SingleOrDefaultAsync(x => x.PlantingSeasonId == seasonId, ct);

        var total = SeasonTotalDays(season);
        var stages = season.GrowthProfile.Stages.OrderBy(x => x.StageOrder).ToList();
        var cropFallback = ReadCropSessions(season.GrowthProfile.Crop?.CalendarIrrigationPlan, season.GrowthProfile.Crop?.Name ?? "profile");
        var overrides = plan?.Days.ToDictionary(x => x.DayNumber) ?? [];

        static IrrigationSessionView ToView(SeasonIrrigationSession x) => new(x.Id, x.Title, x.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture), x.DurationSeconds, x.Enabled, x.Method, x.WaterPerPlantMl);
        IReadOnlyList<IrrigationSessionView> OverrideSessions(SeasonIrrigationDay d) => d.Sessions.OrderBy(x => x.SortOrder).Select(ToView).ToList();

        var days = new List<SeasonIrrigationDayView>();
        for (var n = 1; n <= total; n++)
        {
            var stage = StageForDay(stages, n);
            var date = season.StartDate.AddDays(n - 1);
            if (overrides.TryGetValue(n, out var o))
            {
                days.Add(new(n, date, stage?.Id, stage?.Name, "Override", true, false, OverrideSessions(o)));
                continue;
            }
            var own = stage?.IrrigationSessions.OrderBy(x => x.SortOrder).Select(x => new IrrigationSessionView(
                x.Id, x.Title, x.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture), x.DurationSeconds, x.Enabled, x.Method, x.WaterPerPlantMl)).ToList() ?? [];
            if (own.Count > 0) days.Add(new(n, date, stage?.Id, stage?.Name, "Profile", false, false, own));
            else if (stage is not null && cropFallback.Count > 0)
                days.Add(new(n, date, stage.Id, stage.Name, "Crop", false, false,
                    cropFallback.Select(c => new IrrigationSessionView(Guid.Empty, c.Title, $"{c.Hour:D2}:{c.Minute:D2}", c.DurationSeconds, true, null, null)).ToList()));
            else days.Add(new(n, date, stage?.Id, stage?.Name, "None", false, false, []));
        }
        // Ngày override nằm ngoài vụ (vụ bị rút ngắn sau khi lưu): vẫn trả về để người dùng thấy và khôi phục tường minh.
        foreach (var o in overrides.Values.Where(x => x.DayNumber > total).OrderBy(x => x.DayNumber))
            days.Add(new(o.DayNumber, season.StartDate.AddDays(o.DayNumber - 1), null, null, "Override", true, true, OverrideSessions(o)));

        var reasons = new List<string>();
        if (plan is not null)
        {
            if (plan.StartDateSnapshot != season.StartDate) reasons.Add("StartDateChanged");
            if (plan.TotalDaysSnapshot != total) reasons.Add("DurationChanged");
            if (plan.GrowthProfileIdSnapshot != season.GrowthProfileId) reasons.Add("ProfileChanged");
            if (overrides.Keys.Any(k => k > total)) reasons.Add("DaysOutOfRange");
        }
        var tz = season.Zone.Field.Farm.TimeZone;
        int? today = null;
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(tz);
            var localToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone));
            var n = localToday.DayNumber - season.StartDate.DayNumber + 1;
            if (n >= 1 && n <= total) today = n;
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { }

        var editable = role == UserRole.FarmOwner && season.Status is PlantingSeasonStatus.Planned or PlantingSeasonStatus.InProgress;
        return new SeasonIrrigationCalendarView(
            season.Id, season.ZoneId, season.Name, season.Status.ToString(), season.GrowthProfileId, season.GrowthProfile.Name, season.StartDate, total, today, tz, "DAILY",
            plan is null ? "NoOverrides" : reasons.Count > 0 ? "Stale" : "Current", reasons, overrides.Count > 0, overrides.Count, editable,
            plan?.UpdatedAtUtc ?? plan?.CreatedAtUtc, plan?.UpdatedByUserId, plan?.StartDateSnapshot, plan?.TotalDaysSnapshot, days);
    }
}
