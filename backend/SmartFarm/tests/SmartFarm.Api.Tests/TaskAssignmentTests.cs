using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Application.Features.Notifications;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;
using static SmartFarm.Api.Tests.WorkforceTestSupport;

namespace SmartFarm.Api.Tests;

/// <summary>Một công việc giao cho nhiều Farmer: mỗi Farmer có phân công, trạng thái, tiến độ, kết quả và thông báo riêng.</summary>
public sealed class TaskAssignmentTests
{
    private sealed record Setup(TestApplicationFactory Factory, SeedData Seed, Guid A, Guid B, Guid C, HttpClient Client);

    private static async Task<Setup> SetupAsync(TestApplicationFactory? factory = null)
    {
        factory ??= new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        var a = await AddMemberFarmerAsync(factory, seed, "farmer-a@example.com", "Farmer A");
        var b = await AddMemberFarmerAsync(factory, seed, "farmer-b2@example.com", "Farmer B");
        var c = await AddMemberFarmerAsync(factory, seed, "farmer-c@example.com", "Farmer C");
        var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        return new(factory, seed, a, b, c, client);
    }

    private static object NewTask(Guid zoneId, params Guid[] farmerIds) => new { zoneId, title = "Prune the vines", description = "All rows", requirements = "Gloves", dueAtUtc = DateTime.UtcNow.AddDays(1), farmerIds };

    private static async Task<FarmTaskView> CreateOk(Setup s, params Guid[] farmerIds)
    {
        var response = await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks", NewTask(s.Seed.ZoneAId, farmerIds));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Read<FarmTaskView>(response);
    }

    private static async Task<HttpResponseMessage> Put(Setup s, Guid taskId, object body) => await s.Client.PutAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{taskId}", body);
    private static async Task<FarmTaskView> PutOk(Setup s, Guid taskId, object body) => await Read<FarmTaskView>(await Put(s, taskId, body));

    private static async Task<List<FarmTaskView>> ListAs(Setup s, string email)
    {
        await Login(s.Client, email);
        return await Read<List<FarmTaskView>>(await s.Client.GetAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks"));
    }

    [Fact]
    public async Task Task_for_several_farmers_creates_one_assignment_and_one_notification_for_each()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;

        var task = await CreateOk(s, s.A, s.B);

        Assert.Equal(FarmTaskStatus.Pending, task.Status);
        Assert.Equal(2, task.Assignments.Count);
        Assert.All(task.Assignments, a => { Assert.Equal(FarmTaskStatus.Pending, a.Status); Assert.Equal(0, a.ProgressPercent); });
        using var scope = s.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var notes = await db.Notifications.AsNoTracking().Where(x => x.Type == NotificationType.Task).ToListAsync();
        Assert.Equal(2, notes.Count);
        Assert.Equal(new[] { s.A, s.B }.Order(), notes.Select(n => n.UserId).Order());
        Assert.All(notes, n => { Assert.Contains("Prune the vines", n.Message); Assert.Contains("Zone A", n.Message); Assert.Equal($"/farmer/tasks?taskId={task.Id}", n.TargetUrl); Assert.Contains(task.Id.ToString("N"), n.ReferenceId); Assert.True(n.ReferenceId!.Length <= 100, $"reference_id is {n.ReferenceId.Length} chars"); });
        Assert.Equal(2, notes.Select(n => n.ReferenceId).Distinct().Count());
    }

    [Fact]
    public async Task Creating_a_task_validates_the_farmers_and_never_grants_zone_access()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var noAccess = await AddMemberFarmerAsync(s.Factory, s.Seed, "no-zone@example.com", "Farmer Without Zone", withZoneAccess: false);

