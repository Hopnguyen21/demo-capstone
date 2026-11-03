using SmartFarm.Infrastructure.Ai.Knowledge;

namespace SmartFarm.Api.HostedServices;

public sealed class KnowledgeEmbeddingWorker(
    IServiceScopeFactory scopes,
    ILogger<KnowledgeEmbeddingWorker> logger) : BackgroundService
{
    // Mỗi bước dùng một scope (DbContext) riêng: bước lỗi để lại thực thể đang theo dõi dở thì không làm hỏng bước kế tiếp.
    private async Task RunStepAsync(string name, Func<AgricultureDocumentService, Task> step, CancellationToken stoppingToken)
    {
        try
        {
            using var scope = scopes.CreateScope();
            await step(scope.ServiceProvider.GetRequiredService<AgricultureDocumentService>());
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { throw; }
        catch (Exception exception) { logger.LogError(exception, "Background agriculture knowledge step '{Step}' failed.", name); }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // AI rà soát tài liệu là việc người dùng đang chờ trên màn hình nên chạy TRƯỚC; mỗi bước có try/catch riêng để
            // lỗi embedding (hết quota, tranh chấp dữ liệu) không chặn việc rà soát, và ngược lại.
            await RunStepAsync("verification", async documents =>
            {
                if (await documents.ProcessPendingVerificationAsync(stoppingToken))
                    logger.LogInformation("Processed one pending agriculture document verification.");
            }, stoppingToken);
            await RunStepAsync("legacy hash/chunks", async documents =>
            {
                // Tài liệu cũ chưa có hash nội dung: tính để chống tải trùng áp dụng cho toàn kho.
                var hashed = await documents.ProcessMissingHashesAsync(stoppingToken);
                if (hashed > 0)
                    logger.LogInformation("Computed content hash for {Count} legacy agriculture documents.", hashed);
                // Tài liệu nạp trước khi có chia theo mục/trang được chia lại tự động (một tài liệu mỗi chu kỳ).
                if (await documents.ProcessLegacyChunksAsync(stoppingToken))
                    logger.LogInformation("Re-chunked one legacy agriculture document.");
            }, stoppingToken);
            await RunStepAsync("embeddings", async documents =>
            {
                var embedded = await documents.ProcessPendingEmbeddingsAsync(stoppingToken);
                if (embedded > 0)
                    logger.LogInformation("Processed {Count} pending agriculture knowledge embeddings.", embedded);
            }, stoppingToken);
        }
    }
}
