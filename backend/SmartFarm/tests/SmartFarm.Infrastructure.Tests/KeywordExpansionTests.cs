using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public class KeywordExpansionTests
{
    [Fact]
    public void Expansion_terms_find_a_passage_that_uses_different_words_than_the_question()
    {
        var content = "Cây thiếu đạm biểu hiện lá già vàng dần; cần bón phân bổ sung đạm theo giai đoạn.";
        var score = AgricultureKnowledgeRetriever.ComputeExpansionScore(["thiếu đạm", "vàng lá", "bón phân"], content, null);

        Assert.True(score >= AgricultureKnowledgeRetriever.MinKeywordScore);
    }

    [Fact]
    public void Expansion_matching_ignores_diacritics_and_whole_phrases_only()
    {
        Assert.True(AgricultureKnowledgeRetriever.ComputeExpansionScore(["thieu dam"], "Cây Thiếu Đạm kéo dài", null) > 0f);
        Assert.Equal(0f, AgricultureKnowledgeRetriever.ComputeExpansionScore(["đạm"], "Phân đạmnitrat", null));
    }

    [Fact]
    public void Expansion_score_is_zero_without_terms_or_without_a_match()
    {
        Assert.Equal(0f, AgricultureKnowledgeRetriever.ComputeExpansionScore(null, "bất kỳ", null));
        Assert.Equal(0f, AgricultureKnowledgeRetriever.ComputeExpansionScore([], "bất kỳ", null));
        Assert.Equal(0f, AgricultureKnowledgeRetriever.ComputeExpansionScore(["sâu đục quả"], "Tưới nhỏ giọt buổi sáng", null));
    }
}

public class HypotheticalFallbackTests
{
    [Theory]
    [InlineData("nếu nhiệt độ giảm còn 0 độ thì sao")]
    [InlineData("độ ẩm không khí 95% có sao không")]
    [InlineData("nhiet do 42 do anh huong gi den cay")]
    [InlineData("lá bị cháy phải làm sao")]
    public void Consequence_questions_become_knowledge_questions_when_the_classifier_gave_nothing(string question)
    {
        var intent = SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithHypotheticalFallback(question, SmartFarm.Application.Features.Ai.QuestionIntent.Unknown);

        Assert.Contains(SmartFarm.Application.Features.Ai.QuestionTopics.AgronomyKnowledge, intent.Topics);
    }

    [Theory]
    [InlineData("nhiệt độ hiện tại bao nhiêu")]
    [InlineData("có nên tưới bây giờ không")]
    [InlineData("chào bạn")]
    public void Ordinary_questions_are_left_unclassified(string question)
    {
        var intent = SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithHypotheticalFallback(question, SmartFarm.Application.Features.Ai.QuestionIntent.Unknown);

        Assert.Empty(intent.Topics);
    }
}

public class PhraseRankingTests
{
    private static string[] Words(string q) => q.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);

    [Fact]
    public void A_passage_with_the_exact_phrase_outranks_one_that_only_contains_the_words_apart()
    {
        const string question = "Quản lý đất";
        var onTopic = "2. Quản lý đất\n Đất trong khu vực sản xuất có tiềm ẩn nguy cơ bị ô nhiễm không?";
        var scattered = "Quản lý sản xuất theo nhóm, ghi nhật ký. Kiểm tra mẫu đất và nước hằng năm.";

        var a = AgricultureKnowledgeRetriever.ComputeKeywordScore(question, Words(question), onTopic, string.Empty);
        var b = AgricultureKnowledgeRetriever.ComputeKeywordScore(question, Words(question), scattered, string.Empty);

        Assert.True(a > b, $"on-topic {a} should beat scattered {b}");
        Assert.True(b >= AgricultureKnowledgeRetriever.MinKeywordScore);
    }

    [Fact]
    public void Single_word_questions_get_no_proximity_bonus()
    {
        Assert.Equal(0f, AgricultureKnowledgeRetriever.PhraseProximityBonus(["đất"], "đất trồng"));
    }
}

