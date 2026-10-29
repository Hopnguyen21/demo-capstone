using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;

namespace SmartFarm.Api.Middleware;

public sealed class ApiExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            RequestValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            AuthenticationException => (StatusCodes.Status401Unauthorized, "Authentication failed"),
            AuthorizationException => (StatusCodes.Status403Forbidden, "Access forbidden"),
            ResourceNotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            ResourceConflictException => (StatusCodes.Status409Conflict, "Resource conflict"),
            RateLimitExceededException => (StatusCodes.Status429TooManyRequests, "Rate limit exceeded"),
            DocumentInsufficientException => (StatusCodes.Status422UnprocessableEntity, "Document is insufficient"),
            DocumentVerificationUnavailableException => (StatusCodes.Status503ServiceUnavailable, "Document verification unavailable"),
            DuplicateDocumentException => (StatusCodes.Status409Conflict, "Duplicate document"),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred")
        };

        httpContext.Response.StatusCode = status;
        if (exception is RateLimitExceededException rateLimit)
        {
            httpContext.Response.Headers.RetryAfter = rateLimit.RetryAfterSeconds.ToString();
        }
        ProblemDetails problem;
        if (exception is RequestValidationException validationException)
        {
            problem = new HttpValidationProblemDetails(validationException.Errors.ToDictionary(x => x.Key, x => x.Value))
            {
                Status = status,
                Title = title,
                Detail = exception.Message
            };
        }
        else
        {
            problem = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = status == StatusCodes.Status500InternalServerError ? null : exception.Message
            };
        }

        if (exception is DuplicateDocumentException duplicate)
        {
            // Cho giao diện mở thẳng tài liệu đã có để sửa/duyệt tiếp thay vì tải lại bản trùng.
            problem.Extensions["existingDocumentId"] = duplicate.ExistingDocumentId;
            problem.Extensions["existingTitle"] = duplicate.ExistingTitle;
            problem.Extensions["existingStatus"] = duplicate.ExistingStatus;
        }

        if (exception is DocumentInsufficientException insufficient)
        {
            // Trả danh sách mục thiếu để người tải lên biết cần bổ sung gì.
            problem.Extensions["documentType"] = insufficient.Result.DocumentType;
            problem.Extensions["missingRequirements"] = insufficient.Result.MissingRequirements;
            problem.Extensions["issues"] = insufficient.Result.Issues;
            problem.Extensions["summary"] = insufficient.Result.Summary;
            problem.Extensions["verifiedBy"] = insufficient.Result.VerifiedBy;
        }

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception
        });
    }
}
