using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Auth.Commands.ChangePassword;

public class ChangePasswordCommandHandler(
    IApplicationDbContext db,
    IPasswordHasher passwordHasher) : IRequestHandler<ChangePasswordCommand, Result>
{
    public async Task<Result> Handle(ChangePasswordCommand request, CancellationToken ct)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == request.UserId && !u.IsDeleted, ct);

        if (user is null)
            return Result.Failure("Kullanıcı bulunamadı.");

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            return Result.Failure("Mevcut şifre hatalı.");

        if (request.NewPassword.Length < 6)
            return Result.Failure("Yeni şifre en az 6 karakter olmalıdır.");

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
