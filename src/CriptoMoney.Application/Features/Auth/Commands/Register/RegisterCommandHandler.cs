using CriptoMoney.Application.Common.Email;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace CriptoMoney.Application.Features.Auth.Commands.Register;

public class RegisterCommandHandler(
    IUnitOfWork uow,
    IEmailService emailService,
    IConfiguration config) : IRequestHandler<RegisterCommand, Result<RegisterResponse>>
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
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
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

        return Result<RegisterResponse>.Success(new RegisterResponse(user.Id, user.Email, user.FullName));
    }
}
