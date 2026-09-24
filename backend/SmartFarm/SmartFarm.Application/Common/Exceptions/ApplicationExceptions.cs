namespace SmartFarm.Application.Common.Exceptions;

public sealed class RequestValidationException(IReadOnlyDictionary<string, string[]> errors)
    : Exception("One or more validation errors occurred.")
{
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;

    public RequestValidationException(string field, string error)
        : this(new Dictionary<string, string[]> { [field] = [error] })
    {
    }
}

public sealed class AuthenticationException(string message = "Authentication failed.") : Exception(message);
public sealed class AuthorizationException(string message = "Access is forbidden.") : Exception(message);
public sealed class ResourceNotFoundException(string message = "The requested resource was not found.") : Exception(message);
public sealed class ResourceConflictException(string message) : Exception(message);
public sealed class RateLimitExceededException(string message, int retryAfterSeconds) : Exception(message)
{
    public int RetryAfterSeconds { get; } = retryAfterSeconds;
}
