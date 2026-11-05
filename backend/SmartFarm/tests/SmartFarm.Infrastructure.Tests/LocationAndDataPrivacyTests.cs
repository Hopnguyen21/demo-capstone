using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Enums;
using FluentAssertions;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Location;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public class LocationAndDataPrivacyTests
{
    [Theory]
    [InlineData("Số 123 Đường Hùng Vương, Phường 9, Thành phố Đà Lạt, Tỉnh Lâm Đồng", "Thành phố Đà Lạt, Tỉnh Lâm Đồng")]
    [InlineData("Thôn 2, Xã Đạ Sar, Huyện Lạc Dương, Tỉnh Lâm Đồng", "Huyện Lạc Dương, Tỉnh Lâm Đồng")]
    [InlineData("Ấp 4, Xã Phước Vĩnh An, Huyện Củ Chi, TP. Hồ Chí Minh", "Huyện Củ Chi, TP. Hồ Chí Minh")]
    [InlineData("Lâm Đồng", "Lâm Đồng")]
    [InlineData("Số 10 Nhà riêng của anh Hùng", null)]
    [InlineData("Kho vật tư nông nghiệp XYZ", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void GeneralRegionSanitizer_strips_specific_address_and_preserves_macro_region(string? input, string? expected)
    {
        var result = GeneralRegionSanitizer.Sanitize(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData(11.9404, 108.4583, true)]
    [InlineData(-10.5, 105.2, true)]
    [InlineData(91, 100, false)]
    [InlineData(10, 185, false)]
    [InlineData(0, 0, false)]
    public void EffectiveLocationResolver_validates_coordinates(decimal lat, decimal lng, bool isValid)
    {
        EffectiveLocationResolver.IsValidCoordinate(lat, lng).Should().Be(isValid);
    }

    [Fact]
    public void AiPromptBuilder_embeds_general_region_when_question_needs_weather_context()
    {
        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại Bảo mật Cao",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa Ruộng A",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Nhà màng Cà chua 1",
            ZoneAreaM2: 2500m,
            PlantingSeasonId: Guid.NewGuid(),
            CropName: "Cà chua",
            VarietyName: "Beef",
            GrowthProfileId: Guid.NewGuid(),
            GrowthProfileName: "Quy chuẩn VietGAP Cà chua",
            SeasonAgeDays: 45,
            GrowthStageId: Guid.NewGuid(),
            GrowthStageName: "Ra hoa đậu quả",
            Requirements: [],
            Telemetry: [],
            Actuators: [],
            UpcomingSchedules: [],
            Weather: new AiWeatherContext(true, "Nắng nhẹ", 10, 26, DateTime.UtcNow, null),
            MissingData: [],
            IsSufficientForAdvice: true,
            LocationLevel: "Zone",
            GeneralRegion: "Đà Lạt, Lâm Đồng");

        var request = new AiProviderRequest("Thời tiết này có phù hợp cho cây cà chua không?", context, []);
        var prompt = AiPromptBuilder.Build(request);

        // 1. Phải chứa thuộc tính general_region và location_level khi hỏi về thời tiết
        prompt.Should().Contain("general_region=\"Đà Lạt, Lâm Đồng\"");
        prompt.Should().Contain("location_level=\"Zone\"");

        // 2. Tuyệt đối không chứa tên Farm hoặc địa chỉ chi tiết trong prompt gửi Gemini
        prompt.Should().NotContain("Trang trại Bảo mật Cao");

        // 3. Quy tắc an toàn bắt buộc phải có trong SystemPrompt
        AiPromptBuilder.SystemPrompt.Should().Contain("BẢO VỆ VỊ TRÍ VÀ DỮ LIỆU KHÁCH HÀNG");
        AiPromptBuilder.SystemPrompt.Should().Contain("TUYỆT ĐỐI KHÔNG tự suy đoán, bịa đặt hay điều chỉnh ngưỡng");
    }

    [Fact]
    public void AiPromptBuilder_omits_general_region_when_question_does_not_need_weather()
    {
        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại Bảo mật Cao",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa Ruộng A",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Nhà màng Cà chua 1",
            ZoneAreaM2: 2500m,
            PlantingSeasonId: Guid.NewGuid(),
            CropName: "Cà chua",
            VarietyName: "Beef",
            GrowthProfileId: null,
            GrowthProfileName: null,
            SeasonAgeDays: 45,
            GrowthStageId: null,
            GrowthStageName: null,
            Requirements: [],
            Telemetry: [],
            Actuators: [],
            UpcomingSchedules: [],
            Weather: new AiWeatherContext(true, "Mát", 0, 22, DateTime.UtcNow, null),
            MissingData: [],
            IsSufficientForAdvice: true,
            LocationLevel: "Zone",
            GeneralRegion: "Đà Lạt, Lâm Đồng");

        var request = new AiProviderRequest("Bơm 1 có đang chạy không và độ ẩm đất hiện tại là bao nhiêu?", context, []);
        var prompt = AiPromptBuilder.Build(request);

        // Khi câu hỏi thuần túy về thiết bị/số đo trong nhà màng, không gửi nhãn khu vực cho AI
        prompt.Should().NotContain("general_region=");
        prompt.Should().NotContain("location_level=");
    }

    [Fact]
    public void TryExtractCenterFromGeoJson_handles_standard_geojson_polygon()
    {
        // GeoJSON standard: [lng, lat]
        var geoJson = """
        {
            "type": "Polygon",
            "coordinates": [
                [
                    [108.450, 11.950],
                    [108.470, 11.950],
                    [108.470, 11.970],
                    [108.450, 11.970],
                    [108.450, 11.950]
                ]
            ]
        }
        """;

        var center = EffectiveLocationResolver.TryExtractCenterFromGeoJson(geoJson);
        center.Should().NotBeNull();
        center!.Value.Lat.Should().Be(11.96m);
        center!.Value.Lng.Should().Be(108.46m);
    }

    [Fact]
    public void TryExtractCenterFromGeoJson_handles_multipolygon()
    {
        // MultiPolygon GeoJSON: chọn Polygon lớn nhất
        var geoJson = """
        {
            "type": "MultiPolygon",
            "coordinates": [
                [
                    [
                        [108.400, 11.900],
                        [108.405, 11.900],
                        [108.405, 11.905],
                        [108.400, 11.905],
                        [108.400, 11.900]
                    ]
                ],
                [
                    [
                        [108.450, 11.950],
                        [108.470, 11.950],
                        [108.470, 11.970],
                        [108.450, 11.970],
                        [108.450, 11.950]
                    ]
                ]
            ]
        }
        """;

        var center = EffectiveLocationResolver.TryExtractCenterFromGeoJson(geoJson);
        center.Should().NotBeNull();
        center!.Value.Lat.Should().Be(11.96m);
        center!.Value.Lng.Should().Be(108.46m);
    }

    [Fact]
    public void TryExtractCenterFromGeoJson_handles_concave_polygon_safely()
    {
        // Đa giác lõm hình chữ U:
        // Đỉnh:
        // (0, 0) -> (3, 0) -> (3, 3) -> (2, 3) -> (2, 1) -> (1, 1) -> (1, 3) -> (0, 3) -> (0, 0)
        // Với đa giác này, trung bình đỉnh/centroid có thể rơi vào vùng hở (1.5, 2.0).
        // Resolver phải đảm bảo điểm đại diện trả về nằm BÊN TRONG đa giác!
        var geoJson = """
        {
            "type": "Polygon",
            "coordinates": [
                [
                    [108.400, 11.900],
                    [108.430, 11.900],
                    [108.430, 11.930],
                    [108.420, 11.930],
                    [108.420, 11.910],
                    [108.410, 11.910],
                    [108.410, 11.930],
                    [108.400, 11.930],
                    [108.400, 11.900]
                ]
            ]
        }
        """;

        var center = EffectiveLocationResolver.TryExtractCenterFromGeoJson(geoJson);
        center.Should().NotBeNull();

        // Điểm trả về phải vượt qua kiểm tra Ray-Casting nằm bên trong
        var ring = new List<(decimal Lat, decimal Lng)>
        {
            (11.900m, 108.400m),
            (11.900m, 108.430m),
            (11.930m, 108.430m),
            (11.930m, 108.420m),
            (11.910m, 108.420m),
            (11.910m, 108.410m),
            (11.930m, 108.410m),
            (11.930m, 108.400m)
        };

        EffectiveLocationResolver.IsPointInPolygon(center!.Value.Lat, center!.Value.Lng, ring).Should().BeTrue();
    }

    [Fact]
    public void TryExtractCenterFromGeoJson_handles_leaflet_lat_lng_pairs()
    {
        // Leaflet style: [[lat, lng], [lat, lng], ...]
        var geoJson = """
        [
            [11.950, 108.450],
            [11.950, 108.470],
            [11.970, 108.470],
            [11.970, 108.450]
        ]
        """;

        var center = EffectiveLocationResolver.TryExtractCenterFromGeoJson(geoJson);
        center.Should().NotBeNull();
        center!.Value.Lat.Should().Be(11.96m);
        center!.Value.Lng.Should().Be(108.46m);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("not a json")]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("{\"type\": \"Feature\"}")]
    public void TryExtractCenterFromGeoJson_returns_null_for_invalid_input(string? input)
    {
        var center = EffectiveLocationResolver.TryExtractCenterFromGeoJson(input);
        center.Should().BeNull();
    }

    [Theory]
    [InlineData("Tổ 5, Khu phố 3, Phường 10, Thành phố Đà Lạt, Lâm Đồng", "Thành phố Đà Lạt, Lâm Đồng")]
    [InlineData("Ngõ 45 Đường Hoàng Hoa Thám, Phường 10, Đà Lạt, Lâm Đồng", "Đà Lạt, Lâm Đồng")]
    [InlineData("Khu phố 1, Thị trấn Đơn Dương, Huyện Đơn Dương, Lâm Đồng", "Huyện Đơn Dương, Lâm Đồng")]
    [InlineData("104 Hai Bà Trưng, Phường 6, Đà Lạt, Lâm Đồng", "Đà Lạt, Lâm Đồng")]
    public void GeneralRegionSanitizer_strips_complex_vietnamese_prefixes(string input, string expected)
    {
        var result = GeneralRegionSanitizer.Sanitize(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("Tôi là Tuấn, sđt 0987654321, có nên tưới cà chua không?", "Tôi là [tên], sđt [sđt], có nên tưới cà chua không?")]
    [InlineData("Email liên hệ: tuan@smartfarm.vn. Đất có ẩm không?", "Email liên hệ: [email]. Đất có ẩm không?")]
    [InlineData("Số CCCD 001234567890 hỏi về phân bón", "Số CCCD [cccd] hỏi về phân bón")]
    [InlineData("Mã hợp đồng HD-2026/01 cần tư vấn thời tiết", "Mã [hợp đồng] cần tư vấn thời tiết")]
    [InlineData("Độ ẩm 65% và nhiệt độ 28°C có phù hợp không?", "Độ ẩm 65% và nhiệt độ 28°C có phù hợp không?")]
    public void AiPrivacySanitizer_masks_pii_in_user_question(string input, string expected)
    {
        var result = AiPrivacySanitizer.SanitizeUserQuestion(input);
        result.Should().Be(expected);
    }

    [Fact]
    public void AiPromptBuilder_scrubs_pii_from_user_question_and_free_text_fields()
    {
        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại Bảo mật",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa 1",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Nhà màng chú Ba sđt 0912345678",
            ZoneAreaM2: 1000m,
            PlantingSeasonId: null,
            CropName: "Cà chua",
            VarietyName: null,
            GrowthProfileId: null,
            GrowthProfileName: null,
            SeasonAgeDays: 0,
            GrowthStageId: null,
            GrowthStageName: null,
            Requirements: [],
            Telemetry: [],
            Actuators: [],
            UpcomingSchedules: [],
            Weather: new AiWeatherContext(true, "Mát", 0, 22, DateTime.UtcNow, null),
            MissingData: [],
            IsSufficientForAdvice: true,
            LocationLevel: "Farm",
            GeneralRegion: "Lâm Đồng");

        var request = new AiProviderRequest("Số điện thoại của tôi là 0912345678 và email abc@test.com kèm HĐ-12345", context, []);
        var prompt = AiPromptBuilder.Build(request);

        prompt.Should().NotContain("0912345678");
        prompt.Should().NotContain("abc@test.com");
        prompt.Should().NotContain("HĐ-12345");
        prompt.Should().Contain("[sđt]");
        prompt.Should().Contain("[email]");
        prompt.Should().Contain("[hợp đồng]");
        // Free text zone name must also be sanitized
        prompt.Should().Contain("Nhà màng chú Ba sđt [sđt]");
    }
    [Fact]
    public void AiPromptBuilder_omits_operational_clutter_for_pure_knowledge_questions()
    {
        var now = DateTime.UtcNow;
        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại Bảo mật",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa 1",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Zone 1",
            ZoneAreaM2: 1000m,
            PlantingSeasonId: null,
            CropName: "Cà chua",
            VarietyName: null,
            GrowthProfileId: null,
            GrowthProfileName: null,
            SeasonAgeDays: 0,
            GrowthStageId: null,
            GrowthStageName: null,
            Requirements: [],
            Telemetry: [],
            Actuators: [new AiActuatorContextItem(Guid.NewGuid(), "WaterPump", 600, true)],
            UpcomingSchedules: [new AiUpcomingScheduleContextItem("Lịch tưới", now.AddMinutes(20), "10:00", 600, 20)],
            Weather: new AiWeatherContext(true, "Mát", 0, 22, now, null),
            MissingData: [],
            IsSufficientForAdvice: true,
            ActiveAlerts: [new AiAlertContextItem(Domain.Enums.EnvironmentalParameterCode.SoilMoisture, 30, 60, 80, "%", "Warning", "Open", "Đất khô", now)],
            RecentCommands: [new AiCommandContextItem("WaterPump", "TurnOn", 600, "Acknowledged", "Manual", now)],
            AutoRules: [new AiAutoRuleContextItem("Tự tưới", Domain.Enums.EnvironmentalParameterCode.SoilMoisture, "LessThan", 50, 5, "TurnOn", 600, 60, true, 70)],
            OpenTasks: [new AiTaskContextItem("Bón phân đợt 1", now.AddDays(1), "Pending")],
            Gateways: [new AiGatewaySummary( "Gateway 1", "Online", now, "1.0", "433MHz", 1)],
            LocationLevel: "Zone",
            GeneralRegion: "Lâm Đồng");

        var request = new AiProviderRequest("Bệnh phấn trắng trên cà chua xử lý thế nào theo quy chuẩn VietGAP?", context, []);
        var prompt = AiPromptBuilder.Build(request);

        // Với câu hỏi thuần kiến thức nông học/VietGAP, các mục vận hành tự do phải được lược bỏ
        prompt.Should().NotContain("<active_alerts>");
        prompt.Should().NotContain("<recent_commands");
        prompt.Should().NotContain("<auto_rules>");
        prompt.Should().NotContain("<open_tasks>");
        prompt.Should().NotContain("<gateways>");
        prompt.Should().NotContain("<actuators>");
        prompt.Should().NotContain("<upcoming_schedules>");

        // Vẫn giữ bối cảnh cây trồng và quy chuẩn
        prompt.Should().Contain("<crop name=\"Cà chua\"");
    }

    [Fact]
    public void AiPromptBuilder_Respects_Intent_Allowlist_For_Agronomy_Knowledge()
    {
        var now = DateTime.UtcNow;
        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại mẫu",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa A",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Vườn bí mật 01",
            ZoneAreaM2: 1200m,
            PlantingSeasonId: Guid.NewGuid(),
            CropName: "Cà chua Beefsteak",
            VarietyName: "Beef F1",
            GrowthProfileId: Guid.NewGuid(),
            GrowthProfileName: "Quy trình VietGAP Cà Chua",
            SeasonAgeDays: 20,
            GrowthStageId: Guid.NewGuid(),
            GrowthStageName: "Cây con & Bén rễ",
            Requirements: [new AiRequirementContextItem(EnvironmentalParameterCode.SoilMoisture, 60, 80, 70, "%")],
            Telemetry: [new AiTelemetryContextItem(EnvironmentalParameterCode.SoilMoisture, 65, "%", now, true)],
            Actuators: [new AiActuatorContextItem(Guid.NewGuid(), "IrrigationPump", 600, true)],
            UpcomingSchedules: [new AiUpcomingScheduleContextItem("Lịch tưới chiều", now.AddHours(2), "16:00", 600, 120)],
            Weather: new AiWeatherContext(true, "Âm u", 20, 24, now, null),
            MissingData: [],
            IsSufficientForAdvice: true,
            Gateways: [new AiGatewaySummary("Gateway 1", "Online", now, "1.0", "AS923", 4)],
            ActiveAlerts: [new AiAlertContextItem(EnvironmentalParameterCode.Temperature, 38, 18, 32, "°C", "Warning", "Open", "Nhiệt độ cao", now)]);

        var intent = new QuestionIntent([QuestionTopics.AgronomyKnowledge], []);
        var request = new AiProviderRequest("Kỹ thuật cải tạo đất trồng cà chua", context, [], intent);
        var prompt = AiPromptBuilder.Build(request);

        // Allowlist theo intent: Câu hỏi kiến thức đất/canh tác không gửi telemetry, gateways, alerts, actuators, schedules, weather
        prompt.Should().NotContain("<telemetry>");
        prompt.Should().NotContain("<gateways>");
        prompt.Should().NotContain("<actuators>");
        prompt.Should().NotContain("<active_alerts>");
        prompt.Should().NotContain("<upcoming_schedules>");
        prompt.Should().NotContain("<weather");

        // Tên Zone cụ thể không được gửi ra ngoài khi hỏi thuần kiến thức
        prompt.Should().NotContain("Vườn bí mật 01");
        prompt.Should().Contain("<zone type=");
    }

    [Fact]
    public void AiPromptBuilder_Filters_Telemetry_By_Intent_Parameters()
    {
        var now = DateTime.UtcNow;
        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại mẫu",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa A",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Zone 1",
            ZoneAreaM2: 1000m,
            PlantingSeasonId: null,
            CropName: "Cà chua",
            VarietyName: null,
            GrowthProfileId: null,
            GrowthProfileName: null,
            SeasonAgeDays: 10,
            GrowthStageId: null,
            GrowthStageName: null,
            Requirements: [
                new AiRequirementContextItem(EnvironmentalParameterCode.Temperature, 18, 30, 24, "°C"),
                new AiRequirementContextItem(EnvironmentalParameterCode.SoilMoisture, 60, 80, 70, "%"),
                new AiRequirementContextItem(EnvironmentalParameterCode.Ph, 6.0m, 7.0m, 6.5m, "pH")
            ],
            Telemetry: [
                new AiTelemetryContextItem(EnvironmentalParameterCode.Temperature, 25.5m, "°C", now, true),
                new AiTelemetryContextItem(EnvironmentalParameterCode.SoilMoisture, 68m, "%", now, true),
                new AiTelemetryContextItem(EnvironmentalParameterCode.Ph, 6.2m, "pH", now, true)
            ],
            Actuators: [],
            UpcomingSchedules: [],
            Weather: new AiWeatherContext(true, "Mát", 0, 25, now, null),
            MissingData: [],
            IsSufficientForAdvice: true);

        // Intent chỉ hỏi về Temperature
        var intent = new QuestionIntent([QuestionTopics.SensorReadings], [EnvironmentalParameterCode.Temperature]);
        var request = new AiProviderRequest("Nhiệt độ hiện tại trong vườn là bao nhiêu?", context, [], intent);
        var prompt = AiPromptBuilder.Build(request);

        // Chỉ chứa thông số Temperature, không gửi SoilMoisture hay SoilPh
        prompt.Should().Contain("parameter=\"Temperature\"");
        prompt.Should().NotContain("parameter=\"SoilMoisture\"");
        prompt.Should().NotContain("parameter=\"Ph\"");
    }

    [Fact]
    public void AiPromptBuilder_Soil_Question_Only_Contains_Soil_Requirements_And_No_Operational_Clutter()
    {
        var now = DateTime.UtcNow;
        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại mẫu",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa A",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Vườn bí mật 01",
            ZoneAreaM2: 1200m,
            PlantingSeasonId: Guid.NewGuid(),
            CropName: "Cà chua Beefsteak",
            VarietyName: "Beef F1",
            GrowthProfileId: Guid.NewGuid(),
            GrowthProfileName: "Quy trình VietGAP Cà Chua",
            SeasonAgeDays: 20,
            GrowthStageId: Guid.NewGuid(),
            GrowthStageName: "Cây con & Bén rễ",
            Requirements: [
                new AiRequirementContextItem(EnvironmentalParameterCode.Temperature, 18, 32, 25, "°C"),
                new AiRequirementContextItem(EnvironmentalParameterCode.AirHumidity, 60, 85, 70, "%"),
                new AiRequirementContextItem(EnvironmentalParameterCode.Ph, 6.0m, 6.8m, 6.5m, "pH"),
                new AiRequirementContextItem(EnvironmentalParameterCode.SoilMoisture, 60, 80, 70, "%")
            ],
            Telemetry: [
                new AiTelemetryContextItem(EnvironmentalParameterCode.Temperature, 26, "°C", now, true),
                new AiTelemetryContextItem(EnvironmentalParameterCode.Ph, 6.2m, "pH", now, true)
            ],
            Actuators: [new AiActuatorContextItem(Guid.NewGuid(), "IrrigationPump", 600, true)],
            UpcomingSchedules: [new AiUpcomingScheduleContextItem("Lịch tưới", now.AddHours(2), "16:00", 600, 120)],
            Weather: new AiWeatherContext(true, "Nắng nhẹ", 0, 26, now, null),
            MissingData: [],
            IsSufficientForAdvice: true,
            Gateways: [new AiGatewaySummary("Gateway 1", "Online", now, "1.0", "AS923", 4)],
            ActiveAlerts: [new AiAlertContextItem(EnvironmentalParameterCode.Temperature, 38, 18, 32, "°C", "Warning", "Open", "Nhiệt độ cao", now)]);

        var request = new AiProviderRequest("Kỹ thuật cải tạo đất chua và độ pH đất cho cây cà chua", context, []);
        var prompt = AiPromptBuilder.Build(request);

        // 1. Chỉ chứa yêu cầu pH/đất, KHÔNG chứa ngưỡng nhiệt độ hay độ ẩm không khí
        prompt.Should().Contain("parameter=\"Ph\"");
        prompt.Should().NotContain("parameter=\"Temperature\"");
        prompt.Should().NotContain("parameter=\"AirHumidity\"");

        // 2. Không chứa telemetry, gateway, alerts, actuators, schedules, weather
        prompt.Should().NotContain("<telemetry>");
        prompt.Should().NotContain("<gateways>");
        prompt.Should().NotContain("<active_alerts>");
        prompt.Should().NotContain("<actuators>");
        prompt.Should().NotContain("<upcoming_schedules>");
        prompt.Should().NotContain("<weather");

        // 3. Không để lộ tên Zone người dùng tự nhập
        prompt.Should().NotContain("Vườn bí mật 01");
        prompt.Should().Contain("<zone type=");
    }

    [Fact]
    public void AiPromptBuilder_Preserves_Passages_With_Different_Thresholds_Or_Numbers()
    {
        var docId1 = Guid.NewGuid();
        var docId2 = Guid.NewGuid();
        // Hai tài liệu có văn bản gần giống nhưng số liệu ngưỡng kỹ thuật KHÁC NHAU
        var passage1 = new KnowledgePassageView(Guid.NewGuid(), docId1, "Quy chuẩn VietGAP", "Bộ NN&PTNT", "agronomy",
            "Nhiệt độ thích hợp cho cây cà chua phát triển là từ 22 đến 25°C.", 0.95f, PageNumber: 12, Version: "2024");
        var passage2 = new KnowledgePassageView(Guid.NewGuid(), docId2, "Sổ tay khuyến nông", "Viện KHKT Nông nghiệp", "agronomy",
            "Nhiệt độ thích hợp cho cây cà chua phát triển là từ 25 đến 28°C.", 0.92f, PageNumber: 45, Version: "2024");

        var deduplicated = AiPromptBuilder.DeduplicatePassages([passage1, passage2]);

        // CẢ HAI passage bắt buộc phải được bảo toàn để AI đối chiếu mâu thuẫn theo quy tắc 15 của SystemPrompt
        deduplicated.Should().HaveCount(2);
        deduplicated.Should().Contain(p => p.Content.Contains("22 đến 25°C"));
        deduplicated.Should().Contain(p => p.Content.Contains("25 đến 28°C"));
    }

    [Fact]
    public void AiPromptBuilder_Deduplicates_Duplicate_Passages_And_Preserves_Rich_Metadata()
    {
        var docId = Guid.NewGuid();
        // Cùng một tài liệu, chunk 2 bị trùng lặp nội dung với chunk 1 do sliding window nhưng chunk 1 có metadata giàu hơn
        var passage1 = new KnowledgePassageView(Guid.NewGuid(), docId, "Quy chuẩn VietGAP 2024", "Bộ NN&PTNT", "agronomy",
            "Đất trồng cà chua cần có độ pH từ 6.0 đến 6.8, giàu mùn hữu cơ và thoát nước tốt.", 0.95f, PageNumber: 12, SectionTitle: "Chuẩn bị đất", Version: "2024");
        var passage2 = new KnowledgePassageView(Guid.NewGuid(), docId, "Quy chuẩn VietGAP 2024", "Bộ NN&PTNT", "agronomy",
            "Đất trồng cà chua cần có độ pH từ 6.0 đến 6.8, giàu mùn hữu cơ và thoát nước tốt.", 0.85f, PageNumber: null, SectionTitle: null, Version: null);

        var deduplicated = AiPromptBuilder.DeduplicatePassages([passage1, passage2]);

        // Trùng lặp thực sự bị loại bỏ, chỉ giữ lại 1 bản
        deduplicated.Should().HaveCount(1);
        // Giữ lại bản có metadata đầy đủ nhất (PageNumber và SectionTitle)
        deduplicated[0].PageNumber.Should().Be(12);
        deduplicated[0].SectionTitle.Should().Be("Chuẩn bị đất");
    }

    [Theory]
    [InlineData(-2, 5, true)]   // Vừa đo cách đây 2 phút -> Mới
    [InlineData(-10, 5, false)] // Đo cách đây 10 phút (> 5 phút) -> Quá hạn / Cũ
    [InlineData(5, 5, false)]   // Timestamp trong tương lai 5 phút -> Lỗi múi giờ / Không hợp lệ
    [InlineData(0, 5, true)]    // Đo ngay lúc này -> Mới
    public void TelemetryFreshnessValidator_Handles_Fresh_Stale_Future_And_Clock_Skew(int minuteOffset, int freshnessMinutes, bool expectedFresh)
    {
        var now = new DateTime(2026, 11, 5, 10, 0, 0, DateTimeKind.Utc);
        var readingTime = now.AddMinutes(minuteOffset);

        var isFresh = TelemetryFreshnessValidator.IsFresh(readingTime, now, freshnessMinutes);
        isFresh.Should().Be(expectedFresh);
    }

    [Fact]
    public void TelemetryFreshnessValidator_Allows_Slight_Clock_Skew_Up_To_15_Seconds()
    {
        var now = new DateTime(2026, 11, 5, 10, 0, 0, DateTimeKind.Utc);
        
        // Lệch đồng hồ nhẹ +10s -> Cho phép
        TelemetryFreshnessValidator.IsFresh(now.AddSeconds(10), now, 5).Should().BeTrue();

        // Lệch đồng hồ vượt quá +20s -> Không chấp nhận
        TelemetryFreshnessValidator.IsFresh(now.AddSeconds(20), now, 5).Should().BeFalse();
    }

    [Fact]
    public void AiPromptBuilder_Only_Includes_Fresh_Telemetry_In_Current_Advice()
    {
        var now = DateTime.UtcNow;
        var freshReading = new AiTelemetryContextItem(EnvironmentalParameterCode.Temperature, 25, "°C", now.AddMinutes(-2), IsFresh: true);
        var staleReading = new AiTelemetryContextItem(EnvironmentalParameterCode.SoilMoisture, 60, "%", now.AddHours(-1), IsFresh: false);

        var context = new AiZoneContext(
            FarmId: Guid.NewGuid(),
            FarmName: "Trang trại mẫu",
            FarmTimeZone: "Asia/Ho_Chi_Minh",
            FieldId: Guid.NewGuid(),
            FieldName: "Thửa A",
            ZoneId: Guid.NewGuid(),
            ZoneName: "Zone 1",
            ZoneAreaM2: 1000m,
            PlantingSeasonId: null,
            CropName: "Cà chua",
            VarietyName: null,
            GrowthProfileId: null,
            GrowthProfileName: null,
            SeasonAgeDays: 10,
            GrowthStageId: null,
            GrowthStageName: null,
            Requirements: [],
            Telemetry: [freshReading, staleReading],
            Actuators: [],
            UpcomingSchedules: [],
            Weather: new AiWeatherContext(false, null, null, null, null, null),
            MissingData: [],
            IsSufficientForAdvice: true);

        var request = new AiProviderRequest("Kiểm tra cảm biến", context, [], new QuestionIntent([QuestionTopics.SensorReadings], []));
        var prompt = AiPromptBuilder.Build(request);

        // Chỉ đưa số đo mới (IsFresh == true) vào prompt tư vấn hiện tại
        prompt.Should().Contain("parameter=\"Temperature\" value=\"25\"");
        // Số đo cũ bị loại bỏ khỏi telemetry quyết định hiện thời
        prompt.Should().NotContain("parameter=\"SoilMoisture\" value=\"60\"");
    }
}
