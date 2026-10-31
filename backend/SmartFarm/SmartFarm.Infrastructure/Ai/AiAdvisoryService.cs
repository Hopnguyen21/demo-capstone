using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai;

public sealed class AiAdvisoryService(
    SmartFarmDbContext db,
    IAiAdvisoryProvider provider,
    IAiWeatherProvider weatherProvider,
    IControlService controlService,
    IAgricultureKnowledgeRetriever knowledgeRetriever,
    IQuestionIntentClassifier intentClassifier,
    IOptions<AiOptions> options,
    Microsoft.Extensions.Logging.ILogger<AiAdvisoryService> logger,
    TimeProvider clock) : IAiAdvisoryService
{
    private readonly AiOptions settings = options.Value;

    public async Task<AiZoneContext> GetContextAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        var (zone, _) = await EnsureZoneAccessAsync(ownerId, tenantId, zoneId, requireControl: false, cancellationToken);
        return await BuildContextAsync(zone, includeHistory: false, cancellationToken);
    }

    public Task<AiRecommendationView> AskAsync(Guid ownerId, Guid tenantId, Guid zoneId, AskAiCommand command, CancellationToken cancellationToken) =>
        AskInternalAsync(ownerId, tenantId, zoneId, command, true, cancellationToken);

    public async Task<AiDecisionResult> DecideAsync(Guid ownerId, Guid tenantId, Guid zoneId, DecideRecommendationCommand command, CancellationToken cancellationToken)
    {
        var (_, role) = await EnsureZoneAccessAsync(ownerId, tenantId, zoneId, requireControl: true, cancellationToken);
        var recommendation = await db.AiRecommendations
            .Include(x => x.ConsultationRequest)
            .Include(x => x.Decisions)
            .SingleOrDefaultAsync(x => x.Id == command.RecommendationId && x.ZoneId == zoneId && x.TenantId == tenantId, cancellationToken)
            ?? throw new ResourceNotFoundException("AI recommendation was not found in this Zone.");

        if (role == UserRole.Farmer && recommendation.ConsultationRequest.RequestedByUserId != ownerId)
            throw new AuthorizationException("Farmer chỉ được quyết định khuyến nghị do chính mình yêu cầu.");

        if (recommendation.Decisions.Count > 0)
            throw new ResourceConflictException("This recommendation already has an Owner decision.");

        var reason = Optional(command.Reason, 1000);
        var decision = new AiRecommendationDecision
        {
            RecommendationId = recommendation.Id,
            OwnerUserId = ownerId,
            DecisionType = command.Decision,
            Reason = reason
        };

        ActuatorCommandView? actuatorCommand = null;
        AiRecommendationView? followUp = null;
        switch (command.Decision)
        {
            case AiRecommendationDecisionType.Accepted:
                ValidateAcceptable(recommendation);
                await EnsureActionTelemetryIsFreshAsync(recommendation, cancellationToken);
                await EnsureStageIsCurrentAsync(recommendation, cancellationToken);
                await EnsureAgronomicSafetyAsync(recommendation, cancellationToken);
                await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
                {
                    actuatorCommand = await controlService.CreateAiApprovedCommandAsync(
                        ownerId, tenantId, zoneId, recommendation.Id,
                        recommendation.ProposedActuatorId!.Value,
                        recommendation.ProposedAction!.Value,
                        recommendation.ProposedDurationSeconds!.Value,
                        cancellationToken);
                    recommendation.Status = AiRecommendationStatus.Accepted;
                    decision.ActuatorCommandId = actuatorCommand.CommandId;
                    db.AiRecommendationDecisions.Add(decision);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }
                actuatorCommand = await controlService.DispatchPendingCommandAsync(actuatorCommand.CommandId, cancellationToken);
                break;
            case AiRecommendationDecisionType.Rejected:
                if (string.IsNullOrWhiteSpace(reason))
                    throw new RequestValidationException("reason", "A rejection reason is required.");
                recommendation.Status = AiRecommendationStatus.Rejected;
                db.AiRecommendationDecisions.Add(decision);
                await db.SaveChangesAsync(cancellationToken);
                break;
            case AiRecommendationDecisionType.Ignored:
                recommendation.Status = AiRecommendationStatus.Ignored;
                db.AiRecommendationDecisions.Add(decision);
                await db.SaveChangesAsync(cancellationToken);
                break;
            case AiRecommendationDecisionType.MoreAnalysisRequested:
                var followUpQuestion = Required(command.FollowUpQuestion, "followUpQuestion", 2000, 3);
                await EnsureRateLimitAsync(ownerId, zoneId, cancellationToken);
                recommendation.Status = AiRecommendationStatus.Superseded;
                db.AiRecommendationDecisions.Add(decision);
                await db.SaveChangesAsync(cancellationToken);
                followUp = await AskInternalAsync(ownerId, tenantId, zoneId, new AskAiCommand(followUpQuestion, recommendation.Id), false, cancellationToken);
                decision.FollowUpConsultationId = followUp.ConsultationRequestId;
                await db.SaveChangesAsync(cancellationToken);
                break;
            default:
                throw new RequestValidationException("decision", "Unsupported recommendation decision.");
        }

        return new AiDecisionResult(ToView(recommendation), ToView(decision), actuatorCommand, followUp);
    }

    public async Task<AiHistoryView> GetHistoryAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        var (zone, role) = await EnsureZoneAccessAsync(ownerId, tenantId, zoneId, requireControl: false, cancellationToken);
        var from = clock.GetUtcNow().UtcDateTime.AddDays(-30);
        var query = db.AiRecommendations.AsNoTracking()
            .Include(x => x.ConsultationRequest)
            .Where(x => x.TenantId == tenantId && x.ZoneId == zoneId && x.CreatedAtUtc >= from && x.ConsultationRequest.HiddenAtUtc == null);

        // Nông dân chỉ thấy lịch sử câu hỏi do chính mình gửi, không lộ câu hỏi của chủ trại hoặc nông dân khác
        if (role == UserRole.Farmer)
        {
            query = query.Where(x => x.ConsultationRequest.RequestedByUserId == ownerId);
        }

        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return new AiHistoryView(zoneId, rows.Select(ToView).ToList());
    }

    public async Task HideHistoryAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        var (_, role) = await EnsureZoneAccessAsync(ownerId, tenantId, zoneId, requireControl: false, cancellationToken);
        var now = clock.GetUtcNow().UtcDateTime;
        var query = db.AiConsultationRequests.Where(x => x.TenantId == tenantId && x.ZoneId == zoneId && x.HiddenAtUtc == null);

        // Nông dân chỉ ẩn lịch sử của chính mình, không xóa lịch sử của người khác
        if (role == UserRole.Farmer)
        {
            query = query.Where(x => x.RequestedByUserId == ownerId);
        }

        var rows = await query.ToListAsync(cancellationToken);
        foreach (var row in rows) row.HiddenAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<AiRecommendationView> AskInternalAsync(Guid ownerId, Guid tenantId, Guid zoneId, AskAiCommand command, bool checkRateLimit, CancellationToken cancellationToken)
    {
        var question = Required(command.Question, "question", 2000, 3);
        RejectPromptInjection(question);
        var (zone, role) = await EnsureZoneAccessAsync(ownerId, tenantId, zoneId, requireControl: false, cancellationToken);
        if (checkRateLimit) await EnsureRateLimitAsync(ownerId, zoneId, cancellationToken);
        if (command.ParentRecommendationId.HasValue && !await db.AiRecommendations.AnyAsync(x => x.Id == command.ParentRecommendationId && x.ZoneId == zoneId && x.TenantId == tenantId, cancellationToken))
            throw new ResourceNotFoundException("Parent recommendation was not found in this Zone.");

        var now = clock.GetUtcNow().UtcDateTime;
        var intent = await ClassifyIntentAsync(question, cancellationToken);
        // Hỏi thu hoạch (không chỉ hỏi số ngày của vụ) cần cả tài liệu thu hoạch đã duyệt, nên không để classifier bỏ sót chủ đề kiến thức.
        if (intent.Has(QuestionTopics.Harvest) && !intent.Has(QuestionTopics.Season) && !intent.Has(QuestionTopics.AgronomyKnowledge))
            intent = intent with { Topics = [.. intent.Topics, QuestionTopics.AgronomyKnowledge] };
        var context = await BuildContextAsync(zone, includeHistory: intent.WantsHistory, cancellationToken);
        var request = new AiConsultationRequest
        {
            TenantId = tenantId,
            FarmId = zone.Field.FarmId,
            ZoneId = zoneId,
            RequestedByUserId = ownerId,
            ParentRecommendationId = command.ParentRecommendationId,
            Question = question,
            ContextSnapshotJson = JsonSerializer.Serialize(context),
            MissingDataCsv = context.MissingData.Count == 0 ? null : string.Join(',', context.MissingData),
            Status = AiConsultationStatus.Pending
        };
        db.AiConsultationRequests.Add(request);
        await db.SaveChangesAsync(cancellationToken);

        AiRecommendation recommendation;
        // Chỉ câu hỏi kiến thức (do AI phân loại) mới bắt buộc có tài liệu; câu hỏi dữ liệu Zone hay chưa phân loại được thì không bị từ chối vì thiếu tài liệu.
        var requiresAgronomyEvidence = intent.Has(QuestionTopics.AgronomyKnowledge) && !intent.Has(QuestionTopics.IrrigationOrControl);
        // Câu hỏi trạng thái cảm biến chỉ cần số đo mới; tư vấn tưới cần độ ẩm đất và nhận diện cây.
        // Hành động thiết bị vẫn bị chặn ở bước kiểm tra an toàn nếu Zone chưa có vụ đang canh tác.
        // Thời tiết và lịch tưới dùng dữ liệu riêng của Zone, không bắt buộc có vụ mùa.
        var catalog = await db.Crops.AsNoTracking().Select(c => c.Name).ToListAsync(cancellationToken);
        // Cây vận hành (ngưỡng, giai đoạn, kiểm tra an toàn) chỉ là cây của vụ InProgress trong Zone.
        var operationalCrop = context.CropName;
        // Cây để tra tài liệu kiến thức: cây được nêu trong câu hỏi (trừ câu hỏi tưới/điều khiển, luôn theo Zone), rồi cây của Zone, rồi gợi ý.
        // Việc này chỉ đổi tài liệu được tra; số đo, giai đoạn và ngưỡng vẫn là của Zone.
        var questionCrop = SmartFarm.Infrastructure.Ai.Knowledge.CropNames.MentionedIn(question, catalog);
        var useQuestionCrop = questionCrop is not null && !intent.Has(QuestionTopics.IrrigationOrControl);
        var ragCrop = (useQuestionCrop ? questionCrop : null) ?? operationalCrop ?? context.CropHint ?? questionCrop;
        var ragCropSource = useQuestionCrop ? "question" : operationalCrop is not null ? "zone" : context.CropHint is not null ? context.CropHintSource : questionCrop is not null ? "question" : null;
        var hasFreshSoilMoisture = context.Telemetry.Any(x => x.IsFresh && x.ParameterCode == EnvironmentalParameterCode.SoilMoisture);
        var missingRequestedSensorData = (intent.Has(QuestionTopics.SensorReadings) && intent.Parameters.Count > 0) && !HasFreshRequestedTelemetry(intent, context.Telemetry);
        var missingRequiredData = intent.Has(QuestionTopics.IrrigationOrControl)
            ? !hasFreshSoilMoisture || string.IsNullOrWhiteSpace(operationalCrop) || missingRequestedSensorData
            : missingRequestedSensorData;
        if (intent.Has(QuestionTopics.Weather) && !context.Weather.Available && !intent.Has(QuestionTopics.AgronomyKnowledge))
            missingRequiredData = true;

        // Avoid recommending an extra irrigation when this Zone already has an automatic
        // irrigation schedule due soon. The approval path performs the same check again.
        var irrigationScheduleSoon = intent.Has(QuestionTopics.IrrigationOrControl)
            ? context.UpcomingSchedules
                .Where(x => x.NextRunAtUtc > now && x.NextRunAtUtc <= now.AddMinutes(IrrigationScheduleConflictWindowMinutes))
                .OrderBy(x => x.NextRunAtUtc)
                .FirstOrDefault()
            : null;
        if (irrigationScheduleSoon is not null)
        {
            var minutesUntil = Math.Max(1, irrigationScheduleSoon.MinutesUntilRun);
            recommendation = CreateLimited(request, context, AiRecommendationStatus.Ready,
                "Đã có lịch tưới sắp chạy",
                $"Zone đã có lịch tưới tự động “{irrigationScheduleSoon.Name}” dự kiến chạy sau khoảng {minutesUntil} phút ({irrigationScheduleSoon.NextRunTimeFormatted}). Chưa đề xuất tưới thêm để tránh trùng lịch. Hãy kiểm tra lại độ ẩm sau khi lịch này chạy.",
                [$"Có lịch tưới tự động trong vòng {IrrigationScheduleConflictWindowMinutes} phút; hệ thống không đề xuất lệnh tưới bổ sung."], now);
            request.Status = AiConsultationStatus.Completed;
            goto Persist;
        }

        // Dữ liệu có cấu trúc của Zone (danh sách thiết bị, số đo hiện tại, dự báo so với ngưỡng giai đoạn) được trả lời trực tiếp từ
        // dữ liệu, không qua mô hình và không qua kho tri thức: mô hình từng viết "hoạt động ổn định"/"thuận lợi" không có căn cứ.
        var zoneData = TryAnswerFromZoneData(intent, context);
        if (zoneData is not null)
        {
            var providerName = "ZoneData";
            if (zoneData.WantsOverallComment && await TryOverallCommentAsync(context, cancellationToken) is { } overallComment)
            {
                zoneData = zoneData with
                {
                    Details = $"{zoneData.Details}\nNhận xét tổng thể (AI): {overallComment}",
                    Limitations = [.. zoneData.Limitations, "Nhận xét tổng thể do AI viết từ các số đo ở trên, chỉ mang tính tham khảo."]
                };
                providerName = "ZoneData+AI";
            }
            // Câu hỏi nhiều ý có phần thời tiết nhưng chưa có dữ liệu: nói rõ phần đó thay vì lặng lẽ bỏ qua.
            if (intent.Has(QuestionTopics.Weather) && !context.Weather.Available)
                zoneData = zoneData with
                {
                    Details = $"{zoneData.Details}\n\nChưa có dữ liệu thời tiết khả dụng cho khu vực này nên chưa trả lời được phần thời tiết. {context.Weather.Limitation}".Trim(),
                    Limitations = [.. zoneData.Limitations, "Dữ liệu dự báo thời tiết của Zone hiện chưa khả dụng."]
                };
            recommendation = CreateLimited(request, context, zoneData.Status, zoneData.Summary, zoneData.Details, zoneData.Limitations, now);
            recommendation.SourcesJson = "[]";
            request.ProviderName = providerName;
            // Snapshot ghi cả ý định và ngữ cảnh đã dùng để trả lời trực tiếp, để giải thích được vì sao có câu trả lời này.
            request.ContextSnapshotJson = JsonSerializer.Serialize(new { Question = question, Intent = new { intent.Topics, intent.Parameters }, Context = context, Passages = (object?)null });
            request.Status = zoneData.Status == AiRecommendationStatus.Ready ? AiConsultationStatus.Completed : AiConsultationStatus.Limited;
            goto Persist;
        }

        // Ưu tiên cây của Zone đang hỏi: cây trong vụ mùa, rồi tên Zone (vd. "Khu cà chua 12");
        // chỉ dùng tên trong câu hỏi nếu Zone chưa cho biết cây.

        if (missingRequiredData)
        {
            var hasFreshTelemetry = context.Telemetry.Any(x => x.IsFresh);
            var hasRequestedFreshTelemetry = HasAnyFreshRequestedTelemetry(intent, context.Telemetry);
            var hasAllRequestedFreshTelemetry = HasFreshRequestedTelemetry(intent, context.Telemetry);
            var weatherMissing = intent.Has(QuestionTopics.Weather) && !context.Weather.Available;
            var summary = weatherMissing
                ? "Chưa có dữ liệu thời tiết cho khu vực này"
                : hasAllRequestedFreshTelemetry
                    ? "Đã có số đo cảm biến hiện tại, nhưng chưa đủ căn cứ để quyết định tưới"
                    : hasRequestedFreshTelemetry
                        ? "Chỉ có một phần số đo cảm biến hiện tại"
                    : "Chưa đủ dữ liệu cảm biến hiện tại để tư vấn";
            var details = weatherMissing
                ? $"Chưa thể kiểm tra mức độ phù hợp của thời tiết vì dữ liệu dự báo chưa khả dụng. {context.Weather.Limitation}".Trim()
                : hasFreshTelemetry
                    ? BuildPartialRealtimeAnswer(intent, context, operationalCrop)
                    : $"Chưa có số đo cảm biến mới cho Zone này. Thiếu thông tin: {string.Join(", ", context.MissingData)}.";
            var limitations = weatherMissing
                ? new[] { "Dữ liệu dự báo thời tiết của Zone hiện chưa khả dụng." }
                : context.MissingData.Select(x => $"Thiếu hoặc chưa cập nhật: {x}")
                    .Append("Không phát lệnh tưới khi chưa xác định được ngưỡng an toàn của cây trong Zone.");
            recommendation = CreateLimited(request, context, AiRecommendationStatus.InsufficientData,
                summary,
                details,
                limitations, now);
            request.Status = AiConsultationStatus.Limited;
        }
        else
        {
            try
            {
                // Keep historical readings visible in the persisted/context API response,
                // but never give stale measurements to the model as decision context.
                var providerContext = context with
                {
                    KnowledgeCrop = ragCrop,
                    KnowledgeCropSource = ragCropSource,
                    Telemetry = context.Telemetry.Where(x => x.IsFresh).ToList()
                };

                // ── RAG: Tìm tài liệu nông học liên quan đến câu hỏi ──────────────
                var isDeviceInventoryQuestion = intent.Has(QuestionTopics.Devices) && !requiresAgronomyEvidence;
                IReadOnlyList<KnowledgePassageView>? passages = [];
                if (!isDeviceInventoryQuestion)
                {
                    try
                    {
                        passages = await knowledgeRetriever.RetrievePassagesAsync(
                            question,
                            cropName: ragCrop,
                            category: null,      // Không lọc theo danh mục để tối đa tài liệu
                            tenantId: tenantId,
                            topK: 4,
                            generalOnlyWhenCropUnknown: true,
                            cancellationToken);

                        // Đoạn khớp yếu không được đưa cho model: có đưa thì model vẫn có thể trả lời từ kiến thức chung rồi gắn như có tài liệu.
                        passages = passages.Where(p => p.SimilarityScore >= MinDisplayedSourceScore).ToList();

                        if (passages.Count > 0)
                            logger.LogInformation("[RAG] Retrieved {Count} knowledge passages for question.", passages.Count);
                        else
                            logger.LogDebug("[RAG] No relevant passages found.");
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        logger.LogWarning(ex, "[RAG] Knowledge retrieval failed; threshold-dependent irrigation advice will fail closed unless the active Growth Profile provides the threshold.");
                        passages = [];
                    }
                }

                // Câu hỏi tri thức không có tài liệu đã duyệt phù hợp: trả lời rõ là chưa tìm thấy, không để model tự bịa.
                if (requiresAgronomyEvidence && passages is { Count: 0 })
                {
                    recommendation = CreateLimited(request, context, AiRecommendationStatus.InsufficientData,
                        "Chưa tìm thấy tài liệu đã duyệt",
                        WithZoneDataParts(intent, context, string.IsNullOrWhiteSpace(ragCrop)
                            ? "Kho tri thức chưa có tài liệu áp dụng chung đã duyệt cho câu hỏi này. Hãy nêu rõ tên cây hoặc chọn vụ mùa cho khu vực."
                            : $"Kho tri thức chưa có tài liệu đã duyệt cho {ragCrop} (hoặc tài liệu áp dụng chung) trả lời được câu hỏi này."),
                        ["Không có tài liệu VietGAP/kỹ thuật đã duyệt phù hợp"], now);
                    recommendation.SourcesJson = "[]";
                    request.ProviderName = "None";
                    request.Status = AiConsultationStatus.Limited;
                    goto Persist;
                }

                var hasProfileSoilMoistureRequirement = context.Requirements.Any(x => x.ParameterCode == EnvironmentalParameterCode.SoilMoisture);
                if (intent.Has(QuestionTopics.IrrigationOrControl) && passages is { Count: 0 } && !hasProfileSoilMoistureRequirement)
                {
                    recommendation = CreateLimited(request, context, AiRecommendationStatus.InsufficientData,
                        "Chưa có tài liệu ngưỡng tưới phù hợp",
                        $"{BuildPartialRealtimeAnswer(intent, context, operationalCrop)} Chưa tìm thấy tài liệu đã duyệt có ngưỡng độ ẩm đất phù hợp để đối chiếu.",
                        ["Không có tài liệu VietGAP/kỹ thuật đã duyệt nêu ngưỡng tưới phù hợp cho cây này."], now);
                    recommendation.SourcesJson = "[]";
                    request.ProviderName = "None";
                    request.Status = AiConsultationStatus.Limited;
                    goto Persist;
                }

                var providerRequest = new AiProviderRequest(question, providerContext, passages);
                var promptText = AiPromptBuilder.Build(providerRequest);
                var result = await provider.GenerateAsync(
                    providerRequest,
                    cancellationToken);
                recommendation = await FromProviderAsync(request, context, result, now, cancellationToken);

                // Chỉ hiện làm nguồn những đoạn đủ liên quan; model trích dẫn một đoạn khớp yếu cũng không biến nó thành căn cứ.
                var sources = (result.CitedPassageIndexes ?? [])
                    .Distinct()
                    .Where(i => passages is not null && i >= 1 && i <= passages.Count)
                    .Select(i => passages![i - 1])
                    .Where(p => p.SimilarityScore >= MinDisplayedSourceScore)
                    .GroupBy(p => p.DocumentId).Select(g => g.OrderByDescending(p => p.SimilarityScore).First())
                    .Select(p => new AiSourceView(p.DocumentId, p.DocumentTitle, p.AuthorOrganization, p.Category, p.SimilarityScore, p.Content, p.PageNumber, p.SectionTitle))
                    .ToList();

                // Chỉ hiển thị tài liệu mà model đã trích dẫn bằng chỉ mục passage; không tự gán nguồn theo điểm tương đồng.
                if (intent.Has(QuestionTopics.IrrigationOrControl) && !hasProfileSoilMoistureRequirement &&
                    !sources.Any(x => IsSoilMoistureThresholdEvidence(x.ContentSnippet)))
                {
                    recommendation = CreateLimited(request, context, AiRecommendationStatus.InsufficientData,
                        "Chưa có căn cứ về ngưỡng tưới",
                        $"{BuildPartialRealtimeAnswer(intent, context, operationalCrop)} Không có trích dẫn tài liệu đã duyệt nêu ngưỡng độ ẩm đất cho cây này, nên AI không kết luận có cần tưới.",
                        ["Thiếu ngưỡng độ ẩm đất từ hồ sơ giai đoạn hiện tại hoặc tài liệu VietGAP đã duyệt."], now);
                    sources = [];
                    request.Status = AiConsultationStatus.Limited;
                }

                // Câu hỏi kiến thức mà không có nguồn đủ điểm nào: không trả lời như có căn cứ.
                if (requiresAgronomyEvidence && sources.Count == 0)
                {
                    recommendation = CreateLimited(request, context, AiRecommendationStatus.InsufficientData,
                        "Chưa tìm thấy tài liệu đã duyệt",
                        WithZoneDataParts(intent, context, "Không có đoạn tài liệu VietGAP/kỹ thuật đã duyệt đủ liên quan để làm căn cứ trả lời câu hỏi này, nên hệ thống không đưa ra nội dung kỹ thuật."),
                        ["Không có nguồn tài liệu đủ liên quan"], now);
                }

                recommendation.SourcesJson = JsonSerializer.Serialize(sources);
                request.ContextSnapshotJson = JsonSerializer.Serialize(new 
                { 
                    Question = question,
                    Context = providerContext,
                    Passages = passages?.Select(p => new { p.ChunkId, p.DocumentId, p.DocumentTitle, p.Category, p.SimilarityScore }).ToList(),
                    Sources = sources.Select(s => s.Title).ToList() 
                });
                request.ProviderName = Optional(result.ProviderName, 100) ?? "Unknown";
                request.Status = recommendation.Status == AiRecommendationStatus.Ready ? AiConsultationStatus.Completed : AiConsultationStatus.Limited;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "AI advisory provider execution failed: {Message}", ex.Message);
                recommendation = CreateLimited(request, context, AiRecommendationStatus.ProviderUnavailable,
                    "Trợ lý AI tạm thời không khả dụng",
                    "Hệ thống chưa nhận được phản hồi từ dịch vụ AI (có thể do hết hạn mức sử dụng hoặc quá tải). Chưa có khuyến nghị nào được tạo. Vui lòng thử lại sau ít phút.",
                    [SafeProviderFailure(ex)], now);
                request.ProviderName = "Unavailable";
                request.Status = AiConsultationStatus.Failed;
            }
        }

        Persist:
        request.CompletedAtUtc = now;
        db.AiRecommendations.Add(recommendation);
        await db.SaveChangesAsync(cancellationToken);
        return ToView(recommendation);
    }

    // Điểm tối thiểu để một đoạn tri thức được hiện làm tài liệu tham chiếu.
    private const float MinDisplayedSourceScore = 0.25f;
    private const int IrrigationScheduleConflictWindowMinutes = 30;

    private async Task<AiRecommendation> FromProviderAsync(AiConsultationRequest request, AiZoneContext context, AiProviderResult result, DateTime now, CancellationToken cancellationToken)
    {
        var limitations = result.Limitations.Select(x => Optional(x, 500)).Where(x => x is not null).Cast<string>().ToList();
        var confidence = Math.Clamp(result.Confidence, 0, 1);
        var status = confidence < settings.MinimumConfidence ? AiRecommendationStatus.LowConfidence : AiRecommendationStatus.Ready;
        var actionable = false;
        Guid? actuatorId = null;
        ActuatorCommandAction? action = null;
        int? duration = null;
        var summary = result.Summary;
        var details = result.Details;

        var validatedAction = AiOutputValidator.ValidateAction(result, context, settings.MinimumConfidence);
        if (result.ProposedControlAction is not null && validatedAction is null && status == AiRecommendationStatus.Ready)
        {
            limitations.Add("Đề xuất điều khiển chưa đạt điều kiện an toàn hoặc thiếu dữ liệu cảm biến mới.");
        }
        else if (validatedAction is not null && status == AiRecommendationStatus.Ready)
        {
            var actuator = await db.DeviceActuators.AsNoTracking().Include(x => x.Device)
                .SingleOrDefaultAsync(x => x.Id == validatedAction.ActuatorId && x.Device.ZoneId == request.ZoneId, cancellationToken);
            var maxDuration = actuator is null ? 0 : Math.Min(1800, actuator.MaxDurationMinutes * 60);
            if (actuator is null || actuator.Device.Status != DeviceStatus.Online || actuator.Device.DecommissionedAtUtc is not null ||
                !Enum.IsDefined(validatedAction.Action) || validatedAction.DurationSeconds < 1 ||
                validatedAction.DurationSeconds > maxDuration)
            {
                status = AiRecommendationStatus.InvalidProviderOutput;
                limitations.Add("The provider proposed an unavailable actuator, unsupported action, or duration that is not valid for this Zone.");
            }
            else
            {
                var isIrrigationPump = actuator.ActuatorType.Contains("pump", StringComparison.OrdinalIgnoreCase) ||
                                       actuator.ActuatorType.Contains("water", StringComparison.OrdinalIgnoreCase) ||
                                       actuator.ActuatorType.Contains("irrigation", StringComparison.OrdinalIgnoreCase);
                if (isIrrigationPump && validatedAction.Action == ActuatorCommandAction.TurnOn)
                {
                    var scheduledIrrigation = context.UpcomingSchedules
                        .Where(x => x.NextRunAtUtc > now && x.NextRunAtUtc <= now.AddMinutes(IrrigationScheduleConflictWindowMinutes))
                        .OrderBy(x => x.NextRunAtUtc)
                        .FirstOrDefault();
                    if (scheduledIrrigation is not null)
                    {
                        var minutesUntil = Math.Max(1, scheduledIrrigation.MinutesUntilRun);
                        summary = "Đã có lịch tưới sắp chạy";
                        details = $"Zone đã có lịch tưới tự động “{scheduledIrrigation.Name}” dự kiến chạy sau khoảng {minutesUntil} phút ({scheduledIrrigation.NextRunTimeFormatted}). Không đề xuất tưới thêm để tránh trùng lịch.";
                        limitations.Add($"Có lịch tưới tự động trong vòng {IrrigationScheduleConflictWindowMinutes} phút; hệ thống không đề xuất lệnh tưới bổ sung.");
                    }
                    else
                    {
                        var thresholdCheck = await CheckIrrigationThresholdAsync(request.ZoneId, cancellationToken);
                        if (!thresholdCheck.CanIrrigate)
                        {
                            status = thresholdCheck.HasThreshold && thresholdCheck.HasFreshReading
                                ? AiRecommendationStatus.Ready
                                : AiRecommendationStatus.InsufficientData;
                            summary = thresholdCheck.HasThreshold && thresholdCheck.HasFreshReading
                                ? "Chưa cần tưới theo ngưỡng hồ sơ cây trồng"
                                : "Chưa đủ dữ liệu hồ sơ để đề xuất tưới";
                            details = thresholdCheck.Message;
                            limitations.Add(thresholdCheck.Message);
                        }
                        else
                        {
                            actionable = true;
                            actuatorId = actuator.Id;
                            action = validatedAction.Action;
                            duration = validatedAction.DurationSeconds;
                        }
                    }
                }
                else
                {
                    actionable = true;
                    actuatorId = actuator.Id;
                    action = validatedAction.Action;
                    duration = validatedAction.DurationSeconds;
                }
            }
        }

        if (!context.IsSufficientForAdvice)
        {
            actionable = false;
            actuatorId = null;
            action = null;
            duration = null;
            limitations.Add("Không khả dụng đề xuất điều khiển thiết bị tự động do thiếu dữ liệu cảm biến vi khí hậu thời gian thực.");
        }

        if (status == AiRecommendationStatus.LowConfidence)
            limitations.Add($"Provider confidence {confidence:0.00} is below the required {settings.MinimumConfidence:0.00} threshold.");

        return new AiRecommendation
        {
            ConsultationRequestId = request.Id,
            ConsultationRequest = request,
            TenantId = request.TenantId,
            FarmId = request.FarmId,
            ZoneId = request.ZoneId,
            GrowthStageId = context.GrowthStageId,
            Summary = Truncate(summary, 500),
            Details = Truncate(details, 4000),
            Limitations = JoinLimitations(limitations),
            Confidence = confidence,
            Status = status,
            IsActionable = actionable,
            ValidUntilUtc = now.AddMinutes(settings.RecommendationValidityMinutes),
            ProposedActuatorId = actuatorId,
            ProposedAction = action,
            ProposedDurationSeconds = duration
        };
    }

    private async Task<AiZoneContext> BuildContextAsync(Zone zone, bool includeHistory, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var inProgressSeason = await db.PlantingSeasons.AsNoTracking()
            .Include(x => x.Crop).Include(x => x.Variety).Include(x => x.GrowthProfile)
            .Include(x => x.CurrentGrowthStage).ThenInclude(x => x.Requirements)
            .AsSplitQuery()
            .SingleOrDefaultAsync(x => x.ZoneId == zone.Id && x.Status == PlantingSeasonStatus.InProgress, cancellationToken);
        TimeZoneInfo farmTz;
        try { farmTz = TimeZoneInfo.FindSystemTimeZoneById(zone.Field.Farm.TimeZone); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { farmTz = TimeZoneInfo.Utc; }
        // Ngày hiện tại theo múi giờ của Farm (không phải ngày UTC): dùng cho tuổi vụ và số ngày còn lại.
        var farmToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now, farmTz));
        // Cây/giống hiện tại là thuộc tính của Zone. Vụ mùa chỉ cho tuổi, giai đoạn, kế hoạch và ngưỡng khi cùng cây với Zone;
        // vụ khác cây (hoặc Zone chưa gán cây) không được dùng, và không tự đồng bộ ngầm.
        var zoneCropName = zone.CropId.HasValue ? await db.Crops.AsNoTracking().Where(x => x.Id == zone.CropId).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken) : null;
        var zoneVarietyName = zone.CropVarietyId.HasValue ? await db.CropVarieties.AsNoTracking().Where(x => x.Id == zone.CropVarietyId).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken) : null;
        var seasonMatchesZone = inProgressSeason is not null && zone.CropId.HasValue && inProgressSeason.CropId == zone.CropId &&
            (zone.CropVarietyId is null || inProgressSeason.VarietyId is null || inProgressSeason.VarietyId == zone.CropVarietyId);
        var season = seasonMatchesZone ? inProgressSeason : null;
        var seasonCropMismatch = inProgressSeason is not null && !seasonMatchesZone;
        // Zone chưa có cây và chưa có vụ đang chạy: chỉ nêu cây của vụ dự kiến (Planned) như dự kiến, không phải cây đang trồng.
        var (cropHint, cropHintSource) = zoneCropName is null && inProgressSeason is null ? await ResolveCropHintAsync(zone, cancellationToken) : (null, null);
        var hasMatchingProfileAndStage = season is not null && season.GrowthProfile is { } currentProfile &&
            currentProfile.CropId == season.CropId && currentProfile.VarietyId == season.VarietyId &&
            season.CurrentGrowthStage?.GrowthProfileId == season.GrowthProfileId;
        // Zone có cây nhưng chưa có vụ: nêu kế hoạch tham chiếu của Growth Profile (hệ thống hoặc của tenant) cho đúng cây/giống, gắn nhãn là kế hoạch.
        AiReferenceProfile? referenceProfile = null;
        if (inProgressSeason is null && zone.CropId.HasValue)
        {
            var tenantId = zone.Field.Farm.TenantId;
            var profile = await db.GrowthProfiles.AsNoTracking()
                .Where(p => p.CropId == zone.CropId && (p.TenantId == null || p.TenantId == tenantId) && (p.VarietyId == null || p.VarietyId == zone.CropVarietyId))
                .OrderByDescending(p => p.VarietyId == zone.CropVarietyId && p.VarietyId != null).ThenByDescending(p => p.IsDefault).ThenByDescending(p => p.TenantId == tenantId)
                .Select(p => new { p.Name, Stages = p.Stages.OrderBy(s => s.StageOrder).Select(s => new AiStageOutlineItem(s.StageOrder, s.Name, s.DurationDays, false)).ToList() })
                .FirstOrDefaultAsync(cancellationToken);
            if (profile is { Stages.Count: > 0 })
                referenceProfile = new AiReferenceProfile(profile.Name, profile.Stages.Count, profile.Stages.Sum(s => s.DurationDays), profile.Stages);
        }
        var latestReadings = await db.TelemetryReadings.AsNoTracking()
            .Where(x => x.ZoneId == zone.Id && x.Device.ZoneId == zone.Id && x.CapturedAtUtc <= now)
            .GroupBy(x => x.ParameterCode)
            .Select(g => g.OrderByDescending(x => x.CapturedAtUtc).ThenByDescending(x => x.ReceivedAtUtc).First())
            .ToListAsync(cancellationToken);

        var telemetry = latestReadings.Select(reading =>
        {
            var isFresh = reading.CapturedAtUtc >= now.AddMinutes(-settings.TelemetryFreshnessMinutes) && reading.CapturedAtUtc <= now;
            return new AiTelemetryContextItem(reading.ParameterCode, reading.Value, reading.Unit, reading.CapturedAtUtc, isFresh);
        }).ToList();

        // ─── Lịch sử đo đạc: Tùy vào câu hỏi, chỉ truy vấn khi người dùng thực sự hỏi về lịch sử / xu hướng ───
        List<AiTelemetryHistoryItem>? telemetryHistory = null;
        if (includeHistory)
        {
            var recentReadingsRaw = await db.TelemetryReadings.AsNoTracking()
                .Where(x => x.ZoneId == zone.Id && x.Device.ZoneId == zone.Id && x.CapturedAtUtc <= now && x.CapturedAtUtc >= now.AddHours(-12))
                .OrderByDescending(x => x.CapturedAtUtc)
                .Take(60)
                .ToListAsync(cancellationToken);

            telemetryHistory = recentReadingsRaw
                .GroupBy(x => x.ParameterCode)
                .SelectMany(g => g.OrderByDescending(x => x.CapturedAtUtc).Take(5))
                .OrderBy(x => x.ParameterCode).ThenBy(x => x.CapturedAtUtc)
                .Select(x => new AiTelemetryHistoryItem(x.ParameterCode, x.Value, x.Unit, x.CapturedAtUtc))
                .ToList();
        }
        var actuators = await db.DeviceActuators.AsNoTracking().Include(x => x.Device)
            .Where(x => x.Device.ZoneId == zone.Id && x.Device.DecommissionedAtUtc == null && x.Device.Status != DeviceStatus.Decommissioned)
            .Select(x => new AiActuatorContextItem(x.Id, x.ActuatorType, Math.Min(1800, x.MaxDurationMinutes * 60), x.Device.Status == DeviceStatus.Online))
            .ToListAsync(cancellationToken);
        AiWeatherResult weather;
        try { weather = await weatherProvider.GetAsync(zone.Field.FarmId, zone.Id, cancellationToken); }
        catch (Exception ex) when (ex is not OperationCanceledException) { weather = new(false, null, null, null, null, SafeProviderFailure(ex)); }

        var missing = new List<string>();
        if (season is null) missing.Add("active planting season");
        if (seasonCropMismatch) missing.Add("planting season crop matching the Zone crop");
        if (zoneCropName is null) missing.Add("crop");
        if (season?.GrowthProfile is null || season.GrowthProfile.CropId != season.CropId || season.GrowthProfile.VarietyId != season.VarietyId) missing.Add("growth profile");
        if (season?.CurrentGrowthStage is null || season.CurrentGrowthStage.GrowthProfileId != season.GrowthProfileId) missing.Add("growth stage");
        // Old sensor readings may be useful as historical context, but they must never
        // make a consultation actionable or be presented as current measurements.
        if (!telemetry.Any(x => x.IsFresh)) missing.Add("fresh telemetry");
        if (!weather.Available) missing.Add("weather");

        var irrigationActuatorIds = actuators
            .Where(x => x.ActuatorType.Contains("pump", StringComparison.OrdinalIgnoreCase) ||
                        x.ActuatorType.Contains("water", StringComparison.OrdinalIgnoreCase) ||
                        x.ActuatorType.Contains("irrigation", StringComparison.OrdinalIgnoreCase))
            .Select(x => x.ActuatorId)
            .ToArray();
        var rawSchedules = await db.ControlSchedules.AsNoTracking()
            .Where(x => x.ZoneId == zone.Id && x.Actuator.Device.ZoneId == zone.Id && irrigationActuatorIds.Contains(x.ActuatorId) && x.IsActive && x.ArchivedAtUtc == null && x.NextRunAtUtc > now && x.NextRunAtUtc <= now.AddHours(12))
            .OrderBy(x => x.NextRunAtUtc)
            .Take(5)
            .Select(x => new { x.Name, x.NextRunAtUtc, x.DurationSeconds })
            .ToListAsync(cancellationToken);

        var upcomingSchedules = rawSchedules.Select(x =>
        {
            var localTime = TimeZoneInfo.ConvertTimeFromUtc(x.NextRunAtUtc, farmTz);
            var formatted = localTime.ToString("HH:mm 'ngày' dd/MM/yyyy");
            var minutesUntil = (int)Math.Max(1, (x.NextRunAtUtc - now).TotalMinutes);
            return new AiUpcomingScheduleContextItem(x.Name, x.NextRunAtUtc, formatted, x.DurationSeconds, minutesUntil);
        }).ToList();

        var zoneDevices = await db.Devices.AsNoTracking()
            .Include(d => d.Sensors).Include(d => d.Actuators)
            .Where(d => d.ZoneId == zone.Id && d.DecommissionedAtUtc == null && d.Status != DeviceStatus.Decommissioned)
            .OrderBy(d => d.DeviceType)
            .ThenBy(d => d.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var zoneDeviceIds = zoneDevices.Select(d => d.Id).ToList();
        List<TelemetryReading> latestDeviceReadings = [];
        if (zoneDeviceIds.Count > 0)
        {
            latestDeviceReadings = await db.TelemetryReadings.AsNoTracking()
                .Where(x => zoneDeviceIds.Contains(x.DeviceId) && x.CapturedAtUtc <= now)
                .GroupBy(x => new { x.DeviceId, x.ParameterCode })
                .Select(g => g.OrderByDescending(x => x.CapturedAtUtc).ThenByDescending(x => x.ReceivedAtUtc).First())
                .ToListAsync(cancellationToken);
        }
        var labelByDevice = zoneDevices
            .GroupBy(d => d.DeviceType)
            .SelectMany(g => g.Select((d, i) => (d.Id, Label: $"{(g.Key == DeviceType.ActuatorNode ? "Node chấp hành" : "Node cảm biến")} {i + 1}")))
            .ToDictionary(x => x.Id, x => x.Label);
        var zoneDeviceSummaries = zoneDevices
            .Select(d => new AiZoneDeviceSummary(
                labelByDevice[d.Id],
                d.DeviceType.ToString(),
                d.Status.ToString(),
                d.Sensors.Count,
                d.Sensors.OrderBy(s => s.SensorType).Select(s => s.SensorType).ToList(),
                latestDeviceReadings.Where(r => r.DeviceId == d.Id)
                    .OrderBy(r => r.ParameterCode)
                    .Select(r => new AiTelemetryContextItem(
                        r.ParameterCode,
                        r.Value,
                        r.Unit,
                        r.CapturedAtUtc,
                        r.CapturedAtUtc >= now.AddMinutes(-settings.TelemetryFreshnessMinutes)))
                    .ToList(),
                d.Actuators.Select(a => a.ActuatorType).OrderBy(x => x).ToList(),
                d.BatteryLevel,
                d.Rssi))
            .ToList();

        // Gateway phục vụ các node của Zone (qua GatewayId của thiết bị); chỉ thông tin vận hành, không gồm mã định danh/chứng chỉ.
        var gatewayIds = zoneDevices.Select(d => d.GatewayId).Distinct().ToList();
        var gatewaySummaries = gatewayIds.Count == 0
            ? []
            : (await db.Gateways.AsNoTracking().Where(g => gatewayIds.Contains(g.Id)).OrderBy(g => g.CreatedAtUtc).ThenBy(g => g.Id)
                    .Select(g => new { g.Id, g.Status, g.LastSeenAtUtc, g.FirmwareVersion, g.FrequencyBand })
                    .ToListAsync(cancellationToken))
                .Select((g, index) => new AiGatewaySummary($"Gateway {index + 1}", g.Status.ToString(), g.LastSeenAtUtc, g.FirmwareVersion, g.FrequencyBand,
                    zoneDevices.Count(d => d.GatewayId == g.Id)))
                .ToList();

        // Phần còn lại của dữ liệu Zone: cảnh báo, lệnh gần đây, quy tắc tự động, công việc, kế hoạch mùa vụ.
        var activeAlerts = await db.Alerts.AsNoTracking()
            .Where(a => a.ZoneId == zone.Id && a.Status != AlertStatus.Resolved)
            .OrderByDescending(a => a.CreatedAtUtc).Take(10)
            .Select(a => new AiAlertContextItem(a.ParameterCode, a.ObservedValue, a.MinThreshold, a.MaxThreshold, a.Unit,
                a.Severity.ToString(), a.Status.ToString(), a.Title, a.CreatedAtUtc))
            .ToListAsync(cancellationToken);
        var recentCommands = await db.ActuatorCommands.AsNoTracking()
            .Where(c => c.ZoneId == zone.Id && c.Device.ZoneId == zone.Id && c.QueuedAtUtc >= now.AddHours(-24))
            .OrderByDescending(c => c.QueuedAtUtc).Take(8)
            .Select(c => new AiCommandContextItem(c.Actuator.ActuatorType, c.Action.ToString(), c.DurationSeconds,
                c.Status.ToString(), c.TriggerSource.ToString(), c.QueuedAtUtc))
            .ToListAsync(cancellationToken);
        var autoRules = await db.AutoControlRules.AsNoTracking()
            .Where(r => r.ZoneId == zone.Id && r.Actuator.Device.ZoneId == zone.Id && r.IsActive)
            .OrderBy(r => r.Priority).Take(10)
            .Select(r => new AiAutoRuleContextItem(r.Name, r.ParameterCode, r.Operator.ToString(), r.Threshold, r.ConditionDurationMinutes,
                r.Action.ToString(), r.DurationSeconds, r.CooldownMinutes, r.EnableRainDelay, r.RainThresholdPercent))
            .ToListAsync(cancellationToken);
        var openTasks = await db.FarmTasks.AsNoTracking()
            .Where(t => t.ZoneId == zone.Id &&
                        (t.Status == FarmTaskStatus.Pending || t.Status == FarmTaskStatus.Accepted ||
                         t.Status == FarmTaskStatus.InProgress || t.Status == FarmTaskStatus.Overdue) &&
                        t.DueAtUtc <= now.AddDays(7))
            .OrderBy(t => t.DueAtUtc).Take(5)
            .Select(t => new AiTaskContextItem(t.Title, t.DueAtUtc, t.Status.ToString()))
            .ToListAsync(cancellationToken);
        AiSeasonContext? seasonContext = null;
        AiSeasonFacts? seasonFacts = null;
        if (season is not null)
        {
            var stages = hasMatchingProfileAndStage
                ? await db.GrowthStages.AsNoTracking()
                    .Where(s => s.GrowthProfileId == season.GrowthProfileId)
                    .OrderBy(s => s.StageOrder)
                    .Select(s => new AiStageOutlineItem(s.StageOrder, s.Name, s.DurationDays, s.Id == season.CurrentGrowthStageId))
                    .ToListAsync(cancellationToken)
                : [];
            if (hasMatchingProfileAndStage)
                seasonContext = new AiSeasonContext(season.Name, season.StartDate, season.ExpectedEndDate, season.GrowthProfile?.Name, stages);
            var current = stages.FirstOrDefault(x => x.IsCurrent);
            // Tuổi vụ luôn tính được từ ngày bắt đầu; phần Profile/giai đoạn chỉ có khi Profile và giai đoạn khớp cây.
            seasonFacts = new AiSeasonFacts(
                season.Name, season.StartDate, season.ExpectedEndDate,
                Math.Max(0, farmToday.DayNumber - season.StartDate.DayNumber), season.ExpectedEndDate.DayNumber - farmToday.DayNumber,
                hasMatchingProfileAndStage ? season.GrowthProfile?.Name : null, hasMatchingProfileAndStage,
                current?.Name, current?.Order, stages.Count == 0 ? null : stages.Count, current?.DurationDays,
                stages.Count == 0 ? null : stages.Sum(x => x.DurationDays),
                hasMatchingProfileAndStage && season.GrowthProfile is { IsSystemDefined: false });
        }

        // Vụ gần nhất đã kết thúc của Zone: chỉ để trả lời câu hỏi về vụ trước, không bao giờ làm cây hiện tại.
        var lastDone = await db.PlantingSeasons.AsNoTracking()
            .Where(x => x.ZoneId == zone.Id && x.Status == PlantingSeasonStatus.Completed)
            .OrderByDescending(x => x.ActualEndDate).ThenByDescending(x => x.StartDate)
            .Select(x => new AiPastSeason(x.Name, x.Crop.Name, x.StartDate, x.ActualEndDate, x.ActualYieldKg))
            .FirstOrDefaultAsync(cancellationToken);

        return new AiZoneContext(
            zone.Field.FarmId, zone.Field.Farm.Name, zone.Field.Farm.TimeZone, zone.FieldId, zone.Field.Name, zone.Id, zone.Name, zone.AreaM2,
            season?.Id, zoneCropName, zoneVarietyName,
            hasMatchingProfileAndStage ? season?.GrowthProfileId : null,
            hasMatchingProfileAndStage ? season?.GrowthProfile?.Name : null,
            season is null ? null : Math.Max(0, farmToday.DayNumber - season.StartDate.DayNumber),
            hasMatchingProfileAndStage ? season?.CurrentGrowthStageId : null,
            hasMatchingProfileAndStage ? season?.CurrentGrowthStage?.Name : null,
            hasMatchingProfileAndStage
                ? season?.CurrentGrowthStage?.Requirements.Select(x => new AiRequirementContextItem(x.ParameterCode, x.MinValue, x.MaxValue, x.TargetValue, x.Unit)).ToList() ?? []
                : [],
            telemetry,
            actuators,
            upcomingSchedules,
            new AiWeatherContext(weather.Available, weather.Summary, weather.RainProbabilityNext6HoursMaxPercent, weather.TemperatureCelsius, weather.ObservedAtUtc, weather.Limitation),
            missing,
            !missing.Contains("active planting season") && !missing.Contains("crop") &&
            !missing.Contains("growth profile") && !missing.Contains("growth stage") && !missing.Contains("fresh telemetry"),
            TelemetryHistory: telemetryHistory,
            ZoneDevices: zoneDeviceSummaries,
            ActiveAlerts: activeAlerts,
            RecentCommands: recentCommands,
            AutoRules: autoRules,
            OpenTasks: openTasks,
            Season: seasonContext,
            ZoneType: zone.ZoneType.ToString(),
            ZoneStatus: zone.Status.ToString(),
            Gateways: gatewaySummaries,
            SeasonFacts: seasonFacts,
            CropHint: cropHint,
            CropHintSource: cropHintSource,
            CropSource: zoneCropName is null ? null : "zone",
            SeasonCropName: seasonCropMismatch ? inProgressSeason!.Crop?.Name : null,
            SeasonCropMismatch: seasonCropMismatch,
            ReferenceProfile: referenceProfile,
            LastCompletedSeason: lastDone);
    }

    /// <summary>
    /// Gợi ý cây khi Zone chưa gán cây và chưa có vụ đang chạy: chỉ lấy cây của vụ dự kiến (Planned) và luôn ghi là dự kiến.
    /// Không suy ra từ tên Zone, ghi chú, hợp đồng, vụ đã hoàn thành/hủy hay cây mặc định.
    /// </summary>
    private async Task<(string? Name, string? Source)> ResolveCropHintAsync(Zone zone, CancellationToken cancellationToken)
    {
        var planned = await db.PlantingSeasons.AsNoTracking()
            .Where(x => x.ZoneId == zone.Id && x.Status == PlantingSeasonStatus.Planned)
            .OrderBy(x => x.StartDate)
            .Select(x => x.Crop.Name)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(planned) ? (null, null) : (planned, "planned_season");
    }

    /// <summary>Ghép các phần dữ liệu Zone trả lời trực tiếp được vào câu trả lời, để câu hỏi nhiều ý không mất các phần còn lại khi phần kiến thức/tưới thiếu căn cứ.</summary>
    private static string WithZoneDataParts(QuestionIntent intent, AiZoneContext context, string details)
    {
        var rest = intent with { Topics = intent.Topics.Where(t => t is not (QuestionTopics.AgronomyKnowledge or QuestionTopics.IrrigationOrControl)).ToList() };
        if (rest.Topics.Count == 0) return details;
        var answer = TryAnswerFromZoneData(rest, context);
        return answer is null ? details : $"{answer.Details}\n\n{details}";
    }

    private static string PastSeasonSentence(AiPastSeason p) =>
        $" Vụ gần nhất đã kết thúc: “{p.Name}”{(string.IsNullOrWhiteSpace(p.CropName) ? string.Empty : $" ({p.CropName})")}, bắt đầu {p.StartDate:dd/MM/yyyy}"
        + (p.ActualEndDate is { } end ? $", kết thúc {end:dd/MM/yyyy}" : string.Empty)
        + (p.ActualYieldKg is { } kg ? $", sản lượng ghi nhận {kg:0.##} kg" : ", chưa ghi nhận sản lượng")
        + ". Đây là lịch sử, không phải cây hay giai đoạn hiện tại.";

    private static string BuildSeasonAnswer(AiZoneContext context, bool harvest)
    {
        var zoneCrop = string.Join(" ", new[] { context.CropName, context.VarietyName is null ? null : $"({context.VarietyName})" }.Where(x => x is not null));
        if (context.SeasonCropMismatch)
            return $"Dữ liệu chưa nhất quán: {(string.IsNullOrWhiteSpace(zoneCrop) ? "Zone chưa được gán cây" : $"Zone đang gán cây {zoneCrop}")} nhưng vụ đang canh tác thuộc cây {context.SeasonCropName}. Hệ thống không dùng giai đoạn, tuổi vụ hay ngưỡng của vụ đó cho Zone này; hãy cập nhật cây của Zone hoặc vụ mùa cho khớp.";
        if (context.SeasonFacts is not { } f)
        {
            var none = string.IsNullOrWhiteSpace(zoneCrop)
                ? "Zone chưa được gán cây và chưa có vụ mùa đang canh tác nên chưa xác định được cây đang trồng, giai đoạn hiện tại, số ngày tuổi và thời gian đến thu hoạch."
                : $"Cây trong Zone: {zoneCrop}. Zone chưa có vụ mùa đang canh tác nên chưa xác định được giai đoạn hiện tại, số ngày tuổi và kế hoạch mùa vụ. Hãy tạo vụ mùa cho Zone (trang Vụ mùa) để theo dõi các thông tin này."
                    + (harvest ? " Cũng chưa xác định được thời gian đến thu hoạch." : string.Empty);
            if (context.LastCompletedSeason is { } past) none += PastSeasonSentence(past);
            if (context.ReferenceProfile is { } rp)
                none += $" Theo kế hoạch của Growth Profile “{rp.Name}”: {rp.StageCount} giai đoạn, tổng {rp.TotalPlannedDays} ngày ({string.Join("; ", rp.Stages.Select(x => $"{x.Name} {x.DurationDays} ngày"))}). Đây là thời lượng kế hoạch tham chiếu, không phải số ngày thực tế của cây trong Zone.";
            if (string.IsNullOrWhiteSpace(zoneCrop) && !string.IsNullOrWhiteSpace(context.CropHint))
                none += $" Có vụ dự kiến (chưa bắt đầu) cho cây {context.CropHint}; đó là cây dự kiến, không phải cây đang trồng.";
            return none;
        }

        var crop = string.Join(" ", new[] { context.CropName, context.VarietyName is null ? null : $"({context.VarietyName})" }.Where(x => x is not null));
        var stage = f.CurrentStageName is null
            ? "chưa xác định được giai đoạn hiện tại (vụ chưa có Growth Profile hoặc giai đoạn khớp cây)"
            : $"giai đoạn hiện tại: {f.CurrentStageName}" + (f.CurrentStageOrder is { } order && f.StageCount is { } count ? $" (giai đoạn {order}/{count})" : string.Empty);
        var remaining = f.DaysToExpectedEnd >= 0 ? $"còn {f.DaysToExpectedEnd} ngày" : $"đã quá {-f.DaysToExpectedEnd} ngày so với dự kiến";
        var line = $"Cây đang trồng: {(string.IsNullOrWhiteSpace(crop) ? "chưa xác định" : crop)}; {stage}; vụ “{f.SeasonName}” bắt đầu {f.StartDate:dd/MM/yyyy}, đã {f.ElapsedDays} ngày (theo ngày của Farm); ngày kết thúc dự kiến của vụ {f.ExpectedEndDate:dd/MM/yyyy} ({remaining}).";
        if (harvest && f.ProfileTotalPlannedDays is { } total)
            line += $" Kế hoạch của Growth Profile “{f.ProfileName}” gồm {f.StageCount} giai đoạn, tổng {total} ngày: đây là thời lượng kế hoạch, không phải số ngày thực tế.";
        if (context.Season is { } season)
        {
            var stages = string.Join(" → ", season.Stages.OrderBy(x => x.Order).Select(x => x.IsCurrent ? $"[{x.Name}]" : x.Name));
            if (stages.Length > 0) line += $" Các giai đoạn: {stages}.";
        }
        if (f.ProfileIsFarmOwned) line += " Hồ sơ sinh trưởng này là bản tuỳ chỉnh của trang trại, không phải hồ sơ hệ thống.";
        if (context.LastCompletedSeason is { } pastDone) line += PastSeasonSentence(pastDone);
        if (harvest)
            line += " Hệ thống không lưu ngày thu hoạch riêng: ngày kết thúc dự kiến của vụ không phải ngày thu hoạch chắc chắn nên chưa thể khẳng định ngày thu hoạch.";
        return line;
    }

    private static string BuildPartialRealtimeAnswer(QuestionIntent intent, AiZoneContext context, string? cropName)
    {
        var requestedCodes = intent.Parameters.ToHashSet();

        var readings = context.Telemetry
            .Where(x => x.IsFresh && (requestedCodes.Count == 0 || requestedCodes.Contains(x.ParameterCode)))
            .Select(x => $"{ParameterLabel(x.ParameterCode)}: {x.Value.ToString("0.##", CultureInfo.InvariantCulture)} {x.Unit}")
            .ToList();
        var freshCodes = context.Telemetry.Where(x => x.IsFresh).Select(x => x.ParameterCode).ToHashSet();
        var missingCodes = requestedCodes.Where(x => !freshCodes.Contains(x)).Select(ParameterLabel).ToList();
        var measurementText = readings.Count > 0
            ? $"Số đo mới nhất: {string.Join("; ", readings)}.{(missingCodes.Count > 0 ? $" Chưa có số đo mới cho: {string.Join(", ", missingCodes)}." : string.Empty)}"
            : "Chưa có số đo mới cho thông số được hỏi trong Zone này.";

        if (intent.Has(QuestionTopics.IrrigationOrControl))
        {
            // Nêu đúng lý do: số đo đã đủ thì cái thiếu là ngưỡng của cây, không phải số đo.
            var reason = string.IsNullOrWhiteSpace(cropName)
                ? "chưa xác định được cây trồng của Zone"
                : !context.Telemetry.Any(x => x.IsFresh && x.ParameterCode == EnvironmentalParameterCode.SoilMoisture)
                    ? "chưa có số đo độ ẩm đất mới"
                    : missingCodes.Count > 0
                        ? $"chưa có số đo mới cho: {string.Join(", ", missingCodes)}"
                        : "chưa có ngưỡng độ ẩm đất của cây trong Zone (từ hồ sơ giai đoạn hiện tại hoặc tài liệu VietGAP đã duyệt) để đối chiếu với số đo";
            return $"{measurementText} Chưa thể kết luận có cần tưới hay không vì {reason}. Không phát lệnh tưới tự động.";
        }

        return measurementText;
    }

    /// <summary>
    /// Trả lời trực tiếp từ dữ liệu của Zone theo các chủ đề AI đã hiểu từ câu hỏi (không có từ khóa nào trong mã).
    /// Câu hỏi cần tài liệu, quyết định tưới/điều khiển hoặc chưa phân loại được thì trả null để đi tiếp tới AI tư vấn.
    /// </summary>
    private static ZoneDataAnswer? TryAnswerFromZoneData(QuestionIntent intent, AiZoneContext context)
    {
        if (intent.Has(QuestionTopics.IrrigationOrControl) || intent.Has(QuestionTopics.AgronomyKnowledge) ||
            intent.Has(QuestionTopics.SmallTalk) || intent.Has(QuestionTopics.OutOfScope))
            return null;

        var parts = new List<ZoneDataAnswer>();
        if (intent.Has(QuestionTopics.Gateways)) parts.Add(BuildGatewayAnswer(context));
        if (intent.Has(QuestionTopics.Devices)) parts.Add(BuildDeviceListAnswer(intent, context));
        if (intent.Has(QuestionTopics.SensorReadings))
            parts.Add(BuildSensorOverviewAnswer(context, intent.Parameters.Count > 0 ? intent.Parameters.ToHashSet() : null));
        var zoneTopics = new[]
        {
            QuestionTopics.Alerts, QuestionTopics.Commands, QuestionTopics.Schedules, QuestionTopics.Tasks, QuestionTopics.Season, QuestionTopics.Harvest,
            QuestionTopics.ZoneInfo, QuestionTopics.AutoRules, QuestionTopics.DeviceHealth
        };
        if (zoneTopics.Any(intent.Has)) parts.Add(BuildZoneTopicsAnswer(intent, context));
        // Thời tiết không khả dụng được xử lý riêng ở bước kiểm tra dữ liệu bắt buộc để báo đúng lý do.
        if (intent.Has(QuestionTopics.Weather) && context.Weather.Available) parts.Add(BuildWeatherAnswer(context));

        if (parts.Count == 0) return null;
        if (parts.Count == 1) return parts[0];
        return new ZoneDataAnswer(
            parts.Any(p => p.Status == AiRecommendationStatus.Ready) ? AiRecommendationStatus.Ready : parts[0].Status,
            "Thông tin của Zone",
            string.Join("\n\n", parts.Select(p => p.Details)),
            parts.SelectMany(p => p.Limitations).Distinct().ToArray(),
            parts.Any(p => p.WantsOverallComment));
    }

    private async Task<QuestionIntent> ClassifyIntentAsync(string question, CancellationToken cancellationToken)
    {
        try
        {
            return await intentClassifier.ClassifyAsync(question, cancellationToken) ?? QuestionIntent.Unknown;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Question intent classification failed; continuing without a pre-classified intent.");
            return QuestionIntent.Unknown;
        }
    }

    private sealed record ZoneDataAnswer(AiRecommendationStatus Status, string Summary, string Details, string[] Limitations, bool WantsOverallComment = false);

    private static string ActuatorLabel(string type) => type switch
    {
        "WaterPump" => "máy bơm tưới",
        "Fan" => "quạt thông gió",
        "Valve" => "van tưới",
        "Light" => "đèn trợ sáng",
        _ => type
    };

    private static string CommandStatusLabel(string status) => status switch
    {
        "Acknowledged" => "đã thực thi",
        "Failed" => "thất bại",
        "TimedOut" => "quá thời gian chờ phản hồi",
        "Pending" or "Sent" => "đang chờ thiết bị",
        "Cancelled" => "đã hủy",
        _ => status
    };

    private static string TriggerLabel(string source) => source switch
    {
        "Manual" => "thủ công",
        "Schedule" => "theo lịch",
        "AutoRule" => "quy tắc tự động",
        "AI_APPROVED" => "đề xuất AI đã duyệt",
        _ => source
    };

    private static string SeverityLabel(string severity) => severity switch
    {
        "Critical" => "nghiêm trọng",
        "Warning" => "cảnh báo",
        "Info" => "thông tin",
        _ => severity
    };

    private static ZoneDataAnswer BuildZoneTopicsAnswer(QuestionIntent intent, AiZoneContext context)
    {
        var tz = context.FarmTimeZone;
        var sections = new List<string>();

        if (intent.Has(QuestionTopics.ZoneInfo))
            sections.Add($"Zone “{context.ZoneName}”: diện tích {Num(context.ZoneAreaM2)} m²{(context.ZoneType is null ? string.Empty : $", loại {context.ZoneType}")}{(context.ZoneStatus is null ? string.Empty : $", trạng thái {context.ZoneStatus}")}.");

        if (intent.Has(QuestionTopics.Season) || intent.Has(QuestionTopics.Harvest))
            sections.Add(BuildSeasonAnswer(context, intent.Has(QuestionTopics.Harvest)));

        if (intent.Has(QuestionTopics.Alerts))
        {
            var alerts = context.ActiveAlerts ?? [];
            sections.Add(alerts.Count == 0
                ? "Zone hiện không có cảnh báo nào đang mở."
                : "Cảnh báo đang mở (" + alerts.Count + "):\n" + string.Join("\n", alerts.Take(8).Select(a => $"• [{SeverityLabel(a.Severity)}] {a.Title} — {ParameterLabel(a.ParameterCode)} {Num(a.ObservedValue)} {a.Unit} (ngưỡng {Num(a.MinThreshold)}–{Num(a.MaxThreshold)}), lúc {LocalTime(a.CreatedAtUtc, tz)}")));
        }

        if (intent.Has(QuestionTopics.Commands))
        {
            var commands = context.RecentCommands ?? [];
            sections.Add(commands.Count == 0
                ? "Không có lệnh điều khiển nào trong 24 giờ qua."
                : "Lệnh điều khiển trong 24 giờ qua (mới nhất trước):\n" + string.Join("\n", commands.Take(6).Select(c => $"• {ActuatorLabel(c.ActuatorType)} {(c.Action == "TurnOn" ? "bật" : "tắt")} {c.DurationSeconds} giây — {CommandStatusLabel(c.Status)} ({TriggerLabel(c.TriggerSource)}), lúc {LocalTime(c.QueuedAtUtc, tz)}")));
        }

        if (intent.Has(QuestionTopics.Schedules))
        {
            var schedules = context.UpcomingSchedules;
            sections.Add(schedules.Count == 0
                ? "Zone chưa có lịch tưới nào sắp chạy."
                : "Lịch sắp chạy:\n" + string.Join("\n", schedules.Take(6).Select(x => $"• {x.Name} — {x.NextRunTimeFormatted} (sau khoảng {x.MinutesUntilRun} phút), chạy {x.DurationSeconds} giây")));
        }

        if (intent.Has(QuestionTopics.Tasks))
        {
            var tasks = context.OpenTasks ?? [];
            sections.Add(tasks.Count == 0
                ? "Zone không có công việc nào sắp đến hạn."
                : "Công việc chưa hoàn tất (" + tasks.Count + "):\n" + string.Join("\n", tasks.Take(8).Select(t => $"• {t.Title} — hạn {LocalTime(t.DueAtUtc, tz)} ({t.Status})")));
        }

        if (intent.Has(QuestionTopics.AutoRules))
        {
            var rules = context.AutoRules ?? [];
            sections.Add(rules.Count == 0
                ? "Zone chưa có quy tắc điều khiển tự động nào đang bật."
                : "Quy tắc tự động:\n" + string.Join("\n", rules.Take(6).Select(r => $"• {r.Name}: khi {ParameterLabel(r.ParameterCode)} {r.Operator} {Num(r.Threshold)} trong {r.ConditionMinutes} phút → {r.Action} {r.DurationSeconds} giây (chờ {r.CooldownMinutes} phút giữa hai lần{(r.RainDelay ? $"; hoãn khi khả năng mưa ≥ {Num(r.RainThresholdPercent)}%" : string.Empty)})")));
        }

        if (intent.Has(QuestionTopics.DeviceHealth))
        {
            var devices = context.ZoneDevices ?? [];
            sections.Add(devices.Count == 0
                ? "Zone chưa có thiết bị nào được gán nên chưa có thông tin pin và tín hiệu."
                : "Pin và tín hiệu của thiết bị:\n" + string.Join("\n", devices.Select(d => $"• {d.DeviceLabel}: pin {(d.BatteryLevel is { } b ? $"{b}%" : "không báo")}, tín hiệu {(d.Rssi is { } r ? $"{Num(r)} dBm" : "không báo")}")));
        }

        return new ZoneDataAnswer(AiRecommendationStatus.Ready, "Thông tin của Zone", string.Join("\n", sections), []);
    }

    private static ZoneDataAnswer BuildGatewayAnswer(AiZoneContext context)
    {
        var tz = context.FarmTimeZone;
        var gateways = context.Gateways ?? [];
        if (gateways.Count == 0)
            return new ZoneDataAnswer(AiRecommendationStatus.Ready, "Zone chưa có gateway",
                "Chưa có gateway nào phục vụ thiết bị của Zone (chưa có thiết bị nào được gán vào Zone, hoặc thiết bị chưa gắn với gateway).", []);

        var lines = gateways.Select(g =>
        {
            var seen = g.LastSeenAtUtc is { } t ? $"lần thấy gần nhất lúc {LocalTime(t, tz)}" : "chưa ghi nhận lần kết nối nào";
            var detail = string.Join(", ", new[] { string.IsNullOrWhiteSpace(g.FirmwareVersion) ? null : $"firmware {g.FirmwareVersion}", string.IsNullOrWhiteSpace(g.FrequencyBand) ? null : $"băng tần {g.FrequencyBand}" }.Where(x => x is not null));
            return $"• {g.GatewayLabel} — trạng thái {g.Status}; {seen}{(detail.Length > 0 ? $"; {detail}" : string.Empty)}; phục vụ {g.NodesInZone} node của Zone.";
        });
        var offline = gateways.Count(g => g.Status != "Online");
        var limitations = new List<string> { "Trạng thái là trạng thái ghi nhận trong hệ thống; chưa phải kết quả kiểm tra kết nối trực tiếp." };
        if (offline > 0) limitations.Add($"{offline} gateway không ở trạng thái Online: các node qua gateway đó có thể không gửi được số đo.");
        return new ZoneDataAnswer(AiRecommendationStatus.Ready, "Gateway phục vụ Zone",
            $"Zone kết nối qua {gateways.Count} gateway:\n{string.Join("\n", lines)}", limitations.ToArray());
    }

    private static string DeviceReadings(AiZoneDeviceSummary d, string tz)
    {
        if (d.LatestReadings.Count == 0) return "chưa có số đo";
        return string.Join(", ", d.LatestReadings.Select(r =>
            $"{ParameterLabel(r.ParameterCode)} {r.Value.ToString("0.##", CultureInfo.InvariantCulture)} {r.Unit}{(r.IsFresh ? string.Empty : " (số đo cũ)")}")) +
            $" (lúc {LocalTime(d.LatestReadings.Max(r => r.CapturedAtUtc), tz)})";
    }

    private static string LocalTime(DateTime utc, string timeZoneId)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz).ToString("HH:mm dd/MM", CultureInfo.InvariantCulture);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return DateTime.SpecifyKind(utc, DateTimeKind.Utc).ToString("HH:mm dd/MM 'UTC'", CultureInfo.InvariantCulture);
        }
    }

    private static string Reading(AiTelemetryContextItem x, string timeZoneId) =>
        $"{ParameterLabel(x.ParameterCode)}: {x.Value.ToString("0.##", CultureInfo.InvariantCulture)} {x.Unit} (lúc {LocalTime(x.CapturedAtUtc, timeZoneId)})";

    private static ZoneDataAnswer BuildSensorOverviewAnswer(AiZoneContext context, IReadOnlySet<EnvironmentalParameterCode>? only = null)
    {
        var tz = context.FarmTimeZone;
        bool Wanted(EnvironmentalParameterCode code) => only is null || only.Contains(code);
        var devices = context.ZoneDevices ?? [];
        var sensorDevices = devices.Where(d => d.SensorCount > 0).ToList();

        // Mọi số đo mới nhất của từng thông số trên từng node (không chọn một node đại diện).
        var perParameter = devices
            .SelectMany(d => d.LatestReadings.Where(r => r.IsFresh && Wanted(r.ParameterCode)).Select(r => (Device: d.DeviceLabel, Reading: r)))
            .GroupBy(x => x.Reading.ParameterCode)
            .OrderBy(g => g.Key)
            .ToList();

        var freshLines = new List<string>();
        foreach (var g in perParameter)
        {
            var values = g.OrderBy(x => x.Device, StringComparer.Ordinal).ToList();
            var unit = values[0].Reading.Unit;
            var latest = values.Max(x => x.Reading.CapturedAtUtc);
            var min = values.Min(x => x.Reading.Value);
            var max = values.Max(x => x.Reading.Value);
            if (values.Count == 1)
                freshLines.Add($"• {ParameterLabel(g.Key)}: {Num(min)} {unit} ({values[0].Device}, lúc {LocalTime(latest, tz)})");
            else
                freshLines.Add($"• {ParameterLabel(g.Key)}: {(min == max ? Num(min) : $"{Num(min)}–{Num(max)}")} {unit} — {string.Join("; ", values.Select(x => $"{x.Device}: {Num(x.Reading.Value)}"))} (mới nhất lúc {LocalTime(latest, tz)})");
        }

        // Zone chưa có số đo theo từng node (ví dụ thiết bị không báo qua danh sách) thì dùng số đo mới nhất theo thông số của Zone.
        if (freshLines.Count == 0)
            freshLines.AddRange(context.Telemetry.Where(x => x.IsFresh && Wanted(x.ParameterCode)).OrderBy(x => x.ParameterCode).Select(x => $"• {Reading(x, tz)}"));

        var freshCodes = perParameter.Select(g => g.Key).ToHashSet();
        var stale = context.Telemetry.Where(x => !x.IsFresh && Wanted(x.ParameterCode) && !freshCodes.Contains(x.ParameterCode)).OrderBy(x => x.ParameterCode).ToList();

        var parts = new List<string>();
        if (freshLines.Count > 0)
            parts.Add($"Số đo mới nhất của Zone{(sensorDevices.Count > 1 ? $" từ {sensorDevices.Count} thiết bị cảm biến" : string.Empty)}:\n{string.Join("\n", freshLines)}");
        if (stale.Count > 0) parts.Add($"Số đo cũ (không còn mới, không dùng để tư vấn): {string.Join("; ", stale.Select(x => Reading(x, tz)))}.");
        if (only is null)
        {
            if (sensorDevices.Count > 0)
                parts.Add($"Zone có {sensorDevices.Count} thiết bị cảm biến ({string.Join(", ", sensorDevices.GroupBy(d => d.Status).Select(g => $"{g.Count()} {g.Key}"))}).");
            else
                parts.Add("Zone chưa có thiết bị cảm biến nào được gán.");
        }
        var subject = only is null ? "cảm biến" : string.Join(", ", only.OrderBy(c => c).Select(c => ParameterLabel(c).ToLowerInvariant()));
        if (freshLines.Count == 0 && stale.Count == 0) parts.Insert(0, $"Zone chưa có số đo {subject} nào.");

        var limitations = new List<string>();
        if (freshLines.Count == 0) limitations.Add("Chưa có số đo mới nên không thể nhận định tình trạng hiện tại của Zone.");
        return new ZoneDataAnswer(
            freshLines.Count > 0 ? AiRecommendationStatus.Ready : AiRecommendationStatus.InsufficientData,
            freshLines.Count > 0 ? (only is null ? "Số đo cảm biến hiện tại của Zone" : $"Số đo hiện tại: {subject}") : $"Chưa có số đo {subject} mới",
            string.Join("\n", parts), limitations.ToArray(), WantsOverallComment: freshLines.Count > 0);
    }

    private static string Num(decimal value) => value.ToString("0.##", CultureInfo.InvariantCulture);

    /// <summary>
    /// Một câu nhận xét tổng thể từ AI dựa trên số đo mới và ngưỡng giai đoạn hiện tại. Chỉ lấy câu tóm tắt; không gửi thiết bị chấp hành
    /// nên không thể sinh hành động điều khiển. Mọi lỗi/độ tin cậy thấp/nội dung bất thường đều bỏ qua nhận xét, không ảnh hưởng danh sách số đo.
    /// </summary>
    private async Task<string?> TryOverallCommentAsync(AiZoneContext context, CancellationToken cancellationToken)
    {
        const string commentQuestion = "Viết đúng MỘT câu nhận xét tổng thể (tối đa 30 từ) về tình trạng hiện tại của Zone, chỉ dựa trên các số đo mới so với ngưỡng của giai đoạn hiện tại. Không liệt kê lại số đo, không đề xuất điều khiển. Nếu thiếu ngưỡng để so sánh, nói chưa đủ căn cứ để nhận xét.";
        try
        {
            var commentContext = context with
            {
                Telemetry = context.Telemetry.Where(x => x.IsFresh).ToList(),
                TelemetryHistory = null,
                Actuators = [],
                UpcomingSchedules = [],
                RecentCommands = null,
                AutoRules = null
            };
            var result = await provider.GenerateAsync(new AiProviderRequest(commentQuestion, commentContext, null), cancellationToken);
            var text = (result.Summary ?? string.Empty).Trim();
            if (result.Confidence < settings.MinimumConfidence || text.Length is 0 or > 300 || text.Contains('<') || text.Contains('\n'))
                return null;
            return text;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Overall sensor comment was skipped because the AI provider failed.");
            return null;
        }
    }

    private static ZoneDataAnswer BuildDeviceListAnswer(QuestionIntent intent, AiZoneContext context)
    {
        var tz = context.FarmTimeZone;
        // Phạm vi do AI hiểu từ câu hỏi; không rõ thì liệt kê tất cả để không giấu thiết bị chấp hành.
        var scope = intent.DeviceScope;
        var devices = (context.ZoneDevices ?? [])
            .Where(d => scope switch
            {
                QuestionIntent.ScopeSensors => d.SensorCount > 0,
                QuestionIntent.ScopeActuators => d.ActuatorTypes.Count > 0,
                _ => true
            })
            .ToList();
        var label = scope switch
        {
            QuestionIntent.ScopeSensors => "thiết bị cảm biến",
            QuestionIntent.ScopeActuators => "thiết bị chấp hành",
            _ => "thiết bị"
        };
        if (devices.Count == 0)
            return new ZoneDataAnswer(AiRecommendationStatus.Ready, $"Zone chưa có {label}",
                $"Zone chưa có {label} nào được gán (chưa lắp hoặc chưa gán thiết bị vào Zone).", []);

        var lines = devices.Select(d =>
        {
            var sensors = d.SensorCount > 0 ? $"{d.SensorCount} cảm biến ({string.Join(", ", d.SensorTypes)})" : (d.ActuatorTypes.Count > 0 ? "node điều khiển" : "không có cảm biến");
            var actuators = d.ActuatorTypes.Count > 0 ? $"; thiết bị chấp hành: {string.Join(", ", d.ActuatorTypes.Select(ActuatorLabel))}" : string.Empty;
            // Hỏi thông tin/số đo: nêu giá trị từng thiết bị (chỉ số đo của đúng thiết bị đó); hỏi danh sách: chỉ nêu giờ số đo gần nhất.
            var last = intent.WantsDeviceDetail
                ? $"; số đo: {DeviceReadings(d, tz)}"
                : d.LatestReadings.Count > 0
                    ? $"; số đo gần nhất lúc {LocalTime(d.LatestReadings.Max(r => r.CapturedAtUtc), tz)}"
                    : "; chưa có số đo";
            return $"• {d.DeviceLabel} — trạng thái {d.Status}: {sensors}{actuators}{last}.";
        });
        var totalSensors = devices.Sum(d => d.SensorCount);
        var totalActuators = devices.Sum(d => d.ActuatorTypes.Count);
        var counts = scope switch
        {
            QuestionIntent.ScopeSensors => $"{totalSensors} cảm biến",
            QuestionIntent.ScopeActuators => $"{totalActuators} bộ chấp hành",
            _ => $"{totalSensors} cảm biến, {totalActuators} bộ chấp hành"
        };
        return new ZoneDataAnswer(AiRecommendationStatus.Ready, $"Danh sách {label} của Zone",
            $"Zone có {devices.Count} {label} ({counts}):\n{string.Join("\n", lines)}",
            ["Trạng thái là trạng thái ghi nhận trong hệ thống; chưa phải kết quả kiểm tra kết nối trực tiếp."]);
    }

    private static ZoneDataAnswer BuildWeatherAnswer(AiZoneContext context)
    {
        var w = context.Weather;
        var facts = new List<string>();
        if (w.TemperatureCelsius is { } t) facts.Add($"nhiệt độ dự báo {t.ToString("0.#", CultureInfo.InvariantCulture)}°C");
        if (!string.IsNullOrWhiteSpace(w.Summary)) facts.Add(w.Summary!);
        if (w.RainProbabilityNext6HoursMaxPercent is { } rain) facts.Add($"xác suất mưa tối đa 6 giờ tới {rain.ToString("0.#", CultureInfo.InvariantCulture)}%");
        var forecast = facts.Count > 0 ? $"Dự báo: {string.Join(", ", facts)}." : "Chưa có chi tiết dự báo.";
        var current = context.Telemetry.FirstOrDefault(x => x.IsFresh && x.ParameterCode == EnvironmentalParameterCode.Temperature);
        var measured = current is null ? string.Empty : $" Nhiệt độ đo tại Zone: {current.Value.ToString("0.#", CultureInfo.InvariantCulture)} {current.Unit}.";

        // Mức độ phù hợp chỉ đánh giá được theo ngưỡng nhiệt độ của giai đoạn hiện tại (hồ sơ sinh trưởng), không theo cảm nhận.
        var requirement = context.Requirements.FirstOrDefault(x => x.ParameterCode == EnvironmentalParameterCode.Temperature);
        if (requirement is null || w.TemperatureCelsius is null)
            return new ZoneDataAnswer(AiRecommendationStatus.InsufficientData, "Chưa đủ căn cứ để đánh giá mức độ phù hợp của thời tiết",
                $"{forecast}{measured} Chưa thể đánh giá thời tiết có phù hợp với cây hay không vì Zone chưa có ngưỡng nhiệt độ của giai đoạn sinh trưởng hiện tại" +
                (w.TemperatureCelsius is null ? " hoặc dự báo không có nhiệt độ." : "."),
                ["Thiếu ngưỡng nhiệt độ của giai đoạn hiện tại; không đánh giá mức độ phù hợp khi chưa có căn cứ."]);

        var forecastTemp = w.TemperatureCelsius.Value;
        var stage = string.IsNullOrWhiteSpace(context.GrowthStageName) ? "giai đoạn hiện tại" : $"giai đoạn {context.GrowthStageName}";
        var range = $"{requirement.MinValue.ToString("0.#", CultureInfo.InvariantCulture)}–{requirement.MaxValue.ToString("0.#", CultureInfo.InvariantCulture)} {requirement.Unit}";
        var verdict = forecastTemp < requirement.MinValue
            ? $"Nhiệt độ dự báo THẤP hơn khoảng thích hợp {range} của {stage}."
            : forecastTemp > requirement.MaxValue
                ? $"Nhiệt độ dự báo CAO hơn khoảng thích hợp {range} của {stage}."
                : $"Nhiệt độ dự báo nằm trong khoảng thích hợp {range} của {stage}.";
        var rainNote = w.RainProbabilityNext6HoursMaxPercent is >= 60m ? " Xác suất mưa cao, cần lưu ý thoát nước và bệnh nấm." : string.Empty;
        return new ZoneDataAnswer(AiRecommendationStatus.Ready, "Đánh giá thời tiết theo ngưỡng giai đoạn hiện tại",
            $"{forecast}{measured} {verdict}{rainNote}",
            ["Chỉ đánh giá theo ngưỡng nhiệt độ của hồ sơ sinh trưởng; các yếu tố khác (độ ẩm, gió, ánh sáng) chưa được đánh giá."]);
    }

    private static string ParameterLabel(EnvironmentalParameterCode parameterCode) => parameterCode switch
    {
        EnvironmentalParameterCode.Temperature => "Nhiệt độ",
        EnvironmentalParameterCode.SoilMoisture => "Độ ẩm đất",
        EnvironmentalParameterCode.AirHumidity => "Độ ẩm không khí",
        EnvironmentalParameterCode.Ph => "pH",
        EnvironmentalParameterCode.LightIntensity => "Cường độ ánh sáng",
        EnvironmentalParameterCode.Ec => "EC",
        _ => parameterCode.ToString()
    };

    private static bool HasFreshRequestedTelemetry(QuestionIntent intent, IReadOnlyList<AiTelemetryContextItem> telemetry)
    {
        var requested = intent.Parameters.ToHashSet();
        if (requested.Count == 0) return telemetry.Any(x => x.IsFresh);
        var freshCodes = telemetry.Where(x => x.IsFresh).Select(x => x.ParameterCode).ToHashSet();
        return requested.IsSubsetOf(freshCodes);
    }

    private static bool HasAnyFreshRequestedTelemetry(QuestionIntent intent, IReadOnlyList<AiTelemetryContextItem> telemetry)
    {
        var requested = intent.Parameters.ToHashSet();
        return telemetry.Any(x => x.IsFresh && (requested.Count == 0 || requested.Contains(x.ParameterCode)));
    }

    private AiRecommendation CreateLimited(AiConsultationRequest request, AiZoneContext context, AiRecommendationStatus status, string summary, string details, IEnumerable<string> limitations, DateTime now) => new()
    {
        ConsultationRequestId = request.Id, ConsultationRequest = request, TenantId = request.TenantId, FarmId = request.FarmId, ZoneId = request.ZoneId,
        GrowthStageId = context.GrowthStageId, Summary = summary, Details = details,
        Limitations = JoinLimitations(limitations), Confidence = 0, Status = status, IsActionable = false,
        ValidUntilUtc = now.AddMinutes(settings.RecommendationValidityMinutes)
    };

    private async Task EnsureRateLimitAsync(Guid ownerId, Guid zoneId, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var from = now.AddMinutes(-settings.RateLimitWindowMinutes);
        var recent = await db.AiConsultationRequests.AsNoTracking().Where(x => x.RequestedByUserId == ownerId && x.ZoneId == zoneId && x.CreatedAtUtc >= from).OrderBy(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
        if (recent.Count < settings.MaxRequestsPerWindow) return;
        var retryAt = recent[0].CreatedAtUtc.AddMinutes(settings.RateLimitWindowMinutes);
        throw new RateLimitExceededException("AI consultation rate limit exceeded for this Zone.", Math.Max(1, (int)Math.Ceiling((retryAt - now).TotalSeconds)));
    }

    private async Task<(Zone Zone, UserRole Role)> EnsureZoneAccessAsync(Guid userId, Guid tenantId, Guid zoneId, bool requireControl, CancellationToken cancellationToken)
    {
        var user = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new AuthorizationException();

        if (user.TenantId != tenantId)
            throw new AuthorizationException("User does not belong to the requested Tenant.");

        if (user.Role == UserRole.FarmOwner)
        {
            // FarmOwner has full access to all zones in their tenant
        }
        else if (user.Role == UserRole.Farmer)
        {
            var access = await db.UserZoneAccesses.AsNoTracking()
                .SingleOrDefaultAsync(x => x.AppUserId == userId && x.ZoneId == zoneId, cancellationToken);
            if (access is null)
                throw new AuthorizationException("Farmer does not have access to this Zone.");
            if (requireControl && !access.CanControl)
                throw new AuthorizationException("Farmer does not have permission to control actuators in this Zone.");
        }
        else
        {
            throw new AuthorizationException("Only Farm Owners and assigned Farmers can use AI advisory services.");
        }

        var zone = await db.Zones.AsNoTracking().Include(x => x.Field).ThenInclude(x => x.Farm)
            .SingleOrDefaultAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == tenantId, cancellationToken)
            ?? throw new ResourceNotFoundException("Zone was not found in the current Tenant.");

        return (zone, user.Role);
    }

    private async Task EnsureStageIsCurrentAsync(AiRecommendation recommendation, CancellationToken cancellationToken)
    {
        if (!recommendation.GrowthStageId.HasValue || !await db.PlantingSeasons.AsNoTracking().AnyAsync(x => x.ZoneId == recommendation.ZoneId && x.Status == PlantingSeasonStatus.InProgress && x.CurrentGrowthStageId == recommendation.GrowthStageId && x.Zone.CropId == x.CropId, cancellationToken))
            throw new ResourceConflictException("The planting season or growth stage changed; request a new analysis.");
    }

    private async Task EnsureAgronomicSafetyAsync(AiRecommendation recommendation, CancellationToken cancellationToken)
    {
        if (recommendation.ProposedAction != ActuatorCommandAction.TurnOn || !recommendation.ProposedActuatorId.HasValue)
            return;

        var actuator = await db.DeviceActuators.AsNoTracking().Include(x => x.Device)
            .SingleOrDefaultAsync(x => x.Id == recommendation.ProposedActuatorId && x.Device.ZoneId == recommendation.ZoneId, cancellationToken);
        if (actuator is null) return;

        var isPump = actuator.ActuatorType.Contains("pump", StringComparison.OrdinalIgnoreCase) ||
                     actuator.ActuatorType.Contains("water", StringComparison.OrdinalIgnoreCase) ||
                     actuator.ActuatorType.Contains("irrigation", StringComparison.OrdinalIgnoreCase);

        if (!isPump) return;

        var now = clock.GetUtcNow().UtcDateTime;

        // 1. Kiểm tra lịch tưới sắp diễn ra trong khoảng an toàn đã cấu hình
        var irrigationActuators = await db.DeviceActuators.AsNoTracking().Where(x => x.Device.ZoneId == recommendation.ZoneId)
            .Select(x => new { x.Id, x.ActuatorType }).ToListAsync(cancellationToken);
        var irrigationActuatorIds = irrigationActuators
            .Where(x => x.ActuatorType.Contains("pump", StringComparison.OrdinalIgnoreCase) ||
                        x.ActuatorType.Contains("water", StringComparison.OrdinalIgnoreCase) ||
                        x.ActuatorType.Contains("irrigation", StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Id)
            .ToArray();
        var upcomingSchedule = await db.ControlSchedules.AsNoTracking()
            .Where(x => x.ZoneId == recommendation.ZoneId && irrigationActuatorIds.Contains(x.ActuatorId) && x.IsActive && x.ArchivedAtUtc == null && x.NextRunAtUtc > now && x.NextRunAtUtc <= now.AddMinutes(IrrigationScheduleConflictWindowMinutes))
            .FirstOrDefaultAsync(cancellationToken);

        if (upcomingSchedule is not null)
        {
            var minutesUntil = (int)Math.Max(1, (upcomingSchedule.NextRunAtUtc - now).TotalMinutes);
            throw new ResourceConflictException($"Không thể duyệt tưới: Khu vực đã có lịch tưới '{upcomingSchedule.Name}' tự động kích hoạt sau {minutesUntil} phút nữa.");
        }

        // 2. Chỉ cho phép tưới khi số đo mới thấp hơn ngưỡng min của đúng Growth Profile/giai đoạn hiện tại.
        var thresholdCheck = await CheckIrrigationThresholdAsync(recommendation.ZoneId, cancellationToken);
        if (!thresholdCheck.CanIrrigate)
            throw new ResourceConflictException($"Không thể duyệt tưới: {thresholdCheck.Message}");
    }

    private sealed record IrrigationThresholdCheck(bool CanIrrigate, bool HasThreshold, bool HasFreshReading, string Message);

    private async Task<IrrigationThresholdCheck> CheckIrrigationThresholdAsync(Guid zoneId, CancellationToken cancellationToken)
    {
        var activeSeason = await db.PlantingSeasons.AsNoTracking()
            .Where(x => x.ZoneId == zoneId && x.Status == PlantingSeasonStatus.InProgress)
            .Select(x => new
            {
                x.CropId,
                CropName = x.Crop.Name,
                x.VarietyId,
                x.GrowthProfileId,
                ProfileCropId = x.GrowthProfile.CropId,
                ProfileVarietyId = x.GrowthProfile.VarietyId,
                x.CurrentGrowthStageId,
                StageProfileId = x.CurrentGrowthStage.GrowthProfileId,
                StageName = x.CurrentGrowthStage.Name
            })
            .SingleOrDefaultAsync(cancellationToken);

        var zoneCrop = await db.Zones.AsNoTracking().Where(x => x.Id == zoneId).Select(x => new { x.CropId, x.CropVarietyId }).SingleOrDefaultAsync(cancellationToken);
        if (activeSeason is not null && (zoneCrop?.CropId is null || zoneCrop.CropId != activeSeason.CropId ||
            (zoneCrop.CropVarietyId is not null && activeSeason.VarietyId is not null && zoneCrop.CropVarietyId != activeSeason.VarietyId)))
        {
            return new(false, false, false, "Cây của Zone không khớp với cây của vụ đang canh tác nên không dùng ngưỡng của vụ này.");
        }

        if (activeSeason is null || activeSeason.ProfileCropId != activeSeason.CropId ||
            activeSeason.ProfileVarietyId != activeSeason.VarietyId || activeSeason.StageProfileId != activeSeason.GrowthProfileId)
        {
            return new(false, false, false, "Zone chưa có vụ đang canh tác với Growth Profile và giai đoạn khớp cây trồng.");
        }

        var requirement = await db.EnvironmentalRequirements.AsNoTracking()
            .Where(x => x.GrowthStageId == activeSeason.CurrentGrowthStageId &&
                        x.GrowthStage.GrowthProfileId == activeSeason.GrowthProfileId &&
                        x.ParameterCode == EnvironmentalParameterCode.SoilMoisture)
            .Select(x => new { x.MinValue, x.MaxValue, x.TargetValue, x.Unit })
            .SingleOrDefaultAsync(cancellationToken);

        if (requirement is null)
        {
            return new(false, false, false,
                $"Growth Profile của {activeSeason.CropName}, giai đoạn {activeSeason.StageName}, chưa cấu hình ngưỡng độ ẩm đất.");
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var cutoff = now.AddMinutes(-settings.TelemetryFreshnessMinutes);
        var reading = await db.TelemetryReadings.AsNoTracking()
            .Where(x => x.ZoneId == zoneId && x.Device.ZoneId == zoneId && x.ParameterCode == EnvironmentalParameterCode.SoilMoisture &&
                        x.CapturedAtUtc >= cutoff && x.CapturedAtUtc <= now)
            .OrderByDescending(x => x.CapturedAtUtc)
            .ThenByDescending(x => x.ReceivedAtUtc)
            .Select(x => new { x.Value, x.Unit })
            .FirstOrDefaultAsync(cancellationToken);

        if (reading is null)
        {
            return new(false, true, false, "Không có số đo độ ẩm đất còn mới để đối chiếu với Growth Profile.");
        }

        if (!NormalizeTelemetryUnit(reading.Unit).Equals(NormalizeTelemetryUnit(requirement.Unit), StringComparison.OrdinalIgnoreCase))
        {
            return new(false, true, true,
                $"Đơn vị cảm biến ({reading.Unit}) không khớp đơn vị ngưỡng trong Growth Profile ({requirement.Unit}).");
        }

        if (reading.Value >= requirement.MaxValue)
        {
            return new(false, true, true,
                $"Độ ẩm đất hiện tại {reading.Value:0.##} {requirement.Unit} đã chạm/vượt ngưỡng tối đa {requirement.MaxValue:0.##} {requirement.Unit} của Growth Profile giai đoạn {activeSeason.StageName}; không tưới.");
        }

        if (reading.Value >= requirement.MinValue)
        {
            return new(false, true, true,
                $"Độ ẩm đất hiện tại {reading.Value:0.##} {requirement.Unit} chưa thấp hơn ngưỡng tối thiểu {requirement.MinValue:0.##} {requirement.Unit} của Growth Profile giai đoạn {activeSeason.StageName}; chưa cần tưới.");
        }

        return new(true, true, true,
            $"Độ ẩm đất hiện tại {reading.Value:0.##} {requirement.Unit} thấp hơn ngưỡng tối thiểu {requirement.MinValue:0.##} {requirement.Unit} của Growth Profile giai đoạn {activeSeason.StageName}; đủ điều kiện xem xét tưới.");
    }

    private static string NormalizeTelemetryUnit(string unit) =>
        unit.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).Replace("percent", "%", StringComparison.OrdinalIgnoreCase);

    private static bool IsSoilMoistureThresholdEvidence(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return false;
        var normalized = content.ToLowerInvariant();
        var mentionsSoilMoisture = normalized.Contains("ẩm đất") || normalized.Contains("soil moisture");
        var hasPercentRange = Regex.IsMatch(normalized, @"\d+(?:[.,]\d+)?\s*%");
        return mentionsSoilMoisture && hasPercentRange;
    }

    private async Task EnsureActionTelemetryIsFreshAsync(AiRecommendation recommendation, CancellationToken cancellationToken)
    {
        var actuator = await db.DeviceActuators.AsNoTracking().Include(x => x.Device)
            .SingleOrDefaultAsync(x => x.Id == recommendation.ProposedActuatorId && x.Device.ZoneId == recommendation.ZoneId, cancellationToken);
        if (actuator is null) throw new ResourceConflictException("The recommended actuator is no longer available in this Zone.");

        var isIrrigationPump = actuator.ActuatorType.Contains("pump", StringComparison.OrdinalIgnoreCase) ||
                               actuator.ActuatorType.Contains("water", StringComparison.OrdinalIgnoreCase) ||
                               actuator.ActuatorType.Contains("irrigation", StringComparison.OrdinalIgnoreCase);
        if (!isIrrigationPump || recommendation.ProposedAction != ActuatorCommandAction.TurnOn) return;

        var now = clock.GetUtcNow().UtcDateTime;
        var cutoff = now.AddMinutes(-settings.TelemetryFreshnessMinutes);
        var hasFreshSoilMoisture = await db.TelemetryReadings.AsNoTracking().AnyAsync(x =>
            x.ZoneId == recommendation.ZoneId && x.Device.ZoneId == recommendation.ZoneId &&
            x.ParameterCode == EnvironmentalParameterCode.SoilMoisture && x.CapturedAtUtc >= cutoff && x.CapturedAtUtc <= now,
            cancellationToken);
        if (!hasFreshSoilMoisture)
            throw new ResourceConflictException("Soil-moisture telemetry is stale. Request a new analysis after a fresh sensor reading arrives.");
    }

    private void ValidateAcceptable(AiRecommendation recommendation)
    {
        if (recommendation.Status != AiRecommendationStatus.Ready || !recommendation.IsActionable || recommendation.Confidence < settings.MinimumConfidence || !recommendation.ProposedActuatorId.HasValue || !recommendation.ProposedAction.HasValue || !recommendation.ProposedDurationSeconds.HasValue)
            throw new ResourceConflictException("Recommendation is not actionable or does not meet the confidence threshold.");
        if (recommendation.ValidUntilUtc <= clock.GetUtcNow().UtcDateTime)
            throw new ResourceConflictException("Recommendation has expired; request a new analysis.");
    }

    private static void RejectPromptInjection(string question)
    {
        // Loại bỏ các ký tự ẩn độ rộng bằng 0 và ký tự điều khiển Unicode trước khi kiểm tra để chống vượt rào lọc
        var sanitized = question
            .Replace("\u200B", "") // Zero-Width Space
            .Replace("\u200C", "") // Zero-Width Non-Joiner
            .Replace("\u200D", "") // Zero-Width Joiner
            .Replace("\uFEFF", "") // Byte Order Mark
            .Replace("\u00AD", "") // Soft Hyphen
            .ToLowerInvariant();

        string[] blocked = [
            "ignore previous instructions", 
            "ignore all instructions", 
            "system prompt", 
            "developer message", 
            "bỏ qua hướng dẫn trước",
            "bỏ qua quy tắc",
            "bỏ qua các chỉ thị",
            "tiết lộ prompt",
            "tiết lộ system prompt",
            "bỏ qua luật an toàn",
            "bỏ qua mệnh lệnh trước",
            "jailbreak"
        ];
        if (question.IndexOf('\0') >= 0 || blocked.Any(sanitized.Contains))
            throw new RequestValidationException("question", "Question contains instruction-manipulation content and was not sent to the AI provider.");
    }

    private static string Required(string? value, string field, int max, int min)
    {
        var result = value?.Trim();
        if (string.IsNullOrWhiteSpace(result) || result.Length < min || result.Length > max)
            throw new RequestValidationException(field, $"{field} must contain between {min} and {max} characters.");
        return result;
    }

    private static string Truncate(string? value, int max)
    {
        var result = value?.Trim();
        if (string.IsNullOrWhiteSpace(result)) return string.Empty;
        return result.Length <= max ? result : result[..max];
    }

    private static string? Optional(string? value, int max)
    {
        var result = value?.Trim();
        if (string.IsNullOrEmpty(result)) return null;
        return result.Length <= max ? result : result[..max];
    }

    private static string SafeProviderFailure(Exception exception) => $"External provider unavailable ({exception.GetType().Name}); no values were fabricated.";
    private static string? JoinLimitations(IEnumerable<string> limitations)
    {
        var value = string.Join(" | ", limitations.Where(x => !string.IsNullOrWhiteSpace(x)));
        if (value.Length == 0) return null;
        return value.Length <= 2000 ? value : value[..2000];
    }
    private static IReadOnlyList<string> ParseLimitations(string? value) => string.IsNullOrWhiteSpace(value) ? [] : value.Split(" | ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    private static IReadOnlyList<AiSourceView> ParseSources(string? sourcesJson, string? legacySnapshotJson)
    {
        if (!string.IsNullOrWhiteSpace(sourcesJson) && sourcesJson != "[]")
        {
            try
            {
                var list = JsonSerializer.Deserialize<List<AiSourceView>>(sourcesJson, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                if (list is { Count: > 0 }) return list;
            }
            catch { }
        }

        if (!string.IsNullOrWhiteSpace(legacySnapshotJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(legacySnapshotJson);
                if (doc.RootElement.TryGetProperty("Sources", out var sProp) && sProp.ValueKind == JsonValueKind.Array)
                {
                    return sProp.EnumerateArray()
                        .Select(e => e.GetString())
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Select(s => new AiSourceView(Guid.Empty, s!, null, "VietGAP", 0.0f))
                        .ToList();
                }
            }
            catch { }
        }

        return [];
    }

    private static AiRecommendationView ToView(AiRecommendation x) => new(
        x.Id, x.ConsultationRequestId, x.ZoneId, x.ConsultationRequest?.Question ?? string.Empty,
        x.Summary, x.Details, ParseLimitations(x.Limitations), x.Confidence,
        x.Status, x.IsActionable, x.ValidUntilUtc, x.ProposedActuatorId,
        x.ProposedAction, x.ProposedDurationSeconds, x.CreatedAtUtc,
        ParseSources(x.SourcesJson, x.ConsultationRequest?.ContextSnapshotJson),
        null); // Không rò rỉ prompt XML nội bộ và system instruction cho client
    private static AiDecisionView ToView(AiRecommendationDecision x) => new(x.Id, x.RecommendationId, x.DecisionType, x.Reason, x.CreatedAtUtc, x.ActuatorCommandId, x.FollowUpConsultationId);
}
