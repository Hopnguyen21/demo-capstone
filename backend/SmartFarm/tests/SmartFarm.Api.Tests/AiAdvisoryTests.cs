using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class AiAdvisoryTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Missing_context_returns_explicit_non_actionable_result_without_calling_provider()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        // Câu hỏi realtime/điều khiển giữ kiểm tra an toàn: thiếu vụ mùa/cảm biến thì không gọi model.
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Có nên tưới cho khu vực này bây giờ không?" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var recommendation = await Read<AiRecommendationView>(response);
        Assert.Equal(AiRecommendationStatus.InsufficientData, recommendation.Status);
        Assert.False(recommendation.IsActionable);
        Assert.Contains(recommendation.Limitations, x => x.Contains("planting season", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Weather_question_on_a_zone_without_a_season_is_not_judged_and_never_hits_the_knowledge_base()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask",
            new { question = "Thời tiết dự báo tiếp theo có thích hợp cho sự phát triển của cây không?" });

        var recommendation = await Read<AiRecommendationView>(response);
        Assert.Equal(AiRecommendationStatus.InsufficientData, recommendation.Status);
        Assert.Contains(recommendation.Limitations, x => x.Contains("ngưỡng nhiệt độ", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain("Kho tri thức", recommendation.Summary + recommendation.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Schedule_question_uses_zone_schedule_data_not_the_knowledge_base()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Có lịch tưới tự động nào sắp chạy trong hôm nay không?" });

        var recommendation = await Read<AiRecommendationView>(response);
        Assert.DoesNotContain("Kho tri thức", recommendation.Summary + recommendation.Details);
        Assert.DoesNotContain("Chưa tìm thấy tài liệu", recommendation.Summary);
    }

    [Fact]
    public async Task Knowledge_question_names_another_crop_searches_that_crop_docs_but_keeps_zone_data_and_crop()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        Guid otherCropDoc, zoneCropDoc;
        string zoneCropName;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            // Câu hỏi kiến thức nêu cây khác (xà lách) thì tra tài liệu của cây đó; dữ liệu và cây vận hành vẫn là của Zone.
            var zoneCrop = (await db.Crops.AsNoTracking().SingleAsync(c => c.Id == Guid.Parse("10000000-0000-0000-0000-000000000001"))).Name;
            zoneCropName = zoneCrop;
            Assert.NotEqual("Xà lách", CropNames.Canonical(zoneCrop));
            AgricultureDocument Add(string title, string scope)
            {
                var doc = new AgricultureDocument { Title = title, CropScope = scope, ContentText = "x", ReviewStatus = AgricultureDocumentReviewStatus.Approved, IsPublic = true };
                db.AgricultureDocuments.Add(doc);
                db.AgricultureKnowledgeChunks.Add(new AgricultureKnowledgeChunk { DocumentId = doc.Id, Document = doc, ChunkIndex = 0, Keywords = "thu hoạch", Content = "Thu hoạch quả khi chín 70-80% màu sắc đặc trưng, thu hoạch vào sáng sớm khi nhiệt độ thấp, dụng cụ thu hoạch và thùng chứa phải sạch, ghi chép ngày thu hoạch và lô sản phẩm để truy xuất." });
                return doc;
            }
            otherCropDoc = Add("Thu hoạch xà lách", "Xà lách").Id;
            zoneCropDoc = Add("Thu hoạch cây của Zone", zoneCrop).Id;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/ask", new { question = "Khi nào nên thu hoạch xà lách?" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var passages = factory.AiProvider.LastRequest!.KnowledgePassages!;
        Assert.Contains(passages, p => p.DocumentId == otherCropDoc);
        Assert.DoesNotContain(passages, p => p.DocumentId == zoneCropDoc); // tài liệu riêng của cây Zone không phải thứ được hỏi
        var sent = factory.AiProvider.LastRequest!.Context;
        Assert.Equal(CropNames.Canonical(zoneCropName), CropNames.Canonical(sent.CropName!)); // cây vận hành vẫn của Zone
        Assert.Equal("Xà lách", CropNames.Canonical(sent.KnowledgeCrop!));
        Assert.Equal("question", sent.KnowledgeCropSource);
    }

    private static async Task<AiRecommendationView> AskAsync(TestApplicationFactory factory, Guid zoneId, string question)
    {
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/ai/ask", new { question });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Read<AiRecommendationView>(response);
    }

    private static async Task SetSeasonStartAsync(TestApplicationFactory factory, Guid zoneId, int daysAgoInFarmTime, int daysToEnd = 60)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
        var season = await db.PlantingSeasons.SingleAsync(x => x.ZoneId == zoneId && x.Status == PlantingSeasonStatus.InProgress);
        season.StartDate = today.AddDays(-daysAgoInFarmTime);
        season.ExpectedEndDate = today.AddDays(daysToEnd);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Harvest_question_reports_elapsed_days_by_farm_date_and_never_invents_a_harvest_date()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        await SetSeasonStartAsync(factory, fixture.ZoneId, daysAgoInFarmTime: 10, daysToEnd: 20);
        factory.IntentClassifier.Understands("còn bao lâu nữa thì thu hoạch", new QuestionIntent([QuestionTopics.Season, QuestionTopics.Harvest], []));

        var answer = await AskAsync(factory, fixture.ZoneId, "còn bao lâu nữa thì thu hoạch");

        Assert.Equal(AiRecommendationStatus.Ready, answer.Status);
        Assert.Contains("đã 10 ngày", answer.Details);
        Assert.Contains("còn 20 ngày", answer.Details);
        Assert.Contains("không phải ngày thu hoạch", answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls); // số liệu do backend tính, không qua mô hình
    }

    [Fact]
    public async Task Ripening_question_on_a_zone_with_crop_but_no_season_cites_the_reference_profile_plan_as_plan_only()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var season in db.PlantingSeasons.Where(x => x.ZoneId == fixture.ZoneId)) season.Status = PlantingSeasonStatus.Completed;
            await db.SaveChangesAsync();
        }
        const string question = "số ngày chín của cây";
        factory.IntentClassifier.Understands(question, new QuestionIntent([QuestionTopics.Harvest, QuestionTopics.AgronomyKnowledge], []));

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.Contains("Cây trong Zone:", answer.Details);
        Assert.Contains("kế hoạch tham chiếu", answer.Details);
        Assert.Contains("không phải số ngày thực tế", answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Last_completed_season_is_reported_as_history_only()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var season in db.PlantingSeasons.Where(x => x.ZoneId == fixture.ZoneId))
            {
                season.Status = PlantingSeasonStatus.Completed;
                season.ActualEndDate = new DateOnly(2026, 10, 20);
                season.ActualYieldKg = 850m;
            }
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "giai đoạn hiện tại của cây");

        Assert.Contains("Vụ gần nhất đã kết thúc", answer.Details);
        Assert.Contains("850", answer.Details);
        Assert.Contains("không phải cây hay giai đoạn hiện tại", answer.Details);
        Assert.Contains("chưa có vụ mùa đang canh tác", answer.Details); // vụ cũ không thành vụ hiện tại
    }

    [Fact]
    public async Task Season_answer_names_a_farm_owned_profile_as_such()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var profile = await db.GrowthProfiles.SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000003"));
            profile.IsSystemDefined = false;
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "cây bao nhiêu ngày tuổi rồi");

        Assert.Contains("tuỳ chỉnh của trang trại", answer.Details);
    }

    [Fact]
    public async Task Harvest_only_intent_still_requires_approved_documents_and_keeps_season_facts()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        await SetSeasonStartAsync(factory, fixture.ZoneId, daysAgoInFarmTime: 10);
        const string question = "tiêu chí thu hoạch của cây này";
        factory.IntentClassifier.Understands(question, new QuestionIntent([QuestionTopics.Harvest], []));

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.Equal(AiRecommendationStatus.InsufficientData, answer.Status);
        Assert.Contains("đã 10 ngày", answer.Details);
        Assert.Contains("tài liệu", answer.Details);
    }

    [Fact]
    public async Task Season_of_another_crop_than_the_zone_is_reported_as_inconsistent_and_not_used()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        await SetSeasonStartAsync(factory, fixture.ZoneId, daysAgoInFarmTime: 7);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var otherCrop = new Crop { Name = "Cây khác", NormalizedName = "CAY KHAC" };
            db.Crops.Add(otherCrop);
            await db.SaveChangesAsync();
            var season = await db.PlantingSeasons.SingleAsync(x => x.ZoneId == fixture.ZoneId);
            season.CropId = otherCrop.Id; // vụ đang chạy thuộc cây khác với cây đã gán cho Zone
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "cây bao nhiêu ngày tuổi rồi");

        Assert.Contains("chưa nhất quán", answer.Details);
        Assert.Contains("Cây khác", answer.Details);
        Assert.DoesNotContain("đã 7 ngày", answer.Details); // không dùng tuổi/giai đoạn của vụ sai cây
    }

    [Fact]
    public async Task Irrigation_is_refused_without_a_control_proposal_when_the_season_crop_does_not_match_the_zone()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var otherCrop = new Crop { Name = "Cây khác", NormalizedName = "CAY KHAC" };
            db.Crops.Add(otherCrop);
            await db.SaveChangesAsync();
            (await db.PlantingSeasons.SingleAsync(x => x.ZoneId == fixture.ZoneId)).CropId = otherCrop.Id;
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "Độ ẩm đất thấp, có nên tưới ngay không?");

        Assert.False(answer.IsActionable);
        Assert.Null(answer.ProposedAction);
    }

    [Fact]
    public async Task Context_sent_to_the_provider_takes_the_crop_from_the_zone_and_keeps_the_season_crop_separate()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        await SetSeasonStartAsync(factory, fixture.ZoneId, daysAgoInFarmTime: 10);

        await AskAsync(factory, fixture.ZoneId, "Độ ẩm đất thấp, có nên tưới ngay không?");

        var sent = factory.AiProvider.LastRequest!.Context;
        Assert.Equal("zone", sent.CropSource);
        Assert.False(sent.SeasonCropMismatch);
        Assert.NotNull(sent.SeasonFacts);
        Assert.Equal(10, sent.SeasonFacts!.ElapsedDays);
    }

    [Fact]
    public async Task Zone_without_crop_is_never_given_a_crop_from_its_name_or_notes()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var crop = (await db.Crops.AsNoTracking().SingleAsync(c => c.Id == Guid.Parse("10000000-0000-0000-0000-000000000001"))).Name;
            foreach (var season in db.PlantingSeasons.Where(x => x.ZoneId == fixture.ZoneId)) season.Status = PlantingSeasonStatus.Completed;
            var zone = await db.Zones.SingleAsync(z => z.Id == fixture.ZoneId);
            zone.CropId = null;
            zone.CropVarietyId = null;
            zone.Name = $"Khu {crop} 12";
            zone.Notes = $"Trồng {crop}";
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "zone này đang trồng cây gì");

        Assert.Contains("chưa được gán cây", answer.Details);
        Assert.DoesNotContain("Cây đang trồng:", answer.Details);
        Assert.DoesNotContain("Cây trong Zone:", answer.Details); // vụ đã hoàn thành chỉ là lịch sử, không thành cây hiện tại
    }

    [Fact]
    public async Task Planned_season_crop_is_described_as_planned_not_as_growing()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var season in db.PlantingSeasons.Where(x => x.ZoneId == fixture.ZoneId)) season.Status = PlantingSeasonStatus.Planned;
            var zone = await db.Zones.SingleAsync(z => z.Id == fixture.ZoneId);
            zone.CropId = null;
            zone.CropVarietyId = null;
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "zone này đang trồng cây gì");

        Assert.Contains("chưa được gán cây", answer.Details);
        Assert.Contains("dự kiến", answer.Details);
        Assert.DoesNotContain("Cây đang trồng:", answer.Details);
    }

    [Fact]
    public async Task Multi_intent_question_keeps_zone_data_when_the_knowledge_part_has_no_approved_document()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        const string question = "độ ẩm đất hiện tại và cách bón phân cho thanh long";
        factory.IntentClassifier.Understands(question, new QuestionIntent([QuestionTopics.SensorReadings, QuestionTopics.AgronomyKnowledge], [EnvironmentalParameterCode.SoilMoisture]));

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.Contains("Độ ẩm đất", answer.Details);
        Assert.Contains("35", answer.Details);
        Assert.Contains("tài liệu", answer.Details);
        Assert.Equal(AiRecommendationStatus.InsufficientData, answer.Status);
    }

    [Fact]
    public async Task Multi_intent_with_unavailable_weather_still_answers_the_other_part_and_names_the_gap()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        const string question = "độ ẩm đất và thời tiết sắp tới";
        factory.AiWeatherProvider.Result = new AiWeatherResult(false, null, null, null, null, "Nhà cung cấp thời tiết không phản hồi.");
        factory.IntentClassifier.Understands(question, new QuestionIntent([QuestionTopics.SensorReadings, QuestionTopics.Weather], [EnvironmentalParameterCode.SoilMoisture]));

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.Contains("Độ ẩm đất", answer.Details);
        Assert.Contains("thời tiết", answer.Details, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(answer.Limitations, x => x.Contains("thời tiết", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Sensor_overview_lists_real_readings_without_asserting_health_or_actuator_status()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, "thông tin cảm biến hiện tại");

        Assert.Equal(AiRecommendationStatus.Ready, answer.Status);
        Assert.Contains("Độ ẩm đất", answer.Details);
        Assert.Contains("35", answer.Details);
        Assert.DoesNotContain("ổn định", answer.Details);
        Assert.DoesNotContain("thiết bị chấp hành", answer.Details);
        Assert.False(answer.IsActionable);
        // AI chỉ được gọi một lần để viết nhận xét tổng thể, không có thiết bị chấp hành/hành động trong yêu cầu đó.
        Assert.Equal(1, factory.AiProvider.Calls);
        Assert.Empty(factory.AiProvider.LastRequest!.Context.Actuators);
        Assert.Contains("Nhận xét tổng thể (AI): Soil is dry", answer.Details);
    }

    [Theory]
    [InlineData("độ ẩm đất của zone")]
    [InlineData("độ ẩm bao nhiêu")]
    [InlineData("cho tôi biết độ ẩm đất hiện tại")]
    public async Task Question_about_one_parameter_is_answered_from_that_parameters_readings(string question)
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.Equal(AiRecommendationStatus.Ready, answer.Status);
        Assert.Contains("Độ ẩm đất", answer.Details);
        Assert.Contains("35", answer.Details);
        Assert.DoesNotContain("tài liệu", answer.Summary + answer.Details);
    }

    [Fact]
    public async Task Question_about_a_parameter_without_readings_says_so_instead_of_searching_documents()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, "nhiệt độ của zone");

        Assert.Equal(AiRecommendationStatus.InsufficientData, answer.Status);
        Assert.Contains("chưa có số đo nhiệt độ", answer.Details);
        Assert.DoesNotContain("tài liệu", answer.Summary + answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Agronomy_question_about_a_parameter_is_still_answered_from_documents_not_readings()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, "nhiệt độ ảnh hưởng thế nào đến cây");

        Assert.DoesNotContain("Số đo hiện tại", answer.Summary);
    }

    [Theory]
    [InlineData("có cảnh báo nào không")]
    [InlineData("zone đang có cảnh báo gì")]
    [InlineData("lệnh tưới gần đây là gì")]
    [InlineData("bơm đã chạy lần nào chưa")]
    [InlineData("lịch tưới sắp tới của zone")]
    [InlineData("công việc sắp đến hạn")]
    [InlineData("có nhiệm vụ nào cần làm không")]
    [InlineData("cây đang ở giai đoạn nào")]
    [InlineData("zone này đang trồng cây gì")]
    [InlineData("cây bao nhiêu ngày tuổi rồi")]
    [InlineData("diện tích zone là bao nhiêu")]
    [InlineData("thông tin zone này")]
    [InlineData("quy tắc tự động của zone")]
    [InlineData("pin các node còn bao nhiêu")]
    [InlineData("tín hiệu các node thế nào")]
    public async Task Zone_data_questions_are_answered_from_zone_data_never_sent_to_the_knowledge_base(string question)
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.True(answer.Status == AiRecommendationStatus.Ready, question + " => " + answer.Status + ": " + answer.Summary + " | " + answer.Details);
        Assert.DoesNotContain("Kho tri thức", answer.Summary + answer.Details);
        Assert.DoesNotContain("tài liệu", answer.Summary + answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Theory]
    [InlineData("loại cây nào chịu hạn tốt")]
    [InlineData("cà chua thu hoạch sau bao nhiêu ngày")]
    [InlineData("cà chua giai đoạn ra hoa cần bón phân gì")]
    [InlineData("quy trình VietGAP ghi chép nhật ký")]
    public async Task Knowledge_questions_are_not_hijacked_by_zone_data_topics(string question)
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.NotEqual("Thông tin của Zone", answer.Summary);
    }

    [Fact]
    public async Task Stage_question_for_a_zone_with_crop_but_no_season_does_not_invent_stage_or_age()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var season in db.PlantingSeasons.Where(x => x.ZoneId == fixture.ZoneId)) season.Status = PlantingSeasonStatus.Cancelled;
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "giai đoạn hiện tại của cây");

        Assert.Contains("Cây trong Zone:", answer.Details);
        Assert.Contains("chưa có vụ mùa đang canh tác", answer.Details);
        Assert.Contains("chưa xác định được giai đoạn hiện tại", answer.Details);
        Assert.DoesNotContain(" ngày (theo ngày của Farm)", answer.Details);
    }

    [Fact]
    public async Task Question_about_actuators_lists_the_actuator_devices_not_the_sensor_nodes()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, "2 thiết bị chấp hành là cái gì");

        Assert.Equal(AiRecommendationStatus.Ready, answer.Status);
        Assert.Contains("thiết bị chấp hành", answer.Details);
        Assert.Contains("Node chấp hành 1", answer.Details);
        Assert.Contains("máy bơm", answer.Details);
        Assert.DoesNotContain("Node cảm biến", answer.Details);
    }

    [Fact]
    public async Task Any_phrasing_works_when_the_ai_understands_the_intent_without_code_changes()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        // Câu diễn đạt chưa từng có trong mã hay test nào: chỉ cần AI hiểu đúng ý định.
        const string question = "xế chiều rồi mà vườn còn ẩm không nhỉ";
        factory.IntentClassifier.Understands(question, new QuestionIntent([QuestionTopics.SensorReadings], [EnvironmentalParameterCode.SoilMoisture]));

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.Equal(AiRecommendationStatus.Ready, answer.Status);
        Assert.Contains("Độ ẩm đất", answer.Details);
        Assert.DoesNotContain("tài liệu", answer.Summary + answer.Details);
    }

    [Fact]
    public async Task Unclassified_question_goes_to_the_advisory_ai_with_full_context_instead_of_being_refused()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        // Không có ý định nào được khai báo cho câu này (như khi bước phân loại không khả dụng).
        var answer = await AskAsync(factory, fixture.ZoneId, "cho mình hỏi chút về vườn của mình");

        Assert.Equal(1, factory.AiProvider.Calls);
        Assert.NotEmpty(factory.AiProvider.LastRequest!.Context.Telemetry);
        Assert.DoesNotContain("Kho tri thức", answer.Summary + answer.Details);
    }

    [Fact]
    public async Task Question_is_still_answered_when_the_intent_classifier_fails()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        factory.IntentClassifier.Throw = true;

        var answer = await AskAsync(factory, fixture.ZoneId, "nhiệt độ của zone");

        Assert.Equal(1, factory.AiProvider.Calls);
        Assert.DoesNotContain("Kho tri thức", answer.Summary + answer.Details);
    }

    [Fact]
    public async Task Sensor_overview_shows_every_nodes_reading_instead_of_one_representative()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var first = await db.Devices.SingleAsync(d => d.ZoneId == fixture.ZoneId);
            var second = new Device { FarmId = first.FarmId, GatewayId = first.GatewayId, DeploymentRequestId = first.DeploymentRequestId, ZoneId = fixture.ZoneId, HardwareAddress = $"AI-{Guid.NewGuid():N}", DeviceType = DeviceType.SensorNode, Status = DeviceStatus.Online };
            db.Devices.Add(second);
            var firstReading = await db.TelemetryReadings.FirstAsync(r => r.DeviceId == first.Id);
            db.TelemetryReadings.Add(new TelemetryReading { TenantId = firstReading.TenantId, FarmId = firstReading.FarmId, ZoneId = fixture.ZoneId, DeviceId = second.Id, GatewayId = first.GatewayId, MessageId = $"ai-{Guid.NewGuid():N}", ParameterCode = EnvironmentalParameterCode.SoilMoisture, Value = 48, Unit = "%", CapturedAtUtc = DateTime.UtcNow, ReceivedAtUtc = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "thông tin cảm biến hiện tại");

        Assert.Contains("35–48", answer.Details);
        Assert.Contains("Node cảm biến 1: 48", answer.Details);
        Assert.Contains("Node chấp hành 1: 35", answer.Details);
    }

    [Fact]
    public async Task Sensor_overview_still_lists_readings_when_the_ai_comment_fails_or_is_unsure()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        factory.AiProvider.Throw = true;

        var failed = await AskAsync(factory, fixture.ZoneId, "thông tin cảm biến hiện tại");
        Assert.Equal(AiRecommendationStatus.Ready, failed.Status);
        Assert.Contains("Độ ẩm đất", failed.Details);
        Assert.DoesNotContain("Nhận xét tổng thể", failed.Details);

        factory.AiProvider.Throw = false;
        factory.AiProvider.Result = new("FakeAgronomist", "Cây rất khỏe", "x", 0.1m, [], null);
        var unsure = await AskAsync(factory, fixture.ZoneId, "thông tin cảm biến hiện tại");
        Assert.Contains("Độ ẩm đất", unsure.Details);
        Assert.DoesNotContain("Nhận xét tổng thể", unsure.Details);
    }

    [Theory]
    [InlineData("danh sách các thiết bị cảm biến của zone")]
    [InlineData("các cảm biến trong zone")]
    [InlineData("Zone này có những cảm biến nào?")]
    public async Task Device_list_question_is_answered_from_zone_devices_not_the_knowledge_base(string question)
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.DoesNotContain("Kho tri thức", answer.Summary + answer.Details);
        Assert.Contains("thiết bị cảm biến", answer.Summary);
        Assert.DoesNotContain("Chưa tìm thấy tài liệu", answer.Summary);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Follow_up_about_those_devices_lists_each_devices_own_readings()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, "thông tin của các thiết bị này hiện tại");

        Assert.DoesNotContain("Kho tri thức", answer.Summary + answer.Details);
        Assert.Contains("số đo:", answer.Details);
        Assert.Contains("Độ ẩm đất 35", answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Theory]
    [InlineData("gateway của zone này thế nào?")]
    [InlineData("trạm trung tâm đang hoạt động không")]
    public async Task Gateway_question_is_answered_from_the_gateways_serving_the_zone(string question)
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, question);

        Assert.Equal(AiRecommendationStatus.Ready, answer.Status);
        Assert.Contains("Gateway 1", answer.Details);
        Assert.DoesNotContain("Kho tri thức", answer.Summary + answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Gateway_answer_flags_an_offline_gateway_and_does_not_leak_identifiers()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var gateway = await db.Gateways.SingleAsync();
            gateway.Status = GatewayStatus.Offline;
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "gateway đang thế nào");

        Assert.Contains("Offline", answer.Details);
        Assert.Contains(answer.Limitations, l => l.Contains("không ở trạng thái Online"));
        Assert.DoesNotContain("AA:BB", answer.Details);
        Assert.DoesNotContain("ai-", answer.Details);
    }

    [Fact]
    public async Task Question_about_devices_and_gateway_answers_both_parts()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);

        var answer = await AskAsync(factory, fixture.ZoneId, "liệt kê các thiết bị và gateway của zone");

        Assert.Contains("Gateway 1", answer.Details);
        Assert.Contains("máy bơm", answer.Details);
    }

    [Fact]
    public async Task Weather_suitability_without_a_temperature_threshold_is_not_judged()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var stage = await db.GrowthStages.Include(x => x.Requirements).SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000004"));
            foreach (var r in stage.Requirements.Where(x => x.ParameterCode == EnvironmentalParameterCode.Temperature).ToList()) stage.Requirements.Remove(r);
            await db.SaveChangesAsync();
        }
        factory.AiWeatherProvider.Result = new(true, "Trời nhiều mây", 4, 16.4m, DateTime.UtcNow, null);

        var answer = await AskAsync(factory, fixture.ZoneId, "Thời tiết dự báo tiếp theo có thích hợp cho sự phát triển của cây không?");

        Assert.Equal(AiRecommendationStatus.InsufficientData, answer.Status);
        Assert.Contains("Chưa thể đánh giá", answer.Details);
        Assert.Contains("16.4", answer.Details); // vẫn nêu dữ liệu dự báo thật
        Assert.DoesNotContain("thuận lợi", answer.Details);
        Assert.DoesNotContain("ôn hòa", answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Weather_is_judged_only_against_the_current_stage_temperature_range()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var stage = await db.GrowthStages.Include(x => x.Requirements).SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000004"));
            var temperature = stage.Requirements.SingleOrDefault(x => x.ParameterCode == EnvironmentalParameterCode.Temperature);
            if (temperature is null)
                stage.Requirements.Add(new EnvironmentalRequirement { GrowthStageId = stage.Id, ParameterCode = EnvironmentalParameterCode.Temperature, MinValue = 20, MaxValue = 28, TargetValue = 24, Unit = "°C" });
            else { temperature.MinValue = 20; temperature.MaxValue = 28; temperature.TargetValue = 24; }
            await db.SaveChangesAsync();
        }
        factory.AiWeatherProvider.Result = new(true, "Trời nhiều mây", 4, 16.4m, DateTime.UtcNow, null);

        var answer = await AskAsync(factory, fixture.ZoneId, "Thời tiết dự báo tiếp theo có thích hợp cho sự phát triển của cây không?");

        Assert.Equal(AiRecommendationStatus.Ready, answer.Status);
        Assert.Contains("THẤP hơn", answer.Details);
        Assert.Contains("20", answer.Details);
        Assert.DoesNotContain("thuận lợi", answer.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Irrigation_question_with_fresh_readings_but_no_threshold_names_the_threshold_as_missing()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var stage = await db.GrowthStages.Include(x => x.Requirements).SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000004"));
            stage.Requirements.Clear();
            db.SeasonAppliedRequirements.RemoveRange(db.SeasonAppliedRequirements);
            await db.SaveChangesAsync();
        }

        var answer = await AskAsync(factory, fixture.ZoneId, "Độ ẩm đất hiện tại thế nào, có cần tưới không?");

        Assert.Equal(AiRecommendationStatus.InsufficientData, answer.Status);
        Assert.Contains("Độ ẩm đất: 35", answer.Details);
        Assert.Contains("chưa có ngưỡng độ ẩm đất", answer.Details);
        Assert.DoesNotContain("chưa có đủ số đo mới", answer.Details); // số đo đã đủ: không được nói là thiếu số đo
        Assert.False(answer.IsActionable);
    }

    [Fact]
    public async Task Provider_receives_the_whole_zone_context_season_plan_zone_profile_and_device_health()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var stored = await db.Devices.SingleAsync(d => d.ZoneId == fixture.ZoneId);
            stored.BatteryLevel = 64;
            stored.Rssi = -80;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        // Câu hỏi về điều khiển/tưới đi qua mô hình, nên toàn bộ ngữ cảnh của Zone phải được gửi kèm.
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/ask", new { question = "Có nên tưới nhỏ giọt bây giờ không?" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var context = factory.AiProvider.LastRequest!.Context;
        Assert.NotNull(context.Season);
        Assert.NotEmpty(context.Season!.Stages);
        Assert.Contains(context.Season.Stages, s => s.IsCurrent);
        Assert.NotNull(context.ZoneType);
        Assert.NotNull(context.ZoneStatus);
        var device = Assert.Single(context.ZoneDevices!);
        Assert.Equal(64, device.BatteryLevel);
        Assert.Equal(-80m, device.Rssi);
        Assert.NotNull(context.ActiveAlerts);
        Assert.NotNull(context.RecentCommands);
        Assert.NotNull(context.AutoRules);
        Assert.NotNull(context.OpenTasks);
    }

    [Fact]
    public async Task Knowledge_question_without_season_or_sources_says_not_found_without_calling_provider()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Khi nào nên thu hoạch thanh long?" });

        var recommendation = await Read<AiRecommendationView>(response);
        Assert.Equal(AiRecommendationStatus.InsufficientData, recommendation.Status);
        Assert.False(recommendation.IsActionable);
        Assert.Contains(recommendation.Limitations, x => x.Contains("tài liệu", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Knowledge_question_with_only_unrelated_documents_is_not_answered_by_the_model()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var doc = new AgricultureDocument { Title = "Bón phân cà chua", CropScope = "Cà chua", ContentText = "x", ReviewStatus = AgricultureDocumentReviewStatus.Approved, IsPublic = true };
            db.AgricultureDocuments.Add(doc);
            db.AgricultureKnowledgeChunks.Add(new AgricultureKnowledgeChunk { DocumentId = doc.Id, Document = doc, ChunkIndex = 0, Keywords = "bón phân", Content = "Bón phân cân đối đạm lân kali theo từng giai đoạn sinh trưởng, chia nhiều lần, kết hợp phân hữu cơ hoai mục và theo dõi màu lá để điều chỉnh liều lượng." });
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Cách phòng trừ sâu bệnh hại cho cà chua là gì?" });

        var recommendation = await Read<AiRecommendationView>(response);
        Assert.Equal(AiRecommendationStatus.InsufficientData, recommendation.Status);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Knowledge_question_on_zone_without_season_runs_rag_by_crop_named_in_question()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        Guid tomatoDoc, lettuceDoc;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            AgricultureDocument Add(string title, string cropScope)
            {
                var doc = new AgricultureDocument { Title = title, CropScope = cropScope, ContentText = "Thu hoạch quả khi chín 70-80% màu sắc đặc trưng, thu hoạch vào sáng sớm khi nhiệt độ thấp, dụng cụ thu hoạch và thùng chứa phải sạch, ghi chép ngày thu hoạch và lô sản phẩm để truy xuất.", ReviewStatus = AgricultureDocumentReviewStatus.Approved, IsPublic = true };
                db.AgricultureDocuments.Add(doc);
                db.AgricultureKnowledgeChunks.Add(new AgricultureKnowledgeChunk { DocumentId = doc.Id, Document = doc, ChunkIndex = 0, Content = doc.ContentText, Keywords = "thu hoạch" });
                return doc;
            }
            tomatoDoc = Add("Thu hoạch cà chua", "Cà chua").Id;
            lettuceDoc = Add("Thu hoạch xà lách", "Xà lách").Id;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Khi nào nên thu hoạch cà chua?" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(1, factory.AiProvider.Calls);
        var passages = factory.AiProvider.LastRequest!.KnowledgePassages!;
        Assert.Contains(passages, p => p.DocumentId == tomatoDoc);
        Assert.DoesNotContain(passages, p => p.DocumentId == lettuceDoc);
        Assert.False((await Read<AiRecommendationView>(response)).IsActionable);
    }

    [Fact]
    public async Task Stale_telemetry_is_not_sent_to_provider_or_used_for_advice()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var reading = await db.TelemetryReadings.SingleAsync(x => x.ZoneId == fixture.ZoneId);
            reading.CapturedAtUtc = DateTime.UtcNow.AddMinutes(-20);
            reading.ReceivedAtUtc = DateTime.UtcNow.AddMinutes(-20);
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/ask", new { question = "Độ ẩm đất hiện tại thế nào?" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var recommendation = await Read<AiRecommendationView>(response);
        Assert.Equal(AiRecommendationStatus.InsufficientData, recommendation.Status);
        Assert.False(recommendation.IsActionable);
        Assert.Contains(recommendation.Limitations, x => x.Contains("Chưa có số đo mới", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("Số đo cũ", recommendation.Details);
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Farmer_is_forbidden_and_cross_tenant_zone_is_hidden()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();

        await Login(client, "farmer@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/ai/context")).StatusCode);

        await Login(client, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/ai/context")).StatusCode);
    }

    [Fact]
    public async Task Rejection_is_audited_and_never_creates_control_command()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new
        {
            recommendationId = recommendation.RecommendationId,
            decision = "Rejected",
            reason = "Owner prefers manual inspection"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await Read<AiDecisionResult>(response);
        Assert.Equal(AiRecommendationStatus.Rejected, result.Recommendation.Status);
        Assert.Null(result.Command);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Empty(await db.ActuatorCommands.Where(x => x.RecommendationId == recommendation.RecommendationId).ToListAsync());
        Assert.Equal(AiRecommendationDecisionType.Rejected, (await db.AiRecommendationDecisions.SingleAsync()).DecisionType);
    }

    [Fact]
    public async Task Owner_acceptance_hands_valid_recommendation_to_control_with_ai_audit_source()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);
        Assert.True(recommendation.IsActionable);
        Assert.NotNull(factory.AiProvider.LastRequest);
        Assert.All(factory.AiProvider.LastRequest!.Context.Telemetry, x => Assert.True(x.IsFresh));

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new
        {
            recommendationId = recommendation.RecommendationId,
            decision = "Accepted"
        });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var result = await Read<AiDecisionResult>(response);
        Assert.NotNull(result.Command);
        Assert.Equal(CommandTriggerSource.AI_APPROVED, result.Command!.TriggerSource);
        Assert.Equal(ActuatorCommandStatus.Sent, result.Command.Status);
        Assert.Null(result.Command.AcknowledgedAtUtc);
        Assert.Single(factory.ControlTransport.Published);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var command = await db.ActuatorCommands.SingleAsync(x => x.Id == result.Command.CommandId);
        Assert.Equal(recommendation.RecommendationId, command.RecommendationId);
        Assert.Equal(CommandTriggerSource.AI_APPROVED, command.TriggerSource);
    }

    [Fact]
    public async Task Low_confidence_recommendation_cannot_be_accepted()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        factory.AiProvider.Result = factory.AiProvider.Result with { Confidence = 0.40m };
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);
        Assert.Equal(AiRecommendationStatus.LowConfidence, recommendation.Status);
        Assert.False(recommendation.IsActionable);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new { recommendationId = recommendation.RecommendationId, decision = "Accepted" });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(factory.ControlTransport.Published);
    }

    [Fact]
    public async Task Irrigation_recommendation_cannot_be_accepted_after_soil_telemetry_goes_stale()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var reading = await db.TelemetryReadings.SingleAsync(x => x.ZoneId == fixture.ZoneId);
            reading.CapturedAtUtc = DateTime.UtcNow.AddMinutes(-20);
            await db.SaveChangesAsync();
        }

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new
        {
            recommendationId = recommendation.RecommendationId,
            decision = "Accepted"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(factory.ControlTransport.Published);
    }

    [Fact]
    public async Task More_analysis_decision_supersedes_original_and_links_follow_up()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new
        {
            recommendationId = recommendation.RecommendationId,
            decision = "MoreAnalysisRequested",
            followUpQuestion = "Phân tích thêm rủi ro tưới trong 15 phút tới"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await Read<AiDecisionResult>(response);
        Assert.Equal(AiRecommendationStatus.Superseded, result.Recommendation.Status);
        Assert.NotNull(result.FollowUpRecommendation);
        Assert.Equal(recommendation.RecommendationId, (await GetConsultation(factory, result.FollowUpRecommendation!.ConsultationRequestId)).ParentRecommendationId);
        Assert.Empty(factory.ControlTransport.Published);
    }

    [Fact]
    public async Task Consultation_rate_limit_returns_429_and_retry_after()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        for (var i = 0; i < 10; i++)
        {
            var accepted = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = $"Phân tích lần thứ {i + 1} cho khu vực này" });
            Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        }

        var limited = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Phân tích thêm một lần nữa" });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.True(limited.Headers.TryGetValues("Retry-After", out _));
    }

    private static async Task<AiRecommendationView> Ask(HttpClient client, Guid zoneId)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/ai/ask", new { question = "Độ ẩm đất thấp, có nên tưới ngay không?" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Read<AiRecommendationView>(response);
    }

    private static async Task<AiFixture> PrepareActionableContextAsync(TestApplicationFactory factory)
    {
        var seed = await factory.SeedAsync();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.Include(x => x.Tenant).SingleAsync(x => x.Id == seed.FarmAId);
        var crop = await db.Crops.SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000001"));
        var variety = await db.CropVarieties.SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000002"));
        var profile = await db.GrowthProfiles.SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000003"));
        var stage = await db.GrowthStages.Include(x => x.Requirements).SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000004"));
        var season = new PlantingSeason
        {
            ZoneId = seed.ZoneAId, Crop = crop, Variety = variety, GrowthProfile = profile, CurrentGrowthStage = stage,
            Name = "AI season", StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)), ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60))
        };
        foreach (var requirement in stage.Requirements)
            season.AppliedRequirements.Add(new SeasonAppliedRequirement { ParameterCode = requirement.ParameterCode, MinValue = requirement.MinValue, MaxValue = requirement.MaxValue, TargetValue = requirement.TargetValue, Unit = requirement.Unit });

        (await db.Zones.SingleAsync(z => z.Id == seed.ZoneAId)).CropId = crop.Id;
        (await db.Zones.SingleAsync(z => z.Id == seed.ZoneAId)).CropVarietyId = variety.Id;
        var deployment = new DeploymentRequest { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeason = season, OwnerUserId = seed.OwnerAId, TechnicianUserId = seed.TechnicianId, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture" };
        var gateway = new Gateway { FarmId = farm.Id, DeploymentRequest = deployment, MacAddress = "AA:BB:CC:DD:EE:99", GatewaySerial = $"AI-{Guid.NewGuid():N}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"ai-{Guid.NewGuid():N}", ClientCertificateFingerprint = new string('C', 64), Status = GatewayStatus.Online, LastSeenAtUtc = DateTime.UtcNow };
        var device = new Device { FarmId = farm.Id, Gateway = gateway, DeploymentRequest = deployment, ZoneId = seed.ZoneAId, HardwareAddress = $"AI-{Guid.NewGuid():N}", DeviceType = DeviceType.ActuatorNode, Status = DeviceStatus.Online };
        var pump = new DeviceActuator { Device = device, ActuatorType = "WaterPump", RelayChannel = 1, MaxDurationMinutes = 30 };
        db.AddRange(season, deployment, gateway, device, pump);
        await db.SaveChangesAsync();
        db.DeviceConnectionTests.Add(new DeviceConnectionTest { DeviceId = device.Id, DeploymentRequestId = deployment.Id, TechnicianUserId = seed.TechnicianId, Succeeded = true, ObservedAtUtc = DateTime.UtcNow });
        db.TelemetryReadings.Add(new TelemetryReading { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, DeviceId = device.Id, GatewayId = gateway.Id, MessageId = $"ai-{Guid.NewGuid():N}", ParameterCode = EnvironmentalParameterCode.SoilMoisture, Value = 35, Unit = "%", CapturedAtUtc = DateTime.UtcNow, ReceivedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        factory.AiProvider.Result = new AiProviderResult("FakeAgronomist", "Soil is dry", "Irrigation may restore the current stage target.", 0.92m, ["Based on the latest available sample."], new AiProposedControlAction(pump.Id, ActuatorCommandAction.TurnOn, 300));
        return new AiFixture(seed.ZoneAId, pump.Id);
    }

    private static async Task<T> Read<T>(HttpResponseMessage response) => (await response.Content.ReadFromJsonAsync<T>(Json))!;
    private static async Task<AiConsultationRequest> GetConsultation(TestApplicationFactory factory, Guid id)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().AiConsultationRequests.AsNoTracking().SingleAsync(x => x.Id == id);
    }
    private static async Task Login(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }

    private sealed record AiFixture(Guid ZoneId, Guid PumpId);
}
