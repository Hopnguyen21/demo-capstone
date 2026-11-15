using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.IoTDeployment;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/integrations/github/firmware")]
public sealed class FirmwareIntegrationController(IIoTDeploymentService service, IConfiguration configuration, HttpClient httpClient) : ControllerBase
{
    [HttpPost("sync")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<FirmwareReleaseView>>> Sync(CancellationToken ct)
    {
        var repository = configuration["FirmwareGitHub:Repository"];
        if (string.IsNullOrWhiteSpace(repository)) return Problem("FirmwareGitHub:Repository is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.github.com/repos/{repository}/releases?per_page=20");
        request.Headers.UserAgent.ParseAdd("SmartFarm-Firmware-Sync/1.0");
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        var token = configuration["FirmwareGitHub:Token"] ?? configuration["GITHUB_TOKEN"];
        if (!string.IsNullOrWhiteSpace(token)) request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        using var response = await httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            // GitHub's unauthenticated API is rate-limited. Keep the manual sync button
            // useful by falling back to the public latest-release HTML page; webhook/API
            // remains the preferred path and still supplies full metadata when available.
            var fallback = await ImportLatestPublicReleaseAsync(repository, ct);
            if (fallback.Count > 0) return Ok(fallback);
            return StatusCode((int)response.StatusCode, new { detail = "GitHub Releases could not be read. Configure FirmwareGitHub:Token/GITHUB_TOKEN." });
        }
        var releases = await JsonSerializer.DeserializeAsync<List<GitHubReleaseListItem>>(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct) ?? [];
        var imported = new List<FirmwareReleaseView>();
        foreach (var release in releases.Where(x => !x.Draft && !x.Prerelease && !string.IsNullOrWhiteSpace(x.TagName)))
        {
            var command = new GitHubReleaseWebhookCommand(
                $"https://github.com/{repository}", release.TagName!, release.TargetCommitish ?? string.Empty,
                release.Name, release.Body, release.PublishedAt,
                (release.Assets ?? []).Where(x => !string.IsNullOrWhiteSpace(x.Name) && !string.IsNullOrWhiteSpace(x.BrowserDownloadUrl))
                    .Select(x => new GitHubReleaseAssetInput(x.Name!, x.BrowserDownloadUrl!)).ToList());
            imported.AddRange(await service.ImportGitHubReleaseAsync(command, ct));
        }
        return Ok(imported);
    }

