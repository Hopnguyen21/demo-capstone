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
