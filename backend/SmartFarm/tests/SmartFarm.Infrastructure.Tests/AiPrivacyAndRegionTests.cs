using FluentAssertions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Ai.Location;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public class AiPrivacySanitizerExtraTests
{
    [Theory]
    [InlineData("Liên hệ ông Nguyễn Văn An về lịch tưới", "Nguyễn")]
    [InlineData("Họ tên: Trần Thị Bình, cần tư vấn", "Trần")]
    [InlineData("SĐT: 0912 345 678 gọi giúp", "345")]
    [InlineData("Địa chỉ: thôn 3 xã Đạ Nhim, Lạc Dương", "Đạ Nhim")]
    [InlineData("Email an@example.com và CCCD 012345678901", "example.com")]
    public void Personal_data_is_masked(string input, string mustNotRemain)
    {
        AiPrivacySanitizer.SanitizeUserQuestion(input).Should().NotContain(mustNotRemain);
        AiPrivacySanitizer.SanitizeFreeText(input).Should().NotContain(mustNotRemain);
    }

    [Fact]
    public void Agronomic_content_is_preserved()
    {
        const string q = "Độ ẩm đất 65% và nhiệt độ 28°C, cà chua giai đoạn ra hoa có cần tưới không?";
        AiPrivacySanitizer.SanitizeUserQuestion(q).Should().Be(q);
    }
}

public class GeneralRegionSanitizerTests
{
    [Fact]
    public void District_level_names_are_kept_but_ward_and_below_are_dropped()
    {
        GeneralRegionSanitizer.Sanitize("Đà Lạt, Lâm Đồng").Should().Be("Đà Lạt, Lâm Đồng");
        GeneralRegionSanitizer.Sanitize("Phường Xuân Hương, Lâm Đồng").Should().Be("Lâm Đồng");
        GeneralRegionSanitizer.Sanitize("Huyện Lạc Dương, Lâm Đồng").Should().Be("Huyện Lạc Dương, Lâm Đồng");
    }

    [Fact]
    public void Street_level_details_are_dropped() =>
        GeneralRegionSanitizer.Sanitize("12 Đường Hoàng Hoa Thám, Phường 3, Lâm Đồng").Should().Be("Lâm Đồng");
}

public class ClimateRegionMapperTests
{
    [Theory]
    [InlineData("Lâm Đồng", "highlands")]
    [InlineData("Huyện Lạc Dương, Lâm Đồng", "highlands")]
    [InlineData("Hà Nội", "north")]
    [InlineData("Tỉnh Nghệ An", "central")]
    [InlineData("TP. Hồ Chí Minh", "south")]
    [InlineData("Cần Thơ", "south")]
    public void Province_maps_to_climate_region(string label, string expected) =>
        ClimateRegionMapper.FromGeneralRegion(label).Should().Be(expected);

    [Fact]
    public void Unknown_or_empty_region_is_null()
    {
        ClimateRegionMapper.FromGeneralRegion(null).Should().BeNull();
        ClimateRegionMapper.FromGeneralRegion("Nơi nào đó").Should().BeNull();
    }

    [Theory]
    [InlineData("", "north", true)]            // không ghi vùng: áp dụng mọi vùng
    [InlineData("highlands", "highlands", true)]
    [InlineData("highlands", "north", false)]  // tài liệu cao nguyên không dùng cho miền Bắc
    [InlineData("north,central", "central", true)]
    [InlineData("highlands", null, true)]      // chưa biết vùng nông trại: không loại tài liệu
    public void Document_region_scope_filter(string scope, string? farmRegion, bool expected) =>
        ClimateRegionMapper.Matches(scope, farmRegion).Should().Be(expected);
}

public class SeedKnowledgeProvenanceTests
{
    [Fact]
    public void Seed_documents_are_labelled_as_internal_compilations_not_official_publications()
    {
        foreach (var (doc, _) in KnowledgeBaseSeedData.GetSeedDocuments())
        {
            doc.AuthorOrganization.Should().StartWith("SmartFarm - tổng hợp nội bộ");
            doc.ReviewNotes.Should().Contain("chưa phải văn bản chính thức");
        }
    }

    [Fact]
    public void Regional_seed_document_is_scoped_to_highlands() =>
        KnowledgeBaseSeedData.GetSeedDocuments()
            .Single(x => x.Document.Title.Contains("dâu tây")).Document.RegionScope.Should().Be("highlands");
}

