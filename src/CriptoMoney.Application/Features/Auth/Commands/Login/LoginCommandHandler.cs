using CriptoMoney.Application.Common.Email;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Auth.Commands.Login;

public class LoginCommandHandler(
    IUnitOfWork uow,
    IJwtService jwtService,
    IPasswordHasher passwordHasher,
    IApplicationDbContext db,
    IEmailService emailService)
    : IRequestHandler<LoginCommand, Result<LoginResponse>>
{
    public async Task<Result<LoginResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await uow.Users.FirstOrDefaultAsync(
            u => u.Email == request.Email.ToLowerInvariant(), cancellationToken);

        if (user is null)
            return Result<LoginResponse>.Failure("E-posta veya şifre hatalı.");

        if (!passwordHasher.Verify(request.Password, user.PasswordHash))
            return Result<LoginResponse>.Failure("E-posta veya şifre hatalı.");

        if (!user.IsEmailVerified)
            return Result<LoginResponse>.Failure("E-posta adresiniz doğrulanmamış. Lütfen e-posta kutunuzu kontrol edin.");

        var sysConfig = await db.SystemConfigs.FirstOrDefaultAsync(cancellationToken);
        var requireOtp = (sysConfig?.RequireLoginOtp ?? false) && !user.SkipLoginOtp;

        if (requireOtp)
        {
            var otp = Random.Shared.Next(100000, 999999).ToString();
            user.LoginOtpCode = otp;
            user.LoginOtpExpiry = DateTime.UtcNow.AddMinutes(5);
            uow.Users.Update(user);
            await uow.CommitAsync(cancellationToken);

            await emailService.SendAsync(user.Email,
                "Nexxbit — Giriş Doğrulama Kodu",
                EmailTemplates.LoginOtp(user.FirstName, otp),
                cancellationToken);

            return Result<LoginResponse>.Success(new LoginResponse(
                RequiresOtp: true,
                AccessToken: null, RefreshToken: null, AccessTokenExpiry: null,
                UserId: null, Email: user.Email, FullName: null, Role: null));
        }

        return Result<LoginResponse>.Success(IssueTokens(user, jwtService));
    }

    internal static LoginResponse IssueTokens(Domain.Entities.User user, IJwtService jwtService)
    {
        var accessToken = jwtService.GenerateAccessToken(user);
        var refreshToken = jwtService.GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(30);
        user.LastLoginAt = DateTime.UtcNow;
        user.LoginOtpCode = null;
        user.LoginOtpExpiry = null;
        return new LoginResponse(
            RequiresOtp: false,
            AccessToken: accessToken,
            RefreshToken: refreshToken,
            AccessTokenExpiry: jwtService.AccessTokenExpiry,
            UserId: user.Id,
            Email: user.Email,
            FullName: user.FullName,
            Role: user.Role.ToString());
    }
}
