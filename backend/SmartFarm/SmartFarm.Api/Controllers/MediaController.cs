using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;

namespace SmartFarm.Api.Controllers;

[ApiController]
public sealed class MediaController(ICloudinaryService cloudinaryService) : ControllerBase
{
    /// <summary>Lấy thông tin cấu hình lưu trữ Cloudinary (Chỉ Admin)</summary>
    [HttpGet("api/v1/media/cloudinary/config")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<CloudinaryConfigView>> GetConfig(CancellationToken ct)
    {
        return Ok(await cloudinaryService.GetConfigAsync(ct));
    }

    /// <summary>Cập nhật thông tin cấu hình Cloudinary (Chỉ Admin)</summary>
    [HttpPut("api/v1/media/cloudinary/config")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<CloudinaryConfigView>> UpdateConfig(
        [FromBody] UpdateCloudinaryConfigCommand command,
        CancellationToken ct)
    {
        return Ok(await cloudinaryService.UpdateConfigAsync(command, User.GetUserId(), ct));
    }

    /// <summary>Kiểm tra kết nối và tính hợp lệ của tài khoản Cloudinary (Chỉ Admin)</summary>
    [HttpPost("api/v1/media/cloudinary/test-connection")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<CloudinaryTestResult>> TestConnection(CancellationToken ct)
    {
        return Ok(await cloudinaryService.TestConnectionAsync(ct));
    }

    /// <summary>Upload file (hình ảnh, tài liệu) lên Cloudinary</summary>
    [HttpPost("api/v1/media/upload")]
    [Authorize]
    public async Task<ActionResult<CloudinaryUploadResult>> Upload(
        [FromForm] UploadMediaRequest request,
        CancellationToken ct)
    {
        if (request.File == null || request.File.Length == 0)
        {
            throw new RequestValidationException("file", "Vui lòng chọn tệp tin cần tải lên.");
        }

        // Limit file size (max 20MB)
        if (request.File.Length > 20 * 1024 * 1024)
        {
            throw new RequestValidationException("file", "Dung lượng tệp không được vượt quá 20MB.");
        }

        using var stream = request.File.OpenReadStream();
        var result = await cloudinaryService.UploadAsync(
            stream,
            request.File.FileName,
            request.File.ContentType,
            request.Folder,
            ct);

        return Ok(result);
    }

    /// <summary>Upload dữ liệu ảnh Base64 lên Cloudinary</summary>
    [HttpPost("api/v1/media/upload-base64")]
    [Authorize]
    public async Task<ActionResult<CloudinaryUploadResult>> UploadBase64(
        [FromBody] UploadBase64MediaRequest request,
        CancellationToken ct)
    {
        var result = await cloudinaryService.UploadBase64Async(
            request.Base64Data,
            request.FileName,
            request.Folder,
            ct);

        return Ok(result);
    }
}

public sealed class UploadMediaRequest
{
    public IFormFile File { get; set; } = null!;
    public string? Folder { get; set; }
}

public sealed record UploadBase64MediaRequest(
    string Base64Data,
    string? FileName,
    string? Folder);
