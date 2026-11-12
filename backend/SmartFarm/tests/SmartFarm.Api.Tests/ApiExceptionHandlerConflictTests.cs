using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SmartFarm.Api.Middleware;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Gửi lại wizard CF1 trùng tên farm: vi phạm ràng buộc duy nhất của DB phải ra 409, không phải 500.</summary>
public class ApiExceptionHandlerConflictTests
{
    private sealed class CapturingProblemDetails : IProblemDetailsService
    {
        public ProblemDetails? Captured { get; private set; }
        public ValueTask WriteAsync(ProblemDetailsContext context) { Captured = context.ProblemDetails; return ValueTask.CompletedTask; }
        public ValueTask<bool> TryWriteAsync(ProblemDetailsContext context) { Captured = context.ProblemDetails; return ValueTask.FromResult(true); }
    }

    private static async Task<(int status, ProblemDetails? problem)> Handle(Exception ex)
    {
        var pd = new CapturingProblemDetails();
        var http = new DefaultHttpContext();
        await new ApiExceptionHandler(pd).TryHandleAsync(http, ex, CancellationToken.None);
        return (http.Response.StatusCode, pd.Captured);
    }

    [Fact]
    public async Task UniqueViolation_Returns409_WithFriendlyDetail_AndNoDbInternals()
    {
        var inner = new PostgresException("duplicate key value violates unique constraint \"IX_farms_tenant_id_name\"", "ERROR", "ERROR", "23505");
        var (status, problem) = await Handle(new DbUpdateException("save failed", inner));
        Assert.Equal(409, status);
        Assert.Contains("trùng", problem!.Detail);
        Assert.DoesNotContain("IX_farms", problem.Detail);
    }

    [Fact]
    public async Task OtherDbErrors_StayAs500_WithoutLeakingDetail()
    {
        var inner = new PostgresException("deadlock", "ERROR", "ERROR", "40P01");
        var (status, problem) = await Handle(new DbUpdateException("save failed", inner));
        Assert.Equal(500, status);
        Assert.Null(problem!.Detail);
    }
}
