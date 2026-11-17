using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public sealed class FieldSurveyReportServiceTests
{
    private static (SmartFarmDbContext db, Guid tenantId, Guid farmId, Guid technicianId, Guid ownerId) CreateContextWithSeed()
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var db = new SmartFarmDbContext(options);

        var tenant = new Tenant { Id = Guid.NewGuid(), CompanyName = "Trang trại Đà Lạt", Subdomain = "dalat-farm" };
        var farm = new Farm { Id = Guid.NewGuid(), TenantId = tenant.Id, Tenant = tenant, Name = "Trang trại mẫu", TotalAreaM2 = 5000, LocationText = "Lạc Dương, Lâm Đồng" };
        var technician = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "tech@smartfarm.vn",
            NormalizedEmail = "TECH@SMARTFARM.VN",
            FullName = "Nguyễn Văn Kỹ Thuật",
            Role = UserRole.PlatformTechnician,
            Status = AccountStatus.Active
        };
        var owner = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Tenant = tenant,
            Email = "owner@smartfarm.vn",
            NormalizedEmail = "OWNER@SMARTFARM.VN",
            FullName = "Trần Thị Chủ Trại",
            Role = UserRole.FarmOwner,
            Status = AccountStatus.Active
        };

        db.Tenants.Add(tenant);
        db.Farms.Add(farm);
        db.AppUsers.AddRange(technician, owner);
        db.SaveChanges();

        return (db, tenant.Id, farm.Id, technician.Id, owner.Id);
    }

    [Fact]
    public async Task CreateReport_PersistsAllTenSections_AndReturnsView()
    {
        var (db, tenantId, farmId, techId, _) = CreateContextWithSeed();
        var service = new FieldSurveyReportService(db);

        var command = new CreateFieldSurveyReportCommand(
            FarmId: farmId,
            ServiceRequestId: null,
            ZoneId: null,
            Title: "Phiếu khảo sát thực địa Nhà màng Z01 - Cà chua",
            SurveyDate: DateTime.UtcNow,
            Location: "Đà Lạt, Lâm Đồng",
            SurveyorName: "Nguyễn Văn Kỹ Thuật",
            RepresentativeName: "Trần Thị Chủ Trại",
            FarmOverview: "Quy mô 2ha, gồm 4 nhà màng thép",
            CropAndSeasonStatus: "Cà chua Beef F1, mật độ 2.8 cây/m2",
            CultivationProcess: "Quy trình 4 giai đoạn với tưới nhỏ giọt",
            EnvironmentalMonitoring: "Theo dõi nhiệt độ, độ ẩm không khí SHT30 và độ ẩm đất",
            EnvironmentalThresholdNeeds: "Nhiệt độ ngày 24-28°C, đêm 16-19°C",
            EquipmentAndDataCollection: "Hạ tầng LoRa và ống tưới sẵn sàng",
            ManagementAndPermissions: "1 quản lý, 2 công nhân",
            DifficultiesAndNeeds: "Thiếu dữ liệu vi khí hậu ban đêm",
            TeamAssessment: "Đủ điều kiện lắp đặt SmartFarm Central Gateway LoRa",
            Status: "Submitted"
        );

        var report = await service.CreateReportAsync(techId, command, CancellationToken.None);

        Assert.NotNull(report);
        Assert.Equal(farmId, report.FarmId);
        Assert.Equal("Phiếu khảo sát thực địa Nhà màng Z01 - Cà chua", report.Title);
        Assert.Equal("Submitted", report.Status);
        Assert.Equal("Nguyễn Văn Kỹ Thuật", report.SurveyorName);
        Assert.Equal("Đủ điều kiện lắp đặt SmartFarm Central Gateway LoRa", report.TeamAssessment);

        // Verify in database
        var dbReport = await db.FieldSurveyReports.FirstOrDefaultAsync(r => r.Id == report.Id);
        Assert.NotNull(dbReport);
        Assert.Equal(tenantId, dbReport.TenantId);
        Assert.Equal("Quy mô 2ha, gồm 4 nhà màng thép", dbReport.FarmOverview);
    }

    [Fact]
    public async Task UpdateReport_UpdatesFields_Successfully()
    {
        var (db, _, farmId, techId, _) = CreateContextWithSeed();
        var service = new FieldSurveyReportService(db);

        var createCmd = new CreateFieldSurveyReportCommand(
            FarmId: farmId,
            ServiceRequestId: null,
            ZoneId: null,
            Title: "Báo cáo sơ bộ",
            SurveyDate: DateTime.UtcNow,
            Location: null,
            SurveyorName: null,
            RepresentativeName: null,
            FarmOverview: "Nhà màng 1",
            CropAndSeasonStatus: null,
            CultivationProcess: null,
            EnvironmentalMonitoring: null,
            EnvironmentalThresholdNeeds: null,
            EquipmentAndDataCollection: null,
            ManagementAndPermissions: null,
            DifficultiesAndNeeds: null,
            TeamAssessment: null,
            Status: "Draft"
        );
        var created = await service.CreateReportAsync(techId, createCmd, CancellationToken.None);

        var updateCmd = new UpdateFieldSurveyReportCommand(
            Title: "Báo cáo hoàn chỉnh sau khảo sát",
            SurveyDate: DateTime.UtcNow,
            Location: "Khu vực Z02",
            SurveyorName: "Kỹ thuật viên 1",
            RepresentativeName: "Chủ trại",
            FarmOverview: "Quy mô nâng cấp",
            CropAndSeasonStatus: "Dưa lưới",
            CultivationProcess: "Tưới nhỏ giọt hồi lưu",
            EnvironmentalMonitoring: "Đo EC/pH",
            EnvironmentalThresholdNeeds: "EC 1.8",
            EquipmentAndDataCollection: "Gateway LoRa",
            ManagementAndPermissions: "Owner",
            DifficultiesAndNeeds: "Nấm rễ",
            TeamAssessment: "Triển khai ngay",
            Status: "Approved"
        );

        var updated = await service.UpdateReportAsync(techId, created.Id, updateCmd, CancellationToken.None);

        Assert.Equal("Báo cáo hoàn chỉnh sau khảo sát", updated.Title);
        Assert.Equal("Approved", updated.Status);
        Assert.Equal("Dưa lưới", updated.CropAndSeasonStatus);
    }

    [Fact]
    public async Task PreventDuplicate_OnSameServiceRequestId_UpdatesExistingReport()
    {
        var (db, _, farmId, techId, _) = CreateContextWithSeed();
        var service = new FieldSurveyReportService(db);
        var sreqId = Guid.NewGuid();

        var cmd1 = new CreateFieldSurveyReportCommand(
            FarmId: farmId,
            ServiceRequestId: sreqId,
            ZoneId: null,
            Title: "Khảo sát lần 1",
            SurveyDate: DateTime.UtcNow,
            Location: "Đà Lạt",
            SurveyorName: "Tech",
            RepresentativeName: "Owner",
            FarmOverview: "Overview 1",
            CropAndSeasonStatus: "",
            CultivationProcess: "",
            EnvironmentalMonitoring: "",
            EnvironmentalThresholdNeeds: "",
            EquipmentAndDataCollection: "",
            ManagementAndPermissions: "",
            DifficultiesAndNeeds: "",
            TeamAssessment: "",
            Status: "Draft"
        );

        var rep1 = await service.CreateReportAsync(techId, cmd1, CancellationToken.None);

        // Call create again with same ServiceRequestId (simulate double click)
        var cmd2 = cmd1 with { Title = "Khảo sát lần 2 - Double click", FarmOverview = "Overview 2" };
        var rep2 = await service.CreateReportAsync(techId, cmd2, CancellationToken.None);

        // Must update same record, not create duplicate
        Assert.Equal(rep1.Id, rep2.Id);
        Assert.Equal("Khảo sát lần 2 - Double click", rep2.Title);

        var total = await db.FieldSurveyReports.CountAsync(r => r.ServiceRequestId == sreqId);
        Assert.Equal(1, total);
    }
}
