using SmartFarm.Infrastructure.Ai.Knowledge;

namespace SmartFarm.Api.HostedServices;

public sealed class KnowledgeEmbeddingWorker(
    IServiceScopeFactory scopes,
    ILogger<KnowledgeEmbeddingWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var documents = scope.ServiceProvider.GetRequiredService<AgricultureDocumentService>();
                // Tài liệu cũ chưa có hash nội dung: tính để chống tải trùng áp dụng cho toàn kho.
                var hashed = await documents.ProcessMissingHashesAsync(stoppingToken);
                if (hashed > 0)
                    logger.LogInformation("Computed content hash for {Count} legacy agriculture documents.", hashed);
                // Tài liệu nạp trước khi có chia theo mục/trang được chia lại tự động (một tài liệu mỗi chu kỳ).
                if (await documents.ProcessLegacyChunksAsync(stoppingToken))
                    logger.LogInformation("Re-chunked one legacy agriculture document.");
                var embedded = await documents.ProcessPendingEmbeddingsAsync(stoppingToken);
                if (embedded > 0)
                    logger.LogInformation("Processed {Count} pending agriculture knowledge embeddings.", embedded);
                // AI rà soát đối chiếu nguồn quy chuẩn đã xác minh chạy nền để request tải lên không phải chờ AI.
                if (await documents.ProcessPendingVerificationAsync(stoppingToken))
                    logger.LogInformation("Processed one pending agriculture document verification.");
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Background agriculture knowledge embedding cycle failed.");
            }
        }
    }
}
