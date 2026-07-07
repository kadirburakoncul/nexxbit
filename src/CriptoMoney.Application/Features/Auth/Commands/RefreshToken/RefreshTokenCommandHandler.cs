using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Application.Common.Security;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.RefreshToken;

public class RefreshTokenCommandHandler(IUnitOfWork uow, IJwtService jwtService)
    : IRequestHandler<RefreshTokenCommand, Result<RefreshTokenResponse>>
{
    public async Task<Result<RefreshTokenResponse>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var hashedIncoming = TokenHasher.Hash(request.RefreshToken);
        var user = await uow.Users.FirstOrDefaultAsync(
            u => u.RefreshToken == hashedIncoming && u.RefreshTokenExpiry > DateTime.UtcNow,
            cancellationToken);

        if (user is null)
            return Result<RefreshTokenResponse>.Failure("Geçersiz veya süresi dolmuş refresh token.");

        // Token rotation — her refresh isteğinde yeni refresh token üret
        var accessToken = jwtService.GenerateAccessToken(user);
        var newRefreshToken = jwtService.GenerateRefreshToken();
        user.RefreshToken = TokenHasher.Hash(newRefreshToken);
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(30);
        await uow.CommitAsync(cancellationToken);

        return Result<RefreshTokenResponse>.Success(
            new RefreshTokenResponse(accessToken, newRefreshToken, jwtService.AccessTokenExpiry));
    }
}
