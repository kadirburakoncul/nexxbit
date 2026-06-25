using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Auth.Commands.ResetPassword;

public class ResetPasswordCommandHandler(IApplicationDbContext db)
    : IRequestHandler<ResetPasswordCommand, Result>
{
    public async Task<Result> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token && !u.IsDeleted, cancellationToken);

        if (user is null)
            return Result.Failure("Geçersiz veya kullanılmış sıfırlama bağlantısı.");

        if (user.PasswordResetTokenExpiry.HasValue && user.PasswordResetTokenExpiry < DateTime.UtcNow)
            return Result.Failure("Sıfırlama bağlantısının süresi dolmuş. Lütfen yeniden talep edin.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
