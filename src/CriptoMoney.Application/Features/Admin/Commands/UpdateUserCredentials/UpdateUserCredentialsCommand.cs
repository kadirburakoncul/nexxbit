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
            if (request.NewPassword.Length < 8)
                return Result.Failure("Şifre en az 8 karakter olmalıdır.");
            if (request.NewPassword.Length > 128)
                return Result.Failure("Şifre en fazla 128 karakter olabilir.");
            if (!request.NewPassword.Any(char.IsUpper))
                return Result.Failure("Şifre en az bir büyük harf içermelidir.");
            if (!request.NewPassword.Any(char.IsLower))
                return Result.Failure("Şifre en az bir küçük harf içermelidir.");
            if (!request.NewPassword.Any(char.IsDigit))
                return Result.Failure("Şifre en az bir rakam içermelidir.");

            user.PasswordHash = passwordHasher.Hash(request.NewPassword);
            // Şifre değiştiğinde mevcut refresh token'ı geçersiz kıl
            user.RefreshToken = null;
            user.RefreshTokenExpiry = null;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
