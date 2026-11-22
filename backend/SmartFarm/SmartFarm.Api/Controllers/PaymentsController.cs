using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Finance;

namespace SmartFarm.Api.Controllers;

[ApiController]
public sealed class PaymentsController(IPayOSService payOSService) : ControllerBase
{
    /// <summary>Lấy thông tin cấu hình cổng thanh toán PayOS (Chỉ Admin)</summary>
    [HttpGet("api/v1/payments/payos/config")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<PayOSConfigView>> GetConfig(CancellationToken ct)
    {
        return Ok(await payOSService.GetConfigAsync(ct));
    }

    /// <summary>Cập nhật thông tin cấu hình PayOS (Chỉ Admin)</summary>
    [HttpPut("api/v1/payments/payos/config")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<PayOSConfigView>> UpdateConfig(
        [FromBody] UpdatePayOSConfigCommand command,
        CancellationToken ct)
    {
        return Ok(await payOSService.UpdateConfigAsync(command, User.GetUserId(), ct));
    }

    /// <summary>Kiểm tra kết nối và tính hợp lệ của tài khoản PayOS (Chỉ Admin)</summary>
    [HttpPost("api/v1/payments/payos/test-connection")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<PayOSTestResult>> TestConnection(CancellationToken ct)
    {
        return Ok(await payOSService.TestConnectionAsync(ct));
    }

    /// <summary>Đăng ký xác nhận Webhook URL với PayOS (Chỉ Admin)</summary>
    [HttpPost("api/v1/payments/payos/confirm-webhook")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult> ConfirmWebhook(
        [FromBody] ConfirmWebhookCommand command,
        CancellationToken ct)
    {
        await payOSService.ConfirmWebhookUrlAsync(command.WebhookUrl, ct);
        return Ok(new { success = true, message = "Đã xác nhận Webhook URL với PayOS thành công!" });
    }

    /// <summary>Tạo liên kết và mã QR thanh toán PayOS cho Hóa đơn (FarmOwner, PlatformAdmin, PlatformTechnician)</summary>
    [HttpPost("api/v1/payments/payos/create-bill-payment/{billId:guid}")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<PayOSPaymentLinkResult>> CreateBillPayment(
        Guid billId,
        [FromBody] CreateBillPaymentCommand command,
        CancellationToken ct)
    {
        var result = await payOSService.CreateBillPaymentLinkAsync(
            billId,
            command.Amount,
            User.GetUserId(),
            command.ReturnUrl,
            command.CancelUrl,
            ct);
        return Ok(result);
    }

    /// <summary>Kiểm tra trạng thái thanh toán từ PayOS theo OrderCode và tự động đồng bộ hóa đơn (FarmOwner, PlatformAdmin, PlatformTechnician)</summary>
    [HttpGet("api/v1/payments/payos/check-status/{orderCode:long}")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<PayOSPaymentStatusResult>> CheckStatus(
        long orderCode,
        CancellationToken ct)
    {
        var result = await payOSService.CheckPaymentStatusAsync(orderCode, ct);
        return Ok(result);
    }

    /// <summary>Xác nhận thanh toán thủ công khi ngân hàng/PayOS đồng bộ chậm hoặc test localhost (FarmOwner, PlatformAdmin, PlatformTechnician)</summary>
    [HttpPost("api/v1/payments/payos/confirm-manual/{orderCode:long}")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<PayOSPaymentStatusResult>> ConfirmManualPayment(
        long orderCode,
        CancellationToken ct)
    {
        var result = await payOSService.ConfirmManualPaymentAsync(orderCode, User.GetUserId(), ct);
        return Ok(result);
    }

    /// <summary>Webhook nhận thông báo thanh toán thành công tự động từ PayOS</summary>
    [HttpPost("api/v1/payments/payos/webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> Webhook(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var rawJson = await reader.ReadToEndAsync(ct);
        var success = await payOSService.ProcessWebhookAsync(rawJson, ct);
        return Ok(new { success, message = success ? "Webhook processed" : "Webhook verification failed or ignored" });
    }

    /// <summary>Lịch sử các giao dịch PayOS theo hóa đơn</summary>
    [HttpGet("api/v1/payments/payos/transactions/{billId:guid}")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<PayOSTransactionView>>> GetTransactions(
        Guid billId,
        CancellationToken ct)
    {
        var result = await payOSService.GetTransactionsByBillIdAsync(billId, ct);
        return Ok(result);
    }
}

public sealed record ConfirmWebhookCommand(string WebhookUrl);