    private async Task<IReadOnlyList<FirmwareReleaseView>> ImportLatestPublicReleaseAsync(string repository, CancellationToken ct)
    {
        using var latest = await httpClient.GetAsync($"https://github.com/{repository}/releases/latest", ct);
        if (!latest.IsSuccessStatusCode || latest.RequestMessage?.RequestUri is null) return [];
        var tagMatch = Regex.Match(latest.RequestMessage.RequestUri.AbsolutePath, @"/releases/tag/(?<tag>[^/]+)$", RegexOptions.IgnoreCase);
        if (!tagMatch.Success) return [];
        var tag = Uri.UnescapeDataString(tagMatch.Groups["tag"].Value);
        var expanded = await httpClient.GetStringAsync($"https://github.com/{repository}/releases/expanded_assets/{Uri.EscapeDataString(tag)}", ct);
        var assets = Regex.Matches(expanded, @"href=""(?<url>/[^""]+/releases/download/[^""]+)""", RegexOptions.IgnoreCase)
            .Select(m => WebUtility.HtmlDecode(m.Groups["url"].Value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(url => new GitHubReleaseAssetInput(Path.GetFileName(new Uri("https://github.com" + url).AbsolutePath), "https://github.com" + url))
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) && !x.Name.Equals("Source", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (assets.Count == 0) return [];
        // Public release pages do not expose a dependable commit SHA without the
        // GitHub API. Preserve the tag as provenance for this fallback.
        return await service.ImportGitHubReleaseAsync(new GitHubReleaseWebhookCommand($"https://github.com/{repository}", tag, tag, tag, "Imported from public GitHub release page.", DateTime.UtcNow, assets), ct);
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    [IgnoreAntiforgeryToken]
    public async Task<ActionResult<IReadOnlyList<FirmwareReleaseView>>> GitHubWebhook(CancellationToken ct)
    {
        var secret = configuration["FirmwareGitHub:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(secret)) return Problem("FirmwareGitHub:WebhookSecret is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
        var raw = await reader.ReadToEndAsync(ct);
        Request.Body.Position = 0;
        var signature = Request.Headers["X-Hub-Signature-256"].ToString();
        if (!VerifySignature(raw, signature, secret)) return Unauthorized();
        if (!string.Equals(Request.Headers["X-GitHub-Event"].ToString(), "release", StringComparison.OrdinalIgnoreCase)) return Ok(Array.Empty<FirmwareReleaseView>());
        GitHubReleasePayload? payload;
        try { payload = JsonSerializer.Deserialize<GitHubReleasePayload>(raw); }
        catch (JsonException) { return BadRequest(new { detail = "GitHub payload is invalid JSON." }); }
        if (payload is null || payload.Action is not ("published" or "released")) return Ok(Array.Empty<FirmwareReleaseView>());
        var command = new GitHubReleaseWebhookCommand(
            payload.Repository?.HtmlUrl ?? string.Empty,
            payload.Release?.TagName ?? string.Empty,
            payload.Release?.TargetCommitish ?? string.Empty,
            payload.Release?.Name,
            payload.Release?.Body,
            payload.Release?.PublishedAt,
            (payload.Release?.Assets ?? []).Where(x => !string.IsNullOrWhiteSpace(x.Name) && !string.IsNullOrWhiteSpace(x.BrowserDownloadUrl)).Select(x => new GitHubReleaseAssetInput(x.Name!, x.BrowserDownloadUrl!)).ToList());
        return Ok(await service.ImportGitHubReleaseAsync(command, ct));
    }

    private static bool VerifySignature(string body, string header, string secret)
    {
        if (!header.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase)) return false;
        var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
        var supplied = header[7..].Trim().ToLowerInvariant();
        return supplied.Length == expected.Length && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(supplied));
    }

    private sealed class GitHubReleasePayload
    {
        [JsonPropertyName("action")] public string? Action { get; init; }
        [JsonPropertyName("release")] public GitHubRelease? Release { get; init; }
        [JsonPropertyName("repository")] public GitHubRepository? Repository { get; init; }
    }
    private sealed class GitHubRelease
    {
        [JsonPropertyName("tag_name")] public string? TagName { get; init; }
        [JsonPropertyName("target_commitish")] public string? TargetCommitish { get; init; }
        [JsonPropertyName("name")] public string? Name { get; init; }
        [JsonPropertyName("body")] public string? Body { get; init; }
        [JsonPropertyName("published_at")] public DateTime? PublishedAt { get; init; }
        [JsonPropertyName("assets")] public List<GitHubAsset>? Assets { get; init; }
    }
    private sealed class GitHubAsset
    {
        [JsonPropertyName("name")] public string? Name { get; init; }
        [JsonPropertyName("browser_download_url")] public string? BrowserDownloadUrl { get; init; }
    }
    private sealed class GitHubRepository
    {
        [JsonPropertyName("html_url")] public string? HtmlUrl { get; init; }
    }
    private sealed class GitHubReleaseListItem
    {
        [JsonPropertyName("tag_name")] public string? TagName { get; init; }
        [JsonPropertyName("target_commitish")] public string? TargetCommitish { get; init; }
        [JsonPropertyName("name")] public string? Name { get; init; }
        [JsonPropertyName("body")] public string? Body { get; init; }
        [JsonPropertyName("published_at")] public DateTime? PublishedAt { get; init; }
        [JsonPropertyName("draft")] public bool Draft { get; init; }
        [JsonPropertyName("prerelease")] public bool Prerelease { get; init; }
        [JsonPropertyName("assets")] public List<GitHubAsset>? Assets { get; init; }
    }
}
