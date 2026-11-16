using System.Net;
using System.Text.RegularExpressions;
using System.Text.Json;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.IoTDeployment;

namespace SmartFarm.Api.HostedServices;

public sealed class FirmwareReleaseReconciliationWorker(
    IServiceScopeFactory scopeFactory,
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<FirmwareReleaseReconciliationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await SyncOnceAsync(stoppingToken);
        // Keep the registry responsive after a GitHub release even when the
        // webhook cannot reach a local development backend. The sync is
        // idempotent, so a short interval is safe and avoids a stale UI window.
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken)) await SyncOnceAsync(stoppingToken);
    }

    private async Task SyncOnceAsync(CancellationToken ct)
    {
        var repository = configuration["FirmwareGitHub:Repository"];
        if (string.IsNullOrWhiteSpace(repository)) return;
        try
        {
            var client = httpClient;
            client.DefaultRequestHeaders.UserAgent.ParseAdd("SmartFarm-Firmware-Reconciler/1.0");
            var token = configuration["FirmwareGitHub:Token"] ?? configuration["GITHUB_TOKEN"];
            if (!string.IsNullOrWhiteSpace(token))
            {
                client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
            }
            using var response = await client.GetAsync($"https://api.github.com/repos/{repository}/releases?per_page=10", ct);
            if (!response.IsSuccessStatusCode)
            {
                await SyncLatestPublicReleaseAsync(repository, ct);
                return;
            }
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            using var scope = scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IIoTDeploymentService>();
            foreach (var release in document.RootElement.EnumerateArray())
            {
                if (release.GetProperty("draft").GetBoolean() || release.GetProperty("prerelease").GetBoolean()) continue;
                var assets = release.GetProperty("assets").EnumerateArray()
                    .Select(x => new GitHubReleaseAssetInput(x.GetProperty("name").GetString() ?? "", x.GetProperty("browser_download_url").GetString() ?? ""))
                    .ToList();
                var command = new GitHubReleaseWebhookCommand(
                    $"https://github.com/{repository}",
                    release.GetProperty("tag_name").GetString() ?? "",
                    release.GetProperty("target_commitish").GetString() ?? "",
                    release.GetProperty("name").GetString(),
                    release.GetProperty("body").GetString(),
                    release.GetProperty("published_at").ValueKind == JsonValueKind.Null ? null : release.GetProperty("published_at").GetDateTime(),
                    assets);
                var imported = await service.ImportGitHubReleaseAsync(command, ct);
                if (imported.Count > 0) logger.LogInformation("Firmware reconciliation imported {Count} release records for {Tag}.", imported.Count, command.Tag);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex) { logger.LogError(ex, "Firmware release reconciliation failed; will retry later."); }
    }

    private async Task SyncLatestPublicReleaseAsync(string repository, CancellationToken ct)
    {
        using var latest = await httpClient.GetAsync($"https://github.com/{repository}/releases/latest", ct);
        var target = latest.RequestMessage?.RequestUri?.AbsolutePath ?? string.Empty;
        var tagMatch = Regex.Match(target, @"/releases/tag/(?<tag>[^/]+)$", RegexOptions.IgnoreCase);
        if (!latest.IsSuccessStatusCode || !tagMatch.Success) return;
        var tag = Uri.UnescapeDataString(tagMatch.Groups["tag"].Value);
        var expanded = await httpClient.GetStringAsync($"https://github.com/{repository}/releases/expanded_assets/{Uri.EscapeDataString(tag)}", ct);
        var assets = Regex.Matches(expanded, @"href=""(?<url>/[^""]+/releases/download/[^""]+)""", RegexOptions.IgnoreCase)
            .Select(m => WebUtility.HtmlDecode(m.Groups["url"].Value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(url => new GitHubReleaseAssetInput(Path.GetFileName(new Uri("https://github.com" + url).AbsolutePath), "https://github.com" + url))
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) && !x.Name.Equals("Source", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (assets.Count == 0) return;
        using var scope = scopeFactory.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IIoTDeploymentService>();
        // Public release pages do not expose a dependable commit SHA without the
        // GitHub API. Preserve the tag as provenance for this fallback; webhook
        // and API imports still store the real SHA when available.
        var command = new GitHubReleaseWebhookCommand($"https://github.com/{repository}", tag, tag, tag, "Imported from public GitHub release page.", DateTime.UtcNow, assets);
        var imported = await service.ImportGitHubReleaseAsync(command, ct);
        if (imported.Count > 0) logger.LogInformation("Firmware reconciliation fallback imported {Count} release records for {Tag}.", imported.Count, tag);
    }
}