public class ClimateRegionFromCoordinatesTests
{
    [Theory]
    [InlineData(21.03, 105.85, "north")]      // Hà Nội
    [InlineData(16.05, 108.22, "central")]    // Đà Nẵng
    [InlineData(11.94, 108.44, "highlands")]  // Đà Lạt
    [InlineData(12.67, 108.04, "highlands")]  // Buôn Ma Thuột
    [InlineData(10.78, 106.70, "south")]      // TP.HCM
    [InlineData(10.03, 105.78, "south")]      // Cần Thơ
    public void Coordinates_map_to_region(double lat, double lng, string expected) =>
        ClimateRegionMapper.FromCoordinates((decimal)lat, (decimal)lng).Should().Be(expected);

    [Fact]
    public void Outside_vietnam_is_null() =>
        ClimateRegionMapper.FromCoordinates(48.85m, 2.35m).Should().BeNull();

    [Fact]
    public void Address_wins_over_coordinates_and_coordinates_are_the_fallback()
    {
        // địa chỉ nhận diện được tỉnh: dùng địa chỉ dù toạ độ nằm vùng khác
        ClimateRegionMapper.Resolve("Hà Nội", 10.78m, 106.70m).Should().Be("north");
        // địa chỉ không nhận diện được: dùng toạ độ
        ClimateRegionMapper.Resolve("Nơi nào đó", 10.78m, 106.70m).Should().Be("south");
        ClimateRegionMapper.Resolve(null, null, null).Should().BeNull();
    }

    [Fact]
    public void Prompt_carries_coarse_climate_region_but_no_coordinates()
    {
        var ctx = new SmartFarm.Application.Features.Ai.AiZoneContext(
            FarmId: Guid.NewGuid(), FarmName: "F", FarmTimeZone: "Asia/Ho_Chi_Minh", FieldId: Guid.NewGuid(), FieldName: "T",
            ZoneId: Guid.NewGuid(), ZoneName: "Z", ZoneAreaM2: 100m, PlantingSeasonId: null, CropName: "Cà chua", VarietyName: null,
            GrowthProfileId: null, GrowthProfileName: null, SeasonAgeDays: 0, GrowthStageId: null, GrowthStageName: null,
            Requirements: [], Telemetry: [], Actuators: [], UpcomingSchedules: [],
            Weather: new SmartFarm.Application.Features.Ai.AiWeatherContext(true, "Mát", 0, 22, DateTime.UtcNow, null),
            MissingData: [], IsSufficientForAdvice: true, LocationLevel: "Farm", GeneralRegion: "Lâm Đồng", ClimateRegion: "highlands");
        var prompt = AiPromptBuilder.Build(new SmartFarm.Application.Features.Ai.AiProviderRequest("Cây cà chua có bị rét không?", ctx));
        prompt.Should().Contain("climate_region=\"highlands\"");
        prompt.Should().NotContain("108.");
    }
}

public class DocumentPrivacyTests
{
    [Fact]
    public void Document_text_masks_identifiers_but_keeps_agronomic_and_place_names()
    {
        const string text = "Liên hệ: an@farm.vn, SĐT 0912 345 678, CCCD 012345678901. Địa chỉ: 12 Lê Lợi, Đà Lạt. Họ tên: Trần Thị Bình. " +
                            "Vùng Bà Rịa - Vũng Tàu, hợp tác xã Đồng Tâm, tưới 65% độ ẩm đất.";
        var clean = AiPrivacySanitizer.SanitizeDocumentText(text);
        clean.Should().NotContain("an@farm.vn").And.NotContain("0912").And.NotContain("012345678901")
            .And.NotContain("Lê Lợi").And.NotContain("Trần Thị Bình");
        clean.Should().Contain("Bà Rịa - Vũng Tàu").And.Contain("hợp tác xã Đồng Tâm").And.Contain("65% độ ẩm đất");
    }

    [Theory]
    [InlineData(1234.0, 1200.0)]
    [InlineData(1250.0, 1300.0)]
    [InlineData(80.0, 80.0)]
    public void Area_sent_to_ai_is_coarsened(double area, double expected) =>
        AiPromptBuilder.CoarseArea((decimal)area).Should().Be((decimal)expected);

