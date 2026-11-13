using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Inventory;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Finance;

public sealed class BillService(SmartFarmDbContext db, TimeProvider clock) : IBillService
{
    public async Task<IReadOnlyList<BillView>> GetBillsAsync(
        Guid userId,
        Guid? tenantId,
        Guid? contractId,
        BillStatus? status,
        DateOnly? fromDate,
        DateOnly? toDate,
        CancellationToken ct)
    {
        var query = db.Bills
            .Include(b => b.Contract)
            .Include(b => b.CreatedByUser)
            .AsNoTracking();

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(b => b.TenantId == tenantId.Value);
        }

        if (contractId.HasValue && contractId.Value != Guid.Empty)
        {
            query = query.Where(b => b.ContractId == contractId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(b => b.Status == status.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(b => b.IssueDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(b => b.IssueDate <= toDate.Value);
        }

        var bills = await query.OrderByDescending(b => b.CreatedAtUtc).ToListAsync(ct);
        return bills.Select(MapToView).ToList();
    }

    public async Task<BillView> GetBillByIdAsync(Guid userId, Guid? tenantId, Guid id, CancellationToken ct)
    {
        var query = db.Bills
            .Include(b => b.Contract)
            .Include(b => b.CreatedByUser)
            .AsNoTracking();

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(b => b.TenantId == tenantId.Value);
        }

        var bill = await query.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy hóa đơn #{id}");

        return MapToView(bill);
    }

    public async Task<IReadOnlyList<BillView>> GetBillsByContractAsync(Guid userId, Guid? tenantId, Guid contractId, CancellationToken ct)
    {
        return await GetBillsAsync(userId, tenantId, contractId, null, null, null, ct);
    }

    public async Task<BillView> CreateBillFromContractAsync(Guid userId, Guid? tenantId, CreateBillFromContractCommand command, CancellationToken ct)
    {
        var contractQuery = db.ZoneContracts.AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            contractQuery = contractQuery.Where(c => c.TenantId == tenantId.Value);
        }

        var contract = await contractQuery.FirstOrDefaultAsync(c => c.Id == command.ContractId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy hợp đồng #{command.ContractId}");

        var effectiveTenantId = tenantId.HasValue && tenantId.Value != Guid.Empty ? tenantId.Value : contract.TenantId;
        var amount = command.Amount.HasValue && command.Amount.Value > 0 ? command.Amount.Value : contract.TotalContractValueVnd;

        if (amount <= 0)
        {
            throw new RequestValidationException("amount", "Số tiền hóa đơn phải lớn hơn 0.");
        }

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var dueDate = command.DueDate != default ? command.DueDate : today.AddDays(30);

        // Auto generate BillCode
        var now = clock.GetUtcNow().UtcDateTime;
        var prefix = $"BILL-{now:yyyyMM}";
        var randomNum = Random.Shared.Next(100, 999);
        var billCode = $"{prefix}-{randomNum}";

        while (await db.Bills.AnyAsync(b => b.TenantId == effectiveTenantId && b.BillCode == billCode, ct))
        {
            billCode = $"{prefix}-{Random.Shared.Next(100, 999)}-{Guid.NewGuid().ToString("N")[..3].ToUpperInvariant()}";
        }

        var bill = new Bill
        {
            TenantId = effectiveTenantId,
            BillCode = billCode,
            ContractId = contract.Id,
            CustomerTenantId = contract.TenantId,
            LesseeName = contract.LesseeName,
            Amount = amount,
            PaidAmount = 0,
            RemainingAmount = amount,
            Status = BillStatus.Issued,
            IssueDate = today,
            DueDate = dueDate,
            PaymentMethod = command.PaymentMethod,
            Notes = command.Notes?.Trim(),
            CreatedByUserId = userId
        };

        db.Bills.Add(bill);
        await db.SaveChangesAsync(ct);

        return await GetBillByIdAsync(userId, tenantId, bill.Id, ct);
    }

    public async Task<BillView> RecordPaymentAsync(Guid userId, Guid? tenantId, Guid billId, RecordBillPaymentCommand command, CancellationToken ct)
    {
        if (command.PaymentAmount <= 0)
        {
            throw new RequestValidationException("paymentAmount", "Số tiền thanh toán phải lớn hơn 0.");
        }

        var query = db.Bills.Include(b => b.Contract).AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(b => b.TenantId == tenantId.Value);
        }

        var bill = await query.FirstOrDefaultAsync(b => b.Id == billId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy hóa đơn #{billId}");

        if (bill.Status == BillStatus.Paid)
        {
            throw new ResourceConflictException("Hóa đơn này đã được thanh toán toàn bộ.");
        }
        if (bill.Status == BillStatus.Cancelled)
        {
            throw new ResourceConflictException("Hóa đơn đã bị hủy, không thể ghi nhận thanh toán.");
        }

        bill.PaidAmount += command.PaymentAmount;
        bill.RemainingAmount = Math.Max(0, bill.Amount - bill.PaidAmount);

        if (!string.IsNullOrWhiteSpace(command.PaymentMethod))
        {
            bill.PaymentMethod = command.PaymentMethod;
        }

        var now = clock.GetUtcNow().UtcDateTime;
        if (bill.RemainingAmount <= 0)
        {
            bill.Status = BillStatus.Paid;
            bill.PaidDate = now;
        }
        else
        {
            bill.Status = BillStatus.PartiallyPaid;
        }

        var paymentLog = $"[Thanh toán: +{command.PaymentAmount:N0} VND lúc {now:dd/MM/yyyy HH:mm} via {command.PaymentMethod ?? "N/A"}]";
        bill.Notes = string.IsNullOrWhiteSpace(bill.Notes) ? paymentLog : $"{bill.Notes} | {paymentLog}";
        bill.UpdatedAtUtc = now;

        // Tự động tạo Phiếu Xuất Kho Thiết Bị IoT nếu đây là thanh toán cọc/hợp đồng có thiết bị
        if (bill.Status == BillStatus.Paid && bill.Contract != null && !string.IsNullOrWhiteSpace(bill.Contract.EquipmentJson))
        {
            try
            {
                var equipments = JsonSerializer.Deserialize<List<ZoneContractEquipmentView>>(bill.Contract.EquipmentJson, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                if (equipments != null && equipments.Count > 0)
                {
                    await StockOutAutomationHelper.AutoCreateStockOutForDepositAsync(
                        db,
                        bill.TenantId,
                        bill.Contract.FarmId,
                        bill.Contract.ZoneId,
                        bill.Contract.ContractNumber,
                        userId,
                        bill.LesseeName,
                        equipments.Select(e => (e.Code, e.Name, (string?)e.Category, e.Quantity)),
                        ct);
                }
            }
            catch {}
        }

        await db.SaveChangesAsync(ct);

        return await GetBillByIdAsync(userId, tenantId, bill.Id, ct);
    }

    public async Task<BillView> UpdateBillStatusAsync(Guid userId, Guid? tenantId, Guid billId, UpdateBillStatusCommand command, CancellationToken ct)
    {
        var query = db.Bills.Include(b => b.Contract).AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(b => b.TenantId == tenantId.Value);
        }

        var bill = await query.FirstOrDefaultAsync(b => b.Id == billId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy hóa đơn #{billId}");

        bill.Status = command.Status;
        if (command.Status == BillStatus.Paid && !bill.PaidDate.HasValue)
        {
            bill.PaidDate = clock.GetUtcNow().UtcDateTime;
            bill.RemainingAmount = 0;
            bill.PaidAmount = bill.Amount;
        }

        if (!string.IsNullOrWhiteSpace(command.Notes))
        {
            bill.Notes = (bill.Notes + " " + command.Notes).Trim();
        }

        bill.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;

        // Tự động tạo Phiếu Xuất Kho Thiết Bị IoT nếu hóa đơn cọc/hợp đồng thiết bị được chuyển trạng thái Đã thanh toán
        if (bill.Status == BillStatus.Paid && bill.Contract != null && !string.IsNullOrWhiteSpace(bill.Contract.EquipmentJson))
        {
            try
            {
                var equipments = JsonSerializer.Deserialize<List<ZoneContractEquipmentView>>(bill.Contract.EquipmentJson, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                if (equipments != null && equipments.Count > 0)
                {
                    await StockOutAutomationHelper.AutoCreateStockOutForDepositAsync(
                        db,
                        bill.TenantId,
                        bill.Contract.FarmId,
                        bill.Contract.ZoneId,
                        bill.Contract.ContractNumber,
                        userId,
                        bill.LesseeName,
                        equipments.Select(e => (e.Code, e.Name, (string?)e.Category, e.Quantity)),
                        ct);
                }
            }
            catch {}
        }

        await db.SaveChangesAsync(ct);

        return await GetBillByIdAsync(userId, tenantId, bill.Id, ct);
    }

    public async Task<BillView> UpdateBillAsync(Guid userId, Guid? tenantId, Guid billId, UpdateBillCommand command, CancellationToken ct)
    {
        if (command.Amount <= 0)
        {
            throw new RequestValidationException("amount", "Số tiền hóa đơn phải lớn hơn 0.");
        }

        var query = db.Bills.Include(b => b.Contract).AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(b => b.TenantId == tenantId.Value);
        }

        var bill = await query.FirstOrDefaultAsync(b => b.Id == billId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy hóa đơn #{billId}");

        if (bill.Status == BillStatus.Paid)
        {
            throw new ResourceConflictException("Không thể chỉnh sửa hóa đơn đã hoàn tất thanh toán.");
        }

        bill.Amount = command.Amount;
        bill.RemainingAmount = Math.Max(0, command.Amount - bill.PaidAmount);
        bill.DueDate = command.DueDate;
        if (!string.IsNullOrWhiteSpace(command.PaymentMethod)) bill.PaymentMethod = command.PaymentMethod;
        if (!string.IsNullOrWhiteSpace(command.Notes)) bill.Notes = command.Notes.Trim();

        bill.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;

        // Tự động tạo Phiếu Xuất Kho Thiết Bị IoT nếu hóa đơn cọc/hợp đồng thiết bị được chuyển trạng thái Đã thanh toán
        if (bill.Status == BillStatus.Paid && bill.Contract != null && !string.IsNullOrWhiteSpace(bill.Contract.EquipmentJson))
        {
            try
            {
                var equipments = JsonSerializer.Deserialize<List<ZoneContractEquipmentView>>(bill.Contract.EquipmentJson, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                if (equipments != null && equipments.Count > 0)
                {
                    await StockOutAutomationHelper.AutoCreateStockOutForDepositAsync(
                        db,
                        bill.TenantId,
                        bill.Contract.FarmId,
                        bill.Contract.ZoneId,
                        bill.Contract.ContractNumber,
                        userId,
                        bill.LesseeName,
                        equipments.Select(e => (e.Code, e.Name, (string?)e.Category, e.Quantity)),
                        ct);
                }
            }
            catch {}
        }

        await db.SaveChangesAsync(ct);

        return await GetBillByIdAsync(userId, tenantId, bill.Id, ct);
    }

    public async Task DeleteBillAsync(Guid userId, Guid? tenantId, Guid billId, CancellationToken ct)
    {
        var query = db.Bills.AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(b => b.TenantId == tenantId.Value);
        }

        var bill = await query.FirstOrDefaultAsync(b => b.Id == billId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy hóa đơn #{billId}");

        if (bill.Status != BillStatus.Draft && bill.Status != BillStatus.Cancelled)
        {
            throw new ResourceConflictException("Chỉ có thể xóa hóa đơn ở trạng thái Bản nháp (Draft) hoặc Đã hủy (Cancelled).");
        }

        db.Bills.Remove(bill);
        await db.SaveChangesAsync(ct);
    }

    private static BillView MapToView(Bill b)
    {
        var statusText = b.Status switch
        {
            BillStatus.Draft => "Bản nháp",
            BillStatus.Issued => "Đã phát hành / Chờ thanh toán",
            BillStatus.PartiallyPaid => "Thanh toán một phần",
            BillStatus.Paid => "Đã thanh toán đủ",
            BillStatus.Overdue => "Quá hạn thanh toán",
            BillStatus.Cancelled => "Đã hủy",
            _ => b.Status.ToString()
        };

        return new BillView(
            b.Id,
            b.TenantId,
            b.BillCode,
            b.ContractId,
            b.Contract?.ContractNumber ?? "N/A",
            b.CustomerTenantId,
            b.LesseeName,
            b.Amount,
            b.PaidAmount,
            b.RemainingAmount,
            b.Status,
            statusText,
            b.IssueDate,
            b.DueDate,
            b.PaidDate,
            b.PaymentMethod,
            b.Notes,
            b.CreatedByUserId,
            b.CreatedByUser?.FullName ?? "Hệ thống",
            b.CreatedAtUtc,
            b.UpdatedAtUtc
        );
    }
}

