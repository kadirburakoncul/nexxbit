using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Admin.Commands.SetUserRole;

public class SetUserRoleCommandHandler(IApplicationDbContext db)
    : IRequestHandler<SetUserRoleCommand, Result>
{
    public async Task<Result> Handle(SetUserRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == request.TargetUserId, cancellationToken);

        if (user is null)
            return Result.Failure("Kullanıcı bulunamadı.");

        user.Role = request.Role;
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
