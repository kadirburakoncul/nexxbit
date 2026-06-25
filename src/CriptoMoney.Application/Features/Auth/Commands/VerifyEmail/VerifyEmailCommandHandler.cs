using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Auth.Commands.VerifyEmail;

public class VerifyEmailCommandHandler(IApplicationDbContext db)
    : IRequestHandler<VerifyEmailCommand, Result>
{
    public async Task<Result> Handle(VerifyEmailCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.EmailVerifyToken == request.Token, cancellationToken);

        if (user is null)
            return Result.Failure("Geçersiz doğrulama bağlantısı.");

        if (user.EmailVerifyTokenExpiry.HasValue && user.EmailVerifyTokenExpiry < DateTime.UtcNow)
            return Result.Failure("Doğrulama bağlantısının süresi dolmuş. Lütfen yeni bağlantı talep edin.");

        user.IsEmailVerified = true;
        user.EmailVerifyToken = null;
        user.EmailVerifyTokenExpiry = null;
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