public class ChunkNoiseTests
{
    [Fact]
    public void A_footer_repeated_on_three_pages_is_removed_but_content_is_kept()
    {
        var text = string.Join("\n", new[]
        {
            "[TRANG 1]", "Đất trồng cần tơi xốp và giàu mùn.", "Höôùng DAÃN GAP CÔ BAÛN Höôùng DAÃN GAP CÔ BAÛN",
            "[TRANG 2]", "Nước tưới phải đạt tiêu chuẩn an toàn.", "Höôùng DAÃN GAP CÔ BAÛN Höôùng DAÃN GAP CÔ BAÛN",
            "[TRANG 3]", "Thu hoạch đảm bảo thời gian cách ly.", "Höôùng DAÃN GAP CÔ BAÛN Höôùng DAÃN GAP CÔ BAÛN",
        });

        var result = StructuredChunker.RemoveRepeatedPageLines(text.Split('\n'));

        Assert.DoesNotContain(result, l => l.Contains("Höôùng"));
        Assert.Contains("Đất trồng cần tơi xốp và giàu mùn.", result);
        Assert.Contains("Thu hoạch đảm bảo thời gian cách ly.", result);
    }

    [Fact]
    public void A_line_repeated_on_only_two_pages_is_kept()
    {
        var text = new[] { "[TRANG 1]", "Ghi chú quan trọng của mục", "[TRANG 2]", "Ghi chú quan trọng của mục" };

        Assert.Equal(text.Length, StructuredChunker.RemoveRepeatedPageLines(text).Length);
    }

    [Fact]
    public void Blank_forms_are_recognised_but_real_guidance_is_not()
    {
        var form = "Hợp tác xã: ..........................\nXã:.................... Huyện:................... Tỉnh: ..................\nHọ tên chủ nhiệm: .....................................\nĐịa điểm sản xuất: .............................\nNăm/vụ sản xuất: ...............................";
        var scattered = string.Join("\n", Enumerable.Repeat("Số\nTT\nHộ\nĐạt", 5));
        var guidance = "Đất trồng cần tơi xốp, giàu mùn, pH từ 6,0 đến 6,8. Tưới nhỏ giọt mỗi sáng và bón phân hữu cơ hoai mục trước khi trồng. Thu hoạch đảm bảo thời gian cách ly.";

        Assert.True(StructuredChunker.LooksLikeBlankForm(form));
        Assert.True(StructuredChunker.LooksLikeBlankForm(scattered));
        Assert.False(StructuredChunker.LooksLikeBlankForm(guidance));
    }
}

public class TitleSuggestionTests
{
    [Fact]
    public void Title_words_must_really_be_in_the_file()
    {
        var folded = SmartFarm.Infrastructure.Ai.Knowledge.VietnameseText.Fold("Huong dan GAP Co ban danh cho nong dan; GAP Co ban duoc xay dung");

        Assert.True(VietGapDocumentVerifier.TitleWordsInFile("Hướng dẫn GAP Cơ bản", folded));
        Assert.False(VietGapDocumentVerifier.TitleWordsInFile("Quy trình trồng cà chua nhà màng cao cấp", folded));
    }
}

public class TocAndTitleTests
{
    [Theory]
    [InlineData("2. Quản lý đất ..................................................................................13")]
    [InlineData("IV. RÀ SOÁT GAP CƠ BẢN ..................................13")]
    public void Table_of_contents_lines_are_recognised(string line) => Assert.True(StructuredChunker.IsTableOfContentsLine(line));

    [Theory]
    [InlineData("Đất trồng cần tơi xốp, giàu mùn, pH từ 6,0 đến 6,8.")]
    [InlineData("Hợp tác xã: .......................")]
    [InlineData("2. Quản lý đất")]
    public void Ordinary_lines_are_not_table_of_contents(string line) => Assert.False(StructuredChunker.IsTableOfContentsLine(line));

