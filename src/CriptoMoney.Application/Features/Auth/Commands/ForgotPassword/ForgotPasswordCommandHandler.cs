using CriptoMoney.Application.Common.Email;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CriptoMoney.Application.Features.Auth.Commands.ForgotPassword;

public class ForgotPasswordCommandHandler(
    IApplicationDbContext db,
    IEmailService emailService,
    IConfiguration config) : IRequestHandler<ForgotPasswordCommand, Result>
{
    public async Task<Result> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant() && !u.IsDeleted, cancellationToken);

        // Güvenlik: e-posta bulunamasa bile başarılı yanıt döndür (enumeration attack engeli)
        if (user is null)
            return Result.Success();

        var resetToken = Guid.NewGuid().ToString("N");
        user.PasswordResetToken = resetToken;
        user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);
        await db.SaveChangesAsync(cancellationToken);

        var baseUrl = config["Frontend:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:3000";
        var resetUrl = $"{baseUrl}/reset-password?token={resetToken}";
        await emailService.SendAsync(user.Email,
            "Nexxbit — Şifre sıfırlama isteği",
            EmailTemplates.ResetPassword(user.FirstName, resetUrl),
            cancellationToken);

        return Result.Success();
    }
}
