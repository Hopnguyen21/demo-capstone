using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Technicians;

public sealed record CreateTechnicianCommand(string Email, string FullName, string? Phone, string InitialPassword);
public sealed record UpdateTechnicianCommand(string FullName, string? Phone, AccountStatus Status);
public sealed record TechnicianView(Guid UserId, string Email, string FullName, string? Phone, AccountStatus Status, DateTime CreatedAtUtc);