    [Fact]
    public void Chunks_drop_toc_lines_but_keep_the_real_sentences_next_to_them()
    {
        var text = "[TRANG 1]\n5. Ghi chép các hoạt động đào tạo cán bộ kỹ thuật và nông dân trong mỗi vụ sản xuất.\nIV. RÀ SOÁT GAP CƠ BẢN ..................................13\n2. Quản lý đất ..................................................13\n" +
                   string.Concat(Enumerable.Repeat("Đất trồng cần được phân tích mẫu để xác định nguy cơ ô nhiễm trước khi sản xuất. ", 6));

        var joined = string.Join("\n", StructuredChunker.Chunk(text).Select(c => c.Content));

        Assert.DoesNotContain("..........", joined);
        Assert.Contains("Ghi chép các hoạt động đào tạo", joined);
    }

    [Fact]
    public void A_wrapped_foreword_sentence_is_not_taken_as_the_title()
    {
        var text = "[TRANG 1]\nLỜI NÓI ĐẦU\nĐể thúc đẩy thực hành nông nghiệp tốt (GAP) trong sản xuất cây trồng, một quy trình\nGAP đơn giản được xây dựng.\nbộ kỹ thuật và đặc biệt là của nông dân vùng Dự án đã được nâng cao.\n" +
                   string.Concat(Enumerable.Repeat("Đất trồng cần tơi xốp, nước tưới phải sạch, thu hoạch đảm bảo thời gian cách ly. ", 4));

        var d = VietGapMetadataExtractor.Detect(text, "JICA_Basic_GAP_Manual.pdf");

        Assert.DoesNotContain("thúc đẩy", d.Title.Value ?? string.Empty);
        Assert.DoesNotContain("bộ kỹ thuật", d.Title.Value ?? string.Empty);
    }
}

public class TableFragmentTests
{
    [Fact]
    public void A_run_of_one_word_lines_from_a_split_table_is_removed()
    {
        var lines = new[]
        {
            "Cán bộ kỹ thuật chuyên trách:", "Đào", "Tuyên", "Số", "nông", "dân", "tham", "gia (kèm", "danh", "sách)", "Nội dung",
            "Vùng sản xuất có phù hợp với quy hoạch của Nhà nước và địa phương không?"
        };

        var result = StructuredChunker.RemoveTableFragmentRuns(lines);

        Assert.Contains("Cán bộ kỹ thuật chuyên trách:", result);
        Assert.Contains("Vùng sản xuất có phù hợp với quy hoạch của Nhà nước và địa phương không?", result);
        Assert.DoesNotContain("Tuyên", result);
        Assert.DoesNotContain("danh", result);
    }

    [Fact]
    public void A_few_short_lines_and_page_markers_are_kept()
    {
        var lines = new[] { "[TRANG 3]", "Có", "Không", "Đạt", "Nội dung kiểm tra đầy đủ các điểm kiểm soát.", "[TRANG 4]", "A", "B" };

        Assert.Equal(lines, StructuredChunker.RemoveTableFragmentRuns(lines));
    }
}

public class PeriodFallbackTests
{
    private static SmartFarm.Application.Features.Ai.QuestionIntent Sensor(bool history = true) =>
        new([SmartFarm.Application.Features.Ai.QuestionTopics.SensorReadings], [], WantsHistory: history, HistoryCount: history ? 5 : 0);

    [Theory]
    [InlineData("nhiệt độ trung bình 3 ngày qua", 3)]
    [InlineData("độ ẩm đất tuần qua thay đổi thế nào", 7)]
    [InlineData("so sánh số đo hôm nay với hôm qua", 2)]
    [InlineData("nhiệt độ cao nhất hôm nay", 1)]
    public void Day_period_questions_become_daily_summaries(string question, int days)
    {
        var intent = SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithPeriodFallbacks(question, Sensor());

        Assert.Equal(days, intent.HistoryDays);
        Assert.Equal(0, intent.HistoryCount);
    }

