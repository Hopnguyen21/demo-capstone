using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;
using static SmartFarm.Api.Tests.WorkforceTestSupport;

namespace SmartFarm.Api.Tests;

/// <summary>Mời Farmer vào nhân công của Farm: lời mời có trạng thái, Farmer phải chấp nhận, không tự cấp quyền Zone.</summary>
public sealed class FarmInvitationTests
{
    private static Task<HttpResponseMessage> Invite(HttpClient c, Guid farmId, string email) =>
        c.PostAsJsonAsync($"/api/v1/farms/{farmId}/invitations", new { email });

    private static async Task<FarmInvitationView> InviteOk(HttpClient c, Guid farmId, string email)
    {
        var response = await Invite(c, farmId, email);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Read<FarmInvitationView>(response);
    }

    [Fact]
    public async Task Invite_creates_a_pending_invitation_without_attaching_the_farmer_and_notifies_them()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var invitation = await InviteOk(client, seed.FarmAId, "FARMER@EXAMPLE.COM");

        Assert.Equal(FarmInvitationStatus.Pending, invitation.Status);
        Assert.Equal("farmer@example.com", invitation.Email);
        Assert.Equal(1, invitation.SendCount);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farmer = await db.AppUsers.AsNoTracking().SingleAsync(x => x.Id == seed.UnassignedFarmerId);
        Assert.Null(farmer.FarmId); Assert.Null(farmer.TenantId);
        var note = await db.Notifications.AsNoTracking().SingleAsync(x => x.UserId == seed.UnassignedFarmerId);
        Assert.Equal("/farmer/invitations", note.TargetUrl);
        Assert.Contains(invitation.Id.ToString(), note.ReferenceId);
        Assert.Single(await Read<List<FarmInvitationView>>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/invitations")));
    }