        var empty = await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks", NewTask(s.Seed.ZoneAId));
        var missingZone = await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks", NewTask(s.Seed.ZoneAId, s.A, noAccess));
        var otherTenant = await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks", NewTask(s.Seed.ZoneAId, s.A, s.Seed.TenantBFarmerId));
        var notMember = await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks", NewTask(s.Seed.ZoneAId, s.Seed.UnassignedFarmerId));

        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, missingZone.StatusCode);
        Assert.Contains("Farmer Without Zone", await missingZone.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Conflict, otherTenant.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, notMember.StatusCode);
        using var scope = s.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Empty(await db.FarmTasks.ToListAsync());               // không lưu nửa vời
        Assert.Empty(await db.Notifications.ToListAsync());           // không báo giao việc khi chưa lưu
        Assert.False(await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == noAccess)); // không tự cấp quyền Zone
        Assert.False(await db.UserZoneAccesses.AnyAsync(x => x.CanControl));            // và không bao giờ cấp quyền điều khiển
        // Danh sách trùng được gộp thành một phân công.
        var deduped = await CreateOk(s, s.A, s.A, s.A);
        Assert.Single(deduped.Assignments);
    }

    [Fact]
    public async Task Each_farmer_progresses_independently_and_the_owner_approves_each_result()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A, s.B);

        await Login(s.Client, "farmer-a@example.com");
        await PutOk(s, task.Id, new { action = "Accept" });
        await PutOk(s, task.Id, new { action = "Start" });
        var progress = await PutOk(s, task.Id, new { action = "UpdateProgress", progressPercent = 40, notes = "Half done" });
        Assert.Equal(40, progress.Assignments.Single().ProgressPercent);
        var submitted = await PutOk(s, task.Id, new { action = "Complete", result = "Rows 1-5 pruned" });
        Assert.Equal(FarmTaskStatus.CompletedPendingReview, submitted.Status);

        // Thao tác của Farmer A không đổi gì ở Farmer B.
        await Login(s.Client, "owner-a@example.com");
        var afterA = (await Read<List<FarmTaskView>>(await s.Client.GetAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks"))).Single();
        var b = afterA.Assignments.Single(x => x.FarmerId == s.B);
        Assert.Equal(FarmTaskStatus.Pending, b.Status); Assert.Equal(0, b.ProgressPercent); Assert.Null(b.Result);
        Assert.Equal(FarmTaskStatus.Pending, afterA.Status); // còn người chưa nhận nên công việc chưa xong

        // Duyệt cần chỉ rõ Farmer khi có nhiều người; duyệt A không duyệt B.
        var approvedA = await PutOk(s, task.Id, new { action = "Approve", farmerId = s.A });
        Assert.Equal(FarmTaskStatus.Approved, approvedA.Assignments.Single(x => x.FarmerId == s.A).Status);
        Assert.Equal(FarmTaskStatus.Pending, approvedA.Assignments.Single(x => x.FarmerId == s.B).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await Put(s, task.Id, new { action = "Approve", farmerId = s.B })).StatusCode);

        await Login(s.Client, "farmer-b2@example.com");
        await PutOk(s, task.Id, new { action = "Accept" }); await PutOk(s, task.Id, new { action = "Start" });
        await PutOk(s, task.Id, new { action = "Complete", result = "Rows 6-10 pruned" });
        await Login(s.Client, "owner-a@example.com");
        var done = await PutOk(s, task.Id, new { action = "Approve" }); // chỉ còn một kết quả chờ duyệt nên không cần chỉ rõ
        Assert.Equal(FarmTaskStatus.Approved, done.Status);
        Assert.All(done.Assignments, a => Assert.Equal(FarmTaskStatus.Approved, a.Status));

        var report = await Read<SmartFarm.Application.Features.Reports.TaskReport>(await s.Client.GetAsync($"/api/v1/farms/{s.Seed.FarmAId}/report/tasks"));
        Assert.Equal(2, report.ByAssignee.Count);
        Assert.All(report.ByAssignee, r => Assert.Equal(1, r.Approved));
    }

    [Fact]
    public async Task Approving_without_naming_the_farmer_is_rejected_when_several_results_wait()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A, s.B);
        foreach (var email in new[] { "farmer-a@example.com", "farmer-b2@example.com" })
        {
            await Login(s.Client, email);
            await PutOk(s, task.Id, new { action = "Accept" }); await PutOk(s, task.Id, new { action = "Start" }); await PutOk(s, task.Id, new { action = "Complete", result = "ok" });
        }

        await Login(s.Client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(s, task.Id, new { action = "Approve" })).StatusCode);
    }

    [Fact]
    public async Task A_farmer_sees_only_their_own_assignment_and_history_and_cannot_touch_unassigned_tasks()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A, s.B);
        await Login(s.Client, "farmer-a@example.com");
        await PutOk(s, task.Id, new { action = "Accept" });
        await PutOk(s, task.Id, new { action = "Fail", failureReason = "A's secret reason" });

        var asB = (await ListAs(s, "farmer-b2@example.com")).Single();
        var mine = Assert.Single(asB.Assignments);
        Assert.Equal(s.B, mine.FarmerId);
        Assert.DoesNotContain(asB.History, h => h.SubjectFarmerId == s.A);
        Assert.DoesNotContain("A's secret reason", System.Text.Json.JsonSerializer.Serialize(asB));
        Assert.Equal(FarmTaskStatus.Pending, asB.Status); // Farmer B thấy trạng thái của chính mình, không thấy việc A thất bại

        // Farmer C có quyền Zone nhưng không được giao việc này.
        Assert.Empty(await ListAs(s, "farmer-c@example.com"));
        Assert.Equal(HttpStatusCode.Forbidden, (await Put(s, task.Id, new { action = "Accept" })).StatusCode);
    }

    [Fact]
    public async Task Owner_can_add_and_remove_assignees_with_notifications_and_state_rules()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A);

        var added = await Read<FarmTaskView>(await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.A, s.C } }));
        Assert.Equal(2, added.Assignments.Count);                                  // A đang được giao nên chỉ C là người thêm
        using (var scope = s.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            Assert.Equal(1, await db.Notifications.CountAsync(x => x.UserId == s.C && x.Type == NotificationType.Task));
            Assert.Equal(1, await db.Notifications.CountAsync(x => x.UserId == s.A && x.Type == NotificationType.Task)); // A không nhận thêm thông báo
        }
        Assert.Equal(HttpStatusCode.Conflict, (await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.A } })).StatusCode);

        var removed = await Read<FarmTaskView>(await s.Client.DeleteAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees/{s.C}"));
        Assert.Equal(FarmTaskStatus.Cancelled, removed.Assignments.Single(a => a.FarmerId == s.C).Status);
        Assert.Contains(removed.History, h => h.EventType == FarmTaskEventType.AssigneeRemoved && h.SubjectFarmerId == s.C);
        Assert.Empty(await ListAs(s, "farmer-c@example.com")); // Farmer bị gỡ không còn thấy công việc
        await Login(s.Client, "owner-a@example.com");

        // Giao lại cho Farmer đã bị gỡ: dùng lại bản ghi, tăng phiên bản, thông báo mới.
        var readded = await Read<FarmTaskView>(await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.C } }));
        var c = readded.Assignments.Single(a => a.FarmerId == s.C);
        Assert.Equal(FarmTaskStatus.Pending, c.Status); Assert.Equal(2, c.AssignmentVersion);
        Assert.Equal(2, readded.Assignments.Count); // vẫn một bản ghi cho mỗi cặp Task–Farmer
        using (var scope = s.Factory.Services.CreateScope())
        {
            var refs = await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().Notifications.Where(x => x.UserId == s.C && x.Type == NotificationType.Task).Select(x => x.ReferenceId!).ToListAsync();
            Assert.Equal(2, refs.Count(r => r.EndsWith(":assigned")));  // giao lần 1 và giao lại (phiên bản 2) là hai thông báo khác nhau
            Assert.Equal(1, refs.Count(r => r.EndsWith(":removed")));
            Assert.Equal(refs.Count, refs.Distinct().Count());
        }

        // Không gỡ được Farmer đã được duyệt.
        await Login(s.Client, "farmer-a@example.com");
        await PutOk(s, task.Id, new { action = "Accept" }); await PutOk(s, task.Id, new { action = "Start" }); await PutOk(s, task.Id, new { action = "Complete", result = "done" });
        await Login(s.Client, "owner-a@example.com");
        await PutOk(s, task.Id, new { action = "Approve", farmerId = s.A });
        Assert.Equal(HttpStatusCode.Conflict, (await s.Client.DeleteAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees/{s.A}")).StatusCode);
    }

    [Fact]
    public async Task Decline_complete_and_fail_notify_the_owner_and_a_declined_farmer_can_be_reassigned()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A, s.B);

        await Login(s.Client, "farmer-a@example.com");
        var declined = await PutOk(s, task.Id, new { action = "Decline", notes = "On leave" });
        Assert.Equal(FarmTaskStatus.Declined, declined.Assignments.Single().Status);
        await Login(s.Client, "farmer-b2@example.com");
        await PutOk(s, task.Id, new { action = "Accept" }); await PutOk(s, task.Id, new { action = "Start" });
        await PutOk(s, task.Id, new { action = "Complete", result = "ok" });

        using (var scope = s.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var ownerNotes = await db.Notifications.AsNoTracking().Where(x => x.UserId == s.Seed.OwnerAId && x.Type == NotificationType.Task).ToListAsync();
            Assert.Contains(ownerNotes, n => n.ReferenceId!.EndsWith(":declined") && n.Message.Contains("Farmer A") && n.Severity == AlertSeverity.Warning);
            Assert.Contains(ownerNotes, n => n.ReferenceId!.EndsWith(":completed") && n.Message.Contains("Farmer B"));
        }

        // Công việc đã có người từ chối: Owner thấy trạng thái từng người và giao lại được cho Farmer đã từ chối.
        await Login(s.Client, "owner-a@example.com");
        var overview = (await Read<List<FarmTaskView>>(await s.Client.GetAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks"))).Single();
        Assert.Equal(FarmTaskStatus.Declined, overview.Assignments.Single(a => a.FarmerId == s.A).Status);
        Assert.Equal(FarmTaskStatus.CompletedPendingReview, overview.Status);
        var reassigned = await Read<FarmTaskView>(await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.A } }));
        Assert.Equal(FarmTaskStatus.Pending, reassigned.Assignments.Single(a => a.FarmerId == s.A).Status);

        await Login(s.Client, "farmer-a@example.com");
        await PutOk(s, task.Id, new { action = "Accept" });
        await PutOk(s, task.Id, new { action = "Fail", failureReason = "Tool broke" });
        using var check = s.Factory.Services.CreateScope();
        Assert.Contains(await check.ServiceProvider.GetRequiredService<SmartFarmDbContext>().Notifications.AsNoTracking().Where(x => x.UserId == s.Seed.OwnerAId).ToListAsync(), n => n.ReferenceId!.EndsWith(":failed"));
    }

    [Fact]
    public async Task An_approved_task_can_be_reopened_to_replace_a_farmer_who_declined()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A, s.B);
        await Login(s.Client, "farmer-b2@example.com");
        await PutOk(s, task.Id, new { action = "Decline" });
        await Login(s.Client, "farmer-a@example.com");
        await PutOk(s, task.Id, new { action = "Accept" }); await PutOk(s, task.Id, new { action = "Start" }); await PutOk(s, task.Id, new { action = "Complete", result = "ok" });
        await Login(s.Client, "owner-a@example.com");
        var approved = await PutOk(s, task.Id, new { action = "Approve" });
        Assert.Equal(FarmTaskStatus.Approved, approved.Status);

        var reopened = await Read<FarmTaskView>(await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.C } }));

        Assert.Equal(FarmTaskStatus.Pending, reopened.Status);
        Assert.Equal(FarmTaskStatus.Approved, reopened.Assignments.Single(a => a.FarmerId == s.A).Status); // kết quả đã duyệt của A không bị đổi
    }

    [Fact]
    public async Task Invalid_farmer_actions_are_rejected_and_progress_is_range_checked()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A);
        await Login(s.Client, "farmer-a@example.com");

        Assert.Equal(HttpStatusCode.Conflict, (await Put(s, task.Id, new { action = "Start" })).StatusCode);                  // chưa nhận
        Assert.Equal(HttpStatusCode.Conflict, (await Put(s, task.Id, new { action = "Complete", result = "x" })).StatusCode); // chưa làm
        await PutOk(s, task.Id, new { action = "Accept" });
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(s, task.Id, new { action = "UpdateProgress", progressPercent = 101 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(s, task.Id, new { action = "UpdateProgress" })).StatusCode);
        var started = await PutOk(s, task.Id, new { action = "UpdateProgress", progressPercent = 10 }); // cập nhật tiến độ tự chuyển sang Đang làm
        Assert.Equal(FarmTaskStatus.InProgress, started.Assignments.Single().Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(s, task.Id, new { action = "Complete" })).StatusCode); // nộp phải có kết quả
        // Farmer không thể tự duyệt kết quả của mình.
        Assert.Equal(HttpStatusCode.Conflict, (await Put(s, task.Id, new { action = "Approve", farmerId = s.A })).StatusCode);
    }

    [Fact]
    public async Task Overdue_assignments_need_a_new_deadline_before_they_can_be_reassigned()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A);
        using (var scope = s.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.FarmTasks.SingleAsync(x => x.Id == task.Id)).DueAtUtc = DateTime.UtcNow.AddHours(-2);
            await db.SaveChangesAsync();
        }

        var overview = (await Read<List<FarmTaskView>>(await s.Client.GetAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks"))).Single();
        Assert.Equal(FarmTaskStatus.Overdue, overview.Status);
        Assert.Equal(FarmTaskStatus.Overdue, overview.Assignments.Single().Status);
        Assert.Equal(HttpStatusCode.Conflict, (await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.A } })).StatusCode);
        var reopened = await Read<FarmTaskView>(await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.A }, newDueAtUtc = DateTime.UtcNow.AddDays(2) }));
        Assert.Equal(FarmTaskStatus.Pending, reopened.Status);
    }

    [Fact]
    public async Task Another_tenants_owner_cannot_change_assignments()
    {
        var s = await SetupAsync(); using var _ = s.Factory; using var __ = s.Client;
        var task = await CreateOk(s, s.A);

        await Login(s.Client, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees", new { farmerIds = new[] { s.B } })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await s.Client.DeleteAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks/{task.Id}/assignees/{s.A}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Put(s, task.Id, new { action = "Approve", farmerId = s.A })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await s.Client.PostAsJsonAsync($"/api/v1/farms/{s.Seed.FarmAId}/tasks", NewTask(s.Seed.ZoneAId, s.A))).StatusCode);
    }

    [Fact]
    public async Task A_notification_failure_does_not_lose_the_saved_task()
    {
        using var baseFactory = new TestApplicationFactory();
        var seed = await baseFactory.SeedAsync();
        var a = await AddMemberFarmerAsync(baseFactory, seed, "farmer-a@example.com", "Farmer A");
        using var failing = baseFactory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<INotificationService>();
            services.AddScoped<INotificationService, ThrowingNotificationService>();
        }));
        using var client = failing.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/tasks", NewTask(seed.ZoneAId, a));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await Read<FarmTaskView>(response);
        using var scope = baseFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(created.Id, (await db.FarmTasks.Include(x => x.Assignments).SingleAsync()).Id);
        Assert.Single((await db.FarmTasks.Include(x => x.Assignments).SingleAsync()).Assignments);
    }

    [Fact]
    public async Task Notifications_with_the_same_reference_are_not_duplicated_when_retried()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var scope = factory.Services.CreateScope();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var command = new CreateNotificationCommand(seed.OwnerAId, null, "t", "m", NotificationType.Task, AlertSeverity.Info, "/x", "farm-task:1:assigned", null, DeduplicateByReference: true);

        var first = await notifications.CreateNotificationAsync(command);
        var second = await notifications.CreateNotificationAsync(command);

        Assert.Equal(first.NotificationId, second.NotificationId);
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().Notifications.CountAsync());
    }

    [Theory]
    [InlineData(new[] { FarmTaskStatus.Approved, FarmTaskStatus.Approved }, FarmTaskStatus.Approved)]
    [InlineData(new[] { FarmTaskStatus.Approved, FarmTaskStatus.Pending }, FarmTaskStatus.Pending)]
    [InlineData(new[] { FarmTaskStatus.CompletedPendingReview, FarmTaskStatus.InProgress }, FarmTaskStatus.InProgress)]
    [InlineData(new[] { FarmTaskStatus.CompletedPendingReview, FarmTaskStatus.Approved }, FarmTaskStatus.CompletedPendingReview)]
    [InlineData(new[] { FarmTaskStatus.Overdue, FarmTaskStatus.Approved }, FarmTaskStatus.Overdue)]
    [InlineData(new[] { FarmTaskStatus.Failed, FarmTaskStatus.Approved }, FarmTaskStatus.Failed)]
    [InlineData(new[] { FarmTaskStatus.Declined, FarmTaskStatus.Approved }, FarmTaskStatus.Approved)]
    [InlineData(new[] { FarmTaskStatus.Declined, FarmTaskStatus.Declined }, FarmTaskStatus.Failed)]
    [InlineData(new[] { FarmTaskStatus.Cancelled, FarmTaskStatus.Cancelled }, FarmTaskStatus.Cancelled)]
    [InlineData(new[] { FarmTaskStatus.Cancelled, FarmTaskStatus.Accepted }, FarmTaskStatus.Accepted)]
    public void Task_status_is_aggregated_from_the_active_assignments(FarmTaskStatus[] statuses, FarmTaskStatus expected)
    {
        var assignments = statuses.Select(s => new FarmTaskAssignment { Status = s }).ToList();
        Assert.Equal(expected, FarmTaskAggregate.Compute(assignments));
    }

    private sealed class ThrowingNotificationService : INotificationService
    {
        public Task<IReadOnlyList<NotificationView>> GetUserNotificationsAsync(Guid userId, bool? isRead, int page, int pageSize, CancellationToken ct = default) => throw new InvalidOperationException("down");
        public Task<UnreadNotificationCountView> GetUnreadCountAsync(Guid userId, CancellationToken ct = default) => throw new InvalidOperationException("down");
        public Task<bool> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default) => throw new InvalidOperationException("down");
        public Task<int> MarkAllAsReadAsync(Guid userId, CancellationToken ct = default) => throw new InvalidOperationException("down");
        public Task<bool> DeleteNotificationAsync(Guid userId, Guid notificationId, CancellationToken ct = default) => throw new InvalidOperationException("down");
        public Task<int> DeleteAllReadAsync(Guid userId, CancellationToken ct = default) => throw new InvalidOperationException("down");
        public Task<NotificationView> CreateNotificationAsync(CreateNotificationCommand command, CancellationToken ct = default) => throw new InvalidOperationException("down");
    }
}
