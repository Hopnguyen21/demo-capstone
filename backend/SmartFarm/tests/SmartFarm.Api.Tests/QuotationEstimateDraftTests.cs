using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Dự toán Owner đã lưu → bản nháp báo giá cho kỹ thuật viên chỉnh sửa → báo giá gửi Owner (dữ liệu in-memory).</summary>
public class QuotationEstimateDraftTests
{
    private static (SmartFarmDbContext db, QuotationService svc, ServiceRequest sr, Guid tech) Setup(bool withEstimate = true)
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new SmartFarmDbContext(options);
        var tech = Guid.NewGuid();
        var drId = Guid.NewGuid();
        var sr = new ServiceRequest
        {
            TenantId = Guid.NewGuid(), FarmId = Guid.NewGuid(), ZoneId = Guid.NewGuid(), DeploymentRequestId = drId,
            Source = "Owner", FailureCode = "NEW_INSTALL", Description = "Lap dat thiet bi moi", AssignedTechnicianId = tech,
        };
        db.ServiceRequests.Add(sr);
        if (withEstimate)
        {
            db.DeploymentEstimateItems.AddRange(
                new DeploymentEstimateItem { DeploymentRequestId = drId, SortOrder = 0, Code = "GW-1", Name = "Gateway", Model = "LG308N", Role = "Gateway", Quantity = 1, UnitPrice = 3_800_000m, Notes = "Cần 1, đã gắn 0" },
                new DeploymentEstimateItem { DeploymentRequestId = drId, SortOrder = 1, Code = "N-1", Name = "Node cam bien", Role = "SensorNode", Quantity = 3, UnitPrice = 950_000m },
                new DeploymentEstimateItem { DeploymentRequestId = drId, SortOrder = 2, Code = "INSTALLATION", Name = "Thi công", Role = "Installation", Quantity = 1, UnitPrice = 500_000m });
        }
        db.SaveChanges();
        return (db, new QuotationService(db), sr, tech);
    }

    [Fact]
    public async Task Draft_MapsEstimateLines_WithCategoryUnitVatAndTotals()
    {
        var (_, svc, sr, tech) = Setup();
        var draft = await svc.GetEstimateDraftAsync(tech, sr.Id, 8m, CancellationToken.None);
        Assert.Equal(sr.DeploymentRequestId, draft.DeploymentRequestId);
        Assert.Equal(["GW-1", "N-1", "INSTALLATION"], draft.Items.Select(i => i.Code));
        Assert.Equal(["GATEWAY", "SENSOR_NODE", "SERVICE"], draft.Items.Select(i => i.Category));
        Assert.Equal(["Trạm", "Node", "Gói"], draft.Items.Select(i => i.Unit));
        Assert.All(draft.Items, i => Assert.Equal(8m, i.VatPercent));
        Assert.Contains("dự toán của Owner", draft.Items[0].Notes);
        Assert.Equal(3_800_000m + 3 * 950_000m + 500_000m, draft.Subtotal);
        Assert.Equal(draft.Subtotal * 1.08m, draft.Total);
    }

    [Fact]
    public async Task OnlyTheAssignedTechnician_CanReadTheDraft()
    {
        var (_, svc, sr, _) = Setup();
        await Assert.ThrowsAsync<AuthorizationException>(() => svc.GetEstimateDraftAsync(Guid.NewGuid(), sr.Id, 8m, CancellationToken.None));
        await Assert.ThrowsAsync<ResourceNotFoundException>(() => svc.GetEstimateDraftAsync(Guid.NewGuid(), Guid.NewGuid(), 8m, CancellationToken.None));
    }

    [Fact]
    public async Task NoEstimateSaved_ReturnsEmptyDraft_NotInventedLines()
    {
        var (_, svc, sr, tech) = Setup(withEstimate: false);
        var draft = await svc.GetEstimateDraftAsync(tech, sr.Id, 8m, CancellationToken.None);
        Assert.Empty(draft.Items);
        Assert.Equal(0m, draft.Total);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public async Task InvalidVat_IsRejected(int vat)
    {
        var (_, svc, sr, tech) = Setup();
        await Assert.ThrowsAsync<RequestValidationException>(() => svc.GetEstimateDraftAsync(tech, sr.Id, vat, CancellationToken.None));
    }

    [Fact]
    public async Task EditedDraft_CanBeSentAsQuotation_AndTotalsMatchTheLines()
    {
        var (db, svc, sr, tech) = Setup();
        var draft = await svc.GetEstimateDraftAsync(tech, sr.Id, 8m, CancellationToken.None);
        // kỹ thuật viên chỉnh sửa: tăng số node lên 4 và bổ sung một dòng
        var edited = draft.Items.Select(i => i.Code == "N-1" ? i with { Quantity = 4 } : i)
            .Append(new QuotationItemInput("ACC-1", "Phu kien", "ACCESSORY", "Bộ", 2, 150_000m, 8m, null)).ToList();
        var q = await svc.CreateAsync(tech, sr.Id, new CreateQuotationCommand(edited, "ghi chú", "điều khoản"), CancellationToken.None);

        var subtotal = 3_800_000m + 4 * 950_000m + 500_000m + 2 * 150_000m;
        Assert.Equal(subtotal, q.Subtotal);
        Assert.Equal(subtotal * 1.08m, q.TotalAmount);
        Assert.Equal(4, q.Items.Count);
        Assert.Equal("SentToOwner", q.Status);
        Assert.Equal(1, await db.ServiceRequestQuotations.CountAsync(x => x.ServiceRequestId == sr.Id));
    }
}
