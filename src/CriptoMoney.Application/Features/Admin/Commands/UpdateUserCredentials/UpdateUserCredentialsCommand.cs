using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Admin.Commands.UpdateUserCredentials;

public record UpdateUserCredentialsCommand(
    Guid TargetUserId,
    string? NewEmail,
    string? NewPassword
) : IRequest<Result>;

public class UpdateUserCredentialsCommandHandler(IApplicationDbContext db, IPasswordHasher passwordHasher)
    : IRequestHandler<UpdateUserCredentialsCommand, Result>
{
    public async Task<Result> Handle(UpdateUserCredentialsCommand request, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.TargetUserId, ct);
        if (user is null)
            return Result.Failure("Kullanıcı bulunamadı.");

        if (!string.IsNullOrWhiteSpace(request.NewEmail))
        {
            var emailExists = await db.Users
                .AnyAsync(u => u.Email == request.NewEmail.Trim().ToLower() && u.Id != request.TargetUserId, ct);
            if (emailExists)
                return Result.Failure("Bu e-posta başka bir kullanıcı tarafından kullanılıyor.");

            user.Email = request.NewEmail.Trim().ToLower();
            user.IsEmailVerified = true;
        }

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            if (request.NewPassword.Length < 6)
                return Result.Failure("Şifre en az 6 karakter olmalıdır.");

            user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
