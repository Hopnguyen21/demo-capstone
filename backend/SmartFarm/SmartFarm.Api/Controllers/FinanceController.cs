using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize(Roles = "FarmOwner"), Route("api/v1/farms/{farmId:guid}")]
public sealed class FinanceController(IFinanceService service) : ControllerBase
{
    [HttpGet("finance/transactions")] // FINANCE-V1-01
    public async Task<ActionResult<IReadOnlyList<FinanceTransactionView>>> List(Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await service.ListAsync(User.GetUserId(), User.GetTenantId(), farmId, fromUtc, toUtc, ct));
    [HttpPost("finance/revenues")] // FINANCE-V1-02
    public async Task<ActionResult<FinanceTransactionView>> Revenue(Guid farmId, FinanceRequest r, CancellationToken ct) { var x = await service.CreateAsync(User.GetUserId(), User.GetTenantId(), farmId, FinanceTransactionType.Revenue, r.Create(), ct); return Created($"/api/v1/farms/{farmId}/finance/transactions/{x.Id}", x); }
    [HttpPost("finance/expenses")] // FINANCE-V1-03
    public async Task<ActionResult<FinanceTransactionView>> Expense(Guid farmId, FinanceRequest r, CancellationToken ct) { var x = await service.CreateAsync(User.GetUserId(), User.GetTenantId(), farmId, FinanceTransactionType.Expense, r.Create(), ct); return Created($"/api/v1/farms/{farmId}/finance/transactions/{x.Id}", x); }
    [HttpPut("finance/transactions/{id:guid}")] // FINANCE-V1-04
    public async Task<ActionResult<FinanceTransactionView>> Update(Guid farmId, Guid id, FinanceRequest r, CancellationToken ct) => Ok(await service.UpdateAsync(User.GetUserId(), User.GetTenantId(), farmId, id, r.Update(), ct));
    [HttpDelete("finance/transactions/{id:guid}")] // FINANCE-V1-05
    public async Task<IActionResult> Delete(Guid farmId, Guid id, CancellationToken ct) { await service.ArchiveAsync(User.GetUserId(), User.GetTenantId(), farmId, id, ct); return NoContent(); }
    [HttpGet("cash-flow-report")] // API catalog #102
    public async Task<ActionResult<CashFlowReportView>> Report(Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await service.ReportAsync(User.GetUserId(), User.GetTenantId(), farmId, fromUtc, toUtc, ct));
}

public sealed class FinanceRequest
{
    public decimal Amount { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    [Required, StringLength(500)] public string Description { get; init; } = "";
    [StringLength(200)] public string? Reference { get; init; }
    public ExpenseCategory? ExpenseCategory { get; init; }
    internal CreateFinanceCommand Create() => new(Amount, OccurredAtUtc, Description, Reference, ExpenseCategory);
    internal UpdateFinanceCommand Update() => new(Amount, OccurredAtUtc, Description, Reference, ExpenseCategory);
}
