using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Application.Features.Auth.Commands.Login;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.VerifyLoginOtp;

public record VerifyLoginOtpCommand(string Email, string Otp) : IRequest<Result<LoginResponse>>;

public class VerifyLoginOtpCommandHandler(IUnitOfWork uow, IJwtService jwtService)
    : IRequestHandler<VerifyLoginOtpCommand, Result<LoginResponse>>
{
    public async Task<Result<LoginResponse>> Handle(VerifyLoginOtpCommand request, CancellationToken cancellationToken)
    {
        var user = await uow.Users.FirstOrDefaultAsync(
            u => u.Email == request.Email.ToLowerInvariant(), cancellationToken);

        if (user is null || user.LoginOtpCode is null)
            return Result<LoginResponse>.Failure("Geçersiz doğrulama isteği.");

        if (user.LoginOtpExpiry.HasValue && user.LoginOtpExpiry < DateTime.UtcNow)
            return Result<LoginResponse>.Failure("Doğrulama kodunun süresi dolmuş. Lütfen tekrar giriş yapın.");

        if (user.LoginOtpCode != request.Otp.Trim())
            return Result<LoginResponse>.Failure("Doğrulama kodu hatalı.");

        var response = LoginCommandHandler.IssueTokens(user, jwtService);
        uow.Users.Update(user);
        await uow.CommitAsync(cancellationToken);

        return Result<LoginResponse>.Success(response);
    }
}
