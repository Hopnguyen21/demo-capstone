using SmartFarm.Application.Features.Auth;

namespace SmartFarm.Application.Common.Interfaces;

public interface IAuthService
{
    Task<UserView> RegisterAsync(RegisterUserCommand command, CancellationToken cancellationToken);
    Task<AuthTokenView> LoginAsync(LoginCommand command, CancellationToken cancellationToken);
    Task<AuthTokenView> RefreshAsync(string refreshToken, CancellationToken cancellationToken);
    Task<LogoutView> LogoutAsync(Guid userId, string accessTokenJti, LogoutCommand command, CancellationToken cancellationToken);
}