    [Theory]
    [InlineData("5 bản ghi gần nhất của node cảm biến 1")]
    [InlineData("nhiệt độ hiện tại bao nhiêu")]
    public void Record_and_current_questions_are_left_alone(string question)
    {
        var intent = SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithPeriodFallbacks(question, Sensor());

        Assert.Equal(0, intent.HistoryDays);
        Assert.Equal(5, intent.HistoryCount);
    }

    [Theory]
    [InlineData("lần tưới gần nhất là khi nào")]
    [InlineData("lần bật bơm cuối cùng")]
    [InlineData("lệnh gần nhất đã chạy chưa")]
    public void Last_command_questions_gain_the_commands_topic(string question)
    {
        var start = new SmartFarm.Application.Features.Ai.QuestionIntent([SmartFarm.Application.Features.Ai.QuestionTopics.Schedules], []);

        var intent = SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithPeriodFallbacks(question, start);

        Assert.Contains(SmartFarm.Application.Features.Ai.QuestionTopics.Commands, intent.Topics);
    }
}

public class EmbeddingEconomyTests
{
    [Theory]
    [InlineData("You exceeded your quota. Please retry in 12.5s.", 12.5)]
    [InlineData("{\"retryDelay\": \"34s\"}", 34)]
    public void The_wait_requested_by_google_is_read_from_a_429(string body, double seconds)
    {
        var wait = GeminiEmbeddingProvider.ParseRetryDelay(body);

        Assert.NotNull(wait);
        Assert.Equal(seconds, wait!.Value.TotalSeconds, 3);
    }

    [Fact]
    public void A_429_without_a_wait_hint_gives_no_delay() => Assert.Null(GeminiEmbeddingProvider.ParseRetryDelay("Quota exceeded for metric"));

    [Theory]
    [InlineData("Thư mục tài liệu tham khảo", "[1] VietGAP, Quy trình thực hành...", true)]
    [InlineData(null, "Tài liệu tham khảo\n[1] QCVN 12-1:2011/BYT ...", true)]
    [InlineData("3.2.2.3 Phân bón và chất bổ sung", "Phải sử dụng phân bón được phép kinh doanh tại Việt Nam.", false)]
    public void Reference_lists_are_not_worth_an_embedding_call(string? section, string content, bool expected)
    {
        var chunk = new SmartFarm.Domain.Entities.AgricultureKnowledgeChunk { SectionTitle = section, Content = content };

        Assert.Equal(expected, AgricultureDocumentService.IsLowValueForEmbedding(chunk));
    }
}

public class ControlNodeModelNameTests
{
    private static SmartFarm.Application.Features.Ai.AiZoneDeviceSummary Node(int sensors, params string[] actuators) =>
        new("Node chấp hành 1", "ActuatorNode", "Online", sensors, [], [], actuators);

    [Fact]
    public void Four_valve_node_is_named_like_the_device_screen() =>
        Assert.Equal("Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng",
            SmartFarm.Infrastructure.Ai.AiAdvisoryService.ControlNodeModelName(Node(0, "IrrigationValve", "IrrigationValve", "IrrigationValve", "IrrigationValve")));

    [Fact]
    public void Pump_node_is_named_as_a_pump_controller() =>
        Assert.Equal("Node Điều khiển Máy bơm tưới", SmartFarm.Infrastructure.Ai.AiAdvisoryService.ControlNodeModelName(Node(0, "IrrigationPump")));

