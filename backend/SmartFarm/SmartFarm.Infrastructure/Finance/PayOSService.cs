using System.Globalization;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;

namespace SmartFarm.Infrastructure.Finance;

public sealed class PayOSService(
    SmartFarmDbContext db,
    IConfiguration configuration,
    HttpClient httpClient,
    ILogger<PayOSService> logger) : IPayOSService
{
    private const string PayOSBaseUrl = "https://api-merchant.payos.vn";
    private string SigningKey => configuration["Jwt:SigningKey"] ?? "smartfarm-default-super-secret-jwt-signing-key-minimum-32-chars";

    private async Task<(string ClientId, string ApiKey, string ChecksumKey)> GetCredentialsAsync(CancellationToken ct)
    {
        var settings = await db.PlatformSettings.AsNoTracking()
            .Where(x => x.Key == PlatformSettingKeys.PayOSClientId
                     || x.Key == PlatformSettingKeys.PayOSApiKey
                     || x.Key == PlatformSettingKeys.PayOSChecksumKey)
            .ToListAsync(ct);

        var clientId = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.PayOSClientId)?.Value?.Trim() ?? "";
        var apiKeyStored = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.PayOSApiKey)?.Value?.Trim() ?? "";
        var checksumStored = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.PayOSChecksumKey)?.Value?.Trim() ?? "";

        var apiKey = SecretProtector.IsProtected(apiKeyStored)
            ? SecretProtector.TryUnprotect(apiKeyStored, SigningKey) ?? ""
            : apiKeyStored;

        var checksumKey = SecretProtector.IsProtected(checksumStored)
            ? SecretProtector.TryUnprotect(checksumStored, SigningKey) ?? ""
            : checksumStored;

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(checksumKey))
        {
            throw new RequestValidationException("PayOS", "Cổng thanh toán PayOS chưa được cấu hình. Quản trị viên vui lòng vào phần Cài đặt Platform để nhập Client ID, API Key và Checksum Key.");
        }

        return (clientId, apiKey, checksumKey);
    }

    public async Task<PayOSConfigView> GetConfigAsync(CancellationToken ct)
    {
        var settings = await db.PlatformSettings.AsNoTracking()
            .Where(x => x.Key == PlatformSettingKeys.PayOSClientId
                     || x.Key == PlatformSettingKeys.PayOSApiKey
                     || x.Key == PlatformSettingKeys.PayOSChecksumKey)
            .ToListAsync(ct);

        var clientId = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.PayOSClientId)?.Value?.Trim() ?? "";
        var apiKeyStored = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.PayOSApiKey)?.Value?.Trim() ?? "";
        var checksumStored = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.PayOSChecksumKey)?.Value?.Trim() ?? "";

        var apiKeyPlain = SecretProtector.IsProtected(apiKeyStored)
            ? SecretProtector.TryUnprotect(apiKeyStored, SigningKey) ?? ""
            : apiKeyStored;

        var checksumPlain = SecretProtector.IsProtected(checksumStored)
            ? SecretProtector.TryUnprotect(checksumStored, SigningKey) ?? ""
            : checksumStored;

        var isConfigured = !string.IsNullOrWhiteSpace(clientId)
                        && !string.IsNullOrWhiteSpace(apiKeyPlain)
                        && !string.IsNullOrWhiteSpace(checksumPlain);

        return new PayOSConfigView(
            ClientId: clientId,
            ApiKeyMasked: string.IsNullOrWhiteSpace(apiKeyPlain) ? "" : SecretProtector.Mask(apiKeyPlain),
            ChecksumKeyMasked: string.IsNullOrWhiteSpace(checksumPlain) ? "" : SecretProtector.Mask(checksumPlain),
            IsConfigured: isConfigured);
    }

    public async Task<PayOSConfigView> UpdateConfigAsync(UpdatePayOSConfigCommand command, Guid updatedByUserId, CancellationToken ct)
    {
        var updates = new List<PlatformSetting>();
        var actor = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == updatedByUserId, ct);

        // Client ID
        var clientId = (command.ClientId ?? "").Trim();
        var clientRow = await db.PlatformSettings.FirstOrDefaultAsync(x => x.Key == PlatformSettingKeys.PayOSClientId, ct);
        if (clientRow == null)
        {
            db.PlatformSettings.Add(new PlatformSetting
            {
                Key = PlatformSettingKeys.PayOSClientId,
                Value = clientId,
                Group = "Payment",
                DataType = "String",
                Description = "PayOS Client ID",
                IsSecret = false,
                UpdatedByUserId = updatedByUserId,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        else
        {
            clientRow.Value = clientId;
            clientRow.UpdatedByUserId = updatedByUserId;
            clientRow.UpdatedAtUtc = DateTime.UtcNow;
        }

        // API Key
        var rawApiKey = (command.ApiKey ?? "").Trim();
        if (!string.IsNullOrEmpty(rawApiKey) && !SecretProtector.LooksMasked(rawApiKey))
        {
            if (rawApiKey.Length < 10 || rawApiKey.Any(char.IsWhiteSpace))
                throw new RequestValidationException("apiKey", "API Key không hợp lệ (tối thiểu 10 ký tự, không chứa khoảng trắng).");

            var protectedApiKey = SecretProtector.Protect(rawApiKey, SigningKey);
            var apiRow = await db.PlatformSettings.FirstOrDefaultAsync(x => x.Key == PlatformSettingKeys.PayOSApiKey, ct);
            if (apiRow == null)
            {
                db.PlatformSettings.Add(new PlatformSetting
                {
                    Key = PlatformSettingKeys.PayOSApiKey,
                    Value = protectedApiKey,
                    Group = "Payment",
                    DataType = "String",
                    Description = "PayOS API Key",
                    IsSecret = true,
                    UpdatedByUserId = updatedByUserId,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }
            else
            {
                apiRow.Value = protectedApiKey;
                apiRow.IsSecret = true;
                apiRow.UpdatedByUserId = updatedByUserId;
                apiRow.UpdatedAtUtc = DateTime.UtcNow;
            }
        }

        // Checksum Key
        var rawChecksum = (command.ChecksumKey ?? "").Trim();
        if (!string.IsNullOrEmpty(rawChecksum) && !SecretProtector.LooksMasked(rawChecksum))
        {
            if (rawChecksum.Length < 10 || rawChecksum.Any(char.IsWhiteSpace))
                throw new RequestValidationException("checksumKey", "Checksum Key không hợp lệ (tối thiểu 10 ký tự, không chứa khoảng trắng).");

            var protectedChecksum = SecretProtector.Protect(rawChecksum, SigningKey);
            var checkRow = await db.PlatformSettings.FirstOrDefaultAsync(x => x.Key == PlatformSettingKeys.PayOSChecksumKey, ct);
            if (checkRow == null)
            {
                db.PlatformSettings.Add(new PlatformSetting
                {
                    Key = PlatformSettingKeys.PayOSChecksumKey,
                    Value = protectedChecksum,
                    Group = "Payment",
                    DataType = "String",
                    Description = "PayOS Checksum Key",
                    IsSecret = true,
                    UpdatedByUserId = updatedByUserId,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }
            else
            {
                checkRow.Value = protectedChecksum;
                checkRow.IsSecret = true;
                checkRow.UpdatedByUserId = updatedByUserId;
                checkRow.UpdatedAtUtc = DateTime.UtcNow;
            }
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = updatedByUserId,
            ActorName = actor?.FullName ?? "Admin",
            ActorRole = actor?.Role.ToString() ?? "PlatformAdmin",
            Action = "PAYOS_CONFIG_UPDATED",
            EntityName = "PlatformSetting",
            EntityId = "PayOS",
            Details = "Đã cập nhật thông tin cấu hình cổng thanh toán PayOS.",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);
        return await GetConfigAsync(ct);
    }

    public async Task<PayOSTestResult> TestConnectionAsync(CancellationToken ct)
    {
        var (clientId, apiKey, checksumKey) = await GetCredentialsAsync(ct);

        try
        {
            // PayOS GET /v2/payment-requests/0 checks if credentials are authenticated
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{PayOSBaseUrl}/v2/payment-requests/0");
            req.Headers.Add("x-client-id", clientId);
            req.Headers.Add("x-api-key", apiKey);

            var response = await httpClient.SendAsync(req, ct);
            var content = await response.Content.ReadAsStringAsync(ct);

            // If invalid auth, PayOS responds with 401 or code != 20
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                return new PayOSTestResult(false, "PayOS trả về 401 Unauthorized: Client ID hoặc API Key không chính xác.", clientId);
            }

            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.TryGetProperty("code", out var codeElem) ? codeElem.GetString() : "";

            // Code "20" means "Đơn hàng không tồn tại", which confirms credentials are completely valid!
            if (code == "20" || code == "00" || response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return new PayOSTestResult(true, "Kết nối cổng thanh toán PayOS thành công! Thông tin tài khoản và chữ ký hợp lệ.", clientId);
            }

            var desc = root.TryGetProperty("desc", out var descElem) ? descElem.GetString() : "Không xác thực được";
            return new PayOSTestResult(false, $"PayOS phản hồi: {desc} (Mã lỗi: {code})", clientId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi kiểm tra kết nối PayOS");
            return new PayOSTestResult(false, $"Không kết nối được tới máy chủ PayOS: {ex.Message}", clientId);
        }
    }

    public async Task<PayOSPaymentLinkResult> CreateBillPaymentLinkAsync(
        Guid billId,
        decimal? customAmount,
        Guid userId,
        string? returnUrl,
        string? cancelUrl,
        CancellationToken ct)
    {
        var bill = await db.Bills
            .Include(b => b.Contract)
            .FirstOrDefaultAsync(b => b.Id == billId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy hóa đơn #{billId}");

        if (bill.Status == BillStatus.Paid)
            throw new ResourceConflictException("Hóa đơn này đã hoàn tất thanh toán.");
        if (bill.Status == BillStatus.Cancelled)
            throw new ResourceConflictException("Hóa đơn đã bị hủy, không thể tạo liên kết thanh toán.");

        var (clientId, apiKey, checksumKey) = await GetCredentialsAsync(ct);

        var payAmount = customAmount.HasValue && customAmount.Value > 0
            ? Math.Min(customAmount.Value, bill.RemainingAmount)
            : bill.RemainingAmount;

        if (payAmount <= 0)
            throw new RequestValidationException("amount", "Số tiền thanh toán phải lớn hơn 0.");

        var roundedAmount = (long)Math.Round(payAmount, MidpointRounding.AwayFromZero);

        // Generate a unique numeric OrderCode
        var now = DateTimeOffset.UtcNow;
        var orderCode = (long)(now.ToUnixTimeSeconds() % 100000000) * 1000 + Random.Shared.Next(100, 999);
        while (await db.PaymentTransactions.AnyAsync(x => x.OrderCode == orderCode, ct))
        {
            orderCode = (long)(DateTimeOffset.UtcNow.ToUnixTimeSeconds() % 100000000) * 1000 + Random.Shared.Next(100, 999);
        }

        // PayOS description: max 25 characters
        var cleanCode = bill.BillCode.Replace("BILL-", "").Replace("-", "");
        var description = $"TT {cleanCode}";
        if (description.Length > 25) description = description[..25];

        var finalReturnUrl = !string.IsNullOrWhiteSpace(returnUrl)
            ? returnUrl
            : $"http://localhost:3000/owner/bills?payment=success&orderCode={orderCode}";
        var finalCancelUrl = !string.IsNullOrWhiteSpace(cancelUrl)
            ? cancelUrl
            : $"http://localhost:3000/owner/bills?payment=cancel&orderCode={orderCode}";

        // Calculate HMAC-SHA256 signature for create payment link:
        // alphabetical order: amount, cancelUrl, description, orderCode, returnUrl
        var dataToSign = $"amount={roundedAmount}&cancelUrl={finalCancelUrl}&description={description}&orderCode={orderCode}&returnUrl={finalReturnUrl}";
        var signature = HmacSha256(dataToSign, checksumKey);

        var requestBody = new
        {
            orderCode,
            amount = roundedAmount,
            description,
            cancelUrl = finalCancelUrl,
            returnUrl = finalReturnUrl,
            buyerName = bill.LesseeName,
            items = new[]
            {
                new
                {
                    name = $"Thanh toán hóa đơn #{bill.BillCode}",
                    quantity = 1,
                    price = roundedAmount
                }
            },
            signature
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{PayOSBaseUrl}/v2/payment-requests");
        req.Headers.Add("x-client-id", clientId);
        req.Headers.Add("x-api-key", apiKey);
        req.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        var response = await httpClient.SendAsync(req, ct);
        var responseJson = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Lỗi gọi PayOS Create Payment Link: {Status} {Body}", response.StatusCode, responseJson);
            throw new RequestValidationException("PayOS", $"PayOS báo lỗi tạo link thanh toán ({response.StatusCode}): {responseJson}");
        }

        using var doc = JsonDocument.Parse(responseJson);
        var root = doc.RootElement;
        var code = root.TryGetProperty("code", out var codeElem) ? codeElem.GetString() : "";
        if (code != "00")
        {
            var desc = root.TryGetProperty("desc", out var descElem) ? descElem.GetString() : "Lỗi PayOS";
            throw new RequestValidationException("PayOS", $"PayOS từ chối yêu cầu ({code}): {desc}");
        }

        var dataElem = root.GetProperty("data");
        var checkoutUrl = dataElem.GetProperty("checkoutUrl").GetString() ?? "";
        var qrCode = dataElem.TryGetProperty("qrCode", out var qrElem) ? qrElem.GetString() : null;
        var paymentLinkId = dataElem.TryGetProperty("paymentLinkId", out var plElem) ? plElem.GetString() : null;
        var bin = dataElem.TryGetProperty("bin", out var binElem) ? binElem.GetString() : null;
        var accountNumber = dataElem.TryGetProperty("accountNumber", out var anElem) ? anElem.GetString() : null;
        var accountName = dataElem.TryGetProperty("accountName", out var nmElem) ? nmElem.GetString() : null;
        var status = dataElem.TryGetProperty("status", out var stElem) ? stElem.GetString() ?? "PENDING" : "PENDING";

        // PayOS often attaches an order prefix (e.g. CSA9LWHTV76) in VietQR addInfo. Extract it so user sees & copies exact content.
        var exactContent = ExtractTransferContentFromQr(qrCode) ?? description;

        // Save PaymentTransaction in DB
        var transaction = new PaymentTransaction
        {
            OrderCode = orderCode,
            BillId = bill.Id,
            Amount = roundedAmount,
            Description = exactContent,
            Status = status,
            PaymentLinkId = paymentLinkId,
            CheckoutUrl = checkoutUrl,
            QrCode = qrCode,
            BankAccountNumber = accountNumber,
            BankAccountName = accountName,
            BankBin = bin,
            BankName = GetBankNameByBin(bin),
            CreatedByUserId = userId,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.PaymentTransactions.Add(transaction);
        await db.SaveChangesAsync(ct);

        return new PayOSPaymentLinkResult(
            OrderCode: orderCode,
            Amount: roundedAmount,
            Description: exactContent,
            Status: status,
            CheckoutUrl: checkoutUrl,
            QrCode: qrCode,
            BankAccountNumber: accountNumber,
            BankAccountName: accountName,
            BankBin: bin,
            BankName: transaction.BankName,
            PaymentLinkId: paymentLinkId,
            BillId: bill.Id,
            BillCode: bill.BillCode);
    }

    public async Task<PayOSPaymentStatusResult> CheckPaymentStatusAsync(long orderCode, CancellationToken ct)
    {
        var transaction = await db.PaymentTransactions
            .Include(t => t.Bill)
            .FirstOrDefaultAsync(t => t.OrderCode == orderCode, ct);

        var (clientId, apiKey, checksumKey) = await GetCredentialsAsync(ct);
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{PayOSBaseUrl}/v2/payment-requests/{orderCode}");
        req.Headers.Add("x-client-id", clientId);
        req.Headers.Add("x-api-key", apiKey);

        var response = await httpClient.SendAsync(req, ct);
        var content = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            return new PayOSPaymentStatusResult(
                OrderCode: orderCode,
                Status: transaction?.Status ?? "UNKNOWN",
                Amount: transaction?.Amount ?? 0,
                AmountPaid: 0,
                AmountRemaining: transaction?.Amount ?? 0,
                IsSuccess: false,
                TransactionDateTime: null,
                Reference: null);
        }

        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;
        var code = root.TryGetProperty("code", out var codeElem) ? codeElem.GetString() : "";
        if (code != "00")
        {
            return new PayOSPaymentStatusResult(
                OrderCode: orderCode,
                Status: transaction?.Status ?? "PENDING",
                Amount: transaction?.Amount ?? 0,
                AmountPaid: 0,
                AmountRemaining: transaction?.Amount ?? 0,
                IsSuccess: false,
                TransactionDateTime: null,
                Reference: null);
        }

        var data = root.GetProperty("data");
        var status = data.TryGetProperty("status", out var stElem) ? stElem.GetString() ?? "PENDING" : "PENDING";
        var amount = data.TryGetProperty("amount", out var amElem) ? amElem.GetDecimal() : (transaction?.Amount ?? 0);
        var amountPaid = data.TryGetProperty("amountPaid", out var apElem) ? apElem.GetDecimal() : 0;
        var amountRemaining = data.TryGetProperty("amountRemaining", out var arElem) ? arElem.GetDecimal() : 0;
        var createdAt = data.TryGetProperty("createdAt", out var caElem) ? caElem.GetString() : null;

        var isPaid = status.Equals("PAID", StringComparison.OrdinalIgnoreCase);

        // If paid and transaction is not marked as paid, update DB!
        if (isPaid && transaction != null && transaction.Status != "PAID")
        {
            await MarkPaymentSuccessAsync(transaction, amountPaid > 0 ? amountPaid : amount, createdAt, null, ct);
        }

        return new PayOSPaymentStatusResult(
            OrderCode: orderCode,
            Status: status,
            Amount: amount,
            AmountPaid: amountPaid,
            AmountRemaining: amountRemaining,
            IsSuccess: isPaid,
            TransactionDateTime: createdAt,
            Reference: transaction?.Reference);
    }

    public async Task<PayOSPaymentStatusResult> ConfirmManualPaymentAsync(long orderCode, Guid userId, CancellationToken ct)
    {
        var transaction = await db.PaymentTransactions
            .Include(t => t.Bill)
            .FirstOrDefaultAsync(t => t.OrderCode == orderCode, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy giao dịch thanh toán #{orderCode}");

        if (transaction.Status != "PAID")
        {
            var now = DateTime.UtcNow.ToString("o");
            await MarkPaymentSuccessAsync(transaction, transaction.Amount, now, $"MANUAL-{DateTime.UtcNow:yyyyMMddHHmmss}", ct);
        }

        return new PayOSPaymentStatusResult(
            OrderCode: orderCode,
            Status: "PAID",
            Amount: transaction.Amount,
            AmountPaid: transaction.Amount,
            AmountRemaining: 0,
            IsSuccess: true,
            TransactionDateTime: transaction.PaidAtUtc?.ToString("o"),
            Reference: transaction.Reference);
    }

    public async Task<bool> ProcessWebhookAsync(string rawJson, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            var root = doc.RootElement;

            if (!root.TryGetProperty("data", out var dataElem) || !root.TryGetProperty("signature", out var sigElem))
            {
                logger.LogWarning("Webhook PayOS thiếu trường data hoặc signature");
                return false;
            }

            var receivedSig = sigElem.GetString() ?? "";
            var (_, _, checksumKey) = await GetCredentialsAsync(ct);

            // Verify signature
            var dataQueryString = CreateWebhookSignatureData(dataElem);
            var calculatedSig = HmacSha256(dataQueryString, checksumKey);

            if (!string.Equals(receivedSig, calculatedSig, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("Webhook PayOS chữ ký không khớp! Nhận: {Received}, Tính: {Calculated}", receivedSig, calculatedSig);
                return false;
            }

            var code = root.TryGetProperty("code", out var codeElem) ? codeElem.GetString() : "";
            if (code != "00")
            {
                logger.LogInformation("Webhook PayOS trả về mã không thành công: {Code}", code);
                return true; // Still acknowledge PayOS
            }

            var orderCode = dataElem.GetProperty("orderCode").GetInt64();
            var amount = dataElem.GetProperty("amount").GetDecimal();
            var reference = dataElem.TryGetProperty("reference", out var refElem) ? refElem.GetString() : null;
            var transactionDateTime = dataElem.TryGetProperty("transactionDateTime", out var tdElem) ? tdElem.GetString() : null;

            var transaction = await db.PaymentTransactions
                .Include(t => t.Bill)
                .FirstOrDefaultAsync(t => t.OrderCode == orderCode, ct);

            if (transaction != null && transaction.Status != "PAID")
            {
                transaction.WebhookPayloadJson = rawJson;
                await MarkPaymentSuccessAsync(transaction, amount, transactionDateTime, reference, ct);
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi xử lý webhook PayOS");
            return false;
        }
    }

    private async Task MarkPaymentSuccessAsync(
        PaymentTransaction transaction,
        decimal paidAmount,
        string? transactionDateTime,
        string? reference,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        transaction.Status = "PAID";
        transaction.PaidAtUtc = now;
        transaction.Reference = reference ?? transaction.Reference;
        transaction.UpdatedAtUtc = now;

        if (transaction.BillId.HasValue)
        {
            var bill = await db.Bills.FirstOrDefaultAsync(b => b.Id == transaction.BillId.Value, ct);
            if (bill != null && bill.Status != BillStatus.Paid)
            {
                bill.PaidAmount += paidAmount;
                bill.RemainingAmount = Math.Max(0, bill.Amount - bill.PaidAmount);
                bill.Status = bill.RemainingAmount <= 0 ? BillStatus.Paid : BillStatus.PartiallyPaid;
                bill.PaymentMethod = "PayOS (VietQR)";
                bill.PaidDate = now;

                var log = $"[PayOS: +{paidAmount:N0} đ lúc {now:dd/MM/yyyy HH:mm} - GD #{transaction.OrderCode}]";
                bill.Notes = string.IsNullOrWhiteSpace(bill.Notes) ? log : $"{bill.Notes} | {log}";
                bill.UpdatedAtUtc = now;
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Đã cập nhật thanh toán thành công qua PayOS cho Order #{OrderCode}, số tiền {Amount:N0} đ", transaction.OrderCode, paidAmount);
    }

    public async Task<bool> ConfirmWebhookUrlAsync(string webhookUrl, CancellationToken ct)
    {
        var (clientId, apiKey, _) = await GetCredentialsAsync(ct);
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{PayOSBaseUrl}/v1/confirm-webhook");
        req.Headers.Add("x-client-id", clientId);
        req.Headers.Add("x-api-key", apiKey);
        req.Content = new StringContent(JsonSerializer.Serialize(new { webhookUrl }), Encoding.UTF8, "application/json");

        var response = await httpClient.SendAsync(req, ct);
        var content = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Lỗi xác nhận Webhook URL với PayOS: {Status} {Content}", response.StatusCode, content);
            throw new RequestValidationException("webhookUrl", $"PayOS phản hồi lỗi khi đăng ký webhook: {content}");
        }

        return true;
    }

    public async Task<IReadOnlyList<PayOSTransactionView>> GetTransactionsByBillIdAsync(Guid billId, CancellationToken ct)
    {
        var list = await db.PaymentTransactions
            .AsNoTracking()
            .Where(x => x.BillId == billId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);

        return list.Select(x => new PayOSTransactionView(
            Id: x.Id,
            OrderCode: x.OrderCode,
            BillId: x.BillId,
            Amount: x.Amount,
            Description: x.Description,
            Status: x.Status,
            CheckoutUrl: x.CheckoutUrl,
            QrCode: x.QrCode,
            BankAccountNumber: x.BankAccountNumber,
            BankAccountName: x.BankAccountName,
            BankName: x.BankName,
            Reference: x.Reference,
            PaidAtUtc: x.PaidAtUtc,
            CreatedAtUtc: x.CreatedAtUtc)).ToList();
    }

    private static string HmacSha256(string data, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string CreateWebhookSignatureData(JsonElement data)
    {
        var dict = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var prop in data.EnumerateObject())
        {
            var val = prop.Value.ValueKind switch
            {
                JsonValueKind.Null => "",
                JsonValueKind.Undefined => "",
                JsonValueKind.String => prop.Value.GetString() ?? "",
                JsonValueKind.Number => prop.Value.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => prop.Value.GetRawText()
            };
            dict[prop.Name] = val;
        }
        return string.Join("&", dict.Select(kv => $"{kv.Key}={kv.Value}"));
    }

    private static string GetBankNameByBin(string? bin) => bin switch
    {
        "970422" => "MBBank (Ngân hàng Quân đội)",
        "970436" => "Vietcombank (Ngoại thương Việt Nam)",
        "970415" => "VietinBank (Công thương Việt Nam)",
        "970418" => "BIDV (Đầu tư và Phát triển Việt Nam)",
        "970407" => "Techcombank (Kỹ thương Việt Nam)",
        "970423" => "TPBank (Tiên Phong)",
        "970432" => "VPBank (Việt Nam Thịnh Vượng)",
        "970405" => "Agribank (Nông nghiệp và PTNT)",
        "970448" => "OCB (Phương Đông)",
        "970454" => "VietCapitalBank (Bản Việt)",
        _ => !string.IsNullOrEmpty(bin) ? $"Ngân hàng (BIN {bin})" : "Ngân hàng thụ hưởng"
    };

    private static string? ExtractTransferContentFromQr(string? qrCode)
    {
        if (string.IsNullOrWhiteSpace(qrCode)) return null;
        var idx62 = qrCode.IndexOf("62", StringComparison.Ordinal);
        while (idx62 >= 0 && idx62 + 4 < qrCode.Length)
        {
            if (int.TryParse(qrCode.Substring(idx62 + 2, 2), out var len62) && idx62 + 4 + len62 <= qrCode.Length)
            {
                var tag62Value = qrCode.Substring(idx62 + 4, len62);
                var idx08 = tag62Value.IndexOf("08", StringComparison.Ordinal);
                if (idx08 >= 0 && idx08 + 4 <= tag62Value.Length)
                {
                    if (int.TryParse(tag62Value.Substring(idx08 + 2, 2), out var len08) && idx08 + 4 + len08 <= tag62Value.Length)
                    {
                        var content = tag62Value.Substring(idx08 + 4, len08).Trim();
                        if (!string.IsNullOrEmpty(content)) return content;
                    }
                }
            }
            idx62 = qrCode.IndexOf("62", idx62 + 1, StringComparison.Ordinal);
        }
        return null;
    }
}
