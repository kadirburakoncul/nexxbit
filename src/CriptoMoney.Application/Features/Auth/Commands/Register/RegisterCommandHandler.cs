using CriptoMoney.Application.Common.Email;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CriptoMoney.Application.Features.Auth.Commands.Register;

public class RegisterCommandHandler(
    IUnitOfWork uow,
    IApplicationDbContext db,
    IEmailService emailService,
    IConfiguration config,
    IPasswordHasher passwordHasher) : IRequestHandler<RegisterCommand, Result<RegisterResponse>>
{
    public async Task<Result<RegisterResponse>> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var exists = await uow.Users.AnyAsync(u => u.Email == request.Email.ToLowerInvariant(), cancellationToken);
        if (exists)
            return Result<RegisterResponse>.Failure("Bu e-posta adresi zaten kayıtlı.");

        var verifyToken = Guid.NewGuid().ToString("N");

        var user = new User
        {
            Email = request.Email.ToLowerInvariant(),
            PasswordHash = passwordHasher.Hash(request.Password),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Role = UserRole.User,
            EmailVerifyToken = verifyToken,
            EmailVerifyTokenExpiry = DateTime.UtcNow.AddHours(24),
        };

        var riskSettings = new UserRiskSettings { UserId = user.Id };
        user.RiskSettings = riskSettings;

        uow.Users.Add(user);
        await uow.CommitAsync(cancellationToken);

        var baseUrl = config["Frontend:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:3000";
        var verifyUrl = $"{baseUrl}/verify-email?token={verifyToken}";
        await emailService.SendAsync(user.Email,
            "Nexxbit — E-posta adresinizi doğrulayın",
            EmailTemplates.VerifyEmail(user.FirstName, verifyUrl),
            cancellationToken);

        // Admin'lere yeni üye bildirimi gönder
        var admins = await db.Users
            .Where(u => u.Role == UserRole.Admin && !u.IsDeleted)
            .Select(u => new { u.Id, u.FirstName, u.Email })
            .ToListAsync(cancellationToken);

        foreach (var admin in admins)
        {
            db.Notifications.Add(new Notification
            {
                UserId = admin.Id,
                Type = NotificationType.System,
                Title = "Yeni Üye Kaydoldu",
                Body = $"{user.FullName} ({user.Email}) platforma kaydoldu.",
            });

            try
            {
                await emailService.SendAsync(admin.Email,
                    "Nexxbit — Yeni Üye Kaydı",
                    EmailTemplates.NewUserRegistered(admin.FirstName, user.FullName, user.Email, DateTime.UtcNow),
                    cancellationToken);
            }
            catch { /* Admin email gönderimi kritik değil, yoksay */ }
        }

        if (admins.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        return Result<RegisterResponse>.Success(new RegisterResponse(user.Id, user.Email, user.FullName));
    }
}
