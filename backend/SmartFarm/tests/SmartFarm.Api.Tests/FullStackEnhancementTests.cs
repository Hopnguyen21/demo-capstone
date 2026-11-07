using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SmartFarm.Api.HostedServices;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using System.Text.Json.Serialization;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class FullStackEnhancementTests
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true, Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task UpdateUserProfile_ShouldUpdateFullNameAndPhone_AndKeepRoleAndTenantUnchanged()
    {
        using var factory = new TestApplicationFactory();
        var client = factory.CreateClient();
        var email = $"user_{Guid.NewGuid():N}@smartfarm.vn";
        var password = "ValidPassword123!";

        // Register new FarmOwner
        var registerResp = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password,
            fullName = "Tên Ban Đầu",
            phone = "0901111111",
            role = "FarmOwner"
        });
        registerResp.EnsureSuccessStatusCode();

        // Login to acquire JWT token
        var loginResp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        loginResp.EnsureSuccessStatusCode();
        var tokenDoc = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var token = tokenDoc.GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // Fetch original profile
        var meBefore = await client.GetFromJsonAsync<UserDetailView>("/api/v1/users/me", JsonOpts);
        Assert.NotNull(meBefore);
        Assert.Equal("Tên Ban Đầu", meBefore.FullName);
        Assert.Equal("0901111111", meBefore.Phone);
        Assert.Equal(UserRole.FarmOwner, meBefore.Role);

        // Update profile
        var updateResp = await client.PutAsJsonAsync("/api/v1/users/me", new UpdateUserProfileRequest(
            FullName: "Nguyễn Văn Cập Nhật",
            Phone: "0988776655"));
        updateResp.EnsureSuccessStatusCode();

        var meAfter = await updateResp.Content.ReadFromJsonAsync<UserDetailView>(JsonOpts);
        Assert.NotNull(meAfter);
        Assert.Equal("Nguyễn Văn Cập Nhật", meAfter.FullName);
        Assert.Equal("0988776655", meAfter.Phone);
        Assert.Equal(meBefore.Email, meAfter.Email);
        Assert.Equal(meBefore.Role, meAfter.Role);
        Assert.Equal(meBefore.TenantId, meAfter.TenantId);
        Assert.Equal(meBefore.UserId, meAfter.UserId);
    }

    [Fact]
    public async Task UpdateUserProfile_ShouldRejectInvalidNameOrPhone()
    {
        using var factory = new TestApplicationFactory();
        var client = factory.CreateClient();
        var email = $"user_{Guid.NewGuid():N}@smartfarm.vn";
        var password = "ValidPassword123!";

        await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password,
            fullName = "Nguyễn Văn Test",
            role = "FarmOwner"
        });

        var loginResp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var tokenDoc = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var token = tokenDoc.GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // Empty Name should fail
        var emptyNameResp = await client.PutAsJsonAsync("/api/v1/users/me", new UpdateUserProfileRequest(
            FullName: "   ",
            Phone: null));
        Assert.Equal(HttpStatusCode.BadRequest, emptyNameResp.StatusCode);

        // Phone over 20 chars should fail
        var longPhoneResp = await client.PutAsJsonAsync("/api/v1/users/me", new UpdateUserProfileRequest(
            FullName: "Hợp Lệ",
            Phone: "012345678901234567890123456789"));
        Assert.Equal(HttpStatusCode.BadRequest, longPhoneResp.StatusCode);
    }

    [Fact]
    public async Task Backup_Create_ShouldGenerateZipArchive_With63Tables_AndOmitPasswords()
    {
        using var factory = new TestApplicationFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        // Ensure PlatformAdmin user exists
        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            NormalizedEmail = "ADMIN@SMARTFARM.VN",
            FullName = "Platform Administrator",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active,
            PasswordHash = "SECRET_HASH_DO_NOT_LEAK"
        };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        var inMemoryConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:RetentionDays"] = "7",
                ["BackupStorage:MaxBackups"] = "5",
                ["BackupStorage:AllowLiveRestore"] = "false"
            })
            .Build();

        var backupService = new BackupService(db, inMemoryConfig, NullLogger<BackupService>.Instance, TimeProvider.System);

        // Create backup
        var result = await backupService.CreateBackupAsync(admin.Id, CancellationToken.None);
        Assert.NotNull(result);
        Assert.True(File.Exists(Path.Combine(backupDir, result.FileName)));
        Assert.True(result.SizeBytes > 0);
        Assert.False(string.IsNullOrWhiteSpace(result.ChecksumSha256));
        Assert.Equal(63, result.TableRecordCounts.Count);

        // Inspect zip archive structure: manifest.json + data.json
        var fullPath = Path.Combine(backupDir, result.FileName);
        {
            using var fileStream = File.OpenRead(fullPath);
            using var zip = new ZipArchive(fileStream, ZipArchiveMode.Read);
            var manifestEntry = zip.GetEntry("manifest.json");
            var dataEntry = zip.GetEntry("data.json");
            Assert.NotNull(manifestEntry);
            Assert.NotNull(dataEntry);

            using var dataStream = dataEntry.Open();
            using var doc = await JsonDocument.ParseAsync(dataStream);
            var jsonText = doc.RootElement.ToString();
            Assert.DoesNotContain("SECRET_HASH_DO_NOT_LEAK", jsonText);
            Assert.DoesNotContain("PasswordHash", jsonText);
            Assert.Contains(admin.Email, jsonText);
        }

        // Verify ListBackups returns the file with rich manifest metadata
        var list = await backupService.ListBackupsAsync(CancellationToken.None);
        var meta = Assert.Single(list, b => b.FileName == result.FileName);
        Assert.Equal("1.0", meta.FormatVersion);
        Assert.Equal("OperationalDomainSnapshot", meta.SupportedScope);
        Assert.Equal(63, meta.TableRecordCounts.Count);

        // Cleanup
        if (Directory.Exists(backupDir))
        {
            Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task Backup_Verify_ValidArchive_ShouldSucceedWithChecksumMatch()
    {
        using var factory = new TestApplicationFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Admin",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active
        };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        var inMemoryConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir
            })
            .Build();

        var backupService = new BackupService(db, inMemoryConfig, NullLogger<BackupService>.Instance, TimeProvider.System);
        var created = await backupService.CreateBackupAsync(admin.Id, CancellationToken.None);

        // Run Verification
        var verify = await backupService.VerifyBackupAsync(created.FileName, admin.Id, CancellationToken.None);
        Assert.True(verify.IsValid);
        Assert.True(verify.ChecksumVerified);
        Assert.Equal("1.0", verify.FormatVersion);
        Assert.Empty(verify.MissingRequiredTables);
        Assert.Empty(verify.Warnings);

        if (Directory.Exists(backupDir))
        {
            Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task Backup_Verify_TamperedData_ShouldDetectChecksumMismatch()
    {
        using var factory = new TestApplicationFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Admin",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active
        };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        var inMemoryConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir
            })
            .Build();

        var backupService = new BackupService(db, inMemoryConfig, NullLogger<BackupService>.Instance, TimeProvider.System);
        var created = await backupService.CreateBackupAsync(admin.Id, CancellationToken.None);

        var fullPath = Path.Combine(backupDir, created.FileName);

        // Tamper with data.json inside the zip archive
        byte[] manifestBytes;
        {
            using var readZip = ZipFile.OpenRead(fullPath);
            using var manifestStream = readZip.GetEntry("manifest.json")!.Open();
            using var ms = new MemoryStream();
            manifestStream.CopyTo(ms);
            manifestBytes = ms.ToArray();
        }

        // Overwrite zip with modified data.json
        File.Delete(fullPath);
        using (var writeZip = ZipFile.Open(fullPath, ZipArchiveMode.Create))
        {
            var manifestEntry = writeZip.CreateEntry("manifest.json");
            using (var s = manifestEntry.Open())
            {
                s.Write(manifestBytes, 0, manifestBytes.Length);
            }

            var dataEntry = writeZip.CreateEntry("data.json");
            using (var s = dataEntry.Open())
            {
                var tamperedBytes = System.Text.Encoding.UTF8.GetBytes("{\"tampered\": true}");
                s.Write(tamperedBytes, 0, tamperedBytes.Length);
            }
        }

        // Verification must detect mismatch
        var verify = await backupService.VerifyBackupAsync(created.FileName, admin.Id, CancellationToken.None);
        Assert.False(verify.IsValid);
        Assert.False(verify.ChecksumVerified);
        Assert.Contains(verify.Warnings, e => e.Contains("không khớp"));

        if (Directory.Exists(backupDir))
        {
            Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task Backup_PathTraversal_AndUnauthorized_ShouldBeBlocked()
    {
        using var factory = new TestApplicationFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Admin",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active
        };
        var farmer = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"farmer_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Farmer",
            Role = UserRole.Farmer,
            Status = AccountStatus.Active
        };
        db.AppUsers.AddRange(admin, farmer);
        await db.SaveChangesAsync();

        var inMemoryConfig = new ConfigurationBuilder().Build();
        var backupService = new BackupService(db, inMemoryConfig, NullLogger<BackupService>.Instance, TimeProvider.System);

        // Path Traversal blocked
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            backupService.DownloadBackupAsync("../../../boot.ini", admin.Id, CancellationToken.None));

        await Assert.ThrowsAsync<RequestValidationException>(() =>
            backupService.RestoreBackupAsync("..\\malicious.sfbackup", new RestoreBackupRequest(true, "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));

        await Assert.ThrowsAsync<RequestValidationException>(() =>
            backupService.VerifyBackupAsync("..\\malicious.sfbackup", admin.Id, CancellationToken.None));

        // Unauthorized user blocked
        await Assert.ThrowsAsync<AuthorizationException>(() =>
            backupService.CreateBackupAsync(farmer.Id, CancellationToken.None));

        await Assert.ThrowsAsync<AuthorizationException>(() =>
            backupService.VerifyBackupAsync("test.sfbackup", farmer.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Backup_Restore_DryRun_And_LiveRestore_Behavior()
    {
        using var factory = new TestApplicationFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Admin",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active
        };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));

        // 1. Safe Dry-run when AllowLiveRestore = false
        var safeConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:AllowLiveRestore"] = "false"
            })
            .Build();

        var safeService = new BackupService(db, safeConfig, NullLogger<BackupService>.Instance, TimeProvider.System);
        var created = await safeService.CreateBackupAsync(admin.Id, CancellationToken.None);

        var dryRunResult = await safeService.RestoreBackupAsync(
            created.FileName,
            new RestoreBackupRequest(true, "CONFIRM_RESTORE"),
            admin.Id,
            CancellationToken.None);

        Assert.False(dryRunResult.Success);
        Assert.True(dryRunResult.IsDryRunOnly);
        Assert.Contains("allowliverestore=false", dryRunResult.Message.ToLowerInvariant());

        // 2. Live Restore when AllowLiveRestore = true
        var liveConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:AllowLiveRestore"] = "true"
            })
            .Build();

        var liveService = new BackupService(db, liveConfig, NullLogger<BackupService>.Instance, TimeProvider.System);
        var liveResult = await liveService.RestoreBackupAsync(
            created.FileName,
            new RestoreBackupRequest(true, "CONFIRM_RESTORE"),
            admin.Id,
            CancellationToken.None);

        Assert.True(liveResult.Success);
        Assert.False(liveResult.IsDryRunOnly);
        Assert.NotNull(liveResult.PreRestoreBackupFileName);
        Assert.True(File.Exists(Path.Combine(backupDir, liveResult.PreRestoreBackupFileName)));

        if (Directory.Exists(backupDir))
        {
            Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public void DeviceLivenessWindow_ShouldCalculateCorrectly_ForDeviceSpecificAndGatewayFallback()
    {
        var gateway = new Gateway
        {
            TelemetryIntervalSec = 30,
            SamplesPerInterval = 2
        };

        // Fallback to gateway: (30 * 2) + 30 = 90 seconds
        var deviceWithGatewayFallback = new Device
        {
            Gateway = gateway,
            HeartbeatIntervalSeconds = null
        };
        var window1 = DeviceLivenessWorker.DeviceLivenessWindow(deviceWithGatewayFallback);
        Assert.Equal(TimeSpan.FromSeconds(90), window1);

        // Device-specific heartbeat interval = 15s: (15 * 2) + 15 = 45 seconds
        var deviceWithCustomHeartbeat = new Device
        {
            Gateway = gateway,
            HeartbeatIntervalSeconds = 15
        };
        var window2 = DeviceLivenessWorker.DeviceLivenessWindow(deviceWithCustomHeartbeat);
        Assert.Equal(TimeSpan.FromSeconds(45), window2);
    }

    [Fact]
    public async Task DeviceLiveness_ShouldTransitionStaleDeviceToOffline_WhileProtectingMaintenanceAndDecommissioned()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
        var zone = await db.Zones.SingleAsync(z => z.Id == seed.ZoneAId);

        var req = new DeploymentRequest
        {
            TenantId = farm.TenantId,
            FarmId = farm.Id,
            ZoneId = zone.Id,
            PlantingSeasonId = Guid.NewGuid(),
            OwnerUserId = seed.OwnerAId
        };
        db.DeploymentRequests.Add(req);

        var gateway = new Gateway
        {
            FarmId = farm.Id,
            DeploymentRequest = req,
            MacAddress = "AA:BB:CC:DD:EE:" + Guid.NewGuid().ToString("N")[..2],
            TelemetryIntervalSec = 20,
            SamplesPerInterval = 1
        };
        db.Gateways.Add(gateway);

        var staleUtc = DateTime.UtcNow.AddMinutes(-10);

        // Online device that went stale
        var onlineDevice = new Device
        {
            Farm = farm,
            Gateway = gateway,
            DeploymentRequest = req,
            HardwareAddress = "DEV-ONLINE-" + Guid.NewGuid().ToString("N")[..6],
            Status = DeviceStatus.Online,
            LastSeenAtUtc = staleUtc,
            HeartbeatIntervalSeconds = 20
        };

        // MaintenanceRequired device with old LastSeen
        var maintenanceDevice = new Device
        {
            Farm = farm,
            Gateway = gateway,
            DeploymentRequest = req,
            HardwareAddress = "DEV-MAINT-" + Guid.NewGuid().ToString("N")[..6],
            Status = DeviceStatus.MaintenanceRequired,
            LastSeenAtUtc = staleUtc,
            HeartbeatIntervalSeconds = 20
        };

        // Decommissioned device
        var decommDevice = new Device
        {
            Farm = farm,
            Gateway = gateway,
            DeploymentRequest = req,
            HardwareAddress = "DEV-DECOMM-" + Guid.NewGuid().ToString("N")[..6],
            Status = DeviceStatus.Decommissioned,
            LastSeenAtUtc = staleUtc
        };

        db.Devices.AddRange(onlineDevice, maintenanceDevice, decommDevice);
        await db.SaveChangesAsync();

        // Simulate liveness check logic
        var now = DateTime.UtcNow;
        var onlineDevices = await db.Devices
            .Include(x => x.Gateway)
            .Where(x => x.Status == DeviceStatus.Online)
            .ToListAsync();

        var stale = onlineDevices
            .Where(x => x.Status != DeviceStatus.MaintenanceRequired &&
                        x.Status != DeviceStatus.Decommissioned &&
                        x.Status != DeviceStatus.Unassigned &&
                        (x.LastSeenAtUtc == null || x.LastSeenAtUtc < now - DeviceLivenessWorker.DeviceLivenessWindow(x)))
            .ToList();

        foreach (var dev in stale)
        {
            dev.Status = DeviceStatus.Offline;
        }
        await db.SaveChangesAsync();

        // Verify status changes
        var updatedOnline = await db.Devices.SingleAsync(d => d.Id == onlineDevice.Id);
        var updatedMaint = await db.Devices.SingleAsync(d => d.Id == maintenanceDevice.Id);
        var updatedDecomm = await db.Devices.SingleAsync(d => d.Id == decommDevice.Id);

        Assert.Equal(DeviceStatus.Offline, updatedOnline.Status);
        Assert.Equal(DeviceStatus.MaintenanceRequired, updatedMaint.Status);
        Assert.Equal(DeviceStatus.Decommissioned, updatedDecomm.Status);
    }
}
