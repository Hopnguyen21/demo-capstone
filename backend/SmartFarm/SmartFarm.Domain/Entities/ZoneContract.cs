using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class ZoneContract : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid CreatedByOwnerId { get; set; }
    public AppUser CreatedByOwner { get; set; } = null!;
    public Guid? ParentContractId { get; set; }
    public ZoneContract? ParentContract { get; set; }
    public string ContractNumber { get; set; } = string.Empty;
    public string? CropType { get; set; }
    public decimal MonthlyRentVnd { get; set; }
    public decimal DepositVnd { get; set; }
    public decimal TotalContractValueVnd { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public ZoneContractStatus Status { get; set; } = ZoneContractStatus.Active;
    public string LesseeName { get; set; } = string.Empty;
    public string? LesseePhone { get; set; }
    public string? LesseeIdentityNumber { get; set; }
    public string? LesseeAddress { get; set; }
    public string? SpecialTerms { get; set; }
    public string? Notes { get; set; }
    public DateTime? SignedAtUtc { get; set; }
    public DateTime? TerminatedAtUtc { get; set; }
    public string? TerminationReason { get; set; }

    public ICollection<ZoneContractRenewal> Renewals { get; } = new List<ZoneContractRenewal>();
}

public sealed class ZoneContractRenewal : AuditableEntity
{
    public Guid ContractId { get; set; }
    public ZoneContract Contract { get; set; } = null!;
    public Guid CreatedByOwnerId { get; set; }
    public AppUser CreatedByOwner { get; set; } = null!;
    public DateOnly NewEndDate { get; set; }
    public decimal? NewMonthlyRentVnd { get; set; }
    public decimal RenewalValueVnd { get; set; }
    public string? Notes { get; set; }
}