    [Fact]
    public void Knowledge_passages_in_prompt_are_sanitized()
    {
        var ctx = new SmartFarm.Application.Features.Ai.AiZoneContext(
            FarmId: Guid.NewGuid(), FarmName: "F", FarmTimeZone: "Asia/Ho_Chi_Minh", FieldId: Guid.NewGuid(), FieldName: "T",
            ZoneId: Guid.NewGuid(), ZoneName: "Z", ZoneAreaM2: 1234m, PlantingSeasonId: null, CropName: "Cà chua", VarietyName: null,
            GrowthProfileId: null, GrowthProfileName: null, SeasonAgeDays: 0, GrowthStageId: null, GrowthStageName: null,
            Requirements: [], Telemetry: [], Actuators: [], UpcomingSchedules: [],
            Weather: new SmartFarm.Application.Features.Ai.AiWeatherContext(true, "Mát", 0, 22, DateTime.UtcNow, null),
            MissingData: [], IsSufficientForAdvice: true);
        var passage = new KnowledgePassageView(Guid.NewGuid(), Guid.NewGuid(), "Tài liệu", "Org", "irrigation",
            "Tưới nhỏ giọt cho cà chua giai đoạn ra hoa. Liên hệ 0912345678 hoặc an@farm.vn để biết thêm.", 0.9f);
        var request = new SmartFarm.Application.Features.Ai.AiProviderRequest("Tưới cà chua thế nào?", ctx) { KnowledgePassages = [passage] };
        var prompt = AiPromptBuilder.Build(request);
        prompt.Should().NotContain("0912345678").And.NotContain("an@farm.vn");
        prompt.Should().Contain("area_m2=\"1200\"");
    }
}

public class AiOutputGuardTests
{
    [Fact]
    public void Masks_identifiers_guids_and_prompt_tags_in_model_output()
    {
        var r = AiOutputGuard.Scrub("Gọi 0912345678 hoặc an@farm.vn. Thiết bị 3fa85f64-5717-4562-b3fc-2c963f66afa6 <zone_context>x</zone_context> đang tắt.");
        r.Text.Should().NotContain("0912345678").And.NotContain("an@farm.vn").And.NotContain("3fa85f64").And.NotContain("<zone_context>");
        r.Text.Should().Contain("[mã nội bộ]").And.Contain("đang tắt");
        r.Changed.Should().BeTrue();
        r.LeakSuspected.Should().BeFalse();
    }

    [Fact]
    public void Withholds_output_that_reads_back_system_rules()
    {
        var r = AiOutputGuard.Scrub("Quy tắc của tôi: BẢO MẬT MÃ KỸ THUẬT NỘI BỘ: Không để lộ mã UUID...");
        r.LeakSuspected.Should().BeTrue();
        r.Text.Should().Be(AiOutputGuard.WithheldNotice);
    }

    [Fact]
    public void Normal_advice_is_unchanged()
    {
        const string t = "Độ ẩm đất 62%, nên tưới nhẹ vào sáng mai nếu không có mưa.";
        var r = AiOutputGuard.Scrub(t);
        r.Text.Should().Be(t);
        r.Changed.Should().BeFalse();
    }
}

public class RealLogRegressionTests
{
    [Fact]
    public void Question_from_real_log_is_fully_masked_even_with_typo_in_self_introduction()
    {
        const string q = "ôi là Nguyễn Văn An, sđt 0912345678, email an@gmail.com, địa chỉ: 12 Lê Lợi Đà Lạt. Cà chua nhà tôi có cần tưới không?";
        var clean = AiPrivacySanitizer.SanitizeUserQuestion(q);
        clean.Should().NotContain("Nguyễn").And.NotContain("Văn An").And.NotContain("0912345678").And.NotContain("an@gmail.com").And.NotContain("Lê Lợi");
        clean.Should().Contain("Cà chua nhà tôi có cần tưới không?");
    }

    [Theory]
    [InlineData("Cà Chua Beefsteak cần tưới bao nhiêu?")]
    [InlineData("Khu ca chua 12 có bị nóng không?")]
    public void Crop_and_zone_names_are_not_masked(string q) =>
        AiPrivacySanitizer.SanitizeUserQuestion(q).Should().Be(q);
}
