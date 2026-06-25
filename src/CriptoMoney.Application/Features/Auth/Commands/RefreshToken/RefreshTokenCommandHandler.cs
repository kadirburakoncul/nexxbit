using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.RefreshToken;

public class RefreshTokenCommandHandler(IUnitOfWork uow, IJwtService jwtService)
    : IRequestHandler<RefreshTokenCommand, Result<RefreshTokenResponse>>
{
    public async Task<Result<RefreshTokenResponse>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var user = await uow.Users.FirstOrDefaultAsync(
            u => u.RefreshToken == request.RefreshToken && u.RefreshTokenExpiry > DateTime.UtcNow,
            cancellationToken);

        if (user is null)
            return Result<RefreshTokenResponse>.Failure("Geçersiz veya süresi dolmuş refresh token.");

        var accessToken = jwtService.GenerateAccessToken(user);

        return Result<RefreshTokenResponse>.Success(new RefreshTokenResponse(accessToken, jwtService.AccessTokenExpiry));
    }
}