    [Fact]
    public async Task Legacy_invite_endpoint_creates_an_invitation_instead_of_attaching_immediately()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync("/api/v1/users/invite", new { email = "farmer@example.com", farmId = seed.FarmAId });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(FarmInvitationStatus.Pending, (await Read<FarmInvitationView>(response)).Status);
        using var scope = factory.Services.CreateScope();
        Assert.Null((await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().AppUsers.AsNoTracking().SingleAsync(x => x.Id == seed.UnassignedFarmerId)).FarmId);
    }

    [Fact]
    public async Task Farmer_accepts_the_invitation_and_joins_the_farm_without_any_zone_access()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var invitation = await InviteOk(client, seed.FarmAId, "farmer@example.com");

        await Login(client, "farmer@example.com");
        var mine = await Read<List<FarmInvitationView>>(await client.GetAsync("/api/v1/farm-invitations/mine"));
        Assert.Equal(invitation.Id, Assert.Single(mine).Id);
        var accepted = await Read<FarmInvitationView>(await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/accept", null));

        Assert.Equal(FarmInvitationStatus.Accepted, accepted.Status);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farmer = await db.AppUsers.AsNoTracking().SingleAsync(x => x.Id == seed.UnassignedFarmerId);
        Assert.Equal(seed.FarmAId, farmer.FarmId);
        // Tham gia Farm không tự cấp quyền Zone hay điều khiển thiết bị.
        Assert.False(await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == seed.UnassignedFarmerId));
        Assert.True(await db.Notifications.AnyAsync(x => x.UserId == seed.OwnerAId && x.ReferenceId == $"farm-invitation:{invitation.Id}:accepted"));
        // Chấp nhận lặp bị từ chối.
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/accept", null)).StatusCode);
    }

    [Fact]
    public async Task Another_farmer_cannot_accept_or_see_an_invitation_sent_to_a_different_email()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var invitation = await InviteOk(client, seed.FarmAId, "farmer@example.com");

        await Login(client, "farmer-b@example.com");
        Assert.Empty(await Read<List<FarmInvitationView>>(await client.GetAsync("/api/v1/farm-invitations/mine")));
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/decline", null)).StatusCode);
    }

    [Fact]
    public async Task Only_farmers_can_respond_to_invitations()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var invitation = await InviteOk(client, seed.FarmAId, "farmer@example.com");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/accept", null)).StatusCode);
    }

    [Fact]
    public async Task Declined_cancelled_and_resent_invitations_follow_their_status_rules()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var first = await InviteOk(client, seed.FarmAId, "farmer@example.com");

        // Gửi lại: tăng số lần gửi, tạo thông báo mới, vẫn đang chờ.
        var resent = await Read<FarmInvitationView>(await client.PostAsync($"/api/v1/farm-invitations/{first.Id}/resend", null));
        Assert.Equal(2, resent.SendCount); Assert.Equal(FarmInvitationStatus.Pending, resent.Status);
        // Một lời mời đang chờ cho mỗi email.
        Assert.Equal(HttpStatusCode.Conflict, (await Invite(client, seed.FarmAId, "farmer@example.com")).StatusCode);

        await Login(client, "farmer@example.com");
        var declined = await Read<FarmInvitationView>(await client.PostAsync($"/api/v1/farm-invitations/{first.Id}/decline", null));
        Assert.Equal(FarmInvitationStatus.Declined, declined.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/farm-invitations/{first.Id}/accept", null)).StatusCode);

        await Login(client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/farm-invitations/{first.Id}/resend", null)).StatusCode);
        var second = await InviteOk(client, seed.FarmAId, "farmer@example.com");
        var cancelled = await Read<FarmInvitationView>(await client.PostAsync($"/api/v1/farm-invitations/{second.Id}/cancel", null));
        Assert.Equal(FarmInvitationStatus.Cancelled, cancelled.Status);

        await Login(client, "farmer@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/farm-invitations/{second.Id}/accept", null)).StatusCode);
        Assert.Empty(await Read<List<FarmInvitationView>>(await client.GetAsync("/api/v1/farm-invitations/mine")));
    }

    [Fact]
    public async Task Expired_invitation_cannot_be_accepted_and_is_marked_expired()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var invitation = await InviteOk(client, seed.FarmAId, "farmer@example.com");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.FarmInvitations.SingleAsync(x => x.Id == invitation.Id)).ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        await Login(client, "farmer@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/accept", null)).StatusCode);

        await Login(client, "owner-a@example.com");
        var listed = await Read<List<FarmInvitationView>>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/invitations"));
        Assert.Equal(FarmInvitationStatus.Expired, Assert.Single(listed).Status);
        // Hết hạn thì có thể mời lại.
        Assert.Equal(HttpStatusCode.Created, (await Invite(client, seed.FarmAId, "farmer@example.com")).StatusCode);
    }

    [Fact]
    public async Task Farmer_who_already_belongs_to_another_farm_cannot_accept()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var invitation = await InviteOk(client, seed.FarmAId, "farmer@example.com");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var farmer = await db.AppUsers.SingleAsync(x => x.Id == seed.UnassignedFarmerId);
            farmer.TenantId = (await db.Farms.SingleAsync(x => x.Id == seed.FarmBId)).TenantId; farmer.FarmId = seed.FarmBId; // đã vào Farm khác sau khi được mời
            await db.SaveChangesAsync();
        }

        await Login(client, "farmer@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/accept", null)).StatusCode);
        using var check = factory.Services.CreateScope();
        Assert.Equal(seed.FarmBId, (await check.ServiceProvider.GetRequiredService<SmartFarmDbContext>().AppUsers.AsNoTracking().SingleAsync(x => x.Id == seed.UnassignedFarmerId)).FarmId);
    }

    [Fact]
    public async Task Invitation_is_rejected_for_unknown_wrong_tenant_and_already_assigned_accounts_without_leaking_other_tenants()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var unknown = await Invite(client, seed.FarmAId, "nobody@example.com");
        var otherTenant = await Invite(client, seed.FarmAId, "farmer-b@example.com"); // thuộc tổ chức khác
        var notFarmer = await Invite(client, seed.FarmAId, "owner-b@example.com");      // không phải Farmer
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, otherTenant.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, notFarmer.StatusCode);
        // Cùng một thông báo cho cả ba trường hợp: không lộ tài khoản có tồn tại ở tổ chức khác hay không.
        var messages = new[] { unknown, otherTenant, notFarmer }.Select(r => r.Content.ReadAsStringAsync().Result).Select(b => System.Text.Json.JsonDocument.Parse(b).RootElement.GetProperty("detail").GetString()).Distinct().ToList();
        Assert.Single(messages);

        var memberId = await AddMemberFarmerAsync(factory, seed, "member@example.com", "Member");
        Assert.Equal(HttpStatusCode.Conflict, (await Invite(client, seed.FarmAId, "member@example.com")).StatusCode);
        Assert.NotEqual(Guid.Empty, memberId);
        Assert.Equal(HttpStatusCode.BadRequest, (await Invite(client, seed.FarmAId, "not-an-email")).StatusCode);
    }

    [Fact]
    public async Task Owner_of_another_tenant_cannot_list_resend_or_cancel_invitations()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var invitation = await InviteOk(client, seed.FarmAId, "farmer@example.com");

        await Login(client, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/invitations")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/resend", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/farm-invitations/{invitation.Id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Invite(client, seed.FarmAId, "farmer@example.com")).StatusCode);
    }
}
