using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.Logout;

public class LogoutCommandHandler(IUnitOfWork uow) : IRequestHandler<LogoutCommand, Result>
{
    public async Task<Result> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var user = await uow.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null) return Result.Success();

        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;

        uow.Users.Update(user);
        await uow.CommitAsync(cancellationToken);

        return Result.Success();
    }
}