    [Fact]
    public void Nodes_with_sensors_or_unknown_channels_get_no_model_name()
    {
        Assert.Null(SmartFarm.Infrastructure.Ai.AiAdvisoryService.ControlNodeModelName(Node(3, "Pump")));
        Assert.Null(SmartFarm.Infrastructure.Ai.AiAdvisoryService.ControlNodeModelName(Node(0, "Fan")));
        Assert.Null(SmartFarm.Infrastructure.Ai.AiAdvisoryService.ControlNodeModelName(Node(0)));
    }
}

public class SmallTalkFallbackTests
{
    [Theory]
    [InlineData("cảm ơn")]
    [InlineData("Cảm ơn bạn nhé!")]
    [InlineData("xin chào")]
    [InlineData("hello")]
    [InlineData("thanks")]
    public void Plain_greetings_are_small_talk_when_the_classifier_is_down(string question) =>
        Assert.True(SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithSmallTalkFallback(question, SmartFarm.Application.Features.Ai.QuestionIntent.Unknown)
            .Has(SmartFarm.Application.Features.Ai.QuestionTopics.SmallTalk));

    [Theory]
    [InlineData("cảm ơn, nhiệt độ bao nhiêu")]
    [InlineData("chào, tưới bao lâu thì đủ")]
    [InlineData("ok tắt bơm")]
    public void Greeting_followed_by_a_real_question_is_not_small_talk(string question) =>
        Assert.False(SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithSmallTalkFallback(question, SmartFarm.Application.Features.Ai.QuestionIntent.Unknown)
            .Has(SmartFarm.Application.Features.Ai.QuestionTopics.SmallTalk));
}

public class VietnameseLabelTests
{
    [Theory]
    [InlineData("Greenhouse", "nhà kính/nhà màng")]
    [InlineData("OpenField", "ngoài trời")]
    [InlineData("Mô hình lạ", "Mô hình lạ")]
    public void Zone_type_is_shown_in_vietnamese(string type, string expected) =>
        Assert.Equal(expected, SmartFarm.Infrastructure.Ai.AiAdvisoryService.ZoneTypeLabel(type));

    [Theory]
    [InlineData("Inactive", "chưa hoạt động")]
    [InlineData("Operating", "đang vận hành")]
    [InlineData("Online", "trực tuyến")]
    [InlineData("Offline", "ngoại tuyến")]
    [InlineData("Overdue", "quá hạn")]
    [InlineData("TrangThaiLa", "TrangThaiLa")]
    public void Statuses_are_shown_in_vietnamese(string status, string expected) =>
        Assert.Equal(expected, SmartFarm.Infrastructure.Ai.AiAdvisoryService.StatusLabel(status));
}

public class PlantCountQuestionTests
{
    private static bool Detected(string question, params string[] topics) =>
        SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithPeriodFallbacks(question, new SmartFarm.Application.Features.Ai.QuestionIntent(topics, []))
            .Has(SmartFarm.Application.Features.Ai.QuestionTopics.PlantCount);

    [Theory]
    [InlineData("zone này trồng bao nhiêu cây")]
    [InlineData("số cây đang trồng là bao nhiêu")]
    [InlineData("tổng số cây của vụ này")]
    public void Actual_plant_count_questions_are_detected(string question) => Assert.True(Detected(question, "season"));

    [Theory]
    [InlineData("số cây có thể trồng cho zone này")]
    [InlineData("trồng được bao nhiêu cây")]
    [InlineData("mật độ trồng bao nhiêu cây trên m2")]
    public void Capacity_questions_are_left_to_the_knowledge_path(string question) => Assert.False(Detected(question, "season"));

    [Fact]
    public void Knowledge_questions_are_not_turned_into_plant_count() => Assert.False(Detected("cây cà chua cần bao nhiêu nước", "agronomy_knowledge"));
}

public class VarietyQuestionTests
{
    private static bool KeepsKnowledge(string question) =>
        SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithPeriodFallbacks(question,
            new SmartFarm.Application.Features.Ai.QuestionIntent(
                [SmartFarm.Application.Features.Ai.QuestionTopics.Season, SmartFarm.Application.Features.Ai.QuestionTopics.AgronomyKnowledge], []))
            .Has(SmartFarm.Application.Features.Ai.QuestionTopics.AgronomyKnowledge);

