using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Identity;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Khoá Gemini nhập ở Cài đặt nền tảng: lưu mã hoá, không lộ qua API, có hiệu lực ngay và ưu tiên hơn cấu hình môi trường.</summary>
[Collection("GeminiRuntimeSettings")] // GeminiRuntimeSettings giữ giá trị gốc ở biến static nên các test của nó chạy tuần tự
public class GeminiPlatformSettingsTests
{
    private const string SigningKey = "unit-test-signing-key-with-at-least-32-characters";
    private const string RealKey = "AIzaSyTestKey0123456789abcdefghij";

    private static SmartFarmDbContext NewDb() =>
        new(new DbContextOptionsBuilder<SmartFarmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static (PlatformAdminService admin, GeminiOptions gem, GeminiEmbeddingOptions emb) NewAdmin(SmartFarmDbContext db, string envKey = "env-key-from-config-0000000")
    {
        var gem = new GeminiOptions { ApiKey = envKey, Model = "env-model" };
        var emb = new GeminiEmbeddingOptions { ApiKey = envKey };
        var admin = new PlatformAdminService(db, Options.Create(new JwtOptions { SigningKey = SigningKey }), Options.Create(gem), Options.Create(emb));
        return (admin, gem, emb);
    }

    [Fact]
    public void Secret_protector_round_trips_and_fails_closed_with_another_signing_key()
    {
        var enc = SecretProtector.Protect(RealKey, SigningKey);
        Assert.StartsWith(SecretProtector.Prefix, enc);
        Assert.DoesNotContain(RealKey, enc);
        Assert.Equal(RealKey, SecretProtector.TryUnprotect(enc, SigningKey));
        Assert.Null(SecretProtector.TryUnprotect(enc, "another-signing-key-with-at-least-32-chars"));
        Assert.Null(SecretProtector.TryUnprotect("enc:v1:not-base64!!", SigningKey));
        Assert.NotEqual(enc, SecretProtector.Protect(RealKey, SigningKey)); // nonce ngẫu nhiên
    }

    [Fact]
    public async Task Saving_the_key_encrypts_it_masks_it_in_the_list_and_applies_it_immediately()
    {
        using var db = NewDb();
        var (admin, gem, emb) = NewAdmin(db);
        var list = await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKey, RealKey), new(PlatformSettingKeys.GeminiModel, "gemini-2.5-flash")], Guid.NewGuid(), default);

        var row = await db.PlatformSettings.SingleAsync(x => x.Key == PlatformSettingKeys.GeminiApiKey);
        Assert.True(row.IsSecret);
        Assert.StartsWith(SecretProtector.Prefix, row.Value);
        Assert.DoesNotContain(RealKey, row.Value);

        var shown = list.Single(x => x.Key == PlatformSettingKeys.GeminiApiKey);
        Assert.True(shown.IsSecret);
        Assert.DoesNotContain(RealKey, shown.Value);
        Assert.EndsWith(RealKey[^4..], shown.Value);

        var audit = await db.AuditLogs.Where(x => x.EntityId == PlatformSettingKeys.GeminiApiKey).SingleAsync();
        Assert.DoesNotContain(RealKey, audit.Details ?? "");

        Assert.Equal(RealKey, gem.ApiKey);
        Assert.Equal("gemini-2.5-flash", gem.Model);
        Assert.Equal(RealKey, emb.ApiKey);
    }

    [Fact]
    public async Task Sending_the_masked_value_back_does_not_overwrite_the_stored_key()
    {
        using var db = NewDb();
        var (admin, gem, _) = NewAdmin(db);
        var list = await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKey, RealKey)], Guid.NewGuid(), default);
        var masked = list.Single(x => x.Key == PlatformSettingKeys.GeminiApiKey).Value;

        await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKey, masked)], Guid.NewGuid(), default);
        Assert.Equal(RealKey, gem.ApiKey);
    }

    [Fact]
    public async Task Clearing_the_key_falls_back_to_the_environment_configuration()
    {
        using var db = NewDb();
        var (admin, gem, _) = NewAdmin(db, envKey: "env-key-from-config-0000000");
        await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKey, RealKey)], Guid.NewGuid(), default);
        Assert.Equal(RealKey, gem.ApiKey);
        await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKey, "")], Guid.NewGuid(), default);
        Assert.Equal("env-key-from-config-0000000", gem.ApiKey);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("has space inside the key value 12345")]
    public async Task An_invalid_key_is_rejected_and_nothing_is_stored(string bad)
    {
        using var db = NewDb();
        var (admin, _, _) = NewAdmin(db);
        await Assert.ThrowsAsync<RequestValidationException>(() => admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKey, bad)], Guid.NewGuid(), default));
        Assert.False(await db.PlatformSettings.AnyAsync(x => x.Key == PlatformSettingKeys.GeminiApiKey));
    }

    [Fact]
    public async Task A_legacy_plaintext_value_is_used_and_re_encrypted_at_startup()
    {
        using var db = NewDb();
        db.PlatformSettings.Add(new SmartFarm.Domain.Entities.PlatformSetting { Key = PlatformSettingKeys.GeminiApiKey, Value = RealKey, Group = "Custom" });
        await db.SaveChangesAsync();
        var gem = new GeminiOptions { ApiKey = "" };
        await GeminiRuntimeSettings.ApplyAsync(db, SigningKey, gem, null, null, default);
        Assert.Equal(RealKey, gem.ApiKey);
        var row = await db.PlatformSettings.SingleAsync();
        Assert.True(row.IsSecret);
        Assert.StartsWith(SecretProtector.Prefix, row.Value);
    }

    private const string KeyB = "AIzaSyKeyBBBB0123456789abcdefBBBB";
    private const string KeyC = "AIzaSyKeyCCCC0123456789abcdefCCCC";

    [Fact]
    public async Task Several_keys_are_stored_encrypted_masked_in_the_list_and_pooled_with_the_environment_key()
    {
        using var db = NewDb();
        var (admin, gem, _) = NewAdmin(db);
        var json = System.Text.Json.JsonSerializer.Serialize(new[] { RealKey, KeyB });
        var list = await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKeys, json)], Guid.NewGuid(), default);

        var row = await db.PlatformSettings.SingleAsync(x => x.Key == PlatformSettingKeys.GeminiApiKeys);
        Assert.True(row.IsSecret);
        Assert.DoesNotContain(RealKey, row.Value);
        Assert.DoesNotContain(KeyB, row.Value);

        var shown = System.Text.Json.JsonSerializer.Deserialize<List<string>>(list.Single(x => x.Key == PlatformSettingKeys.GeminiApiKeys).Value)!;
        Assert.Equal(2, shown.Count);
        Assert.All(shown, m => Assert.Contains("****", m));
        Assert.DoesNotContain(list, x => x.Value.Contains(RealKey) || x.Value.Contains(KeyB));

        Assert.Equal(RealKey, gem.ApiKey);
        Assert.Equal([KeyB, "env-key-from-config-0000000"], gem.ApiKeys); // khoá Admin đứng đầu, khoá môi trường làm dự phòng
        Assert.DoesNotContain(await db.AuditLogs.ToListAsync(), a => (a.Details ?? "").Contains(RealKey));
    }

    [Fact]
    public async Task Resending_masked_entries_keeps_those_keys_and_adds_or_removes_the_rest()
    {
        using var db = NewDb();
        var (admin, gem, _) = NewAdmin(db);
        var list = await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKeys, System.Text.Json.JsonSerializer.Serialize(new[] { RealKey, KeyB }))], Guid.NewGuid(), default);
        var masked = System.Text.Json.JsonSerializer.Deserialize<List<string>>(list.Single(x => x.Key == PlatformSettingKeys.GeminiApiKeys).Value)!;

        // giữ khoá thứ hai (đã che), bỏ khoá thứ nhất, thêm khoá mới
        await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKeys, System.Text.Json.JsonSerializer.Serialize(new[] { masked[1], KeyC }))], Guid.NewGuid(), default);
        Assert.Equal(KeyB, gem.ApiKey);
        Assert.Contains(KeyC, gem.ApiKeys);
        Assert.DoesNotContain(RealKey, gem.ApiKeys);

        // xoá hết: quay về khoá môi trường
        await admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKeys, "[]")], Guid.NewGuid(), default);
        Assert.Equal("env-key-from-config-0000000", gem.ApiKey);
        Assert.Empty(gem.ApiKeys);
    }

    [Fact]
    public async Task A_masked_entry_that_matches_no_stored_key_or_too_many_keys_is_rejected()
    {
        using var db = NewDb();
        var (admin, _, _) = NewAdmin(db);
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKeys, "[\"********zzzz\"]")], Guid.NewGuid(), default));
        var many = Enumerable.Range(0, 11).Select(i => $"AIzaSyManyKeys{i:D2}0123456789abcdef").ToArray();
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKeys, System.Text.Json.JsonSerializer.Serialize(many))], Guid.NewGuid(), default));
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            admin.UpdateSettingsAsync([new(PlatformSettingKeys.GeminiApiKeys, "not json")], Guid.NewGuid(), default));
        Assert.False(await db.PlatformSettings.AnyAsync(x => x.Key == PlatformSettingKeys.GeminiApiKeys));
    }

    [Fact]
    public async Task Through_the_real_api_only_an_admin_can_save_keys_and_the_key_never_comes_back()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync(); using var client = factory.CreateClient();
        async Task Login(string email)
        {
            client.DefaultRequestHeaders.Authorization = null;
            var r = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); r.EnsureSuccessStatusCode();
            using var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", j.RootElement.GetProperty("accessToken").GetString());
        }
        var body = new[] { new { key = PlatformSettingKeys.GeminiApiKeys, value = JsonSerializer.Serialize(new[] { RealKey, KeyB }) } };

        await Login("owner-a@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync("/api/v1/platform/settings", body)).StatusCode);

        await Login("admin@example.com");
        var put = await client.PutAsJsonAsync("/api/v1/platform/settings", body);
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var putText = await put.Content.ReadAsStringAsync();
        var getText = await client.GetStringAsync("/api/v1/platform/settings");
        Assert.DoesNotContain(RealKey, putText + getText);
        Assert.DoesNotContain(KeyB, putText + getText);
        Assert.Contains("********", getText);

        using var scope = factory.Services.CreateScope();
        var gem = scope.ServiceProvider.GetRequiredService<IOptions<GeminiOptions>>().Value;
        Assert.Equal(RealKey, gem.ApiKey); // tới đúng đối tượng options dùng chung nên AI dùng được ngay
        Assert.Contains(KeyB, gem.ApiKeys);
    }
}
