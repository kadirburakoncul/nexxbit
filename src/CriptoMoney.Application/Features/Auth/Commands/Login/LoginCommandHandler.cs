using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.Login;

public class LoginCommandHandler(IUnitOfWork uow, IJwtService jwtService)
    : IRequestHandler<LoginCommand, Result<LoginResponse>>
{
    public async Task<Result<LoginResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await uow.Users.FirstOrDefaultAsync(
            u => u.Email == request.Email.ToLowerInvariant(), cancellationToken);

        if (user is null)
            return Result<LoginResponse>.Failure("E-posta veya şifre hatalı.");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Result<LoginResponse>.Failure("E-posta veya şifre hatalı.");

        var accessToken = jwtService.GenerateAccessToken(user);
        var refreshToken = jwtService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(30);
        user.LastLoginAt = DateTime.UtcNow;

        uow.Users.Update(user);
        await uow.CommitAsync(cancellationToken);

        return Result<LoginResponse>.Success(new LoginResponse(
            accessToken,
            refreshToken,
            jwtService.AccessTokenExpiry,
            user.Id,
            user.Email,
            user.FullName,
            user.Role.ToString()
        ));
    }
}