    [Theory]
    [InlineData("cà chua thuộc loại cà chua nào")]
    [InlineData("zone đang trồng giống gì")]
    [InlineData("đang trồng cây gì")]
    public void Which_variety_questions_are_zone_data_not_knowledge(string question) => Assert.False(KeepsKnowledge(question));

    [Theory]
    [InlineData("cà chua bị vàng lá phải làm sao")]
    [InlineData("giống cà chua nào cho năng suất cao nhất")]
    public void Real_knowledge_questions_keep_the_knowledge_topic(string question) => Assert.True(KeepsKnowledge(question));
}

public class ScheduleHorizonTests
{
    private static int Ahead(string question) =>
        SmartFarm.Infrastructure.Ai.AiAdvisoryService.WithPeriodFallbacks(question,
            new SmartFarm.Application.Features.Ai.QuestionIntent([SmartFarm.Application.Features.Ai.QuestionTopics.Schedules], [])).AheadDays;

    [Theory]
    [InlineData("lịch tưới trong 2 ngày tới", 2)]
    [InlineData("lịch tưới 3 ngày nữa", 3)]
    [InlineData("lịch tưới ngày mai", 2)]
    [InlineData("lịch tưới tuần tới", 7)]
    [InlineData("lịch tưới sắp tới", 0)]
    public void Question_horizon_is_read_from_the_text(string question, int expected) => Assert.Equal(expected, Ahead(question));
}

public class CropIrrigationPlanReaderTests
{
    private static IReadOnlyList<SmartFarm.Infrastructure.Platform.CropIrrigationPlanReader.Session> Read(string? json) =>
        SmartFarm.Infrastructure.Platform.CropIrrigationPlanReader.ReadDailySessions(json, "Cà chua");

    [Fact]
    public void Enabled_sessions_of_the_crop_plan_become_schedules()
    {
        var sessions = Read("""
            {"repeatType":"DAILY","sessions":[
              {"session":"MORNING","title":"Tưới sáng","startTime":"06:15","durationMinutes":12,"enabled":true},
              {"session":"NOON","title":"Tưới trưa","startTime":"12:00","durationMinutes":5,"enabled":false},
              {"session":"AFTERNOON","title":"","startTime":"16:30","durationMinutes":8.5,"enabled":true}]}
            """);

        Assert.Equal(2, sessions.Count);
        Assert.Equal(("Tưới sáng", 6, 15, 720), (sessions[0].Title, sessions[0].Hour, sessions[0].Minute, sessions[0].DurationSeconds));
        Assert.Equal(("Chiều", 16, 30, 510), (sessions[1].Title, sessions[1].Hour, sessions[1].Minute, sessions[1].DurationSeconds));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("khong phai json")]
    [InlineData("""{"repeatType":"DAILY","sessions":[]}""")]
    [InlineData("""{"repeatType":"DAILY","sessions":[{"startTime":"07:00","durationMinutes":5,"enabled":false}]}""")]
    [InlineData("""{"repeatType":"INTERVAL_DAYS","intervalDays":2,"sessions":[{"startTime":"07:00","durationMinutes":5,"enabled":true}]}""")]
    [InlineData("""{"repeatType":"DAILY","sessions":[{"startTime":"25:00","durationMinutes":5,"enabled":true}]}""")]
    [InlineData("""{"repeatType":"DAILY","sessions":[{"startTime":"07:00","durationMinutes":45,"enabled":true}]}""")]
    public void Missing_or_unsupported_plans_are_rejected_instead_of_inventing_times(string? json) =>
        Assert.Throws<SmartFarm.Application.Common.Exceptions.ResourceConflictException>(() => Read(json));
}
