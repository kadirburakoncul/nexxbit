using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Admin.Commands.SoftDeleteUser;

public class SoftDeleteUserCommandHandler(IApplicationDbContext db)
    : IRequestHandler<SoftDeleteUserCommand, Result>
{
    public async Task<Result> Handle(SoftDeleteUserCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == request.TargetUserId, cancellationToken);

        if (user is null)
            return Result.Failure("Kullanıcı bulunamadı.");

        user.IsDeleted = !request.Restore;
        user.DeletedAt = request.Restore ? null : DateTime.UtcNow;
        user.IsActive = request.Restore;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
