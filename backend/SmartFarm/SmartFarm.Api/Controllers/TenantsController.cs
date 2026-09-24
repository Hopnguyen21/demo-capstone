using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Tenants;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize(Roles = "FarmOwner")]
[Route("api/v1/tenants")]
public sealed class TenantsController(ITenantService tenantService) : ControllerBase
{
    // API catalog #13, revised by AUTH_CONTRACT_V1.md
    [HttpPost("register")]
    public async Task<ActionResult<TenantView>> Register(RegisterTenantRequest request, CancellationToken cancellationToken)
    {
        var result = await tenantService.RegisterAsync(
            User.GetUserId(),
            new RegisterTenantCommand(request.CompanyName, request.Subdomain, request.TaxCode, request.Address, request.LogoUrl),
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    // API catalog #14
    [HttpGet("me")]
    public async Task<ActionResult<TenantView>> Me(CancellationToken cancellationToken)
    {
        return Ok(await tenantService.GetCurrentAsync(User.GetUserId(), cancellationToken));
    }

    // API catalog #15
    [HttpPut("me")]
    public async Task<ActionResult<TenantView>> Update(UpdateTenantRequest request, CancellationToken cancellationToken)
    {
        return Ok(await tenantService.UpdateCurrentAsync(
            User.GetUserId(),
            new UpdateTenantCommand(request.CompanyName, request.TaxCode, request.Address, request.LogoUrl),
            cancellationToken));
    }
}

public sealed class RegisterTenantRequest
{
    [Required, StringLength(200, MinimumLength = 2)]
    public string CompanyName { get; init; } = string.Empty;

    [Required, StringLength(30, MinimumLength = 3)]
    public string Subdomain { get; init; } = string.Empty;

    [StringLength(30)]
    public string? TaxCode { get; init; }

    [StringLength(500)]
    public string? Address { get; init; }

    [StringLength(2048)]
    public string? LogoUrl { get; init; }
}

public sealed class UpdateTenantRequest
{
    [Required, StringLength(200, MinimumLength = 2)]
    public string CompanyName { get; init; } = string.Empty;

    [StringLength(30)]
    public string? TaxCode { get; init; }

    [StringLength(500)]
    public string? Address { get; init; }

    [StringLength(2048)]
    public string? LogoUrl { get; init; }
}
